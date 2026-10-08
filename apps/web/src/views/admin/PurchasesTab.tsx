'use client';

import { useState } from 'react';
import { Coins } from '@/components/Coin';
import { useToast } from '@/components/Toaster';
import { Alert, Button, DataTable, PageSpinner, Pagination, Select, StatusBadge, Td } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatCoins, formatDate } from '@/lib/format';
import { useAdminPurchases, useRefundPurchase } from '@/lib/queries';
import type { AdminPurchase } from '@/lib/types';

export function PurchasesTab() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const purchases = useAdminPurchases(status, page);
  const refund = useRefundPurchase();
  const toast = useToast();

  const refundPurchase = (p: AdminPurchase) => {
    const confirmed = window.confirm(
      `Refund ${formatCoins(p.priceCoins)} coins for "${p.productName}"? The item will be removed from ${p.user.name}'s inventory.`,
    );
    if (!confirmed) return;
    refund.mutate(p.id, {
      onSuccess: () => toast(`Refunded ${formatCoins(p.priceCoins)} coins`),
      onError: (err) => toast(errorMessage(err), 'error'),
    });
  };

  return (
    <>
      <div className="mb-4">
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="max-w-48"
          aria-label="Filter by status"
        >
          <option value="">All purchases</option>
          <option value="COMPLETED">Completed</option>
          <option value="REFUNDED">Refunded</option>
        </Select>
      </div>
      {purchases.isPending ? (
        <PageSpinner />
      ) : purchases.isError ? (
        <Alert>{errorMessage(purchases.error)}</Alert>
      ) : (
        <>
          <DataTable
            columns={[
              { label: 'Date' },
              { label: 'Player' },
              { label: 'Item' },
              { label: 'Price', align: 'right' },
              { label: 'Status' },
              { label: 'Actions', hidden: true },
            ]}
          >
            {purchases.data.items.map((p) => (
              <tr key={p.id}>
                <Td className="whitespace-nowrap text-zinc-400">{formatDate(p.createdAt)}</Td>
                <Td>
                  <p className="text-white">{p.user.name}</p>
                  <p className="text-xs text-zinc-500">{p.user.email}</p>
                </Td>
                <Td className="text-white">{p.productName}</Td>
                <Td align="right">
                  <Coins amount={p.priceCoins} iconClassName="size-4" className="text-amber-200" />
                </Td>
                <Td>
                  <StatusBadge tone={p.status === 'COMPLETED' ? 'success' : 'neutral'}>
                    {p.status.toLowerCase()}
                  </StatusBadge>
                </Td>
                <Td align="right">
                  {p.status === 'COMPLETED' && (
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-rose-300"
                      disabled={refund.isPending}
                      onClick={() => refundPurchase(p)}
                    >
                      Refund
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </DataTable>
          {purchases.data.items.length === 0 && (
            <p className="mt-4 text-center text-sm text-zinc-500">No purchases yet.</p>
          )}
          <Pagination page={page} totalPages={purchases.data.totalPages} onChange={setPage} />
        </>
      )}
    </>
  );
}
