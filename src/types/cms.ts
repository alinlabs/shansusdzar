import type { BusinessConfig } from './business';
import type { CustomPricingRules } from '../lib/custom-pricing';
import type { ProductCatalogDocument } from './product';

export interface PortfolioDimensionItem {
  panjang: number;
  lebar: number;
  tinggi: number;
}

export interface PortfolioReviewData {
  sapaan: string;
  klien: string;
  penilaian: number;
  komentar: string;
}

export interface PortfolioCaseStudy {
  id: string;
  produkId?: string;
  judul: string;
  kategori: string;
  cakupan: string;
  lokasi: string;
  tahun: string;
  durasi: string;
  dimensi: PortfolioDimensionItem[];
  referensiHarga?: number | null;
  catatanMaterial: string;
  catatanFinishing: string;
  materialDigunakan: string[];
  deskripsi: string;
  tantangan: string;
  solusi: string;
  gambarUtama: string;
  galeriGambar: string[];
  teksAlt: string;
  tampilDiBeranda: boolean;
  ulasan?: PortfolioReviewData | null;
}

export type MaterialCategory = 'papan' | 'finishing';

export interface MaterialSpecItem {
  id: string;
  nama: string;
  kategori: MaterialCategory;
  ketahananLembap: number; // 0 - 100
  peringkatKeawetan: number; // 0 - 100
  keterjangkauan: number; // 0 - 100
  cocokUntuk: string[];
  ringkasan: string;
  tipsPerawatan: string;
  terbuatDari?: string;
  kelebihan?: string[];
  gambarReferensi?: string;
}

export interface FaqItem {
  id: string;
  kategori: string;
  pertanyaan: string;
  jawaban: string;
  urutan: number;
  terbit: boolean;
}

export type NewsTextStyle = 'paragraf' | 'subjudul' | 'kutipan';
export type NewsTextAlign = 'justify' | 'left';
export type NewsImageDisplayMode = 'crop' | 'fit' | 'full';
export type NewsImageGridCols = 'auto' | '1' | '2' | '3';
export type NewsImageAspectRatio = '16/9' | '4/3' | '1/1' | '4/5' | '3/4' | '21/9';

export interface NewsTextBlockFormat {
  gaya: NewsTextStyle;
  rata: NewsTextAlign;
}

export interface NewsImageBlockFormat {
  mode: NewsImageDisplayMode;
  grid: NewsImageGridCols;
  ratio?: NewsImageAspectRatio;
  caption?: string;
  alt?: string;
}

export interface NewsTextContentBlock {
  jenis: 'teks';
  isi: string;
  format: NewsTextBlockFormat;
}

export interface NewsImageContentBlock {
  jenis: 'gambar';
  isi: string[];
  format: NewsImageBlockFormat;
}

export type NewsArticleContentBlock = NewsTextContentBlock | NewsImageContentBlock;

export interface NewsArticleItem {
  id: string;
  judul: string;
  kategori: string;
  ringkasan: string;
  isi: NewsArticleContentBlock[];
  gambarSampul: string;
  teksAltSampul: string;
  tanggalTerbit: string;
  judulSeo: string;
  deskripsiSeo: string;
  kataKunciSeo: string[];
  unggulan: boolean;
}

export interface OperationalInfo {
  jamOperasional: string;
  catatanJadwalSurvei: string;
  estimasiWaktuProduksi: string;
  ringkasanGaransi: string;
  areaJangkauanSurvei: string[];
}

export interface ValuePropositionData {
  id: string;
  nomor: string;
  judul: string;
  deskripsi: string;
  detail?: string;
}

export interface ProcessStepData {
  id: string;
  nomor: string;
  judul: string;
  deskripsi: string;
  detail?: string;
}

export interface ClientReviewData {
  id: string;
  namaKlien: string;
  inisial: string;
  konteksProyek: string;
  penilaian: number;
  komentar: string;
  projectId?: string;
  projectSlug?: string;
  projectTitle?: string;
  projectCategory?: string;
  projectLocation?: string;
  projectImage?: string;
}

export interface BerandaContent {
  labelHero: string;
  judulHero: string;
  judulHeroBarisDua: string;
  deskripsiHero: string;
  deskripsiHeroBarisDua: string;
  mediaHero?: {
    sumberVideo: string;
    sumberGambar: string;
  };
  labelPortofolio: string;
  judulPortofolio: string;
  labelUnggulan: string;
  judulUnggulan: string;
  labelKeunggulan: string;
  judulKeunggulan: string;
  labelProses: string;
  judulProses: string;
  deskripsiProses: string;
  labelTestimoni: string;
  judulTestimoni: string;
  daftarKeunggulan: ValuePropositionData[];
  tahapanProses: ProcessStepData[];
}

export interface TeamMemberData {
  id: string;
  nama: string;
  inisial: string;
  jabatan: string;
  fotoProfil?: string;
  teksAltFoto?: string;
}

export interface WorkshopHighlightData {
  id: string;
  nilai: string;
  label: string;
  detail: string;
}

export interface TentangContent {
  pengantar: string;
  gambarWorkshop?: string;
  teksAltWorkshop?: string;
  daftarParagraf: string[];
  pernyataanVisi: string;
  daftarMisi: string[];
  anggotaTim: TeamMemberData[];
  sorotanWorkshop: WorkshopHighlightData[];
}

export interface SeoPageOverride {
  jalurRute: string;
  labelHalaman: string;
  judulMeta: string;
  deskripsiMeta: string;
  kataKunciFokus: string;
}

export interface SeoSettingsConfig {
  judulBawaan: string;
  deskripsiBawaan: string;
  kataKunci: string;
  urlKanonikalDasar: string;
  kebijakanRobots: 'index, follow' | 'index, nofollow' | 'noindex, nofollow';
  verifikasiGoogleSite: string;
  namaSitusOg: string;
  tipeOg: 'website' | 'article';
  urlGambarOg: string;
  kartuTwitter: 'summary_large_image' | 'summary';
  akunTwitter: string;
  tipeSkema: 'FurnitureStore' | 'HomeAndConstructionBusiness' | 'LocalBusiness';
  areaLayanan: string;
  kisaranHarga: string;
  penyesuaianHalaman: SeoPageOverride[];
}

export type SocialMediaPlatform = 'Instagram' | 'TikTok' | 'Facebook';
export type SocialMediaFormat =
  | 'Reels / Video Pendek'
  | 'Carousel'
  | 'Feed Foto'
  | 'Story'
  | 'Live Workshop';
export type SocialMediaPlanStatus =
  | 'Ide'
  | 'Produksi'
  | 'Siap Upload'
  | 'Terjadwal'
  | 'Terbit';

export interface SocialMediaPlanItem {
  id: string;
  judul: string;
  platform: SocialMediaPlatform;
  format: SocialMediaFormat;
  pilar: string;
  tanggalTerjadwal: string; // YYYY-MM-DD
  jamTerjadwal: string; // HH:mm
  status: SocialMediaPlanStatus;
  kalimatPembuka: string;
  takaranKonten: string;
  tagar: string;
  targetAksi: string;
  namaPenanggungJawab: string;
  catatan: string;
}

export interface PaymentSchemeStage {
  id: string;
  urutan: number;
  nama: string;
  persentase: number;
  keterangan: string;
}

export interface PaymentSchemeConfig {
  judul: string;
  catatan: string;
  tahapan: PaymentSchemeStage[];
}

export interface CustomInteriorPricingConfig {
  hargaCustomTerkonfigurasi: boolean;
  persentaseDp: number;
  rules: CustomPricingRules;
}

export interface SiteContentBundle {
  schemaVersion: number;
  updatedAt: string;
  businessConfig: BusinessConfig;
  beranda: BerandaContent;
  tentang: TentangContent;
  portfolioProjects: PortfolioCaseStudy[];
  newsArticles: NewsArticleItem[];
  materials: MaterialSpecItem[];
  faqs: FaqItem[];
  operationalInfo: OperationalInfo;
  catalogOverride: ProductCatalogDocument | null;
  seoSettings?: SeoSettingsConfig;
  socialPlans?: SocialMediaPlanItem[];
  customPricing?: CustomInteriorPricingConfig;
  paymentScheme?: PaymentSchemeConfig;
}

export type AdminAccessPageKey =
  | 'proyek'
  | 'keuangan'
  | 'produk'
  | 'portofolio'
  | 'berita'
  | 'material'
  | 'faq'
  | 'profil-usaha'
  | 'pengguna';

export type AdminAccessLevel = 'hide' | 'view' | 'editor';

export interface AdminPageAccessRule {
  halaman: AdminAccessPageKey;
  krendensial: AdminAccessLevel;
}

export interface AdminUserAccount {
  id: string;
  nama: string;
  email: string;
  kataSandi: string;
  isOwner?: boolean;
  divisi: string;
  akses: AdminPageAccessRule[];
  loginTerakhir: string | null;
}

export interface AdminActivityLogItem {
  id: string;
  namaAktor: string;
  peranAktor: string;
  aksi: string;
  modulTarget: string;
  labelTarget: string;
  waktu: string;
}
