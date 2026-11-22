import assert from 'node:assert/strict';
import test from 'node:test';
import { BUSINESS_CONFIG } from '../../../../lib/business-config';
import {
  applyPaymentSchemeToAgreement,
  computeTerminTotalPercent,
  createEmptyAgreement,
  filterAgreements,
  normalizeAgreementPayload,
  validateAgreementDraft,
} from './logic';

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
  assert.equal(normalized.daftarPasal.length, 3);
  assert.equal(computeTerminTotalPercent(normalized), 100);
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
