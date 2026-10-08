import { prisma } from '../db/prisma.js';
import type { Prisma, Product } from '../generated/prisma/client.js';
import type { ProductCategory } from '../generated/prisma/enums.js';
import { Errors } from '../lib/errors.js';
import { pageArgs, toPage, type PageRequest } from '../lib/pagination.js';

export const PRODUCT_SORTS = {
  featured: [{ rarity: 'desc' }, { priceCoins: 'desc' }],
  price_asc: [{ priceCoins: 'asc' }, { name: 'asc' }],
  price_desc: [{ priceCoins: 'desc' }, { name: 'asc' }],
  name: [{ name: 'asc' }],
  newest: [{ createdAt: 'desc' }],
} satisfies Record<string, Prisma.ProductOrderByWithRelationInput[]>;

export type ProductSort = keyof typeof PRODUCT_SORTS;

/** Adds `owned` to each product for the given user (false for anonymous visitors). */
async function withOwnership(products: Product[], userId?: string) {
  if (!userId || products.length === 0) return products.map((p) => ({ ...p, owned: false }));
  const owned = await prisma.inventoryItem.findMany({
    where: { userId, productId: { in: products.map((p) => p.id) } },
    select: { productId: true },
  });
  const ownedIds = new Set(owned.map((o) => o.productId));
  return products.map((p) => ({ ...p, owned: ownedIds.has(p.id) }));
}

export async function listProducts(
  query: PageRequest & { category?: ProductCategory; search?: string; sort: ProductSort },
  userId?: string,
) {
  const where: Prisma.ProductWhereInput = {
    active: true,
    category: query.category,
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
  };
  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: PRODUCT_SORTS[query.sort], ...pageArgs(query) }),
    prisma.product.count({ where }),
  ]);
  return toPage(await withOwnership(products, userId), total, query);
}

/** A product on sale - or one the user already owns, so inventory links keep working after delisting. */
export async function getProduct(id: string, userId?: string) {
  const product = await prisma.product.findFirst({
    where: { id, OR: [{ active: true }, ...(userId ? [{ inventoryItems: { some: { userId } } }] : [])] },
  });
  if (!product) throw Errors.notFound('Product');
  const [withOwned] = await withOwnership([product], userId);
  return withOwned;
}
