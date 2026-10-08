import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';

/**
 * Payment provider abstraction. The browser "tokenizes" the card (as Stripe Elements would), so
 * the API never sees a card number - only an opaque token.
 */
export interface ChargeRequest {
  /** Provider-side idempotency key. We use the payment order id, so retries never double-charge. */
  idempotencyKey: string;
  amountCents: number;
  currency: string;
  paymentToken: string;
}

interface CardInfo {
  providerRef: string;
  cardBrand: string;
  cardLast4: string;
}

export type ChargeResult =
  | ({ status: 'succeeded' } & CardInfo)
  | ({ status: 'declined'; declineCode: string; declineMessage: string } & CardInfo);

export interface PaymentProvider {
  readonly name: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

interface TestCard {
  brand: string;
  last4: string;
  decline?: { code: string; message: string };
}

/** Test tokens, modelled on Stripe's test cards. */
export const TEST_PAYMENT_TOKENS: Record<string, TestCard> = {
  tok_visa: { brand: 'visa', last4: '4242' },
  tok_mastercard: { brand: 'mastercard', last4: '4444' },
  tok_chargeDeclined: {
    brand: 'visa',
    last4: '0002',
    decline: { code: 'card_declined', message: 'Your card was declined.' },
  },
  tok_insufficientFunds: {
    brand: 'visa',
    last4: '9995',
    decline: { code: 'insufficient_funds', message: 'Your card has insufficient funds.' },
  },
  tok_expiredCard: {
    brand: 'visa',
    last4: '0069',
    decline: { code: 'expired_card', message: 'Your card has expired.' },
  },
};

const MAX_REMEMBERED_CHARGES = 10_000;

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  private readonly charges = new Map<string, Promise<ChargeResult>>();

  constructor(private readonly latencyMs: number) {}

  charge(request: ChargeRequest): Promise<ChargeResult> {
    // Idempotent like a real provider: the same key returns the original result (even while in flight).
    const existing = this.charges.get(request.idempotencyKey);
    if (existing) return existing;

    const result = this.process(request);
    this.charges.set(request.idempotencyKey, result);
    if (this.charges.size > MAX_REMEMBERED_CHARGES) {
      this.charges.delete(this.charges.keys().next().value!);
    }
    return result;
  }

  private async process(request: ChargeRequest): Promise<ChargeResult> {
    if (this.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, this.latencyMs));

    const providerRef = `mock_ch_${randomUUID()}`;
    const card = TEST_PAYMENT_TOKENS[request.paymentToken];
    if (!card) {
      return {
        status: 'declined',
        providerRef,
        cardBrand: 'unknown',
        cardLast4: '0000',
        declineCode: 'invalid_payment_method',
        declineMessage: 'The payment method could not be verified.',
      };
    }
    const info = { providerRef, cardBrand: card.brand, cardLast4: card.last4 };
    return card.decline
      ? { status: 'declined', ...info, declineCode: card.decline.code, declineMessage: card.decline.message }
      : { status: 'succeeded', ...info };
  }
}

export const paymentProvider: PaymentProvider = new MockPaymentProvider(env.MOCK_PAYMENT_LATENCY_MS);
