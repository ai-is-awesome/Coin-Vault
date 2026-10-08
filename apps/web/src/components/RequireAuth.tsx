'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { loginHref } from '@/lib/navigation';
import { useMe } from '@/lib/queries';
import { EmptyState, PageSpinner } from './ui';

/** Client-side route guard. The API enforces auth on every request; this just routes the UI. */
export function RequireAuth({ admin = false, children }: { admin?: boolean; children: ReactNode }) {
  const { data: user, isLoading } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(loginHref(window.location.pathname));
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) return <PageSpinner />;
  if (admin && user.role !== 'ADMIN') {
    return <EmptyState title="Admins only">You need an admin account to view this page.</EmptyState>;
  }
  return <>{children}</>;
}
