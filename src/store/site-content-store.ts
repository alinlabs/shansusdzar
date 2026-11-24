import { create } from 'zustand';
import { createDefaultSiteContentBundle } from '../lib/cms-defaults';
import { resolveProductPricingCategory } from '../lib/custom-pricing';
import {
  DEFAULT_PAYMENT_SCHEME,
  formatPaymentSchemeSummary,
  resolvePaymentSchemeDpPercentage,
  sanitizePaymentScheme,
} from '../lib/payment-scheme';
import { syncPortfolioProjectsWithProducts } from '../lib/portfolio-filter';
import {
  getDefaultProductCatalog,
  getProductSlug,
  normalizeCustomisasiList,
  normalizeIncludeList,
  normalizeProductMediaList,
  normalizePromoField,
  normalizeReferenceSizes,
  slugifyProduct,
} from '../lib/product-catalog';
import type { BusinessConfig } from '../types/business';
import type {
  BerandaContent,
  CustomInteriorPricingConfig,
  FaqItem,
  MaterialSpecItem,
  NewsArticleItem,
  OperationalInfo,
  PaymentSchemeConfig,
  PortfolioCaseStudy,
  PortfolioReviewData,
  SeoSettingsConfig,
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

function mergeCategoryPricingMap(
  raw: unknown,
  fallback: CustomInteriorPricingConfig['rules']['tarifPerKategori']
): CustomInteriorPricingConfig['rules']['tarifPerKategori'] {
  if (!fallback) return undefined;
  const result: NonNullable<CustomInteriorPricingConfig['rules']['tarifPerKategori']> = {};
  const rawMap = isRecord(raw) ? raw : {};

  for (const [key, fallbackGroup] of Object.entries(fallback)) {
    if (!fallbackGroup) continue;
    const typedKey = key as keyof typeof fallback;
    const rawGroup = isRecord(rawMap[key]) ? rawMap[key] : {};

    const rawHplSource = isRecord(rawGroup.hplPerSatuan)
      ? rawGroup.hplPerSatuan
      : rawGroup.tacoSheetPerSatuan;

    let ducoPerSatuan: Record<string, number | null>;
    if (isRecord(rawGroup.ducoPerSatuan)) {
      ducoPerSatuan = filterKnownNumericKeys(rawGroup.ducoPerSatuan, fallbackGroup.ducoPerSatuan);
    } else if (
      typeof rawGroup.catDucoPerSatuan === 'number' &&
      Number.isFinite(rawGroup.catDucoPerSatuan) &&
      rawGroup.catDucoPerSatuan > 0
    ) {
      const legacyVal = rawGroup.catDucoPerSatuan;
      ducoPerSatuan = {
        blockboard: legacyVal,
        multipleks: legacyVal,
        pvc: legacyVal,
      };
    } else {
      ducoPerSatuan = { ...fallbackGroup.ducoPerSatuan };
    }

    result[typedKey] = {
      id: fallbackGroup.id,
      label: fallbackGroup.label,
      satuan: fallbackGroup.satuan,
      hplPerSatuan: filterKnownNumericKeys(rawHplSource, fallbackGroup.hplPerSatuan),
      ducoPerSatuan,
    };
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
  const rawFinishing = isRecord(rawRules.hargaFinishingPerMeterPersegi)
    ? {
        ...rawRules.hargaFinishingPerMeterPersegi,
        ...(rawRules.hargaFinishingPerMeterPersegi.hpl === undefined &&
        rawRules.hargaFinishingPerMeterPersegi['taco-sheet'] !== undefined
          ? { hpl: rawRules.hargaFinishingPerMeterPersegi['taco-sheet'] }
          : {}),
      }
    : rawRules.hargaFinishingPerMeterPersegi;
  return {
    hargaCustomTerkonfigurasi: rawConfigured,
    persentaseDp: rawDp,
    rules: {
      promoAktif: false,
      hargaDesainPerMeterPersegi: rawDesignRate,
      hargaBahanPerMeterPersegi: filterKnownNumericKeys(
        rawRules.hargaBahanPerMeterPersegi,
        fallback.rules.hargaBahanPerMeterPersegi
      ),
      hargaFinishingPerMeterPersegi: filterKnownNumericKeys(
        rawFinishing,
        fallback.rules.hargaFinishingPerMeterPersegi
      ),
      tarifPerKategori: mergeCategoryPricingMap(
        rawRules.tarifPerKategori,
        fallback.rules.tarifPerKategori
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
      tanggalTerbit:
        typeof entry.tanggalTerbit === 'string' && entry.tanggalTerbit.trim()
          ? entry.tanggalTerbit.trim()
          : '2026-11-01',
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
    const rawHarga =
      typeof entry.referensiHarga === 'number' &&
      Number.isFinite(entry.referensiHarga) &&
      entry.referensiHarga > 0
        ? Math.round(entry.referensiHarga)
        : fallbackProject?.referensiHarga ?? null;
    result.push({
      ...project,
      referensiHarga: rawHarga,
      ulasan: sanitizePortfolioReview(entry.ulasan, fallbackProject?.ulasan),
    });
  }
  const sanitized = result.length > 0 ? result : fallback;
  return syncPortfolioProjectsWithProducts(sanitized, getDefaultProductCatalog().daftarProduk);
}

function sanitizeCatalogProductItem(rawItem: unknown): ProductItem | null {
  if (!isRecord(rawItem)) return null;
  const id = typeof rawItem.id === 'string' ? rawItem.id.trim() : '';
  const nama = typeof rawItem.nama === 'string' ? rawItem.nama.trim() : '';
  const kategori = typeof rawItem.kategori === 'string' ? rawItem.kategori.trim() : '';
  const deskripsiSingkat =
    typeof rawItem.deskripsiSingkat === 'string' ? rawItem.deskripsiSingkat.trim() : '';
  if (!id || !nama || !kategori || !deskripsiSingkat) return null;

  const slug = slugifyProduct(nama) || slugifyProduct(id) || 'produk';

  const gambarSampul =
    typeof rawItem.gambarSampul === 'string' && rawItem.gambarSampul.trim()
      ? rawItem.gambarSampul.trim()
      : undefined;
  const media = normalizeProductMediaList(
    rawItem.media,
    rawItem.daftarGambar,
    rawItem.daftarVideo
  );

  const hpl: Record<string, number | null> = {};
  const duco: Record<string, number | null> = {};

  if (isRecord(rawItem.harga)) {
    if (isRecord(rawItem.harga.hpl)) {
      for (const [k, v] of Object.entries(rawItem.harga.hpl)) {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
          hpl[k] = v;
        }
      }
    }
    if (isRecord(rawItem.harga.duco)) {
      for (const [k, v] of Object.entries(rawItem.harga.duco)) {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
          duco[k] = v;
        }
      }
    }
  } else if (isRecord(rawItem.tarifSatuan)) {
    const legacyHplRaw = isRecord(rawItem.tarifSatuan.tacoSheet)
      ? rawItem.tarifSatuan.tacoSheet
      : null;
    if (legacyHplRaw) {
      for (const [k, v] of Object.entries(legacyHplRaw)) {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
          hpl[k] = v;
        }
      }
    }
    const legacyDucoScalar =
      typeof rawItem.tarifSatuan.catDuco === 'number' &&
      Number.isFinite(rawItem.tarifSatuan.catDuco) &&
      rawItem.tarifSatuan.catDuco > 0
        ? rawItem.tarifSatuan.catDuco
        : null;
    if (legacyDucoScalar !== null) {
      duco.blockboard = legacyDucoScalar;
      duco.multipleks = legacyDucoScalar;
      duco.pvc = legacyDucoScalar;
    }
  }

  const customisasi = normalizeCustomisasiList(rawItem.customisasi ?? rawItem.opsiKustom);
  const include = normalizeIncludeList(rawItem.include ?? rawItem.opsiTambahan);
  const promo = normalizePromoField(rawItem.promo);
  const pilihanWarna = Array.isArray(rawItem.pilihanWarna)
    ? (rawItem.pilihanWarna as ProductItem['pilihanWarna'])
    : undefined;
  const meterLari =
    typeof rawItem.meterLari === 'boolean' ? rawItem.meterLari : undefined;
  const model3d =
    typeof rawItem['3d'] === 'string' && rawItem['3d'].trim()
      ? rawItem['3d'].trim()
      : undefined;

  return {
    id,
    slug,
    nama,
    kategori,
    deskripsiSingkat,
    ...(gambarSampul ? { gambarSampul } : {}),
    ...(model3d ? { '3d': model3d } : {}),
    media,
    ...(pilihanWarna && pilihanWarna.length > 0 ? { pilihanWarna } : {}),
    referensiUkuran: normalizeReferenceSizes(rawItem.referensiUkuran, rawItem.dimensi),
    ...(meterLari !== undefined ? { meterLari } : {}),
    ...(Object.keys(hpl).length > 0 || Object.keys(duco).length > 0
      ? { harga: { hpl, duco } }
      : {}),
    ...(promo !== undefined ? { promo } : {}),
    customisasi,
    include,
  };
}

function normalizeMaterialScore(
  rawValue: unknown,
  fallbackValue: number
): number {
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    return fallbackValue;
  }
  const rounded = Math.round(rawValue);
  if (rounded >= 1 && rounded <= 5) {
    return fallbackValue;
  }
  return Math.max(0, Math.min(100, rounded));
}

function sanitizeMaterials(raw: unknown, fallback: MaterialSpecItem[]): MaterialSpecItem[] {
  if (!Array.isArray(raw)) return fallback;
  const fallbackById = new Map(fallback.map((m) => [m.id, m]));
  const hplFallback = fallbackById.get('fin-hpl');
  const migrated = (raw as Array<MaterialSpecItem & Record<string, unknown>>).map((item) => {
    if (item && (item.id === 'fin-taco-sheet' || /taco\s*sheet/i.test(String(item.nama ?? '')))) {
      return hplFallback ? structuredClone(hplFallback) : item;
    }
    const base = item?.id ? fallbackById.get(item.id) : undefined;
    const {
      ketahananPermukaan: _legacySurface,
      tingkatHarga: _legacyTier,
      ketebalanStandar: _legacyThickness,
      catatanPenggunaan: _legacyUsageNote,
      keterjangkauanHarga: _legacyAffordability,
      ...cleanItem
    } = item ?? {};
    void _legacySurface;
    void _legacyTier;
    void _legacyThickness;
    void _legacyUsageNote;

    const rawAffordability = cleanItem.keterjangkauan ?? _legacyAffordability;

    if (!base) {
      return {
        ...cleanItem,
        cocokUntuk: Array.isArray(cleanItem.cocokUntuk)
          ? cleanItem.cocokUntuk.map((v) => String(v).trim()).filter(Boolean).slice(0, 5)
          : [],
        ketahananLembap: normalizeMaterialScore(cleanItem.ketahananLembap, 75),
        peringkatKeawetan: normalizeMaterialScore(cleanItem.peringkatKeawetan, 80),
        keterjangkauan: normalizeMaterialScore(rawAffordability, 75),
      } as MaterialSpecItem;
    }
    const sanitizedBestFor = Array.isArray(cleanItem.cocokUntuk)
      ? cleanItem.cocokUntuk.map((v) => String(v).trim()).filter(Boolean).slice(0, 5)
      : [];
    return {
      ...base,
      ...cleanItem,
      cocokUntuk: sanitizedBestFor.length > 0 ? sanitizedBestFor : base.cocokUntuk.slice(0, 5),
      ketahananLembap: normalizeMaterialScore(cleanItem.ketahananLembap, base.ketahananLembap),
      peringkatKeawetan: normalizeMaterialScore(cleanItem.peringkatKeawetan, base.peringkatKeawetan),
      keterjangkauan: normalizeMaterialScore(rawAffordability, base.keterjangkauan),
      terbuatDari: cleanItem.terbuatDari || base.terbuatDari,
      kelebihan:
        Array.isArray(cleanItem.kelebihan) && cleanItem.kelebihan.length > 0
          ? cleanItem.kelebihan
          : base.kelebihan,
      gambarReferensi: cleanItem.gambarReferensi || base.gambarReferensi,
    };
  });
  return migrated.length > 0 ? migrated : fallback;
}

function sanitizeCatalogOverride(raw: unknown): ProductCatalogDocument | null {
  if (Array.isArray(raw)) {
    const items = raw
      .map(sanitizeCatalogProductItem)
      .filter((item): item is ProductItem => item !== null);
    return {
      versiSkema: 5,
      katalogContoh: false,
      catatan: 'Seluruh unit produk menggunakan skema Design & Build (pemesanan pembuatan otomatis Gratis Desain 3D).',
      diperbaruiPada: new Date().toISOString().slice(0, 10),
      daftarProduk: items,
    };
  }
  if (!isRecord(raw) || !Array.isArray(raw.daftarProduk)) return null;
  const doc = raw as unknown as ProductCatalogDocument;
  const items = raw.daftarProduk
    .map(sanitizeCatalogProductItem)
    .filter((item): item is ProductItem => item !== null);
  return {
    versiSkema: 5,
    katalogContoh: doc.katalogContoh !== false,
    catatan: doc.catatan ?? '',
    diperbaruiPada: doc.diperbaruiPada ?? '',
    daftarProduk: items,
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
        ? (() => {
            const mergedConfig: BusinessConfig = {
              ...fallback.businessConfig,
              ...(parsed.businessConfig as unknown as BusinessConfig),
              mediaSosial: {
                ...fallback.businessConfig.mediaSosial!,
                ...(isRecord(parsed.businessConfig.mediaSosial)
                  ? (parsed.businessConfig.mediaSosial as Partial<NonNullable<BusinessConfig['mediaSosial']>>)
                  : {}),
              },
            };
            const cachedWa = mergedConfig.whatsapp;
            if (
              !cachedWa ||
              cachedWa.digitTerstandar === '6285797184059' ||
              cachedWa.nomorTampil === '+6285797184059' ||
              cachedWa.urlDasar === 'https://wa.me/6285797184059'
            ) {
              mergedConfig.whatsapp = { ...fallback.businessConfig.whatsapp };
            } else if (cachedWa.nomorTampil === '+6281315000234') {
              mergedConfig.whatsapp = {
                ...cachedWa,
                nomorTampil: fallback.businessConfig.whatsapp.nomorTampil,
              };
            }
            const cachedAddr = mergedConfig.alamat;
            if (
              !cachedAddr ||
              cachedAddr.alamatLengkap ===
                'Kp. Tegal Jati, RT 19/RW 10, Desa Cibogohilir, Kabupaten Purwakarta, 41162, Indonesia'
            ) {
              mergedConfig.alamat = { ...fallback.businessConfig.alamat };
            }
            return mergedConfig;
          })()
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
          anggotaTim:
            Array.isArray(saved.anggotaTim) &&
            !(
              saved.anggotaTim.length <= 4 &&
              saved.anggotaTim.every((m) =>
                ['tim-hilman', 'tim-fajar', 'tim-aisyah', 'tim-santri'].includes(m.id)
              )
            ) &&
            !(
              saved.anggotaTim.length === 9 &&
              saved.anggotaTim.every(
                (m, idx) =>
                  m.id ===
                  [
                    'tim-fajar',
                    'tim-aisyah',
                    'tim-ridwan',
                    'tim-hendri',
                    'tim-wahyu',
                    'tim-dedi',
                    'tim-ilham',
                    'tim-rizky',
                    'tim-bagus',
                  ][idx]
              )
            )
              ? saved.anggotaTim
              : fallback.tentang.anggotaTim,
          sorotanWorkshop:
            Array.isArray(saved.sorotanWorkshop) &&
            !saved.sorotanWorkshop.some((s) => s.id === 'hl-garansi') &&
            !(
              saved.sorotanWorkshop.length === 4 &&
              (saved.sorotanWorkshop.some((s) => s.id === 'hl-material' || s.id === 'hl-workshop') ||
                saved.sorotanWorkshop.some((s) => s.id === 'hl-team' && s.nilai === '6 Orang'))
            )
              ? saved.sorotanWorkshop
              : fallback.tentang.sorotanWorkshop,
        };
      })(),
      portfolioProjects: sanitizePortfolioProjects(
        parsed.portfolioProjects,
        fallback.portfolioProjects
      ),
      newsArticles: sanitizeNewsArticles(parsed.newsArticles, fallback.newsArticles),
      materials: sanitizeMaterials(parsed.materials, fallback.materials),
      faqs: Array.isArray(parsed.faqs)
        ? (parsed.faqs as FaqItem[]).map((faq) => {
            if (
              faq.id === 'faq-jam-layanan' &&
              typeof faq.jawaban === 'string' &&
              faq.jawaban.includes('Senin – Sabtu pukul 08.00 – 17.00 WIB')
            ) {
              const latest = fallback.faqs.find((f) => f.id === 'faq-jam-layanan');
              return latest ?? faq;
            }
            return faq;
          })
        : fallback.faqs,
      operationalInfo: isRecord(parsed.operationalInfo)
        ? (() => {
            const merged = {
              ...fallback.operationalInfo,
              ...(parsed.operationalInfo as unknown as OperationalInfo),
            };
            if (merged.jamOperasional === 'Senin – Sabtu, 08.00 – 17.00 WIB') {
              merged.jamOperasional = fallback.operationalInfo.jamOperasional;
            }
            if (
              merged.catatanJadwalSurvei ===
              'Survei lapangan tersedia Senin – Sabtu sesuai janji temu.'
            ) {
              merged.catatanJadwalSurvei = fallback.operationalInfo.catatanJadwalSurvei;
            }
            return merged;
          })()
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
      paymentScheme: sanitizePaymentScheme(
        parsed.paymentScheme,
        fallback.paymentScheme ?? DEFAULT_PAYMENT_SCHEME
      ),
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
  updatePaymentScheme: (next: PaymentSchemeConfig) => void;
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
    operationalInfo: state.operationalInfo,
    catalogOverride: state.catalogOverride,
    seoSettings: state.seoSettings,
    socialPlans: state.socialPlans,
    customPricing: state.customPricing,
    paymentScheme: state.paymentScheme,
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
const initialBaseCatalog = getDefaultProductCatalog();

export const useSiteContentStore = create<SiteContentStoreState>((set, get) => ({
  ...initialBundle,
  loadedBaseCatalog: initialBaseCatalog,
  catalogLoadStatus: 'ready',
  catalogError: null,

  ensureBaseCatalogLoaded: async (force = false) => {
    const state = get();
    if (!force && state.loadedBaseCatalog !== null) {
      return;
    }

    const catalog = getDefaultProductCatalog();
    set({
      loadedBaseCatalog: catalog,
      catalogLoadStatus: 'ready',
      catalogError: null,
    });
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
      daftarProduk: nextProducts,
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
        materials: sanitizeMaterials(parsed.materials, fallback.materials),
        faqs: Array.isArray(parsed.faqs) ? (parsed.faqs as FaqItem[]) : fallback.faqs,
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
        paymentScheme: sanitizePaymentScheme(
          parsed.paymentScheme,
          fallback.paymentScheme ?? DEFAULT_PAYMENT_SCHEME
        ),
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
    const activeCatalog = get().getActiveCatalog() ?? getDefaultProductCatalog();
    const updatedProducts = activeCatalog.daftarProduk.map((product) => {
      const catId = resolveProductPricingCategory(
        `${product.id} ${getProductSlug(product)} ${product.nama}`
      );
      const catRule = next.rules.tarifPerKategori?.[catId];
      if (!catRule) return product;
      return {
        ...product,
        harga: {
          hpl: { ...catRule.hplPerSatuan },
          duco: { ...catRule.ducoPerSatuan },
        },
      };
    });

    const nextCatalog: ProductCatalogDocument = {
      ...activeCatalog,
      diperbaruiPada: new Date().toISOString().slice(0, 10),
      daftarProduk: updatedProducts,
    };

    commitBundleUpdate(set, get, {
      customPricing: next,
      catalogOverride: nextCatalog,
    });
  },

  updatePaymentScheme: (next) => {
    const sanitized = sanitizePaymentScheme(next, DEFAULT_PAYMENT_SCHEME);
    const currentCustomPricing = get().customPricing;
    const currentOperationalInfo = get().operationalInfo;
    const syncedDp = resolvePaymentSchemeDpPercentage(
      sanitized,
      currentCustomPricing?.persentaseDp ?? 30
    );
    const syncedSummary = formatPaymentSchemeSummary(sanitized);
    commitBundleUpdate(set, get, {
      paymentScheme: sanitized,
      ...(syncedSummary
        ? {
            operationalInfo: {
              ...currentOperationalInfo,
              ringkasanTerminPembayaran: syncedSummary,
            },
          }
        : {}),
      ...(currentCustomPricing
        ? {
            customPricing: {
              ...currentCustomPricing,
              persentaseDp: syncedDp,
            },
          }
        : {}),
    });
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
