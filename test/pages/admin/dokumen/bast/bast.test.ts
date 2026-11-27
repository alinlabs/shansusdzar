import assert from 'node:assert/strict';
import test from 'node:test';
import { BUSINESS_CONFIG } from '../../../../../src/lib/business-config';
import type { CooperationAgreementDocument, WorkOrderDocument } from '../../../../../src/types/documents';
import type { ProjectInvoice } from '../../../../../src/types/finance';
import {
  buildHandoverPrefillFromAgreement,
  buildHandoverPrefillFromInvoice,
  buildHandoverPrefillFromSpk,
  computeHandoverStats,
  createEmptyHandover,
  filterHandovers,
  normalizeHandoverPayload,
  resolveBastPaymentRecordSummary,
  validateHandoverDraft,
} from '../../../../../src/pages/admin/dokumen/bast/logic';

test('validateHandoverDraft catches missing required fields', () => {
  const draft = createEmptyHandover(5, BUSINESS_CONFIG);
  const res = validateHandoverDraft(draft);
  assert.equal(res.valid, false);
  assert.ok(res.fieldErrors.namaPihakKedua);
  assert.ok(res.fieldErrors.namaProyek);
  assert.ok(res.fieldErrors.daftarItem);
});

test('normalizeHandoverPayload trims fields and removes empty checklist rows', () => {
  const draft = createEmptyHandover(6, BUSINESS_CONFIG);
  draft.namaPihakKedua = '  Ibu Ratna Dewi  ';
  draft.namaProyek = '  Kitchen Set L-Shape  ';
  draft.persentaseSelesai = 120;
  draft.daftarItem = [
    {
      id: 'i1',
      namaUnit: '  Kabinet Bawah  ',
      dimensi: '  320 x 60 cm  ',
      jumlah: 2,
      kondisi: 'Baik & Sesuai',
      catatan: '  Siap pakai  ',
    },
    {
      id: 'i2',
      namaUnit: '   ',
      dimensi: '',
      jumlah: 1,
      kondisi: 'Baik & Sesuai',
      catatan: '',
    },
  ];

  assert.equal(validateHandoverDraft(draft).valid, false);
  assert.ok(validateHandoverDraft(draft).fieldErrors.persentaseSelesai);

  const normalized = normalizeHandoverPayload(draft);
  assert.equal(validateHandoverDraft(normalized).valid, true);
  assert.equal(normalized.namaPihakKedua, 'Ibu Ratna Dewi');
  assert.equal(normalized.namaProyek, 'Kitchen Set L-Shape');
  assert.equal(normalized.persentaseSelesai, 100);
  assert.equal(normalized.daftarItem.length, 1);
  assert.equal(normalized.daftarItem[0].namaUnit, 'Kabinet Bawah');
  assert.equal(normalized.daftarItem[0].dimensi, '320 x 60');
});

test('computeHandoverStats aggregates conditions and unit counts accurately', () => {
  const stats = computeHandoverStats([
    {
      id: 'a',
      namaUnit: 'Unit A',
      dimensi: '100x50',
      jumlah: 2,
      kondisi: 'Baik & Sesuai',
      catatan: '',
    },
    {
      id: 'b',
      namaUnit: 'Unit B',
      dimensi: '120x50',
      jumlah: 1,
      kondisi: 'Perlu Penyetelan Minor',
      catatan: 'Setel engsel',
    },
    {
      id: 'c',
      namaUnit: 'Unit C',
      dimensi: '80x40',
      jumlah: 3,
      kondisi: 'Tertunda / Belum Terpasang',
      catatan: 'Menunggu kaca',
    },
  ]);

  assert.equal(stats.totalRows, 3);
  assert.equal(stats.totalUnits, 6);
  assert.equal(stats.passedRows, 1);
  assert.equal(stats.minorAdjustmentRows, 1);
  assert.equal(stats.pendingRows, 1);
});

test('filterHandovers matches query across number, project, client, and status', () => {
  const a = createEmptyHandover(1, BUSINESS_CONFIG);
  a.nomorBast = 'BAST-SDI-2026-001';
  a.namaProyek = 'Kitchen Set Lembang';
  a.namaPihakKedua = 'Ibu Sari';
  a.nomorSpkReferensi = 'SPK-SDI-2026-010';
  a.status = 'Selesai & Garansi Aktif';

  const b = createEmptyHandover(2, BUSINESS_CONFIG);
  b.nomorBast = 'BAST-SDI-2026-002';
  b.namaProyek = 'Credenza TV Karawang';
  b.namaPihakKedua = 'Bapak Hendra';
  b.status = 'Draf';

  assert.equal(filterHandovers([a, b], 'lembang', 'all').length, 1);
  assert.equal(filterHandovers([a, b], 'SPK-SDI-2026-010', 'all').length, 1);
  assert.equal(filterHandovers([a, b], '', 'Draf').length, 1);
});

test('prefill helpers map SPK work order and SPK contract fields cleanly', () => {
  const base = createEmptyHandover(9, BUSINESS_CONFIG);
  const spk: WorkOrderDocument = {
    id: 'spk-x',
    nomorSpk: 'SPK-SDI-2026-099',
    tanggalTerbit: '2026-11-10',
    tanggalTargetSelesai: '2026-11-25',
    prioritas: 'Normal',
    status: 'Selesai Produksi',
    namaProyek: 'Pantry Kantor',
    namaKlien: 'PT Sejahtera',
    alamatPemasangan: 'Kawasan BIC Purwakarta',
    namaPengawas: 'Hilman Aziz Napis',
    daftarItem: [
      {
        id: 'si-1',
        namaUnit: 'Kabinet Pantry',
        dimensi: '200 x 60 cm',
        spesifikasiMaterial: 'PVC',
        jumlah: 2,
      },
    ],
    catatanTeknis: '',
    ketentuanKeselamatan: '',
  };

  const fromSpk = buildHandoverPrefillFromSpk(spk, base);
  assert.equal(fromSpk.nomorSpkReferensi, 'SPK-SDI-2026-099');
  assert.equal(fromSpk.namaProyek, 'Pantry Kantor');
  assert.equal(fromSpk.namaPihakKedua, 'PT Sejahtera');
  assert.equal(fromSpk.daftarItem.length, 1);
  assert.equal(fromSpk.daftarItem[0].jumlah, 2);

  const spks: CooperationAgreementDocument = {
    id: 'spks-x',
    nomorKontrak: 'SPK-SDI-2026-077',
    jenisPerjanjian: 'Pengadaan Furniture Komersial',
    kotaPenandatanganan: 'Purwakarta',
    tanggalPenandatanganan: '2026-11-01',
    status: 'Aktif Berjalan',
    perusahaanPihakPertama: BUSINESS_CONFIG.namaMerek,
    perwakilanPihakPertama: 'Hilman',
    jabatanPihakPertama: 'Owner',
    alamatPihakPertama: 'Purwakarta',
    namaPihakKedua: 'PT Sejahtera',
    nomorIdentitasPihakKedua: '123',
    jabatanPihakKedua: 'Direktur Operasional',
    teleponPihakKedua: '+62812345678',
    alamatPihakKedua: 'BIC Purwakarta',
    judulProyek: 'Pantry Kantor BIC',
    lokasiProyek: 'BIC Purwakarta',
    nilaiKontrak: 20000000,
    persenDp: 50,
    persenProgres: 30,
    persenPelunasan: 20,
    durasiKerjaHari: 14,
    masaGaransiBulan: 12,
    daftarPasal: [],
    saksiPihakPertama: '',
    saksiPihakKedua: 'Andi',
  };

  const fromSpks = buildHandoverPrefillFromAgreement(spks, fromSpk);
  assert.equal(fromSpks.nomorSpksReferensi, 'SPK-SDI-2026-077');
  assert.equal(fromSpks.masaGaransiBulan, 12);
  assert.equal(fromSpks.teleponPihakKedua, '+62812345678');
});

test('buildHandoverPrefillFromInvoice and resolveBastPaymentRecordSummary reflect post-Termin 4 BAST settlement', () => {
  const base = createEmptyHandover(12, BUSINESS_CONFIG);
  const invoice: ProjectInvoice = {
    id: 'inv-t',
    nomorInvoice: 'INV-SDI-2026-099',
    namaProyek: 'Kitchen Set Cipaisan',
    namaKlien: 'Ibu Santi',
    lokasi: 'Purwakarta',
    nilaiTotalKontrak: 30_000_000,
    tanggalJatuhTempo: '2026-12-10',
    status: 'Lunas',
    nomorSpkReferensi: 'SPK-SDI-2026-099',
    riwayatPembayaran: [
      {
        id: 'p1',
        tanggal: '2026-11-01',
        label: 'Termin 1 : Down Payment 30%',
        nominal: 9_000_000,
        metodePembayaran: 'Transfer Bank',
        catatan: '',
      },
      {
        id: 'p2',
        tanggal: '2026-11-10',
        label: 'Termin 2 : Progres Produksi 40%',
        nominal: 12_000_000,
        metodePembayaran: 'Transfer Bank',
        catatan: '',
      },
      {
        id: 'p3',
        tanggal: '2026-11-20',
        label: 'Termin 3 : Pra-Instalasi 20%',
        nominal: 6_000_000,
        metodePembayaran: 'Transfer Bank',
        catatan: '',
      },
      {
        id: 'p4',
        tanggal: '2026-12-01',
        label: 'Termin 4 : Pelunasan 10%',
        nominal: 3_000_000,
        metodePembayaran: 'Transfer Bank',
        catatan: '',
      },
    ],
    catatan: '',
  };

  const filled = buildHandoverPrefillFromInvoice(invoice, base);
  assert.equal(filled.nomorInvoiceReferensi, 'INV-SDI-2026-099');
  assert.equal(filled.nomorSpksReferensi, 'SPK-SDI-2026-099');
  assert.equal(filled.nilaiKontrakReferensi, 30_000_000);
  assert.equal(filled.riwayatPembayaran?.length, 4);

  const summaryWithInvoice = resolveBastPaymentRecordSummary(filled, invoice);
  assert.equal(summaryWithInvoice.isFullySettled, true);
  assert.equal(summaryWithInvoice.contractValue, 30_000_000);
  assert.equal(summaryWithInvoice.totalPaid, 30_000_000);
  assert.equal(summaryWithInvoice.records.length, 4);

  // Fallback synthesis when a project has no manual riwayatPembayaran yet (e.g., prj-005)
  const withoutHistory = { ...filled, riwayatPembayaran: [] };
  const synthesized = resolveBastPaymentRecordSummary(withoutHistory, null);
  assert.equal(synthesized.isFullySettled, true);
  assert.equal(synthesized.records.length, 4);
  assert.equal(synthesized.totalPaid, 30_000_000);
  assert.match(synthesized.records[0].metodePembayaran, /1905207398/);
  assert.match(synthesized.records[0].metodePembayaran, /7370860534/);

  // Partial riwayatPembayaran (e.g., only Termin 1 & 2 recorded) must still preserve Termin 3 & Termin 4 with exact data dates
  const partialInvoice: ProjectInvoice = {
    ...invoice,
    tanggalTermin: ['2026-10-05', '2026-10-26', '2026-11-24', '2026-11-28'],
    tanggalJatuhTempo: '2026-11-28',
    riwayatPembayaran: invoice.riwayatPembayaran.slice(0, 2),
  };
  const partialBast = {
    ...base,
    nilaiKontrakReferensi: 30_000_000,
    tanggalSerahTerima: '2026-12-15',
    riwayatPembayaran: partialInvoice.riwayatPembayaran,
  };
  const partialSummary = resolveBastPaymentRecordSummary(partialBast, partialInvoice, undefined, {
    tanggalMulai: '2026-10-05',
    tanggalTargetSelesai: '2026-11-28',
    tanggalDokumen: {
      tanggalPenawaran: '2026-10-01',
      tanggalSpk: '2026-10-05',
      tanggalKirim: '2026-11-24',
      tanggalTermin1: '2026-10-05',
      tanggalTermin2: '2026-10-26',
      tanggalTermin3: '2026-11-24',
      tanggalTermin4: '2026-11-28',
    },
  });
  assert.equal(partialSummary.records.length, 4);
  assert.match(partialSummary.records[3].label, /Termin 4/i);
  assert.equal(partialSummary.records[3].tanggal, '2026-11-28');
  assert.equal(partialSummary.records[2].tanggal, '2026-11-24');
});

