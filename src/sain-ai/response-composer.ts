import {
  calculateCatalogVariantPrice,
  getDefaultProductDimensionsCm,
  resolveCatalogStartingPrice,
} from '../lib/catalog-pricing';
import { calculatePaymentSchemeBreakdown, sanitizePaymentScheme } from '../lib/payment-scheme';
import { formatCurrencyIDR } from '../lib/price-format';
import type { ProductItem } from '../types/product';
import { toProductCard, type SainAiKnowledgeBase } from './knowledge-base';
import type {
  ParsedUserQuery,
  SainAiComparisonTable,
  SainAiConversationContext,
  SainAiIntent,
  SainAiMessage,
  SainAiProductCard,
  SainAiStepItem,
} from './types';

export function buildBoardComparisonTable(
  kb: SainAiKnowledgeBase
): SainAiComparisonTable {
  const boards = kb.materials.filter((m) => m.kategori === 'papan');
  return {
    judul: 'Perbandingan Bahan Papan Utama (Ketebalan Seragam 18 mm)',
    ringkasanRekomendasi:
      'Area bawah bak cuci/lembap wajib pilih PVC Board 18 mm; unit harian & engsel berat pilih Multipleks 18 mm; panel lebar anggaran hemat pilih Blockboard 18 mm.',
    columns: boards.map((mat) => ({
      id: mat.id,
      nama: mat.nama,
      sublabel: 'Tebal 18 mm',
      highlight: mat.id === 'mat-multipleks' || mat.id === 'mat-pvc',
      metrics: [
        { label: 'Tahan Lembap', score: mat.ketahananLembap },
        { label: 'Keawetan', score: mat.peringkatKeawetan },
        { label: 'Ekonomis', score: mat.keterjangkauan },
      ],
      cocokUntuk: (mat.cocokUntuk ?? []).slice(0, 2).join(' · '),
    })),
  };
}

export function buildFinishComparisonTable(
  kb: SainAiKnowledgeBase
): SainAiComparisonTable {
  const finishes = kb.materials.filter((m) => m.kategori === 'finishing');
  return {
    judul: 'Perbandingan Finishing: HPL vs Cat Duco',
    ringkasanRekomendasi:
      'HPL unggul tahan gores harian & produksi lebih cepat; Cat Duco unggul mulus tanpa sambungan tepi serta bebas penyesuaian kode warna.',
    columns: finishes.map((mat) => ({
      id: mat.id,
      nama: mat.nama,
      sublabel: mat.id === 'fin-hpl' ? 'Laminasi ±0,8 mm' : 'Semprot Berlapis',
      highlight: mat.id === 'fin-hpl',
      metrics: [
        { label: 'Tahan Lembap', score: mat.ketahananLembap },
        { label: 'Keawetan', score: mat.peringkatKeawetan },
        { label: 'Ekonomis', score: mat.keterjangkauan },
      ],
      cocokUntuk: (mat.cocokUntuk ?? []).slice(0, 2).join(' · '),
    })),
  };
}

export function buildWorkflowSteps(kb: SainAiKnowledgeBase): SainAiStepItem[] {
  return kb.bundle.beranda.tahapanProses.map((step) => ({
    nomor: step.nomor,
    judul: step.judul,
    deskripsi: step.deskripsi,
    badge: step.id === 'design' ? 'Gratis Build' : undefined,
  }));
}

export function buildPaymentStageSteps(
  kb: SainAiKnowledgeBase,
  referenceTotalIdr?: number | null
): SainAiStepItem[] {
  const scheme = sanitizePaymentScheme(kb.bundle.paymentScheme);
  const breakdown =
    referenceTotalIdr && referenceTotalIdr > 0
      ? calculatePaymentSchemeBreakdown(referenceTotalIdr, scheme)
      : null;

  return scheme.tahapan.map((stage, idx) => {
    const amount = breakdown?.[idx]?.amount;
    const formattedAmount = amount ? formatCurrencyIDR(amount) : null;
    return {
      nomor: `0${stage.urutan}`,
      judul: stage.nama,
      deskripsi: stage.keterangan,
      badge: formattedAmount ? `${stage.persentase}% · ${formattedAmount}` : `${stage.persentase}%`,
    };
  });
}

export function buildPromoCatalogDigest(kb: SainAiKnowledgeBase): {
  promoProducts: SainAiProductCard[];
  bullets: string[];
} {
  const promoEntries = kb.products
    .map((product) => ({
      product,
      starting: resolveCatalogStartingPrice(product, kb.bundle.customPricing),
    }))
    .filter((entry) => entry.starting.promoActive && entry.starting.discountPercentLabel);

  const promoProducts = promoEntries
    .slice(0, 4)
    .map((entry) => toProductCard(entry.product, kb));

  const bullets = promoEntries.slice(0, 6).map((entry) => {
    const unit = entry.product.meterLari ? '/m' : '/m²';
    return `${entry.product.nama}: Hemat ${entry.starting.discountPercentLabel} (${entry.starting.label}${unit})`;
  });

  return { promoProducts, bullets };
}

export function buildBudgetFitPlan(params: {
  budgetIdr: number;
  preferredProduct?: ProductItem | null;
  materialId?: 'blockboard' | 'multipleks' | 'pvc' | null;
  finishId?: 'hpl' | 'cat-duco' | null;
  kb: SainAiKnowledgeBase;
}): {
  summaryText: string;
  bullets: string[];
  recommendedProducts: SainAiProductCard[];
  withinStandardProducts: boolean;
} {
  const { budgetIdr, preferredProduct, materialId, finishId, kb } = params;
  const formattedBudget = formatCurrencyIDR(budgetIdr) ?? `Rp ${budgetIdr}`;
  const matLabel =
    materialId === 'pvc'
      ? 'PVC Board 18 mm'
      : materialId === 'blockboard'
        ? 'Blockboard 18 mm'
        : 'Multipleks 18 mm';
  const finLabel = finishId === 'cat-duco' ? 'Cat Duco' : 'HPL';

  const candidates = preferredProduct ? [preferredProduct] : kb.products;
  const evaluated = candidates
    .map((prod) => {
      const rateCalc = calculateCatalogVariantPrice({
        product: prod,
        areaSqm: 1,
        lengthCm: 100,
        materialLabel: matLabel,
        finishLabel: finLabel,
        siteCustomPricing: kb.bundle.customPricing,
      });
      const defaults = getDefaultProductDimensionsCm(prod);
      const starterCalc = calculateCatalogVariantPrice({
        product: prod,
        areaSqm: defaults.areaSqm,
        lengthCm: defaults.lengthCm,
        materialLabel: matLabel,
        finishLabel: finLabel,
        siteCustomPricing: kb.bundle.customPricing,
      });
      const rate = rateCalc.effectivePerSqmRate || starterCalc.effectivePerSqmRate;
      const achievableUnits = rate > 0 ? Math.floor((budgetIdr / rate) * 10) / 10 : 0;
      return {
        product: prod,
        rate,
        starterPrice: starterCalc.unitPrice,
        achievableUnits,
        unitLabel: prod.meterLari ? 'm lari' : 'm²',
      };
    })
    .filter((entry) => entry.achievableUnits >= 0.8);

  const exactFits = evaluated
    .filter((entry) => entry.starterPrice <= budgetIdr)
    .sort((a, b) => b.starterPrice - a.starterPrice);

  if (preferredProduct && evaluated[0]) {
    const item = evaluated[0];
    const rateFmt = formatCurrencyIDR(item.rate) ?? `Rp ${item.rate}`;
    return {
      summaryText: `Dengan anggaran ${formattedBudget}, untuk ${item.product.nama} (${matLabel}, ${finLabel} · tarif ${rateFmt}/${item.unitLabel === 'm lari' ? 'm' : 'm²'}) Anda bisa memperoleh kapasitas ±${item.achievableUnits} ${item.unitLabel}.`,
      bullets: [
        `Ukuran acuan standar unit ini mulai ${formatCurrencyIDR(item.starterPrice) ?? '-'}`,
        `Jika memakai Blockboard 18 mm + HPL, kapasitas ukuran bisa lebih luas dengan anggaran yang sama`,
        'Pemesanan Build otomatis termasuk Gratis Desain 3D & survei validasi ruang',
      ],
      recommendedProducts: [toProductCard(item.product, kb)],
      withinStandardProducts: item.achievableUnits >= 1,
    };
  }

  const chosen = (exactFits.length > 0 ? exactFits : evaluated).slice(0, 3);
  if (chosen.length === 0) {
    return {
      summaryText: `Dengan anggaran ${formattedBudget}, pilihan katalog custom standar kami dimulai dari unit kompak seperti nakas, rak dinding, atau penyesuaian ukuran modular. Konsultasikan ukuran pasti ruang Anda agar tim kami sesuaikan komposisi material 18 mm terbaik.`,
      bullets: [
        'Memakai Blockboard 18 mm + HPL merupakan kombinasi paling efisien untuk memaksimalkan ukuran',
        'Pembayaran terbagi dalam 4 termin bertahap (DP awal 30%) sehingga arus dana lebih ringan',
      ],
      recommendedProducts: kb.products.slice(0, 2).map((p) => toProductCard(p, kb)),
      withinStandardProducts: false,
    };
  }

  const extraTip =
    budgetIdr >= 18_000_000
      ? 'Dengan dana di atas Rp 18 juta, Anda juga dapat menggabungkan beberapa unit sekaligus dalam satu paket ruangan (misal Kitchen Set + Island Table atau Wardrobe + Meja Rias).'
      : 'Seluruh unit di atas dapat dipecah menjadi 4 termin pembayaran bertahap (DP awal 30%).';

  return {
    summaryText: `Dengan anggaran ${formattedBudget} (acuan ${matLabel} · ${finLabel}), berikut unit katalog yang paling pas dan ukuran maksimal yang dapat dicapai:`,
    bullets: [
      ...chosen.map((entry) => {
        const starterFmt = formatCurrencyIDR(entry.starterPrice) ?? '-';
        return `${entry.product.nama}: cukup hingga ±${entry.achievableUnits} ${entry.unitLabel} (paket acuan mulai ${starterFmt})`;
      }),
      extraTip,
    ],
    recommendedProducts: chosen.map((entry) => toProductCard(entry.product, kb)),
    withinStandardProducts: true,
  };
}

export function buildSmartFollowUps(params: {
  intent: SainAiIntent;
  parsed: ParsedUserQuery;
  context: SainAiConversationContext;
  primaryProduct?: ProductItem | null;
}): string[] {
  const { intent, parsed, context, primaryProduct } = params;
  const prodShort = (primaryProduct?.nama ?? context.lastProductName ?? 'Kitchen set')
    .split('(')[0]
    .trim();
  const alreadyAsked = new Set(context.askedIntents);
  const suggestions: string[] = [];

  if (intent === 'harga_estimasi') {
    if (parsed.finishId !== 'cat-duco') {
      suggestions.push('Custom ukuran / Cat Duco?');
    } else {
      suggestions.push('Kalau pakai HPL berapa?');
    }
    if (parsed.materialId !== 'pvc') {
      suggestions.push('Ganti PVC Board 18 mm?');
    } else {
      suggestions.push('Opsi Blockboard hemat?');
    }
    if (!alreadyAsked.has('pembayaran_termin')) {
      suggestions.push('Simulasi DP & termin?');
    } else if (!alreadyAsked.has('survei_lokasi')) {
      suggestions.push('Jadwal survei lokasi?');
    }
  } else if (intent === 'produk_katalog') {
    suggestions.push(`Custom ${prodShort} 250x220 HPL`);
    suggestions.push('Kelengkapan bawaan unit?');
    if (!alreadyAsked.has('warna_palet')) {
      suggestions.push('Pilihan warna tersedia?');
    }
  } else if (intent === 'material_finishing') {
    suggestions.push(`Hitung custom ${prodShort} PVC`);
    suggestions.push('HPL vs Cat Duco?');
    suggestions.push('Tips rawat HPL & Duco');
  } else if (intent === 'budget_planner') {
    suggestions.push('Blockboard vs Multipleks?');
    suggestions.push('Produk yang lagi promo?');
    suggestions.push('Skema DP 30% & termin?');
  } else if (intent === 'promo_katalog') {
    suggestions.push('Custom kitchen set 250x220');
    suggestions.push('Rekomendasi lemari pakaian');
  } else if (intent === 'layanan_biaya') {
    suggestions.push('Area jangkauan survei?');
    suggestions.push('6 tahap alur pengerjaan?');
    suggestions.push('Custom kitchen set 250x220');
  } else if (intent === 'pembayaran_termin') {
    suggestions.push('6 tahap alur pengerjaan?');
    suggestions.push('Lama produksi & pasang?');
  } else if (intent === 'survei_lokasi') {
    suggestions.push('Tim bawa sampel 18 mm?');
    suggestions.push('Ongkir & pasang gratis?');
  } else if (intent === 'alur_kerja') {
    suggestions.push('Garansi setelah pasang?');
    suggestions.push('Skema termin pembayaran?');
  } else if (intent === 'warna_palet') {
    suggestions.push('Cat Duco warna custom?');
    suggestions.push('Estimasi backdrop TV 240x200');
  } else if (intent === 'penutup') {
    suggestions.push('Promo katalog saat ini');
    suggestions.push('Hitung estimasi unit lain');
  } else {
    suggestions.push('Estimasi kitchen set 250x220');
    suggestions.push('Blockboard, Multipleks & PVC?');
    suggestions.push('Area survei & jam buka');
  }

  return Array.from(new Set(suggestions)).slice(0, 3);
}

export interface RecommendationChipItem {
  id: string;
  label: string;
  prompt: string;
}

/**
 * Mengambil daftar rekomendasi pertanyaan yang aktif untuk ditampilkan di strip rekomendasi.
 * Saat AI masih mengetik (isTyping = true), rekomendasi tetap mempertahankan hasil giliran
 * sebelumnya dan baru berubah setelah seluruh bubble respon AI giliran terbaru selesai dikirim.
 */
export function resolveActiveRecommendations(params: {
  messages: readonly SainAiMessage[];
  isTyping: boolean;
  starterPrompts: readonly RecommendationChipItem[];
}): RecommendationChipItem[] {
  const { messages, isTyping, starterPrompts } = params;

  let searchEndIndex = messages.length;
  if (isTyping) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.sender === 'user') {
        searchEndIndex = i;
        break;
      }
    }
  }

  for (let i = searchEndIndex - 1; i >= 0; i -= 1) {
    const candidate = messages[i];
    if (
      candidate?.sender === 'assistant' &&
      candidate.id !== 'sain-welcome' &&
      candidate.bubbleRole !== 'greeting' &&
      candidate.followUpPrompts &&
      candidate.followUpPrompts.length > 0
    ) {
      return candidate.followUpPrompts.map((promptText, idx) => ({
        id: `${candidate.id}-rec-${idx}`,
        label: promptText,
        prompt: promptText,
      }));
    }
  }

  return [...starterPrompts];
}
