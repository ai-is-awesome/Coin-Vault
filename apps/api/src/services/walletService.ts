import { prisma } from '../db/prisma.js';
import type { Tx } from '../db/transaction.js';
import type { LedgerReason, LedgerType } from '../generated/prisma/enums.js';
import { AppError, Errors, isRecordNotFound } from '../lib/errors.js';
import { pageArgs, toPage, type PageRequest } from '../lib/pagination.js';
import { toLedgerEntryDTO } from '../lib/serializers.js';

/**
 * The ONLY code path that changes a wallet balance. Every movement is one atomic UPDATE of the
 * wallet row plus one append-only ledger entry, executed inside the caller's transaction.
 */
export interface Movement {
  reason: LedgerReason;
  paymentOrderId?: string;
  purchaseId?: string;
  actorId?: string;
  note?: string;
  idempotencyKey?: string;
}

function assertPositiveInteger(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be a positive whole number of coins');
  }
}

export async function credit(tx: Tx, userId: string, amount: number, movement: Movement) {
  assertPositiveInteger(amount);
  try {
    const wallet = await tx.wallet.update({
      where: { userId },
      data: { balance: { increment: amount } },
    });
    const entry = await tx.ledgerEntry.create({
      data: { walletId: wallet.id, userId, type: 'CREDIT', amount, balanceAfter: wallet.balance, ...movement },
    });
    return { wallet, entry };
  } catch (err) {
    if (isRecordNotFound(err)) throw Errors.notFound('Wallet');
    throw err;
  }
}

export async function debit(tx: Tx, userId: string, amount: number, movement: Movement) {
  assertPositiveInteger(amount);
  let wallet;
  try {
    // UPDATE wallets SET balance = balance - $amount WHERE user_id = $user AND balance >= $amount
    // The row lock + re-checked WHERE make check-and-decrement atomic: concurrent debits queue up
    // and each sees the latest balance, so the balance can never go negative.
    wallet = await tx.wallet.update({
      where: { userId, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
  } catch (err) {
    if (!isRecordNotFound(err)) throw err;
    const current = await tx.wallet.findUnique({ where: { userId }, select: { balance: true } });
    if (!current) throw Errors.notFound('Wallet');
    throw Errors.insufficientFunds(amount, current.balance);
  }
  const entry = await tx.ledgerEntry.create({
    data: { walletId: wallet.id, userId, type: 'DEBIT', amount, balanceAfter: wallet.balance, ...movement },
  });
  return { wallet, entry };
}

export async function getWallet(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw Errors.notFound('Wallet');
  return wallet;
}

export async function getBalance(userId: string): Promise<number> {
  return (await getWallet(userId)).balance;
}

/** The user's ledger, newest first, with a human-readable description of each movement. */
export async function listTransactions(
  userId: string,
  query: PageRequest & { type?: LedgerType; reason?: LedgerReason },
) {
  const where = { userId, type: query.type, reason: query.reason };
  const [entries, total] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query),
      include: {
        paymentOrder: { select: { packageName: true } },
        purchase: { select: { productName: true } },
      },
    }),
    prisma.ledgerEntry.count({ where }),
  ]);
  const items = entries.map(({ paymentOrder, purchase, ...entry }) =>
    toLedgerEntryDTO(entry, describe(entry.reason, entry.note, paymentOrder?.packageName, purchase?.productName)),
  );
  return toPage(items, total, query);
}

function describe(reason: LedgerReason, note: string | null, packageName?: string, productName?: string) {
  switch (reason) {
    case 'COIN_PURCHASE':
      return `Bought ${packageName ?? 'coin package'}`;
    case 'PRODUCT_PURCHASE':
      return `Purchased ${productName ?? 'item'}`;
    case 'REFUND':
      return `Refund for ${productName ?? 'item'}`;
    case 'ADMIN_ADJUSTMENT':
      return note ? `Adjustment: ${note}` : 'Balance adjustment';
  }
}
