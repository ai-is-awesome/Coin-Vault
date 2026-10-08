'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BuyProductDialog } from '@/components/BuyProductDialog';
import { Coins } from '@/components/Coin';
import { ProductCard } from '@/components/ProductCard';
import {
  Alert,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  PageSpinner,
  Pagination,
  SegmentedControl,
  Select,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { CATEGORY_LABELS } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import { loginHref } from '@/lib/navigation';
import { useMe, useProducts, useWallet } from '@/lib/queries';
import { PRODUCT_CATEGORIES, type Product, type ProductCategory } from '@/lib/types';

type CategoryFilter = ProductCategory | 'ALL';

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: 'ALL', label: 'All items' },
  ...PRODUCT_CATEGORIES.map((category) => ({ value: category, label: CATEGORY_LABELS[category] })),
];

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name' },
  { value: 'newest', label: 'Newest' },
];

export function StoreView() {
  const router = useRouter();
  const { data: user } = useMe();
  const wallet = useWallet(!!user);

  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('featured');
  const [page, setPage] = useState(1);
  const [buying, setBuying] = useState<Product | null>(null);
  const search = useDebounced(searchInput.trim());

  const products = useProducts({
    category: category === 'ALL' ? undefined : category,
    search: search || undefined,
    sort,
    page,
  });

  const startPurchase = (product: Product) =>
    user ? setBuying(product) : router.push(loginHref(`/products/${product.id}`));

  return (
    <div className="space-y-10">
      <section className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">Item Shop</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Gear up with{' '}
            <span className="bg-linear-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">Gold Coins</span>
          </h1>
          <p className="mt-3 max-w-xl text-zinc-400">
            Skins, emotes and battle passes - all priced in Gold Coins, the only currency in the vault.
          </p>
        </div>
        <Card className="min-w-64 p-5">
          {user ? (
            <>
              <p className="text-sm text-zinc-400">Your balance</p>
              <p className="mt-1 text-3xl text-amber-200">
                {wallet.data ? <Coins amount={wallet.data.balance} iconClassName="size-7" /> : '...'}
              </p>
              <ButtonLink href="/coins" className="mt-4 w-full">
                Buy Gold Coins
              </ButtonLink>
            </>
          ) : (
            <>
              <p className="font-semibold text-white">New here?</p>
              <p className="mt-1 text-sm text-zinc-400">Create an account to start collecting.</p>
              <ButtonLink href="/register" className="mt-4 w-full">
                Create account
              </ButtonLink>
            </>
          )}
        </Card>
      </section>

      <section className="space-y-6" aria-label="Catalog">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Category"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(value) => {
              setCategory(value);
              setPage(1);
            }}
          />
          <div className="ml-auto flex w-full gap-3 sm:w-auto">
            <Input
              type="search"
              placeholder="Search items..."
              aria-label="Search items"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
              className="sm:w-56"
            />
            <Select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)} className="w-40">
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {products.isPending ? (
          <PageSpinner />
        ) : products.isError ? (
          <Alert>{errorMessage(products.error)}</Alert>
        ) : products.data.items.length === 0 ? (
          <EmptyState title="No items found">Try a different category or search.</EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.data.items.map((product) => (
                <ProductCard key={product.id} product={product} onBuy={startPurchase} />
              ))}
            </div>
            <Pagination page={page} totalPages={products.data.totalPages} onChange={setPage} />
          </>
        )}
      </section>

      {buying && <BuyProductDialog product={buying} open onClose={() => setBuying(null)} />}
    </div>
  );
}
