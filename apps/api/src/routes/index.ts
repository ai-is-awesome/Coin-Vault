import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { loadUser } from '../middleware/auth.js';
import type { RateLimiters } from '../middleware/rateLimit.js';
import { adminRouter } from './admin.routes.js';
import { createAuthRouter } from './auth.routes.js';
import { catalogRouter } from './catalog.routes.js';
import { coinPackagesRouter, coinPurchasesRouter } from './coins.routes.js';
import { inventoryRouter, purchasesRouter } from './purchases.routes.js';
import { walletRouter } from './wallet.routes.js';

export function createApiRouter({ limiters }: { limiters: RateLimiters }) {
  const api = Router();

  api.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  api.use(loadUser);

  // Rate limiters on the money-moving and admin routes only apply to writes (see middleware/rateLimit.ts).
  api.use('/auth', createAuthRouter(limiters.auth));
  api.use('/wallet', walletRouter);
  api.use('/coin-packages', coinPackagesRouter);
  api.use('/coin-purchases', limiters.coinPurchases, coinPurchasesRouter);
  api.use('/products', catalogRouter);
  api.use('/purchases', limiters.purchases, purchasesRouter);
  api.use('/inventory', inventoryRouter);
  api.use('/admin', limiters.adminWrites, adminRouter);

  return api;
}
