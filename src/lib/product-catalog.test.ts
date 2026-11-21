import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BUSINESS_CONFIG, buildMapsSearchUrl, buildWhatsAppUrl } from './business-config';
import { parseProductCatalog } from './product-catalog';

test('business config enforces fixed Shansus Dzar Indonesia facts', () => {
  assert.equal(BUSINESS_CONFIG.namaMerek, 'Shansus Dzar Indonesia');
  assert.equal(
    BUSINESS_CONFIG.alamat.alamatLengkap,
    'Kp. Tegal Jati, RT 19/RW 10, Desa Cibogohilir, Kabupaten Purwakarta, 41162, Indonesia'
  );
  assert.equal(BUSINESS_CONFIG.whatsapp.nomorTampil, '+6285797184059');
  assert.equal(BUSINESS_CONFIG.whatsapp.digitTerstandar, '6285797184059');
  assert.equal(BUSINESS_CONFIG.pengaturanHarga.hargaCustomTerkonfigurasi, false);
  assert.equal(BUSINESS_CONFIG.pengaturanHarga.persentaseDp, null);
  assert.ok(BUSINESS_CONFIG.mediaSosial?.urlFacebook.startsWith('https://'));
  assert.ok(BUSINESS_CONFIG.mediaSosial?.urlInstagram.startsWith('https://'));
  assert.ok(BUSINESS_CONFIG.mediaSosial?.urlTiktok.startsWith('https://'));
});

test('buildWhatsAppUrl encodes text cleanly with exact target number', () => {
  assert.equal(buildWhatsAppUrl(), 'https://wa.me/6285797184059');
  assert.equal(
    buildWhatsAppUrl('Halo Shansus Dzar Indonesia'),
    'https://wa.me/6285797184059?text=Halo%20Shansus%20Dzar%20Indonesia'
  );
  assert.ok(buildMapsSearchUrl().includes('Kabupaten%20Purwakarta'));
});

const EXPECTED_CATALOG_NAMES = [
  'Kitchen set (kabinet atas & bawah)',
  'Island table / meja bar dapur',
  'Lemari pakaian (wardrobe)',
  'Walk-in closet',
  'Backdrop TV',
  'Credenza / meja TV',
  'Divan / rangka tempat tidur',
  'Headboard dinding',
  'Nakas (bedside table)',
  'Meja rias',
  'Meja kerja / meja belajar',
  'Rak buku / rak pajang (display)',
  'Partisi / penyekat ruangan',
  'Wall panel / kisi-kisi dinding',
  'Kabinet bawah tangga',
  'Lemari sepatu',
  'Kabinet wastafel kamar mandi (vanity)',
  'Kabinet ruang cuci (laundry cabinet)',
  'Meja resepsionis',
  'Meja kasir',
  'Booth pameran / gerai',
] as const;

test('public/produk/produk.json parses cleanly with exact 21 catalog units and active starting prices', () => {
  const filePath = path.resolve(process.cwd(), 'public/produk/produk.json');
  const rawText = fs.readFileSync(filePath, 'utf-8');
  const json: unknown = JSON.parse(rawText);
  const result = parseProductCatalog(json);

  assert.equal(result.status, 'success');
  if (result.status === 'success') {
    assert.equal(result.catalog.daftarProduk.length, 21);
    assert.deepEqual(
      result.catalog.daftarProduk.map((p) => p.nama),
      [...EXPECTED_CATALOG_NAMES]
    );
    let promoCount = 0;
    let regularCount = 0;
    for (const product of result.catalog.daftarProduk) {
      assert.deepEqual(product.daftarGambar, []);
      assert.equal(product.harga, null);
      assert.ok(typeof product.hargaMulai === 'number' && product.hargaMulai > 0);
      assert.equal(typeof product.promoAktif, 'boolean');
      if (product.promoAktif) {
        promoCount += 1;
        assert.ok(
          typeof product.hargaMulaiSebelumPromo === 'number' &&
            product.hargaMulaiSebelumPromo > product.hargaMulai
        );
      } else {
        regularCount += 1;
        assert.equal(product.hargaMulaiSebelumPromo, undefined);
      }
      assert.equal(product.statusHarga, 'mulai');
      assert.equal(product.kaitkanHargaCustom, true);
      assert.equal(product.produkContoh, true);
      assert.equal(product.opsiKustom[0]?.id, 'customisasi');
      assert.equal(product.opsiKustom[0]?.label, 'Customisasi');
      assert.equal(product.opsiKustom[1]?.label, 'Material Utama');
    }
    assert.ok(promoCount > 0 && regularCount > 0, 'Catalog must contain both promo and regular items');
    assert.equal(promoCount, 9);
    assert.equal(regularCount, 12);
  }
});

test('parseProductCatalog handles malformed inputs safely without throwing', () => {
  const invalidRoot = parseProductCatalog(null);
  assert.equal(invalidRoot.status, 'error');

  const missingArray = parseProductCatalog({ versiSkema: 2 });
  assert.equal(missingArray.status, 'error');

  const invalidItems = parseProductCatalog({
    versiSkema: 2,
    daftarProduk: [{ invalid: true }],
  });
  assert.equal(invalidItems.status, 'error');
});

test('parseProductCatalog normalizes invalid price status to contact-only', () => {
  const res = parseProductCatalog({
    versiSkema: 2,
    daftarProduk: [
      {
        id: 'demo-1',
        slug: 'demo-1',
        nama: 'Produk Contoh',
        kategori: 'Ruang Tamu',
        deskripsiSingkat: 'Deskripsi contoh',
        harga: 0,
        statusHarga: 'tetap',
      },
    ],
  });

  assert.equal(res.status, 'success');
  if (res.status === 'success') {
    assert.equal(res.catalog.daftarProduk[0].harga, null);
    assert.equal(res.catalog.daftarProduk[0].statusHarga, 'konsultasi');
  }
});
