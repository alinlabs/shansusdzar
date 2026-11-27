import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react';
import {
  formatNominalNumber,
  formatNominalWithCaret,
  parseNominalInput,
} from '../../lib/currency-input';

export interface CurrencyInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'defaultValue' | 'onChange'
  > {
  value?: number | null;
  defaultValue?: number | null;
  hasError?: boolean;
  /** Visual prefix rendered in the left slot (default: "Rp") */
  currencyLabel?: string;
  /** When true, numeric 0 displays as empty string with placeholder (ideal for new invoice/ledger inputs) */
  zeroAsEmpty?: boolean;
  /** Value emitted when field is cleared (default: 0) */
  emptyValue?: number | null;
  onValueChange?: (numericValue: number) => void;
  onNullableValueChange?: (numericValue: number | null) => void;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  {
    value,
    defaultValue,
    hasError = false,
    currencyLabel = 'Rp',
    zeroAsEmpty = false,
    emptyValue = 0,
    disabled = false,
    className = '',
    placeholder = '0',
    onValueChange,
    onNullableValueChange,
    onKeyDown,
    onPaste,
    onBlur,
    ...props
  },
  ref
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const userClearedRef = useRef(false);

  const [displayValue, setDisplayValue] = useState<string>(() =>
    formatNominalNumber(value ?? defaultValue, { zeroAsEmpty })
  );

  const setMergedRef = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  useEffect(() => {
    if (value === undefined) return;
    if ((value === null || value === 0) && userClearedRef.current) {
      return;
    }
    const nextFormatted = formatNominalNumber(value, { zeroAsEmpty });
    if (nextFormatted !== displayValue) {
      setDisplayValue(nextFormatted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, zeroAsEmpty]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    const caret = pendingCaretRef.current;
    if (el && caret !== null && document.activeElement === el) {
      pendingCaretRef.current = null;
      try {
        el.setSelectionRange(caret, caret);
      } catch {
        // Ignore selection errors
      }
    }
  }, [displayValue]);

  const emitNumeric = (numericVal: number | null) => {
    userClearedRef.current = numericVal === null;
    onNullableValueChange?.(numericVal);
    if (onValueChange) {
      const resolved = numericVal === null ? (emptyValue ?? 0) : numericVal;
      onValueChange(resolved);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value;
    const rawCaret = event.target.selectionStart ?? rawValue.length;

    const result = formatNominalWithCaret({ rawValue, rawCaret });
    pendingCaretRef.current = result.caret;
    setDisplayValue(result.formatted);
    emitNumeric(result.numericValue);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const el = inputRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start !== end) return;

    // Backspace immediately after a '.' thousand separator deletes the digit before '.'
    if (event.key === 'Backspace' && start > 1 && displayValue[start - 1] === '.') {
      event.preventDefault();
      const editedRaw = displayValue.slice(0, start - 2) + displayValue.slice(start);
      const result = formatNominalWithCaret({
        rawValue: editedRaw,
        rawCaret: Math.max(0, start - 2),
      });
      pendingCaretRef.current = result.caret;
      setDisplayValue(result.formatted);
      emitNumeric(result.numericValue);
    } else if (event.key === 'Delete' && start < displayValue.length && displayValue[start] === '.') {
      event.preventDefault();
      const editedRaw = displayValue.slice(0, start) + displayValue.slice(start + 2);
      const result = formatNominalWithCaret({
        rawValue: editedRaw,
        rawCaret: start,
      });
      pendingCaretRef.current = result.caret;
      setDisplayValue(result.formatted);
      emitNumeric(result.numericValue);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    onPaste?.(event);
    if (event.defaultPrevented) return;

    const pasted = event.clipboardData?.getData('text') ?? '';
    const digits = pasted.replace(/\D/g, '');
    event.preventDefault();

    const el = inputRef.current;
    const start = el?.selectionStart ?? displayValue.length;
    const end = el?.selectionEnd ?? displayValue.length;

    const isFullReplace =
      !displayValue || (start === 0 && end === displayValue.length) || /rp/i.test(pasted);

    if (isFullReplace) {
      const parsed = parseNominalInput(digits);
      pendingCaretRef.current = parsed.formatted.length;
      setDisplayValue(parsed.formatted);
      emitNumeric(parsed.numericValue);
      return;
    }

    const mergedRaw = displayValue.slice(0, start) + digits + displayValue.slice(end);
    const result = formatNominalWithCaret({
      rawValue: mergedRaw,
      rawCaret: start + digits.length,
    });
    pendingCaretRef.current = result.caret;
    setDisplayValue(result.formatted);
    emitNumeric(result.numericValue);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    userClearedRef.current = false;
    if (displayValue === '' && !zeroAsEmpty && emptyValue === 0 && value === 0) {
      setDisplayValue('0');
    }
    onBlur?.(event);
  };

  const borderClass = hasError
    ? 'border-[var(--danger)] focus-within:border-[var(--danger)]'
    : 'border-[var(--border)] hover:border-[var(--border-strong)] focus-within:border-[var(--border-strong)]';

  const widthClass = /\bw-/.test(className) ? '' : 'w-full';
  const heightClass = /\b(?:[a-z]+:)?(?:min-)?h-\S+/.test(className) ? '' : 'h-11';

  return (
    <div
      className={`${widthClass} ${heightClass} inline-flex items-stretch rounded-[var(--radius-md)] border bg-[var(--surface)] transition-colors duration-150 ${
        disabled ? 'opacity-55 cursor-not-allowed' : ''
      } ${borderClass} ${className}`}
    >
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center px-3 border-r border-[var(--border)] bg-[var(--surface-muted)]/55 text-xs font-semibold text-[var(--text-muted)] select-none shrink-0 rounded-l-[calc(var(--radius-md)-1px)]"
      >
        {currencyLabel}
      </span>
      <input
        ref={setMergedRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        aria-invalid={hasError || undefined}
        value={displayValue}
        placeholder={placeholder}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={handleBlur}
        className="flex-1 min-w-0 w-full h-full bg-transparent px-3 py-0 text-right text-base md:text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] tabular-nums outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
        {...props}
      />
    </div>
  );
});
