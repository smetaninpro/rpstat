import { chromium, BrowserContext, Page } from "playwright";
import { discordSelectors } from "./discord-selectors.js";
import { assertAllowedDiscordChannelUrl } from "./readonly-policy.js";
import { cleanMentions } from "./message-payload.js";
export type CollectedMessage = {
  source: "discord-web";
  guildId?: string;
  channelId?: string;
  messageId?: string;
  author: { discordUserId?: string; displayName: string };
  mentions: { discordUserId?: string; displayName: string }[];
  text: string;
  timestamp: string;
  collectedAt: string;
  attachments: { filename?: string; contentType?: string; url?: string }[];
};
export class DiscordWebAdapter {
  private context?: BrowserContext;
  async start(headless = true) {
    this.context = await chromium.launchPersistentContext(
      "/data/discord-profile",
      { headless },
    );
  }
  async stop() {
    await this.context?.close();
  }
  private async waitForMessages(page: Page) {
    const messages = page.locator(discordSelectors.message);
    const rendered = await messages
      .first()
      .waitFor({ state: "attached", timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    const hasAuthScreen =
      (await page
        .locator('input[name="email"], input[name="password"]')
        .count()) +
      (await page.getByText(/captcha|verify|подтверд|войдите/i).count());
    if (hasAuthScreen || page.url().includes("/login"))
      throw new Error("AUTH_REQUIRED");
    if (!rendered)
      throw new Error(
        `NO_MESSAGES_RENDERED: url=${page.url()} title=${await page.title()}`,
      );
    return messages;
  }
  async readChannel(url: string, cutoff: Date): Promise<CollectedMessage[]> {
    if (!this.context) throw new Error("Browser context is not started");
    const channelUrl = assertAllowedDiscordChannelUrl(url);
    const [, guildId, channelId] =
      channelUrl.pathname.match(/^\/channels\/(\d+)\/(\d+)$/) ?? [];
    if (!guildId || !channelId) throw new Error("Invalid Discord channel URL");
    const page = await this.context.newPage();
    try {
      await page.goto(channelUrl.toString(), {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      const messagesLocator = await this.waitForMessages(page);
      let oldest = new Date();
      let stalled = 0;
      for (
        let pass = 0;
        pass < 120 && oldest >= cutoff && stalled < 4;
        pass++
      ) {
        const before = await page.evaluate(() => {
          const candidates = [
            ...document.querySelectorAll<HTMLElement>('[class*="scroller"]'),
          ]
            .filter(
              (element) =>
                element.scrollHeight > element.clientHeight &&
                element.scrollTop >= 0,
            )
            .sort((left, right) => right.scrollHeight - left.scrollHeight);
          const scroller = candidates[0];
          return scroller
            ? { top: scroller.scrollTop, height: scroller.scrollHeight }
            : null;
        });
        const timestamps = await messagesLocator
          .locator(discordSelectors.timestamp)
          .evaluateAll((nodes) =>
            nodes
              .map((node) => node.getAttribute("datetime"))
              .filter((value): value is string => Boolean(value)),
          );
        const nextOldest = timestamps.length
          ? new Date(
              Math.min(...timestamps.map((value) => new Date(value).getTime())),
            )
          : oldest;
        if (nextOldest >= oldest && before?.top === 0) stalled++;
        else stalled = 0;
        oldest = nextOldest;
        if (oldest < cutoff) break;
        const moved = await page.evaluate(() => {
          const candidates = [
            ...document.querySelectorAll<HTMLElement>('[class*="scroller"]'),
          ]
            .filter(
              (element) =>
                element.scrollHeight > element.clientHeight &&
                element.scrollTop >= 0,
            )
            .sort((left, right) => right.scrollHeight - left.scrollHeight);
          const scroller = candidates[0];
          if (!scroller) return false;
          const previous = scroller.scrollTop;
          scroller.scrollTop = Math.max(
            0,
            previous - Math.max(600, scroller.clientHeight * 0.8),
          );
          return scroller.scrollTop !== previous;
        });
        if (!moved && before?.top === 0) stalled++;
        await page.waitForTimeout(1000);
      }
      if (oldest >= cutoff) {
        await page.close();
        throw new Error(
          `INCOMPLETE_HISTORY: reached ${oldest.toISOString()} before cutoff ${cutoff.toISOString()}`,
        );
      }
      const messages = await messagesLocator.evaluateAll((nodes, selectors) => {
        let previousAuthor:
          { discordUserId?: string; displayName: string } | undefined;
        return nodes.flatMap((node) => {
          const time = node
            .querySelector(selectors.timestamp)
            ?.getAttribute("datetime");
          const authorNode = node.querySelector(selectors.author);
          const displayName = authorNode?.textContent?.trim();
          const discordUserId =
            authorNode?.getAttribute("data-user-id") ??
            node.getAttribute("data-message-author-id") ??
            undefined;
          if (displayName)
            previousAuthor = discordUserId
              ? { displayName, discordUserId }
              : { displayName };
          const text =
            node.querySelector(selectors.content)?.textContent?.trim() ?? "";
          const content = node.querySelector(selectors.content);
          const mentions = content
            ? [...content.querySelectorAll(selectors.mention)].map(
                (mention) => mention.textContent ?? "",
              )
            : [];
          const attachments = [
            ...node.querySelectorAll(selectors.attachment),
          ].map((attachment) => ({
            filename: attachment.getAttribute("download") ?? undefined,
            contentType: attachment
              .querySelector("img")
              ?.getAttribute("src")
              ?.includes(".gif")
              ? "image/gif"
              : "image/*",
            url: attachment.getAttribute("href") ?? undefined,
          }));
          return time && previousAuthor
            ? [
                {
                  source: "discord-web" as const,
                  messageId:
                    node.id.replace(/^chat-messages-/, "") || undefined,
                  author: previousAuthor,
                  mentions,
                  text,
                  timestamp: time,
                  collectedAt: new Date().toISOString(),
                  attachments,
                },
              ]
            : [];
        });
      }, discordSelectors);
      return messages
        .filter((message) => new Date(message.timestamp) >= cutoff)
        .map((message) => ({
          ...message,
          mentions: cleanMentions(message.mentions),
          guildId,
          channelId,
        }));
    } finally {
      await page.close();
    }
  }
  async readRecentChannel(
    url: string,
    cutoff: Date,
    limit = 20,
  ): Promise<CollectedMessage[]> {
    if (!this.context) throw new Error("Browser context is not started");
    const channelUrl = assertAllowedDiscordChannelUrl(url);
    const [, guildId, channelId] =
      channelUrl.pathname.match(/^\/channels\/(\d+)\/(\d+)$/) ?? [];
    if (!guildId || !channelId) throw new Error("Invalid Discord channel URL");
    const page = await this.context.newPage();
    try {
      await page.goto(channelUrl.toString(), {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      const messagesLocator = await this.waitForMessages(page);
      const messages = await messagesLocator.evaluateAll((nodes, selectors) => {
        let previousAuthor:
          { discordUserId?: string; displayName: string } | undefined;
        return nodes.flatMap((node) => {
          const time = node
            .querySelector(selectors.timestamp)
            ?.getAttribute("datetime");
          const authorNode = node.querySelector(selectors.author);
          const displayName = authorNode?.textContent?.trim();
          const discordUserId =
            authorNode?.getAttribute("data-user-id") ??
            node.getAttribute("data-message-author-id") ??
            undefined;
          if (displayName)
            previousAuthor = discordUserId
              ? { displayName, discordUserId }
              : { displayName };
          const content = node.querySelector(selectors.content);
          const mentions = content
            ? [...content.querySelectorAll(selectors.mention)].map(
                (mention) => mention.textContent ?? "",
              )
            : [];
          const attachments = [
            ...node.querySelectorAll(selectors.attachment),
          ].map((attachment) => ({
            filename: attachment.getAttribute("download") ?? undefined,
            contentType: attachment
              .querySelector("img")
              ?.getAttribute("src")
              ?.includes(".gif")
              ? "image/gif"
              : "image/*",
            url: attachment.getAttribute("href") ?? undefined,
          }));
          return time && previousAuthor
            ? [
                {
                  source: "discord-web" as const,
                  messageId:
                    node.id.replace(/^chat-messages-/, "") || undefined,
                  author: previousAuthor,
                  mentions,
                  text: content?.textContent?.trim() ?? "",
                  timestamp: time,
                  collectedAt: new Date().toISOString(),
                  attachments,
                },
              ]
            : [];
        });
      }, discordSelectors);
      return messages
        .filter((message) => new Date(message.timestamp) >= cutoff)
        .sort(
          (left, right) =>
            new Date(right.timestamp).getTime() -
            new Date(left.timestamp).getTime(),
        )
        .slice(0, limit)
        .map((message) => ({
          ...message,
          mentions: cleanMentions(message.mentions),
          guildId,
          channelId,
        }));
    } finally {
      await page.close();
    }
  }
}
