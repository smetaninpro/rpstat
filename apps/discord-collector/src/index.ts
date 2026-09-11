import { createHmac, randomUUID } from "crypto";
import { DiscordWebAdapter } from "./discord-web.adapter.js";

const baseUrl = process.env.BACKEND_INTERNAL_URL ?? "http://backend:3001";
const configuredSecret = process.env.COLLECTOR_SHARED_SECRET;
if (!configuredSecret || Buffer.byteLength(configuredSecret) < 32) {
  throw new Error("COLLECTOR_SHARED_SECRET must be at least 32 bytes");
}
const secret: string = configuredSecret;
let running = false;

async function signedFetch(path: string, init: RequestInit = {}) {
  const body = typeof init.body === "string" ? init.body : "";
  const timestamp = String(Date.now());
  const requestId = randomUUID();
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${requestId}.${body}`)
    .digest("hex");
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      "X-Collector-Timestamp": timestamp,
      "X-Collector-Request-Id": requestId,
      "X-Collector-Signature": signature,
    },
  });
}

type Source = { id: string; name: string; channelUrl: string };
type Config = { sources: Source[] };
type ScanRequest = { id: string; sourceId?: string; recentDays: number; limit: number };

async function heartbeat(status: "IDLE" | "DEGRADED", lastError?: string) {
  const response = await signedFetch("/api/internal/collector/heartbeat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "discord-web", version: "0.1.0", status, lastError }),
  });
  if (!response.ok) throw new Error(`Heartbeat failed: ${response.status}`);
}

async function fail(requestId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown collector error";
  await signedFetch(`/api/internal/collector/scan-requests/${requestId}/fail`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ errorMessage: message }),
  });
}

async function cycle() {
  if (running) return;
  running = true;
  let request: ScanRequest | null = null;
  let adapter: DiscordWebAdapter | undefined;
  try {
    const claim = await signedFetch("/api/internal/collector/scan-requests/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (!claim.ok) throw new Error(`Scan request claim failed: ${claim.status}`);
    const rawRequest = await claim.text();
    request = rawRequest ? (JSON.parse(rawRequest) as ScanRequest) : null;
    if (!request) {
      await heartbeat("IDLE");
      return;
    }

    const configResponse = await signedFetch("/api/internal/collector/config");
    if (!configResponse.ok) throw new Error(`Config request failed: ${configResponse.status}`);
    const config = (await configResponse.json()) as Config;
    const scanRequest = request;
    const sources = scanRequest.sourceId
      ? config.sources.filter((source) => source.id === scanRequest.sourceId)
      : config.sources;
    adapter = new DiscordWebAdapter();
    await adapter.start(true);

    const results: { source: string; scanned: number; accepted: number }[] = [];
    for (const source of sources) {
      const messages = await adapter.readRecentChannel(
        source.channelUrl,
        new Date(Date.now() - scanRequest.recentDays * 86400000),
        scanRequest.limit,
      );
      const response = await signedFetch("/api/internal/integrations/discord/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: source.id, messages }),
      });
      if (!response.ok) throw new Error(`Message submit failed: ${response.status}`);
      const result = (await response.json()) as { accepted: number };
      results.push({ source: source.name, scanned: messages.length, accepted: result.accepted });
    }
    const complete = await signedFetch(`/api/internal/collector/scan-requests/${scanRequest.id}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: results }),
    });
    if (!complete.ok) throw new Error(`Scan request complete failed: ${complete.status}`);
  } catch (error) {
    if (request) await fail(request.id, error);
    else await heartbeat("DEGRADED", error instanceof Error ? error.message : "Unknown collector error");
  } finally {
    await adapter?.stop().catch(() => undefined);
    running = false;
  }
}

void cycle();
setInterval(() => void cycle(), 60000);
