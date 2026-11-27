import defaultProductCatalogJson from '../data/produk.json';
import type {
  ProductCatalogDocument,
  ProductCatalogLoadResult,
  ProductColorOption,
  ProductItem,
  ProductMediaInput,
  ProductMediaKind,
  ProductMediaObject,
  ProductPriceMatrix,
} from '../types/product';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asPositiveNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * Mengubah nama produk menjadi slug URL:
 * menghapus simbol, merapikan spasi tepi (trim), lalu mengganti spasi menjadi tanda hubung (-).
 */
export function slugifyProduct(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getProductSlug(product: { nama: string; id?: string; slug?: string }): string {
  const derived = slugifyProduct(product.nama);
  if (derived) return derived;
  const fallbackSlug = typeof product.slug === 'string' ? slugifyProduct(product.slug) : '';
  if (fallbackSlug) return fallbackSlug;
  return product.id ? slugifyProduct(product.id) || 'produk' : 'produk';
}

export function normalizePromoField(raw: unknown): string | number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : undefined;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

export function isVideoMediaUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  const withoutHashOrQuery = trimmed.split(/[?#]/)[0] ?? '';
  if (/\.(mp4|webm|ogg|mov|m4v)$/i.test(withoutHashOrQuery)) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'youtu.be' ||
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'vimeo.com' ||
      host === 'www.vimeo.com' ||
      host === 'player.vimeo.com'
    );
  } catch {
    return false;
  }
}

export function resolveProductMediaEntry(item: ProductMediaInput): {
  type: 'image' | 'video';
  url: string;
  judul?: string;
  poster?: string;
  durasi?: string;
} | null {
  if (typeof item === 'string') {
    const url = item.trim();
    if (!url) return null;
    return {
      type: isVideoMediaUrl(url) ? 'video' : 'image',
      url,
    };
  }

  if (!item || typeof item !== 'object') return null;
  const url = asNonEmptyString(item.url);
  if (!url) return null;

  const type: 'image' | 'video' =
    item.tipe === 'video' ? 'video' : item.tipe === 'gambar' ? 'image' : isVideoMediaUrl(url) ? 'video' : 'image';

  const judul = asNonEmptyString(item.judul) ?? undefined;
  const poster = asNonEmptyString(item.poster) ?? undefined;
  const durasi = asNonEmptyString(item.durasi) ?? undefined;

  return {
    type,
    url,
    ...(judul ? { judul } : {}),
    ...(poster ? { poster } : {}),
    ...(durasi ? { durasi } : {}),
  };
}

function normalizeMediaObjectEntry(raw: unknown): ProductMediaInput | null {
  if (typeof raw === 'string') {
    return asNonEmptyString(raw);
  }
  if (!isRecord(raw)) return null;

  const url = asNonEmptyString(raw.url ?? raw.src);
  if (!url) return null;

  const rawType = asNonEmptyString(raw.tipe ?? raw.type)?.toLowerCase();
  const tipe: ProductMediaKind | undefined =
    rawType === 'video'
      ? 'video'
      : rawType === 'gambar' || rawType === 'image'
        ? 'gambar'
        : undefined;
  const judul = asNonEmptyString(raw.judul ?? raw.title) ?? undefined;
  const poster = asNonEmptyString(raw.poster) ?? undefined;
  const durasi = asNonEmptyString(raw.durasi ?? raw.duration) ?? undefined;

  if (!tipe && !judul && !poster && !durasi) {
    return url;
  }

  const obj: ProductMediaObject = {
    url,
    ...(tipe ? { tipe } : {}),
    ...(judul ? { judul } : {}),
    ...(poster ? { poster } : {}),
    ...(durasi ? { durasi } : {}),
  };
  return obj;
}

export function normalizeProductMediaList(
  rawMedia: unknown,
  legacyImages?: unknown,
  legacyVideos?: unknown
): ProductMediaInput[] {
  if (Array.isArray(rawMedia)) {
    return rawMedia
      .map(normalizeMediaObjectEntry)
      .filter((entry): entry is ProductMediaInput => entry !== null);
  }

  const migrated: ProductMediaInput[] = [];
  if (Array.isArray(legacyImages)) {
    for (const img of legacyImages) {
      const cleaned = asNonEmptyString(img);
      if (cleaned) migrated.push(cleaned);
    }
  }
  if (Array.isArray(legacyVideos)) {
    for (const vid of legacyVideos) {
      const normalized = normalizeMediaObjectEntry(vid);
      if (normalized) {
        if (typeof normalized === 'string') {
          migrated.push(isVideoMediaUrl(normalized) ? normalized : { url: normalized, tipe: 'video' });
        } else {
          migrated.push({ ...normalized, tipe: normalized.tipe ?? 'video' });
        }
      }
    }
  }
  return migrated;
}

export function getProductCoverImage(
  product: Pick<ProductItem, 'gambarSampul' | 'media'>
): string | null {
  const explicitCover = asNonEmptyString(product.gambarSampul);
  if (explicitCover) return explicitCover;

  for (const item of product.media) {
    const resolved = resolveProductMediaEntry(item);
    if (resolved?.type === 'image') {
      return resolved.url;
    }
  }
  return null;
}

export function getProductImageUrls(
  product: Pick<ProductItem, 'gambarSampul' | 'media'>
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const addUrl = (raw?: string | null) => {
    const cleaned = asNonEmptyString(raw);
    if (!cleaned || seen.has(cleaned)) return;
    seen.add(cleaned);
    urls.push(cleaned);
  };

  addUrl(product.gambarSampul);
  for (const item of product.media) {
    const resolved = resolveProductMediaEntry(item);
    if (resolved?.type === 'image') {
      addUrl(resolved.url);
    }
  }
  return urls;
}

export function serializeProductForJson(product: ProductItem): Record<string, unknown> {
  return {
    id: product.id,
    nama: product.nama,
    kategori: product.kategori,
    deskripsiSingkat: product.deskripsiSingkat,
    gambarSampul: product.gambarSampul ?? '',
    '3d': product['3d'] ?? '',
    media: product.media,
    ...(product.pilihanWarna && product.pilihanWarna.length > 0
      ? { pilihanWarna: product.pilihanWarna }
      : {}),
    referensiUkuran: product.referensiUkuran,
    meterLari: product.meterLari === true,
    promo: product.promo ?? '',
    customisasi: product.customisasi,
    include: product.include,
    ...(product.harga ? { harga: product.harga } : {}),
  };
}

function deduplicateStrings(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function parseReferenceSizeCm(raw: unknown): {
  lengthCm: number;
  widthCm: number;
  normalized: string;
} | null {
  if (typeof raw !== 'string') return null;
  const match = raw
    .trim()
    .match(/^(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?$/i);
  if (!match) return null;
  const len = Number(match[1].replace(',', '.'));
  const wid = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(len) || !Number.isFinite(wid) || len <= 0 || wid <= 0) {
    return null;
  }
  const lengthCm = Math.max(1, Math.round(len));
  const widthCm = Math.max(1, Math.round(wid));
  return {
    lengthCm,
    widthCm,
    normalized: `${lengthCm}x${widthCm}`,
  };
}

export function normalizeReferenceSizes(raw: unknown, legacyDimensi?: unknown): string[] {
  if (Array.isArray(raw)) {
    const normalized = raw
      .map((entry) => parseReferenceSizeCm(entry)?.normalized ?? null)
      .filter((entry): entry is string => entry !== null);
    const unique = deduplicateStrings(normalized).slice(0, 3);
    if (unique.length > 0) return unique;
  }

  const singleParsed = parseReferenceSizeCm(raw);
  if (singleParsed) {
    return [singleParsed.normalized];
  }

  if (isRecord(legacyDimensi)) {
    const lebar = asPositiveNumberOrNull(legacyDimensi.lebarCm);
    const kedalaman = asPositiveNumberOrNull(legacyDimensi.kedalamanCm);
    const tinggi = asPositiveNumberOrNull(legacyDimensi.tinggiCm);
    const pasangan = tinggi ?? kedalaman;
    if (lebar !== null && pasangan !== null) {
      return [`${Math.round(lebar)}x${Math.round(pasangan)}`];
    }
    if (lebar !== null) {
      return [`${Math.round(lebar)}x220`];
    }
  }

  return ['200x220'];
}

function parseColors(raw: unknown): ProductColorOption[] {
  if (!Array.isArray(raw)) return [];
  const colors: ProductColorOption[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = asNonEmptyString(item.id);
    const nama = asNonEmptyString(item.nama);
    const hex = asNonEmptyString(item.hex);
    if (id && nama && hex && /^#[0-9A-Fa-f]{3,8}$/.test(hex)) {
      colors.push({ id, nama, hex });
    }
  }
  return colors;
}

export function normalizeCustomisasiList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const collected: string[] = [];

  for (const entry of raw) {
    if (typeof entry === 'string') {
      const cleaned = asNonEmptyString(entry);
      if (cleaned) collected.push(cleaned);
      continue;
    }

    if (isRecord(entry)) {
      const id = String(entry.id ?? '').toLowerCase();
      const label = String(entry.label ?? '').toLowerCase();
      const isMat = /\bbahan\b|\bmaterial\b/.test(id) || /\bbahan\b|\bmaterial\b/.test(label);
      const isFin = /\bfinishing\b|\blaminasi\b/.test(id) || /\bfinishing\b|\blaminasi\b/.test(label);
      if (isMat || isFin) continue;
      if (Array.isArray(entry.daftarNilai)) {
        for (const val of entry.daftarNilai) {
          const cleanedVal = asNonEmptyString(val);
          if (cleanedVal) collected.push(cleanedVal);
        }
      }
    }
  }

  return deduplicateStrings(collected);
}

export function normalizeIncludeList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const collected: string[] = [];

  for (const entry of raw) {
    if (typeof entry === 'string') {
      const cleaned = asNonEmptyString(entry);
      if (cleaned) collected.push(cleaned);
      continue;
    }

    if (isRecord(entry)) {
      const label = asNonEmptyString(entry.label);
      if (label) collected.push(label);
    }
  }

  return deduplicateStrings(collected);
}

function parseCustomRateRecord(raw: unknown): Record<string, number | null> | undefined {
  if (!isRecord(raw)) return undefined;
  const result: Record<string, number | null> = {};
  let hasEntry = false;
  for (const [key, val] of Object.entries(raw)) {
    const cleanedKey = key.trim();
    if (!cleanedKey) continue;
    const num = asPositiveNumberOrNull(val);
    if (num !== null) {
      result[cleanedKey] = num;
      hasEntry = true;
    }
  }
  return hasEntry ? result : undefined;
}

function parseProductPriceMatrix(
  rawHarga: unknown,
  legacyTarifSatuan?: unknown
): ProductPriceMatrix | undefined {
  if (isRecord(rawHarga)) {
    const hpl = parseCustomRateRecord(rawHarga.hpl);
    const duco = parseCustomRateRecord(rawHarga.duco);
    if (hpl || duco) {
      return {
        hpl: hpl ?? {},
        duco: duco ?? {},
      };
    }
  }

  if (isRecord(legacyTarifSatuan)) {
    const hpl = parseCustomRateRecord(legacyTarifSatuan.tacoSheet ?? legacyTarifSatuan.hpl);
    const catDucoScalar = asPositiveNumberOrNull(legacyTarifSatuan.catDuco);
    const duco =
      catDucoScalar !== null
        ? {
            blockboard: catDucoScalar,
            multipleks: catDucoScalar,
            pvc: catDucoScalar,
          }
        : undefined;
    if (hpl || duco) {
      return {
        hpl: hpl ?? {},
        duco: duco ?? {},
      };
    }
  }

  return undefined;
}

function parseProductItem(raw: unknown): ProductItem | null {
  if (!isRecord(raw)) return null;

  const id = asNonEmptyString(raw.id);
  const nama = asNonEmptyString(raw.nama);
  const kategori = asNonEmptyString(raw.kategori);
  const deskripsiSingkat = asNonEmptyString(raw.deskripsiSingkat);

  if (!id || !nama || !kategori || !deskripsiSingkat) {
    return null;
  }

  const slug = slugifyProduct(nama) || slugifyProduct(id) || 'produk';

  const gambarSampul = asNonEmptyString(raw.gambarSampul) ?? undefined;
  const model3d =
    asNonEmptyString(raw['3d'] ?? raw['gambar-3d'] ?? raw.gambar3d ?? raw.model3d) ?? undefined;
  const media = normalizeProductMediaList(raw.media, raw.daftarGambar, raw.daftarVideo);
  const harga = parseProductPriceMatrix(raw.harga, raw.tarifSatuan);
  const parsedColors = parseColors(raw.pilihanWarna);
  const promo = normalizePromoField(raw.promo);
  const customisasi = normalizeCustomisasiList(raw.customisasi ?? raw.opsiKustom);
  const include = normalizeIncludeList(raw.include ?? raw.opsiTambahan);
  const meterLari =
    typeof raw.meterLari === 'boolean' ? raw.meterLari : undefined;

  return {
    id,
    slug,
    nama,
    kategori,
    deskripsiSingkat,
    ...(gambarSampul ? { gambarSampul } : {}),
    ...(model3d ? { '3d': model3d } : {}),
    media,
    ...(parsedColors.length > 0 ? { pilihanWarna: parsedColors } : {}),
    referensiUkuran: normalizeReferenceSizes(raw.referensiUkuran, raw.dimensi),
    ...(meterLari !== undefined ? { meterLari } : {}),
    ...(harga ? { harga } : {}),
    ...(promo !== undefined ? { promo } : {}),
    customisasi,
    include,
  };
}

const DEFAULT_CATALOG_NOTE =
  'Seluruh unit produk menggunakan skema Design & Build (pemesanan pembuatan otomatis Gratis Desain 3D) dengan material utama ketebalan standar 18 mm (Blockboard, Multipleks, PVC Board) dan finishing HPL atau Cat Duco.';

export function parseProductCatalog(rawData: unknown): ProductCatalogLoadResult {
  if (Array.isArray(rawData)) {
    const parsedProducts = rawData
      .map((item) => parseProductItem(item))
      .filter((item): item is ProductItem => item !== null);

    if (rawData.length > 0 && parsedProducts.length === 0) {
      return {
        status: 'error',
        message: 'Seluruh entri produk dalam katalog gagal divalidasi.',
      };
    }

    return {
      status: 'success',
      catalog: {
        versiSkema: 6,
        katalogContoh: false,
        catatan: DEFAULT_CATALOG_NOTE,
        diperbaruiPada: '2026-11-22',
        daftarProduk: parsedProducts,
      },
    };
  }

  if (!isRecord(rawData)) {
    return {
      status: 'error',
      message: 'Format data katalog produk tidak valid (array atau objek JSON diharapkan).',
    };
  }

  if (!Array.isArray(rawData.daftarProduk)) {
    return {
      status: 'error',
      message: 'Daftar produk tidak ditemukan pada berkas katalog.',
    };
  }

  const parsedProducts = rawData.daftarProduk
    .map((item) => parseProductItem(item))
    .filter((item): item is ProductItem => item !== null);

  if (rawData.daftarProduk.length > 0 && parsedProducts.length === 0) {
    return {
      status: 'error',
      message: 'Seluruh entri produk dalam katalog gagal divalidasi.',
    };
  }

  const versiSkema =
    typeof rawData.versiSkema === 'number' && Number.isFinite(rawData.versiSkema)
      ? rawData.versiSkema
      : 6;

  const catatan = asNonEmptyString(rawData.catatan) ?? DEFAULT_CATALOG_NOTE;
  const diperbaruiPada = asNonEmptyString(rawData.diperbaruiPada) ?? '';

  const catalog: ProductCatalogDocument = {
    versiSkema,
    katalogContoh: rawData.katalogContoh !== false,
    catatan,
    diperbaruiPada,
    daftarProduk: parsedProducts,
  };

  return { status: 'success', catalog };
}

let cachedDefaultCatalog: ProductCatalogDocument | null = null;

export function getDefaultProductCatalog(): ProductCatalogDocument {
  if (cachedDefaultCatalog) return cachedDefaultCatalog;
  const parsed = parseProductCatalog(defaultProductCatalogJson);
  if (parsed.status === 'success') {
    cachedDefaultCatalog = parsed.catalog;
    return parsed.catalog;
  }
  return {
    versiSkema: 6,
    katalogContoh: false,
    catatan: DEFAULT_CATALOG_NOTE,
    diperbaruiPada: '',
    daftarProduk: [],
  };
}

export async function fetchProductCatalog(): Promise<ProductCatalogLoadResult> {
  const catalog = getDefaultProductCatalog();
  return { status: 'success', catalog };
}
