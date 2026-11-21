import mediaPresetsData from '../../../../data/aset-media-bawaan.json';
import { resolveCatalogStartingPrice } from '../../../../lib/catalog-pricing';
import type {
  AvailabilityStatus,
  PriceStatus,
  ProductColorOption,
  ProductCustomOption,
  ProductCustomRateOverrides,
  ProductItem,
} from '../../../../types/product';

export const PRESET_PRODUCT_IMAGES = mediaPresetsData.gambarProduk;

export interface ProductFormDraft {
  id: string;
  slug: string;
  name: string;
  category: string;
  shortDescription: string;
  imagesText: string;
  videosText: string;
  materialsText: string;
  colors: ProductColorOption[];
  widthCm: number | null;
  depthCm: number | null;
  heightCm: number | null;
  dimensionPresetsText: string;
  dimensionNote: string;
  price: number;
  priceFrom: number;
  priceBeforePromo: number;
  priceFromBeforePromo: number;
  promoActive: boolean;
  priceStatus: PriceStatus;
  linkCustomPricing: boolean;
  customRateOverrides?: ProductCustomRateOverrides;
  customBeforePromoRateOverrides?: ProductCustomRateOverrides;
  availability: AvailabilityStatus;
  featured: boolean;
  sortOrder: number;
  customizableOptions: ProductCustomOption[];
  isDemo: boolean;
}

export interface ProductValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function slugifyProduct(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function createEmptyProductDraft(nextOrder: number): ProductFormDraft {
  return {
    id: `prod-${Date.now()}`,
    slug: `produk-baru-${nextOrder}`,
    name: '',
    category: 'Dapur & Bar',
    shortDescription: '',
    imagesText: '',
    videosText: '',
    materialsText: 'Multipleks\nHPL',
    colors: [
      { id: 'warm-oat', nama: 'Gandum Hangat', hex: '#D8D1C7' },
      { id: 'charcoal-earth', nama: 'Arang Hangat', hex: '#494641' },
    ],
    widthCm: null,
    depthCm: null,
    heightCm: null,
    dimensionPresetsText: '2×3 m, 3×4 m',
    dimensionNote: 'Ukuran custom dihitung dari panjang × lebar.',
    price: 0,
    priceFrom: 0,
    priceBeforePromo: 0,
    priceFromBeforePromo: 0,
    promoActive: true,
    priceStatus: 'mulai',
    linkCustomPricing: true,
    availability: 'konsultasi',
    featured: false,
    sortOrder: Math.max(1, nextOrder),
    customizableOptions: [
      {
        id: 'customisasi',
        label: 'Customisasi',
        daftarNilai: ['Standar'],
      },
      {
        id: 'bahan',
        label: 'Material Utama',
        daftarNilai: ['MDF', 'Blockboard', 'PVC', 'Multipleks', 'Particle Board'],
      },
      {
        id: 'finishing',
        label: 'Finishing/Laminasi',
        daftarNilai: ['Cat Duco', 'Sheet', 'HPL'],
      },
    ],
    isDemo: false,
  };
}

export function toProductFormDraft(product: ProductItem): ProductFormDraft {
  const linkCustomPricing =
    product.kaitkanHargaCustom === true ||
    (product.kaitkanHargaCustom !== false && product.statusHarga !== 'tetap');

  return {
    id: product.id,
    slug: product.slug,
    name: product.nama,
    category: product.kategori,
    shortDescription: product.deskripsiSingkat,
    imagesText: product.daftarGambar.join('\n'),
    videosText: (product.daftarVideo ?? []).map((v) => v.url).join('\n'),
    materialsText: product.daftarMaterial.join('\n'),
    colors: structuredClone(product.pilihanWarna),
    widthCm: product.dimensi.lebarCm,
    depthCm: product.dimensi.kedalamanCm,
    heightCm: product.dimensi.tinggiCm,
    dimensionPresetsText: (product.dimensi.referensiUkuran ?? []).join(', '),
    dimensionNote: product.dimensi.catatan ?? '',
    price: product.harga ?? 0,
    priceFrom: product.hargaMulai ?? 0,
    priceBeforePromo: product.hargaSebelumPromo ?? 0,
    priceFromBeforePromo: product.hargaMulaiSebelumPromo ?? 0,
    promoActive: product.promoAktif !== false,
    priceStatus: product.statusHarga,
    linkCustomPricing,
    customRateOverrides: product.tarifKustom ? structuredClone(product.tarifKustom) : undefined,
    customBeforePromoRateOverrides: product.tarifKustomSebelumPromo
      ? structuredClone(product.tarifKustomSebelumPromo)
      : undefined,
    availability: product.ketersediaan,
    featured: product.unggulan,
    sortOrder: product.urutan || 1,
    customizableOptions: structuredClone(product.opsiKustom),
    isDemo: Boolean(product.produkContoh),
  };
}

export function validateProductDraft(
  draft: ProductFormDraft,
  existingProducts: readonly ProductItem[]
): ProductValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};

  if (!draft.name.trim()) {
    fieldErrors.name = 'Nama produk wajib diisi.';
  }
  const resolvedSlug = slugifyProduct(draft.slug || draft.name);
  if (!resolvedSlug) {
    fieldErrors.slug = 'Slug URL wajib diisi.';
  } else if (existingProducts.some((p) => p.slug === resolvedSlug && p.id !== draft.id)) {
    fieldErrors.slug = 'Slug URL sudah digunakan oleh produk lain.';
  }

  if (!draft.category.trim()) {
    fieldErrors.category = 'Kategori ruangan wajib diisi.';
  }
  if (!draft.shortDescription.trim()) {
    fieldErrors.shortDescription = 'Deskripsi singkat wajib diisi.';
  }
  if (!draft.linkCustomPricing) {
    if (draft.priceStatus === 'tetap' && (!draft.price || draft.price <= 0)) {
      fieldErrors.price = 'Masukkan nominal harga tetap yang valid (> 0).';
    }
    if (draft.priceStatus === 'mulai' && (!draft.priceFrom || draft.priceFrom <= 0)) {
      fieldErrors.priceFrom = 'Masukkan nominal harga mulai yang valid (> 0).';
    }
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
  const slug = slugifyProduct(draft.slug || name);
  const parsedImages = draft.imagesText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const parsedVideos = draft.videosText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url) => ({ url }));
  const parsedMaterials = draft.materialsText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const sanitizedColors = draft.colors
    .filter((c) => c.nama.trim() && /^#[0-9A-Fa-f]{3,8}$/.test(c.hex))
    .map((c) => ({
      id: slugifyProduct(c.nama) || c.id,
      nama: c.nama.trim(),
      hex: c.hex,
    }));

  const sanitizedOptions = draft.customizableOptions
    .filter((o) => o.label.trim() && o.daftarNilai.length > 0)
    .map((o) => ({
      id: slugifyProduct(o.label) || o.id,
      label: o.label.trim(),
      daftarNilai: o.daftarNilai.map((v) => v.trim()).filter(Boolean),
    }));

  const toNullableDim = (v: number | null | undefined) =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null;

  const parsedDimensionPresets = draft.dimensionPresetsText
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const baseItem: ProductItem = {
    id: draft.id,
    slug,
    nama: name,
    kategori: draft.category.trim(),
    deskripsiSingkat: draft.shortDescription.trim(),
    daftarGambar: parsedImages,
    ...(parsedVideos.length > 0 ? { daftarVideo: parsedVideos } : {}),
    daftarMaterial: parsedMaterials,
    pilihanWarna: sanitizedColors,
    dimensi: {
      lebarCm: toNullableDim(draft.widthCm),
      kedalamanCm: toNullableDim(draft.depthCm),
      tinggiCm: toNullableDim(draft.heightCm),
      ...(parsedDimensionPresets.length > 0 ? { referensiUkuran: parsedDimensionPresets } : {}),
      catatan: draft.dimensionNote.trim() || undefined,
    },
    harga: draft.linkCustomPricing
      ? null
      : draft.priceStatus === 'tetap'
        ? Math.round(draft.price)
        : null,
    hargaMulai: draft.linkCustomPricing
      ? null
      : draft.priceStatus === 'mulai'
        ? Math.round(draft.priceFrom)
        : null,
    hargaSebelumPromo:
      !draft.linkCustomPricing &&
      draft.promoActive &&
      draft.priceStatus === 'tetap' &&
      draft.priceBeforePromo > draft.price
        ? Math.round(draft.priceBeforePromo)
        : null,
    hargaMulaiSebelumPromo:
      !draft.linkCustomPricing &&
      draft.promoActive &&
      draft.priceStatus === 'mulai' &&
      draft.priceFromBeforePromo > draft.priceFrom
        ? Math.round(draft.priceFromBeforePromo)
        : null,
    promoAktif: Boolean(draft.promoActive),
    statusHarga: draft.linkCustomPricing ? 'mulai' : draft.priceStatus,
    kaitkanHargaCustom: Boolean(draft.linkCustomPricing),
    ...(draft.customRateOverrides ? { tarifKustom: draft.customRateOverrides } : {}),
    ...(draft.customBeforePromoRateOverrides
      ? { tarifKustomSebelumPromo: draft.customBeforePromoRateOverrides }
      : {}),
    ketersediaan: draft.availability,
    unggulan: Boolean(draft.featured),
    urutan: Math.max(1, Math.round(draft.sortOrder || 1)),
    opsiKustom: sanitizedOptions,
    produkContoh: Boolean(draft.isDemo),
  };

  if (draft.linkCustomPricing) {
    const resolved = resolveCatalogStartingPrice(baseItem);
    baseItem.hargaMulai = resolved.numericPrice;
    baseItem.hargaMulaiSebelumPromo = resolved.compareAtNumericPrice;
  }

  return baseItem;
}
