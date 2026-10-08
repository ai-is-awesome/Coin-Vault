import type { ProductCategory, Rarity } from './types';

const coinFormat = new Intl.NumberFormat('en-US');

export const formatCoins = (coins: number) => coinFormat.format(coins);
export const formatNumber = (value: number) => coinFormat.format(value);

export function formatMoney(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  SKIN: 'Skins',
  EMOTE: 'Emotes',
  BATTLE_PASS: 'Battle Passes',
};

export const CATEGORY_SINGULAR: Record<ProductCategory, string> = {
  SKIN: 'Skin',
  EMOTE: 'Emote',
  BATTLE_PASS: 'Battle Pass',
};

export const RARITY_STYLES: Record<Rarity, { label: string; text: string; ring: string; gradient: string }> = {
  COMMON: {
    label: 'Common',
    text: 'text-zinc-300',
    ring: 'ring-zinc-500/40',
    gradient: 'from-zinc-600 via-zinc-700 to-zinc-900',
  },
  RARE: {
    label: 'Rare',
    text: 'text-sky-300',
    ring: 'ring-sky-400/40',
    gradient: 'from-sky-500 via-blue-700 to-indigo-950',
  },
  EPIC: {
    label: 'Epic',
    text: 'text-fuchsia-300',
    ring: 'ring-fuchsia-400/40',
    gradient: 'from-fuchsia-500 via-purple-700 to-violet-950',
  },
  LEGENDARY: {
    label: 'Legendary',
    text: 'text-amber-300',
    ring: 'ring-amber-400/50',
    gradient: 'from-amber-400 via-orange-600 to-rose-900',
  },
};
