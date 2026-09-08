import { createHmac, randomUUID } from 'crypto';

async function main() {
  const baseUrl = process.env.BACKEND_INTERNAL_URL ?? 'http://127.0.0.1:3001'; const secret = process.env.COLLECTOR_SHARED_SECRET;
  if (!secret) throw new Error('COLLECTOR_SHARED_SECRET is required');
  const sourceId = process.env.DEMO_SOURCE_ID; const employeeDiscordId = process.env.DEMO_EMPLOYEE_DISCORD_ID ?? 'development-rudnev';
  if (!sourceId) throw new Error('DEMO_SOURCE_ID is required');
  const body = JSON.stringify({ sourceId, messages: [{ source: 'discord-web', guildId: '100000000000000001', channelId: '100000000000000002', messageId: `demo-${Date.now()}`, author: { discordUserId: employeeDiscordId, displayName: 'Ст. Инстр. "О" | Всеволод Руднев' }, mentions: [], text: '1-3', timestamp: new Date().toISOString(), collectedAt: new Date().toISOString() }] });
  const timestamp = String(Date.now()); const requestId = randomUUID(); const signature = createHmac('sha256', secret).update(`${timestamp}.${requestId}.${body}`).digest('hex');
  const response = await fetch(`${baseUrl}/api/internal/integrations/discord/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Collector-Timestamp': timestamp, 'X-Collector-Request-Id': requestId, 'X-Collector-Signature': signature }, body });
  if (!response.ok) throw new Error(`Demo submit failed: ${response.status} ${await response.text()}`);
  console.log(await response.text());
}
main().catch((error: Error) => { console.error(error.message); process.exit(1); });
