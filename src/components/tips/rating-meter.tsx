export function RatingMeter({
  value,
  label,
  mobileLabel,
  prominent = false,
  compact = false,
}: {
  value: number;
  label: string;
  mobileLabel?: string;
  prominent?: boolean;
  compact?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const labelNode = mobileLabel ? (
    <>
      <span className="sm:hidden">{mobileLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </>
  ) : (
    label
  );

  return (
    <div className={compact ? 'space-y-1 sm:space-y-1.5' : 'space-y-1.5'}>
      <div className="flex items-baseline justify-between gap-1.5 sm:gap-2">
        <span
          className={[
            'text-[var(--text-muted)] truncate',
            compact ? 'text-[11px] sm:text-xs' : 'text-xs',
          ].join(' ')}
        >
          {labelNode}
        </span>
        <span
          className={[
            'font-semibold text-[var(--text)] tabular-nums shrink-0',
            prominent
              ? 'text-base sm:text-xl leading-none'
              : compact
                ? 'text-[13px] sm:text-xs leading-none'
                : 'text-xs',
          ].join(' ')}
        >
          {clamped}
        </span>
      </div>
      <div
        className="h-1.5 w-full rounded-full bg-[var(--surface-muted)] overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
