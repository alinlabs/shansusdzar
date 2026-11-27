import { useEffect, useMemo, useState } from 'react';
import { CircleDonutChart } from '../../../components/charts/circle-donut-chart';
import { LineTrendChart, type LineSeriesConfig } from '../../../components/charts/line-trend-chart';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import {
  buildDailyTrafficLineSeries,
  buildFinanceDonutDistribution,
  buildMonthlyIntegratedSeries,
  buildRouteDistribution,
  computeTrafficSummary,
  resolveTerminProductLabel,
} from '../../../lib/dashboard-analytics';
import {
  computeFinanceSummary,
  computeInvoiceProgress,
  formatRupiahSigned,
} from '../../../lib/finance-utils';
import { computePortfolioReviewStats } from '../../../lib/portfolio-filter';
import { canViewPage } from '../../../lib/rbac';
import { useAdminAuthStore } from '../../../store/admin-auth-store';
import { useAnalyticsStore } from '../../../store/analytics-store';
import { calculateCartSummary, useCartStore } from '../../../store/cart-store';
import { useFinanceStore } from '../../../store/finance-store';
import { useSiteContentStore } from '../../../store/site-content-store';
import type { AnalyticsTimeframe } from '../../../types/analytics';
import { AdminPageHeader } from '../admin-shell';

type LineChartMode = 'daily-traffic' | 'monthly-integrated';
type DonutChartMode = 'routes' | 'income' | 'expense';

function formatCompactRupiah(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1)} jt`;
  if (abs >= 1_000) return `${sign}Rp ${Math.round(abs / 1_000)} rb`;
  return `${sign}Rp ${Math.round(abs)}`;
}

export default function AdminDashboardPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const portfolioProjects = useSiteContentStore((state) => state.portfolioProjects);
  const newsArticles = useSiteContentStore((state) => state.newsArticles);
  const materials = useSiteContentStore((state) => state.materials);
  const faqs = useSiteContentStore((state) => state.faqs);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);

  const financeTransactions = useFinanceStore((state) => state.transactions);
  const financeInvoices = useFinanceStore((state) => state.invoices);

  const dailyTraffic = useAnalyticsStore((state) => state.dailyTraffic);
  const monthlyArchive = useAnalyticsStore((state) => state.monthlyArchive);

  const cartItems = useCartStore((state) => state.items);

  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('30d');
  const [lineMode, setLineMode] = useState<LineChartMode>('daily-traffic');
  const [donutMode, setDonutMode] = useState<DonutChartMode>('routes');

  useDocumentTitle(`Dashboard | Admin ${shortBrandName}`);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canViewFinance = canViewPage(currentUser, 'keuangan');

  const activeCatalog = catalogOverride ?? loadedBaseCatalog;
  const productCount = activeCatalog?.daftarProduk.length ?? 0;
  const portfolioReviewStats = useMemo(
    () => computePortfolioReviewStats(portfolioProjects),
    [portfolioProjects]
  );
  const publishedPortfolioCount = portfolioReviewStats.totalProjects;
  const publishedNewsCount = newsArticles.length;

  const financeSummary = useMemo(
    () => computeFinanceSummary(financeTransactions, financeInvoices),
    [financeTransactions, financeInvoices]
  );

  const trafficSummary = useMemo(
    () => computeTrafficSummary(dailyTraffic, timeframe),
    [dailyTraffic, timeframe]
  );

  const dailyLineData = useMemo(
    () => buildDailyTrafficLineSeries(dailyTraffic, timeframe),
    [dailyTraffic, timeframe]
  );

  const monthlyIntegratedData = useMemo(
    () => buildMonthlyIntegratedSeries(monthlyArchive, financeTransactions),
    [monthlyArchive, financeTransactions]
  );

  const routeDistribution = useMemo(
    () => buildRouteDistribution(dailyTraffic, timeframe),
    [dailyTraffic, timeframe]
  );

  const incomeDistribution = useMemo(
    () => buildFinanceDonutDistribution(financeTransactions, 'pemasukan'),
    [financeTransactions]
  );

  const expenseDistribution = useMemo(
    () => buildFinanceDonutDistribution(financeTransactions, 'pengeluaran'),
    [financeTransactions]
  );

  const catalogProductNames = useMemo(
    () => (activeCatalog?.daftarProduk ?? []).map((item) => item.nama),
    [activeCatalog]
  );

  const cartSummary = useMemo(() => calculateCartSummary(cartItems), [cartItems]);

  const resolvedLineMode: LineChartMode =
    !canViewFinance && lineMode === 'monthly-integrated' ? 'daily-traffic' : lineMode;
  const resolvedDonutMode: DonutChartMode =
    !canViewFinance && donutMode !== 'routes' ? 'routes' : donutMode;

  const dailyLineSeries: LineSeriesConfig[] = [
    {
      key: 'pageViews',
      label: 'Tayangan Halaman',
      colorVar: 'var(--chart-1)',
      yAxis: 'left',
      areaFill: true,
      formatValue: (v) => `${Math.round(v).toLocaleString('id-ID')} tayangan`,
    },
    {
      key: 'visitors',
      label: 'Pengunjung Unik',
      colorVar: 'var(--chart-2)',
      yAxis: 'left',
      formatValue: (v) => `${Math.round(v).toLocaleString('id-ID')} orang`,
    },
    {
      key: 'interactions',
      label: 'Aksi Katalog & Pesanan',
      colorVar: 'var(--chart-3)',
      yAxis: 'left',
      formatValue: (v) => `${Math.round(v).toLocaleString('id-ID')} aksi`,
    },
  ];

  const monthlyIntegratedSeries: LineSeriesConfig[] = [
    {
      key: 'income',
      label: 'Pemasukan Kas',
      colorVar: 'var(--chart-1)',
      yAxis: 'left',
      areaFill: true,
      formatValue: (v) => formatRupiahSigned(v),
    },
    {
      key: 'expense',
      label: 'Pengeluaran Kas',
      colorVar: 'var(--chart-6)',
      yAxis: 'left',
      formatValue: (v) => formatRupiahSigned(v),
    },
    {
      key: 'visitors',
      label: 'Pengunjung Situs',
      colorVar: 'var(--chart-2)',
      yAxis: 'right',
      dashed: true,
      formatValue: (v) => `${Math.round(v).toLocaleString('id-ID')} pengunjung`,
    },
  ];

  const activeDonutConfig = (() => {
    if (resolvedDonutMode === 'income') {
      return {
        slices: incomeDistribution.slices,
        centerLabel: 'Total Pemasukan',
        centerValue: formatCompactRupiah(incomeDistribution.totalAmount),
        emptyMessage: 'Belum ada transaksi pemasukan selesai.',
      };
    }
    if (resolvedDonutMode === 'expense') {
      return {
        slices: expenseDistribution.slices,
        centerLabel: 'Total Pengeluaran',
        centerValue: formatCompactRupiah(expenseDistribution.totalAmount),
        emptyMessage: 'Belum ada transaksi pengeluaran selesai.',
      };
    }
    return {
      slices: routeDistribution.slices,
      centerLabel: `${trafficSummary.timeframeDays} Hari`,
      centerValue: `${routeDistribution.totalViews.toLocaleString('id-ID')}`,
      emptyMessage: 'Belum ada data kunjungan halaman.',
    };
  })();

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        title="Dashboard"
        actions={
          <div
            role="group"
            aria-label="Rentang waktu statistik"
            className="inline-flex items-center p-0.5 sm:p-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)]/60"
          >
            {(['7d', '14d', '30d'] as const).map((tf) => {
              const active = timeframe === tf;
              const shortLabel = tf === '7d' ? '7H' : tf === '14d' ? '14H' : '30H';
              const fullLabel = tf === '7d' ? '7 Hari' : tf === '14d' ? '14 Hari' : '30 Hari';
              return (
                <button
                  key={tf}
                  type="button"
                  aria-label={fullLabel}
                  onClick={() => setTimeframe(tf)}
                  className={[
                    'px-2 sm:px-2.5 py-1.5 sm:py-1 rounded-[var(--radius-sm)] text-[11px] sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0',
                    active
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                  ].join(' ')}
                >
                  <span className="sm:hidden">{shortLabel}</span>
                  <span className="hidden sm:inline">{fullLabel}</span>
                </button>
              );
            })}
          </div>
        }
      />

      <dl className="admin-stat-grid-1x2x4 admin-stat-grid-1x2x4-xl border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0 text-center">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Kunjungan ({trafficSummary.timeframeDays}h)
          </dt>
          <dd className="mt-0.5 text-base sm:text-lg font-semibold text-[var(--text)] tabular-nums truncate">
            {trafficSummary.totalVisitors.toLocaleString('id-ID')}
          </dd>
          <dd className="hidden sm:block mt-0.5 text-[11px] text-[var(--text-subtle)] tabular-nums truncate">
            {trafficSummary.totalPageViews.toLocaleString('id-ID')} tayangan halaman
          </dd>
        </div>

        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0 text-center">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Pengajuan Pesanan
          </dt>
          <dd className="mt-0.5 text-base sm:text-lg font-semibold text-[var(--text)] tabular-nums truncate">
            {trafficSummary.totalOrderInquiries.toLocaleString('id-ID')}
          </dd>
          <dd className="hidden sm:block mt-0.5 text-[11px] text-[var(--text-subtle)] tabular-nums truncate">
            {trafficSummary.totalCustomConfigs} custom · {trafficSummary.totalCatalogActions} aksi katalog
          </dd>
        </div>

        {canViewFinance ? (
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0 text-center">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Arus Kas Bersih
            </dt>
            <dd
              className={[
                'mt-0.5 text-base sm:text-lg font-semibold tabular-nums truncate',
                financeSummary.netCashflow >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]',
              ].join(' ')}
            >
              {formatCompactRupiah(financeSummary.netCashflow)}
            </dd>
            <dd className="hidden sm:block mt-0.5 text-[11px] text-[var(--text-subtle)] tabular-nums truncate">
              Masuk {formatCompactRupiah(financeSummary.totalIncome)} · Keluar{' '}
              {formatCompactRupiah(financeSummary.totalExpense)}
            </dd>
          </div>
        ) : (
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0 text-center">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Produk &amp; Portofolio
            </dt>
            <dd className="mt-0.5 text-base sm:text-lg font-semibold text-[var(--text)] tabular-nums truncate">
              {productCount} / {publishedPortfolioCount}
            </dd>
            <dd className="hidden sm:block mt-0.5 text-[11px] text-[var(--text-subtle)] tabular-nums truncate">
              {productCount} produk · {publishedPortfolioCount} proyek terbit
            </dd>
          </div>
        )}

        {canViewFinance ? (
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0 text-center">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Sisa Termin Proyek
            </dt>
            <dd className="mt-0.5 text-base sm:text-lg font-semibold text-[var(--text)] tabular-nums truncate">
              {formatCompactRupiah(financeSummary.pendingReceivables)}
            </dd>
            <dd className="hidden sm:block mt-0.5 text-[11px] text-[var(--text-subtle)] tabular-nums truncate">
              {cartSummary.pricedSubtotal
                ? `Draf pesanan ${formatCompactRupiah(cartSummary.pricedSubtotal)}`
                : `${financeSummary.activeInvoicesCount} invoice menunggu pelunasan`}
            </dd>
          </div>
        ) : (
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0 text-center">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Informasi &amp; SEO
            </dt>
            <dd className="mt-0.5 text-base sm:text-lg font-semibold text-[var(--text)] tabular-nums truncate">
              {publishedNewsCount + materials.length + faqs.length}
            </dd>
            <dd className="hidden sm:block mt-0.5 text-[11px] text-[var(--text-subtle)] tabular-nums truncate">
              {publishedNewsCount} berita · {materials.length} material · {faqs.length} FAQ
            </dd>
          </div>
        )}
      </dl>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6">
        <section
          aria-labelledby="line-chart-heading"
          className="xl:col-span-7 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-0.5">
              <h2 id="line-chart-heading" className="text-base font-semibold text-[var(--text)]">
                {resolvedLineMode === 'monthly-integrated'
                  ? 'Kas & Kunjungan Bulanan'
                  : `Tren Kunjungan (${trafficSummary.timeframeDays} Hari)`}
              </h2>
            </div>

            <div
              role="group"
              aria-label="Mode grafik garis"
              className="inline-flex items-center p-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]/50 self-start shrink-0"
            >
              <button
                type="button"
                aria-pressed={resolvedLineMode === 'daily-traffic'}
                onClick={() => setLineMode('daily-traffic')}
                className={[
                  'px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0',
                  resolvedLineMode === 'daily-traffic'
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                Trafik Harian
              </button>
              {canViewFinance && (
                <button
                  type="button"
                  aria-pressed={resolvedLineMode === 'monthly-integrated'}
                  onClick={() => setLineMode('monthly-integrated')}
                  className={[
                    'px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0',
                    resolvedLineMode === 'monthly-integrated'
                      ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                  ].join(' ')}
                >
                  Kas &amp; Kunjungan
                </button>
              )}
            </div>
          </div>

          {resolvedLineMode === 'monthly-integrated' ? (
            <LineTrendChart
              data={monthlyIntegratedData}
              series={monthlyIntegratedSeries}
              leftAxisFormatter={formatCompactRupiah}
              rightAxisFormatter={(v) => `${Math.round(v)}`}
              emptyMessage="Belum ada data bulanan yang tersinkron."
            />
          ) : (
            <LineTrendChart
              data={dailyLineData}
              series={dailyLineSeries}
              leftAxisFormatter={(v) => String(Math.round(v))}
              emptyMessage="Belum ada catatan kunjungan harian."
            />
          )}
        </section>

        <section
          aria-labelledby="donut-chart-heading"
          className="xl:col-span-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-4 sm:p-5 space-y-4"
        >
          <div className="space-y-3">
            <div className="space-y-0.5">
              <h2 id="donut-chart-heading" className="text-base font-semibold text-[var(--text)]">
                Distribusi Data
              </h2>
            </div>

            <div
              role="group"
              aria-label="Sumber data diagram lingkaran"
              className="inline-flex flex-wrap items-center gap-1 p-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]/50"
            >
              <button
                type="button"
                aria-pressed={resolvedDonutMode === 'routes'}
                onClick={() => setDonutMode('routes')}
                className={[
                  'px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0',
                  resolvedDonutMode === 'routes'
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                Halaman Situs
              </button>
              {canViewFinance && (
                <>
                  <button
                    type="button"
                    aria-pressed={resolvedDonutMode === 'income'}
                    onClick={() => setDonutMode('income')}
                    className={[
                      'px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0',
                      resolvedDonutMode === 'income'
                        ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                    ].join(' ')}
                  >
                    Pemasukan
                  </button>
                  <button
                    type="button"
                    aria-pressed={resolvedDonutMode === 'expense'}
                    onClick={() => setDonutMode('expense')}
                    className={[
                      'px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0',
                      resolvedDonutMode === 'expense'
                        ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                    ].join(' ')}
                  >
                    Pengeluaran
                  </button>
                </>
              )}
            </div>
          </div>

          <CircleDonutChart
            slices={activeDonutConfig.slices}
            centerLabel={activeDonutConfig.centerLabel}
            centerValue={activeDonutConfig.centerValue}
            emptyMessage={activeDonutConfig.emptyMessage}
          />
        </section>
      </div>

      {canViewFinance && (
        <section
          aria-labelledby="termin-summary-heading"
          className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-4 sm:p-5 space-y-4"
        >
          <h2
            id="termin-summary-heading"
            className="text-base font-semibold text-[var(--text)]"
          >
            Status Termin Proyek ({financeInvoices.length})
          </h2>

          <ul className="space-y-3.5">
            {financeInvoices.map((inv) => {
              const prog = computeInvoiceProgress(inv);
              const productLabel = resolveTerminProductLabel(
                inv.namaProyek,
                catalogProductNames
              );
              return (
                <li key={inv.id} className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[var(--text)] truncate">
                      {productLabel}
                    </span>
                    <span className="text-[var(--text-muted)] tabular-nums shrink-0">
                      {prog.progressPercent}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-[var(--radius-sm)] bg-[var(--surface-muted)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--chart-1)]"
                      style={{ width: `${prog.progressPercent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
