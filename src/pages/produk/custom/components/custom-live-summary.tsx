import type { ReactNode } from 'react';
import { getCustomServiceModeLabel, type CustomEstimateBreakdown } from '../../../../lib/custom-pricing';
import { formatCurrencyIDR } from '../../../../lib/price-format';
import type { RoomDimensionsInput } from '../../../../types/cart';
import { formatConvertedDimensionDisplay } from '../custom-config';

export interface CustomLiveSummaryProps {
  projectLabel: string;
  itemLabel: string;
  dimensions: RoomDimensionsInput | null;
  materialLabel: string;
  finishLabel: string;
  colorName: string;
  colorHex: string;
  optionLabels: string[];
  quantity: number;
  estimate: CustomEstimateBreakdown;
  actions?: ReactNode;
}

export function CustomLiveSummary({
  projectLabel,
  itemLabel,
  dimensions,
  materialLabel,
  finishLabel,
  colorName,
  colorHex,
  optionLabels,
  quantity,
  estimate,
  actions,
}: CustomLiveSummaryProps) {
  const serviceModeLabel = getCustomServiceModeLabel(estimate.serviceMode);
  const designAmountText = formatCurrencyIDR(estimate.designAmount);
  const designRateText = formatCurrencyIDR(estimate.designRatePerSqm);
  const materialAmountText = formatCurrencyIDR(estimate.materialAmount);
  const finishingAmountText = formatCurrencyIDR(estimate.finishingAmount);
  const materialRateText = formatCurrencyIDR(estimate.materialRatePerSqm);
  const finishingRateText = formatCurrencyIDR(estimate.finishingRatePerSqm);
  const buildAmountText = formatCurrencyIDR(estimate.buildAmount);
  const optionsAmountText = formatCurrencyIDR(estimate.optionsAmount);
  const unitPriceText = formatCurrencyIDR(estimate.estimatedUnitTotal);
  const lineTotalText = formatCurrencyIDR(estimate.estimatedLineTotal);
  const dpLineText = formatCurrencyIDR(estimate.estimatedDpLineTotal);
  const isDesignOnly = estimate.serviceMode === 'design-only';

  return (
    <aside
      aria-label="Hasil perhitungan estimasi langsung"
      className="pt-6 border-t lg:pt-0 lg:border-t-0 lg:border-l lg:pl-8 border-[var(--border)] space-y-5"
    >
      {/* Live Estimate Hero Result */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-medium text-[var(--text-muted)]">
              Estimasi {serviceModeLabel}
            </p>
            <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text)] tabular-nums break-words">
              {estimate.status === 'configured' && lineTotalText
                ? lineTotalText
                : 'Hubungi Kami'}
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-[var(--text-muted)] tabular-nums pt-0.5">
            {estimate.areaSquareMeters} m²
          </span>
        </div>

        {estimate.status === 'configured' && lineTotalText && (
          <div className="pt-3 border-t border-[var(--border)] space-y-1.5 text-xs">
            {designAmountText && (
              <div className="flex justify-between gap-4 text-[var(--text-muted)]">
                <span>
                  Jasa Desain ({estimate.areaSquareMeters} m²
                  {designRateText ? ` × ${designRateText}` : ''})
                </span>
                <span className="font-medium text-[var(--text)] tabular-nums shrink-0">
                  {designAmountText}
                </span>
              </div>
            )}

            {materialAmountText && (
              <div className="flex justify-between gap-4 text-[var(--text-muted)]">
                <span>
                  Bahan {materialLabel} ({estimate.areaSquareMeters} m²
                  {materialRateText ? ` × ${materialRateText}` : ''})
                </span>
                <span className="font-medium text-[var(--text)] tabular-nums shrink-0">
                  {materialAmountText}
                </span>
              </div>
            )}

            {finishingAmountText && (
              <div className="flex justify-between gap-4 text-[var(--text-muted)]">
                <span>
                  Finishing/Laminasi {finishLabel} ({estimate.areaSquareMeters} m²
                  {finishingRateText ? ` × ${finishingRateText}` : ''})
                </span>
                <span className="font-medium text-[var(--text)] tabular-nums shrink-0">
                  {finishingAmountText}
                </span>
              </div>
            )}

            {estimate.serviceMode === 'design-and-build' && buildAmountText && (
              <div className="flex justify-between gap-4 pt-1 border-t border-[var(--border)]/60 text-[var(--text-muted)]">
                <span>Subtotal Build ({estimate.areaSquareMeters} m²)</span>
                <span className="font-medium text-[var(--text)] tabular-nums shrink-0">
                  {buildAmountText}
                </span>
              </div>
            )}

            {optionsAmountText && (estimate.optionsAmount ?? 0) > 0 && (
              <div className="flex justify-between gap-4 text-[var(--text-muted)]">
                <span>Opsi tambahan</span>
                <span className="font-medium text-[var(--text)] tabular-nums shrink-0">
                  + {optionsAmountText}
                </span>
              </div>
            )}

            {unitPriceText && quantity > 1 && (
              <div className="flex justify-between gap-4 text-[var(--text-muted)]">
                <span>Harga per unit (× {quantity})</span>
                <span className="font-medium text-[var(--text)] tabular-nums shrink-0">
                  {unitPriceText}
                </span>
              </div>
            )}

            {dpLineText && estimate.dpPercentage !== null && (
              <div className="flex justify-between gap-4 pt-1.5 border-t border-[var(--border)] text-[var(--text-muted)]">
                <span>Perkiraan DP ({estimate.dpPercentage}%)</span>
                <span className="font-semibold text-[var(--text)] tabular-nums shrink-0">
                  {dpLineText}
                </span>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-[var(--text-muted)] leading-relaxed">{estimate.disclaimer}</p>
      </div>

      {/* Selected Item Header */}
      <div className="space-y-1 pb-3 border-b border-[var(--border)]">
        <p className="text-xs font-medium text-[var(--text-muted)]">
          Rincian Pilihan Aktif · {serviceModeLabel}
        </p>
        <h3 className="text-base font-semibold text-[var(--text)]">{itemLabel}</h3>
        <p className="text-xs text-[var(--text-muted)]">{projectLabel}</p>
      </div>

      <dl className="space-y-2.5 text-xs">
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-muted)]">Jenis Layanan</dt>
          <dd className="text-right text-[var(--text)] font-medium">{serviceModeLabel}</dd>
        </div>

        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-muted)]">Ukuran (P × L)</dt>
          <dd className="text-right text-[var(--text)] font-medium tabular-nums">
            {dimensions ? (
              <>
                <span>
                  {dimensions.length} × {dimensions.width} {dimensions.unit}
                </span>
                <span className="block font-normal text-[var(--text-muted)]">
                  {formatConvertedDimensionDisplay(dimensions)}
                </span>
              </>
            ) : (
              'Menyesuaikan ukuran'
            )}
          </dd>
        </div>

        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-muted)]">
            {isDesignOnly ? 'Ref. Material Utama' : 'Material Utama'}
          </dt>
          <dd className="text-right text-[var(--text)] font-medium">{materialLabel}</dd>
        </div>

        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-muted)]">
            {isDesignOnly ? 'Ref. Finishing/Laminasi' : 'Finishing/Laminasi'}
          </dt>
          <dd className="text-right text-[var(--text)] font-medium">{finishLabel}</dd>
        </div>

        <div className="flex justify-between items-center gap-4">
          <dt className="text-[var(--text-muted)]">Palet Warna</dt>
          <dd className="inline-flex items-center gap-2 text-[var(--text)] font-medium">
            <span
              className="size-3.5 rounded-full border border-[var(--border-strong)] shrink-0"
              style={{ backgroundColor: colorHex }}
              aria-hidden="true"
            />
            <span>{colorName}</span>
          </dd>
        </div>

        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-muted)]">Opsi Tambahan</dt>
          <dd className="text-right text-[var(--text)]">
            {optionLabels.length > 0 ? optionLabels.join(', ') : 'Standar'}
          </dd>
        </div>

        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-muted)]">Jumlah Unit</dt>
          <dd className="text-right text-[var(--text)] font-medium tabular-nums">{quantity}</dd>
        </div>
      </dl>

      {actions && <div className="pt-3 border-t border-[var(--border)] space-y-2.5">{actions}</div>}
    </aside>
  );
}
