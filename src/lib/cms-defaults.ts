import akunData from '../data/akun.json';
import faqsData from '../data/faq.json';
import materialSpecsData from '../data/spesifikasi-material.json';
import newsArticlesData from '../data/artikel-berita.json';
import portfolioProjectsData from '../data/portofolio.json';
import seoSettingsData from '../data/pengaturan-seo.json';
import siteProfileData from '../data/bisnis.json';
import socialPlansData from '../data/rencana-konten-sosmed.json';
import type {
  AdminAccessPageKey,
  AdminActivityLogItem,
  AdminPageAccessRule,
  AdminUserAccount,
  BerandaContent,
  CustomInteriorPricingConfig,
  FaqItem,
  MaterialSpecItem,
  NewsArticleItem,
  OperationalInfo,
  PortfolioCaseStudy,
  SeoSettingsConfig,
  SiteContentBundle,
  SocialMediaPlanItem,
  TentangContent,
} from '../types/cms';
import { BUSINESS_CONFIG } from './business-config';
import {
  INDICATIVE_ESTIMATE_CONFIG,
  INDICATIVE_WORKSHOP_ESTIMATE_RULES,
} from './custom-pricing';
import { DEFAULT_PAYMENT_SCHEME } from './payment-scheme';
import { syncPortfolioProjectsWithProducts } from './portfolio-filter';
import { getDefaultProductCatalog } from './product-catalog';
import { ACCESS_PAGE_CATALOG } from './rbac';

export { DEFAULT_PAYMENT_SCHEME };

export const DEFAULT_BERANDA_CONTENT: BerandaContent = siteProfileData.beranda as BerandaContent;

const tentangBase = siteProfileData.tentang as TentangContent;

export const DEFAULT_TENTANG_CONTENT: TentangContent = {
  pengantar: tentangBase.pengantar,
  gambarWorkshop: tentangBase.gambarWorkshop,
  teksAltWorkshop: tentangBase.teksAltWorkshop,
  daftarParagraf: tentangBase.daftarParagraf,
  pernyataanVisi: tentangBase.pernyataanVisi,
  daftarMisi: tentangBase.daftarMisi,
  anggotaTim: tentangBase.anggotaTim,
  sorotanWorkshop: tentangBase.sorotanWorkshop,
};

export const DEFAULT_PORTFOLIO_PROJECTS: PortfolioCaseStudy[] =
  syncPortfolioProjectsWithProducts(
    portfolioProjectsData as PortfolioCaseStudy[],
    getDefaultProductCatalog().daftarProduk
  );

export const DEFAULT_MATERIAL_SPECS: MaterialSpecItem[] =
  materialSpecsData as MaterialSpecItem[];

export const DEFAULT_FAQS: FaqItem[] = faqsData as FaqItem[];

export const DEFAULT_OPERATIONAL_INFO: OperationalInfo =
  siteProfileData.operasional as OperationalInfo;

export const DEFAULT_NEWS_ARTICLES: NewsArticleItem[] =
  newsArticlesData as NewsArticleItem[];

export const ALL_ADMIN_ACCESS_PAGES: AdminAccessPageKey[] = ACCESS_PAGE_CATALOG.map(
  (item) => item.halaman
);

export const OWNER_DEFAULT_ACCESS: AdminPageAccessRule[] = ALL_ADMIN_ACCESS_PAGES.map(
  (halaman) => ({
    halaman,
    krendensial: 'editor',
  })
);

export const DEFAULT_ADMIN_USERS: AdminUserAccount[] = akunData as AdminUserAccount[];

export const DEFAULT_ACTIVITY_LOGS: AdminActivityLogItem[] = [];

export const DEFAULT_SEO_SETTINGS: SeoSettingsConfig =
  seoSettingsData as SeoSettingsConfig;

export const DEFAULT_SOCIAL_PLANS: SocialMediaPlanItem[] =
  socialPlansData as SocialMediaPlanItem[];

export const DEFAULT_CUSTOM_PRICING_CONFIG: CustomInteriorPricingConfig = {
  hargaCustomTerkonfigurasi: INDICATIVE_ESTIMATE_CONFIG.hargaCustomTerkonfigurasi,
  persentaseDp: INDICATIVE_ESTIMATE_CONFIG.persentaseDp ?? 30,
  rules: structuredClone(INDICATIVE_WORKSHOP_ESTIMATE_RULES),
};

export function createDefaultSiteContentBundle(): SiteContentBundle {
  return {
    schemaVersion: 3,
    updatedAt: '2026-11-20T09:00:00.000Z',
    businessConfig: structuredClone(BUSINESS_CONFIG),
    beranda: structuredClone(DEFAULT_BERANDA_CONTENT),
    tentang: structuredClone(DEFAULT_TENTANG_CONTENT),
    portfolioProjects: structuredClone(DEFAULT_PORTFOLIO_PROJECTS),
    newsArticles: structuredClone(DEFAULT_NEWS_ARTICLES),
    materials: structuredClone(DEFAULT_MATERIAL_SPECS),
    faqs: structuredClone(DEFAULT_FAQS),
    operationalInfo: structuredClone(DEFAULT_OPERATIONAL_INFO),
    catalogOverride: null,
    seoSettings: structuredClone(DEFAULT_SEO_SETTINGS),
    socialPlans: structuredClone(DEFAULT_SOCIAL_PLANS),
    customPricing: structuredClone(DEFAULT_CUSTOM_PRICING_CONFIG),
    paymentScheme: structuredClone(DEFAULT_PAYMENT_SCHEME),
  };
}
