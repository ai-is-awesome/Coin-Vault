'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, toQueryString } from './api';
import type {
  AdminPurchase,
  AdminStats,
  AdminUser,
  CoinPackage,
  InventoryItem,
  LedgerEntry,
  Paginated,
  PaymentOrder,
  Product,
  ProductCategory,
  ProductInput,
  Purchase,
  User,
} from './types';

export const queryKeys = {
  me: ['me'] as const,
  wallet: ['wallet'] as const,
  transactions: (page: number) => ['wallet', 'transactions', page] as const,
  coinOrders: (page: number) => ['wallet', 'coin-orders', page] as const,
  coinPackages: ['coin-packages'] as const,
  products: (filters: ProductFilters) => ['products', filters] as const,
  product: (id: string) => ['products', 'detail', id] as const,
  inventory: ['inventory'] as const,
  admin: ['admin'] as const,
};

// ---------- Session ----------

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      try {
        return (await api<{ user: User }>('/auth/me')).user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<{ user: User }>('/auth/login', { method: 'POST', body }),
    onSuccess: ({ user }) => {
      qc.clear();
      qc.setQueryData(queryKeys.me, user);
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string; name: string }) =>
      api<{ user: User }>('/auth/register', { method: 'POST', body }),
    onSuccess: ({ user }) => {
      qc.clear();
      qc.setQueryData(queryKeys.me, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      qc.clear();
      qc.setQueryData(queryKeys.me, null);
    },
  });
}

// ---------- Wallet ----------

export function useWallet(enabled = true) {
  return useQuery({
    queryKey: queryKeys.wallet,
    queryFn: () => api<{ balance: number; updatedAt: string }>('/wallet'),
    enabled,
  });
}

export function useTransactions(page: number) {
  return useQuery({
    queryKey: queryKeys.transactions(page),
    queryFn: () => api<Paginated<LedgerEntry>>(`/wallet/transactions${toQueryString({ page, limit: 10 })}`),
    placeholderData: keepPreviousData,
  });
}

export function useCoinOrders(page: number) {
  return useQuery({
    queryKey: queryKeys.coinOrders(page),
    queryFn: () => api<Paginated<PaymentOrder>>(`/coin-purchases${toQueryString({ page, limit: 10 })}`),
    placeholderData: keepPreviousData,
  });
}

// ---------- Buying coins ----------

export function useCoinPackages() {
  return useQuery({
    queryKey: queryKeys.coinPackages,
    queryFn: async () => (await api<{ items: CoinPackage[] }>('/coin-packages')).items,
  });
}

export function useBuyCoins() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { packageId: string; paymentToken: string; idempotencyKey: string }) =>
      api<{ order: PaymentOrder; balance: number }>('/coin-purchases', {
        method: 'POST',
        body: { packageId: input.packageId, paymentToken: input.paymentToken },
        idempotencyKey: input.idempotencyKey,
      }),
    onSuccess: ({ balance }) =>
      qc.setQueryData(queryKeys.wallet, (old: { updatedAt: string } | undefined) => ({ ...old, balance })),
    // Declined payments are still recorded as orders, so refresh history either way.
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.wallet }),
  });
}

// ---------- Catalog & purchases ----------

export interface ProductFilters {
  category?: ProductCategory;
  search?: string;
  sort?: string;
  page?: number;
}

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: queryKeys.products(filters),
    queryFn: () => api<Paginated<Product>>(`/products${toQueryString({ ...filters, limit: 24 })}`),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: async () => (await api<{ product: Product }>(`/products/${id}`)).product,
  });
}

export function useBuyProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; expectedPriceCoins: number; idempotencyKey: string }) =>
      api<{ purchase: Purchase; balance: number }>('/purchases', {
        method: 'POST',
        body: { productId: input.productId, expectedPriceCoins: input.expectedPriceCoins },
        idempotencyKey: input.idempotencyKey,
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: queryKeys.inventory });
    },
  });
}

export function useInventory() {
  return useQuery({
    queryKey: queryKeys.inventory,
    queryFn: async () => (await api<{ items: InventoryItem[] }>('/inventory')).items,
  });
}

// ---------- Admin ----------

export function useAdminStats() {
  return useQuery({ queryKey: [...queryKeys.admin, 'stats'], queryFn: () => api<AdminStats>('/admin/stats') });
}

export function useAdminProducts(page: number) {
  return useQuery({
    queryKey: [...queryKeys.admin, 'products', page],
    queryFn: () => api<Paginated<Product>>(`/admin/products${toQueryString({ page, limit: 50 })}`),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUsers(search: string, page: number) {
  return useQuery({
    queryKey: [...queryKeys.admin, 'users', search, page],
    queryFn: () => api<Paginated<AdminUser>>(`/admin/users${toQueryString({ search, page, limit: 20 })}`),
    placeholderData: keepPreviousData,
  });
}

export function useAdminPurchases(status: string, page: number) {
  return useQuery({
    queryKey: [...queryKeys.admin, 'purchases', status, page],
    queryFn: () => api<Paginated<AdminPurchase>>(`/admin/purchases${toQueryString({ status, page, limit: 20 })}`),
    placeholderData: keepPreviousData,
  });
}

/** Any admin write may change balances, the catalog or stats - refresh everything it could touch. */
function useAdminMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: queryKeys.wallet });
      qc.invalidateQueries({ queryKey: queryKeys.inventory });
    },
  });
}

export const useSaveProduct = () =>
  useAdminMutation(({ id, data }: { id?: string; data: Partial<ProductInput> }) =>
    id
      ? api<{ product: Product }>(`/admin/products/${id}`, { method: 'PATCH', body: data })
      : api<{ product: Product }>('/admin/products', { method: 'POST', body: data }),
  );

export const useAdjustBalance = () =>
  useAdminMutation(
    ({
      userId,
      amount,
      note,
      idempotencyKey,
    }: {
      userId: string;
      amount: number;
      note: string;
      idempotencyKey: string;
    }) =>
      api<{ balance: number }>(`/admin/users/${userId}/adjust`, {
        method: 'POST',
        body: { amount, note },
        idempotencyKey,
      }),
  );

export const useRefundPurchase = () =>
  useAdminMutation((purchaseId: string) =>
    api<{ purchase: Purchase; balance: number }>(`/admin/purchases/${purchaseId}/refund`, { method: 'POST' }),
  );
