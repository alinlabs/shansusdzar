export const EMSIFA_WILAYAH_BASE_URL =
  'https://www.emsifa.com/api-wilayah-indonesia/v2';

export interface EmsifaApiMeta {
  updated_at?: string;
  generated_at?: string;
  level?: number;
}

export interface EmsifaApiResponse<T> {
  data: T;
  meta?: EmsifaApiMeta;
}

export interface WilayahItem {
  id: string;
  name: string;
}

export interface WilayahVillageItem extends WilayahItem {
  postal_code?: string;
}

export interface ClientAddressRegionRef {
  id: string;
  name: string;
}

export interface ClientVillageRegionRef extends ClientAddressRegionRef {
  postalCode?: string;
}

export interface ClientWilayahAddress {
  provinsi?: ClientAddressRegionRef;
  kabupaten?: ClientAddressRegionRef;
  kecamatan?: ClientAddressRegionRef;
  desa?: ClientVillageRegionRef;
  detail?: string;
}

const resolvedCache = new Map<string, WilayahItem[] | WilayahVillageItem[]>();
const inflightCache = new Map<string, Promise<WilayahItem[] | WilayahVillageItem[]>>();

export function clearWilayahCache(): void {
  resolvedCache.clear();
  inflightCache.clear();
}

export function unwrapEmsifaListResponse<T extends WilayahItem>(
  payload: unknown
): T[] {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Format respons API wilayah tidak valid.');
  }
  const record = payload as { data?: unknown };
  if (!Array.isArray(record.data)) {
    throw new Error('Data wilayah tidak ditemukan pada respons API.');
  }
  return record.data.filter((item): item is T => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as { id?: unknown; name?: unknown };
    return (
      typeof candidate.id === 'string' &&
      candidate.id.trim().length > 0 &&
      typeof candidate.name === 'string' &&
      candidate.name.trim().length > 0
    );
  });
}

async function fetchWilayahList<T extends WilayahItem>(
  relativePath: string,
  signal?: AbortSignal
): Promise<T[]> {
  const cached = resolvedCache.get(relativePath);
  if (cached) {
    return cached as T[];
  }

  const inflight = inflightCache.get(relativePath);
  if (inflight && !signal) {
    return inflight as Promise<T[]>;
  }

  const url = `${EMSIFA_WILAYAH_BASE_URL}${relativePath}`;
  const requestPromise = (async () => {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!response.ok) {
      throw new Error(`Gagal memuat data wilayah (${response.status}).`);
    }
    const json: unknown = await response.json();
    const list = unwrapEmsifaListResponse<T>(json);
    resolvedCache.set(relativePath, list);
    return list;
  })();

  if (!signal) {
    inflightCache.set(relativePath, requestPromise);
  }

  try {
    return await requestPromise;
  } finally {
    inflightCache.delete(relativePath);
  }
}

export function fetchProvinces(signal?: AbortSignal): Promise<WilayahItem[]> {
  return fetchWilayahList<WilayahItem>('/provinces.json', signal);
}

export function fetchRegencies(
  provinceId: string,
  signal?: AbortSignal
): Promise<WilayahItem[]> {
  const cleanId = provinceId.trim();
  if (!cleanId) return Promise.resolve([]);
  return fetchWilayahList<WilayahItem>(
    `/regencies/${encodeURIComponent(cleanId)}.json`,
    signal
  );
}

export function fetchDistricts(
  regencyId: string,
  signal?: AbortSignal
): Promise<WilayahItem[]> {
  const cleanId = regencyId.trim();
  if (!cleanId) return Promise.resolve([]);
  return fetchWilayahList<WilayahItem>(
    `/districts/${encodeURIComponent(cleanId)}.json`,
    signal
  );
}

export function fetchVillages(
  districtId: string,
  signal?: AbortSignal
): Promise<WilayahVillageItem[]> {
  const cleanId = districtId.trim();
  if (!cleanId) return Promise.resolve([]);
  return fetchWilayahList<WilayahVillageItem>(
    `/villages/${encodeURIComponent(cleanId)}.json`,
    signal
  );
}

function cleanRegionRef(
  ref?: { id?: string | null; name?: string | null } | null
): ClientAddressRegionRef | undefined {
  const id = String(ref?.id ?? '').trim();
  const name = String(ref?.name ?? '').trim();
  if (!id || !name) return undefined;
  return { id, name };
}

export function normalizeClientWilayahAddress(
  alamat?: ClientWilayahAddress | null
): ClientWilayahAddress | undefined {
  if (!alamat) return undefined;
  const raw = alamat as ClientWilayahAddress & { detailAlamat?: string };
  const provinsi = cleanRegionRef(raw.provinsi);
  const kabupaten = provinsi ? cleanRegionRef(raw.kabupaten) : undefined;
  const kecamatan = kabupaten ? cleanRegionRef(raw.kecamatan) : undefined;
  const rawDesa = kecamatan ? cleanRegionRef(raw.desa) : undefined;
  const rawPostal = String(raw.desa?.postalCode ?? '').trim();
  const desa: ClientVillageRegionRef | undefined = rawDesa
    ? {
        ...rawDesa,
        ...(rawPostal ? { postalCode: rawPostal } : {}),
      }
    : undefined;
  const detail = String(raw.detail ?? raw.detailAlamat ?? '').trim();

  if (!provinsi && !kabupaten && !kecamatan && !desa && !detail) {
    return undefined;
  }

  return {
    ...(provinsi ? { provinsi } : {}),
    ...(kabupaten ? { kabupaten } : {}),
    ...(kecamatan ? { kecamatan } : {}),
    ...(desa ? { desa } : {}),
    ...(detail ? { detail } : {}),
  };
}

export function hasStructuredWilayahAddress(
  alamat?: ClientWilayahAddress | null
): boolean {
  if (!alamat) return false;
  return Boolean(
    alamat.provinsi?.name ||
      alamat.kabupaten?.name ||
      alamat.kecamatan?.name ||
      alamat.desa?.name
  );
}

export function formatKabupatenShort(kabupatenName?: string | null): string {
  const clean = String(kabupatenName ?? '').trim();
  if (!clean) return '';
  if (/^kabupaten\s+/i.test(clean)) {
    return clean.replace(/^kabupaten\s+/i, 'Kab. ');
  }
  return clean;
}

export function formatDesaKotaLabel(
  alamat?: ClientWilayahAddress | null,
  fallbackLokasi?: string | null
): string {
  const desa = String(alamat?.desa?.name ?? '').trim();
  const kabupatenShort = formatKabupatenShort(alamat?.kabupaten?.name);
  const kecamatan = String(alamat?.kecamatan?.name ?? '').trim();

  if (desa && kabupatenShort) {
    return `${desa}, ${kabupatenShort}`;
  }
  if (kecamatan && kabupatenShort) {
    return `${kecamatan}, ${kabupatenShort}`;
  }
  if (kabupatenShort) {
    return kabupatenShort;
  }
  if (desa) {
    return desa;
  }
  return String(fallbackLokasi ?? '').trim();
}

export function formatFullWilayahAddress(
  alamat?: ClientWilayahAddress | null,
  fallbackLokasi?: string | null
): string {
  if (!alamat) return String(fallbackLokasi ?? '').trim();

  const detail = String(alamat.detail ?? '').trim();
  const desa = String(alamat.desa?.name ?? '').trim();
  const kecamatan = String(alamat.kecamatan?.name ?? '').trim();
  const kabupaten = String(alamat.kabupaten?.name ?? '').trim();
  const provinsi = String(alamat.provinsi?.name ?? '').trim();
  const postalCode = String(alamat.desa?.postalCode ?? '').trim();

  const parts = [
    detail,
    desa,
    kecamatan ? `Kec. ${kecamatan}` : '',
    kabupaten,
    provinsi,
  ].filter(Boolean);

  if (parts.length === 0) {
    return String(fallbackLokasi ?? '').trim();
  }

  const base = parts.join(', ');
  return postalCode ? `${base} ${postalCode}` : base;
}

export function formatCityFromWilayah(
  alamat?: ClientWilayahAddress | null,
  fallbackCity?: string | null
): string {
  const shortKab = formatKabupatenShort(alamat?.kabupaten?.name);
  if (shortKab) return shortKab;
  return String(fallbackCity ?? '').trim();
}
