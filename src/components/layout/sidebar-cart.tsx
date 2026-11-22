import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Headset, Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { buildWhatsAppUrl } from '../../lib/business-config';
import { getCustomServiceModeLabel } from '../../lib/custom-pricing';
import { calculateCartSummary, useCartStore } from '../../store/cart-store';
import type { CartItem } from '../../types/cart';
import { LinkButton } from '../ui/button';
import { IconButton } from '../ui/icon-button';
import { ImageFallback } from '../ui/image-fallback';
import {
  formatCurrencyIDR,
  formatPreliminaryEstimate,
  formatProductPrice,
} from '../../lib/price-format';

const CART_MODAL_ANIMATION_MS = 250;

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getItemTitle(item: CartItem): string {
  return item.kind === 'product' ? item.name : `${item.itemTypeLabel} (Custom)`;
}

function getItemDetails(item: CartItem): string {
  if (item.kind === 'product') {
    const parts: string[] = [item.category];
    if (item.selectedColorName) parts.push(`Warna: ${item.selectedColorName}`);
    const optionEntries = Object.entries(item.selectedOptions);
    for (const [key, val] of optionEntries) {
      parts.push(`${key}: ${val}`);
    }
    return parts.join(' · ');
  }

  const serviceModeLabel = item.serviceModeLabel || getCustomServiceModeLabel(item.serviceMode);
  const dim = item.dimensions;
  const dimText = dim.height
    ? `${dim.length} × ${dim.width} × ${dim.height} ${dim.unit}`
    : `${dim.length} × ${dim.width} ${dim.unit}`;
  const finishSuffix = item.finishLabel ? ` + ${item.finishLabel}` : '';
  const materialSummary =
    item.serviceMode === 'design-only'
      ? `Ref. ${item.materialLabel}${finishSuffix}`
      : `${item.materialLabel}${finishSuffix}`;
  return [
    serviceModeLabel,
    item.projectTypeLabel?.trim() || null,
    dimText,
    materialSummary,
    item.colorName,
  ]
    .filter(Boolean)
    .join(' · ');
}

function getOptionalItemPriceLabel(item: CartItem): string | null {
  if (item.kind === 'product') {
    const formatted = formatProductPrice({
      price: item.unitPrice,
      priceFrom: item.priceStatus === 'mulai' ? item.unitPrice : null,
      priceStatus: item.priceStatus,
    });
    return formatted.isAvailable ? formatted.label : null;
  }
  if (item.estimatedUnitTotal !== null) {
    return formatPreliminaryEstimate(item.estimatedUnitTotal);
  }
  return null;
}

function buildItemWhatsAppUrl(item: CartItem): string {
  const title = getItemTitle(item);
  if (item.kind === 'product') {
    const optionSummary = Object.entries(item.selectedOptions)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    return buildWhatsAppUrl(
      [
        'Halo Shansus Dzar Indonesia,',
        'Saya ingin menanyakan detail dan harga untuk item berikut:',
        `- Produk: ${title}`,
        item.selectedColorName ? `- Warna: ${item.selectedColorName}` : null,
        optionSummary ? `- Opsi: ${optionSummary}` : null,
        `- Jumlah: ${item.quantity}`,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  const serviceModeLabel = item.serviceModeLabel || getCustomServiceModeLabel(item.serviceMode);
  return buildWhatsAppUrl(
    [
      'Halo Shansus Dzar Indonesia,',
      'Saya ingin menanyakan detail dan harga untuk pesanan custom berikut:',
      `- Layanan: ${serviceModeLabel}`,
      `- Item: ${title}`,
      `- Detail: ${getItemDetails(item)}`,
      `- Jumlah: ${item.quantity}`,
    ].join('\n')
  );
}

export function SidebarCart() {
  const items = useCartStore((state) => state.items);
  const isOpen = useCartStore((state) => state.isDrawerOpen);
  const closeDrawer = useCartStore((state) => state.closeDrawer);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const setEditingCustomLineId = useCartStore((state) => state.setEditingCustomLineId);

  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeDrawerRef = useRef(closeDrawer);
  closeDrawerRef.current = closeDrawer;

  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  const summary = calculateCartSummary(items);
  const formattedSubtotal = formatCurrencyIDR(summary.pricedSubtotal);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      let raf1 = 0;
      let raf2 = 0;
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
      return () => {
        window.cancelAnimationFrame(raf1);
        window.cancelAnimationFrame(raf2);
      };
    }

    setIsVisible(false);
    const timer = window.setTimeout(() => {
      setIsMounted(false);
    }, CART_MODAL_ANIMATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isMounted) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        panel.focus();
      }
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawerRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first || !panel.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || !panel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    };
  }, [isMounted]);

  if (!isMounted) return null;

  const motionState = isVisible ? 'open' : 'closed';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end">
      <div
        aria-hidden="true"
        data-state={motionState}
        onClick={closeDrawer}
        className="fixed inset-0 modal-backdrop-motion"
      />

      <aside
        id="sidebar-cart-drawer"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-state={motionState}
        className={[
          'relative z-10 w-full flex flex-col bg-[var(--surface)] text-[var(--text)]',
          'border-t border-x border-b-0 md:border-y-0 md:border-r-0 md:border-l border-[var(--border)] shadow-[var(--shadow-drawer)]',
          'max-h-[88dvh] md:max-h-full md:h-full md:max-w-md',
          'rounded-t-[var(--radius-lg)] md:rounded-none',
          'cart-drawer-motion',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6 border-b border-[var(--border)]">
          <div className="space-y-0.5 min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-[var(--text)]">
              Keranjang Pesanan
            </h2>
            <p className="text-xs text-[var(--text-muted)] tabular-nums">
              {summary.totalQuantity === 0
                ? 'Belum ada item dipilih'
                : `${summary.totalQuantity} item dalam permintaan`}
            </p>
          </div>
          <IconButton aria-label="Tutup keranjang pesanan" variant="ghost" onClick={closeDrawer}>
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        </div>

        <div className="app-scroll-region flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-5 py-5 sm:px-6">
          {items.length === 0 ? (
            <div className="h-full min-h-56 flex flex-col items-center justify-center text-center gap-4 py-8">
              <div className="size-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-[var(--text-muted)]">
                <ShoppingCart className="size-5" aria-hidden="true" />
              </div>
              <div className="space-y-1.5 max-w-xs">
                <p className="text-sm font-medium text-[var(--text)]">
                  Keranjang pesanan Anda masih kosong
                </p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Jelajahi koleksi furniture siap pakai atau susun kebutuhan interior kustom Anda.
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {items.map((item) => {
                const title = getItemTitle(item);
                const priceLabel = getOptionalItemPriceLabel(item);
                return (
                  <li key={item.lineId} className="py-4 first:pt-0 last:pb-0 flex gap-3.5">
                    {item.kind === 'product' ? (
                      <div className="w-18 shrink-0">
                        <ImageFallback
                          src={item.image}
                          alt={title}
                          aspectRatio="1/1"
                          compact
                          fallbackLabel="Gambar"
                          className="rounded-[var(--radius-sm)]"
                        />
                      </div>
                    ) : (
                      <div
                        className="size-18 shrink-0 rounded-[var(--radius-sm)] border border-[var(--border)] flex items-center justify-center bg-[var(--surface-muted)]"
                        aria-hidden="true"
                      >
                        <span
                          className="size-7 rounded-full border border-[var(--border-strong)]"
                          style={{ backgroundColor: item.colorHex }}
                        />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1.5">
                      {item.kind === 'product' ? (
                        <Link
                          to={`/produk/${encodeURIComponent(item.slug)}`}
                          onClick={closeDrawer}
                          className="block text-sm font-medium text-[var(--text)] leading-snug hover:underline"
                        >
                          {title}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-[var(--text)] leading-snug">
                          {title}
                        </p>
                      )}

                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        {getItemDetails(item)}
                      </p>

                      {item.kind === 'custom' && (
                        <div>
                          <Link
                            to="/produk/custom"
                            onClick={() => {
                              setEditingCustomLineId(item.lineId);
                              closeDrawer();
                            }}
                            className="inline-flex items-center text-xs font-medium text-[var(--text)] underline underline-offset-4 hover:text-[var(--text-muted)]"
                          >
                            Ubah konfigurasi
                          </Link>
                        </div>
                      )}

                      {priceLabel && (
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-[var(--text)] tabular-nums">
                            {priceLabel}
                          </p>
                          {item.kind === 'custom' &&
                            item.designAmount != null &&
                            item.designAmount > 0 &&
                            item.buildAmount != null &&
                            item.buildAmount > 0 && (
                              <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                                Desain {formatCurrencyIDR(item.designAmount)} · Build{' '}
                                {formatCurrencyIDR(item.buildAmount)}
                              </p>
                            )}
                        </div>
                      )}

                      <div className="pt-1 flex items-center gap-1.5">
                        <div className="flex-1 min-w-0 flex items-center justify-between border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--bg)]">
                          <button
                            type="button"
                            aria-label={`Kurangi jumlah ${title}`}
                            onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                            className="inline-flex items-center justify-center shrink-0 min-h-8 min-w-8 text-[var(--text)] hover:bg-[var(--surface-muted)] rounded-l-[var(--radius-md)] cursor-pointer"
                          >
                            <Minus className="size-3.5" aria-hidden="true" />
                          </button>
                          <span className="flex-1 px-2 text-center text-xs font-medium tabular-nums text-[var(--text)]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Tambah jumlah ${title}`}
                            onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                            className="inline-flex items-center justify-center shrink-0 min-h-8 min-w-8 text-[var(--text)] hover:bg-[var(--surface-muted)] rounded-r-[var(--radius-md)] cursor-pointer"
                          >
                            <Plus className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={buildItemWhatsAppUrl(item)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Hubungi kami tentang ${title}`}
                            title="Tanya via WhatsApp"
                            className="inline-flex items-center justify-center size-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)] transition-colors duration-150"
                          >
                            <Headset className="size-3.5" aria-hidden="true" />
                          </a>
                          <button
                            type="button"
                            aria-label={`Hapus ${title} dari keranjang`}
                            title="Hapus item"
                            onClick={() => removeItem(item.lineId)}
                            className="inline-flex items-center justify-center size-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:border-[var(--danger-border)] hover:bg-[var(--danger-surface)] transition-colors duration-150 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="px-5 py-4 sm:px-6 border-t border-[var(--border)] bg-[var(--surface)] space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-[var(--text-muted)]">
                  {formattedSubtotal && !summary.hasUnpricedItems
                    ? 'Subtotal terhitung'
                    : 'Status estimasi'}
                </span>
                <span className="text-sm font-semibold text-[var(--text)] tabular-nums text-right">
                  {formattedSubtotal && !summary.hasUnpricedItems
                    ? formattedSubtotal
                    : formattedSubtotal
                      ? `${formattedSubtotal} + konfirmasi`
                      : 'Perlu konfirmasi harga'}
                </span>
              </div>
              {summary.hasUnpricedItems && (
                <p className="text-xs text-[var(--text-muted)] leading-snug">
                  Sebagian atau seluruh item memerlukan konfirmasi harga resmi dari tim kami.
                </p>
              )}
            </div>

            <LinkButton
              to="/pesanan"
              variant="primary"
              className="w-full"
              onClick={closeDrawer}
            >
              Lanjut ke Pesanan
            </LinkButton>
          </div>
        )}
      </aside>
    </div>
  );
}
