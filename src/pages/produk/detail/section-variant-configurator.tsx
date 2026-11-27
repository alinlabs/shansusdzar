import { useEffect, useState, type RefObject } from 'react';
import { Link } from 'react-router';
import { ChevronDown, Headset, Info, Minus, MoveHorizontal, MoveVertical, Plus } from 'lucide-react';
import { Button, ExternalLinkButton } from '../../../components/ui/button';
import { CartPlusIcon } from '../../../components/ui/cart-plus-icon';
import { ColorOptionPicker } from '../../../components/ui/color-option-picker';
import { UNIVERSAL_COLOR_PALETTE } from '../../../lib/color-palette';
import { useUserProfileStore } from '../../../store/user-profile-store';
import type { ProductItem } from '../../../types/product';
import { TabbedEstimateDetails } from '../custom/components/custom-live-summary';
import { EqualOptionGrid } from '../custom/components/equal-option-grid';
import { CustomisasiOptionPicker } from './customisasi-option-picker';
import type { ProductDetailDerived } from './detail-logic';

export interface SectionVariantConfiguratorProps {
  product: ProductItem;
  detailDerived: ProductDetailDerived;
  customLengthCm: string;
  customWidthCm: string;
  isCustomSizeMode: boolean;
  quantity: number;
  customLengthInputRef: RefObject<HTMLInputElement | null>;
  onCustomLengthChange: (val: string) => void;
  onCustomWidthChange: (val: string) => void;
  onSelectPresetSize: (lengthCm: number, widthCm: number) => void;
  onRestoreRecommendedSize: () => void;
  onToggleCustomSize: () => void;
  onSelectColorId: (colorId: string) => void;
  onSelectCustomisasi: (val: string) => void;
  onSelectMaterialLabel: (label: string) => void;
  onSelectFinishLabel: (label: string) => void;
  onDecreaseQuantity: () => void;
  onIncreaseQuantity: () => void;
  onAddToCart: () => void;
}

export function SectionVariantConfigurator({
  product,
  detailDerived,
  customLengthCm,
  customWidthCm,
  isCustomSizeMode,
  quantity,
  customLengthInputRef,
  onCustomLengthChange,
  onCustomWidthChange,
  onSelectPresetSize,
  onRestoreRecommendedSize,
  onToggleCustomSize,
  onSelectColorId,
  onSelectCustomisasi,
  onSelectMaterialLabel,
  onSelectFinishLabel,
  onDecreaseQuantity,
  onIncreaseQuantity,
  onAddToCart,
}: SectionVariantConfiguratorProps) {
  const [isPriceDetailsOpen, setIsPriceDetailsOpen] = useState(true);
  const syncProfileActivity = useUserProfileStore((state) => state.syncProfileActivity);

  useEffect(() => {
    setIsPriceDetailsOpen(true);
  }, [product.id]);

  const {
    selectedColor,
    availableMaterialLabels,
    availableFinishLabels,
    activeMaterialLabel,
    activeFinishLabel,
    activeCustomisasi,
    variantPrice,
    formattedDisplayPrice,
    formattedCompareAtDisplayPrice,
    referenceSizePresets,
    matchedPresetSize,
    includedItems,
    estimateBreakdown,
    whatsappInquiry,
  } = detailDerived;

  return (
    <div data-testid="detail-right-configurator" className="lg:col-span-5 space-y-5">
      {/* 1. Pilih Ukuran: 3 Reference Size Badges or 2-Column Custom Inputs */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-[var(--text-muted)]">Pilih Ukuran</p>
          {referenceSizePresets.length > 0 && (
            <button
              type="button"
              data-testid="detail-size-mode-toggle"
              onClick={onToggleCustomSize}
              className="inline-flex items-center gap-1 text-xs font-normal text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              <span>{isCustomSizeMode ? 'Referensi' : 'Customisasi'}</span>
              <ChevronDown
                className={[
                  'size-3.5 shrink-0 transition-transform duration-150 ease-[var(--ease-studio)]',
                  isCustomSizeMode ? 'rotate-180' : '',
                ].join(' ')}
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        {isCustomSizeMode || referenceSizePresets.length === 0 ? (
          <div
            data-testid="detail-custom-size-inputs"
            className="grid grid-cols-2 gap-3 sm:gap-4"
          >
            {/* Kolom 1: Panjang (cm) */}
            <div className="min-w-0">
              <div className="flex items-stretch h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] transition-colors duration-150 hover:border-[var(--border-strong)] focus-within:border-[var(--border-strong)]">
                <label
                  htmlFor="detail-custom-length"
                  title="Panjang (cm)"
                  className="inline-flex items-center justify-center px-2.5 sm:px-3 border-r border-[var(--border)] bg-[var(--surface-muted)]/55 text-[11px] font-semibold text-[var(--text-muted)] select-none shrink-0 cursor-text rounded-l-[calc(var(--radius-md)-1px)]"
                >
                  <MoveHorizontal className="size-3.5 sm:hidden" aria-hidden="true" />
                  <span className="hidden sm:inline" aria-hidden="true">
                    Panjang
                  </span>
                  <span className="sr-only">Panjang (cm)</span>
                </label>
                <input
                  ref={customLengthInputRef}
                  id="detail-custom-length"
                  type="number"
                  inputMode="numeric"
                  aria-label="Panjang (cm)"
                  min={1}
                  step={5}
                  value={customLengthCm}
                  onChange={(e) => onCustomLengthChange(e.target.value)}
                  className="flex-1 w-full min-w-0 bg-transparent px-2.5 sm:px-3 text-center text-xs font-medium tabular-nums text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none focus:outline-none focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center px-2.5 sm:px-3 border-l border-[var(--border)] bg-[var(--surface-muted)]/55 text-[11px] font-semibold text-[var(--text-muted)] select-none shrink-0 rounded-r-[calc(var(--radius-md)-1px)]"
                >
                  cm
                </span>
              </div>
            </div>

            {/* Kolom 2: Tinggi (cm) */}
            <div className="min-w-0">
              <div className="flex items-stretch h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] transition-colors duration-150 hover:border-[var(--border-strong)] focus-within:border-[var(--border-strong)]">
                <label
                  htmlFor="detail-custom-width"
                  title="Tinggi (cm)"
                  className="inline-flex items-center justify-center px-2.5 sm:px-3 border-r border-[var(--border)] bg-[var(--surface-muted)]/55 text-[11px] font-semibold text-[var(--text-muted)] select-none shrink-0 cursor-text rounded-l-[calc(var(--radius-md)-1px)]"
                >
                  <MoveVertical className="size-3.5 sm:hidden" aria-hidden="true" />
                  <span className="hidden sm:inline" aria-hidden="true">
                    Tinggi
                  </span>
                  <span className="sr-only">Tinggi (cm)</span>
                </label>
                <input
                  id="detail-custom-width"
                  type="number"
                  inputMode="numeric"
                  aria-label="Tinggi (cm)"
                  min={1}
                  step={5}
                  value={customWidthCm}
                  onChange={(e) => onCustomWidthChange(e.target.value)}
                  className="flex-1 w-full min-w-0 bg-transparent px-2.5 sm:px-3 text-center text-xs font-medium tabular-nums text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none focus:outline-none focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center px-2.5 sm:px-3 border-l border-[var(--border)] bg-[var(--surface-muted)]/55 text-[11px] font-semibold text-[var(--text-muted)] select-none shrink-0 rounded-r-[calc(var(--radius-md)-1px)]"
                >
                  cm
                </span>
              </div>
            </div>
          </div>
        ) : (
          <EqualOptionGrid
            items={referenceSizePresets.map((preset) => ({
              id: preset.normalized,
              label: `${preset.lengthCm}×${preset.widthCm} cm`,
            }))}
            selectedId={matchedPresetSize?.normalized ?? null}
            onSelect={(normalized) => {
              const matched = referenceSizePresets.find((p) => p.normalized === normalized);
              if (matched) {
                onSelectPresetSize(matched.lengthCm, matched.widthCm);
              }
            }}
            ariaLabel="Pilih ukuran referensi"
            testId="detail-reference-size-group"
          />
        )}
      </div>

      {/* 2. Material Utama dan Finishing/Laminasi */}

      {availableMaterialLabels.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-start gap-1.5">
            <p className="text-xs font-medium text-[var(--text-muted)]">Material Utama</p>
            <Link
              to="/tips-interior?kategori=papan#material-matrix-heading"
              data-testid="detail-compare-material-btn"
              aria-label="Bandingkan Material"
              title="Bandingkan Material"
              className="inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0"
            >
              <Info className="size-3.5 shrink-0" aria-hidden="true" />
            </Link>
          </div>
          <EqualOptionGrid
            items={availableMaterialLabels.map((matLabel) => ({ id: matLabel, label: matLabel }))}
            selectedId={activeMaterialLabel}
            onSelect={onSelectMaterialLabel}
            ariaLabel="Material Utama"
            testId="detail-material-group"
          />
        </div>
      )}

      {availableFinishLabels.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-start gap-1.5">
            <p className="text-xs font-medium text-[var(--text-muted)]">Finishing/Laminasi</p>
            <Link
              to="/tips-interior?kategori=finishing#material-matrix-heading"
              data-testid="detail-compare-finishing-btn"
              aria-label="Bandingkan Laminasi"
              title="Bandingkan Laminasi"
              className="inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0"
            >
              <Info className="size-3.5 shrink-0" aria-hidden="true" />
            </Link>
          </div>
          <EqualOptionGrid
            items={availableFinishLabels.map((finLabel) => ({ id: finLabel, label: finLabel }))}
            selectedId={activeFinishLabel}
            onSelect={onSelectFinishLabel}
            ariaLabel="Finishing/Laminasi"
            testId="detail-finish-group"
          />
        </div>
      )}

      {/* 3. Customisasi | Pilihan Warna — 2 Kolom Sejajar di Bawah Finishing (Mobile & Desktop) */}
      {(product.customisasi.length > 0 || UNIVERSAL_COLOR_PALETTE.length > 0) && (
        <div
          className={
            product.customisasi.length > 0 && UNIVERSAL_COLOR_PALETTE.length > 0
              ? 'grid grid-cols-2 gap-3 sm:gap-4'
              : 'grid grid-cols-1'
          }
        >
          {product.customisasi.length > 0 && (
            <div className="min-w-0 space-y-2.5">
              <p className="text-xs font-medium text-[var(--text-muted)]">Customisasi</p>
              <CustomisasiOptionPicker
                options={product.customisasi}
                value={activeCustomisasi}
                onChange={onSelectCustomisasi}
                label="Customisasi"
                productName={product.nama}
                className="h-11 text-xs"
              />
            </div>
          )}

          {UNIVERSAL_COLOR_PALETTE.length > 0 && (
            <div className="min-w-0 space-y-2.5">
              <p className="text-xs font-medium text-[var(--text-muted)]">Pilihan Warna</p>
              <ColorOptionPicker
                colors={UNIVERSAL_COLOR_PALETTE}
                value={selectedColor.id}
                onChange={onSelectColorId}
                label="Pilihan Warna"
                showNuanceNote="mobile-only"
                className="h-11 text-xs"
              />
            </div>
          )}
        </div>
      )}

      {/* Mobile-only Description & Included Items below Finishing */}
      {product.deskripsiSingkat?.trim() && (
        <div data-testid="detail-mobile-description" className="md:hidden space-y-1.5">
          <p className="text-xs font-medium text-[var(--text)]">Deskripsi</p>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed text-justify">
            {product.deskripsiSingkat}
          </p>
        </div>
      )}

      {includedItems.length > 0 && (
        <div data-testid="detail-mobile-included-items" className="md:hidden space-y-1.5">
          <p className="text-xs font-medium text-[var(--text)]">Sudah Termasuk (Include)</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--text-muted)] leading-relaxed">
            {includedItems.map((itemText) => (
              <li key={itemText} className="flex items-start gap-1.5">
                <span aria-hidden="true" className="shrink-0">
                  •
                </span>
                <span>{itemText}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 4. Primary Price Card & Purchase Actions (Desktop only — mobile lives in adaptive bottom bar) */}
      <div data-testid="detail-desktop-actions" className="hidden md:block pt-1 space-y-3">
        <button
          type="button"
          data-testid="detail-price-card"
          aria-expanded={isPriceDetailsOpen}
          aria-controls="detail-desktop-price-breakdown"
          onClick={() => setIsPriceDetailsOpen((prev) => !prev)}
          className={[
            'w-full text-left rounded-[var(--radius-lg)] px-5 py-4 border transition-colors cursor-pointer',
            variantPrice.promoActive
              ? 'border-red-500 bg-red-600 text-white hover:bg-red-600/95'
              : 'border-[var(--border)] bg-[var(--surface-muted)] hover:border-[var(--border-strong)]',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <p
                className={[
                  'text-xs font-medium',
                  variantPrice.promoActive ? 'text-white/90' : 'text-[var(--text-muted)]',
                ].join(' ')}
              >
                Estimasi Harga · {detailDerived.activeLengthCm}×{detailDerived.activeWidthCm} cm
              </p>
              {variantPrice.promoActive && variantPrice.promoPercentLabel && (
                <span
                  data-testid="detail-promo-badge"
                  className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] border border-yellow-300 bg-yellow-400 text-zinc-900 text-[11px] font-bold leading-tight tabular-nums"
                >
                  Hemat {variantPrice.promoPercentLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex flex-col items-end text-right">
                {variantPrice.promoActive && formattedCompareAtDisplayPrice && (
                  <p
                    data-testid="detail-compare-at-price"
                    className="text-xs sm:text-sm font-medium text-white/80 line-through tabular-nums leading-tight"
                  >
                    {formattedCompareAtDisplayPrice}
                  </p>
                )}
                <p
                  data-testid="detail-live-price"
                  className={[
                    'text-xl lg:text-2xl font-extrabold tabular-nums leading-tight',
                    variantPrice.promoActive ? 'text-white' : 'text-[var(--text)]',
                  ].join(' ')}
                >
                  {formattedDisplayPrice}
                </p>
              </div>
              <ChevronDown
                className={[
                  'size-4 shrink-0 transition-transform duration-150 ease-[var(--ease-studio)]',
                  variantPrice.promoActive ? 'text-white/90' : 'text-[var(--text-muted)]',
                  isPriceDetailsOpen ? 'rotate-180' : '',
                ].join(' ')}
                aria-hidden="true"
              />
            </div>
          </div>
        </button>

        {isPriceDetailsOpen && (
          <div
            id="detail-desktop-price-breakdown"
            data-testid="detail-desktop-price-breakdown"
            className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-5 py-3.5"
          >
            <TabbedEstimateDetails
              productPromo={product.promo}
              finishId={variantPrice.finishId ?? undefined}
              quantity={quantity}
              estimate={estimateBreakdown}
              includeFreeServices={false}
              showPaymentBullets={false}
              idPrefix="detail"
              costBreakdownTestId="detail-cost-breakdown"
              paymentSchemeTestId="detail-payment-scheme"
              resetKey={product.id}
              flushHorizontalBorder
            />
          </div>
        )}

        <div className="flex flex-wrap sm:flex-nowrap items-stretch gap-2.5">
          <div className="w-28 sm:w-32 shrink-0 h-12 inline-flex items-center justify-between border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--surface)]">
            <button
              type="button"
              aria-label="Kurangi jumlah produk"
              disabled={quantity <= 1}
              onClick={onDecreaseQuantity}
              className="inline-flex items-center justify-center w-9 sm:w-10 h-full shrink-0 text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-40 rounded-l-[var(--radius-md)] cursor-pointer"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span
              aria-label={`Jumlah unit: ${quantity}`}
              className="flex-1 text-center text-sm font-medium tabular-nums text-[var(--text)]"
            >
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Tambah jumlah produk"
              disabled={quantity >= 99}
              onClick={onIncreaseQuantity}
              className="inline-flex items-center justify-center w-9 sm:w-10 h-full shrink-0 text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-40 rounded-r-[var(--radius-md)] cursor-pointer"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>

          <Button
            variant="secondary"
            size="lg"
            onClick={onAddToCart}
            data-testid="detail-desktop-add-to-cart"
            className="flex-1 min-w-[205px] h-12 px-4 sm:px-5 whitespace-nowrap"
          >
            <CartPlusIcon className="size-4 shrink-0" aria-hidden="true" />
            <span>Tambah ke Keranjang</span>
          </Button>
        </div>

        <ExternalLinkButton
          href={whatsappInquiry}
          target="_blank"
          rel="noopener noreferrer"
          variant="primary"
          size="lg"
          fullWidth
          onClick={() =>
            syncProfileActivity(`Konsultasi produk: ${product.nama}`, [
              'profil-user',
              'konsultasi-wa',
            ])
          }
          aria-label="Konsultasi via WhatsApp"
          data-testid="detail-desktop-consultation"
        >
          <Headset className="size-4 shrink-0" aria-hidden="true" />
          <span>Konsultasi</span>
        </ExternalLinkButton>
      </div>
    </div>
  );
}
