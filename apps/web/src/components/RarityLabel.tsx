import { CATEGORY_SINGULAR, RARITY_STYLES } from '@/lib/format';
import type { ProductCategory, Rarity } from '@/lib/types';
import { cx } from './ui';

/** e.g. "LEGENDARY SKIN", coloured by rarity. */
export function RarityLabel({
  rarity,
  category,
  size = 'sm',
}: {
  rarity: Rarity;
  category?: ProductCategory;
  size?: 'sm' | 'md';
}) {
  const style = RARITY_STYLES[rarity];
  return (
    <p
      className={cx(
        'font-semibold uppercase',
        size === 'sm' ? 'text-xs tracking-wide' : 'text-sm tracking-widest',
        style.text,
      )}
    >
      {style.label}
      {category && ` ${CATEGORY_SINGULAR[category]}`}
    </p>
  );
}
