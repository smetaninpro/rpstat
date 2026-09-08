import { createHmac, randomUUID } from 'crypto';

async function main() {
  const sourceId = process.env.DEMO_TRAINING_SOURCE_ID; const secret = process.env.COLLECTOR_SHARED_SECRET; const baseUrl = process.env.BACKEND_INTERNAL_URL ?? 'http://127.0.0.1:3001';
  if (!sourceId || !secret) throw new Error('DEMO_TRAINING_SOURCE_ID and COLLECTOR_SHARED_SECRET are required');
  const now = new Date().toISOString(); const body = JSON.stringify({ sourceId, messages: [{ source: 'discord-web', guildId: '100000000000000001', channelId: '100000000000000003', messageId: `training-demo-${Date.now()}`, author: { displayName: 'Учебный канал' }, mentions: [{ discordUserId: 'development-rudnev', displayName: 'Ст. Инстр. "О" | Всеволод Руднев' }, { discordUserId: 'development-kalugin', displayName: 'Стажер "А" | Василий Калугин' }], text: 'Сдать теоретический экзамен: ✅\nПрослушать вступительную лекцию: ✅', timestamp: now, collectedAt: now }] });
  const timestamp = String(Date.now()); const requestId = randomUUID(); const signature = createHmac('sha256', secret).update(`${timestamp}.${requestId}.${body}`).digest('hex'); const response = await fetch(`${baseUrl}/api/internal/integrations/discord/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Collector-Timestamp': timestamp, 'X-Collector-Request-Id': requestId, 'X-Collector-Signature': signature }, body });
  if (!response.ok) throw new Error(await response.text()); console.log(await response.text());
}
main().catch((error: Error) => { console.error(error.message); process.exit(1); });
