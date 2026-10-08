/**
 * Stand-in for a payment provider's card element (e.g. Stripe Elements): card details are
 * validated and exchanged for an opaque token in the browser, so they never reach our API.
 */
export const TEST_CARDS = [
  { number: '4242 4242 4242 4242', label: 'Visa - succeeds', token: 'tok_visa' },
  { number: '5555 5555 5555 4444', label: 'Mastercard - succeeds', token: 'tok_mastercard' },
  { number: '4000 0000 0000 0002', label: 'Declined', token: 'tok_chargeDeclined' },
  { number: '4000 0000 0000 9995', label: 'Insufficient funds', token: 'tok_insufficientFunds' },
  { number: '4000 0000 0000 0069', label: 'Expired card', token: 'tok_expiredCard' },
] as const;

export interface CardInput {
  number: string;
  expiry: string;
  cvc: string;
}

export type CardErrors = Partial<Record<keyof CardInput, string>>;

const digits = (value: string) => value.replace(/\D/g, '');

function passesLuhn(number: string): boolean {
  let sum = 0;
  for (let i = 0; i < number.length; i++) {
    let digit = Number(number[number.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function validateCard(card: CardInput, now = new Date()): CardErrors {
  const errors: CardErrors = {};
  const number = digits(card.number);
  if (number.length < 13 || number.length > 19 || !passesLuhn(number)) errors.number = 'Enter a valid card number';

  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(card.expiry.trim());
  if (!match) {
    errors.expiry = 'Use MM/YY';
  } else {
    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);
    const endOfMonth = new Date(year, month, 1);
    if (month < 1 || month > 12) errors.expiry = 'Invalid month';
    else if (endOfMonth <= now) errors.expiry = 'Card has expired';
  }

  if (!/^\d{3,4}$/.test(card.cvc.trim())) errors.cvc = '3-4 digits';
  return errors;
}

/** Returns the provider token for a validated card. Unknown valid cards behave like a Visa. */
export function tokenizeCard(card: CardInput): string {
  const number = digits(card.number);
  return TEST_CARDS.find((c) => digits(c.number) === number)?.token ?? 'tok_visa';
}

export function formatCardNumber(value: string): string {
  return digits(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function formatExpiry(value: string): string {
  const d = digits(value).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}
