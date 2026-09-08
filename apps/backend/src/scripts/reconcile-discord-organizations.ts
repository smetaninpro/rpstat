import { PrismaClient } from '@prisma/client';
import { parseDiscordNickname } from '../discord-nickname';

const prisma = new PrismaClient();

async function main() {
  const departments = [['A', 'А'], ['K', 'К'], ['M', 'М'], ['O', 'О'], ['КР', 'Кадровый резерв'], ['АПС', 'АПС'], ['0', 'Кадровое подразделение']] as const;
  for (const [code, name] of departments) await prisma.department.upsert({ where: { code }, update: { name }, create: { code, name } });
  for (const name of ['Опер', 'Зам.Нач.', 'Стажёр', 'Нач. Кадров', 'Без должности']) { const position = await prisma.position.upsert({ where: { name }, update: {}, create: { name } }); await prisma.positionAlias.upsert({ where: { normalizedAlias: name.toLowerCase() }, update: {}, create: { positionId: position.id, alias: name, normalizedAlias: name.toLowerCase() } }); }
  const employees = await prisma.employee.findMany({ where: { discordDisplayName: { not: null } } }); let updated = 0; let unresolved = 0;
  for (const employee of employees) { const nickname = parseDiscordNickname(employee.discordDisplayName!); if (!nickname?.departmentRaw) { unresolved++; continue; } const [department, alias] = await Promise.all([prisma.department.findUnique({ where: { code: nickname.departmentRaw } }), prisma.positionAlias.findUnique({ where: { normalizedAlias: nickname.positionRaw.toLowerCase() } })]); if (!department) { unresolved++; continue; } if (employee.departmentId !== department.id || employee.positionRaw !== nickname.positionRaw || employee.positionId !== (alias?.positionId ?? null)) { await prisma.employeePositionHistory.create({ data: { employeeId: employee.id, departmentId: department.id, positionRaw: nickname.positionRaw, positionId: alias?.positionId } }); await prisma.employee.update({ where: { id: employee.id }, data: { departmentId: department.id, positionRaw: nickname.positionRaw, positionId: alias?.positionId } }); updated++; } }
  console.log(JSON.stringify({ updated, unresolved }));
}
main().catch((error: Error) => { console.error(error.message); process.exit(1); }).finally(() => prisma.$disconnect());
