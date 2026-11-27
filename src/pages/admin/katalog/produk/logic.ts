import { parseProductPromo } from '../../../../lib/catalog-pricing';
import { formatCurrencyIDR } from '../../../../lib/price-format';
import {
  getProductSlug,
  normalizeCustomisasiList,
  normalizeIncludeList,
  normalizePromoField,
  normalizeReferenceSizes,
  parseReferenceSizeCm,
  slugifyProduct,
} from '../../../../lib/product-catalog';
import type { ProductItem } from '../../../../types/product';

export { slugifyProduct };

export const PRESET_PRODUCT_IMAGES: ReadonlyArray<{ label: string; url: string }> = [
  { label: 'Sofa Sandar Minimalis', url: '/produk/gambar/sofa-sandar-minimalis.webp' },
  { label: 'Meja Makan Arsitektural', url: '/produk/gambar/meja-makan-arsitektural.webp' },
  { label: 'Lemari Pakaian Panel Rata', url: '/produk/gambar/lemari-pakaian-panel-rata.webp' },
  { label: 'Kabinet Dapur Modular', url: '/produk/gambar/kabinet-dapur-modular.webp' },
  { label: 'Credenza & Panel Dinding', url: '/produk/gambar/credenza-panel-dinding.webp' },
  { label: 'Meja Kerja & Kabinet', url: '/produk/gambar/meja-kerja-kabinet-dinding.webp' },
  { label: 'Workshop & Craft', url: '/images/atelier-studio-craft.webp' },
];

export interface ProductFormDraft {
  id: string;
  name: string;
  category: string;
  shortDescription: string;
  referensiUkuranText: string;
  meterLari: boolean;
  gambarSampul: string;
  model3d: string;
  mediaText: string;
  rateHplBlockboard: number;
  rateHplMultipleks: number;
  rateHplPvc: number;
  rateDucoBlockboard: number;
  rateDucoMultipleks: number;
  rateDucoPvc: number;
  promo: string;
  customisasiItems: string[];
  includeItems: string[];
}

export interface ProductValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function parseReferenceSizesDraftText(raw: string): {
  valid: boolean;
  normalized: string[];
} {
  const parts = raw
    .split(/[,\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { valid: false, normalized: [] };
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const parsed = parseReferenceSizeCm(part);
    if (!parsed) {
      return { valid: false, normalized: [] };
    }
    if (!seen.has(parsed.normalized)) {
      seen.add(parsed.normalized);
      normalized.push(parsed.normalized);
    }
  }

  return { valid: true, normalized };
}

export const ALLOWED_PRODUCT_CATEGORIES = [
  'Ruang Keluarga',
  'Dapur',
  'Kamar Tidur',
  'Kamar Mandi',
  'Ruang Kerja',
  'Penyimpanan',
  'Komersial',
  'Dinding',
] as const;

export function createEmptyProductDraft(_nextOrder?: number): ProductFormDraft {
  return {
    id: `prod-${Date.now()}`,
    name: '',
    category: 'Dapur',
    shortDescription: '',
    referensiUkuranText: '200x220, 250x220, 300x240',
    meterLari: false,
    gambarSampul: '',
    model3d: '',
    mediaText: '',
    rateHplBlockboard: 1800000,
    rateHplMultipleks: 2500000,
    rateHplPvc: 3500000,
    rateDucoBlockboard: 4500000,
    rateDucoMultipleks: 4500000,
    rateDucoPvc: 4500000,
    promo: '',
    customisasiItems: ['Standar'],
    includeItems: ['Gratis Desain 3D & Konsultasi Ukuran'],
  };
}

export function toProductFormDraft(product: ProductItem): ProductFormDraft {
  const normalizedSizes = normalizeReferenceSizes(product.referensiUkuran);
  const normalizedCustomisasi = normalizeCustomisasiList(product.customisasi);
  const normalizedInclude = normalizeIncludeList(product.include);

  return {
    id: product.id,
    name: product.nama,
    category: product.kategori,
    shortDescription: product.deskripsiSingkat,
    referensiUkuranText: normalizedSizes.join(', '),
    meterLari: product.meterLari === true,
    gambarSampul: product.gambarSampul ?? '',
    model3d: product['3d'] ?? '',
    mediaText: product.media
      .map((item) => (typeof item === 'string' ? item : item.url))
      .join('\n'),
    rateHplBlockboard: product.harga?.hpl?.blockboard ?? 0,
    rateHplMultipleks: product.harga?.hpl?.multipleks ?? 0,
    rateHplPvc: product.harga?.hpl?.pvc ?? 0,
    rateDucoBlockboard: product.harga?.duco?.blockboard ?? 0,
    rateDucoMultipleks: product.harga?.duco?.multipleks ?? 0,
    rateDucoPvc: product.harga?.duco?.pvc ?? 0,
    promo:
      product.promo !== undefined && product.promo !== null ? String(product.promo).trim() : '',
    customisasiItems:
      normalizedCustomisasi.length > 0 ? normalizedCustomisasi : ['Standar'],
    includeItems: normalizedInclude,
  };
}

export function validateProductDraft(
  draft: ProductFormDraft,
  existingProducts: readonly ProductItem[]
): ProductValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};

  if (!draft.name.trim()) {
    fieldErrors.name = 'Nama produk wajib diisi.';
  } else {
    const resolvedSlug = slugifyProduct(draft.name);
    if (!resolvedSlug) {
      fieldErrors.name = 'Nama produk harus memuat huruf atau angka untuk membentuk URL.';
    } else if (
      existingProducts.some((p) => getProductSlug(p) === resolvedSlug && p.id !== draft.id)
    ) {
      fieldErrors.name = 'Nama produk menghasilkan URL yang sudah digunakan produk lain.';
    }
  }

  if (!draft.category.trim()) {
    fieldErrors.category = 'Kategori ruangan wajib diisi.';
  }
  if (!draft.shortDescription.trim()) {
    fieldErrors.shortDescription = 'Deskripsi singkat wajib diisi.';
  }

  const parsedSizes = parseReferenceSizesDraftText(draft.referensiUkuranText);
  if (!parsedSizes.valid) {
    fieldErrors.referensiUkuranText =
      'Masukkan referensi ukuran berupa angka saja dipisah koma (contoh: 200x60, 250x60, 300x60).';
  }

  const hasPositiveRate =
    draft.rateHplBlockboard > 0 ||
    draft.rateHplMultipleks > 0 ||
    draft.rateHplPvc > 0 ||
    draft.rateDucoBlockboard > 0 ||
    draft.rateDucoMultipleks > 0 ||
    draft.rateDucoPvc > 0;
  if (!hasPositiveRate) {
    fieldErrors.rateHplBlockboard = 'Isi minimal satu tarif material atau finishing lebih dari 0.';
  }

  if (draft.promo.trim().length > 0 && !parseProductPromo(draft.promo)) {
    fieldErrors.promo =
      'Masukkan promo berupa persentase (contoh: 10%) atau nominal angka (contoh: 250000).';
  }

  const errorKeys = Object.keys(fieldErrors);
  if (errorKeys.length > 0) {
    return {
      valid: false,
      formError: fieldErrors[errorKeys[0]] ?? 'Periksa kembali kolom formulir produk.',
      fieldErrors,
    };
  }

  return { valid: true, formError: null, fieldErrors: {} };
}

export function normalizeProductFromDraft(draft: ProductFormDraft): ProductItem {
  const name = draft.name.trim();
  const slug = slugifyProduct(name) || slugifyProduct(draft.id) || 'produk';
  const gambarSampul = draft.gambarSampul.trim();
  const model3d = draft.model3d.trim();
  const media = draft.mediaText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const parsedSizes = parseReferenceSizesDraftText(draft.referensiUkuranText);
  const referensiUkuran =
    parsedSizes.valid && parsedSizes.normalized.length > 0
      ? parsedSizes.normalized
      : ['200x60'];

  const customisasi = normalizeCustomisasiList(draft.customisasiItems);
  const include = normalizeIncludeList(draft.includeItems);
  const promo = normalizePromoField(draft.promo);

  const hpl: Record<string, number | null> = {};
  if (draft.rateHplBlockboard > 0) {
    hpl.blockboard = Math.round(draft.rateHplBlockboard);
  }
  if (draft.rateHplMultipleks > 0) {
    hpl.multipleks = Math.round(draft.rateHplMultipleks);
  }
  if (draft.rateHplPvc > 0) {
    hpl.pvc = Math.round(draft.rateHplPvc);
  }

  const duco: Record<string, number | null> = {};
  if (draft.rateDucoBlockboard > 0) {
    duco.blockboard = Math.round(draft.rateDucoBlockboard);
  }
  if (draft.rateDucoMultipleks > 0) {
    duco.multipleks = Math.round(draft.rateDucoMultipleks);
  }
  if (draft.rateDucoPvc > 0) {
    duco.pvc = Math.round(draft.rateDucoPvc);
  }

  return {
    id: draft.id,
    slug,
    nama: name,
    kategori: draft.category.trim(),
    deskripsiSingkat: draft.shortDescription.trim(),
    ...(gambarSampul ? { gambarSampul } : {}),
    ...(model3d ? { '3d': model3d } : {}),
    media,
    referensiUkuran,
    meterLari: draft.meterLari,
    harga: {
      hpl,
      duco,
    },
    ...(promo !== undefined ? { promo } : {}),
    customisasi,
    include,
  };
}

export interface RawProductPriceDisplay {
  minAmount: number | null;
  maxAmount: number | null;
  formattedMin: string | null;
  formattedLabel: string;
  unitLabel: 'm' | 'm²';
  hasPromo: boolean;
  promoDisplay: string | null;
}

function formatProductPromoDisplay(rawPromo: string | number | null | undefined): string | null {
  const parsed = parseProductPromo(rawPromo);
  if (!parsed) return null;
  if (parsed.kind === 'percent') {
    const clean = Number.isInteger(parsed.value)
      ? String(parsed.value)
      : String(Math.round(parsed.value * 10) / 10).replace('.', ',');
    return `${clean}%`;
  }
  return formatCurrencyIDR(parsed.value) ?? `Rp ${parsed.value.toLocaleString('id-ID')}`;
}

export function resolveRawProductPrice(product: ProductItem): RawProductPriceDisplay {
  const unitLabel: 'm' | 'm²' = product.meterLari === true ? 'm' : 'm²';
  const rates: number[] = [];

  for (const val of Object.values(product.harga?.hpl ?? {})) {
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      rates.push(val);
    }
  }
  for (const val of Object.values(product.harga?.duco ?? {})) {
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      rates.push(val);
    }
  }

  const promoDisplay = formatProductPromoDisplay(product.promo);
  const hasPromo = promoDisplay !== null;
  if (rates.length === 0) {
    return {
      minAmount: null,
      maxAmount: null,
      formattedMin: null,
      formattedLabel: 'Belum diatur',
      unitLabel,
      hasPromo,
      promoDisplay,
    };
  }

  const minAmount = Math.min(...rates);
  const maxAmount = Math.max(...rates);
  const formattedMin = formatCurrencyIDR(minAmount) ?? `Rp ${minAmount.toLocaleString('id-ID')}`;

  return {
    minAmount,
    maxAmount,
    formattedMin,
    formattedLabel: `${formattedMin}/${unitLabel}`,
    unitLabel,
    hasPromo,
    promoDisplay,
  };
}
