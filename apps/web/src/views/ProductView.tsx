'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { BuyProductDialog } from '@/components/BuyProductDialog';
import { Coins } from '@/components/Coin';
import { ProductArt } from '@/components/ProductArt';
import { RarityLabel } from '@/components/RarityLabel';
import { Alert, Badge, Button, ButtonLink, EmptyState, PageSpinner, cx } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { RARITY_STYLES } from '@/lib/format';
import { loginHref } from '@/lib/navigation';
import { useMe, useProduct } from '@/lib/queries';

export function ProductView() {
  const { id } = useParams<{ id: string }>();
  const product = useProduct(id);
  const { data: user } = useMe();
  const router = useRouter();
  const [buying, setBuying] = useState(false);

  if (product.isPending) return <PageSpinner />;
  if (product.isError) {
    return product.error instanceof ApiError && product.error.status === 404 ? (
      <EmptyState title="Item not found">
        This item doesn&apos;t exist or is no longer for sale.{' '}
        <Link href="/" className="text-amber-300 hover:underline">
          Back to the store
        </Link>
      </EmptyState>
    ) : (
      <Alert>{errorMessage(product.error)}</Alert>
    );
  }

  const p = product.data;
  const rarity = RARITY_STYLES[p.rarity];

  return (
    <div>
      <Link href="/" className="text-sm text-zinc-400 hover:text-white">
        &larr; Back to store
      </Link>
      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <ProductArt {...p} className={cx('rounded-3xl ring-1', rarity.ring)} />
        <div className="flex flex-col">
          <RarityLabel rarity={p.rarity} category={p.category} size="md" />
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-white">{p.name}</h1>
          <p className="mt-4 text-lg text-zinc-400">{p.description}</p>
          <p className="mt-2 font-mono text-xs text-zinc-600">SKU {p.sku}</p>

          <div className="mt-8 flex items-center gap-4">
            <Coins amount={p.priceCoins} className="text-3xl text-amber-200" iconClassName="size-8" />
            {p.owned && <Badge className="bg-emerald-500/15 text-emerald-300 ring-emerald-500/30">Owned</Badge>}
          </div>

          <div className="mt-8">
            {p.owned ? (
              <ButtonLink href="/inventory" variant="secondary">
                View in inventory
              </ButtonLink>
            ) : (
              <Button
                className="px-8 py-3 text-base"
                onClick={() => (user ? setBuying(true) : router.push(loginHref(`/products/${p.id}`)))}
              >
                {user ? 'Buy now' : 'Sign in to buy'}
              </Button>
            )}
          </div>
        </div>
      </div>
      <BuyProductDialog product={p} open={buying} onClose={() => setBuying(false)} />
    </div>
  );
}
