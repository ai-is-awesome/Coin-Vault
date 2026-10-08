import Link from 'next/link';
import {
  cloneElement,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ---------- Buttons ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-linear-to-b from-amber-300 to-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20 hover:from-amber-200 hover:to-amber-400',
  secondary: 'bg-zinc-800 text-zinc-100 ring-1 ring-inset ring-zinc-700 hover:bg-zinc-700',
  ghost: 'text-zinc-300 hover:bg-zinc-800 hover:text-white',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
};

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export function Button({
  variant = 'primary',
  loading,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      type={type}
      className={cx(BUTTON_BASE, VARIANTS[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'primary',
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cx(BUTTON_BASE, VARIANTS[variant], className)}>
      {children}
    </Link>
  );
}

// ---------- Feedback ----------

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function PageSpinner() {
  return (
    <div className="flex justify-center py-24 text-amber-300" role="status" aria-label="Loading">
      <Spinner className="size-8" />
    </div>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'bg-rose-500/10 text-rose-300 ring-rose-500/30',
    success: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
    info: 'bg-sky-500/10 text-sky-300 ring-sky-500/30',
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-lg px-3 py-2 text-sm ring-1', styles)}>
      {children}
    </div>
  );
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONES = {
  success: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  danger: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  neutral: 'bg-zinc-500/15 text-zinc-300 ring-zinc-500/30',
};

export function StatusBadge({ tone, children }: { tone: keyof typeof STATUS_TONES; children: ReactNode }) {
  return <Badge className={STATUS_TONES[tone]}>{children}</Badge>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="px-6 py-16 text-center">
      <p className="text-lg font-semibold text-white">{title}</p>
      {children && <div className="mt-2 text-zinc-400">{children}</div>}
    </Card>
  );
}

// ---------- Layout ----------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl bg-zinc-900/80 ring-1 ring-zinc-800', className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-zinc-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

// ---------- Forms ----------

type FieldControl = ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>;

/** Label + control + message, wired up for screen readers (label `for`, `aria-invalid`, `aria-describedby`). */
export function Field({ label, error, children }: { label: string; error?: string; children: FieldControl }) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-300">
        {label}
      </label>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? messageId : undefined,
      })}
      {error && (
        <p id={messageId} className="mt-1 text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL =
  'w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-white ring-1 ring-inset ring-zinc-700 ' +
  'placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-400 aria-invalid:ring-rose-500';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(CONTROL, className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(CONTROL, 'pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(CONTROL, className)} {...props} />;
}

/** A row of mutually exclusive toggle buttons (filters, view switchers). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-900 p-1 ring-1 ring-zinc-800"
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cx(
            'whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium transition',
            value === option.value ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </Button>
      <span className="text-zinc-400">
        Page {page} of {totalPages}
      </span>
      <Button variant="secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </nav>
  );
}

// ---------- Tables ----------

export interface Column {
  label: string;
  align?: 'left' | 'right';
  /** Visually hidden header (e.g. for an actions column), still announced by screen readers. */
  hidden?: boolean;
}

export function DataTable({ columns, children }: { columns: Column[]; children: ReactNode }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            {columns.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={cx('px-4 py-3 font-medium', column.align === 'right' && 'text-right')}
              >
                {column.hidden ? <span className="sr-only">{column.label}</span> : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">{children}</tbody>
      </table>
    </Card>
  );
}

export function Td({
  align,
  className,
  children,
}: {
  align?: 'left' | 'right';
  className?: string;
  children?: ReactNode;
}) {
  return <td className={cx('px-4 py-3', align === 'right' && 'text-right', className)}>{children}</td>;
}
