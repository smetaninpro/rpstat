import { createHmac, randomUUID } from 'crypto';
import { DiscordWebAdapter } from './discord-web.adapter.js';

const baseUrl = process.env.BACKEND_INTERNAL_URL ?? 'http://backend:3001';
const configuredSecret = process.env.COLLECTOR_SHARED_SECRET;
if (!configuredSecret || Buffer.byteLength(configuredSecret) < 32) throw new Error('COLLECTOR_SHARED_SECRET must be at least 32 bytes');
const secret: string = configuredSecret;

async function signedFetch(path: string, init: RequestInit = {}) {
  const body = typeof init.body === 'string' ? init.body : ''; const timestamp = String(Date.now()); const requestId = randomUUID(); const signature = createHmac('sha256', secret).update(`${timestamp}.${requestId}.${body}`).digest('hex');
  return fetch(`${baseUrl}${path}`, { ...init, headers: { ...init.headers, 'X-Collector-Timestamp': timestamp, 'X-Collector-Request-Id': requestId, 'X-Collector-Signature': signature } });
}

async function main() {
  if (process.env.COLLECTOR_ENABLED !== 'true') throw new Error('Set COLLECTOR_ENABLED=true only after manual Discord login.');
  const response = await signedFetch('/api/internal/collector/config'); if (!response.ok) throw new Error(`Config request failed: ${response.status}`);
  const config = await response.json() as { globalLookbackDays: number; sources: { id: string; name: string; channelUrl: string; lookbackDays: number | null }[] };
  const adapter = new DiscordWebAdapter(); await adapter.start(true);
  try {
    const selectedSources = process.env.COLLECTOR_SOURCE_ID ? config.sources.filter((source) => source.id === process.env.COLLECTOR_SOURCE_ID) : config.sources;
    if (!selectedSources.length) throw new Error('Configured COLLECTOR_SOURCE_ID was not found');
    const recentOnly = process.env.COLLECTOR_RECENT_ONLY === 'true';
    const recentDays = Number(process.env.COLLECTOR_RECENT_DAYS ?? 3);
    for (const [index, source] of selectedSources.entries()) { if (index) await new Promise((resolve) => setTimeout(resolve, 5000)); const cutoff = new Date(Date.now() - (recentOnly ? recentDays : (source.lookbackDays ?? config.globalLookbackDays)) * 86400000); const messages = recentOnly ? await adapter.readRecentChannel(source.channelUrl, cutoff, 20) : await adapter.readChannel(source.channelUrl, cutoff); const results = []; for (let offset = 0; offset < messages.length; offset += 25) { const submit = await signedFetch('/api/internal/integrations/discord/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceId: source.id, messages: messages.slice(offset, offset + 25) }) }); if (!submit.ok) throw new Error(`Submit failed for ${source.name}: ${submit.status} ${await submit.text()}`); results.push(await submit.json()); } console.log(JSON.stringify({ source: source.name, mode: recentOnly ? 'RECENT_20_3_DAYS' : 'FULL_HISTORY', scanned: messages.length, batches: results.length, result: results })); }
  } finally { await adapter.stop(); }
}
main().catch((error: Error) => { console.error(error.message); process.exit(1); });
