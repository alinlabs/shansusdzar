import test from 'node:test';
import assert from 'node:assert/strict';
import produkJson from '../../src/data/produk.json';
import {
  INDICATIVE_ESTIMATE_CONFIG,
  INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  calculateAreaSquareMeters,
  calculateCustomCostDetails,
  calculateCustomEstimate,
  calculateIndicativeDeliveryFee,
  calculateIndicativeDesign3dFee,
  calculateIndicativeSurveyFee,
  calculateLengthMeters,
  getCustomStartingRates,
  resolveProductPricingCategory,
} from '../../src/lib/custom-pricing';
import { resolveProductPromoMarkup } from '../../src/lib/catalog-pricing';
import type { RoomDimensionsInput } from '../../src/types/cart';
import type { ProductItem } from '../../src/types/product';

const SAMPLE_DIM: RoomDimensionsInput = {
  length: 300,
  width: 200,
  height: null,
  unit: 'cm',
  normalizedLengthCm: 300,
  normalizedWidthCm: 200,
  normalizedHeightCm: null,
};

test('calculateAreaSquareMeters and calculateLengthMeters compute normalized dimensions accurately', () => {
  assert.equal(calculateAreaSquareMeters(SAMPLE_DIM), 6);
  assert.equal(calculateLengthMeters(SAMPLE_DIM), 3);
});

test('resolveProductPricingCategory maps product names and slugs into the 5 tariff groups', () => {
  assert.equal(resolveProductPricingCategory('Lemari Pakaian 3 Pintu'), 'lemari');
  assert.equal(resolveProductPricingCategory('Kitchen Set Minimalis'), 'kitchen-set');
  assert.equal(resolveProductPricingCategory('Backdrop TV & Credenza'), 'backdrop-tv');
  assert.equal(resolveProductPricingCategory('Wall Panel Kisi-Kisi Dinding'), 'backdrop-tv');
  assert.equal(resolveProductPricingCategory('Meja Kerja & Belajar'), 'meja');
  assert.equal(resolveProductPricingCategory('Sekat Ruangan / Partisi Kisi'), 'sekat-partisi');
});

test('calculateCustomEstimate returns contact-only when pricing is not configured', () => {
  const result = calculateCustomEstimate({
    itemTypeId: 'kitchen-set',
    materialId: 'multipleks',
    finishId: 'hpl',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: ['soft-close'],
    quantity: 2,
  });

  assert.equal(result.status, 'contact');
  assert.equal(result.serviceMode, 'design-and-build');
  assert.equal(result.designAmount, 0);
  assert.equal(result.estimatedUnitTotal, null);
  assert.equal(result.estimatedLineTotal, null);
  assert.equal(result.estimatedDpUnitAmount, null);
  assert.equal(result.estimatedDpLineTotal, null);
  assert.ok(result.disclaimer.includes('Gratis Desain 3D'));
});

test('calculateCustomEstimate supports fallback additive rules when tarifPerKategori is omitted', () => {
  const result = calculateCustomEstimate({
    itemTypeId: 'sekat-partisi',
    materialId: 'multipleks',
    finishId: 'hpl',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: ['soft-close'],
    quantity: 2,
    pricingConfig: {
      mataUang: 'IDR',
      persentaseDp: 30,
      hargaCustomTerkonfigurasi: true,
    },
    rules: {
      hargaBahanPerMeterPersegi: { multipleks: 2100000 },
      hargaFinishingPerMeterPersegi: { 'hpl': 400000 },
      biayaTambahanOpsi: { 'soft-close': 500000 },
    },
  });

  // sekat-partisi -> m2 (6 m2 * 2,500,000) + 500,000 = 15,500,000 per unit
  assert.equal(result.status, 'configured');
  assert.equal(result.pricingUnit, 'm2');
  assert.equal(result.unitRate, 2500000);
  assert.equal(result.designAmount, 0);
  assert.equal(result.buildAmount, 15000000);
  assert.equal(result.optionsAmount, 500000);
  assert.equal(result.estimatedUnitTotal, 15500000);
  assert.equal(result.estimatedLineTotal, 31000000);
  assert.equal(result.dpPercentage, 30);
  assert.equal(result.estimatedDpUnitAmount, 4650000);
  assert.equal(result.estimatedDpLineTotal, 9300000);
});

test('indicative workshop rules compute exact 5-category Design & Build m² rates (Panjang x Tinggi) with Gratis Desain 3D', () => {
  // 1. Kitchen Set (/m2): 300 x 200 cm = 6 m2
  const kitchenBlockboardHpl = calculateCustomEstimate({
    itemTypeId: 'kitchen-set',
    materialId: 'blockboard',
    finishId: 'hpl',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: [],
    quantity: 1,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  });
  assert.equal(kitchenBlockboardHpl.pricingUnit, 'm2');
  assert.equal(kitchenBlockboardHpl.measureQuantity, 6);
  assert.equal(kitchenBlockboardHpl.unitRate, 1800000);
  assert.equal(kitchenBlockboardHpl.designAmount, 0);
  assert.equal(kitchenBlockboardHpl.estimatedUnitTotal, 6 * 1800000);

  // Changing Tinggi (width cm) changes total price proportionally
  const kitchenShorterHeight = calculateCustomEstimate({
    itemTypeId: 'kitchen-set',
    materialId: 'blockboard',
    finishId: 'hpl',
    dimensions: {
      ...SAMPLE_DIM,
      width: 100,
      normalizedWidthCm: 100,
    },
    additionalOptionIds: [],
    quantity: 1,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  });
  assert.equal(kitchenShorterHeight.measureQuantity, 3);
  assert.equal(kitchenShorterHeight.estimatedUnitTotal, 3 * 1800000);

  const kitchenMultiplexHpl = calculateCustomEstimate({
    itemTypeId: 'kitchen-set',
    materialId: 'multipleks',
    finishId: 'hpl',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: [],
    quantity: 1,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  });
  assert.equal(kitchenMultiplexHpl.estimatedUnitTotal, 6 * 2500000);

  const kitchenPvcHpl = calculateCustomEstimate({
    itemTypeId: 'kitchen-set',
    materialId: 'pvc',
    finishId: 'hpl',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: [],
    quantity: 1,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  });
  assert.equal(kitchenPvcHpl.estimatedUnitTotal, 6 * 3500000);

  // Cat Duco applies uniformly 4.500.000/m2 regardless of base board
  for (const mat of ['blockboard', 'multipleks', 'pvc']) {
    const kitchenDuco = calculateCustomEstimate({
      itemTypeId: 'kitchen-set',
      materialId: mat,
      finishId: 'cat-duco',
      dimensions: SAMPLE_DIM,
      additionalOptionIds: ['soft-close', 'survei-lokasi'],
      quantity: 1,
      pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
      rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
    });
    assert.equal(kitchenDuco.unitRate, 4500000);
    assert.equal(kitchenDuco.designAmount, 0);
    assert.equal(kitchenDuco.optionsAmount, 0);
    assert.equal(kitchenDuco.estimatedUnitTotal, 6 * 4500000);
  }

  // 2. Backdrop TV (/m2): 6 m2 * (1.0M / 1.5M / 2.0M / 4.5M)
  assert.equal(
    calculateCustomEstimate({
      itemTypeId: 'backdrop-tv',
      materialId: 'blockboard',
      finishId: 'hpl',
      dimensions: SAMPLE_DIM,
      additionalOptionIds: [],
      quantity: 1,
      pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
      rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
    }).estimatedUnitTotal,
    6 * 1000000
  );
  assert.equal(
    calculateCustomEstimate({
      itemTypeId: 'backdrop-tv',
      materialId: 'multipleks',
      finishId: 'hpl',
      dimensions: SAMPLE_DIM,
      additionalOptionIds: [],
      quantity: 1,
      pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
      rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
    }).estimatedUnitTotal,
    6 * 1500000
  );
  assert.equal(
    calculateCustomEstimate({
      itemTypeId: 'backdrop-tv',
      materialId: 'pvc',
      finishId: 'hpl',
      dimensions: SAMPLE_DIM,
      additionalOptionIds: [],
      quantity: 1,
      pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
      rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
    }).estimatedUnitTotal,
    6 * 2000000
  );

  // 3. Sekat Ruangan / Partisi (/m2): 6 m2 * (2.5M / 2.5M / 3.5M / 4.5M)
  const partisiBlockboard = calculateCustomEstimate({
    itemTypeId: 'panel-partisi',
    materialId: 'blockboard',
    finishId: 'hpl',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: [],
    quantity: 1,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  });
  assert.equal(partisiBlockboard.pricingUnit, 'm2');
  assert.equal(partisiBlockboard.measureQuantity, 6);
  assert.equal(partisiBlockboard.estimatedUnitTotal, 6 * 2500000);

  assert.equal(
    calculateCustomEstimate({
      itemTypeId: 'panel-partisi',
      materialId: 'multipleks',
      finishId: 'hpl',
      dimensions: SAMPLE_DIM,
      additionalOptionIds: [],
      quantity: 1,
      pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
      rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
    }).estimatedUnitTotal,
    6 * 2500000
  );
  assert.equal(
    calculateCustomEstimate({
      itemTypeId: 'panel-partisi',
      materialId: 'pvc',
      finishId: 'hpl',
      dimensions: SAMPLE_DIM,
      additionalOptionIds: [],
      quantity: 1,
      pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
      rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
    }).estimatedUnitTotal,
    6 * 3500000
  );
  assert.equal(
    calculateCustomEstimate({
      itemTypeId: 'panel-partisi',
      materialId: 'pvc',
      finishId: 'cat-duco',
      dimensions: SAMPLE_DIM,
      additionalOptionIds: [],
      quantity: 1,
      pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
      rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
    }).estimatedUnitTotal,
    6 * 4500000
  );
});

test('getCustomStartingRates returns lowest linear /m, partition /m2, and Gratis Desain (0)', () => {
  const disabled = getCustomStartingRates(
    { ...INDICATIVE_ESTIMATE_CONFIG, hargaCustomTerkonfigurasi: false },
    INDICATIVE_WORKSHOP_ESTIMATE_RULES
  );
  assert.deepEqual(disabled, {
    isConfigured: false,
    designPerSqm: null,
    minBuildPerSqm: null,
    minDesignAndBuildPerSqm: null,
    minLinearRate: null,
    minPartitionRatePerSqm: null,
  });

  const configured = getCustomStartingRates(
    INDICATIVE_ESTIMATE_CONFIG,
    INDICATIVE_WORKSHOP_ESTIMATE_RULES
  );
  assert.equal(configured.isConfigured, true);
  assert.equal(configured.designPerSqm, 0);
  assert.equal(configured.minLinearRate, 1000000);
  assert.equal(configured.minPartitionRatePerSqm, 2500000);
  assert.equal(configured.minBuildPerSqm, 1000000);
  assert.equal(configured.minDesignAndBuildPerSqm, 1000000);
});

test('calculateCustomEstimate and getCustomStartingRates read unified ProductItem tariffs and meterLari flag directly', () => {
  const linearProduct = {
    id: 'prod-meja-kerja',
    slug: 'meja-kerja',
    nama: 'Meja Kerja',
    kategori: 'Ruang Kerja',
    deskripsiSingkat: 'Meja kerja custom.',
    gambarSampul: '',
    media: [],
    pilihanWarna: [],
    referensiUkuran: ['120x75'],
    meterLari: true,
    harga: {
      hpl: { blockboard: 1800000, multipleks: 2500000, pvc: 3500000 },
      duco: { blockboard: 4500000, multipleks: 4500000, pvc: 4500000 },
    },
    customisasi: [],
    include: [],
  };

  const emptyMatrixRules = {
    promoAktif: false,
    hargaBahanPerMeterPersegi: {},
    hargaFinishingPerMeterPersegi: {},
    biayaTambahanOpsi: { 'soft-close': 450000 },
  };

  const directEstimate = calculateCustomEstimate({
    product: linearProduct,
    materialId: 'multipleks',
    finishId: 'hpl',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: ['soft-close'],
    quantity: 1,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: emptyMatrixRules,
  });

  assert.equal(directEstimate.status, 'configured');
  assert.equal(directEstimate.pricingUnit, 'm');
  assert.equal(directEstimate.measureQuantity, 3);
  assert.equal(directEstimate.unitRate, 2500000);
  assert.equal(directEstimate.compareAtUnitRate, null);
  assert.equal(directEstimate.estimatedUnitTotal, 3 * 2500000 + 450000);

  const areaProduct = {
    ...linearProduct,
    id: 'prod-backdrop',
    slug: 'backdrop-tv',
    nama: 'Backdrop TV',
    meterLari: false,
    harga: {
      hpl: { blockboard: 1000000, multipleks: 1500000, pvc: 2000000 },
      duco: { blockboard: 4500000, multipleks: 4500000, pvc: 4500000 },
    },
  };

  const areaEstimate = calculateCustomEstimate({
    product: areaProduct,
    materialId: 'blockboard',
    finishId: 'hpl',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: [],
    quantity: 1,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: emptyMatrixRules,
  });
  assert.equal(areaEstimate.pricingUnit, 'm2');
  assert.equal(areaEstimate.measureQuantity, 6);
  assert.equal(areaEstimate.estimatedUnitTotal, 6 * 1000000);

  const omittedMeterLariProduct = {
    ...areaProduct,
    id: 'prod-omitted-flag',
    meterLari: undefined,
  };
  const omittedEstimate = calculateCustomEstimate({
    product: omittedMeterLariProduct,
    materialId: 'blockboard',
    finishId: 'hpl',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: [],
    quantity: 1,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: emptyMatrixRules,
  });
  assert.equal(omittedEstimate.pricingUnit, 'm2');
  assert.equal(omittedEstimate.measureQuantity, 6);

  const fromProductsRates = getCustomStartingRates(
    INDICATIVE_ESTIMATE_CONFIG,
    emptyMatrixRules,
    [linearProduct, areaProduct]
  );
  assert.equal(fromProductsRates.isConfigured, true);
  assert.equal(fromProductsRates.minLinearRate, 1800000);
  assert.equal(fromProductsRates.minPartitionRatePerSqm, 1000000);

  const partialTariffProduct = {
    ...linearProduct,
    harga: {
      hpl: { blockboard: 1250000 },
      duco: { blockboard: 4800000 },
    },
  };

  const missingPairEstimate = calculateCustomEstimate({
    product: partialTariffProduct,
    materialId: 'multipleks',
    finishId: 'hpl',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: [],
    quantity: 1,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  });
  assert.equal(missingPairEstimate.status, 'contact');
  assert.equal(missingPairEstimate.unitRate, null);

  const customDucoRateEstimate = calculateCustomEstimate({
    product: partialTariffProduct,
    materialId: 'blockboard',
    finishId: 'cat-duco',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: [],
    quantity: 1,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  });
  assert.equal(customDucoRateEstimate.status, 'configured');
  assert.equal(customDucoRateEstimate.unitRate, 4800000);
  assert.ok(customDucoRateEstimate.disclaimer.includes('4.800.000'));
});

test('all produk.json items compute exact rates for every material, finish, and fractional cm dimension', () => {
  const products = produkJson as ProductItem[];
  assert.ok(products.length >= 20);

  const fractionalDim: RoomDimensionsInput = {
    length: 125,
    width: 215,
    height: null,
    unit: 'cm',
    normalizedLengthCm: 125,
    normalizedWidthCm: 215,
    normalizedHeightCm: null,
  };
  assert.equal(calculateLengthMeters(fractionalDim), 1.25);
  assert.equal(calculateAreaSquareMeters(fractionalDim), 2.6875);

  for (const product of products) {
    assert.ok(product.harga, `Product ${product.id} must define harga`);
    const isMeterLari = product.meterLari === true;
    const expectedMeasure = isMeterLari ? 1.25 : 2.6875;

    for (const matId of ['blockboard', 'multipleks', 'pvc'] as const) {
      const hplRate: number | null | undefined = product.harga.hpl?.[matId];
      assert.equal(typeof hplRate, 'number');
      const hplEst = calculateCustomEstimate({
        product,
        materialId: matId,
        finishId: 'hpl',
        dimensions: fractionalDim,
        additionalOptionIds: [],
        quantity: 2,
        pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
        rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
      });
      assert.equal(hplEst.status, 'configured');
      assert.equal(hplEst.pricingUnit, isMeterLari ? 'm' : 'm2');
      assert.equal(hplEst.measureQuantity, expectedMeasure);
      assert.equal(hplEst.unitRate, hplRate);
      assert.equal(hplEst.estimatedUnitTotal, Math.round(expectedMeasure * (hplRate as number)));
      assert.equal(hplEst.estimatedLineTotal, hplEst.estimatedUnitTotal! * 2);

      // Verify Tinggi (cm) changes estimate ONLY when meterLari !== true (m2 mode)
      const shorterHeightEst = calculateCustomEstimate({
        product,
        materialId: matId,
        finishId: 'hpl',
        dimensions: {
          ...fractionalDim,
          width: 100,
          normalizedWidthCm: 100,
        },
        additionalOptionIds: [],
        quantity: 1,
        pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
        rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
      });
      assert.equal(shorterHeightEst.measureQuantity, 1.25);
      assert.equal(shorterHeightEst.estimatedUnitTotal, Math.round(1.25 * (hplRate as number)));
      if (isMeterLari) {
        assert.equal(shorterHeightEst.estimatedUnitTotal, hplEst.estimatedUnitTotal);
      } else {
        assert.notEqual(shorterHeightEst.estimatedUnitTotal, hplEst.estimatedUnitTotal);
      }

      const ducoRate: number | null | undefined = product.harga.duco?.[matId];
      assert.equal(typeof ducoRate, 'number');
      const ducoEst = calculateCustomEstimate({
        product,
        materialId: matId,
        finishId: 'cat-duco',
        dimensions: fractionalDim,
        additionalOptionIds: [],
        quantity: 1,
        pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
        rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
      });
      assert.equal(ducoEst.status, 'configured');
      assert.equal(ducoEst.pricingUnit, isMeterLari ? 'm' : 'm2');
      assert.equal(ducoEst.unitRate, ducoRate);
      assert.equal(ducoEst.estimatedUnitTotal, Math.round(expectedMeasure * (ducoRate as number)));
    }
  }
});

test('calculateIndicativeSurveyFee computes tiered competitor rates strictly between 5% and 15%', () => {
  const samples = [1_500_000, 4_500_000, 7_920_000, 15_000_000, 30_000_000, 55_000_000];
  for (const total of samples) {
    const res = calculateIndicativeSurveyFee(total);
    assert.ok(res.ratePercent >= 5 && res.ratePercent <= 15);
    const pct = (res.amount / total) * 100;
    assert.ok(pct >= 5 - 0.001 && pct <= 15 + 0.001, `Survey fee pct ${pct} out of [5, 15]`);
  }
  assert.equal(calculateIndicativeSurveyFee(0).amount, 0);
});

test('calculateIndicativeDesign3dFee scales monotonically with dimensions and quantity', () => {
  const tiny = calculateIndicativeDesign3dFee({ measureQuantity: 1.0, quantity: 1 });
  const small = calculateIndicativeDesign3dFee({ measureQuantity: 2.4, quantity: 1 });
  const medium = calculateIndicativeDesign3dFee({ measureQuantity: 6.0, quantity: 1 });
  const large = calculateIndicativeDesign3dFee({ measureQuantity: 6.0, quantity: 2 });
  const xlarge = calculateIndicativeDesign3dFee({ measureQuantity: 18.0, quantity: 1 });

  assert.equal(tiny, 300_000);
  assert.ok(small > tiny);
  assert.ok(medium > small);
  assert.ok(large > medium);
  assert.ok(xlarge > large);
});

test('calculateIndicativeDeliveryFee assigns realistic fleet tiers and scales monotonically with volume', () => {
  const blindvan = calculateIndicativeDeliveryFee({
    areaSquareMeters: 1.5,
    lengthMeters: 1.5,
    quantity: 1,
  });
  const pickup = calculateIndicativeDeliveryFee({
    areaSquareMeters: 4.4,
    lengthMeters: 2.0,
    quantity: 1,
  });
  const engkel = calculateIndicativeDeliveryFee({
    areaSquareMeters: 5.0,
    lengthMeters: 2.5,
    quantity: 2,
  });
  const engkelLong = calculateIndicativeDeliveryFee({
    areaSquareMeters: 8.0,
    lengthMeters: 4.5,
    quantity: 2,
  });

  assert.equal(blindvan.fleetLabel, 'Blindvan');
  assert.equal(pickup.fleetLabel, 'Pickup Bak');
  assert.equal(engkel.fleetLabel, 'Truk Engkel');
  assert.equal(engkelLong.fleetLabel, 'Engkel Long');
  assert.ok(pickup.amount > blindvan.amount);
  assert.ok(engkel.amount > pickup.amount);
  assert.ok(engkelLong.amount > engkel.amount);
});

test('calculateCustomCostDetails handles PPN 11% exact integer sync on normal mode and exact discount math on promo mode', () => {
  const est = calculateCustomEstimate({
    itemTypeId: 'kitchen-set',
    materialId: 'multipleks',
    finishId: 'hpl',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: [],
    quantity: 2,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  });

  // Normal mode (no promo): 6 m2 * 2.5M * 2 = 30.000.000
  const normalDetails = calculateCustomCostDetails({
    estimate: est,
    quantity: 2,
    promo: resolveProductPromoMarkup(est.estimatedUnitTotal, ''),
  });
  assert.ok(normalDetails);
  assert.equal(normalDetails.isPromo, false);
  assert.equal(normalDetails.totalAmount, 30_000_000);
  assert.equal(normalDetails.ppnAmount, 3_300_000);
  assert.equal(normalDetails.productPriceAmount, 26_700_000);
  assert.equal(
    normalDetails.productPriceAmount + normalDetails.ppnAmount!,
    normalDetails.totalAmount
  );

  // Odd figure normal mode: ensure rounding remains strictly exact
  const oddEst = calculateCustomEstimate({
    itemTypeId: 'kitchen-set',
    materialId: 'blockboard',
    finishId: 'hpl',
    dimensions: {
      length: 125,
      width: 215,
      height: null,
      unit: 'cm',
      normalizedLengthCm: 125,
      normalizedWidthCm: 215,
      normalizedHeightCm: null,
    },
    additionalOptionIds: [],
    quantity: 1,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  });
  const oddDetails = calculateCustomCostDetails({
    estimate: oddEst,
    quantity: 1,
    promo: null,
  });
  assert.ok(oddDetails);
  assert.equal(
    oddDetails.productPriceAmount + oddDetails.ppnAmount!,
    oddDetails.totalAmount
  );

  // Promo mode (percent: 10%) -> Opsi 1: DPP after promo + PPN (11%) = Total (30.000.000)
  const pctPromo = resolveProductPromoMarkup(est.estimatedUnitTotal, '10%');
  const pctDetails = calculateCustomCostDetails({
    estimate: est,
    quantity: 2,
    promo: pctPromo,
  });
  assert.ok(pctDetails);
  assert.equal(pctDetails.isPromo, true);
  assert.equal(pctDetails.promoMode, 'percent');
  assert.equal(pctDetails.promoPercentLabel, '10%');
  assert.equal(pctDetails.promoDiscountAmount, 3_000_000);
  assert.equal(pctDetails.ppnAmount, 3_300_000);
  assert.equal(pctDetails.priceAfterDiscount, 26_700_000);
  assert.equal(pctDetails.productPriceAmount, 29_700_000);
  assert.equal(
    pctDetails.productPriceAmount - pctDetails.promoDiscountAmount,
    pctDetails.priceAfterDiscount
  );
  assert.equal(
    pctDetails.priceAfterDiscount! + pctDetails.ppnAmount,
    pctDetails.totalAmount
  );

  // Promo mode (nominal: 350000 per unit * 2 units = 700000)
  const nominalPromo = resolveProductPromoMarkup(est.estimatedUnitTotal, '350000');
  const nominalDetails = calculateCustomCostDetails({
    estimate: est,
    quantity: 2,
    promo: nominalPromo,
  });
  assert.ok(nominalDetails);
  assert.equal(nominalDetails.isPromo, true);
  assert.equal(nominalDetails.promoMode, 'nominal');
  assert.equal(nominalDetails.promoDiscountAmount, 700_000);
  assert.equal(nominalDetails.ppnAmount, 3_300_000);
  assert.equal(nominalDetails.priceAfterDiscount, 26_700_000);
  assert.equal(nominalDetails.productPriceAmount, 27_400_000);
  assert.equal(
    nominalDetails.productPriceAmount - nominalDetails.promoDiscountAmount,
    nominalDetails.priceAfterDiscount
  );
  assert.equal(
    nominalDetails.priceAfterDiscount! + nominalDetails.ppnAmount,
    nominalDetails.totalAmount
  );

  // Verify exact real produk.json catalog items preserve final tariff total with promo & PPN
  const products = produkJson as ProductItem[];
  const kitchenSet = products.find((p) => p.id === 'katalog-kitchen-set-01')!;
  const kitchenEst = calculateCustomEstimate({
    product: kitchenSet,
    materialId: 'blockboard',
    finishId: 'hpl',
    dimensions: {
      length: 200,
      width: 200,
      height: null,
      unit: 'cm',
      normalizedLengthCm: 200,
      normalizedWidthCm: 200,
      normalizedHeightCm: null,
    },
    additionalOptionIds: [],
    quantity: 1,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
  });
  const kitchenDetails = calculateCustomCostDetails({
    estimate: kitchenEst,
    quantity: 1,
    promo: resolveProductPromoMarkup(kitchenEst.estimatedUnitTotal, kitchenSet.promo),
  });
  assert.ok(kitchenDetails);
  assert.equal(kitchenDetails.totalAmount, 7_200_000);
  assert.equal(kitchenDetails.productPriceAmount, 7_128_000);
  assert.equal(kitchenDetails.promoDiscountAmount, 720_000);
  assert.equal(kitchenDetails.priceAfterDiscount, 6_408_000);
  assert.equal(kitchenDetails.ppnAmount, 792_000);
  assert.equal(
    kitchenDetails.productPriceAmount - kitchenDetails.promoDiscountAmount,
    kitchenDetails.priceAfterDiscount
  );
  assert.equal(
    kitchenDetails.priceAfterDiscount! + kitchenDetails.ppnAmount,
    kitchenDetails.totalAmount
  );

  // Contact fallback returns null
  assert.equal(
    calculateCustomCostDetails({
      estimate: { ...est, status: 'contact', estimatedLineTotal: null },
      quantity: 1,
    }),
    null
  );
});

