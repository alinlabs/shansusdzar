import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type IconButtonVariant = 'default' | 'subtle' | 'ghost';

const VARIANT_STYLES: Record<IconButtonVariant, string> = {
  default:
    'border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)]',
  subtle:
    'border border-transparent bg-[var(--surface-muted)] text-[var(--text)] hover:border-[var(--border)]',
  ghost:
    'border border-transparent bg-transparent text-[var(--text)] hover:bg-[var(--surface-muted)]',
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: IconButtonVariant;
  children: ReactNode;
}

export function IconButton({
  variant = 'default',
  type = 'button',
  className = '',
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={[
        'inline-flex items-center justify-center min-h-10 min-w-10 rounded-[var(--radius-md)]',
        'transition-colors duration-150 shrink-0 cursor-pointer',
        'disabled:opacity-45 disabled:pointer-events-none',
        VARIANT_STYLES[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
