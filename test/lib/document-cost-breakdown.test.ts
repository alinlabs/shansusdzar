import assert from 'node:assert/strict';
import test from 'node:test';
import defaultProjectsData from '../../src/data/proyek.json';
import { BUSINESS_CONFIG } from '../../src/lib/business-config';
import { resolveProductPromoMarkup } from '../../src/lib/catalog-pricing';
import {
  calculateCustomCostDetails,
  calculateCustomEstimate,
  INDICATIVE_ESTIMATE_CONFIG,
  INDICATIVE_WORKSHOP_ESTIMATE_RULES,
} from '../../src/lib/custom-pricing';
import {
  buildCostBreakdownFromAgreement,
  buildCostBreakdownFromInvoice,
  buildCostBreakdownFromProject,
  buildCostBreakdownFromQuotation,
  calculateDocumentCostBreakdown,
} from '../../src/lib/document-cost-breakdown';
import { DEFAULT_PAYMENT_SCHEME } from '../../src/lib/payment-scheme';
import { buildAutoProjectDocuments } from '../../src/lib/project-documents-auto';
import { DEFAULT_CATALOG_PRODUCTS } from '../../src/lib/project-products';
import type { WorkshopProject } from '../../src/types/finance';

const seededProjects = defaultProjectsData as WorkshopProject[];

test('calculateDocumentCostBreakdown matches calculateCustomCostDetails 1:1 on promo & non-promo items while preserving exact total', () => {
  // Promo catalog item from produk.json
  const kitchenProduct = DEFAULT_CATALOG_PRODUCTS.find((p) => Boolean(p.promo));
  assert.ok(kitchenProduct);

  const estimatePromo = calculateCustomEstimate({
    product: kitchenProduct,
    materialId: 'multipleks',
    finishId: 'hpl',
    dimensions: {
      length: 300,
      width: 100,
      height: 85,
      unit: 'cm',
      normalizedLengthCm: 300,
      normalizedWidthCm: 100,
      normalizedHeightCm: 85,
    },
    additionalOptionIds: [],
    quantity: 1,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  });
  const promoInfo = resolveProductPromoMarkup(
    estimatePromo.estimatedUnitTotal,
    kitchenProduct.promo
  );
  const customDetails = calculateCustomCostDetails({
    estimate: estimatePromo,
    quantity: 1,
    promo: promoInfo,
  });
  assert.ok(customDetails);

  const docBreakdown = calculateDocumentCostBreakdown({
    items: [
      {
        productId: kitchenProduct.id,
        namaProduk: kitchenProduct.nama,
        dimensi: '300 x 60 x 100',
        jumlah: 1,
        hargaSatuan: estimatePromo.estimatedUnitTotal!,
      },
    ],
    totalAmount: estimatePromo.estimatedLineTotal!,
  });
  assert.ok(docBreakdown);

  assert.equal(docBreakdown.surveyFee, customDetails.surveyFee);
  assert.equal(docBreakdown.design3dFee, customDetails.design3dFee);
  assert.equal(docBreakdown.deliveryFee, customDetails.deliveryFee);
  assert.equal(docBreakdown.deliveryFleetLabel, customDetails.deliveryFleetLabel);
  assert.equal(docBreakdown.productPriceAmount, customDetails.productPriceAmount);
  assert.equal(docBreakdown.promoDiscountAmount, customDetails.promoDiscountAmount);
  assert.equal(docBreakdown.priceAfterDiscount, customDetails.priceAfterDiscount);
  assert.equal(docBreakdown.ppnAmount, customDetails.ppnAmount);
  assert.equal(docBreakdown.totalAmount, customDetails.totalAmount);
  assert.equal(
    docBreakdown.productPriceAmount - docBreakdown.promoDiscountAmount,
    docBreakdown.priceAfterDiscount
  );
  assert.equal(
    docBreakdown.priceAfterDiscount + docBreakdown.ppnAmount,
    docBreakdown.totalAmount
  );

  // Non-promo catalog item (promo null)
  const nakasProduct = { ...kitchenProduct, id: 'custom-nonpromo-test', nama: 'Kabinet Custom Non Promo', promo: null };
  const estimateNormal = calculateCustomEstimate({
    product: nakasProduct,
    materialId: 'multipleks',
    finishId: 'hpl',
    dimensions: {
      length: 120,
      width: 60,
      height: 55,
      unit: 'cm',
      normalizedLengthCm: 120,
      normalizedWidthCm: 60,
      normalizedHeightCm: 55,
    },
    additionalOptionIds: [],
    quantity: 2,
    pricingConfig: INDICATIVE_ESTIMATE_CONFIG,
    rules: INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  });
  const normalDetails = calculateCustomCostDetails({
    estimate: estimateNormal,
    quantity: 2,
    promo: null,
  });
  assert.ok(normalDetails);

  const normalDocBreakdown = calculateDocumentCostBreakdown({
    items: [
      {
        productId: nakasProduct.id,
        namaProduk: nakasProduct.nama,
        dimensi: '120 x 55 x 60',
        jumlah: 2,
        hargaSatuan: estimateNormal.estimatedUnitTotal!,
      },
    ],
    totalAmount: estimateNormal.estimatedLineTotal!,
    catalogProducts: [...DEFAULT_CATALOG_PRODUCTS, nakasProduct],
  });
  assert.ok(normalDocBreakdown);
  assert.equal(normalDocBreakdown.promoDiscountAmount, 0);
  assert.equal(normalDocBreakdown.productPriceAmount, normalDetails.productPriceAmount);
  assert.equal(normalDocBreakdown.priceAfterDiscount, normalDetails.productPriceAmount);
  assert.equal(normalDocBreakdown.ppnAmount, normalDetails.ppnAmount);
  assert.equal(
    normalDocBreakdown.priceAfterDiscount + normalDocBreakdown.ppnAmount,
    normalDocBreakdown.totalAmount
  );
});

test('Document cost breakdown preserves exact contract total across all seeded projects, Quotation, SPKS, and Invoice', () => {
  for (const project of seededProjects) {
    const bundle = buildAutoProjectDocuments(project, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME);

    const projectBreakdown = buildCostBreakdownFromProject(project);
    const quoBreakdown = buildCostBreakdownFromQuotation(bundle.quotation, project);
    const spkBreakdown = buildCostBreakdownFromAgreement(bundle.agreement, project);
    const invBreakdown = buildCostBreakdownFromInvoice(bundle.invoice, project);
    const invFallbackBreakdown = buildCostBreakdownFromInvoice(bundle.invoice, null);

    for (const entry of [
      projectBreakdown,
      quoBreakdown,
      spkBreakdown,
      invBreakdown,
      invFallbackBreakdown,
    ]) {
      assert.ok(entry, `Expected breakdown for ${project.id}`);
      assert.ok(entry.surveyFee > 0);
      assert.ok(entry.design3dFee >= 300_000);
      assert.ok(entry.deliveryFee >= 350_000);
      assert.equal(entry.totalAmount, project.nilaiKontrak);
      assert.equal(
        entry.productPriceAmount - entry.promoDiscountAmount,
        entry.priceAfterDiscount
      );
      assert.equal(entry.priceAfterDiscount + entry.ppnAmount, project.nilaiKontrak);
    }

    // Also test invoice with manual extra discount while preserving exact invoice total
    const discountedInv = {
      ...bundle.invoice,
      nominalDiskon: 500_000,
    };
    const discBreakdown = buildCostBreakdownFromInvoice(discountedInv, project);
    assert.ok(discBreakdown);
    assert.equal(discBreakdown.totalAmount, project.nilaiKontrak);
    assert.equal(
      discBreakdown.promoDiscountAmount,
      invBreakdown!.promoDiscountAmount + 500_000
    );
    assert.equal(
      discBreakdown.productPriceAmount - discBreakdown.promoDiscountAmount,
      discBreakdown.priceAfterDiscount
    );
    assert.equal(discBreakdown.priceAfterDiscount + discBreakdown.ppnAmount, project.nilaiKontrak);
  }

  assert.equal(
    calculateDocumentCostBreakdown({ items: [], totalAmount: 0 }),
    null
  );
});
