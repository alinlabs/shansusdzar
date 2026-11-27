export type SainAiIntent =
  | 'identitas'
  | 'penutup'
  | 'harga_estimasi'
  | 'budget_planner'
  | 'promo_katalog'
  | 'produk_katalog'
  | 'material_finishing'
  | 'survei_lokasi'
  | 'pembayaran_termin'
  | 'layanan_biaya'
  | 'alur_kerja'
  | 'garansi_kebijakan'
  | 'portofolio_ulasan'
  | 'tips_berita'
  | 'warna_palet'
  | 'jadwal_kontak'
  | 'tentang_tim'
  | 'fallback';

export type SainAiTopicId =
  | 'semua'
  | 'harga'
  | 'budget'
  | 'produk'
  | 'material'
  | 'survei'
  | 'pembayaran';

export type SainAiGreetingVariant =
  | 'pagi'
  | 'siang'
  | 'sore'
  | 'malam'
  | 'salam'
  | 'capability'
  | 'casual';

export type SainAiDesignStyle = 'minimalis' | 'klasik' | 'japandi' | 'industrial';

export interface SainAiProductCard {
  id: string;
  nama: string;
  kategori: string;
  startingPriceLabel: string;
  promoLabel: string | null;
  unitLabel: string;
  gambar: string;
  to: string;
}

export interface SainAiEstimateBreakdown {
  productName: string;
  productSlug: string;
  dimensionLabel: string;
  measureLabel: string;
  materialLabel: string;
  finishLabel: string;
  unitRateLabel: string;
  totalEstimateFormatted: string;
  compareAtFormatted: string | null;
  promoLabel: string | null;
  unitPriceNumeric: number;
  paymentStages: Array<{
    nama: string;
    persentase: number;
    amountFormatted: string;
  }>;
}

export interface SainAiMaterialCard {
  id: string;
  nama: string;
  kategori: 'papan' | 'finishing';
  ringkasan: string;
  ketahananLembap: number;
  peringkatKeawetan: number;
  keterjangkauan: number;
  cocokUntuk: string[];
  to: string;
}

export interface SainAiComparisonColumn {
  id: string;
  nama: string;
  sublabel: string;
  highlight?: boolean;
  metrics: Array<{
    label: string;
    score: number;
  }>;
  cocokUntuk: string;
}

export interface SainAiComparisonTable {
  judul: string;
  ringkasanRekomendasi: string;
  columns: SainAiComparisonColumn[];
}

export interface SainAiStepItem {
  nomor: string;
  judul: string;
  deskripsi: string;
  badge?: string;
}

export interface SainAiPortfolioCard {
  id: string;
  judul: string;
  kategori: string;
  lokasi: string;
  durasi: string;
  dimensi: string;
  material: string;
  hargaFormatted: string | null;
  gambar: string;
  to: string;
}

export interface SainAiColorCard {
  id: string;
  nama: string;
  hex: string;
  catatanNuansa: string;
}

export interface SainAiActionLink {
  label: string;
  to?: string;
  href?: string;
  kind: 'route' | 'whatsapp';
}

export interface SainAiMessage {
  id: string;
  sender: 'user' | 'assistant';
  bubbleRole?: 'greeting' | 'confirmation' | 'core' | 'followup';
  text: string;
  createdAt: string;
  intent?: SainAiIntent;
  contextLabel?: string;
  bullets?: string[];
  estimate?: SainAiEstimateBreakdown | null;
  comparison?: SainAiComparisonTable | null;
  steps?: SainAiStepItem[];
  products?: SainAiProductCard[];
  materials?: SainAiMaterialCard[];
  portfolios?: SainAiPortfolioCard[];
  colors?: SainAiColorCard[];
  actions?: SainAiActionLink[];
  followUpPrompts?: string[];
  needsDirectContact?: boolean;
  directContactReason?: string;
}

export interface SainAiPromptChip {
  id: string;
  topic: SainAiTopicId;
  label: string;
  description?: string;
  prompt: string;
}

export interface ExtractedDimensionQuery {
  lengthCm?: number;
  widthOrHeightCm?: number;
  areaSqm?: number;
  lengthMeters?: number;
  rawLabel: string;
}

export interface ParsedUserQuery {
  raw: string;
  normalized: string;
  tokens: string[];
  stemmedTokens: string[];
  expandedTokens: string[];
  extractedKeywords: string[];
  materialId: 'blockboard' | 'multipleks' | 'pvc' | null;
  finishId: 'hpl' | 'cat-duco' | null;
  dimensions: ExtractedDimensionQuery | null;
  budgetIdr: number | null;
  detectedCity: {
    name: string;
    isCovered: boolean;
    matchedRegionLabel?: string;
  } | null;
  detectedRoom: string | null;
  detectedDesignStyle: SainAiDesignStyle | null;
  detectedHardwareOrShape: string[];
  greetingVariant: SainAiGreetingVariant | null;
  asksDirectContact: boolean;
  asksCustomException: boolean;
  asksComparison: boolean;
  asksPromo: boolean;
  asksIncludes: boolean;
  asksMdfOrParticle: boolean;
  asksCheapOrMin: boolean;
  asksBestOrDurable: boolean;
  asksFreeDesign: boolean;
  asksShippingOrInstallFee: boolean;
  asksNegotiationOrBundle: boolean;
  asksCustomReference: boolean;
  isFollowUpModifier: boolean;
  intent: SainAiIntent;
  secondaryIntents: SainAiIntent[];
  confidence: number;
}

export interface SainAiConversationContext {
  lastProductId: string | null;
  lastProductName: string | null;
  lastCategory: string | null;
  lastDimensions: ExtractedDimensionQuery | null;
  lastMaterialId: 'blockboard' | 'multipleks' | 'pvc' | null;
  lastFinishId: 'hpl' | 'cat-duco' | null;
  lastBudgetIdr: number | null;
  lastEstimateTotalIdr: number | null;
  lastIntent: SainAiIntent | null;
  userCity: string | null;
  askedIntents: SainAiIntent[];
  consecutiveFallbacks: number;
  turnCount: number;
}
