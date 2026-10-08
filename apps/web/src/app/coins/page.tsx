import type { Metadata } from 'next';
import { CoinsView } from '@/views/CoinsView';

export const metadata: Metadata = { title: 'Buy Gold Coins' };

export default function CoinsPage() {
  return <CoinsView />;
}
