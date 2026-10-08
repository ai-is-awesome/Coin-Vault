'use client';

import { useState } from 'react';
import { Coins } from '@/components/Coin';
import { Modal } from '@/components/Modal';
import { Alert, Button, DataTable, Input, PageSpinner, Pagination, Td } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import { useAdminUsers } from '@/lib/queries';
import type { AdminUser } from '@/lib/types';
import { AdjustBalanceForm } from './AdjustBalanceForm';

export function PlayersTab() {
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(searchInput.trim());
  const users = useAdminUsers(search, page);
  const [adjusting, setAdjusting] = useState<AdminUser | null>(null);

  return (
    <>
      <div className="mb-4">
        <Input
          type="search"
          aria-label="Search players"
          placeholder="Search by name or email..."
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
      </div>
      {users.isPending ? (
        <PageSpinner />
      ) : users.isError ? (
        <Alert>{errorMessage(users.error)}</Alert>
      ) : (
        <>
          <DataTable
            columns={[
              { label: 'Player' },
              { label: 'Role' },
              { label: 'Balance', align: 'right' },
              { label: 'Items', align: 'right' },
              { label: 'Joined' },
              { label: 'Actions', hidden: true },
            ]}
          >
            {users.data.items.map((u) => (
              <tr key={u.id}>
                <Td>
                  <p className="font-semibold text-white">{u.name}</p>
                  <p className="text-xs text-zinc-500">{u.email}</p>
                </Td>
                <Td className="text-zinc-400">{u.role.toLowerCase()}</Td>
                <Td align="right">
                  <Coins amount={u.balance} iconClassName="size-4" className="text-amber-200" />
                </Td>
                <Td align="right" className="tabular-nums">
                  {u.itemsOwned}
                </Td>
                <Td className="whitespace-nowrap text-zinc-400">{formatDate(u.createdAt)}</Td>
                <Td align="right">
                  <Button variant="ghost" className="px-2 py-1" onClick={() => setAdjusting(u)}>
                    Adjust coins
                  </Button>
                </Td>
              </tr>
            ))}
          </DataTable>
          {users.data.items.length === 0 && <p className="mt-4 text-center text-sm text-zinc-500">No players found.</p>}
          <Pagination page={page} totalPages={users.data.totalPages} onChange={setPage} />
        </>
      )}
      <Modal open={adjusting !== null} onClose={() => setAdjusting(null)} title="Adjust balance">
        {adjusting && <AdjustBalanceForm user={adjusting} onDone={() => setAdjusting(null)} />}
      </Modal>
    </>
  );
}
