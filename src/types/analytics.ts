export type VisitRouteCategory =
  | 'beranda'
  | 'katalog'
  | 'custom'
  | 'portofolio'
  | 'informasi'
  | 'pesanan';

export type AnalyticsTimeframe = '7d' | '14d' | '30d';

export interface DailyTrafficMetric {
  date: string; // YYYY-MM-DD
  visitors: number;
  pageViews: number;
  catalogActions: number;
  customConfigs: number;
  orderInquiries: number;
  routes: Record<VisitRouteCategory, number>;
}

export interface MonthlyVisitArchive {
  kodeBulan: string; // YYYY-MM
  pengunjung: number;
  tayanganHalaman: number;
  minatPesanan: number;
}

export interface PersistedAnalyticsPayload {
  schemaVersion: number;
  updatedAt: string;
  dailyTraffic: DailyTrafficMetric[];
  monthlyArchive: MonthlyVisitArchive[];
}
