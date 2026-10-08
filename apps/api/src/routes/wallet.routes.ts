import { Router } from 'express';
import { z } from 'zod';
import { LedgerReason, LedgerType } from '../generated/prisma/enums.js';
import { PaginationQuery, parseQuery, requireUser } from '../lib/http.js';
import { getWallet, listTransactions } from '../services/walletService.js';

const TransactionsQuery = PaginationQuery.extend({
  type: z.enum(LedgerType).optional(),
  reason: z.enum(LedgerReason).optional(),
});

export const walletRouter = Router();

walletRouter.get('/', async (req, res) => {
  const { balance, updatedAt } = await getWallet(requireUser(req).id);
  res.json({ balance, updatedAt });
});

walletRouter.get('/transactions', async (req, res) => {
  res.json(await listTransactions(requireUser(req).id, parseQuery(TransactionsQuery, req)));
});
