import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Development seed is disabled in production.');
  const ranks = ['Младший сержант', 'Сержант', 'Старший сержант', 'Старшина', 'Прапорщик', 'Старший прапорщик', 'Младший лейтенант', 'Лейтенант', 'Старший лейтенант', 'Капитан', 'Майор', 'Подполковник', 'Полковник', 'Генерал-майор', 'Генерал-лейтенант'];
  for (const [sortOrder, name] of ranks.entries()) await prisma.rank.upsert({ where: { name }, update: {}, create: { name, sortOrder: sortOrder + 1 } });
  for (const code of ['A', 'O', 'M', 'K']) await prisma.department.upsert({ where: { code }, update: {}, create: { code, name: code, sortOrder: code.charCodeAt(0) } });
  for (const [sortOrder, name] of ['Стажер', 'Инструктор', 'Старший инструктор', 'Начальник Управления'].entries()) { const position = await prisma.position.upsert({ where: { name }, update: {}, create: { name, sortOrder } }); await prisma.positionAlias.upsert({ where: { normalizedAlias: name.toLowerCase() }, update: {}, create: { positionId: position.id, alias: name, normalizedAlias: name.toLowerCase() } }); }
  const chief = await prisma.position.findUniqueOrThrow({ where: { name: 'Начальник Управления' } }); await prisma.positionAlias.upsert({ where: { normalizedAlias: 'нач.'.toLowerCase() }, update: { positionId: chief.id, alias: 'Нач.' }, create: { positionId: chief.id, alias: 'Нач.', normalizedAlias: 'нач.' } });
  for (const [sortOrder, [code, name]] of [['FINE', 'Штрафы'], ['ARREST', 'Аресты'], ['DELIVERY', 'Поставки'], ['EXAM_ACCEPTED', 'Принятые экзамены'], ['LECTURE', 'Проведенные лекции'], ['RECRUITMENT', 'Вербовки'], ['REATTESTATION', 'Переаттестации']].entries()) await prisma.activityType.upsert({ where: { code }, update: {}, create: { code, name, singularName: name, sortOrder } });
  const department = await prisma.department.findUniqueOrThrow({ where: { code: 'O' } }); const position = await prisma.position.findUniqueOrThrow({ where: { name: 'Старший инструктор' } }); const rank = await prisma.rank.findUniqueOrThrow({ where: { name: 'Лейтенант' } });
  const employee = await prisma.employee.upsert({ where: { discordUserId: 'development-rudnev' }, update: {}, create: { gameName: 'Всеволод Руднев', discordUserId: 'development-rudnev', discordDisplayName: 'Ст. Инстр. "О" | Всеволод Руднев', departmentId: department.id, positionId: position.id, rankId: rank.id } });
  await prisma.employee.upsert({ where: { discordUserId: 'development-kalugin' }, update: {}, create: { gameName: 'Василий Калугин', discordUserId: 'development-kalugin', discordDisplayName: 'Стажер "А" | Василий Калугин', departmentId: (await prisma.department.findUniqueOrThrow({ where: { code: 'A' } })).id, positionId: (await prisma.position.findUniqueOrThrow({ where: { name: 'Стажер' } })).id } });
  const arrest = await prisma.activityType.findUniqueOrThrow({ where: { code: 'ARREST' } });
  if (!await prisma.activityEvent.count({ where: { employeeId: employee.id, activityTypeId: arrest.id } })) await prisma.activityEvent.create({ data: { employeeId: employee.id, activityTypeId: arrest.id, quantity: 3, occurredAt: new Date(), sourceType: 'MANUAL', metadata: { reason: 'Development seed' } } });
  console.log('Development data seeded.');
}
main().finally(() => prisma.$disconnect());
