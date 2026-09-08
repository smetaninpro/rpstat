import { ParserMode, PrismaClient } from '@prisma/client';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Development demo source is disabled in production.');
  const prisma = new PrismaClient();
  try {
    const activity = await prisma.activityType.findUniqueOrThrow({ where: { code: 'ARREST' } });
    const source = await prisma.discordSource.upsert({ where: { channelUrl: 'https://discord.com/channels/100000000000000001/100000000000000002' }, update: {}, create: { name: 'Демо: Аресты', channelUrl: 'https://discord.com/channels/100000000000000001/100000000000000002', guildId: '100000000000000001', channelId: '100000000000000002', enabled: true, parserMode: ParserMode.SEQUENCE_RANGE, status: 'ACTIVE' } });
    await prisma.discordSourceRule.upsert({ where: { id: '00000000-0000-0000-0000-000000000001' }, update: { activityTypeId: activity.id, enabled: true }, create: { id: '00000000-0000-0000-0000-000000000001', sourceId: source.id, activityTypeId: activity.id, parserKey: 'SEQUENCE_RANGE', priority: 100, enabled: true } });
    console.log(JSON.stringify({ sourceId: source.id, guildId: source.guildId, channelId: source.channelId }));
  } finally { await prisma.$disconnect(); }
}
main().catch((error: Error) => { console.error(error.message); process.exit(1); });
