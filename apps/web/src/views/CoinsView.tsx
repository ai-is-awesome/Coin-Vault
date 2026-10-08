'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckoutDialog } from '@/components/CheckoutDialog';
import { CoinIcon, Coins } from '@/components/Coin';
import { Alert, Badge, Button, Card, PageHeader, PageSpinner, cx } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatCoins, formatMoney } from '@/lib/format';
import { loginHref } from '@/lib/navigation';
import { useCoinPackages, useMe, useWallet } from '@/lib/queries';
import type { CoinPackage } from '@/lib/types';

export function CoinsView() {
  const packages = useCoinPackages();
  const { data: user } = useMe();
  const wallet = useWallet(!!user);
  const router = useRouter();
  const [selected, setSelected] = useState<CoinPackage | null>(null);

  const coinsPerDollar = (p: CoinPackage) => (p.coins + p.bonusCoins) / p.priceCents;
  const bestValueId = packages.data?.reduce<CoinPackage | null>(
    (best, p) => (!best || coinsPerDollar(p) > coinsPerDollar(best) ? p : best),
    null,
  )?.id;

  return (
    <div>
      <PageHeader
        title="Buy Gold Coins"
        subtitle="Gold Coins are the only currency in the vault. Bigger packs include bonus coins."
        actions={
          user && wallet.data ? (
            <Card className="px-4 py-2 text-sm">
              <span className="text-zinc-400">Balance </span>
              <Coins amount={wallet.data.balance} className="text-amber-200" iconClassName="size-4" />
            </Card>
          ) : null
        }
      />

      {packages.isPending ? (
        <PageSpinner />
      ) : packages.isError ? (
        <Alert>{errorMessage(packages.error)}</Alert>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {packages.data.map((pkg, index) => {
            const best = pkg.id === bestValueId;
            return (
              <Card
                key={pkg.id}
                className={cx('relative flex flex-col items-center p-6 text-center', best && 'ring-2 ring-amber-400')}
              >
                {best && (
                  <Badge className="absolute -top-2.5 bg-amber-400 text-zinc-950 ring-amber-300">Best value</Badge>
                )}
                <div className="relative mb-4 flex h-16 items-end justify-center">
                  {Array.from({ length: Math.min(index + 1, 5) }, (_, i) => (
                    <CoinIcon key={i} className="-mx-2 size-10 drop-shadow-lg" />
                  ))}
                </div>
                <p className="font-semibold text-zinc-300">{pkg.name}</p>
                <p className="mt-1 text-2xl font-extrabold text-amber-200 tabular-nums">
                  {formatCoins(pkg.coins + pkg.bonusCoins)}
                </p>
                <p className="h-5 text-xs font-semibold text-emerald-400">
                  {pkg.bonusCoins > 0 && `includes +${formatCoins(pkg.bonusCoins)} bonus`}
                </p>
                <Button
                  className="mt-5 w-full"
                  variant={best ? 'primary' : 'secondary'}
                  onClick={() => (user ? setSelected(pkg) : router.push(loginHref('/coins')))}
                >
                  {formatMoney(pkg.priceCents, pkg.currency)}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-center text-sm text-zinc-500">
        Payments are processed by a simulated provider. Use test card 4242 4242 4242 4242 - no real money is charged.
      </p>

      {selected && <CheckoutDialog pkg={selected} open onClose={() => setSelected(null)} />}
    </div>
  );
}
