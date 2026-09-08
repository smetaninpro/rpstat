import { parseTrainingMessage } from './training-parser';

describe('parseTrainingMessage', () => {
  it('checks negative result before positive text', () => { expect(parseTrainingMessage('Сдать теоретический экзамен: не сдал').result).toBe('FAILED'); });
  it('treats non-exam checklist lines as lectures', () => { expect(parseTrainingMessage('Пройти экскурсию с инструктором: ✅\nПрослушать вступительную лекцию: ✅\nПрактика по процессуальным действиям: ✅').items).toEqual([{ type: 'LECTURE', description: 'Пройти экскурсию с инструктором', status: 'COMPLETED' }, { type: 'LECTURE', description: 'Прослушать вступительную лекцию', status: 'COMPLETED' }, { type: 'LECTURE', description: 'Практика по процессуальным действиям', status: 'COMPLETED' }]); });
});
