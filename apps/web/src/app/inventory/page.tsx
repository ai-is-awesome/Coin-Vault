import type { Metadata } from 'next';
import { RequireAuth } from '@/components/RequireAuth';
import { InventoryView } from '@/views/InventoryView';

export const metadata: Metadata = { title: 'Inventory' };

export default function InventoryPage() {
  return (
    <RequireAuth>
      <InventoryView />
    </RequireAuth>
  );
}
