import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, MoreVertical } from 'lucide-react';
import { usePopoverPosition } from './popover-position';

export interface PopupMenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  dividerBefore?: boolean;
  href?: string;
  target?: string;
  rel?: string;
  onSelect: () => void;
}

export interface PopupMenuProps {
  items: readonly PopupMenuItem[];
  label?: string;
  trigger?: (props: {
    isOpen: boolean;
    toggle: () => void;
    triggerProps: {
      'aria-haspopup': 'menu';
      'aria-expanded': boolean;
      'aria-controls': string;
    };
  }) => ReactNode;
  headerTitle?: string;
  align?: 'start' | 'end';
  minWidth?: number;
  preferredMaxHeight?: number;
  className?: string;
}

export function PopupMenu({
  items,
  label = 'Menu aksi',
  trigger,
  headerTitle,
  align = 'end',
  minWidth = 210,
  preferredMaxHeight = 340,
  className = '',
}: PopupMenuProps) {
  const menuId = useId();
  const triggerWrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const { style, placement, maxHeight } = usePopoverPosition({
    isOpen,
    triggerRef: triggerWrapRef,
    panelRef,
    preferredMaxHeight,
    minWidth,
    matchTriggerWidth: false,
    align,
    offset: 6,
  });

  useEffect(() => {
    if (!isOpen) return;

    const firstEnabled = items.findIndex((i) => !i.disabled);
    setFocusedIndex(firstEnabled >= 0 ? firstEnabled : 0);

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerWrapRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
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
  }, [isOpen, items]);

  useEffect(() => {
    if (isOpen) {
      const btn = itemRefs.current[focusedIndex];
      btn?.focus({ preventScroll: true });
    }
  }, [isOpen, focusedIndex]);

  const moveFocus = (dir: 1 | -1) => {
    if (items.length === 0) return;
    let next = focusedIndex;
    for (let step = 0; step < items.length; step += 1) {
      next = (next + dir + items.length) % items.length;
      if (!items[next].disabled) {
        setFocusedIndex(next);
        return;
      }
    }
  };

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      const first = items.findIndex((i) => !i.disabled);
      if (first >= 0) setFocusedIndex(first);
    } else if (event.key === 'End') {
      event.preventDefault();
      for (let i = items.length - 1; i >= 0; i -= 1) {
        if (!items[i].disabled) {
          setFocusedIndex(i);
          break;
        }
      }
    } else if (event.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const toggle = () => setIsOpen((prev) => !prev);

  return (
    <div ref={triggerWrapRef} className={`inline-flex ${className}`}>
      {trigger ? (
        trigger({
          isOpen,
          toggle,
          triggerProps: {
            'aria-haspopup': 'menu',
            'aria-expanded': isOpen,
            'aria-controls': menuId,
          },
        })
      ) : (
        <button
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={menuId}
          onClick={toggle}
          className="inline-flex items-center justify-center size-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors cursor-pointer"
        >
          <MoreVertical className="size-4" aria-hidden="true" />
        </button>
      )}

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="menu"
            aria-label={label}
            data-placement={placement}
            style={{ ...style, maxHeight }}
            onKeyDown={handlePanelKeyDown}
            className="z-[70] overflow-y-auto overflow-x-hidden app-scroll-region rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-md)] p-1.5"
          >
            {headerTitle && (
              <div className="px-2.5 py-1.5 mb-1 border-b border-[var(--border)]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {headerTitle}
                </p>
              </div>
            )}

            <div className="space-y-0.5">
              {items.map((item, idx) => {
                const itemClassName = [
                  'w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-[var(--radius-md)] text-left text-xs transition-colors outline-none',
                  item.disabled
                    ? 'opacity-45 cursor-not-allowed'
                    : item.tone === 'danger'
                      ? 'text-[var(--danger)] hover:bg-[var(--danger-surface)] focus-visible:bg-[var(--danger-surface)] cursor-pointer'
                      : focusedIndex === idx
                        ? 'bg-[var(--surface-muted)] text-[var(--text)] cursor-pointer'
                        : 'text-[var(--text)] hover:bg-[var(--surface-muted)]/75 cursor-pointer',
                ].join(' ');

                const itemInner = (
                  <>
                    <span className="flex items-start gap-2.5 min-w-0">
                      {item.icon && (
                        <span className="shrink-0 mt-0.5 text-[var(--text-muted)]">{item.icon}</span>
                      )}
                      <span className="min-w-0">
                        <span className="block font-medium leading-snug">{item.label}</span>
                        {item.description && (
                          <span className="block text-[11px] text-[var(--text-muted)] leading-snug mt-0.5">
                            {item.description}
                          </span>
                        )}
                      </span>
                    </span>
                    {item.selected && (
                      <Check className="size-3.5 text-[var(--accent)] shrink-0" aria-hidden="true" />
                    )}
                  </>
                );

                return (
                  <div key={item.id}>
                    {item.dividerBefore && (
                      <div role="separator" className="my-1 border-t border-[var(--border)]" />
                    )}
                    {item.href && !item.disabled ? (
                      <a
                        ref={(el) => {
                          itemRefs.current[idx] = el;
                        }}
                        href={item.href}
                        target={item.target ?? '_blank'}
                        rel={item.rel ?? 'noopener noreferrer'}
                        role="menuitem"
                        onClick={() => {
                          setIsOpen(false);
                          item.onSelect();
                        }}
                        onMouseEnter={() => setFocusedIndex(idx)}
                        className={itemClassName}
                      >
                        {itemInner}
                      </a>
                    ) : (
                      <button
                        ref={(el) => {
                          itemRefs.current[idx] = el;
                        }}
                        type="button"
                        role="menuitem"
                        disabled={item.disabled}
                        onClick={() => {
                          if (item.disabled) return;
                          setIsOpen(false);
                          item.onSelect();
                        }}
                        onMouseEnter={() => {
                          if (!item.disabled) setFocusedIndex(idx);
                        }}
                        className={itemClassName}
                      >
                        {itemInner}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
