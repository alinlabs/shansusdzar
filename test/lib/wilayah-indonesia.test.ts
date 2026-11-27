import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCityFromWilayah,
  formatDesaKotaLabel,
  formatFullWilayahAddress,
  formatKabupatenShort,
  hasStructuredWilayahAddress,
  normalizeClientWilayahAddress,
  unwrapEmsifaListResponse,
} from '../../src/lib/wilayah-indonesia.ts';

test('unwrapEmsifaListResponse parses Emsifa v2 data wrapper and rejects malformed payloads', () => {
  const parsed = unwrapEmsifaListResponse({
    data: [
      { id: '32', name: 'Jawa Barat' },
      { id: '', name: 'Invalid' },
      { id: '31', name: 'DKI Jakarta' },
    ],
    meta: { level: 1, updated_at: '2026-09-03' },
  });

  assert.deepEqual(parsed, [
    { id: '32', name: 'Jawa Barat' },
    { id: '31', name: 'DKI Jakarta' },
  ]);

  assert.throws(() => unwrapEmsifaListResponse(null));
  assert.throws(() => unwrapEmsifaListResponse({ meta: {} }));
});

test('formatKabupatenShort normalizes Kabupaten prefix to Kab. and preserves Kota', () => {
  assert.equal(formatKabupatenShort('Kabupaten Purwakarta'), 'Kab. Purwakarta');
  assert.equal(formatKabupatenShort('Kota Bandung'), 'Kota Bandung');
  assert.equal(formatKabupatenShort('  Kabupaten Karawang  '), 'Kab. Karawang');
  assert.equal(formatKabupatenShort(''), '');
});

test('formatDesaKotaLabel formats [Desa, kota] with fallbacks', () => {
  assert.equal(
    formatDesaKotaLabel(
      {
        provinsi: { id: '32', name: 'Jawa Barat' },
        kabupaten: { id: '32.14', name: 'Kabupaten Purwakarta' },
        kecamatan: { id: '32.14.13', name: 'Bungursari' },
        desa: { id: '32.14.13.2007', name: 'Cinangka', postalCode: '41181' },
        detail: 'Perumahan Bukit Indah Blok C4',
      },
      'Purwakarta'
    ),
    'Cinangka, Kab. Purwakarta'
  );

  assert.equal(
    formatDesaKotaLabel(
      {
        provinsi: { id: '32', name: 'Jawa Barat' },
        kabupaten: { id: '32.75', name: 'Kota Bekasi' },
        kecamatan: { id: '32.75.10', name: 'Jatisampurna' },
        desa: { id: '32.75.10.1002', name: 'Jatikarya', postalCode: '17435' },
      },
      'Cibubur'
    ),
    'Jatikarya, Kota Bekasi'
  );

  assert.equal(formatDesaKotaLabel(undefined, 'Karawang Barat'), 'Karawang Barat');
});

test('formatFullWilayahAddress & formatCityFromWilayah produce readable document and directory strings', () => {
  const sample = {
    provinsi: { id: '32', name: 'Jawa Barat' },
    kabupaten: { id: '32.14', name: 'Kabupaten Purwakarta' },
    kecamatan: { id: '32.14.13', name: 'Bungursari' },
    desa: { id: '32.14.13.2007', name: 'Cinangka', postalCode: '41181' },
    detail: 'Perumahan Bukit Indah Blok C4',
  };

  assert.equal(
    formatFullWilayahAddress(sample),
    'Perumahan Bukit Indah Blok C4, Cinangka, Kec. Bungursari, Kabupaten Purwakarta, Jawa Barat 41181'
  );
  assert.equal(formatCityFromWilayah(sample, 'Purwakarta'), 'Kab. Purwakarta');
});

test('normalizeClientWilayahAddress enforces cascading hierarchy integrity', () => {
  assert.equal(normalizeClientWilayahAddress(undefined), undefined);
  assert.equal(normalizeClientWilayahAddress({ detail: '   ' }), undefined);

  const brokenHierarchy = normalizeClientWilayahAddress({
    kabupaten: { id: '32.14', name: 'Kabupaten Purwakarta' },
    desa: { id: '32.14.01.1001', name: 'Nagri Kidul' },
    detailAlamat: '  Jl. Veteran No. 10  ',
  } as Parameters<typeof normalizeClientWilayahAddress>[0]);
  assert.deepEqual(brokenHierarchy, {
    detail: 'Jl. Veteran No. 10',
  });

  const clean = normalizeClientWilayahAddress({
    provinsi: { id: '32', name: ' Jawa Barat ' },
    kabupaten: { id: '32.73', name: 'Kota Bandung' },
    kecamatan: { id: '32.73.08', name: 'Cidadap' },
    desa: { id: '32.73.08.1001', name: 'Hegarmanah', postalCode: ' 40141 ' },
  });
  assert.equal(hasStructuredWilayahAddress(clean), true);
  assert.deepEqual(clean, {
    provinsi: { id: '32', name: 'Jawa Barat' },
    kabupaten: { id: '32.73', name: 'Kota Bandung' },
    kecamatan: { id: '32.73.08', name: 'Cidadap' },
    desa: { id: '32.73.08.1001', name: 'Hegarmanah', postalCode: '40141' },
  });
});
