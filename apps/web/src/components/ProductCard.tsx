import Link from 'next/link';
import { RARITY_STYLES } from '@/lib/format';
import type { Product } from '@/lib/types';
import { Coins } from './Coin';
import { ProductArt } from './ProductArt';
import { RarityLabel } from './RarityLabel';
import { Badge, Button, cx } from './ui';

/** Catalog tile. Buying is delegated to the parent so one dialog serves the whole grid. */
export function ProductCard({ product, onBuy }: { product: Product; onBuy: (product: Product) => void }) {
  return (
    <article
      className={cx(
        'group flex flex-col overflow-hidden rounded-2xl bg-zinc-900 ring-1 transition hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/50',
        RARITY_STYLES[product.rarity].ring,
      )}
    >
      <Link href={`/products/${product.id}`} className="relative block" tabIndex={-1} aria-hidden="true">
        <ProductArt {...product} className="transition duration-300 group-hover:scale-[1.03]" />
        {product.owned && (
          <Badge className="absolute left-3 top-3 bg-emerald-500/90 text-white ring-emerald-300/50">Owned</Badge>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <RarityLabel rarity={product.rarity} category={product.category} />
          <Link href={`/products/${product.id}`} className="mt-0.5 block font-bold text-white hover:text-amber-200">
            {product.name}
          </Link>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <Coins amount={product.priceCoins} className="text-amber-200" />
          {product.owned ? (
            <span className="text-sm font-medium text-emerald-400">In inventory</span>
          ) : (
            <Button className="px-3 py-1.5" onClick={() => onBuy(product)} aria-label={`Buy ${product.name}`}>
              Buy
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
