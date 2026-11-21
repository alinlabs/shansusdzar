import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyTeamMember,
  deriveMemberInitials,
  normalizeTeamMemberPayload,
  validateTeamMemberDraft,
} from './logic';

test('deriveMemberInitials creates uppercase initials from member name', () => {
  assert.equal(deriveMemberInitials('Fajar Maulana'), 'FM');
  assert.equal(deriveMemberInitials('Aisyah'), 'AI');
  assert.equal(deriveMemberInitials(''), 'TM');
});

test('validateTeamMemberDraft catches empty required fields', () => {
  const empty = createEmptyTeamMember();
  const res = validateTeamMemberDraft(empty);
  assert.equal(res.valid, false);
  assert.ok(res.fieldErrors.nama);
  assert.ok(res.fieldErrors.jabatan);
  assert.ok(res.fieldErrors.biodata);

  const valid = validateTeamMemberDraft({
    ...empty,
    nama: 'Andi Saputra',
    jabatan: 'Kepala Tukang',
    divisi: 'Produksi Kayu',
    biodata: 'Menangani perakitan kabinet Multipleks dan finishing HPL.',
  });
  assert.equal(valid.valid, true);
});

test('normalizeTeamMemberPayload generates default avatarAlt and initials when omitted', () => {
  const normalized = normalizeTeamMemberPayload({
    id: 'tim-new',
    nama: '  Deni Kurniawan  ',
    inisial: '',
    jabatan: '  Teknisi Instalasi  ',
    divisi: '  Pemasangan Lapangan  ',
    biodata: '  Mengawal instalasi kitchen set dan wardrobe. ',
    fotoProfil: '  /images/atelier-studio-craft.webp  ',
    teksAltFoto: '',
  });
  assert.equal(normalized.nama, 'Deni Kurniawan');
  assert.equal(normalized.inisial, 'DK');
  assert.equal(normalized.fotoProfil, '/images/atelier-studio-craft.webp');
  assert.equal(normalized.teksAltFoto, 'Foto Deni Kurniawan');
});
