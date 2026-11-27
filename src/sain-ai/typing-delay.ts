import type { SainAiIntent, SainAiMessage } from './types';

export const MIN_TYPING_DELAY_MS = 1150;
export const MAX_TYPING_DELAY_MS = 7400;

export interface ContextTypingProfile {
  /** Rata-rata kecepatan ketik manusia pada konteks ini (karakter per menit / CPM). */
  humanCpm: number;
  /** Jeda baca/cek referensi sebelum mulai mengetik balasan (ms). */
  thinkMs: number;
}

const DEFAULT_TYPING_PROFILE: ContextTypingProfile = {
  humanCpm: 255,
  thinkMs: 650,
};

/**
 * Profil kecepatan ketik manusia rata-rata (CPM) & waktu berpikir per konteks percakapan.
 * Konteks ringan/spontan (sapaan, penutup) lebih cepat; konteks kalkulasi teknis,
 * perbandingan material, dan survei area memerlukan jeda cek data lebih teliti.
 */
export const CONTEXT_TYPING_PROFILES: Record<SainAiIntent, ContextTypingProfile> = {
  penutup: { humanCpm: 330, thinkMs: 280 },
  identitas: { humanCpm: 310, thinkMs: 340 },
  warna_palet: { humanCpm: 290, thinkMs: 440 },
  jadwal_kontak: { humanCpm: 290, thinkMs: 440 },
  promo_katalog: { humanCpm: 275, thinkMs: 540 },
  layanan_biaya: { humanCpm: 265, thinkMs: 580 },
  alur_kerja: { humanCpm: 265, thinkMs: 600 },
  garansi_kebijakan: { humanCpm: 260, thinkMs: 620 },
  tips_berita: { humanCpm: 260, thinkMs: 580 },
  tentang_tim: { humanCpm: 265, thinkMs: 580 },
  portofolio_ulasan: { humanCpm: 250, thinkMs: 700 },
  produk_katalog: { humanCpm: 245, thinkMs: 740 },
  survei_lokasi: { humanCpm: 245, thinkMs: 780 },
  pembayaran_termin: { humanCpm: 235, thinkMs: 840 },
  material_finishing: { humanCpm: 230, thinkMs: 920 },
  budget_planner: { humanCpm: 225, thinkMs: 980 },
  harga_estimasi: { humanCpm: 215, thinkMs: 1080 },
  fallback: { humanCpm: 255, thinkMs: 650 },
};

export function getContextTypingProfile(intent?: SainAiIntent): ContextTypingProfile {
  if (!intent) return DEFAULT_TYPING_PROFILE;
  return CONTEXT_TYPING_PROFILES[intent] ?? DEFAULT_TYPING_PROFILE;
}

function estimateEffectiveTypedChars(message: SainAiMessage): number {
  const baseTextLen = message.text.trim().length;
  const bulletsLen = (message.bullets ?? []).reduce(
    (sum, item) => sum + Math.min(48, item.trim().length * 0.45),
    0
  );
  const stepsWeight = (message.steps?.length ?? 0) * 28;
  const estimateWeight = message.estimate ? 95 : 0;
  const comparisonWeight = message.comparison ? 110 : 0;
  const productsWeight = (message.products?.length ?? 0) * 26;
  const portfoliosWeight = (message.portfolios?.length ?? 0) * 26;
  const colorsWeight = (message.colors?.length ?? 0) * 12;

  return (
    baseTextLen +
    bulletsLen +
    stepsWeight +
    estimateWeight +
    comparisonWeight +
    productsWeight +
    portfoliosWeight +
    colorsWeight
  );
}

/**
 * Menghitung durasi tunggu mengetik satu pesan berdasarkan CPM manusia pada konteksnya
 * serta panjang teks dan kelengkapan komponen balasan.
 */
export function computeSainAiTypingDelayMs(message: SainAiMessage): number {
  const profile = getContextTypingProfile(message.intent);
  const effectiveChars = estimateEffectiveTypedChars(message);
  // 60_000 / humanCpm = ms per karakter manusia; skala ritme chat web (0.095)
  // menjaga proporsi antar-CPM (215–330 CPM) terasa nyata tanpa membuat user menunggu puluhan detik.
  const msPerChar = (60_000 / profile.humanCpm) * 0.095;
  const rawMs = profile.thinkMs + effectiveChars * msPerChar;

  return Math.round(
    Math.min(MAX_TYPING_DELAY_MS, Math.max(MIN_TYPING_DELAY_MS, rawMs))
  );
}

/**
 * Menghitung jeda tunggu per bubble secara terpisah dan kontekstual:
 * - Bubble 1 (konfirmasi): reaksi cepat + ketikan teks konfirmasi sesuai CPM konteks.
 * - Bubble 2 (inti): jeda cek/hitung data konteks + ketikan isi utama & rincian.
 * - Bubble 3 (tindak lanjut): jeda singkat + ketikan ajakan lanjutan sesuai CPM konteks.
 */
export function computeSainAiSequenceDelaysMs(
  bubbles: readonly SainAiMessage[]
): number[] {
  return bubbles.map((msg, index) => {
    const profile = getContextTypingProfile(msg.intent);
    const msPerChar = (60_000 / profile.humanCpm) * 0.09;
    const textLen = msg.text.trim().length;

    if (msg.bubbleRole === 'confirmation' || (index === 0 && msg.bubbleRole !== 'core')) {
      const thinkPart = Math.round(profile.thinkMs * 0.42);
      const raw = thinkPart + textLen * (msPerChar * 0.85);
      return Math.round(Math.min(2800, Math.max(1150, raw)));
    }

    if (
      msg.bubbleRole === 'followup' ||
      (index === bubbles.length - 1 && bubbles.length > 1 && msg.bubbleRole !== 'core')
    ) {
      const thinkPart = Math.round(profile.thinkMs * 0.32);
      const raw = thinkPart + textLen * (msPerChar * 0.78);
      return Math.round(Math.min(3100, Math.max(1300, raw)));
    }

    const coreDelay = computeSainAiTypingDelayMs(msg);
    return Math.round(Math.min(MAX_TYPING_DELAY_MS, Math.max(2100, coreDelay)));
  });
}

export function formatChatTimestamp(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);
}
