'use client';

import { useState, type FormEvent } from 'react';
import { Coins } from '@/components/Coin';
import { useToast } from '@/components/Toaster';
import { Alert, Button, Field, Input } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatCoins } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/idempotency';
import { useAdjustBalance } from '@/lib/queries';
import type { AdminUser } from '@/lib/types';

export function AdjustBalanceForm({ user, onDone }: { user: AdminUser; onDone: () => void }) {
  const adjust = useAdjustBalance();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  // One key per opened form: a double submit or network retry is applied once.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const value = Number(amount);
  const valid = Number.isInteger(value) && value !== 0 && note.trim().length >= 3;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    adjust.mutate(
      { userId: user.id, amount: value, note, idempotencyKey },
      {
        onSuccess: ({ balance }) => {
          toast(`${user.name}'s balance is now ${formatCoins(balance)} coins`);
          onDone();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-zinc-400">
        {user.name} currently has <Coins amount={user.balance} iconClassName="size-4" className="text-amber-200" />. Use
        a negative amount to remove coins. Every adjustment is recorded in the ledger with your name and the reason.
      </p>
      <Field label="Amount (coins)">
        <Input
          type="number"
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 250 or -100"
        />
      </Field>
      <Field label="Reason">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Compensation for server outage" />
      </Field>
      {adjust.isError && <Alert>{errorMessage(adjust.error)}</Alert>}
      <Button type="submit" className="w-full" loading={adjust.isPending} disabled={!valid}>
        {value < 0 ? `Remove ${formatCoins(-value)} coins` : `Add ${formatCoins(value || 0)} coins`}
      </Button>
    </form>
  );
}
