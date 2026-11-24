import { buildDynamicWhatsAppUrl } from '../store/site-content-store';
import { calculateCatalogVariantPrice } from '../lib/catalog-pricing';
import { sanitizePaymentScheme } from '../lib/payment-scheme';
import { formatCurrencyIDR } from '../lib/price-format';
import { stripNewsImageTags } from '../lib/news-content';
import { computeProductEstimateFromQuery } from './calculator';
import {
  applyConversationContextToQuery,
  INITIAL_CONVERSATION_CONTEXT,
  updateConversationContext,
} from './conversation-context';
import { buildThreeBubbleTurnSequence } from './human-bubble-composer';
import {
  buildKnowledgeBase,
  searchArticlesInKnowledge,
  searchFaqsInKnowledge,
  searchMaterialsInKnowledge,
  searchPortfolioInKnowledge,
  searchProductsInKnowledge,
  toMaterialCard,
  toPortfolioCard,
  toProductCard,
  type SainAiKnowledgeBase,
} from './knowledge-base';
import { classifyUserQuery } from './nlu';
import {
  buildBoardComparisonTable,
  buildBudgetFitPlan,
  buildFinishComparisonTable,
  buildPaymentStageSteps,
  buildPromoCatalogDigest,
  buildSmartFollowUps,
  buildWorkflowSteps,
} from './response-composer';
import type {
  ParsedUserQuery,
  SainAiActionLink,
  SainAiConversationContext,
  SainAiGreetingVariant,
  SainAiMessage,
  SainAiPromptChip,
} from './types';

export const SAIN_AI_STARTER_PROMPTS: SainAiPromptChip[] = [
  {
    id: 'prompt-kitchen-harga',
    topic: 'harga',
    label: 'Harga Kitchen Set 250×220',
    description: 'Simulasi ukuran, material 18 mm & termin DP',
    prompt: 'Estimasi kitchen set 250x220 multipleks HPL',
  },
  {
    id: 'prompt-budget',
    topic: 'budget',
    label: 'Budget 10 Juta Dapat Apa?',
    description: 'Cari unit & ukuran optimal sesuai dana Anda',
    prompt: 'Dengan budget 10 juta cukup untuk apa saja?',
  },
  {
    id: 'prompt-material',
    topic: 'material',
    label: 'Bedanya Multipleks & PVC',
    description: 'Bandingkan ketahanan lembap, keawetan & biaya',
    prompt: 'Apa bedanya Blockboard, Multipleks, dan PVC Board 18 mm?',
  },
  {
    id: 'prompt-survei',
    topic: 'survei',
    label: 'Area & Jadwal Survei',
    description: 'Cek kota jangkauan & jadwal pengukuran lapangan',
    prompt: 'Wilayah mana saja yang masuk area survei dan jam buka workshop?',
  },
  {
    id: 'prompt-promo',
    topic: 'produk',
    label: 'Promo Katalog Aktif',
    description: 'Daftar unit interior dengan potongan harga resmi',
    prompt: 'Produk apa saja yang sedang ada promo saat ini?',
  },
  {
    id: 'prompt-termin',
    topic: 'pembayaran',
    label: 'Skema Termin & Desain',
    description: 'Rincian 4 tahap bayar & syarat Gratis Desain 3D',
    prompt: 'Bagaimana sistem DP termin pembayaran dan syarat gratis desain 3D?',
  },
];

function createMessageId(): string {
  return `sain-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getTimeOfDayGreetingLabel(
  date: Date = new Date()
): 'pagi' | 'siang' | 'sore' | 'malam' {
  const hour = date.getHours();
  if (hour >= 4 && hour < 11) return 'pagi';
  if (hour >= 11 && hour < 15) return 'siang';
  if (hour >= 15 && hour < 18) return 'sore';
  return 'malam';
}

export function createInitialSainAiGreeting(
  kb: SainAiKnowledgeBase,
  now: Date = new Date()
): SainAiMessage {
  const brand = kb.bundle.businessConfig.namaMerek;
  const timeGreeting = getTimeOfDayGreetingLabel(now);
  return {
    id: 'sain-welcome',
    sender: 'assistant',
    bubbleRole: 'greeting',
    createdAt: now.toISOString(),
    intent: 'identitas',
    contextLabel: `Sahabat Interior · ${brand}`,
    text: `Halo, Selamat ${timeGreeting} Sain Ai disini, ada yang bisa dibantu?`,
    followUpPrompts: [
      'Estimasi kitchen set 250x220 multipleks HPL',
      'Budget 10 juta dapat apa?',
      'Bedanya Blockboard, Multipleks & PVC Board?',
    ],
  };
}

function buildWhatsAppConsultAction(
  kb: SainAiKnowledgeBase,
  question: string,
  label = 'Hubungi Tim Langsung via WhatsApp'
): SainAiActionLink {
  const customMessage = `Halo ${kb.bundle.businessConfig.namaMerek}, saya ingin konsultasi lebih lanjut terkait: ${question}`;
  return {
    label,
    href: buildDynamicWhatsAppUrl(kb.bundle.businessConfig, customMessage),
    kind: 'whatsapp',
  };
}

function resolveGreetingPrefix(variant: SainAiGreetingVariant | null, brand: string): string {
  switch (variant) {
    case 'salam':
      return `Waalaikumsalam warahmatullahi wabarakatuh! Terima kasih sudah menghubungi ${brand}. `;
    case 'pagi':
      return `Selamat pagi! Ada rencana furniture atau interior apa yang ingin disiapkan bersama ${brand}? `;
    case 'siang':
      return `Selamat siang! Silakan sampaikan kebutuhan interior Anda bersama ${brand}. `;
    case 'sore':
      return `Selamat sore! Ada rencana penataan ruang yang ingin kami bantu hitung di ${brand}? `;
    case 'malam':
      return `Selamat malam! Walau di luar jam operasional workshop, saya tetap siap membantu hitungan estimasi dan info studio ${brand}. `;
    default:
      return '';
  }
}

function buildSecondaryContextBullets(
  parsed: ParsedUserQuery,
  kb: SainAiKnowledgeBase,
  primaryIntent: string
): string[] {
  const extras: string[] = [];
  const op = kb.bundle.operationalInfo;

  // Jika menanyakan harga/produk sambil menyebut kota
  if (parsed.detectedCity && primaryIntent !== 'survei_lokasi') {
    if (parsed.detectedCity.isCovered) {
      extras.push(
        `Area survei: ${parsed.detectedCity.name} masuk jangkauan rutin kami (${parsed.detectedCity.matchedRegionLabel}).`
      );
    } else {
      extras.push(
        `Catatan wilayah: ${parsed.detectedCity.name} di luar area survei rutin (${op.areaJangkauanSurvei.join(', ')}), perlu koordinasi jadwal khusus.`
      );
    }
  }

  // Jika menyebut bentuk khusus atau hardware (L-shape, Sliding, Soft-close, LED)
  if (parsed.detectedHardwareOrShape.length > 0 && primaryIntent !== 'alur_kerja') {
    extras.push(
      `Preferensi konfigurasi (${parsed.detectedHardwareOrShape.join(', ')}) akan disesuaikan detailnya pada gambar 3D setelah survei pengukuran.`
    );
  }

  // Jika menanyakan gaya desain (Minimalis, Klasik, Japandi, Industrial)
  if (parsed.detectedDesignStyle && primaryIntent !== 'material_finishing') {
    const styleNote =
      parsed.detectedDesignStyle === 'klasik'
        ? 'Untuk gaya klasik/profil berkusen, finishing Cat Duco paling pas karena mulus menutup list profil tanpa garis sambungan.'
        : 'Untuk gaya minimalis/modern/Japandi, pelapis HPL unggul karena pilihan motif kayu & warna matte sangat beragam serta tahan gores.';
    extras.push(styleNote);
  }

  // Jika menyinggung ongkir/pasang sambil bertanya harga
  if (parsed.asksShippingOrInstallFee && primaryIntent !== 'layanan_biaya') {
    extras.push(
      'Pengiriman dan instalasi di area jangkauan rutin (Purwakarta, Karawang, Subang, Bandung Raya, Bekasi) sudah terintegrasi dalam layanan Build.'
    );
  }

  // Jika menyinggung garansi sambil bertanya topik lain
  if (
    parsed.secondaryIntents.includes('garansi_kebijakan') &&
    primaryIntent !== 'garansi_kebijakan' &&
    primaryIntent !== 'alur_kerja'
  ) {
    extras.push(`Garansi studio: ${op.ringkasanGaransi}`);
  }

  return extras;
}

export interface SainAiTurnResult {
  message: SainAiMessage;
  messages: SainAiMessage[];
  nextContext: SainAiConversationContext;
}

export function generateSainAiTurn(params: {
  query: string;
  kb?: SainAiKnowledgeBase;
  context?: SainAiConversationContext;
}): SainAiTurnResult {
  const kb = params.kb ?? buildKnowledgeBase();
  const prevContext = params.context ?? INITIAL_CONVERSATION_CONTEXT;
  const rawParsed = classifyUserQuery(params.query);
  const { enrichedParsed: parsed, inheritedProductId, usedContextMemory } =
    applyConversationContextToQuery(rawParsed, prevContext, kb);

  const nowIso = new Date().toISOString();

  const searchedProducts = searchProductsInKnowledge(
    kb,
    parsed.expandedTokens,
    parsed.normalized,
    parsed.detectedRoom && parsed.intent === 'produk_katalog' ? 4 : 3,
    parsed.detectedRoom
  );
  const inheritedProduct = inheritedProductId
    ? kb.products.find((p) => p.id === inheritedProductId) ?? null
    : null;
  const matchingProducts =
    inheritedProduct && searchedProducts.length === 0
      ? [inheritedProduct]
      : inheritedProduct && parsed.isFollowUpModifier
        ? [inheritedProduct, ...searchedProducts.filter((p) => p.id !== inheritedProduct.id)].slice(0, 3)
        : searchedProducts;

  const matchingFaqs = searchFaqsInKnowledge(kb, parsed.expandedTokens, parsed.normalized, 2);

  const wantsCustomPageExplicitly =
    /\b(halaman\s+custom|perencana\s+custom|buka\s+custom|link\s+custom|kalkulator\s+custom)\b/.test(
      parsed.normalized
    );

  const finalize = (
    message: SainAiMessage,
    primaryProduct?: (typeof kb.products)[number] | null
  ): SainAiTurnResult => {
    const existingActions = message.actions ?? [];
    const actionsWithExplicitCustom =
      wantsCustomPageExplicitly &&
      !existingActions.some((a) => a.to === '/produk/custom')
        ? [
            ...existingActions,
            { label: 'Buka Perencana Custom', to: '/produk/custom', kind: 'route' as const },
          ]
        : existingActions;

    const coreWithRole: SainAiMessage = {
      ...message,
      actions: actionsWithExplicitCustom,
      bubbleRole: 'core',
    };
    const messages = buildThreeBubbleTurnSequence({
      query: params.query,
      parsed,
      coreMessage: coreWithRole,
      primaryProduct,
      usedContextMemory,
      context: prevContext,
    });
    const nextContext = updateConversationContext({
      prev: prevContext,
      parsed,
      reply: coreWithRole,
      primaryProductId: primaryProduct?.id ?? null,
      primaryProductName: primaryProduct?.nama ?? null,
      primaryCategory: primaryProduct?.kategori ?? null,
    });
    return { message: coreWithRole, messages, nextContext };
  };

  // 0. Penanganan permintaan pengecualian khusus di luar standar katalog/Build
  if (parsed.asksCustomException) {
    const isDesignOnly =
      parsed.normalized.includes('desain saja') || parsed.normalized.includes('jasa desain');
    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'pembayaran_termin',
      contextLabel: 'Layanan Khusus · Perlu Konfirmasi Tim',
      text: isDesignOnly
        ? `Pemesanan Build (produksi + pasang) di ${kb.bundle.businessConfig.namaMerek} sudah otomatis Gratis Desain 3D. Untuk kebutuhan jasa desain saja tanpa produksi, ruang lingkup dan tarif gambar kerja disepakati langsung bersama tim perencana kami.`
        : 'Permintaan tersebut berada di luar perhitungan standar katalog otomatis (seperti tukar tambah, reparasi unit eksternal, pembelian lembaran bahan saja, atau penyesuaian skema khusus). Tim workshop kami siap meninjau kebutuhan Anda secara langsung.',
      needsDirectContact: true,
      directContactReason:
        'Kebutuhan di luar paket standar Build memerlukan pengecekan teknis langsung dengan tim studio.',
      actions: [
        buildWhatsAppConsultAction(kb, params.query),
        { label: 'Lihat Syarat & Ketentuan', to: '/syarat-ketentuan', kind: 'route' },
      ],
      followUpPrompts: [
        'Bagaimana kalau pesan Build sekalian produksi?',
        'Lihat skema termin resmi 4 tahap',
      ],
    });
  }

  // 1. Sapaan & Identitas (dengan varian salam & waktu Bahasa Indonesia)
  if (parsed.intent === 'identitas') {
    const brand = kb.bundle.businessConfig.namaMerek;
    const prefix = resolveGreetingPrefix(parsed.greetingVariant, brand);
    const isCapability = parsed.greetingVariant === 'capability';

    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'identitas',
      contextLabel: `Sahabat Interior · ${kb.products.length} Unit Katalog`,
      text: isCapability
        ? `Kenalin kak, aku Sain Ai — asisten digital dari ${brand}. Aku bisa bantuin cek estimasi harga unit custom (${kb.products.length} pilihan katalog), simulasi budget, perbandingan bahan 18 mm, sampai cek jadwal survei ke lokasi kakak.`
        : `${prefix}Aku Sain Ai dari ${brand}. Santai aja ya kak, tinggal ceritain aja lagi cari furniture apa, kira-kira ukurannya berapa (misal 250x220), atau budget yang disiapin — biar langsung aku hitungkan.`,
      bullets: [
        `Lokasi workshop kami di ${kb.bundle.businessConfig.alamat.alamatLengkap}`,
        `Jam layanan: ${kb.bundle.operationalInfo.jamOperasional}`,
        'Setiap pemesanan Build (produksi + pasang) sudah otomatis Gratis Desain 3D ya kak',
      ],
      actions: [{ label: 'Buka Katalog Produk', to: '/produk', kind: 'route' }],
      followUpPrompts: buildSmartFollowUps({
        intent: 'identitas',
        parsed,
        context: prevContext,
      }),
    });
  }

  // 2. Penutup / Ucapan Terima Kasih
  if (parsed.intent === 'penutup') {
    const contextNote = prevContext.lastProductName
      ? ` Kalau nanti jadi lanjut ukur ruangan atau mau cek lagi rincian ${prevContext.lastProductName.split('(')[0].trim()}-nya, tinggal chat aku kapan aja ya.`
      : '';
    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'penutup',
      contextLabel: 'Percakapan Selesai',
      text: `Makasih banyak juga ya kak sudah ngobrol sama aku! Semoga gambarannya membantu buat ngerencanain interior ruangannya.${contextNote}`,
      actions: [],
      followUpPrompts: buildSmartFollowUps({
        intent: 'penutup',
        parsed,
        context: prevContext,
      }),
    });
  }

  // 3. Perencana Anggaran (Budget Planner)
  if (parsed.intent === 'budget_planner') {
    const targetBudget = parsed.budgetIdr ?? prevContext.lastBudgetIdr;
    if (targetBudget) {
      const targetProd = matchingProducts[0] ?? null;
      const plan = buildBudgetFitPlan({
        budgetIdr: targetBudget,
        preferredProduct: targetProd,
        materialId: parsed.materialId ?? prevContext.lastMaterialId,
        finishId: parsed.finishId ?? prevContext.lastFinishId,
        kb,
      });

      const secondaryBullets = buildSecondaryContextBullets(parsed, kb, 'budget_planner');

      return finalize(
        {
          id: createMessageId(),
          sender: 'assistant',
          createdAt: nowIso,
          intent: 'budget_planner',
          contextLabel: `Simulasi Budget · ${formatCurrencyIDR(targetBudget) ?? ''}`,
          text: plan.summaryText,
          bullets: [...plan.bullets, ...secondaryBullets],
          products: plan.recommendedProducts,
          needsDirectContact: !plan.withinStandardProducts,
          directContactReason: !plan.withinStandardProducts
            ? 'Untuk penyesuaian modul khusus sesuai budget Anda, tim kami dapat meracik spesifikasi custom yang paling efisien.'
            : undefined,
          actions: !plan.withinStandardProducts
            ? [buildWhatsAppConsultAction(kb, params.query)]
            : [],
          followUpPrompts: buildSmartFollowUps({
            intent: 'budget_planner',
            parsed,
            context: prevContext,
            primaryProduct: targetProd,
          }),
        },
        targetProd
      );
    }
  }

  // 4. Layanan, Biaya Ongkir/Pasang, Gratis Desain 3D, Referensi Sendiri, & Nego Paket
  if (parsed.intent === 'layanan_biaya') {
    const op = kb.bundle.operationalInfo;
    const bullets: string[] = [];
    let leadText = '';

    if (parsed.asksCustomReference) {
      leadText =
        'Tentu bisa! Anda bebas membawa gambar referensi sendiri (misalnya dari Pinterest, sketsa tangan, atau contoh ruangan) untuk diadaptasikan ke ukuran ruang Anda dengan konstruksi papan 18 mm.';
      bullets.push(
        'Tim kami akan menyesuaikan proporsi, bahan 18 mm (Blockboard/Multipleks/PVC), dan pilihan warna/motif HPL maupun Cat Duco.',
        'Untuk pemesanan Build (produksi + pasang), gambar Desain 3D revisi proporsi ruang sudah termasuk gratis.'
      );
    } else if (parsed.asksNegotiationOrBundle) {
      leadText =
        'Untuk pemesanan beberapa unit sekaligus atau penataan satu rumah/ruangan penuh (full interior), rincian RAB final dihitung berdasarkan total volume aktual hasil survei agar lebih efisien.';
      bullets.push(
        'Saat ini beberapa unit katalog juga memiliki potongan promo resmi yang otomatis berlaku di kalkulator harga.',
        'Kakak bisa sebutkan saja daftar unit beserta perkiraan ukurannya di chat ini supaya aku bantu hitung estimasi awalnya.'
      );
    } else if (parsed.asksShippingOrInstallFee) {
      leadText =
        `Untuk area jangkauan rutin (${op.areaJangkauanSurvei.join(', ')}), layanan survei pengukuran, pengantaran unit, hingga instalasi/pemasangan di lokasi sudah terintegrasi dalam proses pengerjaan Build kami.`;
      bullets.push(
        'Penawaran harga final pada SPKS sudah mencakup unit jadi, hardware bawaan, pengiriman area rutin, serta pemasangan hingga rapi.',
        'Untuk proyek di luar 5 wilayah jangkauan rutin, rute kunjungan dan akomodasi tim dikonfirmasikan terlebih dahulu secara transparan.'
      );
    } else {
      leadText =
        `Setiap pemesanan produksi dan pemasangan (Build) di ${kb.bundle.businessConfig.namaMerek} otomatis mendapatkan Gratis Desain 3D sebelum masuk tahap produksi workshop.`;
      bullets.push(
        'Desain 3D dibuat setelah survei pengukuran presisi di lokasi agar ukuran, jalur kabel, dan stopkontak benar-benar pas.',
        'Pembayaran tetap bertahap 4 termin (DP 30% setelah desain dan RAB disepakati).'
      );
    }

    const extraBullets = buildSecondaryContextBullets(parsed, kb, 'layanan_biaya');

    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'layanan_biaya',
      contextLabel: 'Ketentuan Layanan & Desain 3D',
      text: leadText,
      bullets: [...bullets, ...extraBullets],
      actions: [
        { label: 'Lihat Daftar Promo', to: '/produk', kind: 'route' },
        ...(parsed.asksNegotiationOrBundle
          ? [buildWhatsAppConsultAction(kb, params.query, 'Diskusikan Paket Interior via WhatsApp')]
          : []),
      ],
      followUpPrompts: buildSmartFollowUps({
        intent: 'layanan_biaya',
        parsed,
        context: prevContext,
      }),
    });
  }

  // 5. Ringkasan Promo Katalog
  if (parsed.intent === 'promo_katalog') {
    const { promoProducts, bullets } = buildPromoCatalogDigest(kb);
    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'promo_katalog',
      contextLabel: 'Penawaran Katalog Aktif',
      text: `Kebetulan banget kak, lagi ada ${bullets.length} unit di katalog yang dapat potongan promo resmi (otomatis kepotong juga kalau dihitung di kalkulator harga):`,
      bullets,
      products: promoProducts,
      actions: [],
      followUpPrompts: buildSmartFollowUps({
        intent: 'promo_katalog',
        parsed,
        context: prevContext,
      }),
    });
  }

  // 6. Kalkulator Estimasi Harga (termasuk tanya tarif material per meter / multi-giliran)
  if (parsed.intent === 'harga_estimasi') {
    const isMaterialRateOnlyQuery =
      searchedProducts.length === 0 &&
      !usedContextMemory &&
      !parsed.dimensions &&
      Boolean(parsed.materialId || parsed.finishId);

    if (isMaterialRateOnlyQuery) {
      const matLabel =
        parsed.materialId === 'pvc'
          ? 'PVC Board 18 mm'
          : parsed.materialId === 'blockboard'
            ? 'Blockboard 18 mm'
            : 'Multipleks 18 mm';
      const finLabel = parsed.finishId === 'cat-duco' ? 'Cat Duco' : 'HPL';

      const rateEntries = kb.products.map((prod) => {
        const calc = calculateCatalogVariantPrice({
          product: prod,
          areaSqm: 1,
          lengthCm: 100,
          materialLabel: matLabel,
          finishLabel: finLabel,
          siteCustomPricing: kb.bundle.customPricing,
        });
        return {
          product: prod,
          rate: calc.effectivePerSqmRate,
          isMeterLari: Boolean(prod.meterLari),
        };
      });

      const sqmRates = rateEntries.filter((e) => !e.isMeterLari).map((e) => e.rate);
      const meterRates = rateEntries.filter((e) => e.isMeterLari).map((e) => e.rate);
      const minSqm = sqmRates.length > 0 ? Math.min(...sqmRates) : 0;
      const maxSqm = sqmRates.length > 0 ? Math.max(...sqmRates) : 0;
      const minMeter = meterRates.length > 0 ? Math.min(...meterRates) : 0;
      const maxMeter = meterRates.length > 0 ? Math.max(...meterRates) : 0;

      const sampleHighlightSlugs = ['kitchen-set', 'lemari-pakaian', 'backdrop-tv', 'meja-kerja'];
      const highlightEntries = sampleHighlightSlugs
        .map((slug) =>
          rateEntries.find((e) => e.product.id.toLowerCase().includes(slug))
        )
        .filter((e): e is (typeof rateEntries)[number] => Boolean(e));
      const displayEntries =
        highlightEntries.length > 0 ? highlightEntries : rateEntries.slice(0, 4);

      const bullets: string[] = [];
      if (minSqm > 0) {
        bullets.push(
          `Unit hitung bidang (/m², panjang × tinggi): mulai ${formatCurrencyIDR(minSqm) ?? '-'} sampai ${formatCurrencyIDR(maxSqm) ?? '-'}/m²`
        );
      }
      if (minMeter > 0) {
        bullets.push(
          `Unit hitung memanjang (/m lari): mulai ${formatCurrencyIDR(minMeter) ?? '-'} sampai ${formatCurrencyIDR(maxMeter) ?? '-'}/m lari`
        );
      }
      displayEntries.forEach((entry) => {
        const unit = entry.isMeterLari ? '/m lari' : '/m²';
        bullets.push(
          `${entry.product.nama.split('(')[0].trim()}: ${formatCurrencyIDR(entry.rate) ?? '-'}${unit}`
        );
      });
      bullets.push(
        'Semua tarif di atas sudah termasuk pengerjaan bahan tebal 18 mm, hardware standar, pemasangan di area rutin, dan Gratis Desain 3D untuk order Build ya kak.'
      );

      return finalize({
        id: createMessageId(),
        sender: 'assistant',
        createdAt: nowIso,
        intent: 'harga_estimasi',
        contextLabel: `Tarif ${matLabel} · ${finLabel}`,
        text: `Harga ${matLabel} finishing ${finLabel} di workshop kami dihitung mengikuti jenis unitnya kak — biar lebih kebayang, ini kisaran tarif per meternya:`,
        bullets,
        products: displayEntries.slice(0, 3).map((e) => toProductCard(e.product, kb)),
        actions: [],
        followUpPrompts: [
          `Estimasi kitchen set 250x220 ${parsed.materialId === 'pvc' ? 'pvc' : parsed.materialId === 'blockboard' ? 'blockboard' : 'multipleks'} ${finLabel}`,
          `Estimasi lemari pakaian 200x240 ${parsed.materialId === 'pvc' ? 'pvc' : parsed.materialId === 'blockboard' ? 'blockboard' : 'multipleks'} ${finLabel}`,
          'Bedanya Blockboard, Multipleks & PVC Board?',
        ],
      });
    }

    const primaryProduct = matchingProducts[0] ?? kb.products[0];
    if (primaryProduct) {
      const effectiveMaterial =
        parsed.materialId ?? (parsed.asksCheapOrMin ? 'blockboard' : null);
      const effectiveFinish =
        parsed.finishId ?? (parsed.asksCheapOrMin ? 'hpl' : null);

      const estimate = computeProductEstimateFromQuery({
        product: primaryProduct,
        materialId: effectiveMaterial,
        finishId: effectiveFinish,
        dimensions: parsed.dimensions,
        customPricing: kb.bundle.customPricing,
        paymentScheme: kb.bundle.paymentScheme,
      });

      const contextLead =
        usedContextMemory && inheritedProduct
          ? `Siap kak, ini hitungan lanjutannya untuk ${primaryProduct.nama.split('(')[0].trim()} — `
          : '';

      const cheapTip = parsed.asksCheapOrMin
        ? ' (pakai kombinasi paling hemat yaitu Blockboard 18 mm + HPL)'
        : '';

      const designNote =
        'Kalau order Build (produksi + pasang), sudah otomatis dapat Gratis Desain 3D ya kak; hitungannya pakai satuan ' +
        (primaryProduct.meterLari ? 'meter lari (/m).' : 'luas bidang panjang × tinggi (/m²).');

      const tierBullets: string[] = [designNote];
      if (!effectiveMaterial && !effectiveFinish) {
        const blockCalc = calculateCatalogVariantPrice({
          product: primaryProduct,
          areaSqm: 1,
          lengthCm: 100,
          materialLabel: 'Blockboard 18 mm',
          finishLabel: 'HPL',
          siteCustomPricing: kb.bundle.customPricing,
        });
        const pvcCalc = calculateCatalogVariantPrice({
          product: primaryProduct,
          areaSqm: 1,
          lengthCm: 100,
          materialLabel: 'PVC Board 18 mm',
          finishLabel: 'HPL',
          siteCustomPricing: kb.bundle.customPricing,
        });
        const unitSuff = primaryProduct.meterLari ? '/m' : '/m²';
        tierBullets.push(
          `Sebagai perbandingan opsi bahan lain (finishing HPL): Blockboard 18 mm ${formatCurrencyIDR(blockCalc.effectivePerSqmRate) ?? '-'}${unitSuff} · PVC Board 18 mm ${formatCurrencyIDR(pvcCalc.effectivePerSqmRate) ?? '-'}${unitSuff}.`
        );
      }

      const secondaryBullets = buildSecondaryContextBullets(parsed, kb, 'harga_estimasi');

      return finalize(
        {
          id: createMessageId(),
          sender: 'assistant',
          createdAt: nowIso,
          intent: 'harga_estimasi',
          contextLabel: `Kalkulator Estimasi · ${primaryProduct.kategori}`,
          text: `${contextLead}Estimasi awal untuk ${estimate.productName}${cheapTip} pakai ${estimate.materialLabel} finishing ${estimate.finishLabel} kurang lebih di angka ini kak:`,
          bullets: [...tierBullets, ...secondaryBullets],
          estimate,
          products: matchingProducts.slice(0, 2).map((item) => toProductCard(item, kb)),
          actions: [],
          followUpPrompts: buildSmartFollowUps({
            intent: 'harga_estimasi',
            parsed,
            context: prevContext,
            primaryProduct,
          }),
        },
        primaryProduct
      );
    }
  }

  // 7. Skema Pembayaran & Termin
  if (parsed.intent === 'pembayaran_termin') {
    const scheme = sanitizePaymentScheme(kb.bundle.paymentScheme);
    const refAmount = parsed.budgetIdr ?? prevContext.lastEstimateTotalIdr;
    const steps = buildPaymentStageSteps(kb, refAmount);
    const refText =
      refAmount && prevContext.lastProductName
        ? ` Berikut rinciannya mengacu pada estimasi ${prevContext.lastProductName.split('(')[0].trim()} sebesar ${formatCurrencyIDR(refAmount) ?? ''}:`
        : refAmount
          ? ` Berikut simulasi 4 terminnya berdasarkan nominal ${formatCurrencyIDR(refAmount) ?? ''}:`
          : ` dibagi menjadi ${scheme.tahapan.length} termin bertahap sesuai progres pengerjaan:`;

    const secondaryBullets = buildSecondaryContextBullets(parsed, kb, 'pembayaran_termin');

    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'pembayaran_termin',
      contextLabel: 'Skema Pembayaran Resmi · 4 Termin',
      text: `${scheme.judul}${refText}`,
      steps,
      bullets: [
        scheme.catatan,
        'Untuk pemesanan Build (produksi + pasang), Desain 3D otomatis gratis.',
        ...secondaryBullets,
      ],
      actions: [
        { label: 'Baca FAQ Pembayaran', to: '/faq', kind: 'route' },
        { label: 'Syarat & Ketentuan', to: '/syarat-ketentuan', kind: 'route' },
      ],
      followUpPrompts: buildSmartFollowUps({
        intent: 'pembayaran_termin',
        parsed,
        context: prevContext,
      }),
    });
  }

  // 8. Perbandingan & Spesifikasi Material / Finishing 18 mm
  if (parsed.intent === 'material_finishing') {
    const matchedMaterials = searchMaterialsInKnowledge(
      kb,
      parsed.expandedTokens,
      parsed.normalized,
      parsed.materialId,
      parsed.finishId
    );
    const isWetQuery = /dapur|basah|air|lembap|sink|kamar mandi|vanity|rayap|anti-air|anti-rayap/.test(
      parsed.normalized
    );
    const asksFinishComparison =
      (parsed.finishId !== null || /hpl|duco/.test(parsed.normalized)) &&
      parsed.asksComparison &&
      !parsed.materialId;

    const comparison = asksFinishComparison
      ? buildFinishComparisonTable(kb)
      : parsed.asksComparison || matchedMaterials.length >= 2 || parsed.asksCheapOrMin || parsed.asksBestOrDurable
        ? buildBoardComparisonTable(kb)
        : null;

    let intro =
      'Semua bahan utama kami (Blockboard, Multipleks, dan PVC Board) berketebalan seragam 18 mm, dipadukan dengan pelapis finishing HPL atau Cat Duco.';

    if (parsed.asksMdfOrParticle) {
      intro =
        'Workshop kami TIDAK memakai MDF maupun Particle Board (serbuk kayu) karena rentan mengembang terkena lembap dan sekrup mudah kendur. Seluruh unit dibuat dari papan berketebalan 18 mm yaitu Blockboard, Multipleks, atau PVC Board yang jauh lebih kokoh.';
    } else if (isWetQuery) {
      intro =
        'Seluruh bahan utama memakai ketebalan standar 18 mm. Untuk area dapur bawah (sink), laundry, atau kamar mandi yang lembap/basah, rekomendasi utama adalah PVC Board 18 mm (ketahanan lembap 98/100, anti-rayap), sedangkan kabinet atas/kering ideal memakai Multipleks 18 mm.';
    } else if (parsed.asksCheapOrMin) {
      intro =
        'Untuk opsi paling ekonomis di kelas papan 18 mm, kami sarankan kombinasi Blockboard 18 mm + finishing HPL. Permukaannya rata dan ringan sehingga ideal untuk panel lebar maupun lemari area interior kering.';
    } else if (parsed.asksBestOrDurable) {
      intro =
        'Untuk ketahanan struktur & beban harian terbaik di area kering (kitchen atas, lemari pakaian, rak buku), pilihan paling unggul adalah Multipleks 18 mm. Sedangkan untuk ketahanan maksimal terhadap air dan rayap, pilih PVC Board 18 mm.';
    } else if (asksFinishComparison) {
      intro =
        'Pilihan pelapis akhir di workshop kami terdiri dari HPL (±0,8 mm) dan Cat Duco semprot berlapis. Berikut perbandingan karakteristik keduanya:';
    } else if (parsed.detectedDesignStyle === 'klasik') {
      intro =
        'Untuk konsep klasik atau pintu profil berkusen, finishing Cat Duco di atas papan 18 mm memberikan hasil warna custom yang menyatu mulus tanpa garis sambungan tepi.';
    }

    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'material_finishing',
      contextLabel: 'Spesifikasi Material 18 mm & Finishing',
      text: intro,
      comparison,
      materials: matchedMaterials.map(toMaterialCard),
      actions: [
        { label: 'Buka Panduan Material Lengkap', to: '/tips-interior', kind: 'route' },
      ],
      followUpPrompts: buildSmartFollowUps({
        intent: 'material_finishing',
        parsed,
        context: prevContext,
      }),
    });
  }

  // 9. Survei Lokasi & Cek Kota Jangkauan
  if (parsed.intent === 'survei_lokasi') {
    const op = kb.bundle.operationalInfo;
    const biz = kb.bundle.businessConfig;

    if (parsed.detectedCity && !parsed.detectedCity.isCovered) {
      return finalize({
        id: createMessageId(),
        sender: 'assistant',
        createdAt: nowIso,
        intent: 'survei_lokasi',
        contextLabel: `Luar Jangkauan Rutin · ${parsed.detectedCity.name}`,
        text: `Untuk daerah ${parsed.detectedCity.name}, memang berada di luar 5 area survei rutin kami (${op.areaJangkauanSurvei.join(', ')}) kak. Tapi jangan khawatir, kalau skalanya cocok, tim tetap bisa bantu cek penjadwalan rute khusus atau survei jarak jauh.`,
        bullets: [
          `Wilayah rutin kami saat ini: ${op.areaJangkauanSurvei.join(', ')}`,
          `Workshop: ${biz.alamat.alamatLengkap}`,
        ],
        needsDirectContact: true,
        directContactReason: `Biar tim bisa bantu cek rute khusus dan estimasi akomodasi ke ${parsed.detectedCity.name}, boleh langsung koordinasi via WhatsApp ya kak.`,
        actions: [
          buildWhatsAppConsultAction(kb, `Permintaan survei luar wilayah rutin ke ${parsed.detectedCity.name}`),
          { label: 'Lihat Profil Workshop', to: '/tentang', kind: 'route' },
        ],
        followUpPrompts: [
          'Berapa estimasi produksi jika sudah ada gambar ukuran?',
          'Bagaimana 6 tahap alur pemesanan?',
        ],
      });
    }

    const cityIntro = parsed.detectedCity?.isCovered
      ? `Aman banget kak! Daerah ${parsed.detectedCity.name} sudah masuk area survei & pemasangan rutin kami (${parsed.detectedCity.matchedRegionLabel}). `
      : '';
    const sampleNote = /sampel|contoh/.test(parsed.normalized)
      ? 'Nanti pas tim datang survei, sekalian dibawa juga sampel fisik bahan 18 mm (Blockboard, Multipleks, PVC Board) plus katalog warna HPL & Cat Duco biar kakak bisa pegang langsung.'
      : op.catatanJadwalSurvei;
    const extraNote = op.pengumumanAktif && op.teksPengumuman ? [op.teksPengumuman] : [];

    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'survei_lokasi',
      contextLabel: parsed.detectedCity?.isCovered
        ? `Survei Tersedia · ${parsed.detectedCity.matchedRegionLabel}`
        : 'Jadwal & Wilayah Survei Lapangan',
      text: `${cityIntro}Workshop kami buka setiap ${op.jamOperasional}. ${sampleNote}`,
      bullets: [
        `Area Survei & Pasang Rutin: ${op.areaJangkauanSurvei.join(', ')}`,
        `Alamat Workshop: ${biz.alamat.alamatLengkap}`,
        'Saat survei: tim ukur presisi ruangan, cek jalur listrik/pipa air, & bawa sampel bahan 18 mm',
        ...extraNote,
      ],
      actions: [
        { label: 'Lihat Lokasi & Kontak Workshop', to: '/tentang', kind: 'route' },
      ],
      followUpPrompts: buildSmartFollowUps({
        intent: 'survei_lokasi',
        parsed,
        context: prevContext,
      }),
    });
  }

  // 10. Permintaan Eksplisit Kontak / WhatsApp / Jam Workshop
  if (parsed.intent === 'jadwal_kontak') {
    const op = kb.bundle.operationalInfo;
    const biz = kb.bundle.businessConfig;

    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'jadwal_kontak',
      contextLabel: 'Kontak & Jam Operasional Workshop',
      text: `Workshop ${biz.namaMerek} buka setiap ${op.jamOperasional} di ${biz.alamat.alamatLengkap}.`,
      bullets: [
        `WhatsApp Resmi: ${biz.whatsapp.nomorTampil}`,
        ...(biz.mediaSosial?.akunInstagram
          ? [`Instagram / TikTok: ${biz.mediaSosial.akunInstagram}`]
          : []),
        `Cakupan Survei Rutin: ${op.areaJangkauanSurvei.join(', ')}`,
      ],
      needsDirectContact: parsed.asksDirectContact,
      directContactReason: parsed.asksDirectContact
        ? 'Terhubung langsung dengan admin workshop melalui WhatsApp resmi studio.'
        : undefined,
      actions: [
        ...(parsed.asksDirectContact ? [buildWhatsAppConsultAction(kb, params.query)] : []),
        { label: 'Buka Halaman Tentang & Peta', to: '/tentang', kind: 'route' },
      ],
      followUpPrompts: buildSmartFollowUps({
        intent: 'jadwal_kontak',
        parsed,
        context: prevContext,
      }),
    });
  }

  // 11. Alur 6 Tahap Pengerjaan & Lama Produksi
  if (parsed.intent === 'alur_kerja') {
    const steps = buildWorkflowSteps(kb);
    const asksWarranty = /garansi|purna\s*jual|revisi/.test(parsed.normalized);
    const secondaryBullets = buildSecondaryContextBullets(parsed, kb, 'alur_kerja');
    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'alur_kerja',
      contextLabel: `Alur Kerja ${steps.length} Tahap · ${kb.bundle.operationalInfo.estimasiWaktuProduksi}`,
      text: asksWarranty
        ? `Estimasi produksi di workshop rata-rata ${kb.bundle.operationalInfo.estimasiWaktuProduksi} mengikuti ${steps.length} tahap kerja terstruktur, disertai ${kb.bundle.operationalInfo.ringkasanGaransi}`
        : `Pengerjaan custom interior mengikuti ${steps.length} tahap terstruktur dengan estimasi produksi workshop ${kb.bundle.operationalInfo.estimasiWaktuProduksi}:`,
      steps,
      bullets:
        asksWarranty || secondaryBullets.length > 0
          ? [
              ...(asksWarranty
                ? [`Garansi & Purna Jual: ${kb.bundle.operationalInfo.ringkasanGaransi}`]
                : []),
              ...secondaryBullets,
            ]
          : undefined,
      actions: [{ label: 'Tanya Kita (FAQ)', to: '/faq', kind: 'route' }],
      followUpPrompts: buildSmartFollowUps({
        intent: 'alur_kerja',
        parsed,
        context: prevContext,
      }),
    });
  }

  // 12. Garansi & Kebijakan Layanan
  if (parsed.intent === 'garansi_kebijakan') {
    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'garansi_kebijakan',
      contextLabel: 'Garansi & Standar Kualitas Studio',
      text: kb.bundle.operationalInfo.ringkasanGaransi,
      bullets: kb.bundle.policies.map((pol) => `${pol.judul}: ${pol.ringkasan}`),
      actions: [
        { label: 'Syarat & Ketentuan', to: '/syarat-ketentuan', kind: 'route' },
        { label: 'Kebijakan Privasi', to: '/kebijakan-privasi', kind: 'route' },
      ],
      followUpPrompts: buildSmartFollowUps({
        intent: 'garansi_kebijakan',
        parsed,
        context: prevContext,
      }),
    });
  }

  // 13. Portofolio & Ulasan Klien
  if (parsed.intent === 'portofolio_ulasan') {
    const matchedPortfolio = searchPortfolioInKnowledge(
      kb,
      parsed.expandedTokens,
      parsed.normalized,
      3
    );
    const reviewSnippets = matchedPortfolio
      .filter((item) => item.ulasan?.tampil)
      .map(
        (item) =>
          `Ulasan ${item.ulasan!.namaPengulas} (${item.judul}): “${item.ulasan!.komentar}”`
      );

    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'portofolio_ulasan',
      contextLabel: `Portofolio & Ulasan Klien · ${kb.portfolioProjects.length} Proyek`,
      text: `Berikut referensi hasil pengerjaan nyata workshop dari database portofolio kami (${kb.portfolioProjects.length} proyek terbit):`,
      bullets: reviewSnippets.length > 0 ? reviewSnippets : undefined,
      portfolios: matchedPortfolio.map(toPortfolioCard),
      actions: [{ label: 'Lihat Semua Portofolio', to: '/portofolio', kind: 'route' }],
      followUpPrompts: buildSmartFollowUps({
        intent: 'portofolio_ulasan',
        parsed,
        context: prevContext,
      }),
    });
  }

  // 14. Palet Warna Studio
  if (parsed.intent === 'warna_palet') {
    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'warna_palet',
      contextLabel: `Palet Warna · ${kb.colors.length} Nuansa Resmi`,
      text: `Palet warna standar studio mencakup ${kb.colors.length} nuansa netral hingga arsitektural di bawah ini (dan dapat dikustomisasi kode warna khusus dengan finishing Cat Duco):`,
      colors: kb.colors,
      actions: [{ label: 'Lihat Katalog Produk', to: '/produk', kind: 'route' }],
      followUpPrompts: buildSmartFollowUps({
        intent: 'warna_palet',
        parsed,
        context: prevContext,
      }),
    });
  }

  // 15. Tips Perawatan & Kabar Workshop
  if (parsed.intent === 'tips_berita') {
    const matchedArticles = searchArticlesInKnowledge(
      kb,
      parsed.expandedTokens,
      parsed.normalized,
      2
    );
    const materialTips = kb.materials
      .filter((mat) => Boolean(mat.tipsPerawatan))
      .slice(0, 3)
      .map((mat) => `Perawatan ${mat.nama}: ${mat.tipsPerawatan}`);

    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'tips_berita',
      contextLabel: 'Tips Perawatan & Kabar Workshop',
      text: 'Berikut panduan perawatan material 18 mm serta ringkasan artikel terbaru dari database studio:',
      bullets: [
        ...materialTips,
        ...matchedArticles.map(
          (art) =>
            `${art.judul} (${art.kategori}) — ${art.ringkasan || stripNewsImageTags(art.paragrafKonten[0] ?? '')}`
        ),
      ],
      actions: [
        { label: 'Buka Tips Interior', to: '/tips-interior', kind: 'route' },
        { label: 'Buka Berita Workshop', to: '/berita', kind: 'route' },
      ],
      followUpPrompts: buildSmartFollowUps({
        intent: 'tips_berita',
        parsed,
        context: prevContext,
      }),
    });
  }

  // 16. Tentang Studio & Tim Workshop
  if (parsed.intent === 'tentang_tim') {
    const t = kb.bundle.tentang;
    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'tentang_tim',
      contextLabel: 'Profil Studio & Tim Pengrajin',
      text: `${t.judul} — ${t.pengantar}`,
      bullets: [
        ...t.anggotaTim.map((member) => `${member.nama} · ${member.jabatan}`),
        `Visi: ${t.pernyataanVisi}`,
      ],
      actions: [{ label: 'Lihat Halaman Tentang Kami', to: '/tentang', kind: 'route' }],
      followUpPrompts: buildSmartFollowUps({
        intent: 'tentang_tim',
        parsed,
        context: prevContext,
      }),
    });
  }

  // 17. Katalog Produk, Ruangan & Kelengkapan Hardware
  if (parsed.intent === 'produk_katalog') {
    if (parsed.asksIncludes) {
      const targetProducts =
        matchingProducts.length > 0 ? matchingProducts : kb.products.slice(0, 3);
      const includeBullets = targetProducts.map(
        (item) => `${item.nama}: ${item.include.join(', ')}`
      );
      return finalize(
        {
          id: createMessageId(),
          sender: 'assistant',
          createdAt: nowIso,
          intent: 'produk_katalog',
          contextLabel: 'Kelengkapan Hardware & Aksesoris',
          text: 'Setiap unit di katalog sudah menyertakan kelengkapan hardware & aksesoris bawaan dari workshop (termasuk Gratis Desain 3D untuk pemesanan Build):',
          bullets: includeBullets,
          products: targetProducts.slice(0, 2).map((item) => toProductCard(item, kb)),
          actions: [],
          followUpPrompts: buildSmartFollowUps({
            intent: 'produk_katalog',
            parsed,
            context: prevContext,
            primaryProduct: targetProducts[0],
          }),
        },
        targetProducts[0]
      );
    }

    if (matchingProducts.length > 0) {
      const first = matchingProducts[0];
      const sampleEstimate = parsed.dimensions
        ? computeProductEstimateFromQuery({
            product: first,
            materialId: parsed.materialId ?? prevContext.lastMaterialId,
            finishId: parsed.finishId ?? prevContext.lastFinishId,
            dimensions: parsed.dimensions,
            customPricing: kb.bundle.customPricing,
            paymentScheme: kb.bundle.paymentScheme,
          })
        : null;

      const roomIntro = parsed.detectedRoom
        ? `Untuk area ${parsed.detectedRoom}, berikut ${matchingProducts.length} unit katalog yang paling sesuai (ketebalan papan 18 mm, tersedia HPL & Cat Duco, Gratis Desain 3D untuk pemesanan Build):`
        : `Ditemukan ${matchingProducts.length} unit katalog yang sesuai kebutuhan Anda (ketebalan papan 18 mm, tersedia HPL & Cat Duco, Gratis Desain 3D untuk pemesanan Build):`;

      const secondaryBullets = buildSecondaryContextBullets(parsed, kb, 'produk_katalog');

      return finalize(
        {
          id: createMessageId(),
          sender: 'assistant',
          createdAt: nowIso,
          intent: 'produk_katalog',
          contextLabel: parsed.detectedRoom
            ? `Katalog · ${parsed.detectedRoom}`
            : `Katalog Produk · ${matchingProducts.length} Rekomendasi`,
          text: roomIntro,
          bullets: secondaryBullets.length > 0 ? secondaryBullets : undefined,
          estimate: sampleEstimate,
          products: matchingProducts.map((item) => toProductCard(item, kb)),
          actions: [],
          followUpPrompts: buildSmartFollowUps({
            intent: 'produk_katalog',
            parsed,
            context: prevContext,
            primaryProduct: first,
          }),
        },
        first
      );
    }

    // Jika user menanyakan katalog secara umum ("katalognya ada apa saja?")
    const categoriesSummary = Array.from(new Set(kb.products.map((p) => p.kategori)));
    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'produk_katalog',
      contextLabel: `Daftar Kategori Katalog · ${kb.products.length} Unit`,
      text: `Kami memiliki ${kb.products.length} unit katalog custom di ${categoriesSummary.length} kategori ruang (${categoriesSummary.join(', ')}). Pilih kategori atau ketik unit yang Anda cari:`,
      products: kb.products.slice(0, 3).map((item) => toProductCard(item, kb)),
      actions: [
        { label: `Jelajahi Semua ${kb.products.length} Produk`, to: '/produk', kind: 'route' },
      ],
      followUpPrompts: [
        'Estimasi kitchen set 250x220 multipleks HPL',
        'Rekomendasi lemari pakaian dan harganya',
        'Produk apa saja yang lagi promo?',
      ],
    });
  }

  // 18. Cek kecocokan FAQ sebelum ke Fallback + Eskalasi Kontak Langsung
  if (matchingFaqs.length > 0 && !parsed.asksDirectContact) {
    const primaryFaq = matchingFaqs[0];
    return finalize({
      id: createMessageId(),
      sender: 'assistant',
      createdAt: nowIso,
      intent: 'garansi_kebijakan',
      contextLabel: `Tanya Kita (FAQ) · ${primaryFaq.kategori}`,
      text: primaryFaq.jawaban,
      bullets: matchingFaqs.slice(1).map((f) => `${f.pertanyaan} — ${f.jawaban}`),
      actions: [{ label: 'Buka Halaman Tanya Kita', to: '/faq', kind: 'route' }],
      followUpPrompts: [
        'Estimasi kitchen set 250x220 multipleks HPL',
        'Area jangkauan survei',
      ],
    });
  }

  // 19. Benar-benar tidak ditemukan di database -> Barulah tampilkan tombol Hubungi Langsung
  const minCatalogRate = kb.products.reduce((min, prod) => {
    const rates = [
      ...Object.values(prod.harga?.hpl ?? {}),
      ...Object.values(prod.harga?.duco ?? {}),
    ].filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
    if (rates.length === 0) return min;
    const localMin = Math.min(...rates);
    return min === null ? localMin : Math.min(min, localMin);
  }, null as number | null);
  const lowestExample = formatCurrencyIDR(minCatalogRate ?? 1000000) ?? 'Rp 1.000.000';
  const keywordHint =
    parsed.extractedKeywords.length > 0
      ? ` (kata kunci terdeteksi: ${parsed.extractedKeywords.slice(0, 4).join(', ')})`
      : '';

  return finalize({
    id: createMessageId(),
    sender: 'assistant',
    createdAt: nowIso,
    intent: 'fallback',
    contextLabel: 'Di Luar Cakupan Data Otomatis',
    text: `Mohon maaf banget ya kak, untuk pertanyaan “${params.query}”${keywordHint} aku belum nemu jawaban pastinya di data studio (saat ini data otomatis aku fokus di ${kb.products.length} unit furniture & interior custom mulai ${lowestExample}/satuan). Biar nggak keliru info, kakak bisa langsung ngobrol sama admin workshop kami di WhatsApp ya.`,
    needsDirectContact: true,
    directContactReason:
      'Biar lebih akurat dan nggak salah jawab, boleh langsung konfirmasi ke tim workshop kami ya kak.',
    actions: [
      buildWhatsAppConsultAction(kb, params.query),
      {
        label: 'Cari di Pencarian Situs',
        to: `/pencarian?q=${encodeURIComponent(params.query)}`,
        kind: 'route',
      },
    ],
    followUpPrompts: [
      'Harga Kitchen Set 250x220',
      'Budget 10 juta dapat apa?',
      'Bedanya Multipleks & PVC Board',
    ],
  });
}

export function generateSainAiReply(
  rawQuery: string,
  kbInput?: SainAiKnowledgeBase
): SainAiMessage {
  return generateSainAiTurn({ query: rawQuery, kb: kbInput }).message;
}
