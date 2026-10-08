import { createHash } from 'node:crypto';

/** Fingerprint of the business-relevant request payload, stored next to an idempotency key. */
export function requestHash(payload: Record<string, string | number | undefined>): string {
  const canonical = JSON.stringify(
    Object.keys(payload)
      .sort()
      .map((key) => [key, payload[key] ?? null]),
  );
  return createHash('sha256').update(canonical).digest('hex');
}
