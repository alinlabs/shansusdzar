import test from 'node:test';
import assert from 'node:assert/strict';
import siteProfileData from '../../../../src/data/bisnis.json';
import type { BusinessConfig } from '../../../../src/types/business';
import type { OperationalInfo, TentangContent } from '../../../../src/types/cms';
import {
  buildNormalizedBusinessConfig,
  buildNormalizedOperationalInfo,
  buildNormalizedTentangContent,
  createEmptyTeamMember,
  deriveMemberInitials,
  normalizeTeamMemberPayload,
  parseCommaSeparatedList,
  parseLineList,
  parseParagraphBlocks,
  upsertTeamMemberList,
  validateTeamMemberDraft,
} from '../../../../src/pages/admin/tentang/logic';

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

  const valid = validateTeamMemberDraft({
    ...empty,
    nama: 'Andi Saputra',
    jabatan: 'Kepala Tukang',
  });
  assert.equal(valid.valid, true);
});

test('normalizeTeamMemberPayload and upsertTeamMemberList maintain team array cleanly', () => {
  const normalized = normalizeTeamMemberPayload({
    id: 'tim-new',
    nama: '  Deni Kurniawan  ',
    inisial: '',
    jabatan: '  Teknisi Instalasi  ',
    fotoProfil: '  /images/atelier-studio-craft.webp  ',
    teksAltFoto: '',
  });
  assert.equal(normalized.nama, 'Deni Kurniawan');
  assert.equal(normalized.inisial, 'DK');
  assert.equal(normalized.fotoProfil, '/images/atelier-studio-craft.webp');
  assert.equal(normalized.teksAltFoto, 'Foto Deni Kurniawan');

  const added = upsertTeamMemberList([], normalized);
  assert.equal(added.length, 1);
  const updated = upsertTeamMemberList(added, { ...normalized, jabatan: 'Supervisor Instalasi' });
  assert.equal(updated.length, 1);
  assert.equal(updated[0].jabatan, 'Supervisor Instalasi');
});

test('unified Profil Usaha normalizers align businessConfig, tentang, and operasional from bisnis.json', () => {
  const baseBiz = structuredClone(siteProfileData.profilUsaha) as BusinessConfig;
  baseBiz.whatsapp.nomorTampil = '0812-3456-7890';
  baseBiz.drafPemilik.jalurFoto = '   ';
  const normalizedBiz = buildNormalizedBusinessConfig(baseBiz);
  assert.equal(normalizedBiz.whatsapp.digitTerstandar, '6281234567890');
  assert.equal(normalizedBiz.whatsapp.urlDasar, 'https://wa.me/6281234567890');
  assert.equal(normalizedBiz.drafPemilik.jalurFoto, '/owner.png');

  const baseTentang = structuredClone(siteProfileData.tentang) as TentangContent;
  const normalizedTentang = buildNormalizedTentangContent(
    baseTentang,
    'Paragraf satu.\n\nParagraf dua.\n\n   ',
    'Misi pertama\nMisi kedua\n'
  );
  assert.deepEqual(normalizedTentang.daftarParagraf, ['Paragraf satu.', 'Paragraf dua.']);
  assert.deepEqual(normalizedTentang.daftarMisi, ['Misi pertama', 'Misi kedua']);

  const baseOp = structuredClone(siteProfileData.operasional) as OperationalInfo;
  const normalizedOp = buildNormalizedOperationalInfo(baseOp, 'Purwakarta, Karawang , , Subang ');
  assert.deepEqual(normalizedOp.areaJangkauanSurvei, ['Purwakarta', 'Karawang', 'Subang']);
  assert.equal('ringkasanTerminPembayaran' in siteProfileData.operasional, false);
  assert.equal('ringkasanTerminPembayaran' in normalizedOp, false);
  assert.ok(normalizedOp.estimasiWaktuProduksi.length > 0);
  assert.ok(normalizedOp.ringkasanGaransi.length > 0);
});

test('text list parsers trim and discard blank entries', () => {
  assert.deepEqual(parseParagraphBlocks('A\n\n\nB'), ['A', 'B']);
  assert.deepEqual(parseLineList('Satu\n\nDua'), ['Satu', 'Dua']);
  assert.deepEqual(parseCommaSeparatedList('A, B, , C'), ['A', 'B', 'C']);
});
