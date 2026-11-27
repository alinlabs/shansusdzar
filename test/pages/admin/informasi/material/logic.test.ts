import test from 'node:test';
import assert from 'node:assert/strict';
import type { MaterialSpecItem } from '../../../../../src/types/cms';
import {
  createEmptyMaterialDraft,
  normalizeMaterialFromDraft,
  toMaterialFormDraft,
  validateMaterialDraft,
} from '../../../../../src/pages/admin/informasi/material/logic';

test('material draft preserves terbuatDari, kelebihan, and gambarReferensi across round-trip', () => {
  const source: MaterialSpecItem = {
    id: 'mat-pvc',
    nama: 'PVC Board Premium',
    kategori: 'papan',
    ketahananLembap: 98,
    peringkatKeawetan: 92,
    keterjangkauan: 65,
    terbuatDari: 'Polivinil klorida padat bebas serat kayu',
    kelebihan: ['Anti rayap permanen', 'Tahan air penuh'],
    gambarReferensi: '/tips-interior/pvc-board.webp',
    cocokUntuk: ['Area Sink Dapur', 'Kabinet Kamar Mandi'],
    ringkasan: 'Papan polimer tahan air.',
    tipsPerawatan: 'Lap lembap dengan sabun netral.',
  };

  const draft = toMaterialFormDraft(source);
  assert.equal(draft.terbuatDari, 'Polivinil klorida padat bebas serat kayu');
  assert.equal(draft.kelebihanText, 'Anti rayap permanen\nTahan air penuh');
  assert.equal(draft.gambarReferensi, '/tips-interior/pvc-board.webp');

  const edited = {
    ...draft,
    terbuatDari: '  Resin PVC foam berdensitas tinggi  ',
    kelebihanText: 'Anti rayap\n\n  Anti lembap  \nCocok area basah',
    gambarReferensi: '  /tips-interior/pvc-updated.webp  ',
    ketahananLembap: 110,
    peringkatKeawetan: -4,
  };

  const validation = validateMaterialDraft(edited);
  assert.equal(validation.valid, true);

  const normalized = normalizeMaterialFromDraft(edited);
  assert.equal(normalized.terbuatDari, 'Resin PVC foam berdensitas tinggi');
  assert.deepEqual(normalized.kelebihan, ['Anti rayap', 'Anti lembap', 'Cocok area basah']);
  assert.equal(normalized.gambarReferensi, '/tips-interior/pvc-updated.webp');
  assert.equal(normalized.ketahananLembap, 100);
  assert.equal(normalized.peringkatKeawetan, 0);
});

test('createEmptyMaterialDraft initializes empty terbuatDari, kelebihan, and gambarReferensi safely', () => {
  const empty = createEmptyMaterialDraft();
  assert.equal(empty.terbuatDari, '');
  assert.deepEqual(empty.kelebihan, []);
  assert.equal(empty.kelebihanText, '');
  assert.equal(empty.gambarReferensi, '');

  const invalid = validateMaterialDraft(empty);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.fieldErrors.nama);
});
