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
import { filterColorOptions, isLightHexColor } from '../../lib/color-palette';
import type { ProductColorOption } from '../../types/product';
import { IconButton } from './icon-button';
import { usePopoverPosition } from './popover-position';

export interface ColorOptionPickerProps {
  colors: readonly ProductColorOption[];
  value: string;
  onChange: (colorId: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  showNuanceNote?: boolean | 'mobile-only';
}

const SHEET_ANIMATION_MS = 220;

export function ColorOptionPicker({
  colors,
  value,
  onChange,
  label = 'Pilih Warna',
  disabled = false,
  className = '',
  showNuanceNote = true,
}: ColorOptionPickerProps) {
  const controlId = useId();
  const listId = `${controlId}-color-list`;
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

  const selectedColor = colors.find((c) => c.id === value) ?? colors[0] ?? null;

  const filteredColors = useMemo(
    () => (isMobile ? [...colors] : filterColorOptions(colors, searchQuery)),
    [colors, isMobile, searchQuery]
  );

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
      if (disabled) return;
      setSearchQuery(initialQuery);
      if (initialQuery) {
        setHighlightedIndex(0);
      } else {
        const currentIdx = colors.findIndex((c) => c.id === selectedColor?.id);
        setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
      }
      setIsOpen(true);
    },
    [colors, disabled, selectedColor?.id]
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
    }, SHEET_ANIMATION_MS);
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
    if (filteredColors.length === 0) {
      setHighlightedIndex(0);
      return;
    }
    if (highlightedIndex >= filteredColors.length) {
      setHighlightedIndex(0);
      return;
    }
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [isDesktopOpen, filteredColors.length, highlightedIndex]);

  const handleSelectColor = (colorId: string) => {
    onChange(colorId);
    closePicker(true);
  };

  const handleClosedTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
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
      if (filteredColors.length === 0) return;
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filteredColors.length);
    } else if (event.key === 'ArrowUp') {
      if (filteredColors.length === 0) return;
      event.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredColors.length) % filteredColors.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const targetColor = filteredColors[highlightedIndex] ?? filteredColors[0];
      if (targetColor) {
        handleSelectColor(targetColor.id);
      }
    } else if (event.key === 'Tab') {
      closePicker(false);
    }
  };

  const activeDesktopOption =
    isDesktopOpen && filteredColors[highlightedIndex]
      ? `${controlId}-option-${filteredColors[highlightedIndex].id}`
      : undefined;

  const renderColorSwatchRows = (mobileMode: boolean) => {
    const items = mobileMode ? colors : filteredColors;
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
            Warna &ldquo;{searchQuery.trim()}&rdquo; tidak ditemukan.
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
        {items.map((color, idx) => {
          const isSelected = color.id === selectedColor?.id;
          const isHighlighted = !mobileMode && idx === highlightedIndex;
          const lightHex = isLightHexColor(color.hex);

          return (
            <button
              key={color.id}
              id={!mobileMode ? `${controlId}-option-${color.id}` : undefined}
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
              onClick={() => handleSelectColor(color.id)}
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
              <span className="flex items-center gap-3 min-w-0">
                <span
                  aria-hidden="true"
                  className={[
                    'rounded-full border border-[var(--border-strong)] shrink-0 inline-flex items-center justify-center shadow-2xs',
                    mobileMode ? 'size-6' : 'size-5',
                  ].join(' ')}
                  style={{ backgroundColor: color.hex }}
                >
                  {isSelected && (
                    <Check
                      className={['size-3', lightHex ? 'text-[#18181b]' : 'text-white'].join(' ')}
                      aria-hidden="true"
                    />
                  )}
                </span>

                <span className="min-w-0">
                  <span className="block text-xs sm:text-sm font-medium text-[var(--text)] truncate">
                    {color.nama}
                  </span>
                  {(showNuanceNote === true || (showNuanceNote === 'mobile-only' && mobileMode)) &&
                    color.catatanNuansa && (
                      <span className="block text-[11px] text-[var(--text-muted)] leading-snug truncate">
                        {color.catatanNuansa}
                      </span>
                    )}
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
      <div ref={triggerRef} className="w-full">
        {isDesktopOpen ? (
          <div
            data-testid="color-picker-desktop-combobox"
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
                selectedColor ? `Cari warna (${selectedColor.nama})...` : 'Cari warna...'
              }
              autoComplete="off"
              className="w-full min-w-0 bg-transparent text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:outline-none focus-visible:outline-none"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                aria-label="Hapus pencarian warna"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSearchQuery('');
                  const currentIdx = colors.findIndex((c) => c.id === selectedColor?.id);
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
              aria-label="Tutup pilihan warna"
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
            disabled={disabled}
            aria-haspopup={isMobile ? 'dialog' : 'listbox'}
            aria-expanded={isOpen}
            aria-controls={isOpen ? listId : undefined}
            aria-label={
              selectedColor ? `${label}: ${selectedColor.nama}` : label
            }
            onClick={() => {
              if (disabled) return;
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
            <span className="flex items-center gap-2 min-w-0 flex-1">
              {selectedColor && (
                <span
                  className="size-4 rounded-full border border-[var(--border-strong)] shrink-0"
                  style={{ backgroundColor: selectedColor.hex }}
                  aria-hidden="true"
                />
              )}
              <span className="min-w-0 truncate font-medium text-[var(--text)]">
                {selectedColor ? selectedColor.nama : 'Pilih warna'}
              </span>
              {(showNuanceNote === true || (showNuanceNote === 'mobile-only' && isMobile)) &&
                selectedColor?.catatanNuansa && (
                  <span className="hidden sm:inline text-xs text-[var(--text-muted)] truncate">
                    · {selectedColor.catatanNuansa}
                  </span>
                )}
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
            data-testid="color-picker-desktop-popup"
            style={desktopStyle}
            className="z-[70] flex flex-col rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-md)] overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-muted)]/50 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Palet Warna Custom
              </p>
              <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                {hasSearchQuery
                  ? `${filteredColors.length} dari ${colors.length} warna`
                  : `${colors.length} warna`}
              </span>
            </div>
            <div
              style={{ maxHeight: Math.max(160, desktopMaxHeight - 36) }}
              className="app-scroll-region overflow-y-auto overflow-x-hidden p-1.5"
            >
              {renderColorSwatchRows(false)}
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
            data-testid="color-picker-mobile-sheet"
            className="fixed inset-0 z-[70] flex items-end justify-center md:hidden"
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
              <div className="pt-2.5 pb-1 flex justify-center shrink-0" aria-hidden="true">
                <span className="h-1 w-10 rounded-full bg-[var(--border-strong)]" />
              </div>
              <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--border)]">
                <div className="space-y-0.5 min-w-0">
                  <h2 id={titleId} className="text-base font-semibold text-[var(--text)]">
                    Pilih Warna Custom
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    Palet warna umum berlaku untuk semua unit furniture
                  </p>
                </div>
                <IconButton
                  aria-label="Tutup pilihan warna"
                  variant="ghost"
                  onClick={() => closePicker(true)}
                >
                  <X className="size-4" aria-hidden="true" />
                </IconButton>
              </div>
              <div className="app-scroll-region flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                {renderColorSwatchRows(true)}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

