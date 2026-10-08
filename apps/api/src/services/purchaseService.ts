import { prisma } from '../db/prisma.js';
import { runInTransaction } from '../db/transaction.js';
import { AppError, Errors, uniqueViolation } from '../lib/errors.js';
import { pageArgs, toPage, type PageRequest } from '../lib/pagination.js';
import { requestHash } from '../lib/requestHash.js';
import { toPurchaseDTO } from '../lib/serializers.js';
import type { Purchase } from '../generated/prisma/client.js';
import { credit, debit, getBalance } from './walletService.js';

export interface PurchaseInput {
  userId: string;
  productId: string;
  /** Price the user saw. If the catalog price changed since, the purchase is rejected. */
  expectedPriceCoins?: number;
  idempotencyKey: string;
}

export interface PurchaseResult {
  purchase: Purchase;
  balance: number;
  replayed: boolean;
}

async function findReplay(userId: string, idempotencyKey: string, hash: string): Promise<PurchaseResult | null> {
  const purchase = await prisma.purchase.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
  });
  if (!purchase) return null;
  if (purchase.requestHash !== hash) throw Errors.idempotencyKeyReused();
  return { purchase, balance: await getBalance(userId), replayed: true };
}

/**
 * Spend Gold Coins on a product. Everything happens in one transaction:
 * purchase row + guarded wallet debit + ledger entry + inventory item.
 *
 * Races are settled by the database:
 *  - two purchases draining one wallet: the debit's row lock + `balance >= price` re-check;
 *  - the same product bought twice concurrently: unique (user_id, product_id) on inventory_items;
 *  - the same request retried concurrently: unique (user_id, idempotency_key) on purchases.
 */
export async function purchaseProduct(input: PurchaseInput): Promise<PurchaseResult> {
  const { userId, productId, expectedPriceCoins, idempotencyKey } = input;
  const hash = requestHash({ productId });

  const replay = await findReplay(userId, idempotencyKey, hash);
  if (replay) return replay;

  try {
    const result = await runInTransaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, active: true } });
      if (!product) throw new AppError(404, 'PRODUCT_UNAVAILABLE', 'This product is not available');

      if (expectedPriceCoins !== undefined && expectedPriceCoins !== product.priceCoins) {
        throw new AppError(409, 'PRICE_CHANGED', `The price of this item is now ${product.priceCoins} coins`, {
          priceCoins: product.priceCoins,
        });
      }

      // Friendly pre-check; the unique constraint below is what actually guarantees it.
      const owned = await tx.inventoryItem.findUnique({ where: { userId_productId: { userId, productId } } });
      if (owned) throw Errors.alreadyOwned();

      const purchase = await tx.purchase.create({
        data: {
          userId,
          productId,
          productName: product.name,
          productSku: product.sku,
          category: product.category,
          rarity: product.rarity,
          priceCoins: product.priceCoins,
          idempotencyKey,
          requestHash: hash,
        },
      });
      const { wallet } = await debit(tx, userId, product.priceCoins, {
        reason: 'PRODUCT_PURCHASE',
        purchaseId: purchase.id,
      });
      await tx.inventoryItem.create({ data: { userId, productId, purchaseId: purchase.id } });

      return { purchase, balance: wallet.balance };
    });
    return { ...result, replayed: false };
  } catch (err) {
    // A concurrent request with the same Idempotency-Key may have committed while this one ran
    // (surfacing here as a duplicate key, or as ALREADY_OWNED from the pre-check). Either way the
    // client is retrying the same operation, so it gets the original result.
    const concurrent = await findReplay(userId, idempotencyKey, hash);
    if (concurrent) return concurrent;
    if (uniqueViolation(err) === 'inventory_items_user_id_product_id_key') throw Errors.alreadyOwned();
    throw err;
  }
}

/** Admin refund: return the coins actually paid and revoke the item. Exactly once per purchase. */
export async function refundPurchase(purchaseId: string, actorId: string) {
  return runInTransaction(async (tx) => {
    const { count } = await tx.purchase.updateMany({
      where: { id: purchaseId, status: 'COMPLETED' },
      data: { status: 'REFUNDED', refundedAt: new Date(), refundedById: actorId },
    });
    if (count === 0) {
      const existing = await tx.purchase.findUnique({ where: { id: purchaseId }, select: { id: true } });
      if (!existing) throw Errors.notFound('Purchase');
      throw new AppError(409, 'ALREADY_REFUNDED', 'This purchase has already been refunded');
    }

    const purchase = await tx.purchase.findUniqueOrThrow({ where: { id: purchaseId } });
    const { wallet } = await credit(tx, purchase.userId, purchase.priceCoins, {
      reason: 'REFUND',
      purchaseId,
      actorId,
    });
    await tx.inventoryItem.deleteMany({ where: { purchaseId } });

    return { purchase, balance: wallet.balance };
  });
}

export async function listPurchases(userId: string, query: PageRequest) {
  const where = { userId };
  const [purchases, total] = await Promise.all([
    prisma.purchase.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
    prisma.purchase.count({ where }),
  ]);
  return toPage(purchases.map(toPurchaseDTO), total, query);
}

export function listInventory(userId: string) {
  return prisma.inventoryItem.findMany({
    where: { userId },
    orderBy: { acquiredAt: 'desc' },
    select: {
      id: true,
      acquiredAt: true,
      product: {
        select: { id: true, sku: true, name: true, description: true, category: true, rarity: true, imageUrl: true },
      },
    },
  });
}
