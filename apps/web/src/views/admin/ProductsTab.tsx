'use client';

import { useState } from 'react';
import { Coins } from '@/components/Coin';
import { Modal } from '@/components/Modal';
import { RarityLabel } from '@/components/RarityLabel';
import { useToast } from '@/components/Toaster';
import { Alert, Button, DataTable, PageSpinner, Pagination, StatusBadge, Td, cx } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAdminProducts, useSaveProduct } from '@/lib/queries';
import type { Product } from '@/lib/types';
import { ProductForm } from './ProductForm';

export function ProductsTab() {
  const [page, setPage] = useState(1);
  const products = useAdminProducts(page);
  const save = useSaveProduct();
  const toast = useToast();
  const [editing, setEditing] = useState<Product | 'new' | null>(null);

  if (products.isPending) return <PageSpinner />;
  if (products.isError) return <Alert>{errorMessage(products.error)}</Alert>;

  const toggleActive = (p: Product) =>
    save.mutate(
      { id: p.id, data: { active: !p.active } },
      {
        onSuccess: () => toast(p.active ? `${p.name} removed from the store` : `${p.name} is back in the store`),
        onError: (err) => toast(errorMessage(err), 'error'),
      },
    );

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing('new')}>New product</Button>
      </div>
      <DataTable
        columns={[
          { label: 'Product' },
          { label: 'Type' },
          { label: 'Price', align: 'right' },
          { label: 'Status' },
          { label: 'Actions', hidden: true },
        ]}
      >
        {products.data.items.map((p) => (
          <tr key={p.id} className={cx(!p.active && 'opacity-50')}>
            <Td>
              <p className="font-semibold text-white">{p.name}</p>
              <p className="font-mono text-xs text-zinc-500">{p.sku}</p>
            </Td>
            <Td>
              <RarityLabel rarity={p.rarity} category={p.category} />
            </Td>
            <Td align="right">
              <Coins amount={p.priceCoins} iconClassName="size-4" className="text-amber-200" />
            </Td>
            <Td>
              {p.active ? (
                <StatusBadge tone="success">on sale</StatusBadge>
              ) : (
                <StatusBadge tone="neutral">hidden</StatusBadge>
              )}
            </Td>
            <Td align="right" className="whitespace-nowrap">
              <Button variant="ghost" className="px-2 py-1" onClick={() => setEditing(p)}>
                Edit
              </Button>
              <Button variant="ghost" className="px-2 py-1" onClick={() => toggleActive(p)} disabled={save.isPending}>
                {p.active ? 'Hide' : 'Restore'}
              </Button>
            </Td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={products.data.totalPages} onChange={setPage} />
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New product' : 'Edit product'}
      >
        {editing !== null && (
          <ProductForm product={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
        )}
      </Modal>
    </>
  );
}
