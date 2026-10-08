import type { Metadata } from 'next';
import { RequireAuth } from '@/components/RequireAuth';
import { AdminView } from '@/views/admin/AdminView';

export const metadata: Metadata = { title: 'Admin' };

export default function AdminPage() {
  return (
    <RequireAuth admin>
      <AdminView />
    </RequireAuth>
  );
}
