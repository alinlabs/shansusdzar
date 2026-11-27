import { create } from 'zustand';
import { createDefaultSiteContentBundle } from '../lib/cms-defaults';
import {
  DEFAULT_PAYMENT_SCHEME,
  resolvePaymentSchemeDpPercentage,
  sanitizePaymentScheme,
} from '../lib/payment-scheme';
import {
  generateNextNewsId,
  slugifyNewsTitle,
} from '../lib/informasi-filter';
import {
  extractNewsPlainTextList,
  normalizeNewsContentBlocks,
} from '../lib/news-content';
import {
  extractPortfolioClientSalutation,
  normalizePortfolioDimensions,
  normalizePortfolioSalutation,
  syncPortfolioProjectsWithProducts,
} from '../lib/portfolio-filter';
import {
  getDefaultProductCatalog,
  normalizeCustomisasiList,
  normalizeIncludeList,
  normalizeProductMediaList,
  normalizePromoField,
  normalizeReferenceSizes,
  slugifyProduct,
} from '../lib/product-catalog';
import {
  readLocalCacheItem,
  registerStoreReloadHandler,
  subscribeLocalCacheChange,
  writeLocalCacheItem,
} from '../lib/indexeddb-storage';
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
  const fallbackByJudul = new Map(fallback.map((item) => [item.judul.trim().toLowerCase(), item]));
  const result: NewsArticleItem[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const entry = raw[i];
    if (!isRecord(entry)) continue;
    if (entry.terbit === false) continue;

    const judul = typeof entry.judul === 'string' ? entry.judul.trim() : '';
    if (!judul || !slugifyNewsTitle(judul)) continue;

    const ringkasan = typeof entry.ringkasan === 'string' ? entry.ringkasan.trim() : '';
    const normalizedIsi = normalizeNewsContentBlocks(entry.isi, entry.paragrafKonten);
    const isi =
      normalizedIsi.length > 0
        ? normalizedIsi
        : [
            {
              jenis: 'teks' as const,
              isi: ringkasan || judul,
              format: { gaya: 'paragraf' as const, rata: 'justify' as const },
            },
          ];
    const firstPlainText = extractNewsPlainTextList(isi)[0] ?? '';

    const kataKunciSeo = Array.isArray(entry.kataKunciSeo)
      ? entry.kataKunciSeo.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
      : [];

    const rawId = typeof entry.id === 'string' ? entry.id.trim() : '';
    const matchedFallback = fallbackByJudul.get(judul.toLowerCase());
    const resolvedId = /^news-\d{3}$/i.test(rawId)
      ? rawId.toLowerCase()
      : matchedFallback?.id ?? generateNextNewsId(result);

    result.push({
      id: resolvedId,
      judul,
      kategori:
        typeof entry.kategori === 'string' && entry.kategori.trim()
          ? entry.kategori.trim()
          : 'Kabar Workshop',
      ringkasan: ringkasan || firstPlainText || judul,
      isi,
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
    });
  }
  return result;
}

function sanitizePortfolioReview(
  rawReview: unknown,
  fallbackReview?: PortfolioReviewData | null,
  legacyNamaKlien?: string
): PortfolioReviewData | null {
  if (rawReview === null) return null;
  if (rawReview === undefined) {
    return fallbackReview ? { ...fallbackReview } : null;
  }
  if (!isRecord(rawReview)) {
    return fallbackReview ? { ...fallbackReview } : null;
  }
  if (rawReview.tampil === false) return null;
  const rawKlien =
    typeof rawReview.klien === 'string'
      ? rawReview.klien.trim()
      : typeof rawReview.namaPengulas === 'string'
        ? rawReview.namaPengulas.trim()
        : '';
  let sapaan =
    typeof rawReview.sapaan === 'string'
      ? normalizePortfolioSalutation(rawReview.sapaan)
      : '';
  let klien = rawKlien;
  if (rawReview.sapaan === undefined) {
    const fromLegacyClient = legacyNamaKlien
      ? extractPortfolioClientSalutation(legacyNamaKlien)
      : { sapaan: '', klien: '' };
    if (fromLegacyClient.sapaan) {
      sapaan = fromLegacyClient.sapaan;
    } else if (fallbackReview?.sapaan) {
      sapaan = normalizePortfolioSalutation(fallbackReview.sapaan);
    }
    if (!klien && fromLegacyClient.klien) {
      klien = fromLegacyClient.klien;
    }
  }
  const komentar = typeof rawReview.komentar === 'string' ? rawReview.komentar.trim() : '';
  const penilaian =
    typeof rawReview.penilaian === 'number' && Number.isFinite(rawReview.penilaian)
      ? Math.max(1, Math.min(5, Math.round(rawReview.penilaian)))
      : 5;

  if (!klien || !komentar) return null;
  return {
    sapaan,
    klien,
    penilaian,
    komentar,
  };
}

function sanitizeStringArray(raw: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(raw)) return [...fallback];
  return raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizePortfolioProjects(
  raw: unknown,
  fallback: PortfolioCaseStudy[],
  catalogProducts?: readonly ProductItem[]
): PortfolioCaseStudy[] {
  if (!Array.isArray(raw)) return fallback;
  const fallbackById = new Map(fallback.map((item) => [item.id, item]));
  const fallbackByProductId = new Map(
    fallback
      .filter((item) => Boolean(item.produkId))
      .map((item) => [item.produkId!, item])
  );
  const result: PortfolioCaseStudy[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    if (entry.terbit === false) continue;
    const rawId = typeof entry.id === 'string' ? entry.id.trim() : '';
    const rawJudul = typeof entry.judul === 'string' ? entry.judul.trim() : '';
    if (!rawId || !rawJudul) continue;
    const rawProdukId = typeof entry.produkId === 'string' ? entry.produkId.trim() : '';
    const fallbackProject =
      fallbackById.get(rawId) ?? (rawProdukId ? fallbackByProductId.get(rawProdukId) : undefined);
    const resolvedId = /^port-\d{3}$/i.test(rawId)
      ? rawId
      : fallbackProject?.id ?? rawId;
    const rawHarga =
      typeof entry.referensiHarga === 'number' &&
      Number.isFinite(entry.referensiHarga) &&
      entry.referensiHarga > 0
        ? Math.round(entry.referensiHarga)
        : fallbackProject?.referensiHarga ?? null;
    const dimensi = normalizePortfolioDimensions(
      entry.dimensi,
      entry.ringkasanDimensi
    );
    const resolvedDimensi =
      dimensi.length > 0 ? dimensi : fallbackProject?.dimensi ?? [{ panjang: 200, lebar: 60, tinggi: 220 }];
    const gambarUtama =
      typeof entry.gambarUtama === 'string' && entry.gambarUtama.trim()
        ? entry.gambarUtama.trim()
        : fallbackProject?.gambarUtama ?? '/images/atelier-studio-craft.webp';
    const galeriGambar = sanitizeStringArray(
      entry.galeriGambar,
      fallbackProject?.galeriGambar ?? [gambarUtama]
    );
    const materialDigunakan = sanitizeStringArray(
      entry.materialDigunakan,
      fallbackProject?.materialDigunakan ?? []
    );

    result.push({
      id: resolvedId,
      ...(rawProdukId || fallbackProject?.produkId
        ? { produkId: rawProdukId || fallbackProject?.produkId }
        : {}),
      judul: rawJudul,
      kategori:
        typeof entry.kategori === 'string' && entry.kategori.trim()
          ? entry.kategori.trim()
          : fallbackProject?.kategori ?? 'Custom Interior',
      cakupan:
        typeof entry.cakupan === 'string' && entry.cakupan.trim()
          ? entry.cakupan.trim()
          : fallbackProject?.cakupan ?? 'Custom Interior',
      lokasi:
        typeof entry.lokasi === 'string'
          ? entry.lokasi.trim()
          : fallbackProject?.lokasi ?? '',
      tahun:
        typeof entry.tahun === 'string'
          ? entry.tahun.trim()
          : fallbackProject?.tahun ?? '2026',
      durasi:
        typeof entry.durasi === 'string'
          ? entry.durasi.trim()
          : fallbackProject?.durasi ?? '14 Hari Kerja',
      dimensi: resolvedDimensi,
      referensiHarga: rawHarga,
      catatanMaterial:
        typeof entry.catatanMaterial === 'string'
          ? entry.catatanMaterial.trim()
          : fallbackProject?.catatanMaterial ?? '',
      catatanFinishing:
        typeof entry.catatanFinishing === 'string'
          ? entry.catatanFinishing.trim()
          : fallbackProject?.catatanFinishing ?? '',
      materialDigunakan,
      deskripsi:
        typeof entry.deskripsi === 'string'
          ? entry.deskripsi.trim()
          : fallbackProject?.deskripsi ?? '',
      tantangan:
        typeof entry.tantangan === 'string'
          ? entry.tantangan.trim()
          : fallbackProject?.tantangan ?? '',
      solusi:
        typeof entry.solusi === 'string'
          ? entry.solusi.trim()
          : fallbackProject?.solusi ?? '',
      gambarUtama,
      galeriGambar: galeriGambar.length > 0 ? galeriGambar : [gambarUtama],
      teksAlt:
        typeof entry.teksAlt === 'string' && entry.teksAlt.trim()
          ? entry.teksAlt.trim()
          : fallbackProject?.teksAlt ?? rawJudul,
      tampilDiBeranda:
        typeof entry.tampilDiBeranda === 'boolean'
          ? entry.tampilDiBeranda
          : fallbackProject?.tampilDiBeranda ?? false,
      ulasan: sanitizePortfolioReview(
        entry.ulasan,
        fallbackProject?.ulasan,
        typeof entry.namaKlien === 'string' ? entry.namaKlien : undefined
      ),
    });
  }
  if (result.length === 0) return [];
  return syncPortfolioProjectsWithProducts(
    result,
    catalogProducts ?? getDefaultProductCatalog().daftarProduk
  );
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
  return migrated;
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

function sanitizeBusinessConfig(raw: unknown, fallback: BusinessConfig): BusinessConfig {
  if (!isRecord(raw)) return fallback;
  const legacyShort =
    typeof raw.namaMerekSingkat === 'string' && raw.namaMerekSingkat.trim()
      ? raw.namaMerekSingkat.trim()
      : '';
  const namaMerek =
    typeof raw.namaMerek === 'string' && raw.namaMerek.trim()
      ? raw.namaMerek.trim()
      : legacyShort || fallback.namaMerek;
  const rawTyped = raw as Partial<BusinessConfig> & Record<string, unknown>;
  const { namaMerekSingkat: _legacyShort, ...restRaw } = rawTyped;
  void _legacyShort;

  const mergedConfig: BusinessConfig = {
    ...fallback,
    ...(restRaw as Partial<BusinessConfig>),
    namaMerek,
    mediaSosial: {
      ...fallback.mediaSosial!,
      ...(isRecord(raw.mediaSosial)
        ? (raw.mediaSosial as Partial<NonNullable<BusinessConfig['mediaSosial']>>)
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
    mergedConfig.whatsapp = { ...fallback.whatsapp };
  } else if (cachedWa.nomorTampil === '+6281315000234') {
    mergedConfig.whatsapp = {
      ...cachedWa,
      nomorTampil: fallback.whatsapp.nomorTampil,
    };
  }

  const cachedAddr = mergedConfig.alamat;
  if (
    !cachedAddr ||
    cachedAddr.alamatLengkap ===
      'Kp. Tegal Jati, RT 19/RW 10, Desa Cibogohilir, Kabupaten Purwakarta, 41162, Indonesia'
  ) {
    mergedConfig.alamat = { ...fallback.alamat };
  }

  if (mergedConfig.rekeningBank) {
    mergedConfig.rekeningBank = {
      ...mergedConfig.rekeningBank,
      logoUrl:
        mergedConfig.rekeningBank.logoUrl && mergedConfig.rekeningBank.logoUrl !== '/bni.png'
          ? mergedConfig.rekeningBank.logoUrl
          : fallback.rekeningBank?.logoUrl ?? '/bni.webp',
    };
  }

  const cachedBanks = Array.isArray(mergedConfig.daftarRekeningBank)
    ? mergedConfig.daftarRekeningBank
    : [];
  if (cachedBanks.length === 0) {
    mergedConfig.daftarRekeningBank = fallback.daftarRekeningBank
      ? structuredClone(fallback.daftarRekeningBank)
      : undefined;
  } else {
    const normalizedCached = cachedBanks.map((bank) => ({
      ...bank,
      logoUrl:
        bank.logoUrl === '/bni.png'
          ? '/bni.webp'
          : bank.logoUrl ||
            (bank.namaBank.toUpperCase().includes('BSI') ? '/bsi.webp' : '/bni.webp'),
    }));
    const hasBsi = normalizedCached.some(
      (b) => b.namaBank.toUpperCase().includes('BSI') || b.nomorRekening === '7370860534'
    );
    const defaultBsi = fallback.daftarRekeningBank?.find((b) =>
      b.namaBank.toUpperCase().includes('BSI')
    );
    mergedConfig.daftarRekeningBank =
      !hasBsi && normalizedCached.length === 1 && defaultBsi
        ? [...normalizedCached, { ...defaultBsi }]
        : normalizedCached;
  }

  return mergedConfig;
}

function sanitizeTentangContent(raw: unknown, fallback: TentangContent): TentangContent {
  if (!isRecord(raw)) return fallback;
  const saved = raw as Partial<TentangContent>;
  return {
    pengantar:
      typeof saved.pengantar === 'string' && saved.pengantar.trim()
        ? saved.pengantar
        : fallback.pengantar,
    gambarWorkshop:
      typeof saved.gambarWorkshop === 'string'
        ? saved.gambarWorkshop
        : fallback.gambarWorkshop,
    teksAltWorkshop:
      typeof saved.teksAltWorkshop === 'string'
        ? saved.teksAltWorkshop
        : fallback.teksAltWorkshop,
    daftarParagraf: Array.isArray(saved.daftarParagraf)
      ? saved.daftarParagraf
      : fallback.daftarParagraf,
    pernyataanVisi:
      typeof saved.pernyataanVisi === 'string' && saved.pernyataanVisi.trim()
        ? saved.pernyataanVisi
        : fallback.pernyataanVisi,
    daftarMisi: Array.isArray(saved.daftarMisi) ? saved.daftarMisi : fallback.daftarMisi,
    anggotaTim:
      Array.isArray(saved.anggotaTim) &&
      !(
        saved.anggotaTim.length > 0 &&
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
        : fallback.anggotaTim,
    sorotanWorkshop:
      Array.isArray(saved.sorotanWorkshop) &&
      !saved.sorotanWorkshop.some((s) => s.id === 'hl-garansi') &&
      !(
        saved.sorotanWorkshop.length === 4 &&
        (saved.sorotanWorkshop.some((s) => s.id === 'hl-material' || s.id === 'hl-workshop') ||
          saved.sorotanWorkshop.some((s) => s.id === 'hl-team' && s.nilai === '6 Orang'))
      )
        ? saved.sorotanWorkshop
        : fallback.sorotanWorkshop,
  };
}

function loadSiteContentBundle(): SiteContentBundle {
  const fallback = createDefaultSiteContentBundle();
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = readLocalCacheItem(SITE_CONTENT_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== 3) return fallback;

    const catalogOverride = sanitizeCatalogOverride(parsed.catalogOverride);

    return {
      schemaVersion: 3,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : fallback.updatedAt,
      businessConfig: sanitizeBusinessConfig(parsed.businessConfig, fallback.businessConfig),
      beranda: isRecord(parsed.beranda)
        ? { ...fallback.beranda, ...(parsed.beranda as unknown as BerandaContent) }
        : fallback.beranda,
      tentang: sanitizeTentangContent(parsed.tentang, fallback.tentang),
      portfolioProjects: sanitizePortfolioProjects(
        parsed.portfolioProjects,
        fallback.portfolioProjects,
        catalogOverride?.daftarProduk
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
            const rawOp = parsed.operationalInfo as Partial<OperationalInfo>;
            const jamOperasional =
              typeof rawOp.jamOperasional === 'string' &&
              rawOp.jamOperasional !== 'Senin – Sabtu, 08.00 – 17.00 WIB'
                ? rawOp.jamOperasional
                : fallback.operationalInfo.jamOperasional;
            const catatanJadwalSurvei =
              typeof rawOp.catatanJadwalSurvei === 'string' &&
              rawOp.catatanJadwalSurvei !==
                'Survei lapangan tersedia Senin – Sabtu sesuai janji temu.'
                ? rawOp.catatanJadwalSurvei
                : fallback.operationalInfo.catatanJadwalSurvei;
            return {
              jamOperasional,
              catatanJadwalSurvei,
              estimasiWaktuProduksi:
                typeof rawOp.estimasiWaktuProduksi === 'string'
                  ? rawOp.estimasiWaktuProduksi
                  : fallback.operationalInfo.estimasiWaktuProduksi,
              ringkasanGaransi:
                typeof rawOp.ringkasanGaransi === 'string'
                  ? rawOp.ringkasanGaransi
                  : fallback.operationalInfo.ringkasanGaransi,
              areaJangkauanSurvei: Array.isArray(rawOp.areaJangkauanSurvei)
                ? rawOp.areaJangkauanSurvei
                : fallback.operationalInfo.areaJangkauanSurvei,
            };
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
    writeLocalCacheItem(SITE_CONTENT_STORAGE_KEY, JSON.stringify(bundle));
  } catch {
    // Ignore storage serialization failures
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
  updatePaymentScheme: (next: PaymentSchemeConfig) => void;
  reloadFromStorage: () => void;
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
    commitBundleUpdate(set, get, { portfolioProjects: updated });
  },

  deletePortfolioProject: (id) => {
    const next = get().portfolioProjects.filter((p) => p.id !== id);
    commitBundleUpdate(set, get, { portfolioProjects: next });
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
      const catalogOverride = sanitizeCatalogOverride(parsed.catalogOverride);
      const next: SiteContentBundle = {
        schemaVersion: 3,
        updatedAt: new Date().toISOString(),
        businessConfig: sanitizeBusinessConfig(parsed.businessConfig, fallback.businessConfig),
        beranda: isRecord(parsed.beranda)
          ? { ...fallback.beranda, ...(parsed.beranda as unknown as BerandaContent) }
          : fallback.beranda,
        tentang: sanitizeTentangContent(parsed.tentang, fallback.tentang),
        portfolioProjects: sanitizePortfolioProjects(
          parsed.portfolioProjects,
          fallback.portfolioProjects,
          catalogOverride?.daftarProduk
        ),
        newsArticles: sanitizeNewsArticles(parsed.newsArticles, fallback.newsArticles),
        materials: sanitizeMaterials(parsed.materials, fallback.materials),
        faqs: Array.isArray(parsed.faqs) ? (parsed.faqs as FaqItem[]) : fallback.faqs,
        operationalInfo: isRecord(parsed.operationalInfo)
          ? (() => {
              const rawOp = parsed.operationalInfo as Partial<OperationalInfo>;
              return {
                jamOperasional:
                  typeof rawOp.jamOperasional === 'string'
                    ? rawOp.jamOperasional
                    : fallback.operationalInfo.jamOperasional,
                catatanJadwalSurvei:
                  typeof rawOp.catatanJadwalSurvei === 'string'
                    ? rawOp.catatanJadwalSurvei
                    : fallback.operationalInfo.catatanJadwalSurvei,
                estimasiWaktuProduksi:
                  typeof rawOp.estimasiWaktuProduksi === 'string'
                    ? rawOp.estimasiWaktuProduksi
                    : fallback.operationalInfo.estimasiWaktuProduksi,
                ringkasanGaransi:
                  typeof rawOp.ringkasanGaransi === 'string'
                    ? rawOp.ringkasanGaransi
                    : fallback.operationalInfo.ringkasanGaransi,
                areaJangkauanSurvei: Array.isArray(rawOp.areaJangkauanSurvei)
                  ? rawOp.areaJangkauanSurvei
                  : fallback.operationalInfo.areaJangkauanSurvei,
              };
            })()
          : fallback.operationalInfo,
        catalogOverride,
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

  updatePaymentScheme: (next) => {
    const sanitized = sanitizePaymentScheme(next, DEFAULT_PAYMENT_SCHEME);
    const currentCustomPricing = get().customPricing;
    const syncedDp = resolvePaymentSchemeDpPercentage(
      sanitized,
      currentCustomPricing?.persentaseDp ?? 30
    );
    commitBundleUpdate(set, get, {
      paymentScheme: sanitized,
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

  reloadFromStorage: () => {
    const reloaded = loadSiteContentBundle();
    const catalog = getDefaultProductCatalog();
    set({
      ...reloaded,
      loadedBaseCatalog: catalog,
      catalogLoadStatus: 'ready',
      catalogError: null,
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

registerStoreReloadHandler(() => {
  useSiteContentStore.getState().reloadFromStorage();
});

if (typeof window !== 'undefined') {
  subscribeLocalCacheChange(SITE_CONTENT_STORAGE_KEY, () => {
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
