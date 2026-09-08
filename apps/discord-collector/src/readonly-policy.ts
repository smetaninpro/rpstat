/**
 * These Playwright APIs can mutate Discord state. They are forbidden in the
 * normal collector; manual login remains isolated in the collector-auth mode.
 */
export const forbiddenDiscordActions = ['.click(', '.dblclick(', '.fill(', '.press(', '.type(', '.check(', '.uncheck(', '.selectOption(', '.dragTo(', '.dispatchEvent('] as const;

export function assertAllowedDiscordChannelUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'discord.com' || !/^\/channels\/\d+\/\d+$/.test(url.pathname)) throw new Error('Invalid Discord channel URL');
  return url;
}
