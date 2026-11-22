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
  formatPhoneWithCaret,
  normalizePastedPhone,
  parseIndonesianPhoneInput,
  type PhoneNormalizationInfo,
} from '../../lib/phone-format';

export type PhoneValueFormat = 'e164' | 'digits' | 'display';

export interface PhoneInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange'> {
  value?: string;
  defaultValue?: string;
  hasError?: boolean;
  /** Emitted value shape: 'e164' (+6281234567890), 'digits' (6281234567890), or 'display' (+62 812-3456-7890) */
  valueFormat?: PhoneValueFormat;
  onValueChange?: (normalizedValue: string, info: PhoneNormalizationInfo) => void;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

function pickEmittedValue(
  info: Pick<PhoneNormalizationInfo, 'e164' | 'digits' | 'formatted' | 'isPrefixOnly'>,
  format: PhoneValueFormat
): string {
  if (info.isPrefixOnly) return '';
  if (format === 'digits') return info.digits;
  if (format === 'display') return info.formatted;
  return info.e164;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  {
    value,
    defaultValue,
    hasError = false,
    valueFormat = 'e164',
    className = '',
    placeholder = '+62 812-3456-7890',
    onValueChange,
    onChange,
    onKeyDown,
    onPaste,
    onBlur,
    ...props
  },
  ref
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const lastEmittedRef = useRef<string | null>(null);

  const initialRaw = value ?? defaultValue ?? '';
  const [displayValue, setDisplayValue] = useState<string>(
    () => parseIndonesianPhoneInput(initialRaw).formatted
  );

  const setMergedRef = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  // Sync external controlled `value` into visual formatted display without clobbering intermediate "+62 " state
  useEffect(() => {
    if (value === undefined) return;
    if (value === '' && displayValue === '+62 ' && lastEmittedRef.current === '') {
      return;
    }
    const externalInfo = parseIndonesianPhoneInput(value);
    if (externalInfo.formatted !== displayValue) {
      setDisplayValue(externalInfo.formatted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    const caret = pendingCaretRef.current;
    if (el && caret !== null && document.activeElement === el) {
      pendingCaretRef.current = null;
      try {
        el.setSelectionRange(caret, caret);
      } catch {
        // Ignore selection errors on unsupported input states
      }
    }
  }, [displayValue]);

  const emitChange = (nextInfo: {
    formatted: string;
    e164: string;
    digits: string;
    isPrefixOnly?: boolean;
  }) => {
    const parsed = parseIndonesianPhoneInput(nextInfo.formatted, {
      preservePrefixOnly: nextInfo.isPrefixOnly,
    });
    const emitted = pickEmittedValue(parsed, valueFormat);
    lastEmittedRef.current = emitted;

    onValueChange?.(emitted, parsed);

    if (onChange && inputRef.current) {
      const syntheticTarget = Object.assign(Object.create(inputRef.current), {
        value: emitted,
        name: props.name ?? inputRef.current.name,
        id: props.id ?? inputRef.current.id,
      });
      const syntheticEvent = {
        target: syntheticTarget,
        currentTarget: syntheticTarget,
      } as unknown as ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value;
    const rawCaret = event.target.selectionStart ?? rawValue.length;

    const result = formatPhoneWithCaret({
      rawValue,
      rawCaret,
      previousFormatted: displayValue,
    });

    pendingCaretRef.current = result.caret;
    setDisplayValue(result.formatted);
    emitChange({
      formatted: result.formatted,
      e164: result.e164,
      digits: result.digits,
      isPrefixOnly: result.formatted === '+62 ',
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const el = inputRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;

    // Only intercept single-caret Backspace/Delete over visual formatting separators ('-' or '+62 ')
    if (start !== end) return;

    if (event.key === 'Backspace' && start > 0) {
      if (displayValue === '+62 ' && start <= 4) {
        event.preventDefault();
        pendingCaretRef.current = 0;
        setDisplayValue('');
        emitChange({ formatted: '', e164: '', digits: '', isPrefixOnly: false });
        return;
      }

      if (displayValue[start - 1] === '-') {
        event.preventDefault();
        const editedRaw = displayValue.slice(0, start - 2) + displayValue.slice(start);
        const result = formatPhoneWithCaret({
          rawValue: editedRaw,
          rawCaret: Math.max(0, start - 2),
          previousFormatted: displayValue,
        });
        pendingCaretRef.current = result.caret;
        setDisplayValue(result.formatted);
        emitChange({
          formatted: result.formatted,
          e164: result.e164,
          digits: result.digits,
          isPrefixOnly: result.formatted === '+62 ',
        });
      }
    } else if (event.key === 'Delete' && start < displayValue.length) {
      if (displayValue[start] === '-') {
        event.preventDefault();
        const editedRaw = displayValue.slice(0, start) + displayValue.slice(start + 2);
        const result = formatPhoneWithCaret({
          rawValue: editedRaw,
          rawCaret: start,
          previousFormatted: displayValue,
        });
        pendingCaretRef.current = result.caret;
        setDisplayValue(result.formatted);
        emitChange({
          formatted: result.formatted,
          e164: result.e164,
          digits: result.digits,
          isPrefixOnly: result.formatted === '+62 ',
        });
      }
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    onPaste?.(event);
    if (event.defaultPrevented) return;

    const pasted = event.clipboardData?.getData('text') ?? '';
    if (!pasted.trim()) return;

    event.preventDefault();
    const el = inputRef.current;
    const start = el?.selectionStart ?? displayValue.length;
    const end = el?.selectionEnd ?? displayValue.length;

    const pastedInfo = normalizePastedPhone(pasted);
    const isReplacingAll = start === 0 && end === displayValue.length;
    const looksLikeFullPhone =
      pasted.trim().startsWith('+') ||
      pasted.trim().startsWith('0') ||
      pasted.replace(/\D/g, '').length >= 7;

    if (!displayValue || isReplacingAll || looksLikeFullPhone) {
      pendingCaretRef.current = pastedInfo.formatted.length;
      setDisplayValue(pastedInfo.formatted);
      emitChange({
        formatted: pastedInfo.formatted,
        e164: pastedInfo.e164,
        digits: pastedInfo.digits,
        isPrefixOnly: false,
      });
      return;
    }

    // Partial numeric snippet pasted into the middle of an existing phone number
    const cleanDigits = pasted.replace(/\D/g, '');
    const mergedRaw = displayValue.slice(0, start) + cleanDigits + displayValue.slice(end);
    const result = formatPhoneWithCaret({
      rawValue: mergedRaw,
      rawCaret: start + cleanDigits.length,
      previousFormatted: displayValue,
    });
    pendingCaretRef.current = result.caret;
    setDisplayValue(result.formatted);
    emitChange({
      formatted: result.formatted,
      e164: result.e164,
      digits: result.digits,
      isPrefixOnly: result.formatted === '+62 ',
    });
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (displayValue === '+62 ') {
      setDisplayValue('');
      emitChange({ formatted: '', e164: '', digits: '', isPrefixOnly: false });
    }
    onBlur?.(event);
  };

  const borderClass = hasError
    ? 'border-[var(--danger)] focus:border-[var(--danger)] focus-visible:border-[var(--danger)]'
    : 'border-[var(--border)] hover:border-[var(--border-strong)] focus:border-[var(--border-strong)] focus-visible:border-[var(--border-strong)]';

  const widthClass = /\bw-/.test(className) ? '' : 'w-full';

  return (
    <input
      ref={setMergedRef}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      aria-invalid={hasError || undefined}
      value={displayValue}
      placeholder={placeholder}
      onChange={handleInputChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onBlur={handleBlur}
      className={`${widthClass} rounded-[var(--radius-md)] border bg-[var(--surface)] text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none focus:outline-none focus-visible:outline-none transition-colors duration-150 disabled:opacity-55 disabled:cursor-not-allowed min-h-11 px-3.5 py-2 tabular-nums ${borderClass} ${className}`}
      {...props}
    />
  );
});
