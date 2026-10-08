import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import {
  PaginationQuery,
  parseBody,
  parseQuery,
  requireIdempotencyKey,
  requireUser,
  sendIdempotent,
} from '../lib/http.js';
import { toOrderDTO } from '../lib/serializers.js';
import { listActivePackages, listOrders, purchaseCoins } from '../services/coinPurchaseService.js';

const CoinPurchaseBody = z.object({
  packageId: z.uuid('Must be a valid package id'),
  // Opaque token from the (mock) card tokenizer in the browser - never a raw card number.
  paymentToken: z.string().regex(/^tok_[A-Za-z0-9_]{1,64}$/, 'Must be a payment token (tok_...)'),
});

export const coinPackagesRouter = Router();

coinPackagesRouter.get('/', async (_req, res) => {
  res.json({ items: await listActivePackages() });
});

export const coinPurchasesRouter = Router();

coinPurchasesRouter.post('/', async (req, res) => {
  const user = requireUser(req);
  const idempotencyKey = requireIdempotencyKey(req);
  const body = parseBody(CoinPurchaseBody, req);

  const { order, balance, replayed } = await purchaseCoins({ userId: user.id, ...body, idempotencyKey });

  if (order.status === 'FAILED') {
    if (replayed) res.setHeader('Idempotent-Replayed', 'true');
    throw new AppError(402, 'PAYMENT_DECLINED', order.failureMessage ?? 'The payment was declined', {
      order: toOrderDTO(order),
      declineCode: order.failureCode,
      balance,
    });
  }
  sendIdempotent(res, replayed, { order: toOrderDTO(order), balance });
});

coinPurchasesRouter.get('/', async (req, res) => {
  res.json(await listOrders(requireUser(req).id, parseQuery(PaginationQuery, req)));
});
