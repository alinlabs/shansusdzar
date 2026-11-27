import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
} from 'react';
import {
  formatDimensionParts,
  parseDimensionParts,
  sanitizeDimensionColumnInput,
  type DimensionParts,
} from '../../lib/dimension-format';

export interface DimensionInputProps {
  id?: string;
  value?: string;
  defaultValue?: string;
  hasError?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  onValueChange?: (nextDimension: string) => void;
}

const COLUMN_META: ReadonlyArray<{
  index: 0 | 1 | 2;
  shortLabel: string;
  fullLabel: string;
  suffixId: string;
}> = [
  { index: 0, shortLabel: 'P', fullLabel: 'Panjang (cm)', suffixId: '' },
  { index: 1, shortLabel: 'L', fullLabel: 'Lebar (cm)', suffixId: '-l' },
  { index: 2, shortLabel: 'T', fullLabel: 'Tinggi (cm)', suffixId: '-t' },
];

export function DimensionInput({
  id,
  value,
  defaultValue,
  hasError = false,
  disabled = false,
  required = false,
  className = '',
  onValueChange,
}: DimensionInputProps) {
  const [parts, setParts] = useState<DimensionParts>(() =>
    parseDimensionParts(value ?? defaultValue)
  );
  const lastEmittedRef = useRef<string | null>(null);

  useEffect(() => {
    if (value === undefined) return;
    if (value === lastEmittedRef.current) {
      return;
    }
    const parsed = parseDimensionParts(value);
    setParts(parsed);
  }, [value]);

  const trimmedExternal = String(value ?? '').trim();
  const hasNonNumericNote =
    trimmedExternal.length > 0 &&
    parseDimensionParts(trimmedExternal).every((part) => part.length === 0) &&
    parts.every((part) => part.length === 0);

  const commitParts = (nextParts: DimensionParts) => {
    setParts(nextParts);
    const formatted = formatDimensionParts(nextParts);
    lastEmittedRef.current = formatted;
    onValueChange?.(formatted);
  };

  const handleColumnChange =
    (index: 0 | 1 | 2) => (event: ChangeEvent<HTMLInputElement>) => {
      const cleaned = sanitizeDimensionColumnInput(event.target.value);
      const nextParts: DimensionParts = [...parts] as DimensionParts;
      nextParts[index] = cleaned;
      commitParts(nextParts);
    };

  const handleColumnPaste =
    (index: 0 | 1 | 2) => (event: ClipboardEvent<HTMLInputElement>) => {
      const pasted = event.clipboardData?.getData('text') ?? '';
      if (!/[x×*]/i.test(pasted)) return;

      const parsedPasted = parseDimensionParts(pasted);
      if (parsedPasted.filter(Boolean).length >= 2) {
        event.preventDefault();
        commitParts(parsedPasted);
        return;
      }

      // Single value pasted with trailing "cm" inside one box
      const singleCleaned = sanitizeDimensionColumnInput(pasted);
      if (singleCleaned) {
        event.preventDefault();
        const nextParts: DimensionParts = [...parts] as DimensionParts;
        nextParts[index] = singleCleaned;
        commitParts(nextParts);
      }
    };

  const handleColumnBlur = () => {
    const normalizedParts = parseDimensionParts(formatDimensionParts(parts));
    // Preserve sparse positioning if user left middle column empty intentionally
    if (
      parts.some((p) => p.endsWith('.')) &&
      normalizedParts.filter(Boolean).length === parts.filter(Boolean).length
    ) {
      commitParts(normalizedParts);
    }
  };

  const borderClass = hasError
    ? 'border-[var(--danger)] focus-within:border-[var(--danger)]'
    : 'border-[var(--border)] hover:border-[var(--border-strong)] focus-within:border-[var(--border-strong)]';

  return (
    <div className={`w-full ${className}`}>
      <div
        role="group"
        aria-label="Dimensi dalam sentimeter (Panjang x Lebar x Tinggi)"
        className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 sm:gap-1.5"
      >
        {COLUMN_META.map((col, idx) => {
          const inputId = id ? `${id}${col.suffixId}` : undefined;
          return (
            <div key={col.shortLabel} className="contents">
              <div
                className={`min-w-0 inline-flex items-stretch h-11 rounded-[var(--radius-md)] border bg-[var(--surface)] transition-colors duration-150 ${
                  disabled ? 'opacity-55 cursor-not-allowed' : ''
                } ${borderClass}`}
              >
                <span
                  aria-hidden="true"
                  title={col.fullLabel}
                  className="inline-flex items-center justify-center px-1.5 sm:px-2 border-r border-[var(--border)] bg-[var(--surface-muted)]/55 text-[11px] font-semibold text-[var(--text-muted)] select-none shrink-0 rounded-l-[calc(var(--radius-md)-1px)]"
                >
                  {col.shortLabel}
                </span>
                <input
                  id={inputId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  disabled={disabled}
                  required={required && col.index === 0}
                  aria-label={col.fullLabel}
                  aria-invalid={hasError || undefined}
                  placeholder="00"
                  value={parts[col.index]}
                  onChange={handleColumnChange(col.index)}
                  onPaste={handleColumnPaste(col.index)}
                  onBlur={handleColumnBlur}
                  className="flex-1 min-w-0 w-full h-full bg-transparent px-1.5 sm:px-2 py-0 text-center text-base md:text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] tabular-nums outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
                />
              </div>
              {idx < COLUMN_META.length - 1 && (
                <span
                  aria-hidden="true"
                  className="text-xs font-medium text-[var(--text-subtle)] select-none px-0.5"
                >
                  x
                </span>
              )}
            </div>
          );
        })}
      </div>

      {hasNonNumericNote && (
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
          Catatan tersimpan: &ldquo;{trimmedExternal}&rdquo;
        </p>
      )}
    </div>
  );
}
