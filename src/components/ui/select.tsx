import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { usePopoverPosition } from './popover-position';

export interface SelectOptionItem {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  group?: string;
}

export interface SelectProps {
  id?: string;
  name?: string;
  value?: string | number | readonly string[];
  defaultValue?: string | number | readonly string[];
  options?: readonly SelectOptionItem[];
  children?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  hasError?: boolean;
  /** 'auto' activates search input inside popup when >= 8 options exist */
  searchable?: boolean | 'auto';
  searchPlaceholder?: string;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  onValueChange?: (value: string) => void;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  onBlur?: () => void;
}

function extractNodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractNodeText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractNodeText(node.props.children);
  }
  return '';
}

function parseOptionsFromChildren(children: ReactNode, groupLabel?: string): SelectOptionItem[] {
  const result: SelectOptionItem[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;

    if (child.type === 'option') {
      const el = child as ReactElement<{
        value?: string | number;
        disabled?: boolean;
        children?: ReactNode;
      }>;
      const label = extractNodeText(el.props.children).trim();
      const val =
        el.props.value !== undefined ? String(el.props.value) : label;
      result.push({
        value: val,
        label: label || val,
        disabled: Boolean(el.props.disabled),
        group: groupLabel,
      });
      return;
    }

    if (child.type === 'optgroup') {
      const el = child as ReactElement<{ label?: string; children?: ReactNode }>;
      result.push(...parseOptionsFromChildren(el.props.children, el.props.label));
      return;
    }

    // Handle fragments or nested nodes cleanly
    const props = child.props as { children?: ReactNode } | undefined;
    if (props?.children) {
      result.push(...parseOptionsFromChildren(props.children, groupLabel));
    }
  });

  return result;
}

function normalizeSelectValue(val: string | number | readonly string[] | undefined): string | undefined {
  if (val === undefined) return undefined;
  if (Array.isArray(val)) return String(val[0] ?? '');
  return String(val);
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    id,
    name,
    value,
    defaultValue,
    options,
    children,
    placeholder = 'Pilih opsi...',
    disabled = false,
    required = false,
    hasError = false,
    searchable = 'auto',
    searchPlaceholder = 'Cari pilihan...',
    className = '',
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    onValueChange,
    onChange,
    onBlur,
  },
  ref
) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const listboxId = `${controlId}-listbox`;

  const parsedOptions = useMemo(
    () => (options ? [...options] : parseOptionsFromChildren(children)),
    [options, children]
  );

  const controlledValue = normalizeSelectValue(value);
  const [uncontrolledValue, setUncontrolledValue] = useState<string>(() => {
    const def = normalizeSelectValue(defaultValue);
    if (def !== undefined) return def;
    return parsedOptions[0]?.value ?? '';
  });

  const activeValue = controlledValue !== undefined ? controlledValue : uncontrolledValue;
  const selectedOption = parsedOptions.find((opt) => opt.value === activeValue) ?? null;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const typeAheadRef = useRef<{ buffer: string; timer: number | null }>({
    buffer: '',
    timer: null,
  });

  const setMergedTriggerRef = useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  const isSearchEnabled =
    searchable === true || (searchable === 'auto' && parsedOptions.length >= 8);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return parsedOptions;
    return parsedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q)) ||
        (opt.group && opt.group.toLowerCase().includes(q))
    );
  }, [parsedOptions, searchQuery]);

  const { style, placement, maxHeight } = usePopoverPosition({
    isOpen,
    triggerRef,
    panelRef,
    preferredMaxHeight: 320,
    minWidth: 200,
    matchTriggerWidth: true,
    align: 'start',
    offset: 6,
  });

  const closePopup = useCallback(
    (restoreFocus = false) => {
      setIsOpen(false);
      setSearchQuery('');
      if (restoreFocus) {
        triggerRef.current?.focus();
      }
      onBlur?.();
    },
    [onBlur]
  );

  useEffect(() => {
    if (!isOpen) return;

    const selectedIdx = filteredOptions.findIndex(
      (opt) => opt.value === activeValue && !opt.disabled
    );
    const firstEnabled = filteredOptions.findIndex((opt) => !opt.disabled);
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : Math.max(0, firstEnabled));

    if (isSearchEnabled) {
      window.requestAnimationFrame(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      });
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      closePopup(false);
    };

    const handleGlobalKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePopup(true);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleGlobalKey);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleGlobalKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const optEl = optionRefs.current[highlightedIndex];
    optEl?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, highlightedIndex]);

  const commitSelection = (nextValue: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(nextValue);
    }

    onValueChange?.(nextValue);

    if (onChange) {
      const syntheticTarget = {
        value: nextValue,
        name: name ?? '',
        id: controlId,
      } as unknown as HTMLSelectElement;

      const syntheticEvent = {
        target: syntheticTarget,
        currentTarget: syntheticTarget,
      } as Parameters<ChangeEventHandler<HTMLSelectElement>>[0];

      onChange(syntheticEvent);
    }

    closePopup(true);
  };

  const moveHighlight = (dir: 1 | -1) => {
    if (filteredOptions.length === 0) return;
    let next = highlightedIndex;
    for (let step = 0; step < filteredOptions.length; step += 1) {
      next = (next + dir + filteredOptions.length) % filteredOptions.length;
      if (!filteredOptions[next].disabled) {
        setHighlightedIndex(next);
        return;
      }
    }
  };

  const handleTypeAhead = (char: string) => {
    const state = typeAheadRef.current;
    state.buffer += char.toLowerCase();
    if (state.timer) window.clearTimeout(state.timer);
    state.timer = window.setTimeout(() => {
      state.buffer = '';
    }, 500);

    const matchIdx = filteredOptions.findIndex(
      (opt) => !opt.disabled && opt.label.toLowerCase().startsWith(state.buffer)
    );
    if (matchIdx >= 0) {
      setHighlightedIndex(matchIdx);
    }
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) {
        const current = filteredOptions[highlightedIndex];
        if (current && !current.disabled) {
          commitSelection(current.value);
        }
      } else {
        setIsOpen(true);
      }
    } else if (!isOpen && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Quick cycle/match when closed
      const match = parsedOptions.find(
        (opt) => !opt.disabled && opt.label.toLowerCase().startsWith(event.key.toLowerCase())
      );
      if (match) {
        commitSelection(match.value);
      }
    }
  };

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveHighlight(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlight(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      const first = filteredOptions.findIndex((o) => !o.disabled);
      if (first >= 0) setHighlightedIndex(first);
    } else if (event.key === 'End') {
      event.preventDefault();
      for (let i = filteredOptions.length - 1; i >= 0; i -= 1) {
        if (!filteredOptions[i].disabled) {
          setHighlightedIndex(i);
          break;
        }
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = filteredOptions[highlightedIndex];
      if (chosen && !chosen.disabled) {
        commitSelection(chosen.value);
      }
    } else if (event.key === 'Tab') {
      closePopup(false);
    } else if (
      !isSearchEnabled &&
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      handleTypeAhead(event.key);
    }
  };

  const widthClass = /\bw-/.test(className) ? '' : 'w-full';
  const heightClass = /\b(?:[a-z]+:)?(?:min-)?h-\S+/.test(className) ? '' : 'h-11';
  const borderClass = hasError
    ? 'border-[var(--danger)] focus-visible:border-[var(--danger)]'
    : isOpen
      ? 'border-[var(--border-strong)]'
      : 'border-[var(--border)] hover:border-[var(--border-strong)] focus-visible:border-[var(--border-strong)]';

  let lastGroup: string | undefined;

  return (
    <>
      {name && (
        <input type="hidden" name={name} value={activeValue} required={required} />
      )}
      <button
        ref={setMergedTriggerRef}
        id={controlId}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-invalid={hasError || undefined}
        aria-required={required || undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        onKeyDown={handleTriggerKeyDown}
        className={`${widthClass} ${heightClass} inline-flex items-center justify-between gap-2.5 px-3.5 py-0 rounded-[var(--radius-md)] border bg-[var(--surface)] text-sm text-left outline-none focus:outline-none focus-visible:outline-none transition-colors duration-150 disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer ${borderClass} ${className}`}
      >
        <span
          className={[
            'truncate min-w-0',
            selectedOption ? 'text-[var(--text)]' : 'text-[var(--text-subtle)]',
          ].join(' ')}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={[
            'size-4 text-[var(--text-muted)] shrink-0 transition-transform duration-150 ease-[var(--ease-studio)]',
            isOpen ? 'rotate-180 text-[var(--text)]' : '',
          ].join(' ')}
          aria-hidden="true"
        />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            data-placement={placement}
            style={style}
            onKeyDown={handlePanelKeyDown}
            className="z-[70] flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-md)] overflow-hidden"
          >
            {isSearchEnabled && (
              <div className="p-2 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
                <div className="relative flex items-center">
                  <Search
                    className="size-3.5 text-[var(--text-muted)] absolute left-2.5 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setHighlightedIndex(0);
                    }}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="w-full h-11 pl-8 pr-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)]/60 text-base md:text-xs text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none focus:outline-none focus-visible:outline-none focus:border-[var(--border-strong)] focus-visible:border-[var(--border-strong)]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="Hapus pencarian pilihan"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-1.5 inline-flex items-center justify-center size-6 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel ?? 'Daftar pilihan'}
              style={{ maxHeight: Math.max(150, maxHeight - (isSearchEnabled ? 54 : 0)) }}
              className="app-scroll-region overflow-y-auto overflow-x-hidden p-1.5 space-y-0.5"
            >
              {filteredOptions.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">
                  Tidak ada pilihan yang cocok.
                </p>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const showGroupHeader = opt.group && opt.group !== lastGroup;
                  lastGroup = opt.group;
                  const isSelected = opt.value === activeValue;
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <div key={`${opt.value}-${idx}`}>
                      {showGroupHeader && (
                        <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
                          {opt.group}
                        </p>
                      )}
                      <button
                        ref={(el) => {
                          optionRefs.current[idx] = el;
                        }}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={opt.disabled}
                        onMouseEnter={() => {
                          if (!opt.disabled) setHighlightedIndex(idx);
                        }}
                        onClick={() => {
                          if (!opt.disabled) commitSelection(opt.value);
                        }}
                        className={[
                          'w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-[var(--radius-md)] text-left text-sm transition-colors outline-none',
                          opt.disabled
                            ? 'opacity-45 cursor-not-allowed'
                            : isSelected
                              ? 'bg-[var(--surface-muted)] text-[var(--text)] font-medium cursor-pointer'
                              : isHighlighted
                                ? 'bg-[var(--surface-muted)]/70 text-[var(--text)] cursor-pointer'
                                : 'text-[var(--text)] hover:bg-[var(--surface-muted)]/60 cursor-pointer',
                        ].join(' ')}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block leading-snug break-words">{opt.label}</span>
                          {opt.description && (
                            <span className="block text-[11px] text-[var(--text-muted)] leading-snug mt-0.5">
                              {opt.description}
                            </span>
                          )}
                        </span>
                        {isSelected && (
                          <Check
                            className="size-4 text-[var(--accent)] shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
});
