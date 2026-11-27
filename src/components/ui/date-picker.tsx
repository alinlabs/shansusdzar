import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEventHandler,
} from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { formatDisplayDateId, parseIsoDate } from '../../lib/date-utils';
import { Calendar, type DateRangeValue } from './calendar';
import { usePopoverPosition } from './popover-position';

export interface DatePickerProps {
  id?: string;
  name?: string;
  mode?: 'single' | 'range';
  value?: string;
  rangeValue?: DateRangeValue;
  onValueChange?: (iso: string) => void;
  onRangeChange?: (range: DateRangeValue) => void;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  hasError?: boolean;
  clearable?: boolean;
  displayFormat?: 'long' | 'short';
  minDate?: string;
  maxDate?: string;
  disabledDates?: readonly string[];
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(
  {
    id,
    name,
    mode = 'single',
    value = '',
    rangeValue,
    onValueChange,
    onRangeChange,
    onChange,
    placeholder,
    disabled = false,
    required = false,
    hasError = false,
    clearable = false,
    displayFormat = 'long',
    minDate,
    maxDate,
    disabledDates,
    className = '',
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
  },
  ref
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const dialogId = `${controlId}-calendar`;

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const setMergedTriggerRef = useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  const { style, placement } = usePopoverPosition({
    isOpen,
    triggerRef,
    panelRef,
    preferredMaxHeight: 400,
    minWidth: 320,
    matchTriggerWidth: false,
    align: 'start',
    offset: 6,
  });

  const closePicker = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      closePicker(false);
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePicker(true);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closePicker]);

  const emitSingleDate = (nextIso: string) => {
    onValueChange?.(nextIso);
    if (onChange) {
      const syntheticTarget = {
        value: nextIso,
        name: name ?? '',
        id: controlId,
      } as unknown as HTMLInputElement;
      const syntheticEvent = {
        target: syntheticTarget,
        currentTarget: syntheticTarget,
      } as Parameters<ChangeEventHandler<HTMLInputElement>>[0];
      onChange(syntheticEvent);
    }
  };

  const formattedLabel = (() => {
    if (mode === 'range') {
      const startText = formatDisplayDateId(rangeValue?.start, displayFormat);
      const endText = formatDisplayDateId(rangeValue?.end, displayFormat);
      if (startText && endText) return `${startText} – ${endText}`;
      if (startText) return `${startText} – ...`;
      return '';
    }
    return parseIsoDate(value) ? formatDisplayDateId(value, displayFormat) : '';
  })();

  const hasValue =
    mode === 'range' ? Boolean(rangeValue?.start || rangeValue?.end) : Boolean(parseIsoDate(value));

  const resolvedPlaceholder =
    placeholder ?? (mode === 'range' ? 'Pilih rentang tanggal...' : 'Pilih tanggal...');

  const widthClass = /\bw-/.test(className) ? '' : 'w-full';
  const heightClass = /\b(?:[a-z]+:)?(?:min-)?h-\S+/.test(className) ? '' : 'h-11';
  const borderClass = hasError
    ? 'border-[var(--danger)] focus-within:border-[var(--danger)]'
    : isOpen
      ? 'border-[var(--border-strong)]'
      : 'border-[var(--border)] hover:border-[var(--border-strong)] focus-within:border-[var(--border-strong)]';

  return (
    <>
      {name && mode === 'single' && (
        <input type="hidden" name={name} value={value} required={required} />
      )}
      <div
        className={`${widthClass} ${heightClass} relative inline-flex items-center rounded-[var(--radius-md)] border bg-[var(--surface)] transition-colors duration-150 ${
          disabled ? 'opacity-55 cursor-not-allowed' : ''
        } ${borderClass} ${className}`}
      >
        <button
          ref={setMergedTriggerRef}
          id={controlId}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={dialogId}
          aria-invalid={hasError || undefined}
          aria-required={required || undefined}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          onClick={() => {
            if (!disabled) setIsOpen((prev) => !prev);
          }}
          className="flex-1 min-w-0 h-full inline-flex items-center justify-between gap-2.5 px-3.5 py-0 text-sm text-left outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed cursor-pointer"
        >
          <span
            className={[
              'truncate tabular-nums',
              hasValue ? 'text-[var(--text)]' : 'text-[var(--text-subtle)]',
            ].join(' ')}
          >
            {formattedLabel || resolvedPlaceholder}
          </span>
          <CalendarIcon
            className={[
              'size-4 shrink-0 transition-colors',
              isOpen ? 'text-[var(--text)]' : 'text-[var(--text-muted)]',
            ].join(' ')}
            aria-hidden="true"
          />
        </button>

        {clearable && hasValue && !disabled && (
          <button
            type="button"
            aria-label="Kosongkan tanggal"
            onClick={(e) => {
              e.stopPropagation();
              if (mode === 'range') {
                onRangeChange?.({ start: undefined, end: undefined });
              } else {
                emitSingleDate('');
              }
            }}
            className="mr-1.5 inline-flex items-center justify-center size-7 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-surface)] transition-colors cursor-pointer shrink-0"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            id={dialogId}
            role="dialog"
            aria-modal="false"
            aria-label={mode === 'range' ? 'Pemilih rentang tanggal' : 'Pemilih tanggal'}
            data-placement={placement}
            style={style}
            className="z-[70] p-3.5 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-md)]"
          >
            <Calendar
              mode={mode}
              value={value}
              rangeValue={rangeValue}
              minDate={minDate}
              maxDate={maxDate}
              disabledDates={disabledDates}
              clearable={clearable}
              onSelect={(iso) => {
                emitSingleDate(iso);
                closePicker(true);
              }}
              onRangeSelect={(nextRange) => {
                onRangeChange?.(nextRange);
                if (nextRange.start && nextRange.end) {
                  closePicker(true);
                }
              }}
              onClear={() => {
                if (mode === 'range') {
                  onRangeChange?.({ start: undefined, end: undefined });
                } else {
                  emitSingleDate('');
                }
                closePicker(true);
              }}
            />
          </div>,
          document.body
        )}
    </>
  );
});
