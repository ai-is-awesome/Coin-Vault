'use client';

import { useState } from 'react';
import { Coins } from '@/components/Coin';
import {
  Alert,
  ButtonLink,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  PageSpinner,
  Pagination,
  SegmentedControl,
  StatusBadge,
  Td,
  cx,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatCoins, formatDate, formatMoney } from '@/lib/format';
import { useCoinOrders, useTransactions, useWallet } from '@/lib/queries';
import type { PaymentOrder } from '@/lib/types';

type Section = 'transactions' | 'orders';

export function WalletView() {
  const wallet = useWallet();
  const [section, setSection] = useState<Section>('transactions');

  return (
    <div>
      <PageHeader
        title="Wallet"
        subtitle="Every Gold Coin in or out of your wallet is recorded in an append-only ledger."
      />

      <Card className="mb-8 flex flex-wrap items-center justify-between gap-4 bg-linear-to-br from-amber-500/15 via-zinc-900 to-zinc-900 p-6">
        <div>
          <p className="text-sm text-zinc-400">Current balance</p>
          <p className="mt-1 text-4xl text-amber-200">
            {wallet.data ? <Coins amount={wallet.data.balance} iconClassName="size-9" /> : '...'}
          </p>
        </div>
        <ButtonLink href="/coins">Buy Gold Coins</ButtonLink>
      </Card>

      <div className="mb-4">
        <SegmentedControl
          label="Wallet history"
          options={[
            { value: 'transactions', label: 'Transactions' },
            { value: 'orders', label: 'Coin purchases' },
          ]}
          value={section}
          onChange={setSection}
        />
      </div>
      {section === 'transactions' ? <Transactions /> : <Orders />}
    </div>
  );
}

function Transactions() {
  const [page, setPage] = useState(1);
  const tx = useTransactions(page);

  if (tx.isPending) return <PageSpinner />;
  if (tx.isError) return <Alert>{errorMessage(tx.error)}</Alert>;
  if (tx.data.items.length === 0) {
    return <EmptyState title="No transactions yet">Buy some Gold Coins to get started.</EmptyState>;
  }

  return (
    <>
      <DataTable
        columns={[
          { label: 'Date' },
          { label: 'Description' },
          { label: 'Amount', align: 'right' },
          { label: 'Balance', align: 'right' },
        ]}
      >
        {tx.data.items.map((entry) => (
          <tr key={entry.id}>
            <Td className="whitespace-nowrap text-zinc-400">{formatDate(entry.createdAt)}</Td>
            <Td className="text-white">{entry.description}</Td>
            <Td
              align="right"
              className={cx(
                'whitespace-nowrap font-semibold tabular-nums',
                entry.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400',
              )}
            >
              {entry.type === 'CREDIT' ? '+' : '-'}
              {formatCoins(entry.amount)}
            </Td>
            <Td align="right" className="whitespace-nowrap tabular-nums text-zinc-300">
              {formatCoins(entry.balanceAfter)}
            </Td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={tx.data.totalPages} onChange={setPage} />
    </>
  );
}

const ORDER_TONE = { SUCCEEDED: 'success', FAILED: 'danger', PENDING: 'neutral' } as const satisfies Record<
  PaymentOrder['status'],
  string
>;

function Orders() {
  const [page, setPage] = useState(1);
  const orders = useCoinOrders(page);

  if (orders.isPending) return <PageSpinner />;
  if (orders.isError) return <Alert>{errorMessage(orders.error)}</Alert>;
  if (orders.data.items.length === 0) return <EmptyState title="No coin purchases yet" />;

  return (
    <>
      <DataTable
        columns={[
          { label: 'Date' },
          { label: 'Package' },
          { label: 'Coins', align: 'right' },
          { label: 'Paid', align: 'right' },
          { label: 'Card' },
          { label: 'Status' },
        ]}
      >
        {orders.data.items.map((order) => (
          <tr key={order.id}>
            <Td className="whitespace-nowrap text-zinc-400">{formatDate(order.createdAt)}</Td>
            <Td className="text-white">{order.packageName}</Td>
            <Td align="right" className="tabular-nums text-amber-200">
              {formatCoins(order.coins)}
            </Td>
            <Td align="right" className="tabular-nums">
              {formatMoney(order.amountCents, order.currency)}
            </Td>
            <Td className="whitespace-nowrap capitalize text-zinc-400">
              {order.cardLast4 ? `${order.cardBrand} •••• ${order.cardLast4}` : '-'}
            </Td>
            <Td>
              <StatusBadge tone={ORDER_TONE[order.status]}>{order.status.toLowerCase()}</StatusBadge>
              {order.failureMessage && <p className="mt-1 text-xs text-zinc-500">{order.failureMessage}</p>}
            </Td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={orders.data.totalPages} onChange={setPage} />
    </>
  );
}
