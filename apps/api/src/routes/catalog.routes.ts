import { Router } from 'express';
import { z } from 'zod';
import { ProductCategory } from '../generated/prisma/enums.js';
import { IdParams, PaginationQuery, parseParams, parseQuery } from '../lib/http.js';
import { getProduct, listProducts, PRODUCT_SORTS, type ProductSort } from '../services/catalogService.js';

const ProductsQuery = PaginationQuery.extend({
  category: z.enum(ProductCategory).optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(Object.keys(PRODUCT_SORTS) as [ProductSort, ...ProductSort[]]).default('featured'),
});

export const catalogRouter = Router();

catalogRouter.get('/', async (req, res) => {
  res.json(await listProducts(parseQuery(ProductsQuery, req), req.user?.id));
});

catalogRouter.get('/:id', async (req, res) => {
  const { id } = parseParams(IdParams, req);
  res.json({ product: await getProduct(id, req.user?.id) });
});
