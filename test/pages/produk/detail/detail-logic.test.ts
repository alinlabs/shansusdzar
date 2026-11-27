import assert from 'node:assert/strict';
import test from 'node:test';
import { BUSINESS_CONFIG } from '../../../../src/lib/business-config';
import type { ProductItem } from '../../../../src/types/product';
import {
  buildProductDetailWhatsAppMessage,
  buildProductVisualSlides,
  computeProductDetailDerived,
  getProduct3dModelSrc,
  getRelatedProducts,
  resolve3dModelSource,
  resolveVideoSource,
} from '../../../../src/pages/produk/detail/detail-logic';

const BASE_PRODUCT: ProductItem = {
  id: 'prod-1',
  slug: 'kitchen-set-kabinet-atas-bawah',
  nama: 'Kitchen set (kabinet atas & bawah)',
  kategori: 'Dapur & Bar',
  deskripsiSingkat: 'Sistem kabinet dapur atas dan bawah.',
  gambarSampul: '/produk/gambar/kabinet-dapur-modular.webp',
  media: [
    {
      url: '/hero.webm',
      judul: 'Proses Pengerjaan Workshop',
      durasi: '0:25',
    },
    '/produk/gambar/kabinet-dapur-modular.webp',
    {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      judul: 'Tur Detail Kabinet',
    },
  ],
  pilihanWarna: [{ id: 'gading', nama: 'Gading Hangat', hex: '#EAE5DC' }],
  referensiUkuran: ['200x60', '250x60'],
  harga: {
    hpl: { multipleks: 2500000, pvc: 3500000 },
    duco: { multipleks: 4500000, pvc: 4500000 },
  },
  customisasi: ['Lurus (Straight)', 'Sudut (L-Shape)'],
  include: ['Engsel soft-close'],
};

test('resolveVideoSource classifies native paths, YouTube/Vimeo embeds, and rejects unsafe protocols', () => {
  assert.deepEqual(resolveVideoSource('/hero.webm'), { kind: 'native', src: '/hero.webm' });
  assert.deepEqual(resolveVideoSource('https://cdn.example.com/demo.mp4'), {
    kind: 'native',
    src: 'https://cdn.example.com/demo.mp4',
  });
  assert.deepEqual(resolveVideoSource('https://www.youtube.com/watch?v=abc123XYZ'), {
    kind: 'embed',
    src: 'https://www.youtube.com/embed/abc123XYZ',
  });
  assert.deepEqual(resolveVideoSource('https://youtu.be/xyz987'), {
    kind: 'embed',
    src: 'https://www.youtube.com/embed/xyz987',
  });
  assert.deepEqual(resolveVideoSource('https://vimeo.com/12345678'), {
    kind: 'embed',
    src: 'https://player.vimeo.com/video/12345678',
  });
  assert.deepEqual(resolveVideoSource('javascript:alert(1)'), { kind: 'invalid', src: '' });
});

test('resolve3dModelSource accepts local .glb paths and http/https CDN URLs while rejecting unsafe protocols', () => {
  assert.deepEqual(resolve3dModelSource('/models/kitchen.glb'), {
    kind: 'glb',
    src: '/models/kitchen.glb',
  });
  assert.deepEqual(resolve3dModelSource('https://cdn.example.com/assets/wardrobe.glb?v=1'), {
    kind: 'glb',
    src: 'https://cdn.example.com/assets/wardrobe.glb?v=1',
  });
  assert.deepEqual(resolve3dModelSource('//cdn.example.com/bad.glb'), { kind: 'invalid', src: '' });
  assert.deepEqual(resolve3dModelSource('javascript:alert(1)'), { kind: 'invalid', src: '' });
  assert.deepEqual(resolve3dModelSource('   '), { kind: 'invalid', src: '' });
});

test('buildProductVisualSlides preserves exact media sequence without video fallback or 3d slide, while getProduct3dModelSrc resolves 3d separately', () => {
  const slidesWithMedia = buildProductVisualSlides(BASE_PRODUCT);
  assert.equal(slidesWithMedia.length, 3);
  assert.equal(slidesWithMedia[0].kind, 'video');
  assert.equal(slidesWithMedia[1].kind, 'image');
  assert.equal(slidesWithMedia[2].kind, 'video');

  const slidesImagesOnly = buildProductVisualSlides({
    ...BASE_PRODUCT,
    media: ['/a.webp', '/b.webp'],
  });
  assert.equal(slidesImagesOnly.length, 2);
  assert.equal(slidesImagesOnly.every((slide) => slide.kind === 'image'), true);

  const productWith3d = {
    ...BASE_PRODUCT,
    media: ['/a.webp'],
    '3d': '/sample-produk/3d/kitchen.glb',
  };
  const slidesWith3dProp = buildProductVisualSlides(productWith3d);
  assert.equal(slidesWith3dProp.length, 1);
  assert.equal(slidesWith3dProp[0].kind, 'image');
  assert.equal(getProduct3dModelSrc(productWith3d), '/sample-produk/3d/kitchen.glb');
  assert.equal(getProduct3dModelSrc(BASE_PRODUCT), null);

  const slidesWithCoverOnly = buildProductVisualSlides({
    ...BASE_PRODUCT,
    media: [],
  });
  assert.equal(slidesWithCoverOnly.length, 1);
  assert.equal(slidesWithCoverOnly[0].kind, 'image');
  assert.equal(
    slidesWithCoverOnly[0].kind === 'image' ? slidesWithCoverOnly[0].src : null,
    '/produk/gambar/kabinet-dapur-modular.webp'
  );

  const slidesWithoutMedia = buildProductVisualSlides({
    ...BASE_PRODUCT,
    gambarSampul: '',
    media: [],
    '3d': '/models/fallback.glb',
  });
  assert.equal(slidesWithoutMedia.length, 1);
  assert.equal(slidesWithoutMedia[0].kind, 'image');
  assert.equal(getProduct3dModelSrc(slidesWithoutMedia ? { '3d': '/models/fallback.glb' } : BASE_PRODUCT), '/models/fallback.glb');
});

test('getRelatedProducts prioritizes same-category items and excludes current product', () => {
  const p2: ProductItem = { ...BASE_PRODUCT, id: 'p2', slug: 'island', kategori: 'Dapur & Bar' };
  const p3: ProductItem = { ...BASE_PRODUCT, id: 'p3', slug: 'wardrobe', kategori: 'Kamar Tidur' };
  const p4: ProductItem = { ...BASE_PRODUCT, id: 'p4', slug: 'nakas', kategori: 'Kamar Tidur' };

  const related = getRelatedProducts(BASE_PRODUCT, [BASE_PRODUCT, p3, p2, p4], 2);
  assert.deepEqual(
    related.map((item) => item.id),
    ['p2', 'p3']
  );
});

test('buildProductDetailWhatsAppMessage builds clear summary with selected options', () => {
  const msg = buildProductDetailWhatsAppMessage({
    brandName: 'Shansus Dzar Indonesia',
    productName: 'Kitchen set',
    category: 'Dapur & Bar',
    serviceModeLabel: 'Desain + Build',
    priceLabel: 'Rp 14.400.000',
    selectedColorName: 'Gading Hangat',
    selectedOptions: { 'Material Utama': 'PVC Board', 'Finishing/Laminasi': 'HPL' },
    quantity: 2,
    selectedDimensionRef: '2×3 m (6 m²)',
  });
  assert.ok(msg.includes('Kitchen set'));
  assert.ok(msg.includes('Desain + Build'));
  assert.ok(msg.includes('Rp 14.400.000'));
  assert.ok(msg.includes('Gading Hangat'));
  assert.ok(msg.includes('Material Utama: PVC Board'));
  assert.ok(msg.includes('2×3 m (6 m²)'));
  assert.ok(msg.includes('2 unit'));
});

test('computeProductDetailDerived calculates dimensions, variant pricing, and WhatsApp URL cleanly', () => {
  const derived = computeProductDetailDerived({
    product: BASE_PRODUCT,
    products: [BASE_PRODUCT],
    businessConfig: BUSINESS_CONFIG,
    customPricing: null,
    selectedColorId: 'invalid-fallback-test',
    selectedMaterialLabel: 'Multipleks',
    selectedFinishLabel: 'Cat Duco',
    selectedCustomisasi: 'Sudut (L-Shape)',
    customLengthCm: '250',
    customWidthCm: '60',
    isCustomSizeMode: false,
    quantity: 2,
  });

  assert.equal(derived.activeLengthCm, 250);
  assert.equal(derived.activeWidthCm, 60);
  assert.equal(derived.isCustomActive, false);
  assert.equal(derived.matchedPresetSize?.lengthCm, 250);
  assert.equal(derived.isCatDucoSelected, true);
  assert.equal(derived.activeCustomisasi, 'Sudut (L-Shape)');
  assert.equal(derived.variantPrice.pricingUnit, 'm2');
  assert.equal(derived.measureUnitDisplay, '1.5 m²');
  assert.ok(derived.whatsappInquiry.includes('wa.me'));
  assert.ok(derived.whatsappInquiry.includes('Sudut'));

  assert.equal(derived.estimateBreakdown.status, 'configured');
  assert.equal(derived.estimateBreakdown.measureQuantity, 1.5);
  assert.equal(derived.estimateBreakdown.estimatedUnitTotal, derived.variantPrice.unitPrice);
  assert.equal(derived.estimateBreakdown.estimatedLineTotal, derived.variantPrice.unitPrice * 2);

  const derivedLinear = computeProductDetailDerived({
    product: { ...BASE_PRODUCT, meterLari: true },
    products: [BASE_PRODUCT],
    businessConfig: BUSINESS_CONFIG,
    customPricing: null,
    selectedColorId: 'invalid-fallback-test',
    selectedMaterialLabel: 'Multipleks',
    selectedFinishLabel: 'Cat Duco',
    selectedCustomisasi: 'Sudut (L-Shape)',
    customLengthCm: '250',
    customWidthCm: '60',
    isCustomSizeMode: false,
    quantity: 1,
  });
  assert.equal(derivedLinear.variantPrice.pricingUnit, 'm');
  assert.equal(derivedLinear.measureUnitDisplay, '2.5 m');
  assert.equal(derivedLinear.variantPrice.unitPrice, 2.5 * 4500000);
  assert.equal(derivedLinear.estimateBreakdown.pricingUnit, 'm');
  assert.equal(derivedLinear.estimateBreakdown.measureQuantity, 2.5);
  assert.equal(derivedLinear.estimateBreakdown.estimatedLineTotal, 2.5 * 4500000);

  // Default 1x1m state with no reference preset selected even if 100x100 is listed in referensiUkuran
  const defaultUnselected = computeProductDetailDerived({
    product: {
      ...BASE_PRODUCT,
      referensiUkuran: ['100x100', '200x60', '250x60'],
      promo: '10%',
    },
    products: [BASE_PRODUCT],
    businessConfig: BUSINESS_CONFIG,
    customPricing: null,
    selectedColorId: 'gading',
    selectedMaterialLabel: 'Multipleks',
    selectedFinishLabel: 'HPL',
    selectedCustomisasi: null,
    customLengthCm: '100',
    customWidthCm: '100',
    isCustomSizeMode: false,
    selectedPresetNormalized: null,
    quantity: 1,
  });
  assert.equal(defaultUnselected.activeLengthCm, 100);
  assert.equal(defaultUnselected.activeWidthCm, 100);
  assert.equal(defaultUnselected.activeAreaSqm, 1);
  assert.equal(defaultUnselected.matchedPresetSize, null);
  assert.equal(defaultUnselected.variantPrice.unitPrice, 2500000);
  assert.equal(defaultUnselected.variantPrice.compareAtUnitPrice, 2750000);
  assert.equal(defaultUnselected.variantPrice.promoPercentLabel, '10%');

  const withCustomPaymentScheme = computeProductDetailDerived({
    product: BASE_PRODUCT,
    products: [BASE_PRODUCT],
    businessConfig: BUSINESS_CONFIG,
    customPricing: null,
    paymentScheme: {
      judul: 'Skema Uji',
      catatan: '',
      tahapan: [
        { id: 'termin-dp', urutan: 1, nama: 'Termin 1 : DP', persentase: 25, keterangan: 'DP' },
        { id: 'termin-2', urutan: 2, nama: 'Termin 2', persentase: 45, keterangan: 'Produksi' },
        { id: 'termin-3', urutan: 3, nama: 'Termin 3', persentase: 20, keterangan: 'Instalasi' },
        { id: 'termin-4', urutan: 4, nama: 'Termin 4', persentase: 10, keterangan: 'BAST' },
      ],
    },
    selectedColorId: 'gading',
    selectedMaterialLabel: 'Multipleks',
    selectedFinishLabel: 'HPL',
    selectedCustomisasi: null,
    customLengthCm: '100',
    customWidthCm: '100',
    isCustomSizeMode: false,
    selectedPresetNormalized: null,
    quantity: 1,
  });
  assert.equal(withCustomPaymentScheme.estimateBreakdown.dpPercentage, 25);
  assert.equal(withCustomPaymentScheme.estimateBreakdown.estimatedDpUnitAmount, 625000);
});
