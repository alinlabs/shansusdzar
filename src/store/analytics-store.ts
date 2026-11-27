import { create } from 'zustand';
import analyticsArchiveData from '../data/arsip-analitik-kunjungan.json';
import {
  readLocalCacheItem,
  subscribeLocalCacheChange,
  writeLocalCacheItem,
} from '../lib/indexeddb-storage';
import type {
  DailyTrafficMetric,
  MonthlyVisitArchive,
  PersistedAnalyticsPayload,
  VisitRouteCategory,
} from '../types/analytics';

export const ANALYTICS_STORAGE_KEY = 'shansusdzar-analytics-v1';
const VISITOR_SESSION_KEY = 'shansusdzar-visitor-counted-date';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftIsoDate(baseIsoDate: string, deltaDays: number): string {
  const [y, m, d] = baseIsoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

export function resolveVisitRouteCategory(pathname: string): VisitRouteCategory | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean.startsWith('/admin')) return null;
  if (clean === '/') return 'beranda';
  if (clean === '/produk/custom' || clean === '/katalog/custom' || clean === '/custom-interior') {
    return 'custom';
  }
  if (clean.startsWith('/produk') || clean.startsWith('/katalog')) return 'katalog';
  if (clean.startsWith('/portofolio')) return 'portofolio';
  if (
    clean.startsWith('/berita') ||
    clean.startsWith('/tips-interior') ||
    clean.startsWith('/faq') ||
    clean.startsWith('/tentang') ||
    clean.startsWith('/informasi') ||
    clean.startsWith('/kebijakan-privasi') ||
    clean.startsWith('/syarat-ketentuan') ||
    clean.startsWith('/keamanan-kepatuhan') ||
    clean === '/privacy' ||
    clean === '/privacy-policy' ||
    clean === '/terms' ||
    clean === '/terms-of-service' ||
    clean === '/security' ||
    clean === '/kebijakan-cookie'
  ) {
    return 'informasi';
  }
  if (clean.startsWith('/pesanan') || clean.startsWith('/keranjang')) return 'pesanan';
  return 'beranda';
}

function createEmptyDay(date: string): DailyTrafficMetric {
  return {
    date,
    visitors: 0,
    pageViews: 0,
    catalogActions: 0,
    customConfigs: 0,
    orderInquiries: 0,
    routes: {
      beranda: 0,
      katalog: 0,
      custom: 0,
      portofolio: 0,
      informasi: 0,
      pesanan: 0,
    },
  };
}

export function createSeededDailyTraffic(anchorDate = getTodayIsoDate()): DailyTrafficMetric[] {
  const days: DailyTrafficMetric[] = [];
  // 30-day deterministic organic growth curve with weekend & mid-week workshop peaks
  for (let i = 29; i >= 0; i -= 1) {
    const date = shiftIsoDate(anchorDate, -i);
    const idx = 29 - i;
    const weekdayFactor = [1.12, 0.92, 1.04, 1.08, 0.96, 1.18, 1.24][idx % 7];
    const trendGrowth = 1 + idx * 0.014;

    const visitors = Math.round((34 + ((idx * 7) % 15)) * weekdayFactor * trendGrowth);
    const beranda = Math.round(visitors * 0.88);
    const katalog = Math.round(visitors * 0.72);
    const custom = Math.round(visitors * 0.34);
    const portofolio = Math.round(visitors * 0.48);
    const informasi = Math.round(visitors * 0.41);
    const pesanan = Math.max(2, Math.round(visitors * 0.14));
    const pageViews = beranda + katalog + custom + portofolio + informasi + pesanan;

    const catalogActions = Math.max(3, Math.round(katalog * 0.28));
    const customConfigs = Math.max(1, Math.round(custom * 0.36));
    const orderInquiries = Math.max(1, Math.round(pesanan * 0.42));

    days.push({
      date,
      visitors,
      pageViews,
      catalogActions,
      customConfigs,
      orderInquiries,
      routes: {
        beranda,
        katalog,
        custom,
        portofolio,
        informasi,
        pesanan,
      },
    });
  }
  return days;
}

export const DEFAULT_MONTHLY_VISIT_ARCHIVE: MonthlyVisitArchive[] =
  analyticsArchiveData.arsipBulanan as MonthlyVisitArchive[];

function createDefaultAnalyticsPayload(): PersistedAnalyticsPayload {
  return {
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    dailyTraffic: createSeededDailyTraffic(),
    monthlyArchive: structuredClone(DEFAULT_MONTHLY_VISIT_ARCHIVE),
  };
}

function loadAnalyticsState(): PersistedAnalyticsPayload {
  const fallback = createDefaultAnalyticsPayload();
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = readLocalCacheItem(ANALYTICS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== 2) return fallback;

    const dailyTraffic = Array.isArray(parsed.dailyTraffic)
      ? (parsed.dailyTraffic as DailyTrafficMetric[])
      : fallback.dailyTraffic;
    const monthlyArchive = Array.isArray(parsed.monthlyArchive)
      ? (parsed.monthlyArchive as MonthlyVisitArchive[])
      : fallback.monthlyArchive;

    return {
      schemaVersion: 2,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : fallback.updatedAt,
      dailyTraffic,
      monthlyArchive,
    };
  } catch {
    return fallback;
  }
}

function saveAnalyticsState(payload: PersistedAnalyticsPayload): void {
  if (typeof window === 'undefined') return;
  try {
    writeLocalCacheItem(ANALYTICS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage serialization errors
  }
}

function ensureTodayEntry(list: DailyTrafficMetric[], today: string): DailyTrafficMetric[] {
  if (list.some((d) => d.date === today)) {
    return list;
  }
  const next = [...list, createEmptyDay(today)].sort((a, b) => a.date.localeCompare(b.date));
  return next.slice(-60);
}

interface AnalyticsStoreState extends PersistedAnalyticsPayload {
  recordPageVisit: (pathname: string) => void;
  recordCatalogAction: () => void;
  recordCustomConfiguration: () => void;
  recordOrderInquiry: () => void;
  reloadFromStorage: () => void;
  resetAnalyticsDefaults: () => void;
}

const initialAnalytics = loadAnalyticsState();

export const useAnalyticsStore = create<AnalyticsStoreState>((set, get) => ({
  ...initialAnalytics,

  recordPageVisit: (pathname) => {
    const category = resolveVisitRouteCategory(pathname);
    if (!category) return;

    const today = getTodayIsoDate();
    let isNewUniqueSessionVisitor = false;
    if (typeof window !== 'undefined') {
      try {
        const lastCountedDate = window.sessionStorage.getItem(VISITOR_SESSION_KEY);
        if (lastCountedDate !== today) {
          isNewUniqueSessionVisitor = true;
          window.sessionStorage.setItem(VISITOR_SESSION_KEY, today);
        }
      } catch {
        // Ignore sessionStorage restrictions
      }
    }

    const ensured = ensureTodayEntry(get().dailyTraffic, today);
    const nextDaily = ensured.map((day) => {
      if (day.date !== today) return day;
      return {
        ...day,
        visitors: day.visitors + (isNewUniqueSessionVisitor ? 1 : 0),
        pageViews: day.pageViews + 1,
        routes: {
          ...day.routes,
          [category]: (day.routes[category] ?? 0) + 1,
        },
      };
    });

    const todayMonth = today.slice(0, 7);
    const existingMonth = get().monthlyArchive.some((m) => m.kodeBulan === todayMonth);
    const nextArchive = existingMonth
      ? get().monthlyArchive.map((m) =>
          m.kodeBulan === todayMonth
            ? {
                ...m,
                pengunjung: m.pengunjung + (isNewUniqueSessionVisitor ? 1 : 0),
                tayanganHalaman: m.tayanganHalaman + 1,
              }
            : m
        )
      : [
          ...get().monthlyArchive,
          {
            kodeBulan: todayMonth,
            pengunjung: isNewUniqueSessionVisitor ? 1 : 0,
            tayanganHalaman: 1,
            minatPesanan: 0,
          },
        ].sort((a, b) => a.kodeBulan.localeCompare(b.kodeBulan));

    const nextPayload: PersistedAnalyticsPayload = {
      schemaVersion: 2,
      updatedAt: new Date().toISOString(),
      dailyTraffic: nextDaily,
      monthlyArchive: nextArchive,
    };
    saveAnalyticsState(nextPayload);
    set(nextPayload);
  },

  recordCatalogAction: () => {
    const today = getTodayIsoDate();
    const ensured = ensureTodayEntry(get().dailyTraffic, today);
    const nextDaily = ensured.map((day) =>
      day.date === today ? { ...day, catalogActions: day.catalogActions + 1 } : day
    );
    const nextPayload: PersistedAnalyticsPayload = {
      schemaVersion: 2,
      updatedAt: new Date().toISOString(),
      dailyTraffic: nextDaily,
      monthlyArchive: get().monthlyArchive,
    };
    saveAnalyticsState(nextPayload);
    set(nextPayload);
  },

  recordCustomConfiguration: () => {
    const today = getTodayIsoDate();
    const ensured = ensureTodayEntry(get().dailyTraffic, today);
    const nextDaily = ensured.map((day) =>
      day.date === today ? { ...day, customConfigs: day.customConfigs + 1 } : day
    );
    const nextPayload: PersistedAnalyticsPayload = {
      schemaVersion: 2,
      updatedAt: new Date().toISOString(),
      dailyTraffic: nextDaily,
      monthlyArchive: get().monthlyArchive,
    };
    saveAnalyticsState(nextPayload);
    set(nextPayload);
  },

  recordOrderInquiry: () => {
    const today = getTodayIsoDate();
    const todayMonth = today.slice(0, 7);
    const ensured = ensureTodayEntry(get().dailyTraffic, today);
    const nextDaily = ensured.map((day) =>
      day.date === today ? { ...day, orderInquiries: day.orderInquiries + 1 } : day
    );
    const nextArchive = get().monthlyArchive.map((m) =>
      m.kodeBulan === todayMonth ? { ...m, minatPesanan: m.minatPesanan + 1 } : m
    );
    const nextPayload: PersistedAnalyticsPayload = {
      schemaVersion: 2,
      updatedAt: new Date().toISOString(),
      dailyTraffic: nextDaily,
      monthlyArchive: nextArchive,
    };
    saveAnalyticsState(nextPayload);
    set(nextPayload);
  },

  reloadFromStorage: () => {
    set(loadAnalyticsState());
  },

  resetAnalyticsDefaults: () => {
    const fresh = createDefaultAnalyticsPayload();
    saveAnalyticsState(fresh);
    set(fresh);
  },
}));

if (typeof window !== 'undefined') {
  subscribeLocalCacheChange(ANALYTICS_STORAGE_KEY, () => {
    useAnalyticsStore.setState(loadAnalyticsState());
  });
}
