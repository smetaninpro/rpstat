import { chromium } from 'playwright';

async function main() {
  const context = await chromium.launchPersistentContext('/data/discord-profile', { headless: false });
  const page = await context.newPage();
  await page.goto('https://discord.com/login');
  console.log('Complete login manually in this browser. This auth-only mode does not send or modify Discord data. Stop with Ctrl+C only after Discord has opened normally.');
  await new Promise<void>(() => undefined);
  await context.close();
}
main().catch((error: Error) => { console.error(error.message); process.exit(1); });
