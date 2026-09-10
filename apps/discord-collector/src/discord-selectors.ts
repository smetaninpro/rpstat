// Centralize Discord DOM coupling here so changes can be audited and repaired quickly.
export const discordSelectors = {
  message:
    '[data-list-item-id^="chat-messages"], li[id^="chat-messages"], [id^="chat-messages-"]',
  timestamp: "time[datetime]",
  author: '[class*="username"], [data-user-id], [data-message-author-id]',
  content:
    '[id^="message-content-"], [class*="markup"], [data-slate-editor="true"]',
  attachment:
    'a[href*="cdn.discordapp.com/attachments"], a[href*="media.discordapp.net/attachments"]',
  mention: '[data-user-id], [class*="mention"]',
} as const;
