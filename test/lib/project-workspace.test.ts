import assert from 'node:assert/strict';
import test from 'node:test';
import { BUSINESS_CONFIG } from '../../src/lib/business-config';
import {
  DEFAULT_FINANCE_TRANSACTIONS,
  DEFAULT_PROJECT_INVOICES,
} from '../../src/lib/finance-utils';
import { applyInvoiceStageStatusChange } from '../../src/lib/invoice-termin-sync';
import { DEFAULT_PAYMENT_SCHEME } from '../../src/lib/payment-scheme';
import {
  extractDimensionAreaPairCm,
  parseDimensionParts,
} from '../../src/lib/dimension-format';
import {
  buildSeededAutoDocumentsForProjects,
  computeWarrantyEndDateIso,
  resolveProjectProductItems,
} from '../../src/lib/project-documents-auto';
import { computeProjectProductSubtotal } from '../../src/lib/project-products';
import {
  buildProjectBastDraft,
  buildProjectDeliveryOrderDraft,
  buildProjectInvoiceDraft,
  buildProjectJournalEntries,
  buildProjectQuotationDraft,
  buildProjectSpkDraft,
  buildProjectSpksDraft,
  buildProjectTransactionDraft,
  buildProjectWorkspaceData,
  computeProjectJournalTotals,
  computeProjectStatusCounts,
  computeProjectsDirectoryOverview,
  createEmptyWorkshopProject,
  evaluateProjectSchedule,
  filterProjectWorkspaceRows,
  formatClientNameWithCode,
  formatProjectCardCity,
  formatProjectHeaderClientMeta,
  normalizeWorkshopProjectPayload,
  sortProjectWorkspaceRows,
  validateWorkshopProjectDraft,
} from '../../src/lib/project-workspace';
import defaultProjectsData from '../../src/data/proyek.json';
import type { WorkshopProject } from '../../src/types/finance';

const seededProjects = defaultProjectsData as WorkshopProject[];
const seededAuto = buildSeededAutoDocumentsForProjects(
  seededProjects,
  DEFAULT_PROJECT_INVOICES,
  BUSINESS_CONFIG,
  DEFAULT_PAYMENT_SCHEME
);
const seededPenawaran = seededAuto.quotations;
const seededSpks = seededAuto.agreements;
const seededSuratJalan = seededAuto.deliveryOrders;
const seededBast = seededAuto.handoverCertificates;
const seededInvoices = seededAuto.invoices;

test('buildProjectWorkspaceData links auto-generated 8 documents and finances via projectId', () => {
  const prj5 = seededProjects.find((p) => p.id === 'K-001');
  assert.ok(prj5, 'Expected K-001 in seed data');

  const workspace = buildProjectWorkspaceData(prj5, {
    quotations: seededPenawaran,
    agreements: seededSpks,
    workOrders: [],
    deliveryOrders: seededSuratJalan,
    handoverCertificates: seededBast,
    invoices: seededInvoices,
    transactions: DEFAULT_FINANCE_TRANSACTIONS,
    paymentScheme: DEFAULT_PAYMENT_SCHEME,
  });

  assert.equal(workspace.quotations.length, 1);
  assert.equal(workspace.agreements.length, 1);
  assert.equal(workspace.workOrders.length, 0);
  assert.equal(workspace.deliveryOrders.length, 1);
  assert.equal(workspace.handoverCertificates.length, 1);
  assert.equal(workspace.invoices.length, 1);
  assert.equal(workspace.summary.contractValue, 26500000);
  // 1 Penawaran + 1 SPKS + 1 Surat Jalan + 1 BAST + 4 Termin Invoices = 8
  assert.equal(workspace.summary.documentCount, 8);
});

test('buildProjectWorkspaceData calculates paid amount, expenses, and net margin cleanly', () => {
  const prj2 = seededProjects.find((p) => p.id === 'K-005');
  assert.ok(prj2, 'Expected K-005 in seed data');

  const workspace = buildProjectWorkspaceData(prj2, {
    quotations: seededPenawaran,
    agreements: seededSpks,
    workOrders: [],
    deliveryOrders: seededSuratJalan,
    handoverCertificates: seededBast,
    invoices: seededInvoices,
    transactions: DEFAULT_FINANCE_TRANSACTIONS,
    paymentScheme: DEFAULT_PAYMENT_SCHEME,
  });

  assert.equal(workspace.quotations.length, 1);
  assert.equal(workspace.deliveryOrders.length, 1);
  assert.equal(workspace.invoices.length, 1);
  assert.equal(workspace.handoverCertificates.length, 1);
  assert.equal(workspace.summary.contractValue, 24000000);
  assert.equal(workspace.summary.paidAmount, 16800000);
  assert.equal(workspace.summary.remainingBill, 7200000);
  assert.equal(workspace.summary.expenseTotal, 8400000 + 2650000);
  assert.equal(workspace.summary.netMargin, 16800000 - (8400000 + 2650000));
  assert.equal(workspace.summary.progressPercent, 70);
  assert.equal(workspace.summary.documentCount, 8);
});

test('filterProjectWorkspaceRows matches project metadata and auto-generated document numbers', () => {
  const rows = seededProjects.map((proj) =>
    buildProjectWorkspaceData(proj, {
      quotations: seededPenawaran,
      agreements: seededSpks,
      workOrders: [],
      deliveryOrders: seededSuratJalan,
      handoverCertificates: seededBast,
      invoices: seededInvoices,
      transactions: DEFAULT_FINANCE_TRANSACTIONS,
      paymentScheme: DEFAULT_PAYMENT_SCHEME,
    })
  );

  // K-001 has id K-001 & dibuatPada 2026-11-17 -> QUO/SDI-K/001/XI/2026 & INV-T1/SDI-K/001/XI/2026
  const byPrj5Quo = filterProjectWorkspaceRows(rows, 'QUO/SDI-K/001/XI/2026', 'all');
  assert.equal(byPrj5Quo.length, 1);
  assert.equal(byPrj5Quo[0].project.id, 'K-001');

  const byClientCode = filterProjectWorkspaceRows(rows, 'INV-T1/SDI-K/001/XI/2026', 'all');
  assert.equal(byClientCode.length, 1);
  assert.equal(byClientCode[0].project.id, 'K-001');

  // K-005 has id K-005 & dibuatPada 2026-10-05 -> QUO/SDI-K/005/X/2026 & SJI/SDI-K/005/X/2026
  const byQuotation = filterProjectWorkspaceRows(rows, 'QUO/SDI-K/005/X/2026', 'all');
  assert.equal(byQuotation.length, 1);
  assert.equal(byQuotation[0].project.id, 'K-005');

  const byDeliveryOrder = filterProjectWorkspaceRows(rows, 'SJI/SDI-K/005/X/2026', 'all');
  assert.equal(byDeliveryOrder.length, 1);
  assert.equal(byDeliveryOrder[0].project.id, 'K-005');

  const byStatus = filterProjectWorkspaceRows(rows, '', 'Produksi');
  assert.equal(byStatus.length, 1);
  assert.equal(byStatus[0].project.id, 'K-002');
});

test('computeProjectsDirectoryOverview separates project expenses from general workshop expenses', () => {
  const rows = seededProjects.map((proj) =>
    buildProjectWorkspaceData(proj, {
      quotations: seededPenawaran,
      agreements: seededSpks,
      workOrders: [],
      deliveryOrders: seededSuratJalan,
      handoverCertificates: seededBast,
      invoices: seededInvoices,
      transactions: DEFAULT_FINANCE_TRANSACTIONS,
      paymentScheme: DEFAULT_PAYMENT_SCHEME,
    })
  );

  const overview = computeProjectsDirectoryOverview(rows, DEFAULT_FINANCE_TRANSACTIONS);
  assert.equal(overview.totalProjects, 5);
  assert.equal(overview.activeProjects, 3);
  assert.equal(overview.totalRemainingBill > 0, true);
  // Listrik Workshop (3.150.000) has no projectId -> general workshop expenses
  assert.equal(overview.workshopGeneralExpenses, 3150000);
});

test('computeProjectStatusCounts, sortProjectWorkspaceRows, and evaluateProjectSchedule work cleanly', () => {
  const rows = seededProjects.map((proj) =>
    buildProjectWorkspaceData(proj, {
      quotations: seededPenawaran,
      agreements: seededSpks,
      workOrders: [],
      deliveryOrders: seededSuratJalan,
      handoverCertificates: seededBast,
      invoices: seededInvoices,
      transactions: DEFAULT_FINANCE_TRANSACTIONS,
      paymentScheme: DEFAULT_PAYMENT_SCHEME,
    })
  );

  const counts = computeProjectStatusCounts(rows);
  assert.equal(counts.all, 5);
  assert.equal(counts.Perencanaan + counts.Produksi + counts.Instalasi + counts.Selesai, 5);

  const byTarget = sortProjectWorkspaceRows(rows, 'target_asc');
  assert.notEqual(byTarget[0].project.status, 'Selesai');
  assert.equal(byTarget[byTarget.length - 1].project.status, 'Selesai');

  const byRemaining = sortProjectWorkspaceRows(rows, 'remaining_desc');
  assert.equal(byRemaining[0].summary.remainingBill >= byRemaining[1].summary.remainingBill, true);

  assert.equal(
    evaluateProjectSchedule({ status: 'Selesai', tanggalTargetSelesai: '2026-11-01' }, '2026-11-25').state,
    'done'
  );
  assert.equal(
    evaluateProjectSchedule({ status: 'Produksi', tanggalTargetSelesai: '2026-11-20' }, '2026-11-25').state,
    'overdue'
  );
  assert.equal(
    evaluateProjectSchedule({ status: 'Produksi', tanggalTargetSelesai: '2026-11-28' }, '2026-11-25').state,
    'due_soon'
  );
  assert.equal(
    evaluateProjectSchedule({ status: 'Perencanaan', tanggalTargetSelesai: '2026-12-20' }, '2026-11-25').state,
    'on_track'
  );
});

test('project creation validation, product total sync, and normalization work as expected', () => {
  const empty = createEmptyWorkshopProject(6);
  assert.equal(empty.id, 'K-006');
  const invalid = validateWorkshopProjectDraft(empty);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.fieldErrors.namaProyek);
  assert.ok(invalid.fieldErrors.namaKlien);

  assert.equal('koordinat' in empty, false);
  assert.equal(empty.daftarProduk?.[0]?.kodeWarna, '');

  const valid = normalizeWorkshopProjectPayload({
    ...empty,
    namaProyek: '  Partisi Ruang Kerja  ',
    namaKlien: '  Ibu Maya  ',
    nilaiKontrak: 0,
    alamat: {
      provinsi: { id: '32', name: 'Jawa Barat' },
      kabupaten: { id: '32.14', name: 'Kabupaten Purwakarta' },
      kecamatan: { id: '32.14.01', name: 'Purwakarta' },
      desa: { id: '32.14.01.1001', name: 'Nagri Kidul', postalCode: '41111' },
      detail: '  Jl. Veteran Blok A2  ',
    },
    daftarProduk: [
      {
        id: 'p1',
        namaProduk: '  Partisi Kisi Kayu  ',
        dimensi: '240 x 240 cm',
        kodeWarna: '  TH 015 AA  ',
        spesifikasiMaterial: 'Multipleks 18 mm HPL',
        satuan: 'set',
        jumlah: 2,
        hargaSatuan: 6500000,
      },
      {
        id: 'p2',
        namaProduk: '  Meja Resepsionis  ',
        dimensi: '180 x 60 x 110 cm',
        spesifikasiMaterial: 'Multipleks 18 mm HPL',
        satuan: 'unit',
        jumlah: 1,
        hargaSatuan: 5500000,
      },
    ],
  });
  assert.equal(validateWorkshopProjectDraft(valid).valid, true);
  assert.equal(valid.namaProyek, 'Partisi Ruang Kerja');
  assert.equal(valid.namaKlien, 'Ibu Maya');
  assert.equal('koordinat' in valid, false);
  assert.equal(valid.alamat?.detail, 'Jl. Veteran Blok A2');
  assert.equal(valid.nilaiKontrak, 18500000);
  assert.equal(valid.daftarProduk?.length, 2);
  assert.equal(valid.daftarProduk?.[0]?.dimensi, '240 x 240');
  assert.equal(valid.daftarProduk?.[0]?.kodeWarna, 'TH 015 AA');
  assert.equal(valid.daftarProduk?.[1]?.dimensi, '180 x 60 x 110');
  assert.equal(valid.daftarProduk?.[1]?.kodeWarna, '');

  assert.equal('satuan' in (empty.daftarProduk?.[0] ?? {}), false);
  assert.equal('satuan' in (valid.daftarProduk?.[0] ?? {}), false);
  const resolvedItems = resolveProjectProductItems(valid);
  assert.equal(resolvedItems[0]?.satuan, 'Unit');
  assert.equal(resolvedItems[1]?.satuan, 'Unit');

  assert.equal(computeWarrantyEndDateIso('2026-11-08', 6), '2027-05-08');
  assert.equal(computeWarrantyEndDateIso('2026-11-08', 12), '2027-11-08');
  assert.equal(computeWarrantyEndDateIso('2026-08-31', 6), '2027-02-28');

  for (const proj of seededProjects) {
    assert.equal('koordinat' in proj, false, `Unexpected koordinat on ${proj.id}`);
    assert.ok(proj.daftarProduk && proj.daftarProduk.length >= 2, `Expected daftarProduk in ${proj.id}`);
    assert.ok(proj.tanggalDokumen?.tanggalPenawaran, `Expected tanggalDokumen in ${proj.id}`);
    for (const item of proj.daftarProduk) {
      assert.equal('satuan' in item, false, `Unexpected satuan on ${proj.id}/${item.id}`);
      assert.equal('kodeWarna' in item, true, `Expected kodeWarna on ${proj.id}/${item.id}`);
      const dimParts = parseDimensionParts(item.dimensi);
      assert.equal(
        dimParts.every((part) => part.length > 0),
        true,
        `Expected full P x L x T dimension on ${proj.id}/${item.id}, got "${item.dimensi}"`
      );
      const pair = extractDimensionAreaPairCm(item.dimensi);
      assert.deepEqual(
        pair,
        { lengthCm: Math.round(Number(dimParts[0])), widthCm: Math.round(Number(dimParts[2])) },
        `Expected P x T calculation pair on ${proj.id}/${item.id}`
      );
    }
    const prodSum = proj.daftarProduk.reduce(
      (acc, item) => acc + computeProjectProductSubtotal(item),
      0
    );
    assert.equal(prodSum, proj.nilaiKontrak, `Contract mismatch in ${proj.id}`);
    assert.equal('catatan' in proj, false, `Unexpected catatan on ${proj.id}`);
    assert.equal('koordinatorProduksi' in (proj.detailTeknis ?? {}), false);
  }
  for (const inv of seededInvoices) {
    assert.doesNotMatch(inv.catatan ?? '', /Menunggu Termin/i);
  }
});

test('project document & transaction prefill builders inherit projectId and client context', () => {
  const project: WorkshopProject = {
    id: 'K-099',
    namaProyek: 'Walk-in Closet Kamar Utama',
    namaKlien: 'Bapak Arif',
    teleponKlien: '08123456789',
    alamat: {
      provinsi: { id: '32', name: 'Jawa Barat' },
      kabupaten: { id: '32.73', name: 'Kota Bandung' },
    },
    nilaiKontrak: 35000000,
    tanggalMulai: '2026-11-25',
    tanggalTargetSelesai: '2026-12-20',
    status: 'Perencanaan',
    dibuatPada: '2026-11-25T00:00:00.000Z',
  };

  const quoDraft = buildProjectQuotationDraft(project, 4, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME);
  assert.equal(quoDraft.projectId, 'K-099');
  assert.equal(quoDraft.namaProyek, 'Walk-in Closet Kamar Utama');
  assert.equal(quoDraft.daftarItem[0].hargaSatuan, 35000000);

  const spksDraft = buildProjectSpksDraft(project, 10, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME);
  assert.equal(spksDraft.projectId, 'K-099');
  assert.equal(spksDraft.judulProyek, 'Walk-in Closet Kamar Utama');
  assert.equal(spksDraft.nilaiKontrak, 35000000);

  const invDraft = buildProjectInvoiceDraft(project, 99, DEFAULT_PAYMENT_SCHEME);
  assert.equal(invDraft.projectId, 'K-099');
  assert.equal(invDraft.namaKlien, 'Bapak Arif');
  assert.equal(invDraft.nilaiTotalKontrak, 35000000);

  const spkDraft = buildProjectSpkDraft(
    project,
    20,
    BUSINESS_CONFIG,
    DEFAULT_PAYMENT_SCHEME,
    { quotations: [quoDraft], agreements: [spksDraft], invoices: [invDraft] }
  );
  assert.equal(spkDraft.projectId, 'K-099');
  assert.equal(spkDraft.nomorPenawaranReferensi, quoDraft.nomorPenawaran);
  assert.equal(spkDraft.nomorSpksReferensi, spksDraft.nomorKontrak);
  assert.equal(spkDraft.nomorInvoiceReferensi, invDraft.nomorInvoice);
  assert.equal(spkDraft.tanggalMulai, '2026-11-25');

  const sjDraft = buildProjectDeliveryOrderDraft(project, 5, BUSINESS_CONFIG, {
    quotations: [quoDraft],
    agreements: [spksDraft],
    workOrders: [spkDraft],
    invoices: [invDraft],
  });
  assert.equal(sjDraft.projectId, 'K-099');
  assert.equal(sjDraft.nomorSpkReferensi, spksDraft.nomorKontrak);
  assert.equal(sjDraft.nomorInvoiceReferensi, invDraft.nomorInvoice);
  assert.equal(sjDraft.salinanDiarsipkanAdmin, false);

  const bastDraft = buildProjectBastDraft(
    project,
    12,
    BUSINESS_CONFIG,
    DEFAULT_PAYMENT_SCHEME,
    {
      quotations: [quoDraft],
      agreements: [spksDraft],
      workOrders: [spkDraft],
      deliveryOrders: [sjDraft],
      invoices: [invDraft],
    }
  );
  assert.equal(bastDraft.projectId, 'K-099');
  assert.equal(bastDraft.nomorPenawaranReferensi, quoDraft.nomorPenawaran);
  assert.equal(bastDraft.nomorSpksReferensi, spksDraft.nomorKontrak);
  assert.equal(bastDraft.nomorSuratJalanReferensi, sjDraft.nomorSuratJalan);
  assert.equal(bastDraft.nomorInvoiceReferensi, invDraft.nomorInvoice);

  const incomeTx = buildProjectTransactionDraft(project, 'pemasukan', { invoices: [invDraft] });
  assert.equal(incomeTx.projectId, 'K-099');
  assert.equal(incomeTx.jenis, 'pemasukan');
  assert.equal(incomeTx.pihakTerkait, 'Bapak Arif');
  assert.equal(incomeTx.referensiProyek, invDraft.nomorInvoice);
});

test('buildProjectJournalEntries merges income & expense newest-first with accurate running balance', () => {
  assert.deepEqual(buildProjectJournalEntries([]), []);

  const prj1 = seededProjects.find((p) => p.id === 'K-003');
  assert.ok(prj1, 'Expected K-003 in seed data');

  const workspace = buildProjectWorkspaceData(prj1, {
    quotations: seededPenawaran,
    agreements: seededSpks,
    workOrders: [],
    deliveryOrders: seededSuratJalan,
    handoverCertificates: seededBast,
    invoices: seededInvoices,
    transactions: DEFAULT_FINANCE_TRANSACTIONS,
    paymentScheme: DEFAULT_PAYMENT_SCHEME,
  });

  const entries = buildProjectJournalEntries(workspace.transactions);
  assert.equal(entries.length, 6);
  // Sorted newest date first: 2026-11-19 -> 2026-11-05 -> 2026-11-02 -> 2026-10-12 -> 2026-09-29 -> 2026-09-24
  assert.deepEqual(
    entries.map((e) => e.transaction.tanggal),
    ['2026-11-19', '2026-11-05', '2026-11-02', '2026-10-12', '2026-09-29', '2026-09-24']
  );

  // Running balance from oldest to newest:
  // 2026-09-24: +8,700,000 (Selesai) => 8,700,000
  // 2026-09-29: -7,200,000 (Selesai) => 1,500,000
  // 2026-10-12: +11,600,000 (Selesai) => 13,100,000
  // 2026-11-02: -1,450,000 (Tertunda) => 13,100,000 (cashDelta = 0)
  // 2026-11-05: +5,800,000 (Selesai) => 18,900,000
  // 2026-11-19: +2,900,000 (Selesai) => 21,800,000
  assert.equal(entries[5].runningBalance, 8700000);
  assert.equal(entries[4].runningBalance, 1500000);
  assert.equal(entries[3].runningBalance, 13100000);
  assert.equal(entries[2].runningBalance, 13100000);
  assert.equal(entries[2].cashDelta, 0);
  assert.equal(entries[2].debitAmount, 1450000);
  assert.equal(entries[1].runningBalance, 18900000);
  assert.equal(entries[0].runningBalance, 21800000);
  assert.equal(entries[0].creditAmount, 2900000);

  const totals = computeProjectJournalTotals(entries);
  assert.equal(totals.completedIncome, 29000000);
  assert.equal(totals.completedExpense, 7200000);
  assert.equal(totals.pendingIncome, 0);
  assert.equal(totals.pendingExpense, 1450000);
  assert.equal(totals.endingBalance, 21800000);
});

test('applyInvoiceStageStatusChange records paid stage with click date and income transaction', () => {
  const targetInvoice = seededInvoices.find((inv) => inv.projectId === 'K-005');
  assert.ok(targetInvoice, 'Expected invoice for K-005');

  const result = applyInvoiceStageStatusChange({
    invoice: targetInvoice,
    transactions: DEFAULT_FINANCE_TRANSACTIONS,
    stageIndex: 2, // Termin 3 : Pra-Instalasi 20% = 4,800,000
    targetStatus: 'Lunas',
    paymentScheme: DEFAULT_PAYMENT_SCHEME,
    paymentDate: '2026-11-25',
  });

  assert.equal(result.changed, true);
  assert.equal(result.invoice.riwayatPembayaran.length, targetInvoice.riwayatPembayaran.length + 1);
  const addedPayment = result.invoice.riwayatPembayaran[result.invoice.riwayatPembayaran.length - 1];
  assert.equal(addedPayment.tanggal, '2026-11-25');
  assert.equal(addedPayment.nominal, 4800000);

  const addedTx = result.transactions[0];
  assert.equal(addedTx.projectId, 'K-005');
  assert.equal(addedTx.jenis, 'pemasukan');
  assert.equal(addedTx.tanggal, '2026-11-25');
  assert.equal(addedTx.nominal, 4800000);
  assert.equal(addedTx.status, 'Selesai');
});

test('project manual draft builders sync multi-item daftarProduk, tanggalDokumen, detailTeknis, and SPK clauses', () => {
  const richProject: WorkshopProject = {
    id: 'K-120',
    namaProyek: 'Interior Pantry & Kabinet TV Direktur',
    namaKlien: 'Ibu Ratna Dewi',
    teleponKlien: '081377889900',
    alamat: {
      provinsi: { id: '32', name: 'Jawa Barat' },
      kabupaten: { id: '32.15', name: 'Kabupaten Karawang' },
      kecamatan: { id: '32.15.01', name: 'Karawang Barat' },
    },
    nilaiKontrak: 32000000,
    tanggalMulai: '2026-11-01',
    tanggalTargetSelesai: '2026-11-25',
    status: 'Produksi',
    dibuatPada: '2026-11-01T00:00:00.000Z',
    daftarProduk: [
      {
        id: 'p1',
        namaProduk: 'Kabinet Pantry Atas & Bawah',
        dimensi: '280 x 60 x 220 cm',
        spesifikasiMaterial: 'PVC Board 18mm + HPL Taco',
        satuan: 'set',
        jumlah: 1,
        hargaSatuan: 20000000,
      },
      {
        id: 'p2',
        namaProduk: 'Backdrop TV & Credenza',
        dimensi: '240 x 45 x 200 cm',
        spesifikasiMaterial: 'Multipleks 18mm + Wallpanel WPC',
        satuan: 'unit',
        jumlah: 1,
        hargaSatuan: 12000000,
      },
    ],
    tanggalDokumen: {
      tanggalPenawaran: '2026-10-28',
      tanggalSpk: '2026-11-02',
      tanggalKirim: '2026-11-22',
      tanggalTermin1: '2026-11-01',
      tanggalTermin2: '2026-11-12',
      tanggalTermin3: '2026-11-21',
      tanggalTermin4: '2026-11-26',
    },
    detailTeknis: {
      penanggungJawabPengirimanInstalasi: 'Bpk. Hendra Kusuma',
      masaGaransiBulan: 12,
    },
  };

  const normalizedRich = normalizeWorkshopProjectPayload(richProject);
  assert.equal(normalizedRich.tanggalDokumen?.berlakuHingga, '2026-10-31');
  assert.equal(normalizedRich.tanggalDokumen?.tanggalBast, '2026-11-25');
  assert.equal(normalizedRich.tanggalDokumen?.tanggalJatuhTempo, '2026-11-25');
  assert.equal(normalizedRich.detailTeknis?.tanggalGaransiBerakhir, '2027-11-25');

  const tamperedWarranty = normalizeWorkshopProjectPayload({
    ...richProject,
    detailTeknis: {
      ...richProject.detailTeknis,
      masaGaransiBulan: 6,
      tanggalGaransiBerakhir: '2099-01-01',
    },
  });
  assert.equal(tamperedWarranty.detailTeknis?.tanggalGaransiBerakhir, '2027-05-25');

  const customDatesProject: WorkshopProject = {
    ...richProject,
    tanggalDokumen: {
      ...richProject.tanggalDokumen!,
      berlakuHingga: '2026-10-30',
      tanggalBast: '2026-11-27',
      tanggalJatuhTempo: '2026-11-29',
    },
  };
  const customQuo = buildProjectQuotationDraft(customDatesProject, 21, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME);
  const customBast = buildProjectBastDraft(customDatesProject, 22, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME);
  const customInv = buildProjectInvoiceDraft(customDatesProject, 23, DEFAULT_PAYMENT_SCHEME);
  assert.equal(customQuo.berlakuHingga, '2026-10-30');
  assert.equal(customBast.tanggalSerahTerima, '2026-11-27');
  assert.equal(customInv.tanggalJatuhTempo, '2026-11-29');

  const quo = buildProjectQuotationDraft(richProject, 15, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME);
  assert.equal(quo.daftarItem.length, 2);
  assert.equal(quo.tanggalPenawaran, '2026-10-28');
  assert.equal(quo.berlakuHingga, '2026-10-31');
  assert.equal(quo.estimasiDurasiHari, 24);
  assert.match(quo.syaratKetentuan, /12 bulan/i);
  assert.match(quo.catatanTambahan, /gambar kerja final/i);

  const spks = buildProjectSpksDraft(richProject, 16, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME);
  assert.equal(spks.tanggalPenandatanganan, '2026-11-02');
  assert.equal(spks.durasiKerjaHari, 24);
  assert.equal(spks.masaGaransiBulan, 12);
  assert.equal(spks.saksiPihakPertama, '');
  assert.equal(spks.nomorKontrak, 'SPK/SDI-K/120/XI/2026');
  assert.equal(spks.tanggalMulaiKerja, '2026-11-01');
  assert.equal(spks.tanggalSelesaiKerja, '2026-11-25');
  assert.equal(spks.daftarPasal.length, 8);
  assert.match(spks.daftarPasal[0].isiPasal, /Kabinet Pantry Atas & Bawah/);
  assert.match(spks.daftarPasal[0].isiPasal, /Backdrop TV & Credenza/);
  assert.match(spks.daftarPasal[1].isiPasal, /32\.000\.000/);
  assert.match(spks.daftarPasal[5].isiPasal, /12 bulan/);
  assert.match(spks.daftarPasal[6].isiPasal, /Denda Kontraktor/);

  const inv = buildProjectInvoiceDraft(richProject, 17, DEFAULT_PAYMENT_SCHEME);
  assert.equal(inv.rincianItem?.length, 2);
  assert.equal(inv.nilaiTotalKontrak, 32000000);
  assert.equal(inv.tanggalJatuhTempo, '2026-11-25');
  assert.deepEqual(inv.tanggalTermin, ['2026-11-01', '2026-11-12', '2026-11-21', '2026-11-26']);

  const spk = buildProjectSpkDraft(
    richProject,
    18,
    BUSINESS_CONFIG,
    DEFAULT_PAYMENT_SCHEME,
    { quotations: [quo], agreements: [spks], invoices: [inv] }
  );
  assert.equal(spk.daftarItem.length, 2);
  assert.equal(spk.tanggalTerbit, '2026-11-02');
  assert.equal('koordinatorProduksi' in spk, false);
  assert.equal(spk.referensiGambarKerja, 'Shop Drawing Final K-120');

  const sj = buildProjectDeliveryOrderDraft(richProject, 19, BUSINESS_CONFIG, {
    quotations: [quo],
    agreements: [spks],
    workOrders: [spk],
    invoices: [inv],
  });
  assert.equal(sj.tanggalKirim, '2026-11-22');
  assert.equal(sj.penanggungJawabPengirimanInstalasi, 'Bpk. Hendra Kusuma');
  assert.equal(sj.namaPenerimaLapangan, '');
  assert.equal(sj.daftarItem.length, 2);
  assert.doesNotMatch(sj.instruksiPemasangan, /Bpk\. Dedi|Tim Lapangan/);
  assert.match(sj.instruksiPemasangan, /Owner dan Klien/i);
  assert.match(sj.instruksiPemasangan, /verifikasi ulang/i);

  const bast = buildProjectBastDraft(
    richProject,
    20,
    BUSINESS_CONFIG,
    DEFAULT_PAYMENT_SCHEME,
    { quotations: [quo], agreements: [spks], workOrders: [spk], deliveryOrders: [sj], invoices: [inv] }
  );
  assert.equal(bast.tanggalSerahTerima, '2026-11-25');
  assert.equal(bast.masaGaransiBulan, 12);
  assert.equal(bast.saksiPihakPertama, '');
  assert.equal(bast.daftarItem.length, 2);
  assert.match(bast.teksPernyataan, /12 bulan/);
  assert.match(bast.teksPernyataan, /Termin 4/i);
  assert.doesNotMatch(bast.teksPernyataan, /pengajuan pelunasan termin akhir/i);

  for (const seed of seededProjects) {
    const rawDates = (seed.tanggalDokumen ?? {}) as Record<string, unknown>;
    assert.equal('berlakuHingga' in rawDates, false, `${seed.id} should not persist berlakuHingga`);
    assert.equal('tanggalBast' in rawDates, false, `${seed.id} should not persist tanggalBast`);
    assert.equal('tanggalJatuhTempo' in rawDates, false, `${seed.id} should not persist tanggalJatuhTempo`);

    const seedQuo = seededPenawaran.find((q) => q.projectId === seed.id);
    const seedBast = seededBast.find((b) => b.projectId === seed.id);
    const seedInv = seededInvoices.find((i) => i.projectId === seed.id);
    assert.ok(seedQuo && seedBast && seedInv);
    assert.equal(seedBast.tanggalSerahTerima, seed.tanggalTargetSelesai);
    assert.equal(seedInv.tanggalJatuhTempo, seed.tanggalTargetSelesai);
    assert.ok(seedQuo.berlakuHingga < seed.tanggalMulai);
  }
});

test('formatProjectHeaderClientMeta and formatProjectCardCity format [Desa, kota] [kontak] and city cleanly', () => {
  assert.equal(
    formatClientNameWithCode('PT Sinar Cipta Karawang', 'K-005'),
    'PT Sinar Cipta Karawang (K-005)'
  );
  assert.equal(formatClientNameWithCode('PT Sinar Cipta Karawang', ''), 'PT Sinar Cipta Karawang');
  assert.equal(formatClientNameWithCode('', 'K-005'), 'K-005');

  assert.equal(
    formatProjectHeaderClientMeta({
      namaKlien: 'PT Sinar Cipta Karawang',
      teleponKlien: '+628119200450',
      alamat: {
        provinsi: { id: '32', name: 'Jawa Barat' },
        kabupaten: { id: '32.15', name: 'Kabupaten Karawang' },
        kecamatan: { id: '32.15.01', name: 'Karawang Barat' },
        desa: { id: '32.15.01.1011', name: 'Nagasari', postalCode: '41312' },
        detail: 'Jl. Ahmad Yani No. 18',
      },
    }),
    'Nagasari, Kab. Karawang · 0811-9200-450'
  );

  assert.equal(
    formatProjectCardCity({
      alamat: {
        provinsi: { id: '32', name: 'Jawa Barat' },
        kabupaten: { id: '32.15', name: 'Kabupaten Karawang' },
      },
    }),
    'Kab. Karawang'
  );

  assert.equal(
    formatProjectHeaderClientMeta({
      namaKlien: 'Bpk. Hendra',
      teleponKlien: '6281234567890',
      alamat: {
        kabupaten: { id: '32.14', name: 'Kabupaten Purwakarta' },
      },
    }),
    'Kab. Purwakarta · 0812-3456-7890'
  );

  assert.equal(
    formatProjectHeaderClientMeta({
      namaKlien: 'Ibu Ratna',
      teleponKlien: '-',
      alamat: {
        kabupaten: { id: '32.13', name: 'Kabupaten Subang' },
      },
    }),
    'Kab. Subang'
  );
});

test('WorkshopProject supports pribadi, perusahaan, and instansi identity classification with SPK sync', () => {
  const draft = createEmptyWorkshopProject(20);
  assert.equal(draft.jenisKlien, 'pribadi');

  const instansiInvalid: WorkshopProject = {
    ...draft,
    namaProyek: 'Kabinet Ruang Rapat Dinas',
    jenisKlien: 'instansi',
    namaKlien: 'Dinas PUPR Purwakarta',
    penanggungJawabKlien: '',
    alamat: {
      provinsi: { id: '32', name: 'Jawa Barat' },
      kabupaten: { id: '32.14', name: 'Kabupaten Purwakarta' },
      kecamatan: { id: '32.14.01', name: 'Purwakarta' },
      desa: { id: '32.14.01.1001', name: 'Nagri Kidul', postalCode: '41111' },
    },
    daftarProduk: [
      {
        id: 'prd-inst-1',
        namaProduk: 'Meja Rapat Custom',
        dimensi: '360 x 120 x 75',
        spesifikasiMaterial: 'Multipleks 18 MM HPL',
        jumlah: 1,
        hargaSatuan: 18000000,
      },
    ],
  };
  const missingPicRes = validateWorkshopProjectDraft(instansiInvalid);
  assert.equal(missingPicRes.valid, false);
  assert.ok(missingPicRes.fieldErrors.penanggungJawabKlien);

  const normalizedInstansi = normalizeWorkshopProjectPayload({
    ...instansiInvalid,
    penanggungJawabKlien: '  Bapak Agus Salim  ',
    jabatanKlien: '  Kepala Bagian Umum  ',
  });
  assert.equal(validateWorkshopProjectDraft(normalizedInstansi).valid, true);
  assert.equal(normalizedInstansi.jenisKlien, 'instansi');
  assert.equal(normalizedInstansi.penanggungJawabKlien, 'Bapak Agus Salim');
  assert.equal(normalizedInstansi.jabatanKlien, 'Kepala Bagian Umum');

  const spksFromInstansi = buildProjectSpksDraft(
    normalizedInstansi,
    20,
    BUSINESS_CONFIG,
    DEFAULT_PAYMENT_SCHEME
  );
  assert.equal(spksFromInstansi.teleponPihakPertama, BUSINESS_CONFIG.whatsapp.nomorTampil);
  assert.equal(spksFromInstansi.jenisPihakKedua, 'instansi');
  assert.equal(spksFromInstansi.namaPerusahaanPihakKedua, 'Dinas PUPR Purwakarta');
  assert.equal(spksFromInstansi.penanggungJawabPihakKedua, 'Bapak Agus Salim');
  assert.equal(spksFromInstansi.jabatanPihakKedua, 'Kepala Bagian Umum');
});
