import type { ElementType, ReactNode } from 'react';

interface SettingsSectionProps {
  id: string;
  icon: ElementType;
  title: string;
  description: string;
  badge?: string;
  children: ReactNode;
}

export function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  badge,
  children,
}: SettingsSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-24 pt-7 border-t border-[var(--border)] first:pt-0 first:border-t-0 space-y-4 sm:space-y-5"
    >
      <div className="flex items-start gap-3 min-w-0">
        <Icon className="size-4.5 text-[var(--text)] shrink-0 mt-1" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2
              id={`${id}-heading`}
              className="text-base sm:text-lg font-semibold tracking-tight text-[var(--text)]"
            >
              {title}
            </h2>
            {badge && (
              <span className="text-xs text-[var(--text-subtle)]">
                <span aria-hidden="true">· </span>
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <div>{children}</div>
    </section>
  );
}

export { SettingsSection as SettingsSectionCard };

interface PreferenceSwitchRowProps {
  id: string;
  icon?: ElementType;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  statusText?: string;
}

export function PreferenceSwitchRow({
  id,
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  disabled = false,
  statusText,
}: PreferenceSwitchRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 min-h-[56px]">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <Icon
            className="size-4 text-[var(--text-muted)] shrink-0 mt-1"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <label
              htmlFor={id}
              className="text-sm font-medium text-[var(--text)] leading-snug cursor-pointer"
            >
              {title}
            </label>
            {statusText && (
              <span className="text-[11px] text-[var(--text-subtle)]">
                <span aria-hidden="true">· </span>
                {statusText}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-muted)] leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-0.5',
          checked
            ? 'bg-[var(--accent)] border-transparent'
            : 'bg-[var(--surface-muted)] border-[var(--border-strong)]',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'pointer-events-none inline-block size-4.5 rounded-full shadow-[var(--shadow-sm)] transition-transform duration-150',
            checked
              ? 'translate-x-5.5 bg-[var(--accent-contrast)]'
              : 'translate-x-0.5 bg-[var(--surface)] border border-[var(--border)]',
          ].join(' ')}
        />
      </button>
    </div>
  );
}
