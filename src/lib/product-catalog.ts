import type {
  AvailabilityStatus,
  PriceStatus,
  ProductCatalogDocument,
  ProductCatalogLoadResult,
  ProductColorOption,
  ProductCustomOption,
  ProductCustomRateOverrides,
  ProductDimensions,
  ProductItem,
  ProductVideoItem,
} from '../types/product';

const VALID_PRICE_STATUSES: ReadonlySet<PriceStatus> = new Set(['tetap', 'mulai', 'konsultasi']);
const VALID_AVAILABILITY_STATUSES: ReadonlySet<AvailabilityStatus> = new Set([
  'tersedia',
  'pre-order',
  'terbatas',
  'konsultasi',
]);

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

function parseDimensions(raw: unknown): ProductDimensions {
  if (!isRecord(raw)) {
    return { lebarCm: null, kedalamanCm: null, tinggiCm: null };
  }
  const catatan = asNonEmptyString(raw.catatan);
  const referensiUkuran = Array.isArray(raw.referensiUkuran)
    ? raw.referensiUkuran.map(asNonEmptyString).filter((v): v is string => v !== null)
    : [];
  return {
    lebarCm: asPositiveNumberOrNull(raw.lebarCm),
    kedalamanCm: asPositiveNumberOrNull(raw.kedalamanCm),
    tinggiCm: asPositiveNumberOrNull(raw.tinggiCm),
    ...(referensiUkuran.length > 0 ? { referensiUkuran } : {}),
    ...(catatan ? { catatan } : {}),
  };
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

export function normalizeCatalogOptionGroups(
  options: readonly ProductCustomOption[]
): ProductCustomOption[] {
  if (!Array.isArray(options)) return [];
  const materialIdx = options.findIndex(
    (opt) => /\bbahan\b|\bmaterial\b/i.test(opt.id) || /\bbahan\b|\bmaterial\b/i.test(opt.label)
  );
  return options.map((opt, idx) => {
    const isAboveMaterial =
      (materialIdx > 0 && idx < materialIdx) ||
      (materialIdx === -1 &&
        idx === 0 &&
        !/\bfinishing\b|\blaminasi\b/i.test(opt.id) &&
        !/\bfinishing\b|\blaminasi\b/i.test(opt.label));
    if (isAboveMaterial) {
      return {
        ...opt,
        id: 'customisasi',
        label: 'Customisasi',
      };
    }
    return opt;
  });
}

function parseCustomOptions(raw: unknown): ProductCustomOption[] {
  if (!Array.isArray(raw)) return [];
  const options: ProductCustomOption[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = asNonEmptyString(item.id);
    const label = asNonEmptyString(item.label);
    const daftarNilai = Array.isArray(item.daftarNilai)
      ? item.daftarNilai.map(asNonEmptyString).filter((v): v is string => v !== null)
      : [];
    if (id && label && daftarNilai.length > 0) {
      options.push({ id, label, daftarNilai });
    }
  }
  return normalizeCatalogOptionGroups(options);
}

function parseVideos(raw: unknown): ProductVideoItem[] {
  if (!Array.isArray(raw)) return [];
  const videos: ProductVideoItem[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const url = asNonEmptyString(item);
      if (url) videos.push({ url });
      continue;
    }
    if (!isRecord(item)) continue;
    const url = asNonEmptyString(item.url);
    if (!url) continue;
    const judul = asNonEmptyString(item.judul);
    const poster = asNonEmptyString(item.poster);
    const durasi = asNonEmptyString(item.durasi);
    videos.push({
      url,
      ...(judul ? { judul } : {}),
      ...(poster ? { poster } : {}),
      ...(durasi ? { durasi } : {}),
    });
  }
  return videos;
}

function resolvePriceFields(raw: Record<string, unknown>): {
  harga: number | null;
  hargaMulai: number | null;
  statusHarga: PriceStatus;
} {
  const harga = asPositiveNumberOrNull(raw.harga);
  const hargaMulai = asPositiveNumberOrNull(raw.hargaMulai);
  const rawStatus = typeof raw.statusHarga === 'string' ? raw.statusHarga : '';

  if (VALID_PRICE_STATUSES.has(rawStatus as PriceStatus)) {
    const status = rawStatus as PriceStatus;
    if (status === 'tetap' && harga !== null) {
      return { harga, hargaMulai: null, statusHarga: 'tetap' };
    }
    if (status === 'mulai' && hargaMulai !== null) {
      return { harga: null, hargaMulai, statusHarga: 'mulai' };
    }
    return { harga: null, hargaMulai: null, statusHarga: 'konsultasi' };
  }

  if (harga !== null) return { harga, hargaMulai: null, statusHarga: 'tetap' };
  if (hargaMulai !== null) return { harga: null, hargaMulai, statusHarga: 'mulai' };
  return { harga: null, hargaMulai: null, statusHarga: 'konsultasi' };
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

function parseCustomRateOverrides(raw: unknown): ProductCustomRateOverrides | undefined {
  if (!isRecord(raw)) return undefined;
  const desainPerM2 = asPositiveNumberOrNull(raw.desainPerM2);
  const bahanPerM2 = parseCustomRateRecord(raw.bahanPerM2);
  const finishingPerM2 = parseCustomRateRecord(raw.finishingPerM2);
  if (desainPerM2 === null && !bahanPerM2 && !finishingPerM2) {
    return undefined;
  }
  return {
    ...(desainPerM2 !== null ? { desainPerM2 } : {}),
    ...(bahanPerM2 ? { bahanPerM2 } : {}),
    ...(finishingPerM2 ? { finishingPerM2 } : {}),
  };
}

function parseProductItem(raw: unknown, index: number): ProductItem | null {
  if (!isRecord(raw)) return null;

  const id = asNonEmptyString(raw.id);
  const slug = asNonEmptyString(raw.slug);
  const nama = asNonEmptyString(raw.nama);
  const kategori = asNonEmptyString(raw.kategori);
  const deskripsiSingkat = asNonEmptyString(raw.deskripsiSingkat);

  if (!id || !slug || !nama || !kategori || !deskripsiSingkat) {
    return null;
  }

  const daftarGambar = Array.isArray(raw.daftarGambar)
    ? raw.daftarGambar.map(asNonEmptyString).filter((v): v is string => v !== null)
    : [];

  const daftarMaterial = Array.isArray(raw.daftarMaterial)
    ? raw.daftarMaterial.map(asNonEmptyString).filter((v): v is string => v !== null)
    : [];

  const availabilityRaw = typeof raw.ketersediaan === 'string' ? raw.ketersediaan : 'konsultasi';
  const ketersediaan: AvailabilityStatus = VALID_AVAILABILITY_STATUSES.has(
    availabilityRaw as AvailabilityStatus
  )
    ? (availabilityRaw as AvailabilityStatus)
    : 'konsultasi';

  const priceInfo = resolvePriceFields(raw);

  const daftarVideo = parseVideos(raw.daftarVideo);
  const tarifKustom = parseCustomRateOverrides(raw.tarifKustom);
  const tarifKustomSebelumPromo = parseCustomRateOverrides(raw.tarifKustomSebelumPromo);
  const hargaSebelumPromo = asPositiveNumberOrNull(raw.hargaSebelumPromo);
  const hargaMulaiSebelumPromo = asPositiveNumberOrNull(raw.hargaMulaiSebelumPromo);
  const promoAktif = typeof raw.promoAktif === 'boolean' ? raw.promoAktif : undefined;
  const kaitkanHargaCustom =
    typeof raw.kaitkanHargaCustom === 'boolean'
      ? raw.kaitkanHargaCustom
      : priceInfo.statusHarga !== 'tetap';

  return {
    id,
    slug,
    nama,
    kategori,
    deskripsiSingkat,
    daftarGambar,
    ...(daftarVideo.length > 0 ? { daftarVideo } : {}),
    daftarMaterial,
    pilihanWarna: parseColors(raw.pilihanWarna),
    dimensi: parseDimensions(raw.dimensi),
    harga: priceInfo.harga,
    hargaMulai: priceInfo.hargaMulai,
    ...(hargaSebelumPromo !== null ? { hargaSebelumPromo } : {}),
    ...(hargaMulaiSebelumPromo !== null ? { hargaMulaiSebelumPromo } : {}),
    ...(promoAktif !== undefined ? { promoAktif } : {}),
    statusHarga: priceInfo.statusHarga,
    kaitkanHargaCustom,
    ...(tarifKustom ? { tarifKustom } : {}),
    ...(tarifKustomSebelumPromo ? { tarifKustomSebelumPromo } : {}),
    ketersediaan,
    unggulan: Boolean(raw.unggulan),
    urutan: typeof raw.urutan === 'number' && Number.isFinite(raw.urutan) ? raw.urutan : index + 1,
    opsiKustom: parseCustomOptions(raw.opsiKustom),
    produkContoh: raw.produkContoh !== false,
  };
}

export function parseProductCatalog(rawData: unknown): ProductCatalogLoadResult {
  if (!isRecord(rawData)) {
    return {
      status: 'error',
      message: 'Format data katalog produk tidak valid (objek JSON diharapkan).',
    };
  }

  if (!Array.isArray(rawData.daftarProduk)) {
    return {
      status: 'error',
      message: 'Daftar produk tidak ditemukan pada berkas katalog.',
    };
  }

  const parsedProducts = rawData.daftarProduk
    .map((item, idx) => parseProductItem(item, idx))
    .filter((item): item is ProductItem => item !== null)
    .sort((a, b) => a.urutan - b.urutan);

  if (rawData.daftarProduk.length > 0 && parsedProducts.length === 0) {
    return {
      status: 'error',
      message: 'Seluruh entri produk dalam katalog gagal divalidasi.',
    };
  }

  const versiSkema =
    typeof rawData.versiSkema === 'number' && Number.isFinite(rawData.versiSkema)
      ? rawData.versiSkema
      : 1;

  const catatan =
    asNonEmptyString(rawData.catatan) ??
    'Spesifikasi akhir dan harga dikonfirmasi langsung oleh tim kami.';

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

const CATALOG_DATA_CACHE_NAME = 'shansusdzar-data-v7';

export async function fetchProductCatalog(
  url = '/produk/produk.json',
  signal?: AbortSignal
): Promise<ProductCatalogLoadResult> {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-cache',
      signal,
    });

    if (!response.ok) {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cache = await window.caches.open(CATALOG_DATA_CACHE_NAME).catch(() => null);
        const cached = await cache?.match(url);
        if (cached && cached.ok) {
          const cachedJson: unknown = await cached.json();
          return parseProductCatalog(cachedJson);
        }
      }
      return {
        status: 'error',
        message: `Gagal memuat katalog produk (HTTP ${response.status}).`,
      };
    }

    if (typeof window !== 'undefined' && 'caches' in window) {
      const cloned = response.clone();
      void window.caches
        .open(CATALOG_DATA_CACHE_NAME)
        .then(async (cache) => {
          await cache.delete(url);
          await cache.put(url, cloned);
        })
        .catch(() => {});
    }

    const json: unknown = await response.json();
    return parseProductCatalog(json);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await window.caches.open(CATALOG_DATA_CACHE_NAME);
        const cached = await cache.match(url);
        if (cached && cached.ok) {
          const cachedJson: unknown = await cached.json();
          return parseProductCatalog(cachedJson);
        }
      } catch {
        // Ignore Cache Storage errors when offline
      }
    }
    return {
      status: 'error',
      message: 'Terjadi kendala saat membaca data katalog produk.',
    };
  }
}
