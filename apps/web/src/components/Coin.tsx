import { useId } from 'react';
import { formatCoins } from '@/lib/format';
import { cx } from './ui';

export function CoinIcon({ className = 'size-5' }: { className?: string }) {
  const gradientId = `coin-${useId().replace(/:/g, '')}`;
  return (
    <svg className={cx('shrink-0', className)} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.5" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill={`url(#${gradientId})`} />
      <circle cx="12" cy="12" r="8" fill="none" stroke="#fef3c7" strokeOpacity="0.6" strokeWidth="1.2" />
      <path
        d="M12 7.5l1.3 2.9 3.2.3-2.4 2.1.7 3.1L12 14.3l-2.8 1.6.7-3.1-2.4-2.1 3.2-.3z"
        fill="#fffbeb"
        fillOpacity="0.9"
      />
    </svg>
  );
}

/** A coin amount with the coin icon, e.g. for prices and balances. */
export function Coins({
  amount,
  className,
  iconClassName,
}: {
  amount: number;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 font-semibold tabular-nums', className)}>
      <CoinIcon className={iconClassName} />
      {formatCoins(amount)}
    </span>
  );
}
