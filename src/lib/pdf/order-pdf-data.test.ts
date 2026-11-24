import test from 'node:test';
import assert from 'node:assert/strict';
import type { CartItem } from '../../types/cart';
import {
  buildOrderPdfDataModel,
  buildSafePdfFilename,
  generateLocalReferenceCode,
  sanitizePdfText,
} from './order-pdf-data';

test('generateLocalReferenceCode clearly identifies a local order reference', () => {
  const code = generateLocalReferenceCode(new Date('2026-11-18T08:15:00'));
  assert.ok(code.startsWith('REF-SZ-20261118-'));
});

test('sanitizePdfText replaces unsupported glyphs while preserving Indonesian WinAnsi symbols', () => {
  assert.equal(sanitizePdfText('“Krem” — 300 × 200 cm ±5% · Ruang → Tamu'), '"Krem" - 300 × 200 cm ±5% · Ruang -> Tamu');
});

test('buildOrderPdfDataModel maps product + custom items honestly without Rp0', () => {
  const sampleItems: CartItem[] = [
    {
      kind: 'product',
      lineId: 'prod-1',
      productId: 'sofa-01',
      slug: 'sofa-minimalis',
      name: 'Sofa Minimalis 3 Dudukan',
      category: 'Ruang Tamu',
      image: '/produk/gambar/sofa-sandar-minimalis.webp',
      selectedColorName: 'Gading Hangat',
      selectedColorHex: '#EAE5DC',
      selectedOptions: { Dudukan: '3 Dudukan' },
      quantity: 1,
      unitPrice: null,
      priceStatus: 'konsultasi',
    },
    {
      kind: 'custom',
      lineId: 'custom-1',
      projectTypeId: 'dapur',
      projectTypeLabel: 'Dapur & Pantry',
      itemTypeId: 'kitchen-set',
      itemTypeLabel: 'Kabinet Dapur',
      dimensions: {
        length: 3.2,
        width: 2.1,
        height: null,
        unit: 'm',
        normalizedLengthCm: 320,
        normalizedWidthCm: 210,
        normalizedHeightCm: null,
      },
      materialId: 'multipleks',
      materialLabel: 'Multipleks',
      finishId: 'hpl',
      finishLabel: 'HPL',
      colorId: 'walnut-tua',
      colorName: 'Cokelat Walnut',
      colorHex: '#634E3F',
      additionalOptions: ['Engsel & Rel Soft-Close'],
      notes: 'Jalur pipa kanan',
      quantity: 2,
      estimatedUnitTotal: null,
      estimatedDpAmount: null,
      estimateStatus: 'contact',
    },
  ];

  const model = buildOrderPdfDataModel({
    items: sampleItems,
    customer: {
      fullName: 'Budi Santoso',
      rawPhone: '085797184059',
      normalizedPhone: '+6285797184059',
      address: 'Desa Cibogohilir, Purwakarta',
      notes: 'Hubungi siang hari',
      coordinates: {
        latitude: -6.556912,
        longitude: 107.443946,
        accuracyMeters: 20,
        capturedAtIso: '2026-11-18T08:00:00.000Z',
      },
    },
    referenceCode: 'REF-SZ-20261118-0800-1234',
    createdAt: new Date('2026-11-18T08:00:00'),
  });

  assert.equal(model.brandName, 'Shansus Dzar Indonesia');
  assert.equal(model.brandWhatsApp, '0813-15000-234');
  assert.ok(model.brandAddress.includes('Cibogohilir'));
  assert.equal(model.items.length, 2);
  assert.equal(model.items[0].unitPriceLabel, 'Hubungi kami untuk harga');
  assert.equal(model.items[1].unitPriceLabel, 'Hubungi kami');
  assert.ok(model.items[1].specLines.some((l) => l.includes('3.2 × 2.1 m (320 × 210 cm)')));
  assert.equal(model.summary.subtotalLabel, 'Menunggu konfirmasi harga resmi');
  assert.equal(model.summary.estimatedDpLabel, null);
  assert.equal(model.filename, 'ringkasan-pesanan-ref-sz-20261118-0800-1234.pdf');
  assert.equal(buildSafePdfFilename('REF SZ/01'), 'ringkasan-pesanan-ref-sz-01.pdf');
});

test('buildOrderPdfDataModel surfaces serviceMode and design/build breakdown for custom items', () => {
  const sampleItems: CartItem[] = [
    {
      kind: 'custom',
      lineId: 'custom-design-only',
      serviceMode: 'design-only',
      serviceModeLabel: 'Desain Saja',
      projectTypeId: 'ruang-tamu',
      projectTypeLabel: 'Ruang Tamu',
      itemTypeId: 'credenza-01',
      itemTypeLabel: 'Credenza TV Minimalis',
      dimensions: {
        length: 300,
        width: 200,
        height: null,
        unit: 'cm',
        normalizedLengthCm: 300,
        normalizedWidthCm: 200,
        normalizedHeightCm: null,
      },
      materialId: 'multipleks',
      materialLabel: 'Multipleks',
      finishId: 'hpl',
      finishLabel: 'HPL',
      colorId: 'gandum',
      colorName: 'Gandum Hangat',
      colorHex: '#D8D1C7',
      additionalOptions: ['Survei & Ukur Lapangan'],
      notes: '',
      quantity: 1,
      designAmount: 900000,
      buildAmount: null,
      estimatedUnitTotal: 1050000,
      estimatedDpAmount: 315000,
      estimateStatus: 'configured',
    },
    {
      kind: 'custom',
      lineId: 'custom-combo',
      serviceMode: 'design-and-build',
      serviceModeLabel: 'Desain + Build',
      projectTypeId: 'dapur',
      projectTypeLabel: 'Dapur & Pantry',
      itemTypeId: 'kitchen-set',
      itemTypeLabel: 'Kabinet Dapur',
      dimensions: {
        length: 300,
        width: 200,
        height: null,
        unit: 'cm',
        normalizedLengthCm: 300,
        normalizedWidthCm: 200,
        normalizedHeightCm: null,
      },
      materialId: 'multipleks',
      materialLabel: 'Multipleks',
      finishId: 'hpl',
      finishLabel: 'HPL',
      colorId: 'walnut',
      colorName: 'Cokelat Walnut',
      colorHex: '#634E3F',
      additionalOptions: [],
      notes: '',
      quantity: 1,
      designAmount: 900000,
      buildAmount: 13500000,
      estimatedUnitTotal: 14400000,
      estimatedDpAmount: 4320000,
      estimateStatus: 'configured',
    },
  ];

  const model = buildOrderPdfDataModel({
    items: sampleItems,
    customer: {
      fullName: 'Sari Wulandari',
      rawPhone: '085797184059',
      normalizedPhone: '+6285797184059',
      address: 'Desa Cibogohilir, Purwakarta',
      notes: '',
      coordinates: null,
    },
    referenceCode: 'REF-SZ-20261121-0900-4321',
    createdAt: new Date('2026-11-21T09:00:00'),
  });

  assert.ok(model.items[0].metaLine.includes('Layanan: Desain Saja'));
  assert.ok(
    model.items[0].specLines.some((line) => line.startsWith('Ref. Material Utama: Multipleks'))
  );
  assert.equal(
    model.items[0].specLines.some((line) => line.startsWith('Rincian estimasi:')),
    false
  );

  assert.ok(model.items[1].metaLine.includes('Layanan: Desain + Build'));
  assert.ok(
    model.items[1].specLines.some((line) => line.startsWith('Material Utama: Multipleks'))
  );
  assert.ok(
    model.items[1].specLines.some(
      (line) => line.includes('Rincian estimasi: Desain') && line.includes('Build')
    )
  );
});

