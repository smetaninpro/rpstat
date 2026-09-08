import * as argon2 from 'argon2';
import { PrismaClient, Role } from '@prisma/client';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

async function main() {
  const prompt = createInterface({ input, output });
  const prisma = new PrismaClient();
  try {
    const username = (await prompt.question('Логин: ')).trim();
    const password = await prompt.question('Пароль (минимум 12 символов): ');
    if (!/^[a-zA-Z0-9_.-]{3,128}$/.test(username) || password.length < 12 || password.length > 128) throw new Error('Некорректный логин или пароль.');
    await prisma.user.create({ data: { username, passwordHash: await argon2.hash(password, { type: argon2.argon2id }), role: Role.ADMIN } });
    console.log('Администратор создан.');
  } finally {
    await prisma.$disconnect();
    prompt.close();
  }
}

main().catch((error: Error) => { console.error(error.message); process.exit(1); });
