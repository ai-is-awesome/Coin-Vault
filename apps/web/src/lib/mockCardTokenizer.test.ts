import { describe, expect, it } from 'vitest';
import { formatCardNumber, formatExpiry, tokenizeCard, validateCard } from './mockCardTokenizer';

const NOW = new Date(2026, 9, 8); // Oct 8, 2026
const valid = { number: '4242 4242 4242 4242', expiry: '12/34', cvc: '123' };

describe('validateCard', () => {
  it('accepts a valid card', () => {
    expect(validateCard(valid, NOW)).toEqual({});
  });

  it('rejects numbers that fail the Luhn check or have the wrong length', () => {
    expect(validateCard({ ...valid, number: '4242 4242 4242 4241' }, NOW).number).toBeDefined();
    expect(validateCard({ ...valid, number: '4242' }, NOW).number).toBeDefined();
  });

  it('rejects malformed and expired expiry dates, but accepts the current month', () => {
    expect(validateCard({ ...valid, expiry: '1234' }, NOW).expiry).toBe('Use MM/YY');
    expect(validateCard({ ...valid, expiry: '13/30' }, NOW).expiry).toBe('Invalid month');
    expect(validateCard({ ...valid, expiry: '09/26' }, NOW).expiry).toBe('Card has expired');
    expect(validateCard({ ...valid, expiry: '10/26' }, NOW).expiry).toBeUndefined();
  });

  it('requires a 3-4 digit CVC', () => {
    expect(validateCard({ ...valid, cvc: '12' }, NOW).cvc).toBeDefined();
    expect(validateCard({ ...valid, cvc: '1234' }, NOW).cvc).toBeUndefined();
  });
});

describe('tokenizeCard', () => {
  it('maps test cards to provider tokens and never returns card digits', () => {
    expect(tokenizeCard(valid)).toBe('tok_visa');
    expect(tokenizeCard({ ...valid, number: '4000000000000002' })).toBe('tok_chargeDeclined');
    expect(tokenizeCard({ ...valid, number: '4000 0000 0000 9995' })).toBe('tok_insufficientFunds');
    expect(tokenizeCard({ ...valid, number: '4111 1111 1111 1111' })).toBe('tok_visa');
  });
});

describe('input formatting', () => {
  it('groups card digits and formats expiry as typed', () => {
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
    expect(formatCardNumber('42a42')).toBe('4242');
    expect(formatExpiry('1234')).toBe('12/34');
    expect(formatExpiry('1')).toBe('1');
  });
});
