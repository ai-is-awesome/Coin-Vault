'use client';

import { Alert, Card, PageSpinner } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatCoins, formatMoney, formatNumber } from '@/lib/format';
import { useAdminStats } from '@/lib/queries';

export function OverviewTab() {
  const stats = useAdminStats();
  if (stats.isPending) return <PageSpinner />;
  if (stats.isError) return <Alert>{errorMessage(stats.error)}</Alert>;

  const s = stats.data;
  const tiles = [
    { label: 'Revenue', value: formatMoney(s.revenueCents) },
    { label: 'Coins sold', value: formatCoins(s.coinsSold) },
    { label: 'Coins spent', value: formatCoins(s.coinsSpent) },
    { label: 'Coins in wallets', value: formatCoins(s.coinsInCirculation) },
    { label: 'Players', value: formatNumber(s.users) },
    { label: 'Item purchases', value: formatNumber(s.purchases) },
    { label: 'Refunds', value: formatNumber(s.refunds) },
  ];

  return (
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label} className="p-5">
          <dt className="text-sm text-zinc-400">{tile.label}</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums text-white">{tile.value}</dd>
        </Card>
      ))}
    </dl>
  );
}
