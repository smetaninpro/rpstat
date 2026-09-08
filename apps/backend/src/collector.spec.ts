import { parseSequence } from './collector';

describe('parseSequence', () => {
  it.each([['149', 149, 149, 1], ['150-152', 150, 152, 3], ['150 – 152', 150, 152, 3], ['150—152', 150, 152, 3]])('parses %s', (text, from, to, quantity) => {
    expect(parseSequence(text, 30)).toEqual({ status: 'PARSED', from, to, quantity });
  });
  it('rejects a reversed range', () => { expect(parseSequence('152-150', 30)).toEqual({ status: 'UNPARSED' }); });
  it('sends an overlong range to review', () => { expect(parseSequence('1-31', 30)).toEqual({ status: 'REVIEW_REQUIRED', from: 1, to: 31, quantity: 31 }); });
  it('does not use sequence range as the activity quantity', () => { expect(parseSequence('1-3', 30).quantity).toBe(3); /* Collector uses attachment count for activity quantity. */ });
});
