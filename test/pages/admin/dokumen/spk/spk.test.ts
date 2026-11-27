import assert from 'node:assert/strict';
import test from 'node:test';
import { BUSINESS_CONFIG } from '../../../../../src/lib/business-config';
import {
  createEmptyWorkOrder,
  duplicateWorkOrderDraft,
  filterWorkOrders,
  normalizeWorkOrderPayload,
  validateWorkOrderDraft,
} from '../../../../../src/pages/admin/dokumen/spk/logic';

test('validateWorkOrderDraft catches missing required fields and empty item name', () => {
  const draft = createEmptyWorkOrder(20, BUSINESS_CONFIG);
  const res = validateWorkOrderDraft(draft);
  assert.equal(res.valid, false);
  assert.ok(res.fieldErrors.namaProyek);
  assert.ok(res.fieldErrors.namaKlien);
  assert.ok(res.fieldErrors.daftarItem);
});

test('normalizeWorkOrderPayload trims values and drops empty items', () => {
  const draft = createEmptyWorkOrder(21, BUSINESS_CONFIG);
  draft.namaProyek = '  Kitchen Set Minimalis  ';
  draft.namaKlien = '  Ibu Nadia  ';
  draft.daftarItem = [
    {
      id: 'i-1',
      namaUnit: '  Kabinet Bawah  ',
      dimensi: ' 300x60 ',
      spesifikasiMaterial: ' PVC ',
      jumlah: 2.4,
    },
    {
      id: 'i-2',
      namaUnit: '   ',
      dimensi: '',
      spesifikasiMaterial: '',
      jumlah: 1,
    },
  ];
  const validRes = validateWorkOrderDraft(draft);
  assert.equal(validRes.valid, true);
  const normalized = normalizeWorkOrderPayload(draft);
  assert.equal(normalized.namaProyek, 'Kitchen Set Minimalis');
  assert.equal(normalized.namaKlien, 'Ibu Nadia');
  assert.equal(normalized.daftarItem.length, 1);
  assert.equal(normalized.daftarItem[0].jumlah, 2);
  assert.equal(normalized.daftarItem[0].dimensi, '300 x 60');
});

test('duplicateWorkOrderDraft resets status to Draf with new SPK number', () => {
  const source = createEmptyWorkOrder(10, BUSINESS_CONFIG);
  source.namaProyek = 'Wardrobe Custom';
  source.status = 'Proses Workshop';
  const copy = duplicateWorkOrderDraft(source, 25);
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.status, 'Draf');
  assert.match(copy.nomorSpk, /^SPK\/SDI-K\/025\//);
  assert.equal(copy.namaProyek, 'Wardrobe Custom');
});

test('filterWorkOrders filters by status and search text', () => {
  const a = createEmptyWorkOrder(1, BUSINESS_CONFIG);
  a.namaProyek = 'Kitchen Purwakarta';
  a.status = 'Proses Workshop';
  const b = createEmptyWorkOrder(2, BUSINESS_CONFIG);
  b.namaProyek = 'Credenza Karawang';
  b.status = 'Selesai Produksi';

  assert.equal(filterWorkOrders([a, b], 'purwakarta', 'all').length, 1);
  assert.equal(filterWorkOrders([a, b], '', 'Selesai Produksi').length, 1);
});

test('createEmptyWorkOrder attaches official 30/40/20/10 payment scheme stages', () => {
  const draft = createEmptyWorkOrder(30, BUSINESS_CONFIG);
  assert.equal(draft.tahapanPembayaran?.length, 4);
  assert.deepEqual(
    draft.tahapanPembayaran?.map((s) => s.persentase),
    [30, 40, 20, 10]
  );
  assert.ok(draft.catatanPembayaran && draft.catatanPembayaran.length > 0);
});
