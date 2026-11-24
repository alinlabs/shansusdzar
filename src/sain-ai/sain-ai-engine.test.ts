import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveInitialBubbleVisibility,
  resolveNextBubbleTextTimer,
  resolveNextBubbleTimer,
  SAIN_AI_TEXT_COLLAPSED_MS,
  SAIN_AI_TEXT_EXPANDED_MS,
} from './bubble-scheduler';
import { INITIAL_CONVERSATION_CONTEXT } from './conversation-context';
import {
  clampFloatingChatPosition,
  getDefaultFloatingChatPosition,
} from './drag-bounds';
import {
  createInitialSainAiGreeting,
  generateSainAiReply,
  generateSainAiTurn,
  SAIN_AI_STARTER_PROMPTS,
} from './engine';
import {
  extractBudgetFromText,
  stemIndonesianWord,
} from './fuzzy-matcher';
import { buildKnowledgeBase } from './knowledge-base';
import { classifyUserQuery, extractDimensionsFromQuery } from './nlu';
import { resolveActiveRecommendations } from './response-composer';
import { useSainAiStore } from './sain-ai-store';
import {
  computeSainAiSequenceDelaysMs,
  computeSainAiTypingDelayMs,
  getContextTypingProfile,
  MAX_TYPING_DELAY_MS,
  MIN_TYPING_DELAY_MS,
} from './typing-delay';

const kb = buildKnowledgeBase();

test('bubble scheduler stays persistent on both desktop and mobile, and stops when disabled or open', () => {
  // Desktop: langsung tampil dan tidak pernah auto-hide
  assert.equal(
    resolveInitialBubbleVisibility({
      isOpen: false,
      isMobileViewport: false,
      isBubbleEnabled: true,
    }),
    true
  );
  const desktopVisible = resolveNextBubbleTimer({
    isOpen: false,
    isVisible: true,
    isPausedByPointerOrFocus: false,
    cycleCount: 0,
    isMobileViewport: false,
    isBubbleEnabled: true,
  });
  assert.equal(desktopVisible.action, 'none');
  assert.equal(desktopVisible.delayMs, null);

  const desktopShowIfHidden = resolveNextBubbleTimer({
    isOpen: false,
    isVisible: false,
    isPausedByPointerOrFocus: false,
    cycleCount: 0,
    isMobileViewport: false,
    isBubbleEnabled: true,
  });
  assert.equal(desktopShowIfHidden.action, 'show');
  assert.equal(desktopShowIfHidden.delayMs, 0);

  // Mobile: tetap tampil permanen seperti desktop (tidak muncul-hilang)
  assert.equal(
    resolveInitialBubbleVisibility({
      isOpen: false,
      isMobileViewport: true,
      isBubbleEnabled: true,
    }),
    true
  );
  const mobileVisible = resolveNextBubbleTimer({
    isOpen: false,
    isVisible: true,
    isPausedByPointerOrFocus: false,
    cycleCount: 0,
    isMobileViewport: true,
    isBubbleEnabled: true,
  });
  assert.equal(mobileVisible.action, 'none');
  assert.equal(mobileVisible.delayMs, null);

  const mobileShowIfHidden = resolveNextBubbleTimer({
    isOpen: false,
    isVisible: false,
    isPausedByPointerOrFocus: false,
    cycleCount: 1,
    isMobileViewport: true,
    isBubbleEnabled: true,
  });
  assert.equal(mobileShowIfHidden.action, 'show');
  assert.equal(mobileShowIfHidden.delayMs, 0);

  // Nonaktif dari pengaturan atau saat chat terbuka: selalu mati di desktop maupun mobile
  assert.equal(
    resolveInitialBubbleVisibility({
      isOpen: false,
      isMobileViewport: true,
      isBubbleEnabled: false,
    }),
    false
  );
  assert.equal(
    resolveInitialBubbleVisibility({
      isOpen: true,
      isMobileViewport: true,
      isBubbleEnabled: true,
    }),
    false
  );
  const disabledDecision = resolveNextBubbleTimer({
    isOpen: false,
    isVisible: false,
    isPausedByPointerOrFocus: false,
    cycleCount: 0,
    isMobileViewport: true,
    isBubbleEnabled: false,
  });
  assert.equal(disabledDecision.action, 'none');
  assert.equal(disabledDecision.delayMs, null);
});

test('desktop drag bounds keep floating chat inside viewport margins', () => {
  const viewport = { width: 1440, height: 900 };
  const panel = { width: 400, height: 560 };

  const defaultPos = getDefaultFloatingChatPosition(viewport, panel, 24);
  assert.equal(defaultPos.x, 1440 - 400 - 24);
  assert.equal(defaultPos.y, 900 - 560 - 24);

  const clampedTopLeft = clampFloatingChatPosition({ x: -120, y: -40 }, viewport, panel, 16);
  assert.deepEqual(clampedTopLeft, { x: 16, y: 16 });

  const clampedBottomRight = clampFloatingChatPosition({ x: 2000, y: 1400 }, viewport, panel, 16);
  assert.deepEqual(clampedBottomRight, { x: 1440 - 400 - 16, y: 900 - 560 - 16 });
});

test('NLU extracts dimensions, labeled dimensions, budgets, slang, stems, and typos accurately', () => {
  const cmDims = extractDimensionsFromQuery('estimasi kitchen set 250x220 multipleks hpl');
  assert.equal(cmDims?.lengthCm, 250);
  assert.equal(cmDims?.widthOrHeightCm, 220);
  assert.equal(cmDims?.areaSqm, 5.5);

  const labeledDims = extractDimensionsFromQuery('panjang 3m tinggi 2,2m');
  assert.equal(labeledDims?.lengthCm, 300);
  assert.equal(labeledDims?.widthOrHeightCm, 220);
  assert.equal(labeledDims?.areaSqm, 6.6);

  const meterDims = extractDimensionsFromQuery('island table 3 meter pvc hpl');
  assert.equal(meterDims?.lengthCm, 300);
  assert.equal(meterDims?.lengthMeters, 3);

  assert.equal(stemIndonesianWord('bergaransi'), 'garansi');
  assert.equal(stemIndonesianWord('ukurannya'), 'ukuran');

  const classified = classifyUserQuery('hrg kitchenset 250x220 multipex hpl');
  assert.equal(classified.intent, 'harga_estimasi');
  assert.equal(classified.materialId, 'multipleks');
  assert.equal(classified.finishId, 'hpl');
  assert.ok(classified.extractedKeywords.includes('kitchen'));

  const typoClassified = classifyUserQuery('perbedaan blockboard multipleks pvc');
  assert.equal(typoClassified.intent, 'material_finishing');
  assert.equal(typoClassified.asksComparison, true);

  assert.equal(extractBudgetFromText('punya budget 10 juta'), 10_000_000);
  assert.equal(extractBudgetFromText('dana 8,5jt cukup buat apa?'), 8_500_000);
});

test('engine calculates real kitchen set estimate without premature WhatsApp button', () => {
  const reply = generateSainAiReply('Estimasi kitchen set 250x220 multipleks HPL', kb);
  assert.equal(reply.intent, 'harga_estimasi');
  assert.ok(reply.estimate);
  assert.equal(reply.estimate.totalEstimateFormatted.replace(/\s+/g, ' ').includes('13.750.000'), true);
  assert.equal(reply.estimate.paymentStages.length, 4);
  assert.equal(reply.estimate.paymentStages[0].persentase, 30);
  assert.ok(!reply.needsDirectContact);
  assert.ok(!reply.actions?.some((a) => a.kind === 'whatsapp'));
});

test('multi-turn conversation remembers product, dimensions, material, finish, and cheapest option', () => {
  // Turn 1: Tanya produk umum
  const turn1 = generateSainAiTurn({
    query: 'Saya lagi cari lemari pakaian',
    kb,
    context: INITIAL_CONVERSATION_CONTEXT,
  });
  assert.equal(turn1.message.intent, 'produk_katalog');
  assert.ok(turn1.nextContext.lastProductId?.includes('lemari-pakaian'));

  // Turn 2: Beri ukuran & material singkat -> mewarisi Lemari Pakaian
  const turn2 = generateSainAiTurn({
    query: 'kalau ukuran 200x240 pakai PVC berapa?',
    kb,
    context: turn1.nextContext,
  });
  assert.equal(turn2.message.intent, 'harga_estimasi');
  assert.ok(turn2.message.estimate?.productName.toLowerCase().includes('wardrobe'));
  assert.equal(turn2.message.estimate?.materialLabel, 'PVC Board 18 mm');
  assert.equal(turn2.message.estimate?.dimensionLabel, '200 × 240 cm');

  // Turn 3: Ganti finishing -> mewarisi Lemari Pakaian + 200x240 + PVC Board
  const turn3 = generateSainAiTurn({
    query: 'kalau pakai Cat Duco?',
    kb,
    context: turn2.nextContext,
  });
  assert.equal(turn3.message.intent, 'harga_estimasi');
  assert.equal(turn3.message.estimate?.finishLabel, 'Cat Duco');
  assert.equal(turn3.message.estimate?.materialLabel, 'PVC Board 18 mm');
  assert.equal(turn3.message.estimate?.dimensionLabel, '200 × 240 cm');

  // Turn 4: Tanya termin -> memakai angka estimasi terakhir
  const turn4 = generateSainAiTurn({
    query: 'terminnya?',
    kb,
    context: turn3.nextContext,
  });
  assert.equal(turn4.message.intent, 'pembayaran_termin');
  assert.equal(turn4.message.steps?.length, 4);
  assert.ok(turn4.message.steps?.[0].badge?.includes('Rp'));

  // Turn 5: Minta opsi paling murah -> beralih ke Blockboard + HPL
  const turn5 = generateSainAiTurn({
    query: 'yang paling murah?',
    kb,
    context: turn3.nextContext,
  });
  assert.equal(turn5.message.intent, 'harga_estimasi');
  assert.equal(turn5.message.estimate?.materialLabel, 'Blockboard 18 mm');
  assert.equal(turn5.message.estimate?.finishLabel, 'HPL');
});

test('engine handles material comparison matrix, budget planner, and catalog promos', () => {
  const matReply = generateSainAiReply(
    'Apa bedanya Blockboard, Multipleks, dan PVC Board 18 mm?',
    kb
  );
  assert.equal(matReply.intent, 'material_finishing');
  assert.ok(matReply.comparison);
  assert.equal(matReply.comparison.columns.length, 3);
  assert.ok(!matReply.needsDirectContact);

  const budgetReply = generateSainAiReply('Dengan budget 10 juta cukup untuk apa saja?', kb);
  assert.equal(budgetReply.intent, 'budget_planner');
  assert.ok(budgetReply.products && budgetReply.products.length >= 2);
  assert.ok(!budgetReply.needsDirectContact);

  const promoReply = generateSainAiReply('Produk apa saja yang sedang ada promo?', kb);
  assert.equal(promoReply.intent, 'promo_katalog');
  assert.ok(promoReply.products && promoReply.products.length > 0);
  assert.ok(!promoReply.needsDirectContact);
});

test('engine checks survey coverage accurately and escalates direct contact only when needed', () => {
  const inCoverage = generateSainAiReply('Saya di Cikarang, bisa survei gak?', kb);
  assert.equal(inCoverage.intent, 'survei_lokasi');
  assert.ok(!inCoverage.needsDirectContact);
  assert.ok(!inCoverage.actions?.some((a) => a.kind === 'whatsapp'));

  const outOfCoverage = generateSainAiReply('Lokasi saya di Surabaya, bisa survei?', kb);
  assert.equal(outOfCoverage.intent, 'survei_lokasi');
  assert.equal(outOfCoverage.needsDirectContact, true);
  assert.ok(outOfCoverage.actions?.some((a) => a.kind === 'whatsapp'));

  const designOnly = generateSainAiReply('Kalau mau jasa desain saja tanpa produksi bisa?', kb);
  assert.equal(designOnly.needsDirectContact, true);
  assert.ok(designOnly.actions?.some((a) => a.kind === 'whatsapp'));

  const fallback = generateSainAiReply('apakah jual pesawat luar angkasa?', kb);
  assert.equal(fallback.intent, 'fallback');
  assert.equal(fallback.needsDirectContact, true);
  assert.ok(fallback.actions?.some((a) => a.kind === 'whatsapp'));
});

test('engine answers wet-area material, colors, includes, and closing messages smoothly', () => {
  const wetReply = generateSainAiReply('Bahan apa yang cocok untuk dapur bawah area sink lembap?', kb);
  assert.equal(wetReply.intent, 'material_finishing');
  assert.equal(wetReply.materials?.[0].nama, 'PVC Board');

  const colorReply = generateSainAiReply('Pilihan warna studio apa saja?', kb);
  assert.equal(colorReply.intent, 'warna_palet');
  assert.ok(colorReply.colors && colorReply.colors.length >= 8);

  const closing = generateSainAiReply('makasih banyak sain, sudah jelas', kb);
  assert.equal(closing.intent, 'penutup');
  assert.ok(!closing.needsDirectContact);

  const greeting = createInitialSainAiGreeting(kb, new Date('2026-11-23T09:15:00'));
  assert.equal(greeting.text, 'Halo, Selamat pagi Sain Ai disini, ada yang bisa dibantu?');
  assert.ok(greeting.contextLabel?.includes('Sahabat Interior'));
  assert.equal(createInitialSainAiGreeting(kb, new Date('2026-11-23T13:00:00')).text, 'Halo, Selamat siang Sain Ai disini, ada yang bisa dibantu?');
  assert.equal(createInitialSainAiGreeting(kb, new Date('2026-11-23T16:30:00')).text, 'Halo, Selamat sore Sain Ai disini, ada yang bisa dibantu?');
  assert.equal(createInitialSainAiGreeting(kb, new Date('2026-11-23T21:00:00')).text, 'Halo, Selamat malam Sain Ai disini, ada yang bisa dibantu?');
});

test('engine handles extended Indonesian contexts: greetings, MDF rejection, shipping/3D fees, rooms, multi-intent, and typing delay', () => {
  const salamReply = generateSainAiReply('Assalamualaikum min', kb);
  assert.equal(salamReply.intent, 'identitas');
  assert.ok(salamReply.text.includes('Waalaikumsalam'));

  const mdfReply = generateSainAiReply('pakai mdf atau particle board gak?', kb);
  assert.equal(mdfReply.intent, 'material_finishing');
  assert.ok(mdfReply.text.toLowerCase().includes('tidak memakai mdf'));

  const shippingReply = generateSainAiReply('ongkir dan pemasangan sudah termasuk gratis?', kb);
  assert.equal(shippingReply.intent, 'layanan_biaya');
  assert.ok(!shippingReply.needsDirectContact);

  const pinterestReply = generateSainAiReply('bisa bawa gambar referensi sendiri dari pinterest?', kb);
  assert.equal(pinterestReply.intent, 'layanan_biaya');
  assert.ok(pinterestReply.text.toLowerCase().includes('pinterest'));

  const roomReply = generateSainAiReply('butuh furniture untuk kamar tidur apa saja?', kb);
  assert.equal(roomReply.intent, 'produk_katalog');
  assert.ok(roomReply.products && roomReply.products.length >= 2);

  const multiIntentReply = generateSainAiReply(
    'hrg kitchenset panjang 3m tinggi 2,2m multiplek hpl sekalian bisa survei cikarang?',
    kb
  );
  assert.equal(multiIntentReply.intent, 'harga_estimasi');
  assert.ok(multiIntentReply.estimate);
  assert.ok(
    multiIntentReply.bullets?.some((b) => b.toLowerCase().includes('cikarang')),
    'Multi-intent reply should include Cikarang coverage bullet'
  );

  // Human CPM & per-bubble delay scales realistically by context and complexity
  const casualProfile = getContextTypingProfile('penutup');
  const estimateProfile = getContextTypingProfile('harga_estimasi');
  assert.ok(casualProfile.humanCpm > estimateProfile.humanCpm);
  assert.ok(estimateProfile.thinkMs > casualProfile.thinkMs);

  const shortDelay = computeSainAiTypingDelayMs(closingMessageMock());
  const richDelay = computeSainAiTypingDelayMs(multiIntentReply);
  assert.ok(shortDelay >= MIN_TYPING_DELAY_MS && shortDelay <= MAX_TYPING_DELAY_MS);
  assert.ok(richDelay >= MIN_TYPING_DELAY_MS && richDelay <= MAX_TYPING_DELAY_MS);
  assert.ok(richDelay > shortDelay, `Expected richDelay (${richDelay}) > shortDelay (${shortDelay})`);
});

function closingMessageMock() {
  return generateSainAiReply('makasih sain', kb);
}

test('every turn emits 3 humble human bubbles (confirmation, core, followup) with valid context-CPM sequence delays and answers material per-meter inquiries', () => {
  const blockboardTurn = generateSainAiTurn({
    query: 'berapa harga blockboard hpl per meter',
    kb,
  });
  assert.equal(blockboardTurn.messages.length, 3);
  assert.equal(blockboardTurn.messages[0].bubbleRole, 'confirmation');
  assert.equal(blockboardTurn.messages[1].bubbleRole, 'core');
  assert.equal(blockboardTurn.messages[2].bubbleRole, 'followup');
  assert.ok(blockboardTurn.messages[0].text.toLowerCase().includes('blockboard'));
  assert.ok(blockboardTurn.messages[1].text.toLowerCase().includes('blockboard 18 mm'));
  assert.ok(!blockboardTurn.messages[1].text.includes('Partisi'));
  assert.ok(blockboardTurn.messages[1].bullets?.some((b) => b.includes('/m²')));
  assert.ok(
    blockboardTurn.messages[2].followUpPrompts &&
      blockboardTurn.messages[2].followUpPrompts.length >= 2
  );

  const estimateDelays = computeSainAiSequenceDelaysMs(blockboardTurn.messages);
  assert.equal(estimateDelays.length, 3);
  assert.ok(estimateDelays[0] >= 1150 && estimateDelays[0] <= 2800);
  assert.ok(estimateDelays[1] >= 2100 && estimateDelays[1] <= MAX_TYPING_DELAY_MS);
  assert.ok(estimateDelays[2] >= 1300 && estimateDelays[2] <= 3100);
  assert.ok(
    estimateDelays[1] > estimateDelays[0] && estimateDelays[1] > estimateDelays[2],
    `Expected core delay (${estimateDelays[1]}) > confirmation (${estimateDelays[0]}) and followup (${estimateDelays[2]})`
  );

  // Even closing and fallback turns always send 3 bubbles, and casual context is faster than estimate context
  const closingTurn = generateSainAiTurn({ query: 'makasih banyak ya', kb });
  assert.equal(closingTurn.messages.length, 3);
  assert.equal(closingTurn.messages[0].bubbleRole, 'confirmation');
  assert.equal(closingTurn.messages[1].bubbleRole, 'core');
  assert.equal(closingTurn.messages[2].bubbleRole, 'followup');

  const closingDelays = computeSainAiSequenceDelaysMs(closingTurn.messages);
  const totalEstimateMs = estimateDelays.reduce((a, b) => a + b, 0);
  const totalClosingMs = closingDelays.reduce((a, b) => a + b, 0);
  assert.ok(
    totalEstimateMs > totalClosingMs,
    `Expected estimate turn (${totalEstimateMs}ms) > closing turn (${totalClosingMs}ms)`
  );

  const fallbackTurn = generateSainAiTurn({ query: 'jual kapal selam?', kb });
  assert.equal(fallbackTurn.messages.length, 3);
  assert.equal(fallbackTurn.messages[1].needsDirectContact, true);
  assert.ok(
    fallbackTurn.messages[2].followUpPrompts &&
      fallbackTurn.messages[2].followUpPrompts.length >= 2
  );
});

test('floating bubble text scheduler stays expanded 7s, collapses for 15s leaving mascot only, then re-expands', () => {
  assert.equal(SAIN_AI_TEXT_EXPANDED_MS, 7000);
  assert.equal(SAIN_AI_TEXT_COLLAPSED_MS, 15000);

  const collapseDecision = resolveNextBubbleTextTimer({
    isOpen: false,
    isBubbleEnabled: true,
    isTextExpanded: true,
    isPausedByPointerOrFocus: false,
  });
  assert.deepEqual(collapseDecision, { nextExpanded: false, delayMs: 7000 });

  const expandDecision = resolveNextBubbleTextTimer({
    isOpen: false,
    isBubbleEnabled: true,
    isTextExpanded: false,
    isPausedByPointerOrFocus: false,
  });
  assert.deepEqual(expandDecision, { nextExpanded: true, delayMs: 15000 });

  const pausedHover = resolveNextBubbleTextTimer({
    isOpen: false,
    isBubbleEnabled: true,
    isTextExpanded: true,
    isPausedByPointerOrFocus: true,
  });
  assert.equal(pausedHover.delayMs, null);

  const whenChatOpen = resolveNextBubbleTextTimer({
    isOpen: true,
    isBubbleEnabled: true,
    isTextExpanded: true,
  });
  assert.equal(whenChatOpen.delayMs, null);
});

test('standard replies stop at product cards without unsolicited /produk/custom buttons unless explicitly requested', () => {
  const sampleQueries = [
    'makasih banyak ya',
    'Saya lagi cari lemari pakaian',
    'Estimasi kitchen set 250x220 multipleks HPL',
    'Dengan budget 10 juta cukup untuk apa saja?',
    'Produk apa saja yang sedang ada promo?',
    'Saya di Cikarang, bisa survei gak?',
  ];

  for (const query of sampleQueries) {
    const turn = generateSainAiTurn({ query, kb });
    const hasCustomLink = turn.messages.some((msg) =>
      msg.actions?.some((act) => act.to === '/produk/custom')
    );
    assert.equal(
      hasCustomLink,
      false,
      `Query "${query}" should not auto-attach /produk/custom button`
    );
  }

  const catalogTurn = generateSainAiTurn({ query: 'Saya lagi cari lemari pakaian', kb });
  assert.ok(catalogTurn.messages[1].products && catalogTurn.messages[1].products.length > 0);
  assert.ok(
    catalogTurn.messages[2].followUpPrompts?.some((p) => p.toLowerCase().includes('custom'))
  );

  const explicitTurn = generateSainAiTurn({ query: 'buka halaman custom kitchen set', kb });
  assert.ok(
    explicitTurn.messages[1].actions?.some((act) => act.to === '/produk/custom'),
    'Explicit request for custom page should attach /produk/custom route'
  );
});

test('recommendations hold previous turn suggestions while typing and update only when all AI bubbles complete', () => {
  const welcome = createInitialSainAiGreeting(kb);
  const turn1 = generateSainAiTurn({ query: 'Saya lagi cari lemari pakaian', kb });
  const turn2 = generateSainAiTurn({
    query: 'kalau ukuran 200x240 pakai PVC berapa?',
    kb,
    context: turn1.nextContext,
  });

  const user1 = {
    id: 'u1',
    sender: 'user' as const,
    text: 'Saya lagi cari lemari pakaian',
    createdAt: new Date().toISOString(),
  };
  const user2 = {
    id: 'u2',
    sender: 'user' as const,
    text: 'kalau ukuran 200x240 pakai PVC berapa?',
    createdAt: new Date().toISOString(),
  };

  // Awal: starter prompts
  assert.deepEqual(
    resolveActiveRecommendations({
      messages: [welcome],
      isTyping: false,
      starterPrompts: SAIN_AI_STARTER_PROMPTS,
    }).map((c) => c.prompt),
    SAIN_AI_STARTER_PROMPTS.map((c) => c.prompt)
  );

  // Giliran 1 sedang mengetik (baru B1 & B2 yang keluar): tetap starter prompts
  assert.deepEqual(
    resolveActiveRecommendations({
      messages: [welcome, user1, turn1.messages[0], turn1.messages[1]],
      isTyping: true,
      starterPrompts: SAIN_AI_STARTER_PROMPTS,
    }).map((c) => c.prompt),
    SAIN_AI_STARTER_PROMPTS.map((c) => c.prompt)
  );

  // Giliran 1 selesai semua (B3 sudah keluar & isTyping = false): berubah ke followUp giliran 1
  const afterTurn1 = resolveActiveRecommendations({
    messages: [welcome, user1, ...turn1.messages],
    isTyping: false,
    starterPrompts: SAIN_AI_STARTER_PROMPTS,
  }).map((c) => c.prompt);
  assert.deepEqual(afterTurn1, turn1.messages[2].followUpPrompts);

  // Giliran 2 sedang mengetik (baru B1 & B2 giliran 2 yang keluar): MASIH tahan rekomendasi giliran 1
  const midTurn2 = resolveActiveRecommendations({
    messages: [welcome, user1, ...turn1.messages, user2, turn2.messages[0], turn2.messages[1]],
    isTyping: true,
    starterPrompts: SAIN_AI_STARTER_PROMPTS,
  }).map((c) => c.prompt);
  assert.deepEqual(midTurn2, turn1.messages[2].followUpPrompts);

  // Giliran 2 selesai semua (B3 keluar & isTyping = false): barulah berubah ke followUp giliran 2
  const afterTurn2 = resolveActiveRecommendations({
    messages: [welcome, user1, ...turn1.messages, user2, ...turn2.messages],
    isTyping: false,
    starterPrompts: SAIN_AI_STARTER_PROMPTS,
  }).map((c) => c.prompt);
  assert.deepEqual(afterTurn2, turn2.messages[2].followUpPrompts);
  assert.notDeepEqual(afterTurn2, afterTurn1);
});

test('useSainAiStore blocks concurrent sendMessage and openChat prompt while AI is still typing', () => {
  const prevWindow = (globalThis as Record<string, unknown>).window;
  const scheduled: Array<{ fn: () => void; ms: number; cleared: boolean }> = [];

  (globalThis as Record<string, unknown>).window = {
    setTimeout(fn: () => void, ms: number) {
      const idx = scheduled.push({ fn, ms, cleared: false });
      return idx;
    },
    clearTimeout(id: number) {
      const entry = scheduled[id - 1];
      if (entry) entry.cleared = true;
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  };

  try {
    useSainAiStore.getState().resetConversation();
    assert.equal(useSainAiStore.getState().isTyping, false);

    useSainAiStore.getState().sendMessage('Saya lagi cari lemari pakaian');
    assert.equal(useSainAiStore.getState().isTyping, true);
    assert.equal(
      useSainAiStore.getState().messages.filter((m) => m.sender === 'user').length,
      1
    );

    // Mencoba kirim lagi atau trigger lewat openChat saat masih mengetik -> harus ditolak
    useSainAiStore.getState().sendMessage('Pertanyaan sela saat loading');
    useSainAiStore.getState().openChat('Prompt sela dari luar');
    assert.equal(
      useSainAiStore.getState().messages.filter((m) => m.sender === 'user').length,
      1,
      'User message count must remain 1 while AI response is still in progress'
    );
    assert.equal(useSainAiStore.getState().isTyping, true);

    // Jalankan berurutan ketiga timer bubble respon AI
    let cursor = 0;
    while (cursor < scheduled.length) {
      const task = scheduled[cursor];
      cursor += 1;
      if (!task.cleared) task.fn();
    }

    assert.equal(useSainAiStore.getState().isTyping, false);
    assert.equal(useSainAiStore.getState().messages.length, 5); // welcome + user1 + 3 AI bubbles

    // Setelah selesai lengkap, barulah kirim pesan baru diperbolehkan
    useSainAiStore.getState().sendMessage('Berapa lama produksinya?');
    assert.equal(useSainAiStore.getState().isTyping, true);
    assert.equal(
      useSainAiStore.getState().messages.filter((m) => m.sender === 'user').length,
      2
    );

    useSainAiStore.getState().resetConversation();
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = prevWindow;
    }
  }
});
