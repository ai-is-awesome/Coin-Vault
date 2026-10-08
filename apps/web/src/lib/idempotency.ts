/**
 * A fresh key per purchase *attempt*. Retrying the same attempt (double click, network retry)
 * reuses the key, so the API processes it at most once.
 */
export function newIdempotencyKey(): string {
  // crypto.randomUUID only exists in secure contexts (https or localhost).
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
