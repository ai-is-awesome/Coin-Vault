'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { formatCoins } from '@/lib/format';
import { useLogout, useMe, useWallet } from '@/lib/queries';
import { CoinIcon } from './Coin';
import { useToast } from './Toaster';
import { ButtonLink, cx } from './ui';

const NAV = [
  { href: '/', label: 'Store' },
  { href: '/coins', label: 'Buy Coins' },
  { href: '/inventory', label: 'Inventory', auth: true },
  { href: '/wallet', label: 'Wallet', auth: true },
  { href: '/admin', label: 'Admin', admin: true },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { data: user, isLoading } = useMe();
  const wallet = useWallet(!!user);
  const logout = useLogout();

  const links = NAV.filter((item) => (item.admin ? user?.role === 'ADMIN' : item.auth ? !!user : true));
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' || pathname.startsWith('/products') : pathname.startsWith(href);

  const signOut = () =>
    logout.mutate(undefined, {
      onSettled: () => {
        toast('Signed out', 'info');
        router.push('/');
      },
    });

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-white">
          <CoinIcon className="size-7" />
          Coin<span className="text-amber-300">Vault</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((item) => (
            <NavLink key={item.href} href={item.href} active={isActive(item.href)}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/coins"
                title="Your Gold Coin balance - click to buy more"
                className="flex items-center gap-2 rounded-full bg-amber-400/10 py-1.5 pl-2 pr-3 text-sm font-bold text-amber-200 ring-1 ring-amber-400/30 transition hover:bg-amber-400/20"
              >
                <CoinIcon />
                <span className="tabular-nums">{wallet.data ? formatCoins(wallet.data.balance) : '...'}</span>
                <span className="sr-only">Gold Coins - buy more</span>
                <span
                  className="ml-1 hidden rounded-full bg-amber-400 px-1.5 text-xs leading-5 text-zinc-950 sm:inline"
                  aria-hidden="true"
                >
                  +
                </span>
              </Link>
              <div className="hidden text-right text-xs leading-tight sm:block">
                <div className="font-semibold text-zinc-200">{user.name}</div>
                <button className="text-zinc-400 hover:text-white" onClick={signOut}>
                  Sign out
                </button>
              </div>
            </>
          ) : (
            !isLoading && (
              <>
                <Link href="/login" className="text-sm font-semibold text-zinc-300 hover:text-white">
                  Sign in
                </Link>
                <ButtonLink href="/register" className="py-1.5">
                  Sign up
                </ButtonLink>
              </>
            )
          )}
        </div>
      </div>

      {/* Mobile navigation */}
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden" aria-label="Main (mobile)">
        {links.map((item) => (
          <NavLink key={item.href} href={item.href} active={isActive(item.href)}>
            {item.label}
          </NavLink>
        ))}
        {user && (
          <button className="ml-auto whitespace-nowrap px-3 py-1.5 text-sm text-zinc-400" onClick={signOut}>
            Sign out
          </button>
        )}
      </nav>
    </header>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition',
        active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white',
      )}
    >
      {children}
    </Link>
  );
}
