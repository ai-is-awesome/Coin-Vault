export type Role = 'USER' | 'ADMIN';
export const PRODUCT_CATEGORIES = ['SKIN', 'EMOTE', 'BATTLE_PASS'] as const;
export const RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type Rarity = (typeof RARITIES)[number];

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: ProductCategory;
  rarity: Rarity;
  priceCoins: number;
  imageUrl: string | null;
  active: boolean;
  createdAt: string;
  owned?: boolean;
}

export interface CoinPackage {
  id: string;
  code: string;
  name: string;
  coins: number;
  bonusCoins: number;
  priceCents: number;
  currency: string;
}

export interface PaymentOrder {
  id: string;
  packageName: string;
  coins: number;
  amountCents: number;
  currency: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  cardBrand: string | null;
  cardLast4: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Purchase {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  productSku: string;
  category: ProductCategory;
  rarity: Rarity;
  priceCoins: number;
  status: 'COMPLETED' | 'REFUNDED';
  createdAt: string;
  refundedAt: string | null;
}

export interface LedgerEntry {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceAfter: number;
  reason: 'COIN_PURCHASE' | 'PRODUCT_PURCHASE' | 'REFUND' | 'ADMIN_ADJUSTMENT';
  description: string;
  note: string | null;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  acquiredAt: string;
  product: Pick<Product, 'id' | 'sku' | 'name' | 'description' | 'category' | 'rarity' | 'imageUrl'>;
}

export interface AdminUser extends User {
  balance: number;
  itemsOwned: number;
}

export interface AdminPurchase extends Purchase {
  user: { id: string; email: string; name: string };
}

export interface AdminStats {
  users: number;
  coinsInCirculation: number;
  coinsSold: number;
  revenueCents: number;
  purchases: number;
  coinsSpent: number;
  refunds: number;
}

export interface ProductInput {
  sku: string;
  name: string;
  description: string;
  category: ProductCategory;
  rarity: Rarity;
  priceCoins: number;
  imageUrl: string | null;
  active: boolean;
}
