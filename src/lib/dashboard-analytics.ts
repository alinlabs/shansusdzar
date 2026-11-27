import analyticsArchiveData from '../data/arsip-analitik-kunjungan.json';
import {
  computeCategoryBreakdown,
  computeFinanceSummary,
  computeInvoiceProgress,
  computeMonthlyCashflow,
  formatFinanceMonthLabel,
} from './finance-utils';
import type {
  AnalyticsTimeframe,
  DailyTrafficMetric,
  MonthlyVisitArchive,
  VisitRouteCategory,
} from '../types/analytics';
import type { FinanceTransaction, ProjectInvoice } from '../types/finance';

export interface TrafficSummaryMetrics {
  timeframeDays: number;
  totalVisitors: number;
  totalPageViews: number;
  totalCatalogActions: number;
  totalCustomConfigs: number;
  totalOrderInquiries: number;
  conversionRatePct: number;
  avgPagesPerVisit: number;
  visitorsDeltaPct: number | null;
  pageViewsDeltaPct: number | null;
  inquiriesDeltaPct: number | null;
}

export interface LineChartPoint {
  key: string;
  label: string;
  subLabel?: string;
  values: Record<string, number>;
}

export interface DonutSliceItem {
  id: string;
  label: string;
  value: number;
  percentage: number;
  colorVar: string;
  detailLabel: string;
}

export interface PentagonAxisScore {
  id: string;
  label: string;
  shortLabel: string;
  score: number; // 0 - 100
  targetScore: number; // benchmark 0 - 100
  metricValueLabel: string;
  explanation: string;
}

export interface RouteTrafficRow {
  route: VisitRouteCategory;
  label: string;
  path: string;
  views: number;
  sharePct: number;
}

const ROUTE_META = analyticsArchiveData.metaRute as Record<
  VisitRouteCategory,
  { label: string; jalur: string; variabelWarna: string }
>;

const SHORT_MONTHS: string[] = analyticsArchiveData.namaBulanSingkat;

export function formatShortDayLabel(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  return `${day} ${SHORT_MONTHS[monthIdx] ?? match[2]}`;
}

export function sliceTrafficWindow(
  dailyTraffic: readonly DailyTrafficMetric[],
  timeframe: AnalyticsTimeframe
): { current: DailyTrafficMetric[]; previous: DailyTrafficMetric[] } {
  const daysCount = timeframe === '7d' ? 7 : timeframe === '14d' ? 14 : 30;
  const sorted = [...dailyTraffic].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted.slice(-daysCount);
  const previousStart = Math.max(0, sorted.length - daysCount * 2);
  const previousEnd = Math.max(0, sorted.length - daysCount);
  const previous = sorted.slice(previousStart, previousEnd);
  return { current, previous };
}

function computePercentDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function computeTrafficSummary(
  dailyTraffic: readonly DailyTrafficMetric[],
  timeframe: AnalyticsTimeframe
): TrafficSummaryMetrics {
  const { current, previous } = sliceTrafficWindow(dailyTraffic, timeframe);
  const timeframeDays = timeframe === '7d' ? 7 : timeframe === '14d' ? 14 : 30;

  let totalVisitors = 0;
  let totalPageViews = 0;
  let totalCatalogActions = 0;
  let totalCustomConfigs = 0;
  let totalOrderInquiries = 0;

  for (const day of current) {
    totalVisitors += day.visitors;
    totalPageViews += day.pageViews;
    totalCatalogActions += day.catalogActions;
    totalCustomConfigs += day.customConfigs;
    totalOrderInquiries += day.orderInquiries;
  }

  let prevVisitors = 0;
  let prevPageViews = 0;
  let prevInquiries = 0;
  for (const day of previous) {
    prevVisitors += day.visitors;
    prevPageViews += day.pageViews;
    prevInquiries += day.orderInquiries;
  }

  const conversionRatePct =
    totalVisitors > 0 ? Number(((totalOrderInquiries / totalVisitors) * 100).toFixed(1)) : 0;
  const avgPagesPerVisit =
    totalVisitors > 0 ? Number((totalPageViews / totalVisitors).toFixed(1)) : 0;

  return {
    timeframeDays,
    totalVisitors,
    totalPageViews,
    totalCatalogActions,
    totalCustomConfigs,
    totalOrderInquiries,
    conversionRatePct,
    avgPagesPerVisit,
    visitorsDeltaPct: previous.length >= Math.min(3, timeframeDays) ? computePercentDelta(totalVisitors, prevVisitors) : null,
    pageViewsDeltaPct: previous.length >= Math.min(3, timeframeDays) ? computePercentDelta(totalPageViews, prevPageViews) : null,
    inquiriesDeltaPct: previous.length >= Math.min(3, timeframeDays) ? computePercentDelta(totalOrderInquiries, prevInquiries) : null,
  };
}

export function buildDailyTrafficLineSeries(
  dailyTraffic: readonly DailyTrafficMetric[],
  timeframe: AnalyticsTimeframe
): LineChartPoint[] {
  const { current } = sliceTrafficWindow(dailyTraffic, timeframe);
  return current.map((day) => ({
    key: day.date,
    label: formatShortDayLabel(day.date),
    subLabel: day.date,
    values: {
      pageViews: day.pageViews,
      visitors: day.visitors,
      interactions: day.catalogActions + day.customConfigs + day.orderInquiries,
    },
  }));
}

export function buildMonthlyIntegratedSeries(
  monthlyArchive: readonly MonthlyVisitArchive[],
  transactions: readonly FinanceTransaction[]
): LineChartPoint[] {
  const cashflowBuckets = computeMonthlyCashflow(transactions);
  const cashflowMap = new Map(cashflowBuckets.map((b) => [b.monthKey, b]));
  const visitMap = new Map(monthlyArchive.map((v) => [v.kodeBulan, v]));

  const allMonths = Array.from(
    new Set([...cashflowBuckets.map((b) => b.monthKey), ...monthlyArchive.map((v) => v.kodeBulan)])
  ).sort((a, b) => a.localeCompare(b));

  return allMonths.map((monthKey) => {
    const cf = cashflowMap.get(monthKey);
    const vis = visitMap.get(monthKey);
    return {
      key: monthKey,
      label: formatFinanceMonthLabel(monthKey),
      subLabel: `${vis?.pengunjung ?? 0} pengunjung · ${vis?.minatPesanan ?? 0} pengajuan`,
      values: {
        income: cf?.income ?? 0,
        expense: cf?.expense ?? 0,
        visitors: vis?.pengunjung ?? 0,
        pageViews: vis?.tayanganHalaman ?? 0,
        inquiries: vis?.minatPesanan ?? 0,
      },
    };
  });
}

export function buildRouteDistribution(
  dailyTraffic: readonly DailyTrafficMetric[],
  timeframe: AnalyticsTimeframe
): { slices: DonutSliceItem[]; rows: RouteTrafficRow[]; totalViews: number } {
  const { current } = sliceTrafficWindow(dailyTraffic, timeframe);
  const totals: Record<VisitRouteCategory, number> = {
    beranda: 0,
    katalog: 0,
    custom: 0,
    portofolio: 0,
    informasi: 0,
    pesanan: 0,
  };

  let totalViews = 0;
  for (const day of current) {
    (Object.keys(totals) as VisitRouteCategory[]).forEach((key) => {
      const count = day.routes?.[key] ?? 0;
      totals[key] += count;
      totalViews += count;
    });
  }

  const ordered = (Object.keys(totals) as VisitRouteCategory[])
    .map((route) => {
      const views = totals[route];
      const percentage = totalViews > 0 ? Math.round((views / totalViews) * 100) : 0;
      const meta = ROUTE_META[route];
      return {
        route,
        label: meta.label,
        path: meta.jalur,
        colorVar: meta.variabelWarna,
        views,
        percentage,
      };
    })
    .sort((a, b) => b.views - a.views);

  const slices: DonutSliceItem[] = ordered.map((item) => ({
    id: item.route,
    label: item.label,
    value: item.views,
    percentage: item.percentage,
    colorVar: item.colorVar,
    detailLabel: `${item.views.toLocaleString('id-ID')} tayangan`,
  }));

  const rows: RouteTrafficRow[] = ordered.map((item) => ({
    route: item.route,
    label: item.label,
    path: item.path,
    views: item.views,
    sharePct: item.percentage,
  }));

  return { slices, rows, totalViews };
}

const CHART_VARS: string[] = analyticsArchiveData.variabelGrafik;

function formatCompactIdr(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)} jt`;
  if (abs >= 1_000) return `Rp ${Math.round(amount / 1_000)} rb`;
  return `Rp ${Math.round(amount)}`;
}

export function buildFinanceDonutDistribution(
  transactions: readonly FinanceTransaction[],
  type: 'pemasukan' | 'pengeluaran'
): { slices: DonutSliceItem[]; totalAmount: number } {
  const breakdown = computeCategoryBreakdown(transactions, type);
  const totalAmount = breakdown.reduce((sum, item) => sum + item.amount, 0);

  const slices: DonutSliceItem[] = breakdown.map((item, idx) => ({
    id: item.category,
    label: item.category,
    value: item.amount,
    percentage: item.percentage,
    colorVar: CHART_VARS[idx % CHART_VARS.length],
    detailLabel: `${formatCompactIdr(item.amount)} · ${item.count} transaksi`,
  }));

  return { slices, totalAmount };
}

export interface StudioPentagonInput {
  dailyTraffic: readonly DailyTrafficMetric[];
  timeframe: AnalyticsTimeframe;
  transactions: readonly FinanceTransaction[];
  invoices: readonly ProjectInvoice[];
  productCount: number;
  publishedPortfolioCount: number;
  publishedNewsCount: number;
  materialCount: number;
  faqCount: number;
  canViewFinance: boolean;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildStudioPentagonScores(input: StudioPentagonInput): {
  axes: PentagonAxisScore[];
  compositeIndex: number;
} {
  const traffic = computeTrafficSummary(input.dailyTraffic, input.timeframe);
  const financeSummary = computeFinanceSummary(input.transactions, input.invoices);

  // 1. Trafik & Jangkauan: normalized against daily target of 50 visitors/day
  const avgDailyVisitors = traffic.totalVisitors / Math.max(1, traffic.timeframeDays);
  const trafficScore = clampScore((avgDailyVisitors / 55) * 100);

  // 2. Konversi Pesanan & Custom: normalized against 10% inquiry-to-visitor benchmark
  const interactionEngagement =
    traffic.totalVisitors > 0
      ? ((traffic.totalOrderInquiries + traffic.totalCustomConfigs * 0.5) / traffic.totalVisitors) * 100
      : 0;
  const conversionScore = clampScore((interactionEngagement / 12) * 100);

  // 3. Kesehatan Arus Kas (or Kesiapan Katalog if finance hidden)
  const netMarginPct =
    financeSummary.totalIncome > 0
      ? ((financeSummary.totalIncome - financeSummary.totalExpense) / financeSummary.totalIncome) * 100
      : 0;
  const cashHealthScore = input.canViewFinance
    ? clampScore(45 + netMarginPct * 1.1)
    : clampScore((input.productCount / 8) * 100);

  // 4. Progres Penagihan Termin (average % paid across project invoices)
  const avgInvoiceCollectionPct =
    input.invoices.length > 0
      ? input.invoices.reduce((sum, inv) => sum + computeInvoiceProgress(inv).progressPercent, 0) /
        input.invoices.length
      : 0;
  const invoiceScore = input.canViewFinance
    ? clampScore(avgInvoiceCollectionPct)
    : clampScore((input.publishedPortfolioCount / 6) * 100);

  // 5. Kelengkapan Konten & SEO (products, portfolio, news, materials, FAQs)
  const contentCoverage =
    (Math.min(1, input.productCount / 6) * 0.25 +
      Math.min(1, input.publishedPortfolioCount / 4) * 0.25 +
      Math.min(1, input.publishedNewsCount / 3) * 0.2 +
      Math.min(1, input.materialCount / 5) * 0.15 +
      Math.min(1, input.faqCount / 5) * 0.15) *
    100;
  const contentScore = clampScore(contentCoverage);

  const axes: PentagonAxisScore[] = [
    {
      id: 'traffic',
      label: 'Trafik Kunjungan',
      shortLabel: 'Trafik',
      score: trafficScore,
      targetScore: 80,
      metricValueLabel: `${Math.round(avgDailyVisitors)} peng./hari`,
      explanation: `Rata-rata ${Math.round(avgDailyVisitors)} pengunjung unik per hari (${traffic.avgPagesPerVisit} hal/sesi).`,
    },
    {
      id: 'conversion',
      label: 'Konversi & Custom',
      shortLabel: 'Konversi',
      score: conversionScore,
      targetScore: 75,
      metricValueLabel: `${traffic.conversionRatePct}% pengajuan`,
      explanation: `${traffic.totalOrderInquiries} pengajuan pesanan & ${traffic.totalCustomConfigs} konfigurasi custom.`,
    },
    {
      id: 'cashflow',
      label: input.canViewFinance ? 'Margin Arus Kas' : 'Kesiapan Katalog',
      shortLabel: input.canViewFinance ? 'Arus Kas' : 'Katalog',
      score: cashHealthScore,
      targetScore: 78,
      metricValueLabel: input.canViewFinance
        ? `Margin ${Math.round(netMarginPct)}%`
        : `${input.productCount} unit aktif`,
      explanation: input.canViewFinance
        ? `Surplus ${formatCompactIdr(financeSummary.netCashflow)} dari total pemasukan ${formatCompactIdr(financeSummary.totalIncome)}.`
        : `Katalog memiliki ${input.productCount} unit referensi aktif.`,
    },
    {
      id: 'invoices',
      label: input.canViewFinance ? 'Kolektibilitas Termin' : 'Sorotan Portofolio',
      shortLabel: input.canViewFinance ? 'Termin' : 'Portofolio',
      score: invoiceScore,
      targetScore: 82,
      metricValueLabel: input.canViewFinance
        ? `${Math.round(avgInvoiceCollectionPct)}% tertagih`
        : `${input.publishedPortfolioCount} terbit`,
      explanation: input.canViewFinance
        ? `Rata-rata pelunasan proyek ${Math.round(avgInvoiceCollectionPct)}% dari ${input.invoices.length} invoice.`
        : `${input.publishedPortfolioCount} proyek portofolio aktif di situs.`,
    },
    {
      id: 'content',
      label: 'Kelengkapan Konten',
      shortLabel: 'Konten & SEO',
      score: contentScore,
      targetScore: 85,
      metricValueLabel: `${input.productCount + input.publishedPortfolioCount + input.publishedNewsCount} entri`,
      explanation: `${input.productCount} produk · ${input.publishedPortfolioCount} portofolio · ${input.publishedNewsCount} berita · ${input.materialCount} material.`,
    },
  ];

  const compositeIndex = Math.round(axes.reduce((sum, a) => sum + a.score, 0) / axes.length);
  return { axes, compositeIndex };
}

const LEGACY_PRODUCT_ALIASES: ReadonlyArray<{ pattern: RegExp; productName: string }> = [
  { pattern: /\bkabinet dapur\b/i, productName: 'Kitchen Set' },
  { pattern: /\bpanel dinding\b/i, productName: 'Wall Panel' },
  { pattern: /\blemari pakaian\b/i, productName: 'Wardrobe' },
  { pattern: /\bcredenza\b/i, productName: 'Bufet TV' },
  { pattern: /\bmeja tv\b/i, productName: 'Bufet TV' },
  { pattern: /\bdivan\b/i, productName: 'Modern Divan' },
  { pattern: /\bsofa sandar\b/i, productName: 'Modern Divan' },
  { pattern: /\bsideboard\b/i, productName: 'Backdrop TV' },
  { pattern: /\blobby\b|\bresepsionis\b/i, productName: 'Meja Resepsionis' },
];

export function resolveTerminProductLabel(
  projectName: string,
  catalogProductNames: readonly string[]
): string {
  const trimmed = projectName.trim();
  if (!trimmed) return '';
  if (catalogProductNames.length === 0) return trimmed;

  const lower = trimmed.toLowerCase();
  const matches: Array<{ index: number; name: string }> = [];

  for (const name of catalogProductNames) {
    const idx = lower.indexOf(name.toLowerCase());
    if (idx !== -1) {
      matches.push({ index: idx, name });
    }
  }

  for (const alias of LEGACY_PRODUCT_ALIASES) {
    const match = alias.pattern.exec(trimmed);
    if (!match) continue;
    const matchedProduct = catalogProductNames.find(
      (n) => n.toLowerCase() === alias.productName.toLowerCase()
    );
    if (matchedProduct && !matches.some((m) => m.name === matchedProduct)) {
      matches.push({ index: match.index, name: matchedProduct });
    }
  }

  if (matches.length === 0) return trimmed;

  matches.sort((a, b) => a.index - b.index);
  return matches.map((m) => m.name).join(' & ');
}

