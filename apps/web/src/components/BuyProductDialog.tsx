'use client';

import { useState, type ReactNode } from 'react';
import { ApiError, errorMessage } from '@/lib/api';
import { formatCoins } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useBuyProduct, useWallet } from '@/lib/queries';
import type { Product } from '@/lib/types';
import { Coins } from './Coin';
import { Modal } from './Modal';
import { ProductArt } from './ProductArt';
import { RarityLabel } from './RarityLabel';
import { useToast } from './Toaster';
import { Alert, Button, ButtonLink } from './ui';

export function BuyProductDialog({ product, open, onClose }: { product: Product; open: boolean; onClose: () => void }) {
  const buy = useBuyProduct();
  // Reset on close so the next open starts a fresh attempt.
  const close = () => {
    onClose();
    buy.reset();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={buy.isSuccess ? 'Purchase complete' : 'Confirm purchase'}
      dismissible={!buy.isPending}
    >
      <BuyProductContent product={product} onClose={close} buy={buy} />
    </Modal>
  );
}

function BuyProductContent({
  product,
  onClose,
  buy,
}: {
  product: Product;
  onClose: () => void;
  buy: ReturnType<typeof useBuyProduct>;
}) {
  const toast = useToast();
  const wallet = useWallet();
  // One key per attempt: double clicks and retries of this attempt can never charge twice.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [price, setPrice] = useState(product.priceCoins);

  const balance = wallet.data?.balance;
  const shortBy = balance === undefined ? 0 : Math.max(0, price - balance);
  const error = buy.error instanceof ApiError ? buy.error : null;
  // Prefer the server's figure: the cached balance may be stale.
  const coinsNeeded =
    error?.code === 'INSUFFICIENT_FUNDS' ? ((error.details as { shortBy?: number }).shortBy ?? shortBy) : shortBy;

  if (buy.isSuccess) {
    return (
      <div className="space-y-5 text-center">
        <ProductArt {...product} className="mx-auto size-32 rounded-2xl" />
        <p className="text-zinc-300">
          <span className="font-semibold text-white">{product.name}</span> has been added to your inventory.
        </p>
        <p className="text-sm text-zinc-400">
          New balance: <Coins amount={buy.data.balance} className="text-amber-200" iconClassName="size-4" />
        </p>
        <div className="flex gap-3">
          <ButtonLink href="/inventory" variant="secondary" className="flex-1">
            View inventory
          </ButtonLink>
          <Button className="flex-1" onClick={onClose}>
            Keep shopping
          </Button>
        </div>
      </div>
    );
  }

  const confirm = () =>
    buy.mutate(
      { productId: product.id, expectedPriceCoins: price, idempotencyKey },
      {
        onSuccess: () => toast(`${product.name} unlocked!`),
        onError: (err) => {
          // The catalog price changed since the page loaded: show the new price and let the user re-confirm.
          if (err instanceof ApiError && err.code === 'PRICE_CHANGED') {
            setPrice((err.details as { priceCoins: number }).priceCoins);
          }
        },
      },
    );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <ProductArt {...product} className="size-20 shrink-0 rounded-xl" />
        <div>
          <RarityLabel rarity={product.rarity} category={product.category} />
          <p className="text-lg font-bold text-white">{product.name}</p>
        </div>
      </div>

      <dl className="space-y-2 rounded-xl bg-zinc-950 p-4 text-sm ring-1 ring-zinc-800">
        <Row label="Price">
          <Coins amount={price} iconClassName="size-4" />
        </Row>
        <Row label="Your balance">
          {balance === undefined ? '...' : <Coins amount={balance} iconClassName="size-4" />}
        </Row>
        <div className="border-t border-zinc-800" />
        <Row label="Balance after">
          {balance === undefined ? (
            '...'
          ) : shortBy > 0 ? (
            <span className="text-rose-400">Not enough coins</span>
          ) : (
            <Coins amount={balance - price} iconClassName="size-4" className="text-amber-200" />
          )}
        </Row>
      </dl>

      {error && error.code !== 'INSUFFICIENT_FUNDS' && <Alert>{errorMessage(error)}</Alert>}
      {!error && buy.isError && <Alert>{errorMessage(buy.error)}</Alert>}

      {shortBy > 0 || error?.code === 'INSUFFICIENT_FUNDS' ? (
        <div className="space-y-3">
          <Alert tone="info">
            You need <strong>{formatCoins(coinsNeeded)}</strong> more Gold Coins for this item.
          </Alert>
          <ButtonLink href="/coins" className="w-full py-2.5">
            Buy Gold Coins
          </ButtonLink>
        </div>
      ) : error?.code === 'ALREADY_OWNED' ? (
        <Button variant="secondary" className="w-full" onClick={onClose}>
          Close
        </Button>
      ) : (
        <Button className="w-full py-2.5" loading={buy.isPending} disabled={balance === undefined} onClick={confirm}>
          {buy.isPending ? 'Processing...' : <>Buy for {formatCoins(price)} coins</>}
        </Button>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-400">{label}</dt>
      <dd className="text-white">{children}</dd>
    </div>
  );
}
