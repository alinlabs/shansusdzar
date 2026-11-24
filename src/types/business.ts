export interface BusinessAddress {
  jalan: string;
  rtRw: string;
  desa: string;
  kabupaten: string;
  kodePos: string;
  negara: string;
  alamatLengkap: string;
}

export interface WhatsAppConfig {
  nomorTampil: string;
  digitTerstandar: string;
  urlDasar: string;
}

export interface PricingConfiguration {
  mataUang: 'IDR';
  /**
   * Persentase (0-100) untuk estimasi awal uang muka (DP).
   * Biarkan null hingga diverifikasi langsung oleh pemilik usaha.
   */
  persentaseDp: number | null;
  /**
   * Tetap false hingga aturan estimasi harga custom terverifikasi.
   */
  hargaCustomTerkonfigurasi: boolean;
}

export interface OwnerDraftContent {
  terverifikasi: boolean;
  namaPemilik: string;
  jabatanPemilik: string;
  kutipanPemilik: string;
  jalurFoto: string;
  teksAltFoto: string;
}

export interface SocialMediaConfig {
  urlFacebook: string;
  urlInstagram: string;
  urlTiktok: string;
}

export interface BusinessConfig {
  namaMerek: string;
  namaMerekSingkat: string;
  drafSlogan: string;
  alamat: BusinessAddress;
  whatsapp: WhatsAppConfig;
  mediaSosial?: SocialMediaConfig;
  drafPemilik: OwnerDraftContent;
}
