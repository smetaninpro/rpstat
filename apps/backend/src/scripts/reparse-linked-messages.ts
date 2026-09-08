import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Bulk reparse is disabled in production. Use review actions.');
  const messages = await prisma.integrationMessage.findMany({ where: { status: 'REVIEW_REQUIRED', errorCode: 'ALIAS_LINKED_REPARSE_REQUIRED', employeeId: { not: null } }, include: { discordSource: { include: { rules: { where: { enabled: true }, orderBy: { priority: 'desc' } } } } } });
  let parsed = 0; let unparsed = 0;
  for (const message of messages) {
    const match = /^\s*(\d+)(?:\s*[-–—]\s*(\d+))?\s*$/.exec(message.textRaw);
    if (!match || !message.employeeId || !message.discordSource.rules[0]?.activityTypeId) { await prisma.integrationMessage.update({ where: { id: message.id }, data: { status: 'UNPARSED', errorCode: null } }); unparsed++; continue; }
    const from = Number(match[1]); const to = Number(match[2] ?? match[1]); const sequenceQuantity = to - from + 1;
    if (to < from || sequenceQuantity > Number(process.env.MAX_SEQUENCE_RANGE ?? 30)) { await prisma.integrationMessage.update({ where: { id: message.id }, data: { status: 'REVIEW_REQUIRED', errorCode: 'INVALID_SEQUENCE_RANGE' } }); unparsed++; continue; }
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    const quantity = message.discordSource.countMode === 'ATTACHMENTS' ? attachments.length : 0;
    if (!quantity) { await prisma.integrationMessage.update({ where: { id: message.id }, data: { status: 'REVIEW_REQUIRED', parsedFrom: from, parsedTo: to, parsedQuantity: 0, errorCode: 'MISSING_ATTACHMENTS' } }); unparsed++; continue; }
    try { await prisma.$transaction(async (tx) => { for (let value = from; value <= to; value++) await tx.sourceSequenceItem.create({ data: { sourceId: message.sourceId, sequenceNumber: value, integrationMessageId: message.id, employeeId: message.employeeId! } }); const event = await tx.activityEvent.create({ data: { employeeId: message.employeeId!, activityTypeId: message.discordSource.rules[0].activityTypeId!, quantity, occurredAt: message.messageTimestamp, sourceType: 'DISCORD', sourceId: message.sourceId, integrationMessageId: message.id } }); await tx.sourceSequenceItem.updateMany({ where: { integrationMessageId: message.id }, data: { activityEventId: event.id } }); await tx.integrationMessage.update({ where: { id: message.id }, data: { status: 'PARSED', parsedFrom: from, parsedTo: to, parsedQuantity: quantity, errorCode: null } }); }); parsed++; } catch { await prisma.integrationMessage.update({ where: { id: message.id }, data: { status: 'SEQUENCE_CONFLICT', errorCode: null } }); }
  }
  console.log(JSON.stringify({ parsed, unparsed }));
}
main().catch((error: Error) => { console.error(error.message); process.exit(1); }).finally(() => prisma.$disconnect());
