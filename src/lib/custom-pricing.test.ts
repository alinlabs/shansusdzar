import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INDICATIVE_ESTIMATE_CONFIG,
  INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  calculateAreaSquareMeters,
  calculateCustomEstimate,
  getCustomStartingRates,
} from './custom-pricing';
import type { RoomDimensionsInput } from '../types/cart';

const SAMPLE_DIM: RoomDimensionsInput = {
  length: 300,
  width: 200,
  height: null,
  unit: 'cm',
  normalizedLengthCm: 300,
  normalizedWidthCm: 200,
  normalizedHeightCm: null,
};

test('calculateAreaSquareMeters computes area accurately from normalized length × width in cm', () => {
  assert.equal(calculateAreaSquareMeters(SAMPLE_DIM), 6);
});

test('calculateCustomEstimate returns contact-only when pricing is not configured', () => {
  const result = calculateCustomEstimate({
    materialId: 'multipleks',
    finishId: 'hpl',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: ['soft-close'],
    quantity: 2,
  });

  assert.equal(result.status, 'contact');
  assert.equal(result.estimatedUnitTotal, null);
  assert.equal(result.estimatedLineTotal, null);
  assert.equal(result.estimatedDpUnitAmount, null);
  assert.equal(result.estimatedDpLineTotal, null);
  assert.ok(result.disclaimer.includes('Estimasi awal'));
});

test('calculateCustomEstimate computes (area × bahan/m²) + (area × finishing/m²) + options accurately', () => {
  const result = calculateCustomEstimate({
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
      hargaBahanPerMeterPersegi: { multipleks: 1600000 },
      hargaFinishingPerMeterPersegi: { hpl: 650000 },
      biayaTambahanOpsi: { 'soft-close': 500000 },
    },
  });

  // 6 m2 * 1,600,000 = 9,600,000 (bahan)
  // 6 m2 * 650,000   = 3,900,000 (finishing)
  // baseAmount       = 13,500,000 + 500,000 opsi = 14,000,000 per unit
  assert.equal(result.status, 'configured');
  assert.equal(result.materialRatePerSqm, 1600000);
  assert.equal(result.finishingRatePerSqm, 650000);
  assert.equal(result.materialAmount, 9600000);
  assert.equal(result.finishingAmount, 3900000);
  assert.equal(result.baseAmount, 13500000);
  assert.equal(result.optionsAmount, 500000);
  assert.equal(result.estimatedUnitTotal, 14000000);
  assert.equal(result.estimatedLineTotal, 28000000);
  assert.equal(result.dpPercentage, 30);
  assert.equal(result.estimatedDpUnitAmount, 4200000);
  assert.equal(result.estimatedDpLineTotal, 8400000);
});

test('indicative workshop rules produce configured estimates across all 5 bahan dasar and 3 finishing options', () => {
  const materialIds = Object.keys(INDICATIVE_WORKSHOP_ESTIMATE_RULES.hargaBahanPerMeterPersegi);
  const finishIds = Object.keys(INDICATIVE_WORKSHOP_ESTIMATE_RULES.hargaFinishingPerMeterPersegi);

  assert.deepEqual(materialIds.sort(), ['blockboard', 'mdf', 'multipleks', 'particle-board', 'pvc']);
  assert.deepEqual(finishIds.sort(), ['cat-duco', 'hpl', 'sheet']);

  for (const materialId of materialIds) {
    for (const finishId of finishIds) {
      const result = calculateCustomEstimate({
        materialId,
        finishId,
        dimensions: SAMPLE_DIM,
        additionalOptionIds: ['soft-close', 'survei-lokasi'],
        quantity: 1,
        pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
        rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
      });

      assert.equal(result.status, 'configured');
      assert.ok(typeof result.materialAmount === 'number' && result.materialAmount > 0);
      assert.ok(typeof result.finishingAmount === 'number' && result.finishingAmount > 0);
      assert.equal(result.baseAmount, result.materialAmount + result.finishingAmount);
      assert.equal(result.optionsAmount, 450000);
      assert.equal(result.estimatedUnitTotal, result.baseAmount + 450000);
      assert.ok(typeof result.estimatedDpUnitAmount === 'number' && result.estimatedDpUnitAmount > 0);
    }
  }
});

test('calculateCustomEstimate supports design-only per m² and excludes build hardware options', () => {
  const result = calculateCustomEstimate({
    serviceMode: 'design-only',
    materialId: 'multipleks',
    finishId: 'hpl',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: ['soft-close', 'led-kabinet', 'jalur-kabel', 'survei-lokasi'],
    quantity: 2,
    pricingConfig: {
      mataUang: 'IDR',
      persentaseDp: 30,
      hargaCustomTerkonfigurasi: true,
    },
    rules: {
      hargaDesainPerMeterPersegi: 150000,
      hargaBahanPerMeterPersegi: { multipleks: 1600000 },
      hargaFinishingPerMeterPersegi: { hpl: 650000 },
      biayaTambahanOpsi: {
        'soft-close': 300000,
        'led-kabinet': 250000,
        'jalur-kabel': 150000,
        'survei-lokasi': 150000,
      },
    },
  });

  // 6 m2 * 150,000 = 900,000 + survei-lokasi 150,000 = 1,050,000 per unit
  assert.equal(result.status, 'configured');
  assert.equal(result.serviceMode, 'design-only');
  assert.equal(result.designRatePerSqm, 150000);
  assert.equal(result.designAmount, 900000);
  assert.equal(result.materialRatePerSqm, null);
  assert.equal(result.finishingRatePerSqm, null);
  assert.equal(result.materialAmount, null);
  assert.equal(result.finishingAmount, null);
  assert.equal(result.buildAmount, null);
  assert.equal(result.baseAmount, 900000);
  assert.equal(result.optionsAmount, 150000);
  assert.equal(result.estimatedUnitTotal, 1050000);
  assert.equal(result.estimatedLineTotal, 2100000);
  assert.equal(result.estimatedDpUnitAmount, 315000);
});

test('calculateCustomEstimate supports design-and-build combining design and build rates', () => {
  const result = calculateCustomEstimate({
    serviceMode: 'design-and-build',
    materialId: 'multipleks',
    finishId: 'hpl',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: ['soft-close', 'survei-lokasi'],
    quantity: 1,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  });

  // Indicative: design = 150k, multipleks = 1,600k, hpl = 650k => 6 * 150k + 6 * 2,250k + 450k
  assert.equal(result.status, 'configured');
  assert.equal(result.serviceMode, 'design-and-build');
  assert.equal(result.designAmount, 900000);
  assert.equal(result.buildAmount, 13500000);
  assert.equal(result.baseAmount, 14400000);
  assert.equal(result.optionsAmount, 450000);
  assert.equal(result.estimatedUnitTotal, 14850000);
});

test('calculateCustomEstimate returns contact when design rate is missing or <= 0 in design modes', () => {
  const missingDesignRate = calculateCustomEstimate({
    serviceMode: 'design-only',
    materialId: 'multipleks',
    finishId: 'hpl',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: [],
    quantity: 1,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: {
      ...INDICATIVE_WORKSHOP_ESTIMATE_RULES,
      hargaDesainPerMeterPersegi: 0,
    },
  });

  assert.equal(missingDesignRate.status, 'contact');
  assert.equal(missingDesignRate.estimatedUnitTotal, null);

  const missingComboDesignRate = calculateCustomEstimate({
    serviceMode: 'design-and-build',
    materialId: 'multipleks',
    finishId: 'hpl',
    dimensions: SAMPLE_DIM,
    additionalOptionIds: [],
    quantity: 1,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: {
      ...INDICATIVE_WORKSHOP_ESTIMATE_RULES,
      hargaDesainPerMeterPersegi: null,
    },
  });

  assert.equal(missingComboDesignRate.status, 'contact');
  assert.equal(missingComboDesignRate.estimatedUnitTotal, null);
});

test('getCustomStartingRates returns lowest per-m² starting prices or nulls when disabled', () => {
  const disabled = getCustomStartingRates(
    { ...INDICATIVE_ESTIMATE_CONFIG, hargaCustomTerkonfigurasi: false },
    INDICATIVE_WORKSHOP_ESTIMATE_RULES
  );
  assert.deepEqual(disabled, {
    isConfigured: false,
    designPerSqm: null,
    minBuildPerSqm: null,
    minDesignAndBuildPerSqm: null,
  });

  const configured = getCustomStartingRates(
    INDICATIVE_ESTIMATE_CONFIG,
    INDICATIVE_WORKSHOP_ESTIMATE_RULES
  );
  assert.equal(configured.isConfigured, true);
  assert.equal(configured.designPerSqm, 150000);
  assert.ok(typeof configured.minBuildPerSqm === 'number' && configured.minBuildPerSqm > 0);
  assert.equal(
    configured.minDesignAndBuildPerSqm,
    (configured.designPerSqm ?? 0) + (configured.minBuildPerSqm ?? 0)
  );
});

