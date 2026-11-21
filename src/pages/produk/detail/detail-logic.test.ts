import assert from 'node:assert/strict';
import test from 'node:test';
import materialsJson from '../../../data/spesifikasi-material.json';
import type { MaterialSpecItem } from '../../../types/cms';
import type { ProductItem } from '../../../types/product';
import {
  buildProductDetailWhatsAppMessage,
  buildProductMediaItems,
  buildProductVisualSlides,
  getRelatedProducts,
  resolveProductMaterialDetails,
  resolveVideoSource,
} from './detail-logic';

const BASE_PRODUCT: ProductItem = {
  id: 'prod-1',
  slug: 'kitchen-set-kabinet-atas-bawah',
  nama: 'Kitchen set (kabinet atas & bawah)',
  kategori: 'Dapur & Bar',
  deskripsiSingkat: 'Sistem kabinet dapur atas dan bawah.',
  daftarGambar: ['/produk/gambar/kabinet-dapur-modular.webp'],
  daftarVideo: [
    {
      url: '/hero.webm',
      judul: 'Proses Pengerjaan Workshop',
      durasi: '0:25',
    },
    {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      judul: 'Tur Detail Kabinet',
    },
  ],
  daftarMaterial: [
    'Material Utama: MDF, Blockboard, PVC, Multipleks, atau Particle Board',
    'Finishing/Laminasi: Cat Duco, Sheet, atau HPL',
  ],
  pilihanWarna: [{ id: 'gading', nama: 'Gading Hangat', hex: '#EAE5DC' }],
  dimensi: {
    lebarCm: null,
    kedalamanCm: null,
    tinggiCm: null,
    referensiUkuran: ['2×3 m', '3×4 m'],
    catatan: 'Ukuran custom sesuai bidang dapur.',
  },
  harga: null,
  hargaMulai: null,
  statusHarga: 'konsultasi',
  ketersediaan: 'konsultasi',
  unggulan: true,
  urutan: 1,
  opsiKustom: [
    { id: 'material-utama', label: 'Material Utama', daftarNilai: ['Multipleks', 'PVC'] },
    { id: 'finishing', label: 'Finishing/Laminasi', daftarNilai: ['HPL', 'Cat Duco'] },
  ],
  produkContoh: true,
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

test('buildProductMediaItems combines photos and valid videos in order', () => {
  const media = buildProductMediaItems(BASE_PRODUCT);
  assert.equal(media.length, 3);
  assert.equal(media[0].type, 'image');
  assert.equal(media[1].type, 'video');
  assert.equal(media[1].poster, '/produk/gambar/kabinet-dapur-modular.webp');
  assert.equal(media[2].type, 'video');
  assert.equal(media[2].title, 'Tur Detail Kabinet');

  const emptyMedia = buildProductMediaItems({
    ...BASE_PRODUCT,
    daftarGambar: [],
    daftarVideo: [],
  });
  assert.equal(emptyMedia.length, 0);
});

test('buildProductVisualSlides keeps images, videos, and proportion schematic in unified order', () => {
  const slidesWithMedia = buildProductVisualSlides(BASE_PRODUCT, 'Shansus Dzar');
  assert.equal(slidesWithMedia.length, 4);
  assert.equal(slidesWithMedia[0].kind, 'image');
  assert.equal(slidesWithMedia[1].kind, 'video');
  assert.equal(slidesWithMedia[2].kind, 'video');
  assert.equal(slidesWithMedia[3].kind, 'schematic');

  const slidesWithoutMedia = buildProductVisualSlides(
    { ...BASE_PRODUCT, daftarGambar: [], daftarVideo: [] },
    'Shansus Dzar'
  );
  assert.equal(slidesWithoutMedia.length, 3);
  assert.equal(slidesWithoutMedia[0].kind, 'video');
  assert.equal(slidesWithoutMedia[1].kind, 'image');
  assert.equal(slidesWithoutMedia[2].kind, 'schematic');
});

test('resolveProductMaterialDetails matches base materials and finishes from material specs', () => {
  const specs = materialsJson as MaterialSpecItem[];
  const resolved = resolveProductMaterialDetails(BASE_PRODUCT, specs);
  assert.deepEqual(
    resolved.baseMaterials.map((m) => m.nama),
    ['PVC', 'Multipleks']
  );
  assert.deepEqual(
    resolved.finishes.map((m) => m.nama),
    ['Cat Duco', 'HPL']
  );
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
    selectedOptions: { 'Material Utama': 'PVC', 'Finishing/Laminasi': 'HPL' },
    quantity: 2,
    selectedDimensionRef: '2×3 m (6 m²)',
  });
  assert.ok(msg.includes('Kitchen set'));
  assert.ok(msg.includes('Desain + Build'));
  assert.ok(msg.includes('Rp 14.400.000'));
  assert.ok(msg.includes('Gading Hangat'));
  assert.ok(msg.includes('Material Utama: PVC'));
  assert.ok(msg.includes('2×3 m (6 m²)'));
  assert.ok(msg.includes('2 unit'));
});
