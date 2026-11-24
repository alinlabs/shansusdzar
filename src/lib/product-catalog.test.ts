import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUSINESS_CONFIG, buildMapsSearchUrl, buildWhatsAppUrl } from './business-config';
import { UNIVERSAL_COLOR_PALETTE, findUniversalColor } from './color-palette';
import {
  getProductCoverImage,
  getProductImageUrls,
  getProductSlug,
  parseProductCatalog,
  parseReferenceSizeCm,
  resolveProductMediaEntry,
  serializeProductForJson,
  slugifyProduct,
} from './product-catalog';

test('universal color palette loads separately from pilihan-warna.json', () => {
  assert.ok(UNIVERSAL_COLOR_PALETTE.length >= 8);
  for (const color of UNIVERSAL_COLOR_PALETTE) {
    assert.ok(color.id);
    assert.ok(color.nama);
    assert.match(color.hex, /^#[0-9A-Fa-f]{6}$/);
  }
  assert.equal(findUniversalColor('gading-hangat').nama, 'Gading Hangat');
});

test('business config enforces fixed Shansus Dzar Indonesia facts', () => {
  assert.equal(BUSINESS_CONFIG.namaMerek, 'Shansus Dzar Indonesia');
  assert.equal(
    BUSINESS_CONFIG.alamat.alamatLengkap,
    'Kp. Tegal Jati, RT. 019/RW. 010, Desa Cibogohilir, Kecamatan Plered, Kabupaten Purwakarta, Jawa Barat - 41162'
  );
  assert.equal(BUSINESS_CONFIG.whatsapp.nomorTampil, '0813-15000-234');
  assert.equal(BUSINESS_CONFIG.whatsapp.digitTerstandar, '6281315000234');
  assert.ok(BUSINESS_CONFIG.mediaSosial?.urlFacebook.startsWith('https://'));
  assert.ok(BUSINESS_CONFIG.mediaSosial?.urlInstagram.startsWith('https://'));
  assert.ok(BUSINESS_CONFIG.mediaSosial?.urlTiktok.startsWith('https://'));
});

test('buildWhatsAppUrl encodes text cleanly with exact target number', () => {
  assert.equal(buildWhatsAppUrl(), 'https://wa.me/6281315000234');
  assert.equal(
    buildWhatsAppUrl('Halo Shansus Dzar Indonesia'),
    'https://wa.me/6281315000234?text=Halo%20Shansus%20Dzar%20Indonesia'
  );
  assert.ok(buildMapsSearchUrl().includes('Kabupaten%20Purwakarta'));
});

const EXPECTED_CATALOG_NAMES = [
  'Kitchen Set',
  'Island Table',
  'Wardrobe',
  'Backdrop TV',
  'Bufet TV',
  'Modern Divan',
  'Headboard',
  'Nakas',
  'Meja Rias',
  'Meja Kerja',
  'Rak Display',
  'Partisi',
  'Wall Panel',
  'Kabinet Tangga',
  'Lemari Sepatu',
  'Vanity Bathroom',
  'Laundry Cabinet',
  'Meja Resepsionis',
  'Meja Kasir',
  'Booth Pameran',
] as const;

const FORBIDDEN_RAW_PRODUCT_KEYS = [
  'slug',
  'unggulan',
  'dimensi',
  'catatan',
  'daftarMaterial',
  'tarifSatuan',
  'hargaMulai',
  'statusHarga',
  'ketersediaan',
  'urutan',
  'produkContoh',
  'kaitkanHargaCustom',
  'promoAktif',
  'hargaSebelumPromo',
  'hargaMulaiSebelumPromo',
  'tarifSatuanSebelumPromo',
  'tarifKustom',
  'tarifKustomSebelumPromo',
  'satuanTarif',
  'opsiKustom',
  'opsiTambahan',
  'daftarGambar',
  'daftarVideo',
];

test('src/data/produk.json parses cleanly as a clean product array with gambarSampul, media[], referensiUkuran[], customisasi[], include[] and no legacy fields', () => {
  const filePath = path.resolve(process.cwd(), 'src/data/produk.json');
  const rawText = fs.readFileSync(filePath, 'utf-8');
  const json: unknown = JSON.parse(rawText);
  assert.ok(Array.isArray(json), 'produk.json must directly be an array of products');
  assert.equal(json.length, 20);

  for (const rawEntry of json) {
    assert.ok(typeof rawEntry === 'object' && rawEntry !== null);
    const rec = rawEntry as Record<string, unknown>;
    for (const forbidden of FORBIDDEN_RAW_PRODUCT_KEYS) {
      assert.equal(forbidden in rec, false, `Forbidden key "${forbidden}" found in produk.json`);
    }
    assert.equal('gambarSampul' in rec, true, 'Key "gambarSampul" must exist in produk.json');
    assert.equal(typeof rec.gambarSampul, 'string');
    assert.match(String(rec.gambarSampul), /^\/sample-produk\/gambar\/.+-real\.webp$/);
    const coverPublicPath = path.resolve(process.cwd(), 'public', String(rec.gambarSampul).replace(/^\/+/, ''));
    assert.equal(fs.existsSync(coverPublicPath), true, `Missing cover file: ${rec.gambarSampul}`);
    assert.equal('3d' in rec, true, 'Key "3d" must exist in produk.json');
    if (rec.id === 'katalog-kitchen-set-01') {
      assert.equal(rec['3d'], '/sample-produk/3d/kitchen.glb');
      const glbPublicPath = path.resolve(
        process.cwd(),
        'public',
        String(rec['3d']).replace(/^\/+/, '')
      );
      assert.equal(fs.existsSync(glbPublicPath), true, `Missing 3D file: ${rec['3d']}`);
    } else {
      assert.equal(rec['3d'], '');
    }
    assert.equal('media' in rec, true, 'Key "media" must exist in produk.json');
    assert.ok(Array.isArray(rec.media) && rec.media.length >= 4);
    for (const mediaPath of rec.media) {
      assert.equal(typeof mediaPath, 'string');
      const fullMediaPath = path.resolve(process.cwd(), 'public', String(mediaPath).replace(/^\/+/, ''));
      assert.equal(fs.existsSync(fullMediaPath), true, `Missing media file: ${mediaPath}`);
    }
    assert.equal('promo' in rec, true, 'Key "promo" must exist in produk.json');
    assert.equal('meterLari' in rec, true, 'Key "meterLari" must exist in produk.json');
    assert.equal(typeof rec.meterLari, 'boolean', 'Key "meterLari" must be boolean in produk.json');
    assert.ok(Array.isArray(rec.referensiUkuran) && rec.referensiUkuran.length >= 2);
    for (const sizeEntry of rec.referensiUkuran) {
      assert.equal(typeof sizeEntry, 'string');
      assert.match(String(sizeEntry), /^\d+x\d+$/);
    }
    assert.ok(Array.isArray(rec.customisasi) && rec.customisasi.length >= 1);
    for (const customItem of rec.customisasi) {
      assert.equal(typeof customItem, 'string');
      assert.ok(String(customItem).trim().length > 0);
    }
    assert.ok(Array.isArray(rec.include) && rec.include.length >= 3);
    for (const incItem of rec.include) {
      assert.equal(typeof incItem, 'string');
      assert.ok(String(incItem).trim().length > 0);
    }
  }

  const result = parseProductCatalog(json);
  assert.equal(result.status, 'success');
  if (result.status === 'success') {
    assert.equal(result.catalog.daftarProduk.length, 20);
    assert.deepEqual(
      result.catalog.daftarProduk.map((p) => p.nama),
      [...EXPECTED_CATALOG_NAMES]
    );
    assert.equal(
      result.catalog.daftarProduk.some((p) => /walk[- ]?in|closet/i.test(`${p.nama} ${p.slug} ${p.id}`)),
      false
    );
    const ALLOWED_CATEGORIES = new Set([
      'Ruang Keluarga',
      'Dapur',
      'Kamar Tidur',
      'Kamar Mandi',
      'Ruang Kerja',
      'Penyimpanan',
      'Komersial',
      'Dinding',
    ]);
    const foundCategories = new Set(result.catalog.daftarProduk.map((p) => p.kategori));
    for (const product of result.catalog.daftarProduk) {
      assert.ok(
        ALLOWED_CATEGORIES.has(product.kategori),
        `Unexpected category "${product.kategori}" on product "${product.nama}"`
      );
    }
    assert.equal(foundCategories.size, ALLOWED_CATEGORIES.size);
    const partisiProduct = result.catalog.daftarProduk.find(
      (p) => p.id === 'katalog-partisi-ruangan-13'
    );
    assert.equal(partisiProduct?.promo, '10%');
    for (const product of result.catalog.daftarProduk) {
      assert.ok(Array.isArray(product.referensiUkuran) && product.referensiUkuran.length >= 2);
      for (const refSize of product.referensiUkuran) {
        assert.match(refSize, /^\d+x\d+$/);
        assert.ok(parseReferenceSizeCm(refSize));
      }
      assert.ok(Array.isArray(product.include) && product.include.length >= 3);
      assert.ok(Array.isArray(product.customisasi) && product.customisasi.length >= 1);
      assert.ok(product.harga);
      assert.ok((product.harga?.hpl.blockboard ?? 0) > 0);
      assert.ok((product.harga?.hpl.multipleks ?? 0) > 0);
      assert.ok((product.harga?.hpl.pvc ?? 0) > 0);
      assert.ok((product.harga?.duco.blockboard ?? 0) > 0);
      assert.ok((product.harga?.duco.multipleks ?? 0) > 0);
      assert.ok((product.harga?.duco.pvc ?? 0) > 0);
    }
  }
});

test('parseReferenceSizeCm validates numeric dimension format cleanly', () => {
  assert.deepEqual(parseReferenceSizeCm('200x300'), {
    lengthCm: 200,
    widthCm: 300,
    normalized: '200x300',
  });
  assert.deepEqual(parseReferenceSizeCm('200 × 60 cm'), {
    lengthCm: 200,
    widthCm: 60,
    normalized: '200x60',
  });
  assert.equal(parseReferenceSizeCm('ukuran custom'), null);
  assert.equal(parseReferenceSizeCm('0x200'), null);
});

test('parseProductCatalog handles malformed inputs safely and migrates legacy opsiKustom/opsiTambahan cleanly', () => {
  const invalidRoot = parseProductCatalog(null);
  assert.equal(invalidRoot.status, 'error');

  const missingArray = parseProductCatalog({ versiSkema: 6 });
  assert.equal(missingArray.status, 'error');

  const invalidItems = parseProductCatalog({
    versiSkema: 6,
    daftarProduk: [{ invalid: true }],
  });
  assert.equal(invalidItems.status, 'error');

  const legacyMigrated = parseProductCatalog([
    {
      id: 'demo-1',
      nama: 'Produk Contoh! & Uji',
      kategori: 'Ruang Tamu',
      deskripsiSingkat: 'Deskripsi contoh',
      promo: '10%',
      dimensi: { lebarCm: 180, kedalamanCm: 50, tinggiCm: null },
      opsiKustom: [
        { id: 'customisasi', label: 'Customisasi', daftarNilai: ['Lurus', 'L-Shape'] },
        { id: 'material-utama', label: 'Material Utama', daftarNilai: ['Blockboard'] },
        { id: 'finishing', label: 'Finishing/Laminasi', daftarNilai: ['HPL'] },
      ],
      opsiTambahan: [
        { id: 'soft-close', label: 'Engsel soft-close', deskripsi: 'Termasuk gratis.' },
      ],
    },
  ]);

  assert.equal(legacyMigrated.status, 'success');
  if (legacyMigrated.status === 'success') {
    const item = legacyMigrated.catalog.daftarProduk[0];
    assert.equal(item.slug, 'produk-contoh-uji');
    assert.equal(getProductSlug(item), 'produk-contoh-uji');
    assert.equal(item.promo, '10%');
    assert.deepEqual(item.referensiUkuran, ['180x50']);
    assert.deepEqual(item.customisasi, ['Lurus', 'L-Shape']);
    assert.deepEqual(item.include, ['Engsel soft-close']);

    const serialized = serializeProductForJson(item);
    assert.equal('slug' in serialized, false);
    assert.equal('unggulan' in serialized, false);
    assert.equal('daftarGambar' in serialized, false);
    assert.equal('daftarVideo' in serialized, false);
    assert.equal('gambarSampul' in serialized, true);
    assert.equal('3d' in serialized, true);
    assert.equal(serialized['3d'], '');
    assert.equal('meterLari' in serialized, true);
    assert.equal(serialized.meterLari, false);
    assert.equal('media' in serialized, true);
    assert.equal(serialized.promo, '10%');
  }

  const parsed3dAlias = parseProductCatalog([
    {
      id: 'demo-3d-alias',
      nama: 'Kursi 3D',
      kategori: 'Ruang Tamu',
      deskripsiSingkat: 'Kursi dengan model 3D',
      'gambar-3d': 'https://cdn.example.com/kursi.glb',
    },
    {
      id: 'demo-3d-short',
      nama: 'Meja 3D',
      kategori: 'Ruang Tamu',
      deskripsiSingkat: 'Meja dengan model 3D',
      '3d': 'https://cdn.example.com/meja.glb',
    },
  ]);
  assert.equal(parsed3dAlias.status, 'success');
  if (parsed3dAlias.status === 'success') {
    assert.equal(parsed3dAlias.catalog.daftarProduk[0]['3d'], 'https://cdn.example.com/kursi.glb');
    assert.equal(parsed3dAlias.catalog.daftarProduk[1]['3d'], 'https://cdn.example.com/meja.glb');
    assert.equal(
      serializeProductForJson(parsed3dAlias.catalog.daftarProduk[0])['3d'],
      'https://cdn.example.com/kursi.glb'
    );
  }
});

test('getProductCoverImage and resolveProductMediaEntry handle explicit cover, mixed media order, and video detection', () => {
  assert.deepEqual(resolveProductMediaEntry('/produk/gambar/kabinet-dapur-modular.webp'), {
    type: 'image',
    url: '/produk/gambar/kabinet-dapur-modular.webp',
  });
  assert.deepEqual(resolveProductMediaEntry('/hero.webm'), {
    type: 'video',
    url: '/hero.webm',
  });
  assert.deepEqual(resolveProductMediaEntry('https://youtu.be/dQw4w9WgXcQ'), {
    type: 'video',
    url: 'https://youtu.be/dQw4w9WgXcQ',
  });

  assert.equal(
    getProductCoverImage({
      gambarSampul: '/cover.webp',
      media: ['/hero.webm', '/gallery-1.webp'],
    }),
    '/cover.webp'
  );
  assert.equal(
    getProductCoverImage({
      gambarSampul: '',
      media: ['/hero.webm', '/gallery-1.webp'],
    }),
    '/gallery-1.webp'
  );
  assert.equal(
    getProductCoverImage({
      gambarSampul: '',
      media: ['/hero.webm'],
    }),
    null
  );
  assert.deepEqual(
    getProductImageUrls({
      gambarSampul: '/cover.webp',
      media: ['/hero.webm', '/gallery-1.webp', '/cover.webp'],
    }),
    ['/cover.webp', '/gallery-1.webp']
  );
});

test('slugifyProduct and getProductSlug strip all symbols, trim edges, and hyphenate spaces', () => {
  assert.equal(
    slugifyProduct('  Kitchen set (kabinet atas & bawah)!! '),
    'kitchen-set-kabinet-atas-bawah'
  );
  assert.equal(
    slugifyProduct('  Island table / meja bar dapur  '),
    'island-table-meja-bar-dapur'
  );
  assert.equal(
    getProductSlug({ id: 'prod-1', nama: '  Lemari Pakaian (Wardrobe) @2026  ' }),
    'lemari-pakaian-wardrobe-2026'
  );
});
