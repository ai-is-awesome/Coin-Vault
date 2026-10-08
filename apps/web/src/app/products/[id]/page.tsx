import type { Metadata } from 'next';
import { ProductView } from '@/views/ProductView';

export const metadata: Metadata = { title: 'Item' };

export default function ProductPage() {
  return <ProductView />;
}
