import { prisma } from '../db/prisma.js';
import { runInTransaction } from '../db/transaction.js';
import { AppError, Errors, uniqueViolation } from '../lib/errors.js';
import { pageArgs, toPage, type PageRequest } from '../lib/pagination.js';
import { requestHash } from '../lib/requestHash.js';
import { toOrderDTO } from '../lib/serializers.js';
import type { PaymentOrder } from '../generated/prisma/client.js';
import { paymentProvider } from './payment/mockProvider.js';
import { credit, getBalance } from './walletService.js';

export interface CoinPurchaseInput {
  userId: string;
  packageId: string;
  paymentToken: string;
  idempotencyKey: string;
}

export interface CoinPurchaseResult {
  order: PaymentOrder;
  balance: number;
  /** True when this request repeated an Idempotency-Key whose order had already completed. */
  replayed: boolean;
}

/**
 * Buy a coin package with (mock) real money.
 *
 * 1. Create a PENDING order (or find the existing one for this Idempotency-Key).
 * 2. Charge the provider OUTSIDE any DB transaction, keyed by order id so retries never double-charge.
 * 3. Finalize in one transaction: PENDING -> SUCCEEDED (conditional) + wallet credit + ledger entry.
 *
 * If the process dies between 2 and 3, the order stays PENDING; retrying with the same
 * Idempotency-Key re-runs 2 (provider returns the original result) and 3 (exactly once).
 */
export async function purchaseCoins(input: CoinPurchaseInput): Promise<CoinPurchaseResult> {
  const { userId, packageId, paymentToken, idempotencyKey } = input;
  const hash = requestHash({ packageId });

  let order = await prisma.paymentOrder.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
  });

  if (order) {
    if (order.requestHash !== hash) throw Errors.idempotencyKeyReused();
    if (order.status !== 'PENDING') return { order, balance: await getBalance(userId), replayed: true };
  } else {
    const pkg = await prisma.coinPackage.findFirst({ where: { id: packageId, active: true } });
    if (!pkg) throw new AppError(404, 'PACKAGE_UNAVAILABLE', 'This coin package is not available');
    try {
      order = await prisma.paymentOrder.create({
        data: {
          userId,
          packageId: pkg.id,
          packageName: pkg.name,
          coins: pkg.coins + pkg.bonusCoins,
          amountCents: pkg.priceCents,
          currency: pkg.currency,
          provider: paymentProvider.name,
          idempotencyKey,
          requestHash: hash,
        },
      });
    } catch (err) {
      // A concurrent request with the same key created the order first: continue as that request.
      if (uniqueViolation(err) === 'payment_orders_user_id_idempotency_key_key') return purchaseCoins(input);
      throw err;
    }
  }

  const charge = await paymentProvider.charge({
    idempotencyKey: order.id,
    amountCents: order.amountCents,
    currency: order.currency,
    paymentToken,
  });
  const card = { providerRef: charge.providerRef, cardBrand: charge.cardBrand, cardLast4: charge.cardLast4 };
  const orderId = order.id;
  const coins = order.coins;

  if (charge.status === 'declined') {
    await prisma.paymentOrder.updateMany({
      where: { id: orderId, status: 'PENDING' },
      data: {
        status: 'FAILED',
        ...card,
        failureCode: charge.declineCode,
        failureMessage: charge.declineMessage,
        completedAt: new Date(),
      },
    });
  } else {
    await runInTransaction(async (tx) => {
      // Conditional transition: only one request can move this order out of PENDING.
      const { count } = await tx.paymentOrder.updateMany({
        where: { id: orderId, status: 'PENDING' },
        data: { status: 'SUCCEEDED', ...card, completedAt: new Date() },
      });
      if (count === 0) return; // already finalized by a concurrent retry
      await credit(tx, userId, coins, { reason: 'COIN_PURCHASE', paymentOrderId: orderId });
    });
  }

  const finalOrder = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: orderId } });
  return { order: finalOrder, balance: await getBalance(userId), replayed: false };
}

export function listActivePackages() {
  return prisma.coinPackage.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
  });
}

/** The user's coin orders, including failed ones. */
export async function listOrders(userId: string, query: PageRequest) {
  const where = { userId };
  const [orders, total] = await Promise.all([
    prisma.paymentOrder.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(query) }),
    prisma.paymentOrder.count({ where }),
  ]);
  return toPage(orders.map(toOrderDTO), total, query);
}
