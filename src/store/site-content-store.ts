import { create } from 'zustand';
import { createDefaultSiteContentBundle } from '../lib/cms-defaults';
import { fetchProductCatalog, normalizeCatalogOptionGroups } from '../lib/product-catalog';
import type { BusinessConfig } from '../types/business';
import type {
  BerandaContent,
  CustomInteriorPricingConfig,
  FaqItem,
  MaterialSpecItem,
  NewsArticleItem,
  OperationalInfo,
  PortfolioCaseStudy,
  PortfolioReviewData,
  SeoSettingsConfig,
  ServicePolicyItem,
  SiteContentBundle,
  SocialMediaPlanItem,
  TentangContent,
} from '../types/cms';
import type { ProductCatalogDocument, ProductItem } from '../types/product';

export const SITE_CONTENT_STORAGE_KEY = 'shansusdzar-cms-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function filterKnownNumericKeys(
  raw: unknown,
  fallbackRecord: Record<string, number | null>
): Record<string, number | null> {
  const result: Record<string, number | null> = { ...fallbackRecord };
  if (!isRecord(raw)) return result;
  for (const key of Object.keys(fallbackRecord)) {
    const val = raw[key];
    if (val === null || (typeof val === 'number' && Number.isFinite(val))) {
      result[key] = val;
    }
  }
  return result;
}

function mergeCustomPricing(
  raw: unknown,
  fallback: CustomInteriorPricingConfig
): CustomInteriorPricingConfig {
  if (!isRecord(raw)) return fallback;
  const rawRules = isRecord(raw.rules) ? raw.rules : {};
  const rawConfigured =
    typeof raw.hargaCustomTerkonfigurasi === 'boolean'
      ? raw.hargaCustomTerkonfigurasi
      : typeof raw.isCustomPricingConfigured === 'boolean'
        ? raw.isCustomPricingConfigured
        : fallback.hargaCustomTerkonfigurasi;
  const rawDp =
    typeof raw.persentaseDp === 'number' && Number.isFinite(raw.persentaseDp)
      ? raw.persentaseDp
      : typeof raw.dpPercentage === 'number' && Number.isFinite(raw.dpPercentage)
        ? raw.dpPercentage
        : fallback.persentaseDp;
  const rawDesignRate =
    rawRules.hargaDesainPerMeterPersegi === null
      ? null
      : typeof rawRules.hargaDesainPerMeterPersegi === 'number' &&
          Number.isFinite(rawRules.hargaDesainPerMeterPersegi)
        ? rawRules.hargaDesainPerMeterPersegi
        : fallback.rules.hargaDesainPerMeterPersegi ?? null;
  const rawDesignBeforePromoRate =
    rawRules.hargaDesainSebelumPromoPerMeterPersegi === null
      ? null
      : typeof rawRules.hargaDesainSebelumPromoPerMeterPersegi === 'number' &&
          Number.isFinite(rawRules.hargaDesainSebelumPromoPerMeterPersegi)
        ? rawRules.hargaDesainSebelumPromoPerMeterPersegi
        : fallback.rules.hargaDesainSebelumPromoPerMeterPersegi ?? null;
  const rawPromoActive =
    typeof rawRules.promoAktif === 'boolean'
      ? rawRules.promoAktif
      : fallback.rules.promoAktif ?? false;
  return {
    hargaCustomTerkonfigurasi: rawConfigured,
    persentaseDp: rawDp,
    rules: {
      promoAktif: rawPromoActive,
      hargaDesainPerMeterPersegi: rawDesignRate,
      hargaDesainSebelumPromoPerMeterPersegi: rawDesignBeforePromoRate,
      hargaBahanPerMeterPersegi: filterKnownNumericKeys(
        rawRules.hargaBahanPerMeterPersegi,
        fallback.rules.hargaBahanPerMeterPersegi
      ),
      hargaBahanSebelumPromoPerMeterPersegi: filterKnownNumericKeys(
        rawRules.hargaBahanSebelumPromoPerMeterPersegi,
        fallback.rules.hargaBahanSebelumPromoPerMeterPersegi ?? {}
      ),
      hargaFinishingPerMeterPersegi: filterKnownNumericKeys(
        rawRules.hargaFinishingPerMeterPersegi,
        fallback.rules.hargaFinishingPerMeterPersegi
      ),
      hargaFinishingSebelumPromoPerMeterPersegi: filterKnownNumericKeys(
        rawRules.hargaFinishingSebelumPromoPerMeterPersegi,
        fallback.rules.hargaFinishingSebelumPromoPerMeterPersegi ?? {}
      ),
      biayaTambahanOpsi: filterKnownNumericKeys(
        rawRules.biayaTambahanOpsi,
        fallback.rules.biayaTambahanOpsi
      ),
    },
  };
}

function sanitizeNewsArticles(raw: unknown, fallback: NewsArticleItem[]): NewsArticleItem[] {
  if (!Array.isArray(raw)) return fallback;
  const result: NewsArticleItem[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const entry = raw[i];
    if (!isRecord(entry)) continue;
    const judul = typeof entry.judul === 'string' ? entry.judul.trim() : '';
    const slug = typeof entry.slug === 'string' ? entry.slug.trim() : '';
    if (!judul || !slug) continue;

    const paragrafKonten = Array.isArray(entry.paragrafKonten)
      ? entry.paragrafKonten.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      : [];
    const kataKunciSeo = Array.isArray(entry.kataKunciSeo)
      ? entry.kataKunciSeo.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
      : [];
    const ringkasan = typeof entry.ringkasan === 'string' ? entry.ringkasan.trim() : '';

    result.push({
      id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : `news-${i + 1}`,
      slug,
      judul,
      kategori:
        typeof entry.kategori === 'string' && entry.kategori.trim()
          ? entry.kategori.trim()
          : 'Kabar Workshop',
      ringkasan: ringkasan || paragrafKonten[0] || judul,
      paragrafKonten: paragrafKonten.length > 0 ? paragrafKonten : [ringkasan || judul],
      gambarSampul:
        typeof entry.gambarSampul === 'string' && entry.gambarSampul.trim()
          ? entry.gambarSampul.trim()
          : '/images/atelier-studio-craft.webp',
      teksAltSampul:
        typeof entry.teksAltSampul === 'string' && entry.teksAltSampul.trim()
          ? entry.teksAltSampul.trim()
          : judul,
      namaPenulis:
        typeof entry.namaPenulis === 'string' && entry.namaPenulis.trim()
          ? entry.namaPenulis.trim()
          : 'Tim Shansus Dzar Indonesia',
      tanggalTerbit:
        typeof entry.tanggalTerbit === 'string' && entry.tanggalTerbit.trim()
          ? entry.tanggalTerbit.trim()
          : '2026-11-01',
      menitBaca:
        typeof entry.menitBaca === 'number' && Number.isFinite(entry.menitBaca) && entry.menitBaca > 0
          ? Math.round(entry.menitBaca)
          : 3,
      judulSeo: typeof entry.judulSeo === 'string' ? entry.judulSeo : judul,
      deskripsiSeo: typeof entry.deskripsiSeo === 'string' ? entry.deskripsiSeo : ringkasan,
      kataKunciSeo,
      unggulan: Boolean(entry.unggulan),
      terbit: typeof entry.terbit === 'boolean' ? entry.terbit : true,
    });
  }
  return result;
}

function sanitizePortfolioReview(
  rawReview: unknown,
  fallbackReview?: PortfolioReviewData | null
): PortfolioReviewData | null {
  if (rawReview === null) return null;
  if (rawReview === undefined) {
    return fallbackReview ? { ...fallbackReview } : null;
  }
  if (!isRecord(rawReview)) {
    return fallbackReview ? { ...fallbackReview } : null;
  }
  const namaPengulas = typeof rawReview.namaPengulas === 'string' ? rawReview.namaPengulas.trim() : '';
  const inisial = typeof rawReview.inisial === 'string' ? rawReview.inisial.trim().toUpperCase().slice(0, 3) : '';
  const komentar = typeof rawReview.komentar === 'string' ? rawReview.komentar.trim() : '';
  const penilaian =
    typeof rawReview.penilaian === 'number' && Number.isFinite(rawReview.penilaian)
      ? Math.max(1, Math.min(5, Math.round(rawReview.penilaian)))
      : 5;
  const tampil = typeof rawReview.tampil === 'boolean' ? rawReview.tampil : Boolean(namaPengulas && komentar);

  if (!namaPengulas && !komentar && !tampil) return null;
  return {
    tampil,
    namaPengulas,
    inisial,
    penilaian,
    komentar,
  };
}

function sanitizePortfolioProjects(
  raw: unknown,
  fallback: PortfolioCaseStudy[]
): PortfolioCaseStudy[] {
  if (!Array.isArray(raw)) return fallback;
  const fallbackById = new Map(fallback.map((item) => [item.id, item]));
  const result: PortfolioCaseStudy[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const project = entry as unknown as PortfolioCaseStudy;
    if (typeof project.id !== 'string' || typeof project.judul !== 'string') continue;
    const fallbackProject = fallbackById.get(project.id);
    result.push({
      ...project,
      ulasan: sanitizePortfolioReview(entry.ulasan, fallbackProject?.ulasan),
    });
  }
  return result.length > 0 ? result : fallback;
}

function sanitizeCatalogOverride(
  raw: unknown
): ProductCatalogDocument | null {
  if (!isRecord(raw) || !Array.isArray(raw.daftarProduk)) return null;
  const doc = raw as unknown as ProductCatalogDocument;
  return {
    ...doc,
    daftarProduk: doc.daftarProduk.map((item) => ({
      ...item,
      opsiKustom: normalizeCatalogOptionGroups(item.opsiKustom ?? []),
    })),
  };
}

function loadSiteContentBundle(): SiteContentBundle {
  const fallback = createDefaultSiteContentBundle();
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(SITE_CONTENT_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== 3) return fallback;

    return {
      schemaVersion: 3,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : fallback.updatedAt,
      businessConfig: isRecord(parsed.businessConfig)
        ? {
            ...fallback.businessConfig,
            ...(parsed.businessConfig as unknown as BusinessConfig),
            mediaSosial: {
              ...fallback.businessConfig.mediaSosial!,
              ...(isRecord(parsed.businessConfig.mediaSosial)
                ? (parsed.businessConfig.mediaSosial as Partial<NonNullable<BusinessConfig['mediaSosial']>>)
                : {}),
            },
          }
        : fallback.businessConfig,
      beranda: isRecord(parsed.beranda)
        ? { ...fallback.beranda, ...(parsed.beranda as unknown as BerandaContent) }
        : fallback.beranda,
      tentang: (() => {
        if (!isRecord(parsed.tentang)) return fallback.tentang;
        const saved = parsed.tentang as unknown as Partial<TentangContent>;
        return {
          ...fallback.tentang,
          ...saved,
          daftarMisi: Array.isArray(saved.daftarMisi)
            ? saved.daftarMisi
            : fallback.tentang.daftarMisi,
          anggotaTim: Array.isArray(saved.anggotaTim)
            ? saved.anggotaTim
            : fallback.tentang.anggotaTim,
          sorotanWorkshop: Array.isArray(saved.sorotanWorkshop)
            ? saved.sorotanWorkshop
            : fallback.tentang.sorotanWorkshop,
          komitmenLayanan: Array.isArray(saved.komitmenLayanan)
            ? saved.komitmenLayanan
            : fallback.tentang.komitmenLayanan,
        };
      })(),
      portfolioProjects: sanitizePortfolioProjects(
        parsed.portfolioProjects,
        fallback.portfolioProjects
      ),
      newsArticles: sanitizeNewsArticles(parsed.newsArticles, fallback.newsArticles),
      materials: Array.isArray(parsed.materials)
        ? (parsed.materials as MaterialSpecItem[])
        : fallback.materials,
      faqs: Array.isArray(parsed.faqs) ? (parsed.faqs as FaqItem[]) : fallback.faqs,
      policies: Array.isArray(parsed.policies)
        ? (parsed.policies as ServicePolicyItem[])
        : fallback.policies,
      operationalInfo: isRecord(parsed.operationalInfo)
        ? { ...fallback.operationalInfo, ...(parsed.operationalInfo as unknown as OperationalInfo) }
        : fallback.operationalInfo,
      catalogOverride: sanitizeCatalogOverride(parsed.catalogOverride),
      seoSettings: isRecord(parsed.seoSettings)
        ? {
            ...fallback.seoSettings!,
            ...(parsed.seoSettings as unknown as SeoSettingsConfig),
            penyesuaianHalaman: Array.isArray(parsed.seoSettings.penyesuaianHalaman)
              ? (parsed.seoSettings.penyesuaianHalaman as SeoSettingsConfig['penyesuaianHalaman'])
              : fallback.seoSettings!.penyesuaianHalaman,
          }
        : fallback.seoSettings,
      socialPlans: Array.isArray(parsed.socialPlans)
        ? (parsed.socialPlans as SocialMediaPlanItem[])
        : fallback.socialPlans,
      customPricing: mergeCustomPricing(parsed.customPricing, fallback.customPricing!),
    };
  } catch {
    return fallback;
  }
}

function persistSiteContentBundle(bundle: SiteContentBundle): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SITE_CONTENT_STORAGE_KEY, JSON.stringify(bundle));
  } catch {
    // Ignore storage quota or private mode failures
  }
}

export function buildDynamicWhatsAppUrl(config: BusinessConfig, message?: string): string {
  const base = config.whatsapp.urlDasar || `https://wa.me/${config.whatsapp.digitTerstandar}`;
  if (!message || !message.trim()) {
    return base;
  }
  return `${base}?text=${encodeURIComponent(message.trim())}`;
}

export function buildDynamicMapsUrl(config: BusinessConfig): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    config.alamat.alamatLengkap
  )}`;
}

interface SiteContentStoreState extends SiteContentBundle {
  loadedBaseCatalog: ProductCatalogDocument | null;
  catalogLoadStatus: 'idle' | 'loading' | 'ready' | 'error';
  catalogError: string | null;

  ensureBaseCatalogLoaded: (force?: boolean) => Promise<void>;
  getActiveCatalog: () => ProductCatalogDocument | null;

  updateBusinessConfig: (next: BusinessConfig) => void;
  updateBeranda: (next: BerandaContent) => void;
  updateTentang: (next: TentangContent) => void;

  upsertPortfolioProject: (project: PortfolioCaseStudy) => void;
  deletePortfolioProject: (id: string) => void;
  movePortfolioProject: (id: string, direction: 'up' | 'down') => void;

  upsertMaterial: (item: MaterialSpecItem) => void;
  deleteMaterial: (id: string) => void;

  upsertNewsArticle: (article: NewsArticleItem) => void;
  deleteNewsArticle: (id: string) => void;

  upsertFaq: (item: FaqItem) => void;
  deleteFaq: (id: string) => void;

  upsertPolicy: (item: ServicePolicyItem) => void;
  deletePolicy: (id: string) => void;

  updateOperationalInfo: (next: OperationalInfo) => void;

  upsertCatalogProduct: (product: ProductItem) => Promise<void>;
  deleteCatalogProduct: (productId: string) => Promise<void>;
  updateCatalogMeta: (meta: Pick<ProductCatalogDocument, 'catatan' | 'katalogContoh'>) => Promise<void>;
  resetCatalogToFileDefault: () => Promise<void>;

  importSiteBundle: (rawJson: string) => { ok: boolean; message: string };
  updateSeoSettings: (next: SeoSettingsConfig) => void;
  upsertSocialPlan: (item: SocialMediaPlanItem) => void;
  deleteSocialPlan: (id: string) => void;
  updateCustomPricing: (next: CustomInteriorPricingConfig) => void;
  resetAllSiteContent: () => void;
}

function extractBundleSnapshot(state: SiteContentStoreState): SiteContentBundle {
  return {
    schemaVersion: 3,
    updatedAt: state.updatedAt,
    businessConfig: state.businessConfig,
    beranda: state.beranda,
    tentang: state.tentang,
    portfolioProjects: state.portfolioProjects,
    newsArticles: state.newsArticles,
    materials: state.materials,
    faqs: state.faqs,
    policies: state.policies,
    operationalInfo: state.operationalInfo,
    catalogOverride: state.catalogOverride,
    seoSettings: state.seoSettings,
    socialPlans: state.socialPlans,
    customPricing: state.customPricing,
  };
}

function commitBundleUpdate(
  set: (partial: Partial<SiteContentStoreState>) => void,
  get: () => SiteContentStoreState,
  patch: Partial<SiteContentBundle>
): void {
  const current = extractBundleSnapshot(get());
  const next: SiteContentBundle = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  persistSiteContentBundle(next);
  set({
    ...patch,
    updatedAt: next.updatedAt,
  });
}

const initialBundle = loadSiteContentBundle();

export const useSiteContentStore = create<SiteContentStoreState>((set, get) => ({
  ...initialBundle,
  loadedBaseCatalog: null,
  catalogLoadStatus: initialBundle.catalogOverride ? 'ready' : 'idle',
  catalogError: null,

  ensureBaseCatalogLoaded: async (force = false) => {
    const state = get();
    if (!force && (state.catalogLoadStatus === 'loading' || state.loadedBaseCatalog !== null)) {
      return;
    }

    if (!state.catalogOverride) {
      set({ catalogLoadStatus: 'loading', catalogError: null });
    }

    const result = await fetchProductCatalog('/produk/produk.json');
    if (result.status === 'success') {
      set({
        loadedBaseCatalog: result.catalog,
        catalogLoadStatus: 'ready',
        catalogError: null,
      });
    } else {
      set((prev) => ({
        catalogLoadStatus: prev.catalogOverride ? 'ready' : 'error',
        catalogError: prev.catalogOverride ? null : result.message,
      }));
    }
  },

  getActiveCatalog: () => {
    const state = get();
    return state.catalogOverride ?? state.loadedBaseCatalog;
  },

  updateBusinessConfig: (next) => {
    commitBundleUpdate(set, get, { businessConfig: next });
  },

  updateBeranda: (next) => {
    commitBundleUpdate(set, get, { beranda: next });
  },

  updateTentang: (next) => {
    commitBundleUpdate(set, get, { tentang: next });
  },

  upsertPortfolioProject: (project) => {
    const existing = get().portfolioProjects;
    const idx = existing.findIndex((p) => p.id === project.id);
    const updated =
      idx >= 0
        ? existing.map((p, i) => (i === idx ? project : p))
        : [...existing, project];
    const sorted = [...updated].sort((a, b) => a.urutan - b.urutan);
    commitBundleUpdate(set, get, { portfolioProjects: sorted });
  },

  deletePortfolioProject: (id) => {
    const next = get().portfolioProjects.filter((p) => p.id !== id);
    commitBundleUpdate(set, get, { portfolioProjects: next });
  },

  movePortfolioProject: (id, direction) => {
    const sorted = [...get().portfolioProjects].sort((a, b) => a.urutan - b.urutan);
    const index = sorted.findIndex((p) => p.id === id);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const swapped = [...sorted];
    const [moved] = swapped.splice(index, 1);
    swapped.splice(targetIndex, 0, moved);
    const reindexed = swapped.map((item, i) => ({ ...item, urutan: i + 1 }));
    commitBundleUpdate(set, get, { portfolioProjects: reindexed });
  },

  upsertMaterial: (item) => {
    const existing = get().materials;
    const idx = existing.findIndex((m) => m.id === item.id);
    const next = idx >= 0 ? existing.map((m, i) => (i === idx ? item : m)) : [...existing, item];
    commitBundleUpdate(set, get, { materials: next });
  },

  deleteMaterial: (id) => {
    commitBundleUpdate(set, get, { materials: get().materials.filter((m) => m.id !== id) });
  },

  upsertNewsArticle: (article) => {
    const existing = get().newsArticles;
    const idx = existing.findIndex((n) => n.id === article.id);
    const next =
      idx >= 0 ? existing.map((n, i) => (i === idx ? article : n)) : [article, ...existing];
    commitBundleUpdate(set, get, {
      newsArticles: [...next].sort((a, b) => b.tanggalTerbit.localeCompare(a.tanggalTerbit)),
    });
  },

  deleteNewsArticle: (id) => {
    commitBundleUpdate(set, get, {
      newsArticles: get().newsArticles.filter((n) => n.id !== id),
    });
  },

  upsertFaq: (item) => {
    const existing = get().faqs;
    const idx = existing.findIndex((f) => f.id === item.id);
    const next = idx >= 0 ? existing.map((f, i) => (i === idx ? item : f)) : [...existing, item];
    commitBundleUpdate(set, get, {
      faqs: [...next].sort((a, b) => a.urutan - b.urutan),
    });
  },

  deleteFaq: (id) => {
    commitBundleUpdate(set, get, { faqs: get().faqs.filter((f) => f.id !== id) });
  },

  upsertPolicy: (item) => {
    const existing = get().policies;
    const idx = existing.findIndex((p) => p.id === item.id);
    const next = idx >= 0 ? existing.map((p, i) => (i === idx ? item : p)) : [...existing, item];
    commitBundleUpdate(set, get, { policies: next });
  },

  deletePolicy: (id) => {
    commitBundleUpdate(set, get, { policies: get().policies.filter((p) => p.id !== id) });
  },

  updateOperationalInfo: (next) => {
    commitBundleUpdate(set, get, { operationalInfo: next });
  },

  upsertCatalogProduct: async (product) => {
    await get().ensureBaseCatalogLoaded();
    const base: ProductCatalogDocument = get().getActiveCatalog() ?? {
      versiSkema: 2,
      katalogContoh: false,
      catatan: 'Katalog produk resmi Shansus Dzar Indonesia — Interior Design & Building.',
      diperbaruiPada: new Date().toISOString().slice(0, 10),
      daftarProduk: [],
    };
    const exists = base.daftarProduk.some((p) => p.id === product.id);
    const nextProducts = exists
      ? base.daftarProduk.map((p) => (p.id === product.id ? product : p))
      : [...base.daftarProduk, product];

    const nextCatalog: ProductCatalogDocument = {
      ...base,
      diperbaruiPada: new Date().toISOString().slice(0, 10),
      daftarProduk: [...nextProducts].sort((a, b) => a.urutan - b.urutan),
    };
    commitBundleUpdate(set, get, { catalogOverride: nextCatalog });
  },

  deleteCatalogProduct: async (productId) => {
    await get().ensureBaseCatalogLoaded();
    const base = get().getActiveCatalog();
    if (!base) return;
    const nextCatalog: ProductCatalogDocument = {
      ...base,
      diperbaruiPada: new Date().toISOString().slice(0, 10),
      daftarProduk: base.daftarProduk.filter((p) => p.id !== productId),
    };
    commitBundleUpdate(set, get, { catalogOverride: nextCatalog });
  },

  updateCatalogMeta: async (meta) => {
    await get().ensureBaseCatalogLoaded();
    const base = get().getActiveCatalog();
    if (!base) return;
    const nextCatalog: ProductCatalogDocument = {
      ...base,
      catatan: meta.catatan,
      katalogContoh: meta.katalogContoh,
      diperbaruiPada: new Date().toISOString().slice(0, 10),
    };
    commitBundleUpdate(set, get, { catalogOverride: nextCatalog });
  },

  resetCatalogToFileDefault: async () => {
    commitBundleUpdate(set, get, { catalogOverride: null });
    await get().ensureBaseCatalogLoaded(true);
  },

  importSiteBundle: (rawJson) => {
    try {
      const parsed: unknown = JSON.parse(rawJson);
      if (!isRecord(parsed) || parsed.schemaVersion !== 3) {
        return { ok: false, message: 'Format berkas JSON cadangan tidak valid.' };
      }
      const fallback = createDefaultSiteContentBundle();
      const next: SiteContentBundle = {
        schemaVersion: 3,
        updatedAt: new Date().toISOString(),
        businessConfig: isRecord(parsed.businessConfig)
          ? {
              ...fallback.businessConfig,
              ...(parsed.businessConfig as unknown as BusinessConfig),
              mediaSosial: {
                ...fallback.businessConfig.mediaSosial!,
                ...(isRecord(parsed.businessConfig.mediaSosial)
                  ? (parsed.businessConfig.mediaSosial as Partial<NonNullable<BusinessConfig['mediaSosial']>>)
                  : {}),
              },
            }
          : fallback.businessConfig,
        beranda: isRecord(parsed.beranda)
          ? { ...fallback.beranda, ...(parsed.beranda as unknown as BerandaContent) }
          : fallback.beranda,
        tentang: isRecord(parsed.tentang)
          ? { ...fallback.tentang, ...(parsed.tentang as unknown as TentangContent) }
          : fallback.tentang,
        portfolioProjects: sanitizePortfolioProjects(
          parsed.portfolioProjects,
          fallback.portfolioProjects
        ),
        newsArticles: sanitizeNewsArticles(parsed.newsArticles, fallback.newsArticles),
        materials: Array.isArray(parsed.materials)
          ? (parsed.materials as MaterialSpecItem[])
          : fallback.materials,
        faqs: Array.isArray(parsed.faqs) ? (parsed.faqs as FaqItem[]) : fallback.faqs,
        policies: Array.isArray(parsed.policies)
          ? (parsed.policies as ServicePolicyItem[])
          : fallback.policies,
        operationalInfo: isRecord(parsed.operationalInfo)
          ? {
              ...fallback.operationalInfo,
              ...(parsed.operationalInfo as unknown as OperationalInfo),
            }
          : fallback.operationalInfo,
        catalogOverride: sanitizeCatalogOverride(parsed.catalogOverride),
        seoSettings: isRecord(parsed.seoSettings)
          ? {
              ...fallback.seoSettings!,
              ...(parsed.seoSettings as unknown as SeoSettingsConfig),
            }
          : fallback.seoSettings,
        socialPlans: Array.isArray(parsed.socialPlans)
          ? (parsed.socialPlans as SocialMediaPlanItem[])
          : fallback.socialPlans,
        customPricing: mergeCustomPricing(parsed.customPricing, fallback.customPricing!),
      };
      persistSiteContentBundle(next);
      set(next);
      return { ok: true, message: 'Seluruh konten situs berhasil dipulihkan dari cadangan.' };
    } catch {
      return { ok: false, message: 'Berkas JSON tidak dapat dibaca.' };
    }
  },

  updateSeoSettings: (next) => {
    commitBundleUpdate(set, get, { seoSettings: next });
  },

  upsertSocialPlan: (item) => {
    const existing = get().socialPlans ?? [];
    const idx = existing.findIndex((s) => s.id === item.id);
    const next = idx >= 0 ? existing.map((s, i) => (i === idx ? item : s)) : [item, ...existing];
    commitBundleUpdate(set, get, {
      socialPlans: [...next].sort((a, b) => a.tanggalTerjadwal.localeCompare(b.tanggalTerjadwal)),
    });
  },

  deleteSocialPlan: (id) => {
    commitBundleUpdate(set, get, {
      socialPlans: (get().socialPlans ?? []).filter((s) => s.id !== id),
    });
  },

  updateCustomPricing: (next) => {
    commitBundleUpdate(set, get, { customPricing: next });
  },

  resetAllSiteContent: () => {
    const fresh = createDefaultSiteContentBundle();
    persistSiteContentBundle(fresh);
    set({
      ...fresh,
      catalogLoadStatus: get().loadedBaseCatalog ? 'ready' : 'idle',
    });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== SITE_CONTENT_STORAGE_KEY) return;
    const reloaded = loadSiteContentBundle();
    useSiteContentStore.setState((prev) => ({
      ...reloaded,
      catalogLoadStatus: reloaded.catalogOverride
        ? 'ready'
        : prev.loadedBaseCatalog
          ? 'ready'
          : 'idle',
    }));
  });
}
