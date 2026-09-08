import { ParserMode, PrismaClient } from '@prisma/client';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Development demo source is disabled in production.');
  const prisma = new PrismaClient();
  try {
    const source = await prisma.discordSource.upsert({ where: { channelUrl: 'https://discord.com/channels/100000000000000001/100000000000000003' }, update: {}, create: { name: 'Демо: Экзамены и лекции', channelUrl: 'https://discord.com/channels/100000000000000001/100000000000000003', guildId: '100000000000000001', channelId: '100000000000000003', enabled: true, parserMode: ParserMode.TRAINING_MESSAGE, status: 'ACTIVE' } });
    console.log(JSON.stringify({ sourceId: source.id, guildId: source.guildId, channelId: source.channelId }));
  } finally { await prisma.$disconnect(); }
}
main().catch((error: Error) => { console.error(error.message); process.exit(1); });
