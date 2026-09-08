import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertAllowedDiscordChannelUrl, forbiddenDiscordActions } from './readonly-policy.js';

test('allows only direct Discord channel URLs', () => {
  assert.equal(assertAllowedDiscordChannelUrl('https://discord.com/channels/123/456').pathname, '/channels/123/456');
  assert.throws(() => assertAllowedDiscordChannelUrl('https://example.com'));
  assert.throws(() => assertAllowedDiscordChannelUrl('https://discord.com/login'));
});

test('contains no Playwright mutation API in the normal collector adapter', () => {
  const source = readFileSync(join(__dirname, 'discord-web.adapter.ts'), 'utf8');
  for (const action of forbiddenDiscordActions) assert.equal(source.includes(action), false, `Forbidden action: ${action}`);
});
