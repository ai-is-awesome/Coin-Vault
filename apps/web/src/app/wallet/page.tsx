import type { Metadata } from 'next';
import { RequireAuth } from '@/components/RequireAuth';
import { WalletView } from '@/views/WalletView';

export const metadata: Metadata = { title: 'Wallet' };

export default function WalletPage() {
  return (
    <RequireAuth>
      <WalletView />
    </RequireAuth>
  );
}
