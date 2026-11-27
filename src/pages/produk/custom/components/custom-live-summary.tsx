import { useEffect, useState, type ReactNode } from 'react';
import {
  parseProductPromo,
  resolveProductPromoMarkup,
} from '../../../../lib/catalog-pricing';
import {
  UNIFIED_SERVICE_MODE_LABEL,
  calculateCustomCostDetails,
  type CustomEstimateBreakdown,
} from '../../../../lib/custom-pricing';
import {
  DEFAULT_PAYMENT_SCHEME,
  calculatePaymentSchemeBreakdown,
} from '../../../../lib/payment-scheme';
import { formatCurrencyIDR } from '../../../../lib/price-format';
import { useSiteContentStore } from '../../../../store/site-content-store';

export interface CustomEstimateDetailsProps {
  productPromo?: string | number | null;
  finishId?: string;
  quantity: number;
  estimate: CustomEstimateBreakdown | null;
  costBreakdownTestId?: string;
  paymentSchemeTestId?: string;
  includeFreeServices?: boolean;
  activeSection?: 'all' | 'cost' | 'payment';
  showSectionHeading?: boolean;
  showPaymentBullets?: boolean;
  paymentAmountPosition?: 'right' | 'below';
}

export function CustomEstimateDetails({
  productPromo,
  finishId,
  quantity,
  estimate,
  costBreakdownTestId = 'custom-cost-breakdown',
  paymentSchemeTestId = 'custom-payment-scheme',
  includeFreeServices = true,
  activeSection = 'all',
  showSectionHeading = true,
  showPaymentBullets = true,
  paymentAmountPosition = 'right',
}: CustomEstimateDetailsProps) {
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;

  const isCatDuco = finishId === 'cat-duco';
  const formatPossiblyDuco = (amount: number | null | undefined): string | null => {
    const formatted = formatCurrencyIDR(amount);
    if (!formatted) return null;
    return isCatDuco ? `Mulai ${formatted}` : formatted;
  };
  const formatCostValue = (amount: number | null | undefined): string => {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return 'Rp 0';
    }
    return formatCurrencyIDR(amount) ?? 'Rp 0';
  };

  const isConfiguredEstimate = Boolean(estimate && estimate.status === 'configured');
  const lineTotalText = isConfiguredEstimate
    ? formatPossiblyDuco(estimate?.estimatedLineTotal)
    : null;

  const parsedPromo = parseProductPromo(productPromo);
  const promoInfo =
    isConfiguredEstimate && estimate
      ? resolveProductPromoMarkup(estimate.estimatedUnitTotal, productPromo)
      : null;

  const costDetails = isConfiguredEstimate
    ? calculateCustomCostDetails({
        estimate,
        quantity,
        promo: promoInfo,
      })
    : null;

  const showPromoRows = costDetails ? costDetails.isPromo : Boolean(parsedPromo);

  const paymentBreakdown = calculatePaymentSchemeBreakdown(
    isConfiguredEstimate ? estimate?.estimatedLineTotal : null,
    paymentScheme
  );

  const showCostSection = activeSection === 'all' || activeSection === 'cost';
  const showPaymentSection = activeSection === 'all' || activeSection === 'payment';

  return (
    <>
      {/* Catatan Penawaran Khusus jika kombinasi belum terkonfigurasi */}
      {showCostSection && estimate && (!isConfiguredEstimate || !lineTotalText) && (
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Kombinasi material &amp; finishing ini memerlukan penawaran khusus dari tim workshop.
        </p>
      )}

      {/* Rincian Biaya */}
      {showCostSection && (
        <div
          data-testid={costBreakdownTestId}
          className="space-y-2"
        >
          {showSectionHeading && (
            <h4 className="text-xs font-semibold text-[var(--text)]">Rincian Biaya</h4>
          )}

          <dl className="space-y-1.5 text-xs text-[var(--text-muted)] leading-relaxed">
            {includeFreeServices && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <dt>Biaya Survei</dt>
                  <dd className="flex items-center gap-2 tabular-nums shrink-0">
                    {costDetails && costDetails.surveyFee > 0 && (
                      <span className="line-through text-[var(--text-subtle)]">
                        {formatCostValue(costDetails.surveyFee)}
                      </span>
                    )}
                    <span className="font-medium text-[var(--text)]">Rp 0</span>
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <dt>Biaya Desain 3D</dt>
                  <dd className="flex items-center gap-2 tabular-nums shrink-0">
                    {costDetails && costDetails.design3dFee > 0 && (
                      <span className="line-through text-[var(--text-subtle)]">
                        {formatCostValue(costDetails.design3dFee)}
                      </span>
                    )}
                    <span className="font-medium text-[var(--text)]">Rp 0</span>
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <dt
                    title={
                      costDetails
                        ? `Estimasi armada: ${costDetails.deliveryFleetLabel}`
                        : 'Estimasi biaya pengiriman workshop'
                    }
                  >
                    Biaya Pengiriman
                    {costDetails && (
                      <>
                        {' '}
                        <span className="hidden sm:inline text-[11px] text-[var(--text-subtle)]">
                          ({costDetails.deliveryFleetLabel})
                        </span>
                      </>
                    )}
                  </dt>
                  <dd className="flex items-center gap-2 tabular-nums shrink-0">
                    {costDetails && costDetails.deliveryFee > 0 && (
                      <span className="line-through text-[var(--text-subtle)]">
                        {formatCostValue(costDetails.deliveryFee)}
                      </span>
                    )}
                    <span className="font-medium text-[var(--text)]">Rp 0</span>
                  </dd>
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-3">
              <dt>Harga Produk</dt>
              <dd className="tabular-nums shrink-0 font-medium text-[var(--text)]">
                {formatCostValue(costDetails?.productPriceAmount)}
              </dd>
            </div>

            {showPromoRows && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <dt>Potongan Promo</dt>
                  <dd
                    className={[
                      'tabular-nums shrink-0 font-medium',
                      costDetails && costDetails.promoDiscountAmount > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-[var(--text)]',
                    ].join(' ')}
                  >
                    {costDetails && costDetails.promoDiscountAmount > 0
                      ? `-${formatCostValue(costDetails.promoDiscountAmount)}`
                      : 'Rp 0'}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <dt>Harga Setelah Potongan</dt>
                  <dd className="tabular-nums shrink-0 font-medium text-[var(--text)]">
                    {formatCostValue(costDetails?.priceAfterDiscount)}
                  </dd>
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-3">
              <dt>PPN (11%)</dt>
              <dd className="tabular-nums shrink-0 font-medium text-[var(--text)]">
                {formatCostValue(costDetails?.ppnAmount)}
              </dd>
            </div>

          </dl>
        </div>
      )}

      {/* Skema Pembayaran Bertahap */}
      {showPaymentSection && (
        <div
          data-testid={paymentSchemeTestId}
          className="space-y-1.5"
        >
          {showSectionHeading && (
            <h4 className="text-xs font-semibold text-[var(--text)]">Skema Pembayaran</h4>
          )}

          <ul
            className={[
              'text-xs text-[var(--text-muted)] leading-relaxed',
              paymentAmountPosition === 'below' ? 'space-y-2' : 'space-y-1.5',
            ].join(' ')}
          >
            {paymentBreakdown.map((stage) => {
              const stageAmountText =
                stage.amount !== null ? formatPossiblyDuco(stage.amount) : null;
              return (
                <li
                  key={stage.id}
                  className={
                    paymentAmountPosition === 'below'
                      ? 'flex flex-col items-start gap-0.5'
                      : 'flex items-start justify-between gap-3'
                  }
                >
                  {showPaymentBullets ? (
                    <span className="flex items-start gap-1.5">
                      <span aria-hidden="true" className="shrink-0">
                        •
                      </span>
                      <span>
                        {stage.nama} {stage.persentase}%
                      </span>
                    </span>
                  ) : (
                    <span>
                      {stage.nama} {stage.persentase}%
                    </span>
                  )}
                  <span
                    className={[
                      'tabular-nums shrink-0',
                      stageAmountText ? 'font-medium text-[var(--text)]' : '',
                    ].join(' ')}
                  >
                    {stageAmountText ?? '—'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

export interface TabbedEstimateDetailsProps {
  productPromo?: string | number | null;
  finishId?: string;
  quantity: number;
  estimate: CustomEstimateBreakdown | null;
  includeFreeServices?: boolean;
  showPaymentBullets?: boolean;
  paymentAmountPosition?: 'right' | 'below';
  idPrefix?: string;
  costBreakdownTestId?: string;
  paymentSchemeTestId?: string;
  resetKey?: string | number;
  flushHorizontalBorder?: boolean;
}

export function TabbedEstimateDetails({
  productPromo,
  finishId,
  quantity,
  estimate,
  includeFreeServices = true,
  showPaymentBullets = false,
  paymentAmountPosition = 'right',
  idPrefix = 'estimate',
  costBreakdownTestId = `${idPrefix}-cost-breakdown`,
  paymentSchemeTestId = `${idPrefix}-payment-scheme`,
  resetKey,
  flushHorizontalBorder = false,
}: TabbedEstimateDetailsProps) {
  const [activeTab, setActiveTab] = useState<'cost' | 'payment'>('cost');

  useEffect(() => {
    if (resetKey !== undefined) {
      setActiveTab('cost');
    }
  }, [resetKey]);

  const costTabId = `${idPrefix}-tab-cost`;
  const paymentTabId = `${idPrefix}-tab-payment`;
  const costPanelId = `${idPrefix}-tabpanel-cost`;
  const paymentPanelId = `${idPrefix}-tabpanel-payment`;

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Detail estimasi harga"
        className={[
          'grid grid-cols-2 border-b border-[var(--border)]',
          flushHorizontalBorder ? '-mx-5 px-5' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <button
          type="button"
          role="tab"
          id={costTabId}
          data-testid={costTabId}
          aria-selected={activeTab === 'cost'}
          aria-controls={costPanelId}
          onClick={() => setActiveTab('cost')}
          className={[
            'relative pb-2.5 text-xs transition-colors text-center cursor-pointer',
            activeTab === 'cost'
              ? 'text-[var(--text)] font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]',
          ].join(' ')}
        >
          Rincian Biaya
        </button>
        <button
          type="button"
          role="tab"
          id={paymentTabId}
          data-testid={paymentTabId}
          aria-selected={activeTab === 'payment'}
          aria-controls={paymentPanelId}
          onClick={() => setActiveTab('payment')}
          className={[
            'relative pb-2.5 text-xs transition-colors text-center cursor-pointer',
            activeTab === 'payment'
              ? 'text-[var(--text)] font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]',
          ].join(' ')}
        >
          Skema Pembayaran
        </button>
      </div>

      <div className="grid grid-cols-1">
        <div
          role="tabpanel"
          id={costPanelId}
          aria-labelledby={costTabId}
          aria-hidden={activeTab !== 'cost'}
          className={[
            'col-start-1 row-start-1',
            activeTab === 'cost'
              ? ''
              : 'invisible pointer-events-none select-none',
          ].join(' ')}
        >
          <CustomEstimateDetails
            productPromo={productPromo}
            finishId={finishId}
            quantity={quantity}
            estimate={estimate}
            includeFreeServices={includeFreeServices}
            activeSection="cost"
            showSectionHeading={false}
            costBreakdownTestId={costBreakdownTestId}
          />
        </div>

        <div
          role="tabpanel"
          id={paymentPanelId}
          aria-labelledby={paymentTabId}
          aria-hidden={activeTab !== 'payment'}
          className={[
            'col-start-1 row-start-1',
            activeTab === 'payment'
              ? ''
              : 'invisible pointer-events-none select-none',
          ].join(' ')}
        >
          <CustomEstimateDetails
            productPromo={productPromo}
            finishId={finishId}
            quantity={quantity}
            estimate={estimate}
            includeFreeServices={includeFreeServices}
            activeSection="payment"
            showSectionHeading={false}
            showPaymentBullets={showPaymentBullets}
            paymentAmountPosition={paymentAmountPosition}
            paymentSchemeTestId={paymentSchemeTestId}
          />
        </div>
      </div>
    </div>
  );
}

export interface CustomLiveSummaryProps {
  hasSelectedProduct?: boolean;
  itemLabel: string;
  itemCategory?: string;
  productPromo?: string | number | null;
  finishId?: string;
  quantity: number;
  estimate: CustomEstimateBreakdown | null;
  actions?: ReactNode;
  embedded?: boolean;
}

export function CustomLiveSummary({
  hasSelectedProduct = true,
  productPromo,
  finishId,
  quantity,
  estimate,
  actions,
  embedded = false,
}: CustomLiveSummaryProps) {
  if (!hasSelectedProduct) {
    return (
      <aside
        data-testid="custom-estimate-card"
        aria-label="Hasil perhitungan estimasi langsung"
        className={
          embedded
            ? 'space-y-4'
            : 'rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-2xs space-y-4'
        }
      >
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[var(--text-muted)]">
            Estimasi {UNIFIED_SERVICE_MODE_LABEL}
          </p>
          <p className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text)]">
            Memuat Pilihan Produk
          </p>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Pilih produk dari katalog terlebih dahulu untuk memulai estimasi ukuran.
          </p>
        </div>
        {actions && <div className="pt-3 border-t border-[var(--border)] space-y-2.5">{actions}</div>}
      </aside>
    );
  }

  const isCatDuco = finishId === 'cat-duco';
  const formatPossiblyDuco = (amount: number | null | undefined): string | null => {
    const formatted = formatCurrencyIDR(amount);
    if (!formatted) return null;
    return isCatDuco ? `Mulai ${formatted}` : formatted;
  };

  const isConfiguredEstimate = Boolean(estimate && estimate.status === 'configured');
  const lineTotalText = isConfiguredEstimate
    ? formatPossiblyDuco(estimate?.estimatedLineTotal)
    : null;

  const promoInfo =
    isConfiguredEstimate && estimate
      ? resolveProductPromoMarkup(estimate.estimatedUnitTotal, productPromo)
      : null;
  const isPromoActive = Boolean(promoInfo?.promoActive && lineTotalText);
  const compareAtLineTotal =
    promoInfo?.promoActive && promoInfo.compareAtPrice !== null
      ? promoInfo.compareAtPrice * quantity
      : null;
  const compareAtLineTotalText = formatPossiblyDuco(compareAtLineTotal);

  return (
    <aside
      data-testid="custom-estimate-card"
      aria-label="Hasil perhitungan estimasi langsung"
      className={
        embedded
          ? 'space-y-4'
          : 'rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-2xs space-y-5'
      }
    >
      {/* Live Estimate Price Card */}
      <div
        data-testid="custom-price-card"
        className={[
          'rounded-[var(--radius-lg)] px-5 py-4 border transition-colors',
          isPromoActive
            ? 'border-red-500 bg-red-600 text-white'
            : 'border-[var(--border)] bg-[var(--surface-muted)]',
        ].join(' ')}
      >
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <p
              className={[
                'text-xs font-medium',
                isPromoActive ? 'text-white/90' : 'text-[var(--text-muted)]',
              ].join(' ')}
            >
              Estimasi Harga
            </p>
            {isPromoActive && promoInfo?.promoPercentLabel && (
              <span
                data-testid="custom-promo-badge"
                className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] border border-yellow-300 bg-yellow-400 text-zinc-900 text-[11px] font-bold leading-tight tabular-nums"
              >
                Hemat {promoInfo.promoPercentLabel}
              </span>
            )}
          </div>

          <div className="flex flex-col items-end text-right shrink-0">
            {isPromoActive && compareAtLineTotalText && (
              <p
                data-testid="custom-compare-at-price"
                className="text-xs sm:text-sm font-medium text-white/80 line-through tabular-nums leading-tight"
              >
                {compareAtLineTotalText}
              </p>
            )}
            <p
              data-testid="custom-live-price"
              className={[
                'text-xl lg:text-2xl font-extrabold tabular-nums leading-tight',
                isPromoActive ? 'text-white' : 'text-[var(--text)]',
              ].join(' ')}
            >
              {!estimate
                ? 'Isi ukuran (cm)'
                : isConfiguredEstimate && lineTotalText
                  ? lineTotalText
                  : 'Hubungi Kami'}
            </p>
          </div>
        </div>
      </div>

      <TabbedEstimateDetails
        productPromo={productPromo}
        finishId={finishId}
        quantity={quantity}
        estimate={estimate}
        includeFreeServices
        showPaymentBullets={false}
        paymentAmountPosition="below"
        idPrefix="custom"
        costBreakdownTestId="custom-cost-breakdown"
        paymentSchemeTestId="custom-payment-scheme"
      />

      {actions && <div className="pt-3 border-t border-[var(--border)] space-y-2.5">{actions}</div>}
    </aside>
  );
}
