import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent)] text-[var(--accent-contrast)] border border-transparent hover:bg-[var(--accent-hover)]',
  secondary:
    'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)]',
  ghost:
    'bg-transparent text-[var(--text)] border border-transparent hover:bg-[var(--surface-muted)]',
  danger:
    'bg-[var(--danger-surface)] text-[var(--danger)] border border-[var(--danger-border)] hover:opacity-90',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-4 py-2 text-xs',
  md: 'min-h-11 px-5 py-2.5 text-sm',
  lg: 'min-h-12 px-6 py-3 text-sm',
};

export function getButtonClassName(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  fullWidth = false,
  className = ''
): string {
  return [
    'inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius-md)]',
    'transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer',
    'disabled:opacity-50 disabled:pointer-events-none',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  type = 'button',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={getButtonClassName(variant, size, fullWidth, className)}
      {...props}
    >
      {children}
    </button>
  );
}

export interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link className={getButtonClassName(variant, size, fullWidth, className)} {...props}>
      {children}
    </Link>
  );
}

export interface ExternalLinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
}

export function ExternalLinkButton({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...props
}: ExternalLinkButtonProps) {
  return (
    <a className={getButtonClassName(variant, size, fullWidth, className)} {...props}>
      {children}
    </a>
  );
}
