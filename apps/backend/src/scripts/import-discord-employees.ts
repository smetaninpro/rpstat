import { PrismaClient } from '@prisma/client';
import { parseDiscordNickname } from '../discord-nickname';

const prisma = new PrismaClient();
const source = 'discord-web';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Initial employee import is disabled in production. Use the admin review workflow.');
  const messages = await prisma.integrationMessage.findMany({ where: { channelId: { in: ['1369706099950878862', '1415314393872465970', '1367595830848258048'] } }, distinct: ['authorRaw'], select: { authorRaw: true } });
  let imported = 0; let unresolved = 0;
  for (const { authorRaw } of messages) {
    const parsed = parseDiscordNickname(authorRaw);
    if (!parsed) { unresolved++; continue; }
    const [positionAlias, department] = await Promise.all([prisma.positionAlias.findUnique({ where: { normalizedAlias: parsed.positionRaw.toLowerCase() } }), parsed.departmentRaw ? prisma.department.findUnique({ where: { code: parsed.departmentRaw } }) : null]);
    const existing = await prisma.employee.findFirst({ where: { gameName: parsed.gameName } });
    const employee = existing
      ? await prisma.$transaction(async (tx) => {
        if (existing.positionRaw !== parsed.positionRaw || existing.positionId !== (positionAlias?.positionId ?? null) || existing.departmentId !== (department?.id ?? null)) await tx.employeePositionHistory.create({ data: { employeeId: existing.id, positionRaw: parsed.positionRaw, positionId: positionAlias?.positionId, departmentId: department?.id } });
        return tx.employee.update({ where: { id: existing.id }, data: { discordDisplayName: authorRaw, positionRaw: parsed.positionRaw, positionId: positionAlias?.positionId, departmentId: department?.id } });
      })
      : await prisma.employee.create({ data: { gameName: parsed.gameName, discordDisplayName: authorRaw, positionRaw: parsed.positionRaw, positionId: positionAlias?.positionId, departmentId: department?.id } });
    const normalizedAlias = authorRaw.trim().replace(/\s+/g, ' ').toLowerCase();
    await prisma.employeeAlias.upsert({ where: { source_normalizedAlias: { source, normalizedAlias } }, update: { employeeId: employee.id, alias: authorRaw }, create: { employeeId: employee.id, source, alias: authorRaw, normalizedAlias } });
    await prisma.integrationMessage.updateMany({ where: { authorRaw, status: { in: ['UNKNOWN_EMPLOYEE', 'UNPARSED'] } }, data: { employeeId: employee.id, status: 'REVIEW_REQUIRED', errorCode: 'ALIAS_LINKED_REPARSE_REQUIRED' } });
    imported++;
  }
  console.log(JSON.stringify({ imported, unresolved }));
}
main().catch((error: Error) => { console.error(error.message); process.exit(1); }).finally(() => prisma.$disconnect());
