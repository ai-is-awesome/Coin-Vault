import { prisma } from '../db/prisma.js';
import { runInTransaction } from '../db/transaction.js';
import type { LedgerEntry, Prisma } from '../generated/prisma/client.js';
import type { PurchaseStatus } from '../generated/prisma/enums.js';
import { AppError, Errors, uniqueViolation } from '../lib/errors.js';
import { pageArgs, toPage, type PageRequest } from '../lib/pagination.js';
import { toPurchaseDTO } from '../lib/serializers.js';
import { credit, debit, getBalance } from './walletService.js';

export async function getStats() {
  const [users, wallets, sales, purchases, refunds] = await Promise.all([
    prisma.user.count(),
    prisma.wallet.aggregate({ _sum: { balance: true } }),
    prisma.paymentOrder.aggregate({ where: { status: 'SUCCEEDED' }, _sum: { amountCents: true, coins: true } }),
    prisma.purchase.aggregate({ where: { status: 'COMPLETED' }, _count: true, _sum: { priceCoins: true } }),
    prisma.purchase.count({ where: { status: 'REFUNDED' } }),
  ]);
  return {
    users,
    coinsInCirculation: wallets._sum.balance ?? 0,
    coinsSold: sales._sum.coins ?? 0,
    revenueCents: sales._sum.amountCents ?? 0,
    purchases: purchases._count,
    coinsSpent: purchases._sum.priceCoins ?? 0,
    refunds,
  };
}

// ---------- Catalog management ----------

function rethrowSkuTaken(err: unknown): never {
  if (uniqueViolation(err) === 'products_sku_key') {
    throw new AppError(409, 'SKU_TAKEN', 'A product with this SKU already exists');
  }
  throw err;
}

export async function listAllProducts(query: PageRequest & { includeInactive: boolean }) {
  const where = query.includeInactive ? {} : { active: true };
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: [{ category: 'asc' }, { priceCoins: 'asc' }], ...pageArgs(query) }),
    prisma.product.count({ where }),
  ]);
  return toPage(items, total, query);
}

export function createProduct(data: Prisma.ProductCreateInput) {
  return prisma.product.create({ data }).catch(rethrowSkuTaken);
}

/** Partial update: only the provided fields change. */
export function updateProduct(id: string, data: Prisma.ProductUpdateInput) {
  return prisma.product.update({ where: { id }, data }).catch(rethrowSkuTaken);
}

// ---------- Players & balances ----------

export async function listUsers(query: PageRequest & { search?: string }) {
  const where: Prisma.UserWhereInput = query.search
    ? {
        OR: [
          { email: { contains: query.search, mode: 'insensitive' } },
          { name: { contains: query.search, mode: 'insensitive' } },
        ],
      }
    : {};
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...pageArgs(query),
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        wallet: { select: { balance: true } },
        _count: { select: { inventoryItems: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  const items = users.map(({ wallet, _count, ...user }) => ({
    ...user,
    balance: wallet?.balance ?? 0,
    itemsOwned: _count.inventoryItems,
  }));
  return toPage(items, total, query);
}

export interface AdjustmentInput {
  userId: string;
  /** Positive to credit, negative to debit. */
  amount: number;
  note: string;
  actorId: string;
  idempotencyKey: string;
}

const signedAmount = (entry: LedgerEntry) => (entry.type === 'CREDIT' ? entry.amount : -entry.amount);

async function findAdjustmentReplay(input: AdjustmentInput) {
  const entry = await prisma.ledgerEntry.findUnique({
    where: { actorId_idempotencyKey: { actorId: input.actorId, idempotencyKey: input.idempotencyKey } },
  });
  if (!entry) return null;
  if (entry.userId !== input.userId || signedAmount(entry) !== input.amount) throw Errors.idempotencyKeyReused();
  return { entry, balance: await getBalance(input.userId), replayed: true };
}

/**
 * Admin balance correction, recorded in the ledger with the admin and a reason. Negative amounts use
 * the same guarded debit as purchases, so a balance can't go below zero. Idempotent per admin + key.
 */
export async function adjustBalance(input: AdjustmentInput) {
  const { userId, amount, note, actorId, idempotencyKey } = input;
  if (!Number.isSafeInteger(amount) || amount === 0) {
    throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be a non-zero whole number of coins');
  }
  if (!(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    throw Errors.notFound('User');
  }

  const replay = await findAdjustmentReplay(input);
  if (replay) return replay;

  try {
    return await runInTransaction(async (tx) => {
      const movement = { reason: 'ADMIN_ADJUSTMENT' as const, actorId, note, idempotencyKey };
      const { wallet, entry } =
        amount > 0 ? await credit(tx, userId, amount, movement) : await debit(tx, userId, -amount, movement);
      return { entry, balance: wallet.balance, replayed: false };
    });
  } catch (err) {
    if (uniqueViolation(err) === 'ledger_entries_actor_id_idempotency_key_key') {
      const concurrent = await findAdjustmentReplay(input);
      if (concurrent) return concurrent;
    }
    throw err;
  }
}

// ---------- Purchases ----------

export async function listAllPurchases(query: PageRequest & { status?: PurchaseStatus }) {
  const where = { status: query.status };
  const [purchases, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...pageArgs(query),
      include: { user: { select: { id: true, email: true, name: true } } },
    }),
    prisma.purchase.count({ where }),
  ]);
  const items = purchases.map(({ user, ...purchase }) => ({ ...toPurchaseDTO(purchase), user }));
  return toPage(items, total, query);
}
