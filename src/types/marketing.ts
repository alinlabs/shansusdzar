import type { ClientWilayahAddress } from '../lib/wilayah-indonesia';

export type MarketingContactSegment =
  | 'Prospek Baru'
  | 'Klien Aktif'
  | 'Klien Selesai'
  | 'Arsitek & Desainer'
  | 'Korporat / Komersial';

export type MarketingContactSource =
  | 'WhatsApp Masuk'
  | 'Form Pesanan Web'
  | 'Invoice / SPK'
  | 'Instagram / TikTok'
  | 'Referensi Klien'
  | 'Manual Admin';

export type MarketingChannel = 'whatsapp' | 'email';

export type MarketingCampaignStatus = 'Draft' | 'Aktif' | 'Selesai';

export interface MarketingContact {
  id: string;
  kodeKlien?: string;
  nama: string;
  namaPerusahaan: string;
  telepon: string;
  teleponTerstandar: string;
  email: string;
  kota: string;
  alamat?: ClientWilayahAddress;
  segmen: MarketingContactSegment;
  sumber: MarketingContactSource;
  labelTag: string[];
  izinWhatsapp: boolean;
  izinEmail: boolean;
  catatan: string;
  terakhirDihubungi: string | null;
  dibuatPada: string;
}

export interface MarketingTemplate {
  id: string;
  saluran: MarketingChannel;
  nama: string;
  subjek?: string;
  isi: string;
}

export interface MarketingCampaign {
  id: string;
  judul: string;
  tujuan: string;
  status: MarketingCampaignStatus;
  targetSegmen: MarketingContactSegment[];
  saluran: MarketingChannel[];
  pesanWhatsapp: string;
  subjekEmail: string;
  isiEmail: string;
  emailBalasan: string;
  jumlahTerkirim: number;
  terakhirDikirim: string | null;
  dibuatPada: string;
  diperbaruiPada: string;
}

export interface MarketingCampaignLog {
  id: string;
  idKampanye?: string;
  saluran: MarketingChannel;
  judul: string;
  subjek?: string;
  jumlahPenerima: number;
  ringkasanPenerima: string;
  dikirimOleh: string;
  waktuKirim: string;
}
