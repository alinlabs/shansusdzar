export type PriceStatus = 'tetap' | 'mulai' | 'konsultasi';

export interface ProductColorOption {
  id: string;
  nama: string;
  hex: string;
  catatanNuansa?: string;
}

export type ProductMediaKind = 'gambar' | 'video';

export interface ProductMediaObject {
  url: string;
  tipe?: ProductMediaKind;
  judul?: string;
  poster?: string;
  durasi?: string;
}

export type ProductMediaInput = string | ProductMediaObject;

export interface ProductPriceMatrix {
  hpl: Record<string, number | null>;
  duco: Record<string, number | null>;
}

export interface ProductItem {
  id: string;
  slug?: string;
  nama: string;
  kategori: string;
  deskripsiSingkat: string;
  gambarSampul?: string;
  '3d'?: string;
  media: ProductMediaInput[];
  pilihanWarna?: ProductColorOption[];
  referensiUkuran: string[];
  meterLari?: boolean;
  harga?: ProductPriceMatrix;
  promo?: string | number | null;
  customisasi: string[];
  include: string[];
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
