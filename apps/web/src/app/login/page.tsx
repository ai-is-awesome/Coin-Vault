import type { Metadata } from 'next';
import { LoginView } from '@/views/AuthViews';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return <LoginView />;
}
