import { useState } from 'react';
import { Link } from 'react-router';
import { Minus, PencilLine, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ImageFallback } from '../../components/ui/image-fallback';
import { getCustomServiceModeLabel } from '../../lib/custom-pricing';
import {
  formatCurrencyIDR,
  formatPreliminaryEstimate,
  formatProductPrice,
} from '../../lib/price-format';
import { calculateCartSummary, useCartStore } from '../../store/cart-store';
import type { CartItem, CustomCartItem, ProductCartItem } from '../../types/cart';
import { formatCartItemSpecifications } from './utils';

function getItemUnitPriceDisplay(item: CartItem): string {
  if (item.kind === 'product') {
    return formatProductPrice({
      price: item.unitPrice,
      priceFrom: item.priceStatus === 'mulai' ? item.unitPrice : null,
      priceStatus: item.priceStatus,
    }).label;
  }
  return formatPreliminaryEstimate(item.estimatedUnitTotal);
}

function getItemSubtotalDisplay(item: CartItem): string | null {
  if (item.kind === 'product') {
    if (item.unitPrice !== null && item.unitPrice > 0) {
      return formatCurrencyIDR(item.unitPrice * item.quantity);
    }
    return null;
  }
  if (item.estimatedUnitTotal !== null && item.estimatedUnitTotal > 0) {
    return formatCurrencyIDR(item.estimatedUnitTotal * item.quantity);
  }
  return null;
}

export function SectionOrderSummary() {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const setEditingCustomLineId = useCartStore((state) => state.setEditingCustomLineId);

  const [confirmClear, setConfirmClear] = useState(false);

  const productItems = items.filter((i): i is ProductCartItem => i.kind === 'product');
  const customItems = items.filter((i): i is CustomCartItem => i.kind === 'custom');
  const summary = calculateCartSummary(items);
  const formattedSubtotal = formatCurrencyIDR(summary.pricedSubtotal);
  const formattedDp = formatCurrencyIDR(summary.estimatedDpTotal);

  const renderCartItemRow = (item: CartItem) => {
    const title = item.kind === 'product' ? item.name : `${item.itemTypeLabel} (Custom)`;
    const specs = formatCartItemSpecifications(item);
    const unitDisplay = getItemUnitPriceDisplay(item);
    const subtotalDisplay = getItemSubtotalDisplay(item);

    return (
      <li key={item.lineId} className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row gap-4">
        <div className="w-24 shrink-0">
          {item.kind === 'product' ? (
            <ImageFallback
              src={item.image}
              alt={title}
              aspectRatio="1/1"
              fallbackLabel="Produk"
              className="rounded-[var(--radius-md)]"
            />
          ) : (
            <div
              className="aspect-square w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] flex flex-col items-center justify-center gap-1.5 p-2"
              aria-hidden="true"
            >
              <span
                className="size-8 rounded-full border border-[var(--border-strong)]"
                style={{ backgroundColor: item.colorHex }}
              />
              <span className="text-[10px] text-[var(--text-muted)] text-center truncate w-full">
                {item.serviceModeLabel || getCustomServiceModeLabel(item.serviceMode)}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h3 className="text-sm sm:text-base font-semibold text-[var(--text)] leading-snug">
                {item.kind === 'product' ? (
                  <Link
                    to={`/produk/${encodeURIComponent(item.slug)}`}
                    className="hover:underline"
                  >
                    {title}
                  </Link>
                ) : (
                  title
                )}
              </h3>
              <ul className="text-xs text-[var(--text-muted)] space-y-0.5 leading-relaxed">
                {specs.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => removeItem(item.lineId)}
              aria-label={`Hapus ${title} dari pesanan`}
              className="inline-flex items-center justify-center min-h-10 min-w-10 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--surface-muted)] transition-colors shrink-0 cursor-pointer"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs text-[var(--text-muted)]">Harga / Estimasi</p>
              <p className="text-sm font-semibold text-[var(--text)] tabular-nums">
                {subtotalDisplay ?? unitDisplay}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {item.kind === 'custom' && (
                <Link
                  to="/produk/custom"
                  onClick={() => setEditingCustomLineId(item.lineId)}
                  className="inline-flex items-center gap-1.5 min-h-10 px-3 text-xs font-medium text-[var(--text)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] rounded-[var(--radius-md)] transition-colors"
                >
                  <PencilLine className="size-3.5" aria-hidden="true" />
                  Ubah Konfigurasi
                </Link>
              )}

              <div className="inline-flex items-center border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--surface)]">
                <button
                  type="button"
                  aria-label={`Kurangi jumlah ${title}`}
                  disabled={item.quantity <= 1}
                  onClick={() => updateQuantity(item.lineId, Math.max(1, item.quantity - 1))}
                  className="inline-flex items-center justify-center min-h-10 min-w-10 text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-40 rounded-l-[var(--radius-md)] cursor-pointer"
                >
                  <Minus className="size-3.5" aria-hidden="true" />
                </button>
                <span
                  aria-label={`Jumlah ${title}: ${item.quantity}`}
                  className="px-3 text-sm font-medium tabular-nums text-[var(--text)]"
                >
                  {item.quantity}
                </span>
                <button
                  type="button"
                  aria-label={`Tambah jumlah ${title}`}
                  onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                  className="inline-flex items-center justify-center min-h-10 min-w-10 text-[var(--text)] hover:bg-[var(--surface-muted)] rounded-r-[var(--radius-md)] cursor-pointer"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </li>
    );
  };

  return (
    <section
      aria-labelledby="order-summary-heading"
      className="pt-6 border-t border-[var(--border)] space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--border)]">
        <div className="space-y-0.5">
          <h2 id="order-summary-heading" className="text-base sm:text-lg font-semibold text-[var(--text)]">
            Daftar Pesanan
          </h2>
          <p className="text-xs text-[var(--text-muted)] tabular-nums">
            {summary.lineCount} item pilihan · Total {summary.totalQuantity} unit
          </p>
        </div>

        {!confirmClear ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
            Kosongkan Pesanan
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">Hapus semua?</span>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                clearCart();
                setConfirmClear(false);
              }}
            >
              Ya, Kosongkan
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmClear(false)}>
              Batal
            </Button>
          </div>
        )}
      </div>

      {productItems.length > 0 && (
        <div className="space-y-3">
          {customItems.length > 0 && (
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Produk Pilihan
            </h3>
          )}
          <ul className="divide-y divide-[var(--border)]">
            {productItems.map(renderCartItemRow)}
          </ul>
        </div>
      )}

      {customItems.length > 0 && (
        <div
          className={[
            'space-y-3',
            productItems.length > 0 ? 'pt-5 border-t border-[var(--border)]' : '',
          ].join(' ')}
        >
          {productItems.length > 0 && (
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Perencanaan Custom Interior
            </h3>
          )}
          <ul className="divide-y divide-[var(--border)]">
            {customItems.map(renderCartItemRow)}
          </ul>
        </div>
      )}

      <div className="pt-5 border-t border-[var(--border)] space-y-2.5 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[var(--text-muted)]">
            {formattedSubtotal && !summary.hasUnpricedItems
              ? 'Subtotal Terhitung'
              : 'Status Ringkasan Biaya'}
          </span>
          <span className="text-base font-semibold text-[var(--text)] tabular-nums text-right">
            {formattedSubtotal && !summary.hasUnpricedItems
              ? formattedSubtotal
              : formattedSubtotal
                ? `${formattedSubtotal} + konfirmasi harga`
                : 'Menunggu konfirmasi harga'}
          </span>
        </div>

        {formattedDp && (
          <div className="flex items-baseline justify-between gap-4 text-xs">
            <span className="text-[var(--text-muted)]">Perkiraan Uang Muka (DP)</span>
            <span className="font-medium text-[var(--text)] tabular-nums">{formattedDp}</span>
          </div>
        )}

        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Harga maupun estimasi custom bersifat indikatif dan baru mengikat setelah pengecekan
          material, biaya pengiriman, serta konfirmasi resmi dari {`Shansusdzar Indonesia`}.
        </p>
      </div>
    </section>
  );
}
