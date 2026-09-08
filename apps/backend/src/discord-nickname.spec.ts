import { parseDiscordNickname } from './discord-nickname';

describe('parseDiscordNickname', () => {
  it('normalizes whitespace and separates position, department, and game name', () => {
    expect(parseDiscordNickname('  Стажер   " А "  |   Василий    Калугин  ')).toEqual({ positionRaw: 'Стажер', departmentRaw: 'A', gameName: 'Василий Калугин' });
  });

  it('rejects a display name that is not an organization nickname', () => {
    expect(parseDiscordNickname('Василий Калугин')).toBeNull();
  });
  it('parses unquoted department and nickname without department', () => {
    expect(parseDiscordNickname("Опер ''К'' | Алексей Граф")).toEqual({ positionRaw: 'Опер', departmentRaw: 'K', gameName: 'Алексей Граф' });
    expect(parseDiscordNickname('Опер "К | Марк Меньшиков')).toEqual({ positionRaw: 'Опер', departmentRaw: 'K', gameName: 'Марк Меньшиков' });
    expect(parseDiscordNickname('КР | Алексей Капустин')).toEqual({ positionRaw: 'Без должности', departmentRaw: 'КР', gameName: 'Алексей Капустин' });
    expect(parseDiscordNickname('Зам.Нач. АПС | Егор Барбатунов')).toEqual({ positionRaw: 'Зам.Нач.', departmentRaw: 'АПС', gameName: 'Егор Барбатунов' });
    expect(parseDiscordNickname('Нач. Кадров | Никита Портнов')).toEqual({ positionRaw: 'Нач. Кадров', departmentRaw: '0', gameName: 'Никита Портнов' });
    expect(parseDiscordNickname('A | Яромир Юдин')).toEqual({ positionRaw: 'Без должности', departmentRaw: 'A', gameName: 'Яромир Юдин' });
  });
});
