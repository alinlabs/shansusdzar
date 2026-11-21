export type PriceStatus = 'tetap' | 'mulai' | 'konsultasi';

export type AvailabilityStatus = 'tersedia' | 'pre-order' | 'terbatas' | 'konsultasi';

export interface ProductDimensions {
  lebarCm: number | null;
  kedalamanCm: number | null;
  tinggiCm: number | null;
  referensiUkuran?: string[];
  catatan?: string;
}

export interface ProductColorOption {
  id: string;
  nama: string;
  hex: string;
}

export interface ProductCustomOption {
  id: string;
  label: string;
  daftarNilai: string[];
}

export interface ProductVideoItem {
  url: string;
  judul?: string;
  poster?: string;
  durasi?: string;
}

export interface ProductCustomRateOverrides {
  desainPerM2?: number | null;
  bahanPerM2?: Record<string, number | null>;
  finishingPerM2?: Record<string, number | null>;
}

export interface ProductItem {
  id: string;
  slug: string;
  nama: string;
  kategori: string;
  deskripsiSingkat: string;
  daftarGambar: string[];
  daftarVideo?: ProductVideoItem[];
  daftarMaterial: string[];
  pilihanWarna: ProductColorOption[];
  dimensi: ProductDimensions;
  harga: number | null;
  hargaMulai: number | null;
  hargaSebelumPromo?: number | null;
  hargaMulaiSebelumPromo?: number | null;
  promoAktif?: boolean;
  statusHarga: PriceStatus;
  kaitkanHargaCustom?: boolean;
  tarifKustom?: ProductCustomRateOverrides;
  tarifKustomSebelumPromo?: ProductCustomRateOverrides;
  ketersediaan: AvailabilityStatus;
  unggulan: boolean;
  urutan: number;
  opsiKustom: ProductCustomOption[];
  produkContoh: boolean;
}

export interface ProductCatalogDocument {
  versiSkema: number;
  katalogContoh: boolean;
  catatan: string;
  diperbaruiPada: string;
  daftarProduk: ProductItem[];
}

export type ProductCatalogLoadResult =
  | {
      status: 'success';
      catalog: ProductCatalogDocument;
    }
  | {
      status: 'error';
      message: string;
    };
