export type DiscordNickname = {
  positionRaw: string;
  departmentRaw?: string;
  gameName: string;
};

const spaces = (value: string) => value.replace(/\s+/g, ' ').trim();
const departmentCode = (value: string) => { const code = spaces(value).toUpperCase(); return ({ А: 'A', К: 'K', М: 'M', О: 'O' } as Record<string, string>)[code] ?? code; };

/** Parses the organization nickname without treating the display name as an identity key. */
export function parseDiscordNickname(value: string): DiscordNickname | null {
  const normalized = value.replace(/''/g, '"');
  const quoted = /^\s*(.+?)\s*"\s*([^"\s]+)\s*"\s*\|\s*(.+?)\s*$/.exec(normalized);
  if (quoted) { const positionRaw = spaces(quoted[1]); const departmentRaw = departmentCode(quoted[2]); const gameName = spaces(quoted[3]); return positionRaw && departmentRaw && gameName ? { positionRaw, departmentRaw, gameName } : null; }
  const unclosedQuote = /^\s*(.+?)\s*"\s*([^"\s]+)\s*\|\s*(.+?)\s*$/.exec(normalized);
  if (unclosedQuote) { const positionRaw = spaces(unclosedQuote[1]); const departmentRaw = departmentCode(unclosedQuote[2]); const gameName = spaces(unclosedQuote[3]); return positionRaw && departmentRaw && gameName ? { positionRaw, departmentRaw, gameName } : null; }
  const plain = /^\s*(.+?)\s*\|\s*(.+?)\s*$/.exec(normalized);
  if (!plain) return null;
  const left = spaces(plain[1]); const gameName = spaces(plain[2]);
  // Unquoted names use either a trailing department code or a department-only prefix.
  if (/^(КР|АПС|[А-ЯA-Z])$/u.test(left)) return { positionRaw: 'Без должности', departmentRaw: departmentCode(left), gameName };
  if (/^Нач\.\s*Кадров$/iu.test(left)) return { positionRaw: 'Нач. Кадров', departmentRaw: '0', gameName };
  const withDepartment = /^(.*?)\s+(АПС|[А-ЯA-Z])$/u.exec(left);
  const positionRaw = spaces(withDepartment?.[1] ?? left); const departmentRaw = withDepartment ? departmentCode(withDepartment[2]) : undefined;
  return positionRaw && gameName ? { positionRaw, departmentRaw, gameName } : null;
}
