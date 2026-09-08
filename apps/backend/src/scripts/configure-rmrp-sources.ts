import { ParserMode, PrismaClient } from '@prisma/client';

const guildId = '1367595442237345814';
const sources = [
  { name: 'Аресты', channelId: '1369706099950878862', activityCode: 'ARREST' },
  { name: 'Штрафы', channelId: '1415314393872465970', activityCode: 'FINE' },
] as const;

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Initial source configuration must be performed through the admin interface in production.');
  const prisma = new PrismaClient();
  try {
    await prisma.discordSource.updateMany({ where: { name: { startsWith: 'Демо:' } }, data: { enabled: false, status: 'PAUSED' } });
    for (const definition of sources) {
      const activityType = await prisma.activityType.findUniqueOrThrow({ where: { code: definition.activityCode } });
      const channelUrl = `https://discord.com/channels/${guildId}/${definition.channelId}`;
      const source = await prisma.discordSource.upsert({ where: { channelUrl }, update: { name: definition.name, enabled: true, parserMode: ParserMode.SEQUENCE_RANGE, lookbackDays: 3, status: 'ACTIVE' }, create: { name: definition.name, channelUrl, guildId, channelId: definition.channelId, enabled: true, parserMode: ParserMode.SEQUENCE_RANGE, lookbackDays: 3, status: 'ACTIVE' } });
      const existing = await prisma.discordSourceRule.findFirst({ where: { sourceId: source.id, parserKey: 'SEQUENCE_RANGE' } });
      if (existing) await prisma.discordSourceRule.update({ where: { id: existing.id }, data: { activityTypeId: activityType.id, enabled: true, priority: 100 } });
      else await prisma.discordSourceRule.create({ data: { sourceId: source.id, activityTypeId: activityType.id, parserKey: 'SEQUENCE_RANGE', enabled: true, priority: 100 } });
      console.log(`${definition.name}: ${source.id}`);
    }
  } finally { await prisma.$disconnect(); }
}
main().catch((error: Error) => { console.error(error.message); process.exit(1); });
