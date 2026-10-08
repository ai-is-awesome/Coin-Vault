'use client';

import { useState, type FormEvent } from 'react';
import { ApiError, errorMessage } from '@/lib/api';
import { formatCoins, formatMoney } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/idempotency';
import {
  formatCardNumber,
  formatExpiry,
  TEST_CARDS,
  tokenizeCard,
  validateCard,
  type CardErrors,
  type CardInput,
} from '@/lib/mockCardTokenizer';
import { useBuyCoins } from '@/lib/queries';
import type { CoinPackage } from '@/lib/types';
import { CoinIcon, Coins } from './Coin';
import { Modal } from './Modal';
import { useToast } from './Toaster';
import { Alert, Button, Field, Input } from './ui';

export function CheckoutDialog({ pkg, open, onClose }: { pkg: CoinPackage; open: boolean; onClose: () => void }) {
  const buy = useBuyCoins();
  // Reset on close so the next open starts a fresh attempt.
  const close = () => {
    onClose();
    buy.reset();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={buy.isSuccess ? 'Payment successful' : 'Checkout'}
      dismissible={!buy.isPending}
    >
      <CheckoutContent pkg={pkg} onClose={close} buy={buy} />
    </Modal>
  );
}

function CheckoutContent({
  pkg,
  onClose,
  buy,
}: {
  pkg: CoinPackage;
  onClose: () => void;
  buy: ReturnType<typeof useBuyCoins>;
}) {
  const toast = useToast();
  const [card, setCard] = useState<CardInput>({ number: TEST_CARDS[0].number, expiry: '12/34', cvc: '123' });
  const [errors, setErrors] = useState<CardErrors>({});
  // New key per attempt. After a decline the order is final, so trying another card needs a new key.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const totalCoins = pkg.coins + pkg.bonusCoins;

  if (buy.isSuccess) {
    return (
      <div className="space-y-5 text-center">
        <CoinIcon className="mx-auto size-16 drop-shadow-[0_0_24px_rgba(251,191,36,0.6)]" />
        <p className="text-zinc-300">
          <span className="font-bold text-amber-200">{formatCoins(buy.data.order.coins)} Gold Coins</span> were added to
          your wallet.
        </p>
        <p className="text-sm text-zinc-400">
          Charged {formatMoney(buy.data.order.amountCents, buy.data.order.currency)} to {buy.data.order.cardBrand}{' '}
          ending {buy.data.order.cardLast4}. New balance:{' '}
          <Coins amount={buy.data.balance} iconClassName="size-4" className="text-amber-200" />
        </p>
        <Button className="w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = validateCard(card);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    buy.mutate(
      { packageId: pkg.id, paymentToken: tokenizeCard(card), idempotencyKey },
      {
        onSuccess: ({ order }) => toast(`+${formatCoins(order.coins)} Gold Coins`),
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'PAYMENT_DECLINED') setIdempotencyKey(newIdempotencyKey());
        },
      },
    );
  };

  const declined = buy.error instanceof ApiError && buy.error.code === 'PAYMENT_DECLINED';

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="flex items-center justify-between rounded-xl bg-zinc-950 p-4 ring-1 ring-zinc-800">
        <div>
          <p className="font-semibold text-white">{pkg.name}</p>
          <p className="text-sm text-amber-200">
            <Coins amount={totalCoins} iconClassName="size-4" />
            {pkg.bonusCoins > 0 && (
              <span className="ml-1 text-xs text-emerald-400">incl. {formatCoins(pkg.bonusCoins)} bonus</span>
            )}
          </p>
        </div>
        <p className="text-xl font-bold text-white">{formatMoney(pkg.priceCents, pkg.currency)}</p>
      </div>

      <Field label="Card number" error={errors.number}>
        <Input
          inputMode="numeric"
          autoComplete="cc-number"
          value={card.number}
          onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
          disabled={buy.isPending}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiry (MM/YY)" error={errors.expiry}>
          <Input
            inputMode="numeric"
            autoComplete="cc-exp"
            value={card.expiry}
            onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
            disabled={buy.isPending}
          />
        </Field>
        <Field label="CVC" error={errors.cvc}>
          <Input
            inputMode="numeric"
            autoComplete="cc-csc"
            maxLength={4}
            value={card.cvc}
            onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '') })}
            disabled={buy.isPending}
          />
        </Field>
      </div>

      <details className="rounded-lg bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400 ring-1 ring-zinc-800">
        <summary className="cursor-pointer select-none font-medium text-zinc-300">
          Test cards (payments are simulated)
        </summary>
        <ul className="mt-2 space-y-1">
          {TEST_CARDS.map((c) => (
            <li key={c.token}>
              <button
                type="button"
                className="font-mono text-amber-200 hover:underline"
                onClick={() => setCard({ ...card, number: c.number })}
              >
                {c.number}
              </button>{' '}
              - {c.label}
            </li>
          ))}
        </ul>
      </details>

      {buy.isError && (
        <Alert>{declined ? `${errorMessage(buy.error)} Try another card.` : errorMessage(buy.error)}</Alert>
      )}

      <Button type="submit" className="w-full py-2.5" loading={buy.isPending}>
        {buy.isPending ? 'Processing payment...' : `Pay ${formatMoney(pkg.priceCents, pkg.currency)}`}
      </Button>
      <p className="text-center text-xs text-zinc-500">
        Your card details are tokenized in the browser and never sent to our servers.
      </p>
    </form>
  );
}
