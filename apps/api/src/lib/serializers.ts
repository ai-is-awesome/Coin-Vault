import type { LedgerEntry, PaymentOrder, Prisma, Purchase } from '../generated/prisma/client.js';

export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

// DTOs: internal bookkeeping (idempotency keys, request hashes, other users' ids) never leaves the API.

export function toOrderDTO(order: PaymentOrder) {
  const { requestHash: _hash, idempotencyKey: _key, ...dto } = order;
  return dto;
}

export function toPurchaseDTO(purchase: Purchase) {
  const { requestHash: _hash, idempotencyKey: _key, ...dto } = purchase;
  return dto;
}

export function toLedgerEntryDTO(entry: LedgerEntry, description: string) {
  const { id, type, amount, balanceAfter, reason, note, createdAt } = entry;
  return { id, type, amount, balanceAfter, reason, note, description, createdAt };
}
