import type { SainAiKnowledgeBase } from './knowledge-base';
import type {
  ParsedUserQuery,
  SainAiConversationContext,
  SainAiIntent,
  SainAiMessage,
} from './types';

export const INITIAL_CONVERSATION_CONTEXT: SainAiConversationContext = {
  lastProductId: null,
  lastProductName: null,
  lastCategory: null,
  lastDimensions: null,
  lastMaterialId: null,
  lastFinishId: null,
  lastBudgetIdr: null,
  lastEstimateTotalIdr: null,
  lastIntent: null,
  userCity: null,
  askedIntents: [],
  consecutiveFallbacks: 0,
  turnCount: 0,
};

const CONTINUATION_NEXT_INTENT: Partial<Record<SainAiIntent, SainAiIntent>> = {
  harga_estimasi: 'pembayaran_termin',
  produk_katalog: 'harga_estimasi',
  material_finishing: 'harga_estimasi',
  pembayaran_termin: 'alur_kerja',
  alur_kerja: 'survei_lokasi',
  survei_lokasi: 'layanan_biaya',
  layanan_biaya: 'alur_kerja',
  portofolio_ulasan: 'harga_estimasi',
};

/**
 * Menggabungkan konteks percakapan sebelumnya agar pertanyaan lanjutan pendek
 * seperti "kalau pakai Cat Duco?", "yang 3 meter berapa?", "kalau blockboard?",
 * "yang paling murah?", atau "dp nya?" tetap nyambung secara berkelanjutan.
 */
export function applyConversationContextToQuery(
  parsed: ParsedUserQuery,
  context: SainAiConversationContext,
  kb: SainAiKnowledgeBase
): {
  enrichedParsed: ParsedUserQuery;
  inheritedProductId: string | null;
  usedContextMemory: boolean;
} {
  let intent = parsed.intent;
  let materialId = parsed.materialId;
  let finishId = parsed.finishId;
  let dimensions = parsed.dimensions;
  let budgetIdr = parsed.budgetIdr;
  let inheritedProductId: string | null = null;
  let usedContextMemory = false;

  const isBareContinuation =
    /^(lanjut|terus|caranya|detailnya|iya|mau|boleh|oke lanjut|selanjutnya|terus gimana)$/i.test(
      parsed.normalized
    );

  if (isBareContinuation && context.lastIntent) {
    intent = CONTINUATION_NEXT_INTENT[context.lastIntent] ?? 'alur_kerja';
    usedContextMemory = true;
  }

  // Jika pengguna menyebut pengubah estimasi ("kalau pakai cat duco", "ukuran 3x2", "ganti pvc", "yang paling murah")
  const hasPreviousProduct = Boolean(context.lastProductId);
  const queryMentionsProductExplicitly = kb.products.some((prod) => {
    const head = prod.nama.toLowerCase().split('(')[0].trim();
    const keywords = head.split(/\s+/).filter((w) => w.length >= 4);
    return keywords.some((kw) => parsed.normalized.includes(kw));
  });

  if (
    hasPreviousProduct &&
    !queryMentionsProductExplicitly &&
    (parsed.isFollowUpModifier ||
      (parsed.asksCheapOrMin && context.lastIntent === 'harga_estimasi') ||
      (intent === 'material_finishing' &&
        !parsed.asksComparison &&
        (materialId || finishId) &&
        (parsed.normalized.includes('kalau') ||
          parsed.normalized.includes('ganti') ||
          parsed.normalized.includes('pakai'))) ||
      (intent === 'harga_estimasi' && context.lastProductId))
  ) {
    inheritedProductId = context.lastProductId;
    usedContextMemory = true;
    if (
      !parsed.asksComparison &&
      (dimensions || materialId || finishId || parsed.isFollowUpModifier || parsed.asksCheapOrMin)
    ) {
      if (intent === 'fallback' || intent === 'material_finishing' || intent === 'produk_katalog') {
        intent = 'harga_estimasi';
      }
    }
  }

  // Jika user meminta versi termurah dari produk terakhir ("yang paling murah?" setelah tanya harga)
  if (
    parsed.asksCheapOrMin &&
    inheritedProductId &&
    intent === 'harga_estimasi' &&
    !materialId &&
    !finishId
  ) {
    materialId = 'blockboard';
    finishId = 'hpl';
    usedContextMemory = true;
  }

  // Warisi material, finishing, dan ukuran terakhir saat menghitung ulang produk yang sama
  if (intent === 'harga_estimasi') {
    if (!inheritedProductId && !queryMentionsProductExplicitly && context.lastProductId) {
      inheritedProductId = context.lastProductId;
      usedContextMemory = true;
    }
    if (!dimensions && context.lastDimensions && (inheritedProductId || queryMentionsProductExplicitly)) {
      dimensions = context.lastDimensions;
      usedContextMemory = true;
    }
    if (!materialId && context.lastMaterialId && (inheritedProductId || !parsed.finishId)) {
      materialId = context.lastMaterialId;
    }
    if (!finishId && context.lastFinishId && (inheritedProductId || !parsed.materialId)) {
      finishId = context.lastFinishId;
    }
  }

  // Jika menanyakan kelengkapan/include setelah membahas suatu produk
  if (parsed.asksIncludes && !queryMentionsProductExplicitly && context.lastProductId) {
    inheritedProductId = context.lastProductId;
    intent = 'produk_katalog';
    usedContextMemory = true;
  }

  // Jika menanyakan termin setelah melihat estimasi harga
  if (intent === 'pembayaran_termin' && !budgetIdr && context.lastEstimateTotalIdr) {
    usedContextMemory = true;
  }

  if (!budgetIdr && context.lastBudgetIdr && intent === 'budget_planner') {
    budgetIdr = context.lastBudgetIdr;
  }

  return {
    enrichedParsed: {
      ...parsed,
      intent,
      materialId,
      finishId,
      dimensions,
      budgetIdr,
    },
    inheritedProductId,
    usedContextMemory,
  };
}

export function updateConversationContext(params: {
  prev: SainAiConversationContext;
  parsed: ParsedUserQuery;
  reply: SainAiMessage;
  primaryProductId?: string | null;
  primaryProductName?: string | null;
  primaryCategory?: string | null;
}): SainAiConversationContext {
  const { prev, parsed, reply, primaryProductId, primaryProductName, primaryCategory } = params;
  const resolvedIntent = reply.intent ?? parsed.intent;
  const askedSet = new Set(prev.askedIntents);
  if (resolvedIntent !== 'fallback' && resolvedIntent !== 'penutup') {
    askedSet.add(resolvedIntent);
  }

  const shouldUpdateSpec = !parsed.asksComparison;

  return {
    lastProductId: primaryProductId ?? prev.lastProductId,
    lastProductName: primaryProductName ?? prev.lastProductName,
    lastCategory: primaryCategory ?? prev.lastCategory,
    lastDimensions: parsed.dimensions ?? prev.lastDimensions,
    lastMaterialId: shouldUpdateSpec
      ? parsed.materialId ?? prev.lastMaterialId
      : prev.lastMaterialId,
    lastFinishId: shouldUpdateSpec
      ? parsed.finishId ?? prev.lastFinishId
      : prev.lastFinishId,
    lastBudgetIdr: parsed.budgetIdr ?? prev.lastBudgetIdr,
    lastEstimateTotalIdr: reply.estimate?.unitPriceNumeric ?? prev.lastEstimateTotalIdr,
    lastIntent: resolvedIntent,
    userCity: parsed.detectedCity?.name ?? prev.userCity,
    askedIntents: Array.from(askedSet),
    consecutiveFallbacks: resolvedIntent === 'fallback' ? prev.consecutiveFallbacks + 1 : 0,
    turnCount: prev.turnCount + 1,
  };
}

export function formatContextSummary(context: SainAiConversationContext): string | null {
  const parts: string[] = [];
  if (context.lastProductName) {
    parts.push(context.lastProductName.split('(')[0].trim());
  }
  if (context.lastDimensions?.rawLabel) {
    parts.push(context.lastDimensions.rawLabel);
  }
  if (context.lastMaterialId) {
    const matLabel =
      context.lastMaterialId === 'pvc'
        ? 'PVC Board 18 mm'
        : context.lastMaterialId === 'multipleks'
          ? 'Multipleks 18 mm'
          : 'Blockboard 18 mm';
    parts.push(matLabel);
  }
  if (context.lastFinishId) {
    parts.push(context.lastFinishId === 'cat-duco' ? 'Cat Duco' : 'HPL');
  }
  if (parts.length === 0 && context.userCity) {
    parts.push(`Lokasi: ${context.userCity}`);
  }
  if (parts.length === 0 && context.lastBudgetIdr) {
    parts.push(`Budget Rp ${(context.lastBudgetIdr / 1_000_000).toFixed(1).replace(/\.0$/, '')} jt`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
