import { Router } from 'express';
import { z } from 'zod';
import {
  PaginationQuery,
  parseBody,
  parseQuery,
  requireIdempotencyKey,
  requireUser,
  sendIdempotent,
} from '../lib/http.js';
import { toPurchaseDTO } from '../lib/serializers.js';
import { listInventory, listPurchases, purchaseProduct } from '../services/purchaseService.js';

const PurchaseBody = z.object({
  productId: z.uuid('Must be a valid product id'),
  expectedPriceCoins: z.number().int().positive().optional(),
});

export const purchasesRouter = Router();

purchasesRouter.post('/', async (req, res) => {
  const user = requireUser(req);
  const idempotencyKey = requireIdempotencyKey(req);
  const body = parseBody(PurchaseBody, req);
  const { purchase, balance, replayed } = await purchaseProduct({ userId: user.id, ...body, idempotencyKey });
  sendIdempotent(res, replayed, { purchase: toPurchaseDTO(purchase), balance });
});

purchasesRouter.get('/', async (req, res) => {
  res.json(await listPurchases(requireUser(req).id, parseQuery(PaginationQuery, req)));
});

export const inventoryRouter = Router();

inventoryRouter.get('/', async (req, res) => {
  res.json({ items: await listInventory(requireUser(req).id) });
});
