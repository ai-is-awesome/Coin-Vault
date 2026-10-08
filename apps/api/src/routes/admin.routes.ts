import { Router } from 'express';
import { z } from 'zod';
import { ProductCategory, PurchaseStatus, Rarity } from '../generated/prisma/enums.js';
import {
  IdParams,
  PaginationQuery,
  parseBody,
  parseParams,
  parseQuery,
  requireIdempotencyKey,
  requireUser,
  sendIdempotent,
} from '../lib/http.js';
import { toPurchaseDTO } from '../lib/serializers.js';
import { requireAdmin } from '../middleware/auth.js';
import {
  adjustBalance,
  createProduct,
  getStats,
  listAllProducts,
  listAllPurchases,
  listUsers,
  updateProduct,
} from '../services/adminService.js';
import { refundPurchase } from '../services/purchaseService.js';

// No defaults here: they belong to creation only. (With .partial(), Zod would still apply them and a
// PATCH of one field would silently reset the others.)
const ProductFields = z.object({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,40}$/, 'SKU must be 3-40 characters of A-Z, 0-9 and -'),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  category: z.enum(ProductCategory),
  rarity: z.enum(Rarity),
  priceCoins: z.number().int().positive().max(1_000_000),
  imageUrl: z
    .url({ protocol: /^https$/, error: 'Must be an https:// URL' })
    .max(500)
    .nullable(),
  active: z.boolean(),
});

const CreateProductBody = ProductFields.extend({
  description: ProductFields.shape.description.default(''),
  rarity: ProductFields.shape.rarity.default('COMMON'),
  imageUrl: ProductFields.shape.imageUrl.optional(),
  active: ProductFields.shape.active.default(true),
});

const UpdateProductBody = ProductFields.partial().refine(
  (v) => Object.keys(v).length > 0,
  'Provide at least one field',
);

const AdminProductsQuery = PaginationQuery.extend({ includeInactive: z.stringbool().default(true) });
const UsersQuery = PaginationQuery.extend({ search: z.string().trim().max(100).optional() });
const PurchasesQuery = PaginationQuery.extend({ status: z.enum(PurchaseStatus).optional() });
const AdjustBody = z.object({
  amount: z
    .number()
    .int()
    .refine((n) => n !== 0, 'Amount must not be zero')
    .refine((n) => Math.abs(n) <= 1_000_000, 'Amount is too large'),
  note: z.string().trim().min(3, 'A note explaining the adjustment is required').max(500),
});

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get('/stats', async (_req, res) => {
  res.json(await getStats());
});

// ---- Catalog management ----

adminRouter.get('/products', async (req, res) => {
  res.json(await listAllProducts(parseQuery(AdminProductsQuery, req)));
});

adminRouter.post('/products', async (req, res) => {
  res.status(201).json({ product: await createProduct(parseBody(CreateProductBody, req)) });
});

adminRouter.patch('/products/:id', async (req, res) => {
  const { id } = parseParams(IdParams, req);
  res.json({ product: await updateProduct(id, parseBody(UpdateProductBody, req)) });
});

/** Soft delete: the product leaves the catalog but purchases and inventory keep referencing it. */
adminRouter.delete('/products/:id', async (req, res) => {
  const { id } = parseParams(IdParams, req);
  res.json({ product: await updateProduct(id, { active: false }) });
});

// ---- Players & balances ----

adminRouter.get('/users', async (req, res) => {
  res.json(await listUsers(parseQuery(UsersQuery, req)));
});

adminRouter.post('/users/:id/adjust', async (req, res) => {
  const admin = requireUser(req);
  const idempotencyKey = requireIdempotencyKey(req);
  const { id } = parseParams(IdParams, req);
  const { amount, note } = parseBody(AdjustBody, req);
  const { entry, balance, replayed } = await adjustBalance({
    userId: id,
    amount,
    note,
    actorId: admin.id,
    idempotencyKey,
  });
  const { idempotencyKey: _key, ...entryDTO } = entry;
  sendIdempotent(res, replayed, { entry: entryDTO, balance });
});

// ---- Purchases & refunds ----

adminRouter.get('/purchases', async (req, res) => {
  res.json(await listAllPurchases(parseQuery(PurchasesQuery, req)));
});

adminRouter.post('/purchases/:id/refund', async (req, res) => {
  const admin = requireUser(req);
  const { id } = parseParams(IdParams, req);
  const { purchase, balance } = await refundPurchase(id, admin.id);
  res.json({ purchase: toPurchaseDTO(purchase), balance });
});
