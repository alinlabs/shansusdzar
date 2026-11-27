import { formatRupiahSigned, splitAccountingRupiahDisplay } from '../../../lib/finance-utils';

interface FormalCurrencyCellProps {
  amount: number | null | undefined;
  fallback?: string;
  className?: string;
}

export function FormalCurrencyCell({
  amount,
  fallback = '—',
  className,
}: FormalCurrencyCellProps) {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return <span className="block text-right text-[#5a5a5a] tabular-nums">{fallback}</span>;
  }

  const formatted = formatRupiahSigned(amount);
  const split = splitAccountingRupiahDisplay(formatted);
  if (!split) {
    return <span className="block text-right tabular-nums">{formatted}</span>;
  }

  return (
    <span
      className={`flex items-baseline justify-between gap-2 tabular-nums whitespace-nowrap ${className ?? ''}`}
    >
      <span className="text-left">{split.symbol}</span>
      <span className="text-right">{split.amount}</span>
    </span>
  );
}
