import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { IconButton } from '../../../components/ui/icon-button';
import { MODAL_ANIMATION_MS } from '../../../components/ui/modal';
import { usePopoverPosition } from '../../../components/ui/popover-position';

export interface CustomisasiOptionPickerProps {
  options: readonly string[];
  value: string | null;
  onChange: (value: string) => void;
  label?: string;
  productName?: string;
  disabled?: boolean;
  className?: string;
}

export function CustomisasiOptionPicker({
  options,
  value,
  onChange,
  label = 'Customisasi',
  productName,
  disabled = false,
  className = '',
}: CustomisasiOptionPickerProps) {
  const controlId = useId();
  const listId = `${controlId}-customisasi-list`;
  const titleId = `${controlId}-sheet-title`;

  const triggerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const desktopPanelRef = useRef<HTMLDivElement>(null);
  const mobileSheetRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 767px)').matches
      : false
  );
  const [isSheetMounted, setIsSheetMounted] = useState(false);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, [productName]);

  const selectedOption =
    (value ? options.find((opt) => opt === value) : null) ?? options[0] ?? null;

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (isMobile || !query) return [...options];
    return options.filter((opt) => opt.toLowerCase().includes(query));
  }, [isMobile, options, searchQuery]);

  const isDesktopOpen = isOpen && !isMobile;

  const { style: desktopStyle, placement: desktopPlacement, maxHeight: desktopMaxHeight } =
    usePopoverPosition({
      isOpen: isDesktopOpen,
      triggerRef,
      panelRef: desktopPanelRef,
      preferredMaxHeight: 360,
      minWidth: 260,
      matchTriggerWidth: true,
      align: 'start',
      offset: 6,
    });

  const closePicker = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    setSearchQuery('');
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        buttonRef.current?.focus();
      });
    }
  }, []);

  const openDesktopCombobox = useCallback(
    (initialQuery = '') => {
      if (disabled || options.length === 0) return;
      setSearchQuery(initialQuery);
      if (initialQuery) {
        setHighlightedIndex(0);
      } else {
        const currentIdx = selectedOption ? options.indexOf(selectedOption) : -1;
        setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
      }
      setIsOpen(true);
    },
    [disabled, options, selectedOption]
  );

  // Auto-focus desktop combobox search input when opened
  useEffect(() => {
    if (!isDesktopOpen) return;
    const raf = window.requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isDesktopOpen]);

  // Mobile bottom sheet mount + enter/exit motion
  useEffect(() => {
    if (!isMobile) {
      setIsSheetMounted(false);
      setIsSheetVisible(false);
      return;
    }

    setSearchQuery('');

    if (isOpen) {
      setIsSheetMounted(true);
      let raf1 = 0;
      let raf2 = 0;
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setIsSheetVisible(true);
        });
      });
      return () => {
        window.cancelAnimationFrame(raf1);
        window.cancelAnimationFrame(raf2);
      };
    }

    setIsSheetVisible(false);
    const timer = window.setTimeout(() => {
      setIsSheetMounted(false);
    }, MODAL_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen, isMobile]);

  // Body scroll lock while mobile bottom sheet is mounted
  useEffect(() => {
    if (!isSheetMounted) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isSheetMounted]);

  // Listen for Escape / outside pointer click while open
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (isMobile) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (
        triggerRef.current?.contains(target) ||
        desktopPanelRef.current?.contains(target)
      ) {
        return;
      }
      closePicker(false);
    };

    const handleGlobalKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePicker(true);
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
  }, [isOpen, isMobile, closePicker]);

  // Keep highlighted option within filtered list bounds & scrolled into view
  useEffect(() => {
    if (!isDesktopOpen) return;
    if (filteredOptions.length === 0) {
      setHighlightedIndex(0);
      return;
    }
    if (highlightedIndex >= filteredOptions.length) {
      setHighlightedIndex(0);
      return;
    }
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [isDesktopOpen, filteredOptions.length, highlightedIndex]);

  const handleSelectOption = (optionValue: string) => {
    onChange(optionValue);
    closePicker(true);
  };

  const handleClosedTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || options.length === 0) return;
    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      if (isMobile) {
        setIsOpen(true);
      } else {
        openDesktopCombobox('');
      }
      return;
    }

    if (
      !isMobile &&
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      openDesktopCombobox(event.key);
    }
  };

  const handleComboboxInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      if (filteredOptions.length === 0) return;
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length);
    } else if (event.key === 'ArrowUp') {
      if (filteredOptions.length === 0) return;
      event.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const targetOption = filteredOptions[highlightedIndex] ?? filteredOptions[0];
      if (targetOption) {
        handleSelectOption(targetOption);
      }
    } else if (event.key === 'Tab') {
      closePicker(false);
    }
  };

  const activeDesktopOption =
    isDesktopOpen && filteredOptions[highlightedIndex]
      ? `${controlId}-option-${highlightedIndex}`
      : undefined;

  const renderOptionRows = (mobileMode: boolean) => {
    const items = mobileMode ? options : filteredOptions;
    optionRefs.current = [];

    if (!mobileMode && items.length === 0) {
      return (
        <div
          id={listId}
          role="listbox"
          aria-label={label}
          className="px-3 py-5 text-center space-y-2"
        >
          <p className="text-xs text-[var(--text-muted)]">
            Customisasi &ldquo;{searchQuery.trim()}&rdquo; tidak ditemukan.
          </p>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setSearchQuery('');
              setHighlightedIndex(0);
              inputRef.current?.focus();
            }}
            className="inline-flex items-center justify-center px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)]/60 text-[11px] font-medium text-[var(--text)] hover:border-[var(--border-strong)] transition-colors cursor-pointer"
          >
            Reset pencarian
          </button>
        </div>
      );
    }

    return (
      <div
        id={listId}
        role="listbox"
        aria-label={label}
        className={mobileMode ? 'grid grid-cols-1 gap-1.5' : 'space-y-0.5'}
      >
        {items.map((optionLabel, idx) => {
          const isSelected = optionLabel === selectedOption;
          const isHighlighted = !mobileMode && idx === highlightedIndex;

          return (
            <button
              key={optionLabel}
              id={!mobileMode ? `${controlId}-option-${idx}` : undefined}
              ref={(el) => {
                optionRefs.current[idx] = el;
              }}
              type="button"
              role="option"
              aria-selected={isSelected}
              onMouseDown={(e) => {
                if (!mobileMode) e.preventDefault();
              }}
              onMouseEnter={() => {
                if (!mobileMode) setHighlightedIndex(idx);
              }}
              onClick={() => handleSelectOption(optionLabel)}
              className={[
                'w-full flex items-center justify-between gap-3 rounded-[var(--radius-md)] text-left transition-colors outline-none cursor-pointer',
                mobileMode ? 'min-h-12 px-3.5 py-2.5 border' : 'px-2.5 py-2',
                isSelected
                  ? mobileMode
                    ? 'border-[var(--accent)] bg-[var(--surface-muted)] text-[var(--text)] font-medium'
                    : isHighlighted
                      ? 'bg-[var(--surface-muted)] text-[var(--text)] font-medium'
                      : 'bg-[var(--surface-muted)]/80 text-[var(--text)] font-medium'
                  : mobileMode
                    ? 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--border-strong)]'
                    : isHighlighted
                      ? 'bg-[var(--surface-muted)] text-[var(--text)]'
                      : 'text-[var(--text)] hover:bg-[var(--surface-muted)]/60',
              ].join(' ')}
            >
              <span className="min-w-0">
                <span className="block text-xs sm:text-sm font-medium text-[var(--text)] truncate">
                  {optionLabel}
                </span>
              </span>

              {isSelected && (
                <Check className="size-4 text-[var(--accent)] shrink-0" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const hasSearchQuery = searchQuery.trim().length > 0;

  return (
    <>
      <div ref={triggerRef} className="w-full" data-testid="detail-customisasi-group">
        {isDesktopOpen ? (
          <div
            data-testid="customisasi-picker-desktop-combobox"
            className={[
              'w-full h-11 inline-flex items-center gap-2 px-3.5 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] text-xs outline-none focus:outline-none focus-within:outline-none transition-colors duration-150',
              className,
            ].join(' ')}
          >
            <Search
              className="size-4 text-[var(--text-muted)] shrink-0"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              id={controlId}
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-expanded={true}
              aria-controls={listId}
              aria-activedescendant={activeDesktopOption}
              aria-label={`Cari ${label.toLowerCase()}`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleComboboxInputKeyDown}
              placeholder={
                selectedOption ? `Cari customisasi (${selectedOption})...` : 'Cari customisasi...'
              }
              autoComplete="off"
              className="w-full min-w-0 bg-transparent text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:outline-none focus-visible:outline-none"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                aria-label="Hapus pencarian customisasi"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSearchQuery('');
                  const currentIdx = selectedOption ? options.indexOf(selectedOption) : -1;
                  setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
                  inputRef.current?.focus();
                }}
                className="inline-flex items-center justify-center size-5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] outline-none focus:outline-none focus-visible:outline-none transition-colors shrink-0 cursor-pointer"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              aria-label="Tutup pilihan customisasi"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => closePicker(true)}
              className="inline-flex items-center justify-center text-[var(--text)] outline-none focus:outline-none focus-visible:outline-none shrink-0 cursor-pointer"
            >
              <ChevronDown
                className="size-4 rotate-180 transition-transform duration-150 ease-[var(--ease-studio)]"
                aria-hidden="true"
              />
            </button>
          </div>
        ) : (
          <button
            ref={buttonRef}
            id={controlId}
            type="button"
            disabled={disabled || options.length === 0}
            aria-haspopup={isMobile ? 'dialog' : 'listbox'}
            aria-expanded={isOpen}
            aria-controls={isOpen ? listId : undefined}
            aria-label={selectedOption ? `${label}: ${selectedOption}` : label}
            data-testid="customisasi-picker-trigger"
            onClick={() => {
              if (disabled || options.length === 0) return;
              if (isMobile) {
                setIsOpen((prev) => !prev);
              } else {
                openDesktopCombobox('');
              }
            }}
            onKeyDown={handleClosedTriggerKeyDown}
            className={[
              'w-full h-11 inline-flex items-center justify-between gap-2 px-3 sm:px-3.5 rounded-[var(--radius-md)] border bg-[var(--surface)] text-xs text-left outline-none focus:outline-none focus-visible:outline-none focus-visible:border-[var(--border-strong)] transition-colors duration-150 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed',
              isOpen
                ? 'border-[var(--border-strong)]'
                : 'border-[var(--border)] hover:border-[var(--border-strong)]',
              className,
            ].join(' ')}
          >
            <span className="min-w-0 flex-1 truncate font-medium text-[var(--text)]">
              {selectedOption ?? 'Pilih customisasi'}
            </span>
            <ChevronDown
              className={[
                'size-4 text-[var(--text-muted)] shrink-0 transition-transform duration-150 ease-[var(--ease-studio)]',
                isOpen ? 'rotate-180 text-[var(--text)]' : '',
              ].join(' ')}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {/* Desktop: Custom Anchored Popup Menu */}
      {isDesktopOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={desktopPanelRef}
            data-placement={desktopPlacement}
            data-testid="customisasi-picker-desktop-popup"
            style={desktopStyle}
            className="z-[70] flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-md)] overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-muted)]/50 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Opsi Customisasi
              </p>
              <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                {hasSearchQuery
                  ? `${filteredOptions.length} dari ${options.length} opsi`
                  : `${options.length} opsi`}
              </span>
            </div>
            <div
              style={{ maxHeight: Math.max(160, desktopMaxHeight - 36) }}
              className="app-scroll-region overflow-y-auto overflow-x-hidden p-1.5"
            >
              {renderOptionRows(false)}
            </div>
          </div>,
          document.body
        )}

      {/* Mobile: Bottom Sheet */}
      {isMobile &&
        isSheetMounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-testid="customisasi-picker-mobile-sheet"
            className="fixed inset-0 z-[70] pt-[env(safe-area-inset-top)] flex items-end justify-center md:hidden"
          >
            <div
              aria-hidden="true"
              data-state={isSheetVisible ? 'open' : 'closed'}
              onClick={() => closePicker(true)}
              className="fixed inset-0 modal-backdrop-motion"
            />
            <div
              ref={mobileSheetRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              data-state={isSheetVisible ? 'open' : 'closed'}
              className="relative z-10 w-full max-h-[82dvh] flex flex-col overflow-hidden bg-[var(--surface)] text-[var(--text)] border-t border-x border-[var(--border)] rounded-t-[var(--radius-lg)] shadow-[var(--shadow-md)] modal-panel-motion"
            >
              <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--border)]">
                <h2 id={titleId} className="text-base font-semibold text-[var(--text)] truncate">
                  Pilih Customisasi
                </h2>
                <IconButton
                  aria-label="Tutup pilihan customisasi"
                  variant="ghost"
                  onClick={() => closePicker(true)}
                >
                  <X className="size-4" aria-hidden="true" />
                </IconButton>
              </div>
              <div className="app-scroll-region flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                {renderOptionRows(true)}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
