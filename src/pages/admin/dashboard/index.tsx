import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  FileCheck2,
  FileText,
  Globe,
  LayoutGrid,
  Megaphone,
  RotateCcw,
  Shield,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router';
import { AdminActionButton, AdminActionLink } from '../../../components/admin/admin-action-buttons';
import { CircleDonutChart } from '../../../components/charts/circle-donut-chart';
import { LineTrendChart, type LineSeriesConfig } from '../../../components/charts/line-trend-chart';
import { PentagonRadarChart } from '../../../components/charts/pentagon-radar-chart';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import {
  buildDailyTrafficLineSeries,
  buildFinanceDonutDistribution,
  buildMonthlyIntegratedSeries,
  buildRouteDistribution,
  buildStudioPentagonScores,
  computeTrafficSummary,
} from '../../../lib/dashboard-analytics';
import {
  computeFinanceSummary,
  computeInvoiceProgress,
  formatRupiahSigned,
} from '../../../lib/finance-utils';
import { computePortfolioReviewStats } from '../../../lib/portfolio-filter';
import { hasPermission } from '../../../lib/rbac';
import { useAdminAuthStore } from '../../../store/admin-auth-store';
import { useAnalyticsStore } from '../../../store/analytics-store';
import { calculateCartSummary, useCartStore } from '../../../store/cart-store';
import { useFinanceStore } from '../../../store/finance-store';
import { useMarketingStore } from '../../../store/marketing-store';
import { useSiteContentStore } from '../../../store/site-content-store';
import type { AnalyticsTimeframe } from '../../../types/analytics';
import { AdminPageHeader } from '../admin-shell';

type LineChartMode = 'daily-traffic' | 'monthly-integrated';
type DonutChartMode = 'routes' | 'income' | 'expense';

function formatShortTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatCompactRupiah(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1)} jt`;
  if (abs >= 1_000) return `${sign}Rp ${Math.round(abs / 1_000)} rb`;
  return `${sign}Rp ${Math.round(abs)}`;
}

function formatDeltaLabel(deltaPct: number | null): string {
  if (deltaPct === null) return 'Periode awal';
  if (deltaPct > 0) return `+${deltaPct}% vs periode lalu`;
  if (deltaPct < 0) return `${deltaPct}% vs periode lalu`;
  return 'Stabil 0% vs periode lalu';
}

export default function AdminDashboardPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const updatedAt = useSiteContentStore((state) => state.updatedAt);
  const portfolioProjects = useSiteContentStore((state) => state.portfolioProjects);
  const newsArticles = useSiteContentStore((state) => state.newsArticles);
  const materials = useSiteContentStore((state) => state.materials);
  const faqs = useSiteContentStore((state) => state.faqs);
  const tentang = useSiteContentStore((state) => state.tentang);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const activityLogs = useAdminAuthStore((state) => state.activityLogs);

  const financeTransactions = useFinanceStore((state) => state.transactions);
  const financeInvoices = useFinanceStore((state) => state.invoices);
  const marketingContacts = useMarketingStore((state) => state.contacts);
  const marketingCampaignItems = useMarketingStore((state) => state.campaignItems);
  const socialPlans = useSiteContentStore((state) => state.socialPlans) ?? [];

  const dailyTraffic = useAnalyticsStore((state) => state.dailyTraffic);
  const monthlyArchive = useAnalyticsStore((state) => state.monthlyArchive);
  const resetAnalyticsDefaults = useAnalyticsStore((state) => state.resetAnalyticsDefaults);

  const cartItems = useCartStore((state) => state.items);

  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('30d');
  const [lineMode, setLineMode] = useState<LineChartMode>('daily-traffic');
  const [donutMode, setDonutMode] = useState<DonutChartMode>('routes');

  useDocumentTitle(`Dashboard | Admin ${shortBrandName}`);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canViewFinance = hasPermission(currentRole, 'keuangan.view');

  const activeCatalog = catalogOverride ?? loadedBaseCatalog;
  const productCount = activeCatalog?.daftarProduk.length ?? 0;
  const portfolioReviewStats = useMemo(
    () => computePortfolioReviewStats(portfolioProjects),
    [portfolioProjects]
  );
  const publishedPortfolioCount = portfolioReviewStats.publishedProjects;
  const publishedNewsCount = newsArticles.filter((n) => n.terbit).length;
  const activeUsersCount = users.filter((u) => u.status === 'aktif').length;

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

  const pentagonData = useMemo(
    () =>
      buildStudioPentagonScores({
        dailyTraffic,
        timeframe,
        transactions: financeTransactions,
        invoices: financeInvoices,
        productCount,
        publishedPortfolioCount,
        publishedNewsCount,
        materialCount: materials.length,
        faqCount: faqs.length,
        canViewFinance,
      }),
    [
      dailyTraffic,
      timeframe,
      financeTransactions,
      financeInvoices,
      productCount,
      publishedPortfolioCount,
      publishedNewsCount,
      materials.length,
      faqs.length,
      canViewFinance,
    ]
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

  const modulesSummary = [
    {
      name: 'Produk',
      description: 'Katalog produk, variasi, dan harga.',
      countLabel: `${productCount} Produk`,
      to: '/admin/produk',
      publicTo: '/produk',
      icon: LayoutGrid,
      canAccess: hasPermission(currentRole, 'katalog.view'),
    },
    {
      name: 'Portofolio',
      description: 'Proyek studi kasus dan ulasan klien.',
      countLabel: `${publishedPortfolioCount}/${portfolioProjects.length} Proyek · ${portfolioReviewStats.totalReviews} Ulasan`,
      to: '/admin/portofolio',
      publicTo: '/portofolio',
      icon: Briefcase,
      canAccess: hasPermission(currentRole, 'portofolio.view'),
    },
    {
      name: 'Marketing',
      description: 'Kontak prospek, campaign WA/Email, dan content plan.',
      countLabel: `${marketingContacts.length} Kontak · ${marketingCampaignItems.length} Campaign · ${socialPlans.length} Konten`,
      to: '/admin/marketing/campaign',
      publicTo: null,
      icon: Megaphone,
      canAccess: hasPermission(currentRole, 'marketing.view'),
    },
    {
      name: 'Informasi',
      description: 'Berita SEO, material, dan FAQ.',
      countLabel: `${publishedNewsCount} Berita · ${materials.length} Material · ${faqs.length} FAQ`,
      to: '/admin/informasi/berita',
      publicTo: '/berita',
      icon: BookOpen,
      canAccess: hasPermission(currentRole, 'informasi.view'),
    },
    {
      name: 'Tentang',
      description: 'Profil usaha, tim, beranda, dan jam buka.',
      countLabel: `${tentang.anggotaTim.length} Tim · Profil Usaha`,
      to: '/admin/tentang',
      publicTo: '/tentang',
      icon: FileText,
      canAccess: hasPermission(currentRole, 'tentang.view'),
    },
    {
      name: 'SEO',
      description: 'Meta halaman, OpenGraph, dan Schema.org.',
      countLabel: 'Meta & Schema.org',
      to: '/admin/seo',
      publicTo: '/',
      icon: Globe,
      canAccess:
        hasPermission(currentRole, 'tentang.view') || hasPermission(currentRole, 'bisnis.edit'),
    },
    {
      name: 'Dokumen Resmi',
      description: 'SPK, SPKS, BAST, dan Invoice.',
      countLabel: `${financeInvoices.length} Invoice · ${financeSummary.activeInvoicesCount} Termin Aktif`,
      to: '/admin/dokumen/spk',
      publicTo: null,
      icon: FileCheck2,
      canAccess: canViewFinance,
    },
    {
      name: 'Keuangan',
      description: 'Proyek, pembelian, arus kas, dan buku kas.',
      countLabel: `${financeTransactions.length} Transaksi · ${formatCompactRupiah(financeSummary.netCashflow)}`,
      to: '/admin/keuangan',
      publicTo: null,
      icon: Wallet,
      canAccess: canViewFinance,
    },
    {
      name: 'Hak Akses',
      description: 'Pengguna, peran RBAC, dan cadangan JSON.',
      countLabel: `${activeUsersCount} Staf · ${roles.length} Peran`,
      to: '/admin/akses',
      publicTo: null,
      icon: Shield,
      canAccess: hasPermission(currentRole, 'akses.view'),
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdminPageHeader
        title="Dashboard"
        description={`${currentUser?.nama ?? 'Admin'} · ${currentRole?.nama ?? 'Pengelola'} · ${formatShortTimestamp(updatedAt)}`}
        actions={
          <>
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

            {hasPermission(currentRole, 'katalog.edit') && (
              <AdminActionLink
                to="/admin/produk"
                variant="primary"
                label="Kelola Produk"
                icon={<LayoutGrid className="size-3.5" />}
              />
            )}
            {canViewFinance && (
              <AdminActionLink
                to="/admin/keuangan"
                variant="default"
                label="Buka Keuangan"
                icon={<Wallet className="size-3.5" />}
              />
            )}
          </>
        }
      />

      <dl className="admin-stat-grid-1x2x4 admin-stat-grid-1x2x4-xl border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Kunjungan ({trafficSummary.timeframeDays}h)
          </dt>
          <dd className="mt-0.5 flex items-baseline gap-1.5 min-w-0">
            <span className="text-base sm:text-lg font-semibold text-[var(--text)] tabular-nums truncate">
              {trafficSummary.totalVisitors.toLocaleString('id-ID')}
            </span>
            <span
              className={[
                'text-[11px] font-medium tabular-nums shrink-0',
                (trafficSummary.visitorsDeltaPct ?? 0) >= 0
                  ? 'text-[var(--success)]'
                  : 'text-[var(--danger)]',
              ].join(' ')}
            >
              {formatDeltaLabel(trafficSummary.visitorsDeltaPct)}
            </span>
          </dd>
          <dd className="hidden sm:block mt-0.5 text-[11px] text-[var(--text-subtle)] tabular-nums truncate">
            {trafficSummary.totalPageViews.toLocaleString('id-ID')} tayangan halaman
          </dd>
        </div>

        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Pengajuan Pesanan
          </dt>
          <dd className="mt-0.5 flex items-baseline gap-1.5 min-w-0">
            <span className="text-base sm:text-lg font-semibold text-[var(--text)] tabular-nums truncate">
              {trafficSummary.totalOrderInquiries.toLocaleString('id-ID')}
            </span>
            <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
              {trafficSummary.conversionRatePct}%
            </span>
          </dd>
          <dd className="hidden sm:block mt-0.5 text-[11px] text-[var(--text-subtle)] tabular-nums truncate">
            {trafficSummary.totalCustomConfigs} custom · {trafficSummary.totalCatalogActions} aksi katalog
          </dd>
        </div>

        {canViewFinance ? (
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
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
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
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
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Sisa Termin Proyek
            </dt>
            <dd className="mt-0.5 flex items-baseline gap-1.5 min-w-0">
              <span className="text-base sm:text-lg font-semibold text-[var(--text)] tabular-nums truncate">
                {formatCompactRupiah(financeSummary.pendingReceivables)}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
                {financeSummary.activeInvoicesCount} aktif
              </span>
            </dd>
            <dd className="hidden sm:block mt-0.5 text-[11px] text-[var(--text-subtle)] tabular-nums truncate">
              {cartSummary.pricedSubtotal
                ? `Draf pesanan ${formatCompactRupiah(cartSummary.pricedSubtotal)}`
                : `${financeSummary.activeInvoicesCount} invoice menunggu pelunasan`}
            </dd>
          </div>
        ) : (
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6">
        <section
          aria-labelledby="pentagon-chart-heading"
          className="xl:col-span-7 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="space-y-0.5">
              <h2
                id="pentagon-chart-heading"
                className="text-base font-semibold text-[var(--text)]"
              >
                Kinerja Studio
              </h2>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <p className="text-[11px] text-[var(--text-muted)]">Indeks</p>
              <p className="text-lg font-semibold text-[var(--text)] tabular-nums">
                {pentagonData.compositeIndex} / 100
              </p>
            </div>
          </div>

          <PentagonRadarChart
            axes={pentagonData.axes}
            compositeIndex={pentagonData.compositeIndex}
          />
        </section>

        <section
          aria-labelledby="route-finance-summary-heading"
          className="xl:col-span-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-4 sm:p-5 space-y-5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <h2
                id="route-finance-summary-heading"
                className="text-base font-semibold text-[var(--text)]"
              >
                Halaman &amp; Termin
              </h2>
            </div>
            <AdminActionButton
              variant="ghost"
              label="Reset Trafik"
              title="Kembalikan baseline statistik kunjungan"
              icon={<RotateCcw className="size-3.5" />}
              onClick={() => resetAnalyticsDefaults()}
            />
          </div>

          <div className="border border-[var(--border)] rounded-[var(--radius-md)] overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/50 text-[var(--text-muted)]">
                  <th className="py-2 px-3 font-medium">Halaman Publik</th>
                  <th className="py-2 px-3 font-medium text-right">Tayangan</th>
                  <th className="py-2 px-3 font-medium text-right">Porsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {routeDistribution.rows.map((row) => (
                  <tr key={row.route} className="hover:bg-[var(--surface-muted)]/30">
                    <td className="py-2 px-3">
                      <p className="font-medium text-[var(--text)]">{row.label}</p>
                      <p className="text-[11px] text-[var(--text-subtle)]">{row.path}</p>
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-[var(--text)] tabular-nums">
                      {row.views.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2 px-3 text-right text-[var(--text-muted)] tabular-nums">
                      {row.sharePct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canViewFinance && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <h3 className="font-semibold text-[var(--text)]">
                  Status Termin Proyek ({financeInvoices.length})
                </h3>
                <Link
                  to="/admin/dokumen/invoice"
                  className="text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
                >
                  Kelola Invoice &amp; Termin
                </Link>
              </div>
              <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius-md)]">
                {financeInvoices.slice(0, 3).map((inv) => {
                  const prog = computeInvoiceProgress(inv);
                  return (
                    <li key={inv.id} className="px-3 py-2.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[var(--text)] truncate">
                          {inv.namaProyek}
                        </span>
                        <span className="text-[var(--text-muted)] tabular-nums shrink-0">
                          {prog.progressPercent}% · {prog.computedStatus}
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
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="modules-table-heading" className="space-y-3">
        <h2 id="modules-table-heading" className="text-base font-semibold text-[var(--text)]">
          Modul Admin
        </h2>
        <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden divide-y divide-[var(--border)]">
          {modulesSummary.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.to}
                className="p-3.5 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4"
              >
                <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
                  <div className="size-9 sm:size-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-[var(--text)] shrink-0">
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-semibold text-[var(--text)]">{mod.name}</p>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      {mod.description}
                    </p>
                    <p className="sm:hidden text-[11px] text-[var(--text-subtle)] tabular-nums pt-0.5">
                      {mod.countLabel}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0 pl-12 sm:pl-0">
                  <span className="hidden sm:inline text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                    {mod.countLabel}
                  </span>
                  {mod.publicTo && (
                    <Link
                      to={mod.publicTo}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
                    >
                      <span className="sm:hidden">Web</span>
                      <span className="hidden sm:inline">Lihat Halaman</span>
                    </Link>
                  )}
                  {mod.canAccess ? (
                    <AdminActionLink
                      to={mod.to}
                      variant="default"
                      label={`Kelola ${mod.name}`}
                      mobileLabel={undefined}
                      icon={<ArrowRight className="size-3.5" />}
                    />
                  ) : (
                    <span className="text-xs text-[var(--text-subtle)] whitespace-nowrap">
                      Terkunci
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="activity-log-heading" className="space-y-3">
        <h2 id="activity-log-heading" className="text-base font-semibold text-[var(--text)]">
          Aktivitas Terakhir
        </h2>
        <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
          <div className="md:hidden divide-y divide-[var(--border)]">
            {activityLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="p-3.5 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-[var(--text)] truncate">
                    {log.modulTarget} · {log.labelTarget}
                  </p>
                  <span className="text-[11px] text-[var(--text-subtle)] tabular-nums whitespace-nowrap shrink-0">
                    {formatShortTimestamp(log.waktu)}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">{log.aksi}</p>
                <p className="text-[11px] text-[var(--text-subtle)]">
                  {log.namaAktor} · {log.peranAktor}
                </p>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs text-[var(--text-muted)]">
                  <th className="py-3 px-4 font-medium">Waktu</th>
                  <th className="py-3 px-4 font-medium">Pengelola</th>
                  <th className="py-3 px-4 font-medium">Modul</th>
                  <th className="py-3 px-4 font-medium">Aktivitas</th>
                  <th className="py-3 px-4 font-medium">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {activityLogs.slice(0, 10).map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--surface-elevated)]">
                    <td className="py-2.5 px-4 text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                      {formatShortTimestamp(log.waktu)}
                    </td>
                    <td className="py-2.5 px-4">
                      <p className="text-xs font-medium text-[var(--text)]">{log.namaAktor}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">{log.peranAktor}</p>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-[var(--text)] whitespace-nowrap">
                      {log.modulTarget}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-[var(--text-muted)]">{log.aksi}</td>
                    <td className="py-2.5 px-4 text-xs font-medium text-[var(--text)]">
                      {log.labelTarget}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
