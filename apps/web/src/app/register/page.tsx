import type { Metadata } from 'next';
import { RegisterView } from '@/views/AuthViews';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return <RegisterView />;
}
