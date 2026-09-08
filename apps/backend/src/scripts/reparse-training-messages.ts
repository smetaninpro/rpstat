import { PrismaClient } from '@prisma/client';
import { parseTrainingMessage } from '../training-parser';

const prisma = new PrismaClient();
async function main() {
  const messages = await prisma.integrationMessage.findMany({ where: { status: 'MISSING_MENTIONS', discordSource: { parserMode: 'TRAINING_MESSAGE' } }, include: { discordSource: true } });
  let waitingForMentions = 0;
  for (const message of messages) { const parsed = parseTrainingMessage(message.textRaw); await prisma.integrationMessage.update({ where: { id: message.id }, data: { status: 'REVIEW_REQUIRED', errorCode: 'REQUIRES_MENTION_RESCAN', errorMessage: `Учебных строк: ${parsed.items.length}; нужны исходные mentions` } }); waitingForMentions++; }
  console.log(JSON.stringify({ waitingForMentions }));
}
main().catch((error: Error) => { console.error(error.message); process.exit(1); }).finally(() => prisma.$disconnect());
