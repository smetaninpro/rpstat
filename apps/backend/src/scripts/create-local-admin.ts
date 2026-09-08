import * as argon2 from 'argon2';
import { PrismaClient, Role } from '@prisma/client';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Local bootstrap is disabled in production.');
  const username = process.env.INITIAL_ADMIN_USERNAME;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!username || !password || !/^[a-zA-Z0-9_.-]{3,128}$/.test(username) || password.length < 10 || password.length > 128) throw new Error('Set a valid INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD.');
  const prisma = new PrismaClient();
  try {
    await prisma.user.upsert({ where: { username }, update: { passwordHash: await argon2.hash(password, { type: argon2.argon2id }), role: Role.ADMIN, disabledAt: null }, create: { username, passwordHash: await argon2.hash(password, { type: argon2.argon2id }), role: Role.ADMIN } });
    console.log('Local administrator is ready.');
  } finally { await prisma.$disconnect(); }
}
main().catch((error: Error) => { console.error(error.message); process.exit(1); });
