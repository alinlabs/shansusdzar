import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { TextareaScrollIndicator } from './textarea-scroll-indicator';

export type FormFieldLabelTone = 'default' | 'thin';

const FormFieldLabelToneContext = createContext<FormFieldLabelTone>('default');
const FormFieldHideHintsContext = createContext<boolean>(false);

export function FormFieldStyleProvider({
  labelTone = 'default',
  hideHints = false,
  children,
}: {
  labelTone?: FormFieldLabelTone;
  hideHints?: boolean;
  children: ReactNode;
}) {
  return (
    <FormFieldLabelToneContext.Provider value={labelTone}>
      <FormFieldHideHintsContext.Provider value={hideHints}>
        {children}
      </FormFieldHideHintsContext.Provider>
    </FormFieldLabelToneContext.Provider>
  );
}

interface FieldWrapperProps {
  id: string;
  label: string;
  labelAction?: ReactNode;
  labelTone?: FormFieldLabelTone;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function FormField({
  id,
  label,
  labelAction,
  labelTone,
  hint,
  error,
  required,
  children,
}: FieldWrapperProps) {
  const inheritedTone = useContext(FormFieldLabelToneContext);
  const hideHints = useContext(FormFieldHideHintsContext);
  const resolvedTone = labelTone ?? inheritedTone;
  const labelClassName =
    resolvedTone === 'thin'
      ? 'block text-xs font-light tracking-[0.01em] text-[var(--text-muted)]'
      : 'block text-sm font-medium text-[var(--text)]';

  const labelNode = (
    <label htmlFor={id} className={labelClassName}>
      {label}
      {required && (
        <span className="text-[var(--danger)] ml-1 font-normal" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );

  return (
    <div className="space-y-1.5">
      {labelAction ? (
        <div className="flex items-center justify-between gap-3">
          {labelNode}
          {labelAction}
        </div>
      ) : (
        labelNode
      )}
      {children}
      {hint && !hideHints && !error && (
        <p id={`${id}-hint`} className="text-xs text-[var(--text-muted)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-[var(--danger)] font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

const controlBaseClasses =
  'rounded-[var(--radius-md)] border bg-[var(--surface)] text-base md:text-sm text-[var(--text)] placeholder:font-normal placeholder:text-[var(--text-subtle)] outline-none focus:outline-none focus-visible:outline-none transition-colors duration-150 disabled:opacity-55 disabled:cursor-not-allowed';

function withControlWidth(className: string): string {
  return /\bw-/.test(className) ? '' : 'w-full';
}

function withControlHeight(className: string, defaultHeight = 'h-11'): string {
  return /\b(?:[a-z]+:)?(?:min-)?h-\S+/.test(className) ? '' : defaultHeight;
}

function getControlBorderClass(hasError?: boolean): string {
  return hasError
    ? 'border-[var(--danger)] focus:border-[var(--danger)] focus-visible:border-[var(--danger)]'
    : 'border-[var(--border)] hover:border-[var(--border-strong)] focus:border-[var(--border-strong)] focus-visible:border-[var(--border-strong)]';
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { hasError = false, className = '', ...props },
  ref
) {
  const isNumberInput = props.type === 'number';
  const numericAlignClass =
    isNumberInput && !/\btext-(left|center|right)\b/.test(className)
      ? 'text-center tabular-nums'
      : '';
  const numericSpinnerResetClass = isNumberInput
    ? '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
    : '';

  return (
    <input
      ref={ref}
      aria-invalid={hasError || undefined}
      className={`${withControlWidth(className)} ${withControlHeight(className)} ${controlBaseClasses} px-3.5 py-0 ${numericAlignClass} ${numericSpinnerResetClass} ${getControlBorderClass(hasError)} ${className}`}
      {...props}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
  autoGrowMaxRows?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    hasError = false,
    autoGrowMaxRows,
    className = '',
    rows = 3,
    onFocus,
    onBlur,
    ...props
  },
  ref
) {
  const internalRef = useRef<HTMLTextAreaElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  const setMergedRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      internalRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref]
  );

  const syncHeight = useCallback(() => {
    const el = internalRef.current;
    if (!el || !autoGrowMaxRows || autoGrowMaxRows < 1) return;

    const computed = window.getComputedStyle(el);
    const lineHeight = parseFloat(computed.lineHeight) || 22;
    const paddingY =
      (parseFloat(computed.paddingTop) || 0) + (parseFloat(computed.paddingBottom) || 0);
    const borderY =
      (parseFloat(computed.borderTopWidth) || 0) + (parseFloat(computed.borderBottomWidth) || 0);

    const minHeight = Math.ceil(lineHeight * Math.max(1, rows) + paddingY + borderY);
    const maxHeight = Math.ceil(lineHeight * autoGrowMaxRows + paddingY + borderY);

    el.style.height = 'auto';
    const nextScrollHeight = el.scrollHeight;
    if (nextScrollHeight > maxHeight) {
      el.style.height = `${maxHeight}px`;
      el.style.overflowY = 'auto';
    } else {
      el.style.height = `${Math.max(minHeight, nextScrollHeight)}px`;
      el.style.overflowY = 'hidden';
    }
  }, [autoGrowMaxRows, rows]);

  useEffect(() => {
    syncHeight();
  }, [syncHeight, props.value]);

  useEffect(() => {
    if (!autoGrowMaxRows) return;
    const handleResize = () => syncHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [autoGrowMaxRows, syncHeight]);

  return (
    <div className="relative w-full">
      <textarea
        ref={setMergedRef}
        rows={rows}
        aria-invalid={hasError || undefined}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        className={`block w-full ${controlBaseClasses} pl-3.5 ${
          isScrollable ? 'pr-6' : 'pr-3.5'
        } py-2.5 app-scroll-region ${
          autoGrowMaxRows ? 'leading-[22px] resize-none' : 'leading-relaxed resize-y'
        } ${getControlBorderClass(hasError)} ${className}`}
        {...props}
      />
      <TextareaScrollIndicator
        targetRef={internalRef}
        value={props.value ?? props.defaultValue}
        isFocused={isFocused}
        bottomInsetClass={autoGrowMaxRows ? 'bottom-2' : 'bottom-3.5'}
        onScrollableChange={setIsScrollable}
      />
    </div>
  );
});

export { Select, type SelectOptionItem, type SelectProps } from './select';
export { PhoneInput, type PhoneInputProps, type PhoneValueFormat } from './phone-input';
export { CurrencyInput, type CurrencyInputProps } from './currency-input';
export { DimensionInput, type DimensionInputProps } from './dimension-input';
export { Calendar, type CalendarProps, type DateRangeValue } from './calendar';
export { DatePicker, type DatePickerProps } from './date-picker';
export { PopupMenu, type PopupMenuItem, type PopupMenuProps } from './popup-menu';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, id, className = '', ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hideHints = useContext(FormFieldHideHintsContext);

  return (
    <label
      htmlFor={inputId}
      className={`flex items-start gap-3 min-h-11 py-1.5 cursor-pointer select-none ${className}`}
    >
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded-[var(--radius-sm)] border border-[var(--border-strong)] accent-[var(--accent)] cursor-pointer"
        {...props}
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium text-[var(--text)] leading-snug">{label}</span>
        {description && !hideHints && (
          <span className="block text-xs text-[var(--text-muted)] leading-relaxed">
            {description}
          </span>
        )}
      </span>
    </label>
  );
});
