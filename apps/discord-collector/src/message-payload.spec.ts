import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanMentions } from './message-payload.js';

test('normalizes mention names without the @ prefix', () => {
  assert.deepEqual(cleanMentions(['@Стажер "О" | Илья Ювелирный', '@А | Матвей Банхаммер']), [{ displayName: 'Стажер "О" | Илья Ювелирный' }, { displayName: 'А | Матвей Банхаммер' }]);
});
test('removes empty, duplicate, and oversized mention values', () => {
  assert.deepEqual(cleanMentions(['', '@Иван', 'иван', 'x'.repeat(257)]), [{ displayName: 'Иван' }]);
});
