import type { ProductItem } from '../types/product';
import type {
  ParsedUserQuery,
  SainAiConversationContext,
  SainAiIntent,
  SainAiMessage,
} from './types';

function hashTextSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickVariant(options: readonly string[], seedText: string): string {
  if (options.length === 0) return '';
  return options[hashTextSeed(seedText) % options.length];
}

function formatShortMaterial(materialId: ParsedUserQuery['materialId']): string | null {
  if (materialId === 'pvc') return 'PVC Board 18 mm';
  if (materialId === 'multipleks') return 'Multipleks 18 mm';
  if (materialId === 'blockboard') return 'Blockboard 18 mm';
  return null;
}

function formatShortFinish(finishId: ParsedUserQuery['finishId']): string | null {
  if (finishId === 'cat-duco') return 'Cat Duco';
  if (finishId === 'hpl') return 'HPL';
  return null;
}

export function buildHumanConfirmationBubble(params: {
  query: string;
  parsed: ParsedUserQuery;
  coreMessage: SainAiMessage;
  primaryProduct?: ProductItem | null;
  usedContextMemory?: boolean;
  context: SainAiConversationContext;
  createdAt: string;
}): SainAiMessage {
  const { query, parsed, coreMessage, primaryProduct, usedContextMemory, createdAt } = params;
  const intent = coreMessage.intent ?? parsed.intent;
  const prodName = primaryProduct?.nama.split('(')[0].trim();
  const matLabel = formatShortMaterial(parsed.materialId);
  const finLabel = formatShortFinish(parsed.finishId);
  const specParts = [matLabel, finLabel].filter(Boolean).join(' + ');
  const dimLabel = parsed.dimensions?.rawLabel;
  const cityLabel = parsed.detectedCity?.name;

  let text = '';

  if (intent === 'penutup') {
    text = pickVariant(
      [
        'Sama-sama kak, senang banget bisa bantu!',
        'Siap kak, terima kasih banyak juga ya sudah mampir ngobrol!',
        'Dengan senang hati kak! Senang kalau infonya udah pas.',
      ],
      query
    );
  } else if (intent === 'identitas') {
    text = pickVariant(
      [
        'Hai kak! Salam kenal ya dari Sain Ai.',
        'Halo kak! Senang banget bisa bantu kebutuhan interiornya hari ini.',
        'Hai kak, aku siap nemenin konsultasi interiornya ya!',
      ],
      query
    );
  } else if (intent === 'harga_estimasi') {
    if (usedContextMemory && prodName) {
      const changeDesc =
        [dimLabel, specParts].filter(Boolean).join(' ') || 'opsi barunya';
      text = pickVariant(
        [
          `Oke kak, aku hitungin ulang ${prodName} pakai ${changeDesc} dulu ya...`,
          `Siap, tunggu sebentar ya kak, aku sesuaikan hitungan ${prodName}-nya ke ${changeDesc}...`,
          `Baik kak, sebentar ya aku cek perubahan estimasi ${prodName} (${changeDesc})...`,
        ],
        query
      );
    } else if (!prodName && specParts) {
      text = pickVariant(
        [
          `Oke, tunggu sebentar ya kak, aku cekin dulu daftar harga ${specParts} per meternya...`,
          `Siap kak! Sebentar ya aku bukain rincian tarif ${specParts} di studio...`,
          `Baik kak, tunggu sebentar ya aku lihatkan tarif resmi ${specParts}-nya dulu...`,
        ],
        query
      );
    } else {
      const subject = [prodName, dimLabel, specParts].filter(Boolean).join(' ');
      text = pickVariant(
        [
          `Oke, tunggu aku cek dulu ya hitungan ${subject || 'estimasi unit'}-nya...`,
          `Siap kak, sebentar ya aku kalkulasiin dulu ${subject || 'estimasi biayanya'}...`,
          `Baik kak, aku hitungin dulu ya untuk ${subject || 'kebutuhan interiornya'}${cityLabel ? ` sekalian cek area ${cityLabel}` : ''}...`,
        ],
        query
      );
    }
  } else if (intent === 'budget_planner') {
    text = pickVariant(
      [
        'Oke siap kak, sebentar aku pilihin dulu unit dan ukuran yang paling pas sama budget-nya ya...',
        'Siap kak! Tunggu sebentar ya, aku cekin kombinasi ukuran terbaik sesuai dana yang disiapkan...',
        'Baik kak, aku bantu cocokin dulu opsi katalog paling efisien untuk budget tersebut ya...',
      ],
      query
    );
  } else if (intent === 'material_finishing') {
    if (parsed.asksMdfOrParticle) {
      text = pickVariant(
        [
          'Oke kak, pertanyaan bagus banget nih — aku jelasin jujur soal bahan yang dipakai workshop ya...',
          'Siap kak, biar nggak salah pilih bahan ke depannya, aku infoin langsung standar papan di sini ya...',
        ],
        query
      );
    } else {
      text = pickVariant(
        [
          'Oke kak, tunggu sebentar ya, aku siapin perbandingan bahannya biar gampang dibedain...',
          'Siap kak, aku rangkumin dulu karakter masing-masing material & finishing-nya ya...',
          'Baik kak, sebentar ya aku jelasin kelebihan tiap materialnya secara ringkas...',
        ],
        query
      );
    }
  } else if (intent === 'survei_lokasi') {
    text = pickVariant(
      [
        `Sebentar ya kak, aku cekin dulu jadwal tim & jangkauan survei${cityLabel ? ` ke ${cityLabel}` : ''}-nya...`,
        `Oke siap kak, aku lihat dulu daftar area survei aktif kami${cityLabel ? ` untuk daerah ${cityLabel}` : ''} ya...`,
      ],
      query
    );
  } else if (intent === 'pembayaran_termin') {
    text = pickVariant(
      [
        'Oke kak, sebentar ya aku bukain rincian alur DP dan 4 termin pembayarannya...',
        'Siap kak, aku jelasin urutannya pelan-pelan biar jelas dari DP sampai pelunasan ya...',
      ],
      query
    );
  } else if (intent === 'layanan_biaya') {
    text = pickVariant(
      [
        'Oke kak, aku cekin dulu ketentuan layanan workshop soal itu ya...',
        'Siap kak, sebentar ya aku infoin detail layanan desain, ongkir, dan pemasangannya...',
      ],
      query
    );
  } else if (intent === 'promo_katalog') {
    text = pickVariant(
      [
        'Oke kak, sebentar ya aku cekin unit apa aja yang lagi ada potongan promo sekarang...',
        'Siap kak! Tunggu sebentar aku lihat daftar promo aktif di katalog dulu ya...',
      ],
      query
    );
  } else if (intent === 'produk_katalog') {
    const target = prodName || parsed.detectedRoom || 'katalog unitnya';
    text = pickVariant(
      [
        `Oke kak, sebentar aku cekin dulu detail ${target} di katalog studio ya...`,
        `Siap kak, tunggu sebentar ya aku bukain pilihan ${target} yang sesuai...`,
      ],
      query
    );
  } else if (intent === 'warna_palet') {
    text = pickVariant(
      [
        'Oke kak, sebentar ya aku tunjukin koleksi palet warna favorit studio kami...',
        'Siap kak, aku siapin dulu pilihan nuansa warnanya biar bisa dibayangin di ruangan...',
      ],
      query
    );
  } else if (intent === 'alur_kerja' || intent === 'garansi_kebijakan') {
    text = pickVariant(
      [
        'Oke kak, aku rangkumin dulu alur kerja dan jaminan garansinya secara singkat ya...',
        'Siap kak, sebentar aku jelasin step-by-step proses pengerjaannya di workshop...',
      ],
      query
    );
  } else if (intent === 'portofolio_ulasan') {
    text = pickVariant(
      [
        'Oke kak, aku ambilin beberapa contoh hasil proyek nyata & ulasan klien kami dulu ya...',
        'Siap kak, sebentar aku cekin dokumentasi portofolio yang paling mirip kebutuhannya...',
      ],
      query
    );
  } else if (intent === 'tips_berita') {
    text = 'Oke kak, aku bukain dulu panduan perawatan dan artikel terbarunya dari catatan workshop ya...';
  } else if (intent === 'jadwal_kontak' || intent === 'tentang_tim') {
    text = 'Siap kak, aku kirimkan info jam operasional, lokasi workshop, dan profil tim kami ya...';
  } else {
    text = pickVariant(
      [
        'Sebentar ya kak, aku coba cek dulu di data studio soal pertanyaan tadi...',
        'Oke kak, tunggu sebentar aku cariin dulu info yang paling nyambung ya...',
      ],
      query
    );
  }

  return {
    id: `${coreMessage.id}-b1`,
    sender: 'assistant',
    bubbleRole: 'confirmation',
    text,
    createdAt,
    intent: coreMessage.intent,
  };
}

export function buildHumanFollowUpBubble(params: {
  query: string;
  coreMessage: SainAiMessage;
  followUpPrompts: string[];
  context: SainAiConversationContext;
  createdAt: string;
}): SainAiMessage {
  const { query, coreMessage, followUpPrompts, context, createdAt } = params;
  const intent = coreMessage.intent ?? 'fallback';

  let text = '';

  if (intent === 'penutup') {
    text = pickVariant(
      [
        'Oh iya kak, sebelum kita akhiri, ada lagi yang mau ditanyain barangkali?',
        'Kalau suatu saat kepikiran lagi soal ukuran atau warna, chat aku lagi aja ya kak. Ada lagi yang bisa dibantu?',
      ],
      `${query}-${context.turnCount}`
    );
  } else if (coreMessage.needsDirectContact) {
    text = pickVariant(
      [
        'Sambil nunggu koordinasi langsung sama tim via WhatsApp, ada lagi yang mau ditanyain ke aku kak?',
        'Selain itu, kalau ada unit lain yang mau dicek estimasi atau bahannya dulu, ada lagi yang mau ditanyain kak?',
      ],
      `${query}-${context.turnCount}`
    );
  } else if (intent === 'harga_estimasi') {
    text = pickVariant(
      [
        'Ada lagi yang mau ditanyain kak? Misalnya mau bandingin sama Cat Duco, ganti ke PVC, atau cek DP terminnya tinggal pilih di rekomendasi bawah ya.',
        'Kira-kira ada lagi yang mau ditanyain atau mau coba ubah ukuran & bahannya kak? Bisa klik cepat saran di rekomendasi bawah ya.',
        'Gimana kak estimasinya? Kalau ada ukuran lain atau pertanyaan lanjutan, kabarin aja ya — atau pilih saran di rekomendasi bawah.',
      ],
      `${query}-${context.turnCount}`
    );
  } else if (intent === 'material_finishing') {
    text = pickVariant(
      [
        'Ada lagi yang mau ditanyain soal bahannya kak? Kalau mau langsung disimulasiin ke harga unitnya juga boleh banget ya.',
        'Kira-kira lebih cocok ke bahan yang mana nih kak? Ada lagi yang mau ditanyain atau mau lanjut hitung estimasinya?',
      ],
      `${query}-${context.turnCount}`
    );
  } else {
    text = pickVariant(
      [
        'Ada lagi yang mau ditanyain kak? Kalau mau cek hal lain, bisa langsung ketik atau pilih saran di rekomendasi bawah ya.',
        'Masih ada yang bikin penasaran atau mau ditanyain lagi kak? Santai aja tanya ya.',
        'Kira-kira ada lagi yang mau ditanyain kak? Atau mau cek saran topik di rekomendasi bawah sekalian?',
      ],
      `${query}-${context.turnCount}`
    );
  }

  const normalizedPrompts =
    followUpPrompts.length > 0
      ? followUpPrompts
      : [
          'Estimasi kitchen set 250x220 multipleks HPL',
          'Bedanya Blockboard, Multipleks & PVC Board?',
          'Cek wilayah survei & jadwal workshop',
        ];

  return {
    id: `${coreMessage.id}-b3`,
    sender: 'assistant',
    bubbleRole: 'followup',
    text,
    createdAt,
    intent: coreMessage.intent,
    followUpPrompts: normalizedPrompts,
  };
}

export function buildThreeBubbleTurnSequence(params: {
  query: string;
  parsed: ParsedUserQuery;
  coreMessage: SainAiMessage;
  primaryProduct?: ProductItem | null;
  usedContextMemory?: boolean;
  context: SainAiConversationContext;
}): SainAiMessage[] {
  const { query, parsed, coreMessage, primaryProduct, usedContextMemory, context } = params;
  const followUpPrompts = coreMessage.followUpPrompts ?? [];

  const bubble1 = buildHumanConfirmationBubble({
    query,
    parsed,
    coreMessage,
    primaryProduct,
    usedContextMemory,
    context,
    createdAt: coreMessage.createdAt,
  });

  const bubble2: SainAiMessage = {
    ...coreMessage,
    bubbleRole: 'core',
    followUpPrompts: undefined,
  };

  const bubble3 = buildHumanFollowUpBubble({
    query,
    coreMessage,
    followUpPrompts,
    context,
    createdAt: coreMessage.createdAt,
  });

  return [bubble1, bubble2, bubble3];
}
