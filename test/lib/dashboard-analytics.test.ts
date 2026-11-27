import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyTrafficLineSeries,
  buildFinanceDonutDistribution,
  buildMonthlyIntegratedSeries,
  buildRouteDistribution,
  buildStudioPentagonScores,
  computeTrafficSummary,
  resolveTerminProductLabel,
} from '../../src/lib/dashboard-analytics';
import { DEFAULT_FINANCE_TRANSACTIONS, DEFAULT_PROJECT_INVOICES } from '../../src/lib/finance-utils';
import {
  DEFAULT_MONTHLY_VISIT_ARCHIVE,
  createSeededDailyTraffic,
  resolveVisitRouteCategory,
} from '../../src/store/analytics-store';

test('resolveVisitRouteCategory maps public routes and skips admin routes', () => {
  assert.equal(resolveVisitRouteCategory('/'), 'beranda');
  assert.equal(resolveVisitRouteCategory('/produk'), 'katalog');
  assert.equal(resolveVisitRouteCategory('/produk/custom'), 'custom');
  assert.equal(resolveVisitRouteCategory('/katalog'), 'katalog');
  assert.equal(resolveVisitRouteCategory('/katalog/custom'), 'custom');
  assert.equal(resolveVisitRouteCategory('/portofolio/kitchen-set'), 'portofolio');
  assert.equal(resolveVisitRouteCategory('/berita/panduan-hpl'), 'informasi');
  assert.equal(resolveVisitRouteCategory('/pesanan'), 'pesanan');
  assert.equal(resolveVisitRouteCategory('/admin'), null);
  assert.equal(resolveVisitRouteCategory('/admin/dokumen'), null);
  assert.equal(resolveVisitRouteCategory('/admin/keuangan'), null);
});

test('computeTrafficSummary calculates timeframe totals and conversion rate', () => {
  const seeded = createSeededDailyTraffic('2026-11-20');
  assert.equal(seeded.length, 30);

  const summary7d = computeTrafficSummary(seeded, '7d');
  const summary30d = computeTrafficSummary(seeded, '30d');

  assert.equal(summary7d.timeframeDays, 7);
  assert.equal(summary30d.timeframeDays, 30);
  assert.equal(summary30d.totalVisitors > summary7d.totalVisitors, true);
  assert.equal(summary30d.totalPageViews > summary30d.totalVisitors, true);
  assert.equal(summary7d.conversionRatePct > 0, true);
});

test('buildDailyTrafficLineSeries and buildMonthlyIntegratedSeries return chart points', () => {
  const seeded = createSeededDailyTraffic('2026-11-20');
  const dailySeries = buildDailyTrafficLineSeries(seeded, '14d');
  assert.equal(dailySeries.length, 14);
  assert.equal(dailySeries[0].values.pageViews > 0, true);

  const monthlySeries = buildMonthlyIntegratedSeries(
    DEFAULT_MONTHLY_VISIT_ARCHIVE,
    DEFAULT_FINANCE_TRANSACTIONS
  );
  assert.equal(monthlySeries.length >= 3, true);
  assert.equal(monthlySeries[0].key, '2026-09');
  assert.equal(monthlySeries[monthlySeries.length - 1].values.income > 0, true);
  assert.equal(monthlySeries[monthlySeries.length - 1].values.visitors > 0, true);
});

test('buildRouteDistribution and buildFinanceDonutDistribution compute valid percentages', () => {
  const seeded = createSeededDailyTraffic('2026-11-20');
  const routeDist = buildRouteDistribution(seeded, '30d');
  assert.equal(routeDist.slices.length, 6);
  assert.equal(routeDist.totalViews > 0, true);

  const incomeDist = buildFinanceDonutDistribution(DEFAULT_FINANCE_TRANSACTIONS, 'pemasukan');
  assert.equal(incomeDist.slices.length > 0, true);
  assert.equal(incomeDist.totalAmount > 0, true);
});

test('buildStudioPentagonScores produces 5 bounded axes from 0 to 100', () => {
  const seeded = createSeededDailyTraffic('2026-11-20');
  const result = buildStudioPentagonScores({
    dailyTraffic: seeded,
    timeframe: '30d',
    transactions: DEFAULT_FINANCE_TRANSACTIONS,
    invoices: DEFAULT_PROJECT_INVOICES,
    productCount: 6,
    publishedPortfolioCount: 4,
    publishedNewsCount: 3,
    materialCount: 5,
    faqCount: 6,
    canViewFinance: true,
  });

  assert.equal(result.axes.length, 5);
  assert.equal(
    result.axes.every((axis) => axis.score >= 0 && axis.score <= 100),
    true
  );
  assert.equal(result.compositeIndex >= 0 && result.compositeIndex <= 100, true);
});

test('resolveTerminProductLabel maps invoice project names to actual catalog product names', () => {
  const catalogNames = ['Kitchen Set', 'Meja Kerja', 'Wall Panel', 'Wardrobe', 'Bufet TV', 'Modern Divan', 'Backdrop TV'];
  assert.equal(
    resolveTerminProductLabel('Kitchen Set & Kabinet Dapur Modular', catalogNames),
    'Kitchen Set'
  );
  assert.equal(
    resolveTerminProductLabel('Meja Kerja & Panel Dinding Ruang Pimpinan', catalogNames),
    'Meja Kerja & Wall Panel'
  );
  assert.equal(
    resolveTerminProductLabel('Lemari Pakaian Panel Rata & Credenza TV', catalogNames),
    'Wardrobe & Bufet TV'
  );
  assert.equal(
    resolveTerminProductLabel('Wardrobe & Bufet TV', catalogNames),
    'Wardrobe & Bufet TV'
  );
  assert.equal(
    resolveTerminProductLabel('Proyek Khusus Kantor', catalogNames),
    'Proyek Khusus Kantor'
  );
});
