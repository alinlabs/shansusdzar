import type { BusinessConfig } from './business';
import type { CustomPricingRules } from '../lib/custom-pricing';
import type { ProductCatalogDocument } from './product';

export interface PortfolioReviewData {
  tampil: boolean;
  namaPengulas: string;
  inisial: string;
  penilaian: number;
  komentar: string;
}

export interface PortfolioCaseStudy {
  id: string;
  slug: string;
  judul: string;
  kategori: string;
  cakupan: string;
  namaKlien: string;
  lokasi: string;
  tahun: string;
  durasi: string;
  ringkasanDimensi: string;
  luasMeterPersegi: number;
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
  terbit: boolean;
  urutan: number;
  ulasan?: PortfolioReviewData | null;
}

export type MaterialCategory = 'papan' | 'finishing';
export type PriceTier = 'Ekonomis' | 'Menengah' | 'Premium';

export interface MaterialSpecItem {
  id: string;
  nama: string;
  kategori: MaterialCategory;
  ketahananLembap: number; // 1 - 5
  peringkatKeawetan: number; // 1 - 5
  tingkatHarga: PriceTier;
  cocokUntuk: string[];
  ringkasan: string;
  tipsPerawatan: string;
}

export interface FaqItem {
  id: string;
  kategori: string;
  pertanyaan: string;
  jawaban: string;
  urutan: number;
  terbit: boolean;
}

export interface ServicePolicyItem {
  id: string;
  judul: string;
  ringkasan: string;
  rincian: string;
}

export interface NewsArticleItem {
  id: string;
  slug: string;
  judul: string;
  kategori: string;
  ringkasan: string;
  paragrafKonten: string[];
  gambarSampul: string;
  teksAltSampul: string;
  namaPenulis: string;
  tanggalTerbit: string;
  menitBaca: number;
  judulSeo: string;
  deskripsiSeo: string;
  kataKunciSeo: string[];
  unggulan: boolean;
  terbit: boolean;
}

export interface OperationalInfo {
  jamOperasional: string;
  catatanJadwalSurvei: string;
  estimasiWaktuProduksi: string;
  ringkasanGaransi: string;
  ringkasanTerminPembayaran: string;
  areaJangkauanSurvei: string[];
  pengumumanAktif: boolean;
  teksPengumuman: string;
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
  teksCtaUtamaHero: string;
  teksCtaSekunderHero: string;
  labelPortofolio: string;
  judulPortofolio: string;
  deskripsiPortofolio: string;
  labelUnggulan: string;
  judulUnggulan: string;
  deskripsiUnggulan: string;
  labelKeunggulan: string;
  judulKeunggulan: string;
  deskripsiKeunggulan: string;
  labelProses: string;
  judulProses: string;
  deskripsiProses: string;
  labelTestimoni: string;
  judulTestimoni: string;
  deskripsiTestimoni: string;
  judulCta: string;
  deskripsiCta: string;
  daftarKeunggulan: ValuePropositionData[];
  tahapanProses: ProcessStepData[];
  ulasanKlien?: ClientReviewData[];
}

export interface WorkingPrincipleData {
  id: string;
  nomor: string;
  judul: string;
  deskripsi: string;
}

export interface TeamMemberData {
  id: string;
  nama: string;
  inisial: string;
  jabatan: string;
  divisi: string;
  biodata: string;
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
  labelAtas: string;
  judul: string;
  pengantar: string;
  gambarWorkshop?: string;
  teksAltWorkshop?: string;
  daftarParagraf: string[];
  biografiPemilik: string;
  labelLokasi: string;
  judulLokasi: string;
  prinsipKerja: WorkingPrincipleData[];
  labelVisi: string;
  judulVisi: string;
  pernyataanVisi: string;
  judulMisi: string;
  daftarMisi: string[];
  labelTim: string;
  judulTim: string;
  deskripsiTim: string;
  anggotaTim: TeamMemberData[];
  sorotanWorkshop: WorkshopHighlightData[];
  komitmenLayanan: string[];
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
  policies: ServicePolicyItem[];
  operationalInfo: OperationalInfo;
  catalogOverride: ProductCatalogDocument | null;
  seoSettings?: SeoSettingsConfig;
  socialPlans?: SocialMediaPlanItem[];
  customPricing?: CustomInteriorPricingConfig;
  paymentScheme?: PaymentSchemeConfig;
}

export type AdminPermission =
  | 'dashboard.view'
  | 'katalog.view'
  | 'katalog.edit'
  | 'katalog.delete'
  | 'portofolio.view'
  | 'portofolio.edit'
  | 'portofolio.delete'
  | 'informasi.view'
  | 'informasi.edit'
  | 'tentang.view'
  | 'tentang.edit'
  | 'bisnis.edit'
  | 'keuangan.view'
  | 'keuangan.edit'
  | 'keuangan.delete'
  | 'marketing.view'
  | 'marketing.edit'
  | 'akses.view'
  | 'akses.manage';

export interface AdminRoleDefinition {
  id: string;
  nama: string;
  deskripsi: string;
  peranSistem?: boolean;
  daftarIzin: AdminPermission[];
}

export interface AdminUserAccount {
  id: string;
  nama: string;
  email: string;
  kataSandi: string;
  idPeran: string;
  divisi: string;
  status: 'aktif' | 'ditangguhkan';
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
