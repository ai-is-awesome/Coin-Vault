'use client';

import Link from 'next/link';
import { ProductArt } from '@/components/ProductArt';
import { RarityLabel } from '@/components/RarityLabel';
import { Alert, ButtonLink, EmptyState, PageHeader, PageSpinner, cx } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { CATEGORY_LABELS, formatDate, RARITY_STYLES } from '@/lib/format';
import { useInventory } from '@/lib/queries';
import { PRODUCT_CATEGORIES } from '@/lib/types';

export function InventoryView() {
  const inventory = useInventory();

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Everything you've unlocked with Gold Coins." />
      {inventory.isPending ? (
        <PageSpinner />
      ) : inventory.isError ? (
        <Alert>{errorMessage(inventory.error)}</Alert>
      ) : inventory.data.length === 0 ? (
        <EmptyState title="Your inventory is empty">
          <p>Spend your Gold Coins in the store to unlock skins, emotes and battle passes.</p>
          <ButtonLink href="/" className="mt-4">
            Browse the store
          </ButtonLink>
        </EmptyState>
      ) : (
        <div className="space-y-10">
          {PRODUCT_CATEGORIES.map((category) => {
            const items = inventory.data.filter((item) => item.product.category === category);
            if (items.length === 0) return null;
            return (
              <section key={category} aria-labelledby={`inventory-${category}`}>
                <h2 id={`inventory-${category}`} className="mb-4 text-lg font-bold text-white">
                  {CATEGORY_LABELS[category]} <span className="text-zinc-500">({items.length})</span>
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {items.map((item) => (
                    <Link
                      key={item.id}
                      href={`/products/${item.product.id}`}
                      className={cx(
                        'overflow-hidden rounded-2xl bg-zinc-900 ring-1 transition hover:-translate-y-0.5',
                        RARITY_STYLES[item.product.rarity].ring,
                      )}
                    >
                      <ProductArt {...item.product} />
                      <div className="p-3">
                        <RarityLabel rarity={item.product.rarity} />
                        <p className="font-semibold text-white">{item.product.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">Unlocked {formatDate(item.acquiredAt)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
