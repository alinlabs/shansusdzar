import assert from 'node:assert/strict';
import test from 'node:test';
import { BUSINESS_CONFIG } from '../../../../../src/lib/business-config';
import {
  applyPaymentSchemeToAgreement,
  computeAgreementProductsTotal,
  computeTerminTotalPercent,
  createEmptyAgreement,
  createEmptyAgreementProductItem,
  filterAgreements,
  normalizeAgreementPayload,
  validateAgreementDraft,
} from '../../../../../src/pages/admin/dokumen/spks/logic';

test('validateAgreementDraft catches missing second party and project title', () => {
  const draft = createEmptyAgreement(10, BUSINESS_CONFIG);
  const res = validateAgreementDraft(draft);
  assert.equal(res.valid, false);
  assert.ok(res.fieldErrors.namaPihakKedua);
  assert.ok(res.fieldErrors.judulProyek);
});

test('normalizeAgreementPayload trims text and filters empty clauses', () => {
  const draft = createEmptyAgreement(11, BUSINESS_CONFIG);
  draft.namaPihakKedua = '  Bapak Hendra  ';
  draft.judulProyek = '  Interior Pantry Kantor  ';
  draft.daftarPasal.push({ id: 'empty', judulPasal: '  ', isiPasal: ' ' });

  assert.equal(validateAgreementDraft(draft).valid, true);
  const normalized = normalizeAgreementPayload(draft);
  assert.equal(normalized.namaPihakKedua, 'Bapak Hendra');
  assert.equal(normalized.judulProyek, 'Interior Pantry Kantor');
  assert.equal(normalized.daftarPasal.length, 8);
  assert.equal(computeTerminTotalPercent(normalized), 100);
});

test('normalizeAgreementPayload preserves and normalizes daftarProduk with finishing color codes', () => {
  const draft = createEmptyAgreement(12, BUSINESS_CONFIG);
  draft.namaPihakKedua = 'Ibu Ratna';
  draft.judulProyek = 'Kitchen Set & Credenza';

  const product = createEmptyAgreementProductItem();
  product.namaProduk = '  Kitchen Set Bawah  ';
  product.dimensi = '300 x 60 x 85 cm';
  product.customisasi = '  Letter L Standar  ';
  product.material = '  Multipleks  ';
  product.finishing = '  HPL  ';
  product.kodeWarna = '  TH 015 AA  ';
  product.spesifikasiMaterial = '  Multipleks 18 MM, Engsel Slow-Motion Huben  ';
  product.jumlah = 2;
  product.hargaSatuan = 8500000;

  const emptyProduct = createEmptyAgreementProductItem();
  emptyProduct.namaProduk = '   ';

  draft.daftarProduk = [product, emptyProduct];

  const normalized = normalizeAgreementPayload(draft);
  assert.equal(normalized.daftarProduk?.length, 1);
  assert.equal(normalized.daftarProduk?.[0].namaProduk, 'Kitchen Set Bawah');
  assert.equal(normalized.daftarProduk?.[0].finishing, 'HPL');
  assert.equal(normalized.daftarProduk?.[0].kodeWarna, 'TH 015 AA');
  assert.equal(normalized.daftarProduk?.[0].dimensi, '300 x 60 x 85');
  assert.equal(normalized.daftarProduk?.[0].subtotal, 17000000);
  assert.equal(computeAgreementProductsTotal(normalized.daftarProduk), 17000000);
});

test('filterAgreements matches query and status filter', () => {
  const a = createEmptyAgreement(1, BUSINESS_CONFIG);
  a.judulProyek = 'Kontrak Villa Lembang';
  a.namaPihakKedua = 'Ibu Sari';
  a.status = 'Ditandatangani';

  const b = createEmptyAgreement(2, BUSINESS_CONFIG);
  b.judulProyek = 'Renovasi Pantry';
  b.namaPihakKedua = 'PT Maju';
  b.status = 'Draf';

  assert.equal(filterAgreements([a, b], 'lembang', 'all').length, 1);
  assert.equal(filterAgreements([a, b], '', 'Draf').length, 1);
});

test('applyPaymentSchemeToAgreement syncs 4-stage schedule, legacy percents, and Pasal 2', () => {
  const draft = createEmptyAgreement(15, BUSINESS_CONFIG);
  assert.equal(draft.tahapanPembayaran?.length, 4);
  assert.equal(draft.persenDp, 30);
  assert.equal(draft.persenProgres, 60);
  assert.equal(draft.persenPelunasan, 10);

  const customScheme = {
    judul: 'Skema Custom',
    catatan: 'Transfer rekening studio',
    tahapan: [
      { id: 'dp', urutan: 1, nama: 'DP', persentase: 40, keterangan: 'Saat kontrak' },
      { id: 't2', urutan: 2, nama: 'Produksi', persentase: 50, keterangan: 'Produksi 60%' },
      { id: 't3', urutan: 3, nama: 'BAST', persentase: 10, keterangan: 'Serah terima BAST' },
    ],
  };

  const synced = applyPaymentSchemeToAgreement(draft, customScheme);
  assert.equal(synced.persenDp, 40);
  assert.equal(synced.persenProgres, 50);
  assert.equal(synced.persenPelunasan, 10);
  assert.equal(computeTerminTotalPercent(synced), 100);
  const pasal2 = synced.daftarPasal.find((p) => p.judulPasal.includes('Pasal 2'));
  assert.ok(pasal2?.isiPasal.includes('40%'));
  assert.ok(pasal2?.isiPasal.includes('Transfer rekening studio'));
});

test('SPKS defaults Pihak Pertama phone and enforces Pihak Kedua PIC for perusahaan & instansi', () => {
  const empty = createEmptyAgreement(16, BUSINESS_CONFIG);
  assert.equal(empty.teleponPihakPertama, BUSINESS_CONFIG.whatsapp.nomorTampil);
  assert.equal(empty.jenisPihakKedua, 'pribadi');

  const companyDraft = createEmptyAgreement(17, BUSINESS_CONFIG);
  companyDraft.jenisPihakKedua = 'perusahaan';
  companyDraft.namaPihakKedua = 'PT Maju Bersama';
  companyDraft.judulProyek = 'Partisi & Pantry Kantor';
  const missingPic = validateAgreementDraft(companyDraft);
  assert.equal(missingPic.valid, false);
  assert.ok(missingPic.fieldErrors.penanggungJawabPihakKedua);

  companyDraft.penanggungJawabPihakKedua = '  Ibu Sinta  ';
  companyDraft.jabatanPihakKedua = '  Procurement Manager  ';
  assert.equal(validateAgreementDraft(companyDraft).valid, true);
  const normalizedCompany = normalizeAgreementPayload(companyDraft);
  assert.equal(normalizedCompany.jenisPihakKedua, 'perusahaan');
  assert.equal(normalizedCompany.namaPerusahaanPihakKedua, 'PT Maju Bersama');
  assert.equal(normalizedCompany.penanggungJawabPihakKedua, 'Ibu Sinta');
  assert.equal(normalizedCompany.jabatanPihakKedua, 'Procurement Manager');

  const personalDraft = normalizeAgreementPayload({
    ...normalizedCompany,
    jenisPihakKedua: 'pribadi',
    namaPihakKedua: 'Bapak Budi',
  });
  assert.equal(personalDraft.jenisPihakKedua, 'pribadi');
  assert.equal(personalDraft.namaPerusahaanPihakKedua, undefined);
  assert.equal(personalDraft.penanggungJawabPihakKedua, undefined);
});

