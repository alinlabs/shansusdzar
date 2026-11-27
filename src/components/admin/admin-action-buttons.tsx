import { createContext, useContext, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

const AdminHeaderActionsContext = createContext(false);

export function AdminHeaderActionsScope({ children }: { children: ReactNode }) {
  return (
    <AdminHeaderActionsContext.Provider value={true}>
      {children}
    </AdminHeaderActionsContext.Provider>
  );
}

export type AdminActionVariant = 'default' | 'primary' | 'danger' | 'success' | 'ghost';
export type AdminActionSize = 'sm' | 'md';

const ACTION_VARIANT_CLASSES: Record<AdminActionVariant, string> = {
  default:
    'border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)]',
  primary:
    'border border-transparent bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]',
  danger:
    'border border-[var(--danger-border)] bg-[var(--surface)] text-[var(--danger)] hover:bg-[var(--danger-surface)]',
  success:
    'border border-[var(--border)] bg-[var(--surface)] text-[var(--success)] hover:bg-[var(--surface-muted)]',
  ghost:
    'border border-transparent bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]',
};

function getActionClasses({
  variant = 'default',
  size = 'sm',
  iconOnly = false,
  hideLabelOnMobile = true,
  hasMobileLabel = false,
  inAdminHeader = false,
  className = '',
}: {
  variant?: AdminActionVariant;
  size?: AdminActionSize;
  iconOnly?: boolean;
  hideLabelOnMobile?: boolean;
  hasMobileLabel?: boolean;
  inAdminHeader?: boolean;
  className?: string;
}): string {
  const desktopH = size === 'md' ? 'sm:h-9' : 'sm:h-8';
  const mobileSquare = size === 'md' ? 'size-10' : 'size-9';
  const desktopSquare = size === 'md' ? 'sm:size-9' : 'sm:size-8';

  const isMobileIconOnlyInHeader =
    inAdminHeader && variant !== 'primary' && (iconOnly || (hideLabelOnMobile && !hasMobileLabel));

  if (isMobileIconOnlyInHeader) {
    const desktopVariantClass = ACTION_VARIANT_CLASSES[variant]
      .split(' ')
      .map((cls) => `sm:${cls}`)
      .join(' ');
    const desktopSizingClass = iconOnly
      ? `${desktopSquare} sm:p-0`
      : `sm:w-auto ${desktopH} sm:px-2.5 sm:gap-1.5`;

    return [
      'inline-flex items-center justify-center text-xs font-medium',
      'transition-colors duration-150 whitespace-nowrap cursor-pointer shrink-0',
      'disabled:opacity-45 disabled:pointer-events-none',
      'w-7 h-9 p-0 border-0 bg-transparent shadow-none rounded-none text-[var(--text)] hover:text-[var(--text-muted)] [&_svg]:size-4 sm:[&_svg]:size-3.5',
      'sm:rounded-[var(--radius-md)]',
      desktopVariantClass,
      desktopSizingClass,
      className,
    ]
      .filter(Boolean)
      .join(' ');
  }

  const sizingClass = iconOnly
    ? `${mobileSquare} ${desktopSquare} p-0 shrink-0`
    : hideLabelOnMobile && !hasMobileLabel
      ? `${mobileSquare} sm:w-auto ${desktopH} px-0 sm:px-2.5 gap-1.5 shrink-0`
      : `min-h-9 ${desktopH} px-2.5 gap-1.5 shrink-0`;

  return [
    'inline-flex items-center justify-center rounded-[var(--radius-md)] text-xs font-medium',
    'transition-colors duration-150 whitespace-nowrap cursor-pointer',
    'disabled:opacity-45 disabled:pointer-events-none',
    ACTION_VARIANT_CLASSES[variant],
    sizingClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

function ActionLabel({
  label,
  mobileLabel,
  iconOnly,
  hideLabelOnMobile,
}: {
  label: string;
  mobileLabel?: string;
  iconOnly: boolean;
  hideLabelOnMobile: boolean;
}) {
  if (iconOnly) return null;
  if (mobileLabel) {
    return (
      <>
        <span className="sm:hidden">{mobileLabel}</span>
        <span className="hidden sm:inline">{label}</span>
      </>
    );
  }
  if (hideLabelOnMobile) {
    return <span className="hidden sm:inline">{label}</span>;
  }
  return <span>{label}</span>;
}

export interface AdminActionButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: ReactNode;
  label: string;
  mobileLabel?: string;
  iconOnly?: boolean;
  hideLabelOnMobile?: boolean;
  variant?: AdminActionVariant;
  size?: AdminActionSize;
}

export function AdminActionButton({
  icon,
  label,
  mobileLabel,
  iconOnly = false,
  hideLabelOnMobile = true,
  variant = 'default',
  size = 'sm',
  type = 'button',
  className = '',
  'aria-label': ariaLabel,
  title,
  ...props
}: AdminActionButtonProps) {
  const inAdminHeader = useContext(AdminHeaderActionsContext);
  return (
    <button
      type={type}
      aria-label={ariaLabel ?? label}
      title={title ?? label}
      className={getActionClasses({
        variant,
        size,
        iconOnly,
        hideLabelOnMobile,
        hasMobileLabel: Boolean(mobileLabel),
        inAdminHeader,
        className,
      })}
      {...props}
    >
      <span className="shrink-0 inline-flex items-center justify-center" aria-hidden="true">
        {icon}
      </span>
      <ActionLabel
        label={label}
        mobileLabel={mobileLabel}
        iconOnly={iconOnly}
        hideLabelOnMobile={hideLabelOnMobile}
      />
    </button>
  );
}

export interface AdminActionLinkProps extends Omit<LinkProps, 'children'> {
  icon: ReactNode;
  label: string;
  mobileLabel?: string;
  iconOnly?: boolean;
  hideLabelOnMobile?: boolean;
  variant?: AdminActionVariant;
  size?: AdminActionSize;
}

export function AdminActionLink({
  icon,
  label,
  mobileLabel,
  iconOnly = false,
  hideLabelOnMobile = true,
  variant = 'default',
  size = 'sm',
  className = '',
  'aria-label': ariaLabel,
  title,
  ...props
}: AdminActionLinkProps) {
  const inAdminHeader = useContext(AdminHeaderActionsContext);
  return (
    <Link
      aria-label={ariaLabel ?? label}
      title={title ?? label}
      className={getActionClasses({
        variant,
        size,
        iconOnly,
        hideLabelOnMobile,
        hasMobileLabel: Boolean(mobileLabel),
        inAdminHeader,
        className,
      })}
      {...props}
    >
      <span className="shrink-0 inline-flex items-center justify-center" aria-hidden="true">
        {icon}
      </span>
      <ActionLabel
        label={label}
        mobileLabel={mobileLabel}
        iconOnly={iconOnly}
        hideLabelOnMobile={hideLabelOnMobile}
      />
    </Link>
  );
}

export interface AdminExternalActionLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> {
  icon: ReactNode;
  label: string;
  mobileLabel?: string;
  iconOnly?: boolean;
  hideLabelOnMobile?: boolean;
  variant?: AdminActionVariant;
  size?: AdminActionSize;
}

export function AdminExternalActionLink({
  icon,
  label,
  mobileLabel,
  iconOnly = false,
  hideLabelOnMobile = true,
  variant = 'default',
  size = 'sm',
  className = '',
  'aria-label': ariaLabel,
  title,
  ...props
}: AdminExternalActionLinkProps) {
  const inAdminHeader = useContext(AdminHeaderActionsContext);
  return (
    <a
      aria-label={ariaLabel ?? label}
      title={title ?? label}
      className={getActionClasses({
        variant,
        size,
        iconOnly,
        hideLabelOnMobile,
        hasMobileLabel: Boolean(mobileLabel),
        inAdminHeader,
        className,
      })}
      {...props}
    >
      <span className="shrink-0 inline-flex items-center justify-center" aria-hidden="true">
        {icon}
      </span>
      <ActionLabel
        label={label}
        mobileLabel={mobileLabel}
        iconOnly={iconOnly}
        hideLabelOnMobile={hideLabelOnMobile}
      />
    </a>
  );
}
