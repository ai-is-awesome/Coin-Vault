import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Coin Vault', template: '%s · Coin Vault' },
  description: 'Buy Gold Coins and spend them on skins, emotes and battle passes.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body className="font-sans text-zinc-100 antialiased">
        <Providers>
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-zinc-600">
            Coin Vault demo · Payments are simulated - no real money is charged.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
