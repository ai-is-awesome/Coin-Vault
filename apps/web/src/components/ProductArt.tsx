import type { ReactNode } from 'react';
import { RARITY_STYLES } from '@/lib/format';
import type { ProductCategory, Rarity } from '@/lib/types';
import { cx } from './ui';

const ICONS: Record<ProductCategory, ReactNode> = {
  // Helmeted hero silhouette
  SKIN: (
    <path d="M32 6c-9 0-16 7-16 16v6c0 2 1 4 3 5l1 9c0 3 3 6 6 6h12c3 0 6-3 6-6l1-9c2-1 3-3 3-5v-6c0-9-7-16-16-16Zm-9 18h18a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3H23a3 3 0 0 1-3-3v-1a3 3 0 0 1 3-3Zm-7 26c-3 1-6 4-6 8h44c0-4-3-7-6-8l-6-1c-2 2-5 3-8 3h-4c-3 0-6-1-8-3Z" />
  ),
  // Grinning face with a raised hand
  EMOTE: (
    <path d="M28 8a20 20 0 1 0 0 40 20 20 0 0 0 0-40Zm-7 13a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm14 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-17 12h20a10 10 0 0 1-20 0Zm30-21 4-6a3 3 0 0 1 5 3l-3 5 5-4a3 3 0 0 1 4 4l-8 9c-2 3-6 4-9 2Z" />
  ),
  // Ticket with a star
  BATTLE_PASS: (
    <path d="M10 16a4 4 0 0 1 4-4h36a4 4 0 0 1 4 4v8a6 6 0 0 0 0 12v8a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4v-8a6 6 0 0 0 0-12Zm22 3-3 7-7 .7 5.3 4.8L25.8 39 32 35.4l6.2 3.6-1.5-7.5 5.3-4.8-7-.7Z" />
  ),
};

/** Generated product artwork (rarity gradient + category glyph), or the product's image if it has one. */
export function ProductArt({
  name,
  category,
  rarity,
  imageUrl,
  className,
}: {
  name: string;
  category: ProductCategory;
  rarity: Rarity;
  imageUrl?: string | null;
  className?: string;
}) {
  const style = RARITY_STYLES[rarity];
  return (
    <div className={cx('relative aspect-square overflow-hidden bg-linear-to-br', style.gradient, className)}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-provided URLs
        <img src={imageUrl} alt={name} className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
          <div className="absolute -bottom-6 -right-6 size-32 rounded-full bg-white/10 blur-2xl" />
          <svg
            viewBox="0 0 64 64"
            className="absolute inset-0 m-auto size-1/2 fill-white/85 drop-shadow-[0_6px_12px_rgba(0,0,0,0.35)]"
            aria-hidden="true"
          >
            {ICONS[category]}
          </svg>
          <span className="sr-only">{name}</span>
        </>
      )}
    </div>
  );
}
