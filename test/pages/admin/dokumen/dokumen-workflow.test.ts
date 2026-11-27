import assert from 'node:assert/strict';
import test from 'node:test';
import defaultProjectsData from '../../../../src/data/proyek.json';
import {
  BUSINESS_CONFIG,
  FORMAL_DOCUMENT_HEADER_META,
  formatFormalDocumentAddress,
  formatFormalDocumentContacts,
} from '../../../../src/lib/business-config';
import { DEFAULT_PROJECT_INVOICES } from '../../../../src/lib/finance-utils';
import { DEFAULT_PAYMENT_SCHEME } from '../../../../src/lib/payment-scheme';
import {
  buildAutoProjectDocuments,
  buildDocumentSendText,
  buildDocumentWhatsAppHref,
  buildSeededAutoDocumentsForProjects,
  formatTerminSummaryLine,
} from '../../../../src/lib/project-documents-auto';
import { formatFullWilayahAddress } from '../../../../src/lib/wilayah-indonesia';
import type { ProjectInvoice, WorkshopProject } from '../../../../src/types/finance';
import {
  buildHandoverPrefillFromDeliveryOrder,
  createEmptyHandover,
} from '../../../../src/pages/admin/dokumen/bast/logic';
import { createDefaultPaymentForm } from '../../../../src/pages/admin/dokumen/invoice/logic';
import {
  computeQuotationItemSubtotal,
  computeQuotationTotal,
  createEmptyQuotation,
  normalizeQuotationPayload,
  validateQuotationDraft,
} from '../../../../src/pages/admin/dokumen/penawaran/logic';
import { createEmptyWorkOrder } from '../../../../src/pages/admin/dokumen/spk/logic';
import {
  buildDeliveryOrderPrefillFromAgreement,
  buildDeliveryOrderPrefillFromQuotation,
  computeDeliveryOrderStats,
  createEmptyDeliveryOrder,
  normalizeDeliveryOrderPayload,
  validateDeliveryOrderDraft,
} from '../../../../src/pages/admin/dokumen/surat-jalan/logic';

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

test('Quotation BOQ computes line subtotals, grand total, validation, and payload normalization', () => {
  const empty = createEmptyQuotation(7, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME);
  assert.equal(validateQuotationDraft(empty).valid, false);

  const normalized = normalizeQuotationPayload({
    ...empty,
    nomorPenawaran: ' QUO-SDI-2026-099 ',
    namaProyek: ' Kitchen Set Minimalis ',
    namaKlien: ' Ibu Nadia ',
    daftarItem: [
      {
        id: 'q1',
        namaItem: ' Kabinet Bawah ',
        dimensi: ' 300 x 60 x 85 cm ',
        spesifikasiMaterial: ' Multipleks 18mm + HPL ',
        satuan: ' m1 ',
        jumlah: 3,
        hargaSatuan: 2600000,
      },
      {
        id: 'q2',
        namaItem: '   ',
        dimensi: '',
        spesifikasiMaterial: '',
        satuan: 'unit',
        jumlah: 1,
        hargaSatuan: 999999,
      },
    ],
  });

  assert.equal(validateQuotationDraft(normalized).valid, true);
  assert.equal(normalized.daftarItem.length, 1);
  assert.equal(normalized.daftarItem[0].dimensi, '300 x 60 x 85');
  assert.equal(computeQuotationItemSubtotal(normalized.daftarItem[0]), 7800000);
  assert.equal(computeQuotationTotal(normalized.daftarItem), 7800000);

  const prj5Quo = seededPenawaran.find((q) => q.projectId === 'K-001');
  assert.ok(prj5Quo);
  assert.equal(computeQuotationTotal(prj5Quo.daftarItem), 26500000);
});

test('Delivery Order computes units total, inherits SPK/Quotation, and tracks admin audit copy', () => {
  const empty = createEmptyDeliveryOrder(9, BUSINESS_CONFIG);
  assert.equal(validateDeliveryOrderDraft(empty).valid, false);

  const fromSpks = buildDeliveryOrderPrefillFromAgreement(seededSpks[0], empty);
  assert.equal(fromSpks.nomorSpkReferensi, seededSpks[0].nomorKontrak);
  assert.equal(fromSpks.namaProyek, seededSpks[0].judulProyek);
  assert.equal(fromSpks.namaKlien, seededSpks[0].namaPihakKedua);

  const fromQuo = buildDeliveryOrderPrefillFromQuotation(seededPenawaran[0], empty);
  assert.equal(fromQuo.namaKlien, seededPenawaran[0].namaKlien);
  assert.equal(fromQuo.daftarItem.length, seededPenawaran[0].daftarItem.length);

  const stats = computeDeliveryOrderStats(seededSuratJalan[0].daftarItem);
  assert.equal(stats.totalRows, seededSuratJalan[0].daftarItem.length);
  assert.equal(stats.totalUnits >= stats.totalRows, true);

  const archived = normalizeDeliveryOrderPayload({
    ...fromQuo,
    nomorSpkReferensi: fromSpks.nomorSpkReferensi,
    status: 'Diterima & Diarsipkan',
    salinanDiarsipkanAdmin: false,
  });
  assert.equal(validateDeliveryOrderDraft(archived).valid, true);
  assert.equal(archived.salinanDiarsipkanAdmin, true);
});

test('BAST prefill from Surat Jalan copies items, client data, and delivery reference', () => {
  const emptyBast = createEmptyHandover(8, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME);
  const prefilled = buildHandoverPrefillFromDeliveryOrder(seededSuratJalan[1], emptyBast);

  assert.equal(prefilled.nomorSuratJalanReferensi, seededSuratJalan[1].nomorSuratJalan);
  assert.equal(prefilled.nomorSpkReferensi, seededSuratJalan[1].nomorSpkReferensi);
  assert.equal(prefilled.namaProyek, seededSuratJalan[1].namaProyek);
  assert.equal(prefilled.namaPihakKedua, seededSuratJalan[1].namaKlien);
  assert.equal(prefilled.daftarItem.length, seededSuratJalan[1].daftarItem.length);
});

test('createDefaultPaymentForm targets explicit termin stageIndex when requested', () => {
  const prj2Invoice = DEFAULT_PROJECT_INVOICES.find((inv) => inv.projectId === 'K-005');
  assert.ok(prj2Invoice, 'Expected seeded invoice for K-005');

  // Termin 1 (30%) + Termin 2 (40%) = 70% already paid (16.8M of 24M)
  // Stage index 2 is Termin 3 Pra-Instalasi (20% = 4.8M)
  const termin3Form = createDefaultPaymentForm(prj2Invoice, DEFAULT_PAYMENT_SCHEME, 2);
  assert.match(termin3Form.label, /Termin 3/i);
  assert.equal(termin3Form.amount, 4800000);

  // Stage index 3 is Termin 4 Serah Terima (10% = 2.4M)
  const termin4Form = createDefaultPaymentForm(prj2Invoice, DEFAULT_PAYMENT_SCHEME, 3);
  assert.match(termin4Form.label, /Termin 4/i);
  assert.equal(termin4Form.amount, 2400000);
});

test('buildAutoProjectDocuments provisions complete 8-doc bundle & send links on project creation', () => {
  const newProject: WorkshopProject = {
    id: 'K-077',
    namaProyek: 'Kitchen Set Apartemen Studio',
    namaKlien: 'Ibu Sari Dewi',
    teleponKlien: '0812-3456-7890',
    alamat: {
      provinsi: { id: '32', name: 'Jawa Barat' },
      kabupaten: { id: '32.14', name: 'Kabupaten Purwakarta' },
    },
    nilaiKontrak: 15000000,
    tanggalMulai: '2026-11-26',
    tanggalTargetSelesai: '2026-12-16',
    status: 'Perencanaan',
    dibuatPada: '2026-11-26T00:00:00.000Z',
  };

  const bundle = buildAutoProjectDocuments(newProject, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME);
  assert.equal(bundle.quotation.nomorPenawaran, 'QUO/SDI-K/077/XI/2026');
  assert.equal(bundle.agreement.nomorKontrak, 'SPK/SDI-K/077/XI/2026');
  assert.equal(bundle.agreement.daftarPasal.length, 8);
  assert.equal(bundle.deliveryOrder.nomorSuratJalan, 'SJI/SDI-K/077/XI/2026');
  assert.equal(bundle.deliveryOrder.nomorSpkReferensi, 'SPK/SDI-K/077/XI/2026');
  assert.equal(bundle.handoverCertificate.nomorBast, 'BST/SDI-K/077/XI/2026');
  assert.equal(bundle.invoice.nomorInvoice, 'INV/SDI-K/077/XI/2026');
  assert.equal(bundle.invoice.skemaPembayaran?.length, 4);
  assert.equal(bundle.quotation.daftarItem[0].hargaSatuan, 15000000);

  const clientEightBundle = buildAutoProjectDocuments(
    { ...newProject, id: 'K-008' },
    BUSINESS_CONFIG,
    DEFAULT_PAYMENT_SCHEME
  );
  assert.equal(clientEightBundle.quotation.nomorPenawaran, 'QUO/SDI-K/008/XI/2026');
  assert.equal(clientEightBundle.agreement.nomorKontrak, 'SPK/SDI-K/008/XI/2026');
  assert.equal(clientEightBundle.deliveryOrder.nomorSuratJalan, 'SJI/SDI-K/008/XI/2026');
  assert.equal(clientEightBundle.handoverCertificate.nomorBast, 'BST/SDI-K/008/XI/2026');
  assert.equal(clientEightBundle.invoice.nomorInvoice, 'INV/SDI-K/008/XI/2026');
  assert.equal(clientEightBundle.invoice.projectId, 'K-008');

  const summary = formatTerminSummaryLine(bundle.invoice, 0, DEFAULT_PAYMENT_SCHEME);
  assert.match(summary, /4\.500\.000/);

  const sendMsg = buildDocumentSendText('penawaran', {
    project: newProject,
    businessConfig: BUSINESS_CONFIG,
    docNumber: bundle.quotation.nomorPenawaran,
    detailLine: summary,
  });
  assert.match(sendMsg, /Ibu Sari Dewi/);
  assert.match(sendMsg, /QUO\/SDI-K\/077\/XI\/2026/);

  const waHref = buildDocumentWhatsAppHref(newProject.teleponKlien, sendMsg);
  assert.ok(waHref && waHref.startsWith('https://wa.me/6281234567890?text='));
  assert.equal(buildDocumentWhatsAppHref('', sendMsg), null);
});

test('buildAutoProjectDocuments syncs multi-item products and custom document dates while preserving status and payments', () => {
  const projectWithProducts: WorkshopProject = {
    id: 'K-088',
    namaProyek: 'Kitchen Set & Island Custom',
    namaKlien: 'Bapak Raka',
    teleponKlien: '081299887766',
    alamat: {
      provinsi: { id: '32', name: 'Jawa Barat' },
      kabupaten: { id: '32.14', name: 'Kabupaten Purwakarta' },
    },
    nilaiKontrak: 25000000,
    tanggalMulai: '2026-12-01',
    tanggalTargetSelesai: '2026-12-22',
    status: 'Produksi',
    dibuatPada: '2026-12-01T00:00:00.000Z',
    daftarProduk: [
      {
        id: 'item-a',
        namaProduk: 'Kabinet Dapur Bawah',
        dimensi: '300 x 60 x 85 cm',
        spesifikasiMaterial: 'PVC Board 18 mm + HPL',
        satuan: 'unit',
        jumlah: 1,
        hargaSatuan: 15000000,
      },
      {
        id: 'item-b',
        namaProduk: 'Island Table',
        dimensi: '160 x 80 x 90 cm',
        spesifikasiMaterial: 'Multipleks 18 mm + Solid Surface',
        satuan: 'unit',
        jumlah: 1,
        hargaSatuan: 10000000,
      },
    ],
    tanggalDokumen: {
      tanggalPenawaran: '2026-11-28',
      tanggalSpk: '2026-12-02',
      tanggalKirim: '2026-12-20',
      tanggalTermin1: '2026-12-01',
      tanggalTermin2: '2026-12-10',
      tanggalTermin3: '2026-12-19',
      tanggalTermin4: '2026-12-23',
    },
  };

  const initial = buildAutoProjectDocuments(
    projectWithProducts,
    BUSINESS_CONFIG,
    DEFAULT_PAYMENT_SCHEME
  );

  assert.equal(initial.quotation.daftarItem.length, 2);
  assert.equal(initial.agreement.daftarPasal.length, 8);
  assert.equal(initial.deliveryOrder.daftarItem.length, 2);
  assert.equal(initial.handoverCertificate.daftarItem.length, 2);
  assert.equal(initial.invoice.rincianItem?.length, 2);
  assert.equal(initial.quotation.tanggalPenawaran, '2026-11-28');
  assert.equal(initial.quotation.berlakuHingga, '2026-11-30');
  assert.equal(initial.agreement.tanggalPenandatanganan, '2026-12-02');
  assert.equal(initial.deliveryOrder.tanggalKirim, '2026-12-20');
  assert.equal(initial.handoverCertificate.tanggalSerahTerima, '2026-12-22');
  assert.equal(initial.invoice.tanggalJatuhTempo, '2026-12-22');
  assert.deepEqual(initial.invoice.tanggalTermin, [
    '2026-12-01',
    '2026-12-10',
    '2026-12-19',
    '2026-12-23',
  ]);

  // Simulate manual status + payment progress, then edit project date & item price
  const editedProject: WorkshopProject = {
    ...projectWithProducts,
    daftarProduk: [
      projectWithProducts.daftarProduk![0],
      { ...projectWithProducts.daftarProduk![1], hargaSatuan: 12000000 },
    ],
    tanggalDokumen: {
      ...projectWithProducts.tanggalDokumen!,
      tanggalKirim: '2026-12-21',
    },
  };

  const synced = buildAutoProjectDocuments(editedProject, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME, {
    quotation: { ...initial.quotation, status: 'Disetujui Klien' },
    agreement: { ...initial.agreement, status: 'Aktif Berjalan' },
    deliveryOrder: { ...initial.deliveryOrder, status: 'Dalam Pengiriman' },
    handoverCertificate: initial.handoverCertificate,
    invoice: {
      ...initial.invoice,
      riwayatPembayaran: [
        {
          id: 'pay-1',
          tanggal: '2026-12-01',
          label: 'Termin 1 : Down Payment 30%',
          nominal: 7500000,
          metodePembayaran: 'Transfer Bank',
          catatan: 'DP masuk',
        },
      ],
    },
  });

  assert.equal(synced.quotation.status, 'Disetujui Klien');
  assert.equal(synced.agreement.status, 'Aktif Berjalan');
  assert.equal(synced.deliveryOrder.status, 'Dalam Pengiriman');
  assert.equal(synced.deliveryOrder.tanggalKirim, '2026-12-21');
  assert.equal(synced.invoice.nilaiTotalKontrak, 27000000);
  assert.equal(synced.invoice.riwayatPembayaran.length, 1);
  assert.equal(synced.invoice.status, 'Berjalan');
});

test('Standardized formal documents include thorough contractual & operational clauses bound to project data', async () => {
  const project: WorkshopProject = {
    id: 'K-099',
    namaProyek: 'Kitchen Set & Wardrobe Kantor Direksi',
    namaKlien: 'PT Karya Mandiri',
    teleponKlien: '081122334455',
    alamat: {
      provinsi: { id: '32', name: 'Jawa Barat' },
      kabupaten: { id: '32.15', name: 'Kabupaten Karawang' },
      kecamatan: { id: '32.15.02', name: 'Karawang Timur' },
    },
    nilaiKontrak: 45000000,
    tanggalMulai: '2026-11-10',
    tanggalTargetSelesai: '2026-12-10',
    status: 'Produksi',
    dibuatPada: '2026-11-10T00:00:00.000Z',
  };

  const bundle = buildAutoProjectDocuments(project, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME);

  // Contractual & operational clauses across Penawaran, SPK, SJ, BAST
  assert.match(bundle.quotation.syaratKetentuan, /Masa Berlaku & Pengikatan Harga/i);
  assert.match(bundle.quotation.syaratKetentuan, /SPK\/SDI-K\/099\/XI\/2026/i);
  assert.match(bundle.quotation.syaratKetentuan, /garansi konstruksi/i);
  assert.equal(bundle.agreement.daftarPasal.length, 8);
  assert.match(bundle.agreement.daftarPasal[0].judulPasal, /Ruang Lingkup Pekerjaan/i);
  assert.match(bundle.agreement.daftarPasal[1].isiPasal, /BNI 1905207398/i);
  assert.match(bundle.agreement.daftarPasal[1].isiPasal, /BSI 7370860534/i);
  assert.match(bundle.agreement.daftarPasal[1].isiPasal, /Hilman Aziz Napis/i);
  assert.match(bundle.agreement.daftarPasal[2].isiPasal, /Pengecualian Keterlambatan/i);
  assert.match(bundle.agreement.daftarPasal[3].isiPasal, /Penyesuaian Biaya & Waktu/i);
  assert.match(bundle.agreement.daftarPasal[4].isiPasal, /Kewajiban & Hak Klien/i);
  assert.match(bundle.agreement.daftarPasal[4].isiPasal, /Kewajiban & Hak Kontraktor/i);
  assert.match(bundle.agreement.daftarPasal[5].isiPasal, /Cakupan & Pengecualian/i);
  assert.match(bundle.agreement.daftarPasal[6].isiPasal, /Denda Kontraktor/i);
  assert.match(bundle.agreement.daftarPasal[6].isiPasal, /Denda Klien/i);
  assert.match(bundle.agreement.daftarPasal[6].isiPasal, /Force Majeure/i);
  assert.match(bundle.agreement.daftarPasal[7].isiPasal, /Prosedur Serah Terima/i);
  assert.match(bundle.agreement.daftarPasal[7].isiPasal, /Penyelesaian Perselisihan/i);
  assert.match(bundle.deliveryOrder.instruksiPemasangan ?? '', /SJI\/SDI-K\/099\/XI\/2026/i);
  assert.match(bundle.handoverCertificate.teksPernyataan ?? '', /BAST|serah terima/i);
  assert.match(bundle.handoverCertificate.teksPernyataan ?? '', /Termin 4/i);
  assert.doesNotMatch(
    bundle.handoverCertificate.teksPernyataan ?? '',
    /pengajuan pelunasan termin akhir|Menunggu Pelunasan/i
  );

  const { createEmptyAgreement } = await import('../../../../src/pages/admin/dokumen/spks/logic');
  const agreement = createEmptyAgreement(12, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME);
  assert.equal(agreement.daftarPasal.length, 8);
  assert.match(agreement.daftarPasal[6].judulPasal, /Denda Keterlambatan.*Pembatalan Kontrak/i);
  assert.match(agreement.daftarPasal[7].judulPasal, /Serah Terima Pekerjaan.*Penyelesaian Sengketa/i);

  const pdfModule = await import('../../../../src/lib/pdf/build-workshop-documents-pdf');
  const prepModule = await import('../../../../src/lib/pdf/image-prep');
  const exportModule = await import('../../../../src/lib/project-export');
  const workspaceModule = await import('../../../../src/lib/project-workspace');

  assert.equal(FORMAL_DOCUMENT_HEADER_META.tagline, 'Interior Design & Building');
  assert.equal(
    formatFormalDocumentAddress(BUSINESS_CONFIG.alamat.alamatLengkap),
    'Kp. Tegal Jati, RT. 019/RW. 010, Desa Cibogohilir, Kec. Plered, Kab. Purwakarta, Jawa Barat - 41162.'
  );
  assert.equal(
    formatFormalDocumentContacts(BUSINESS_CONFIG.whatsapp.nomorTampil),
    'www.shansusdzar.com · shansusdzar@gmail.com · 0813-15000-234'
  );

  assert.equal(prepModule.WORKSHOP_BRAND_ASSETS.logoUrl, '/logo-gelap.webp');
  assert.equal(prepModule.WORKSHOP_BRAND_ASSETS.ownerSignatureUrl, '/ttd-owner.webp');
  assert.equal(prepModule.WORKSHOP_BRAND_ASSETS.companyStampUrl, '/stempel.webp');
  assert.equal(prepModule.WORKSHOP_BRAND_ASSETS.bniLogoUrl, '/bni.webp');
  assert.equal(prepModule.WORKSHOP_BRAND_ASSETS.bsiLogoUrl, '/bsi.webp');

  const fittedLandscape = prepModule.fitImageInBox(400, 100, 34, 9.5);
  assert.equal(Math.round(fittedLandscape.width * 10) / 10, 34);
  assert.equal(Math.round(fittedLandscape.height * 10) / 10, 8.5);

  const fittedSquare = prepModule.fitImageInBox(200, 200, 14, 13.5);
  assert.equal(fittedSquare.width, 13.5);
  assert.equal(fittedSquare.height, 13.5);

  assert.equal(await prepModule.prepareTransparentAssetForPdf('/logo-gelap.webp'), null);
  const nodeBrandAssets = await prepModule.loadWorkshopBrandPdfAssets();
  assert.deepEqual(nodeBrandAssets, {
    logo: null,
    ownerSignature: null,
    companyStamp: null,
    bniLogo: null,
    bsiLogo: null,
  });

  // Verify drawFormalSignatures centers companyStamp horizontally without drawing ownerSignature
  const addImageCalls: Array<{ x: number; y: number; w: number; h: number }> = [];
  const sigTextCalls: Array<{ val: string; x: number; align?: string }> = [];
  const fakeDoc = {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    addPage: () => {},
    setFont: () => {},
    setFontSize: () => {},
    setTextColor: () => {},
    setDrawColor: () => {},
    setLineWidth: () => {},
    getTextWidth: () => 30,
    line: () => {},
    text: (val: string, x: number, _y: number, opts?: { align?: string }) => {
      sigTextCalls.push({ val, x, align: opts?.align });
    },
    addImage: (_data: string, _fmt: string, x: number, y: number, w: number, h: number) => {
      addImageCalls.push({ x, y, w, h });
    },
  };
  pdfModule.drawFormalSignatures(
    fakeDoc as never,
    [
      {
        roleHeading: 'PIHAK PERTAMA,',
        signerName: 'Admin',
        includeOwnerSignature: true,
        includeCompanyStamp: true,
      },
      {
        roleHeading: 'PIHAK KEDUA,',
        signerName: 'Klien',
      },
    ],
    100,
    18,
    174,
    277,
    'Purwakarta, 26 November 2026',
    {
      logo: null,
      ownerSignature: { dataUrl: 'data:image/png;base64,SIG', width: 200, height: 100 },
      companyStamp: { dataUrl: 'data:image/png;base64,STAMP', width: 400, height: 100 },
    }
  );
  const cityDateDraw = sigTextCalls.find((t) => t.val === 'Purwakarta, 26 November 2026');
  assert.ok(cityDateDraw);
  assert.equal(cityDateDraw.align, 'center');
  assert.equal(cityDateDraw.x, 18 + 174 / 2);
  assert.equal(addImageCalls.length, 1);
  // First slot centerX = 18 + (174 / 2) / 2 = 61.5
  assert.equal(Math.round((addImageCalls[0].x + addImageCalls[0].w / 2) * 10) / 10, 61.5);

  let sectionLineCalls = 0;
  let sectionTitleDrawn = '';
  const fakeHeadingDoc = {
    addPage: () => {},
    setFont: () => {},
    setFontSize: () => {},
    setTextColor: () => {},
    setDrawColor: () => {},
    setLineWidth: () => {},
    line: () => {
      sectionLineCalls += 1;
    },
    text: (val: string) => {
      sectionTitleDrawn = val;
    },
  };
  const nextY = pdfModule.drawFormalSectionHeading(
    fakeHeadingDoc as never,
    'I. Rincian Pekerjaan',
    50,
    18,
    174,
    () => {}
  );
  assert.equal(sectionTitleDrawn, 'I. RINCIAN PEKERJAAN');
  assert.equal(sectionLineCalls, 0);
  assert.ok(nextY > 50);

  let pageAddCount = 0;
  let headingDrawnY = -1;
  let metaLabelDrawnY = -1;
  const drawnLabels: Array<{ page: number; label: string; y: number }> = [];
  let cursorY = 266;
  const bottomLimit = 277;
  const fakeBreakDoc = {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    getNumberOfPages: () => 1 + pageAddCount,
    addPage: () => {
      pageAddCount += 1;
    },
    setFont: () => {},
    setFontSize: () => {},
    setTextColor: () => {},
    setDrawColor: () => {},
    setLineWidth: () => {},
    splitTextToSize: (val: string) => [val],
    line: () => {},
    text: (val: string | string[], _x: number, yPos: number) => {
      if (val === 'III. SYARAT & KETENTUAN PENAWARAN') {
        headingDrawnY = yPos;
      }
      if (val === 'Perihal') {
        metaLabelDrawnY = yPos;
      }
      if (typeof val === 'string' && val !== ':' && !Array.isArray(val)) {
        drawnLabels.push({ page: 1 + pageAddCount, label: val, y: yPos });
      }
    },
  };
  const statefulEnsureSpace = (needed: number): number => {
    if (cursorY + needed > bottomLimit) {
      fakeBreakDoc.addPage();
      cursorY = 18;
    }
    return cursorY;
  };
  cursorY = 270;
  cursorY = pdfModule.drawFormalSectionHeading(
    fakeBreakDoc as never,
    'III. Syarat & Ketentuan Penawaran',
    cursorY,
    18,
    174,
    statefulEnsureSpace
  );
  assert.equal(pageAddCount, 1);
  assert.equal(headingDrawnY, 18);
  assert.equal(cursorY, 23);

  cursorY = 280;
  cursorY = pdfModule.drawColonMetadataRows(
    fakeBreakDoc as never,
    [{ label: 'Perihal', value: 'Penawaran Harga' }],
    cursorY,
    18,
    18,
    174,
    statefulEnsureSpace
  );
  assert.equal(pageAddCount, 2);
  assert.equal(metaLabelDrawnY, 18);
  assert.ok(cursorY > 18 && cursorY < 30);

  // Verify multi-row drawColonMetadataRows never stacks labels at the same y (regression for SPK overlapping rows)
  const spkMetaStartY = 60;
  const pageCountBeforeSpkMeta = pageAddCount;
  const labelCountBefore = drawnLabels.length;
  const spkMetaEndY = pdfModule.drawColonMetadataRows(
    fakeBreakDoc as never,
    [
      { label: 'Nama Perusahaan', value: 'Shansus Dzar Indonesia', boldValue: true },
      { label: 'Diwakili Oleh', value: 'Hilman Aziz Napis (Pemilik / Owner)' },
      { label: 'Alamat Workshop', value: 'Kp. Tegal Jati Purwakarta' },
    ],
    spkMetaStartY,
    28,
    30,
    164,
    bottomLimit
  );
  assert.equal(pageAddCount, pageCountBeforeSpkMeta);
  const firstPartyLabels = drawnLabels
    .slice(labelCountBefore)
    .filter((entry) =>
      ['Nama Perusahaan', 'Diwakili Oleh', 'Alamat Workshop'].includes(entry.label)
    );
  assert.equal(firstPartyLabels.length, 3);
  assert.ok(firstPartyLabels[0].y === 60);
  assert.ok(firstPartyLabels[1].y > firstPartyLabels[0].y + 4);
  assert.ok(firstPartyLabels[2].y > firstPartyLabels[1].y + 4);
  assert.ok(spkMetaEndY > firstPartyLabels[2].y);

  // Also verify multi-row drawColonMetadataRows wraps cleanly mid-block onto y = 18 when exceeding bottomLimit
  const wrapStartIndex = drawnLabels.length;
  const wrappedEndY = pdfModule.drawColonMetadataRows(
    fakeBreakDoc as never,
    [
      { label: 'Baris 1', value: 'Muat di halaman aktif' },
      { label: 'Baris 2', value: 'Lanjut ke halaman berikutnya' },
    ],
    277,
    18,
    30,
    174,
    bottomLimit
  );
  assert.equal(pageAddCount, pageCountBeforeSpkMeta + 1);
  const wrappedRows = drawnLabels
    .slice(wrapStartIndex)
    .filter((entry) => entry.label === 'Baris 1' || entry.label === 'Baris 2');
  assert.equal(wrappedRows[0].y, 277);
  assert.equal(wrappedRows[1].y, 18);
  assert.ok(wrappedRows[1].page === wrappedRows[0].page + 1);
  assert.ok(wrappedEndY > 18 && wrappedEndY < 26);

  let maxTableRectBottom = 0;
  const fakeTableDoc = {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    addPage: () => {},
    setFillColor: () => {},
    setDrawColor: () => {},
    setLineWidth: () => {},
    setFont: () => {},
    setFontSize: () => {},
    setTextColor: () => {},
    splitTextToSize: (val: string) => [val],
    rect: (_x: number, y: number, _w: number, h: number) => {
      maxTableRectBottom = Math.max(maxTableRectBottom, y + h);
    },
    line: () => {},
    text: () => {},
  };
  const tableNextY = pdfModule.drawFormalGridTable(
    fakeTableDoc as never,
    [
      { header: 'NO', width: 14, align: 'center' },
      { header: 'URAIAN', width: 160 },
    ],
    [[{ text: '1' }, { text: 'Kabinet Atas Dapur' }]],
    60,
    18,
    277,
    { label: 'TOTAL', value: 'Rp 10.000.000', labelSpanCols: 1 }
  );
  assert.ok(maxTableRectBottom > 60);
  assert.ok(
    tableNextY - maxTableRectBottom >= 8.5,
    `Expected >= 8.5mm post-table spacing before next heading, got ${tableNextY - maxTableRectBottom}`
  );

  const listFormatModule = await import('../../../../src/lib/formal-list-format');
  const parsedBlocks = listFormatModule.parseFormalTextBlocks(
    'Paragraf pengantar resmi.\n1. Poin utama pertama.\na. Sub-poin kedua.\n- Poin bullet ketiga.'
  );
  assert.equal(parsedBlocks.length, 4);
  assert.deepEqual(parsedBlocks[0], { kind: 'paragraph', text: 'Paragraf pengantar resmi.' });
  assert.deepEqual(parsedBlocks[1], {
    kind: 'list',
    marker: '1.',
    body: 'Poin utama pertama.',
    level: 0,
  });
  assert.deepEqual(parsedBlocks[2], {
    kind: 'list',
    marker: 'a.',
    body: 'Sub-poin kedua.',
    level: 1,
  });
  assert.deepEqual(parsedBlocks[3], {
    kind: 'list',
    marker: '•',
    body: 'Poin bullet ketiga.',
    level: 0,
  });

  const textCalls: Array<{ text: string; x: number; y: number; page: number; options?: { align?: string; maxWidth?: number } }> = [];
  let listPage = 1;
  const fakeListDoc = {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    addPage: () => {
      listPage += 1;
    },
    setFont: () => {},
    setFontSize: () => {},
    setTextColor: () => {},
    getTextWidth: () => 3.2,
    splitTextToSize: (val: string) =>
      val.startsWith('Poin panjang')
        ? ['Poin panjang baris satu', 'Poin panjang baris dua', 'Poin panjang baris tiga']
        : val.startsWith('Subpoin panjang')
          ? ['Subpoin panjang baris satu', 'Subpoin panjang baris dua']
          : [val],
    text: (val: string, x: number, yPos: number, options?: { align?: string; maxWidth?: number }) => {
      textCalls.push({ text: val, x, y: yPos, page: listPage, options });
    },
  };
  pdfModule.drawParagraphBlock(
    fakeListDoc as never,
    'Paragraf deskripsi.\n1. Poin kontrak pertama.\na. Sub poin.',
    40,
    18,
    174,
    279
  );
  // Paragraph starts at margin (18) and uses justify
  assert.equal(textCalls[0].x, 18);
  assert.equal(textCalls[0].options?.align, 'justify');
  // Top-level list marker indented +4mm (22), body indented +5.5mm (27.5) with justify
  assert.equal(textCalls[1].text, '1.');
  assert.equal(textCalls[1].x, 22);
  assert.equal(textCalls[2].x, 27.5);
  assert.equal(textCalls[2].options?.align, 'justify');
  // Sub-list marker indented +8mm (26), body indented +5.5mm (31.5) with justify
  assert.equal(textCalls[3].text, 'a.');
  assert.equal(textCalls[3].x, 26);
  assert.equal(textCalls[4].x, 31.5);
  assert.equal(textCalls[4].options?.align, 'justify');

  // Verify a single numbered (1.) and lettered (a.) list point splits across 2 pages when even 1 line fits before bottomLimit
  const splitCallsStart = textCalls.length;
  pdfModule.drawParagraphBlock(
    fakeListDoc as never,
    '1. Poin panjang multi baris\na. Subpoin panjang multi baris',
    276,
    18,
    174,
    279
  );
  const splitDraws = textCalls.slice(splitCallsStart);
  assert.equal(splitDraws[0].text, '1.');
  assert.equal(splitDraws[0].page, 1);
  assert.equal(splitDraws[0].y, 276);
  assert.equal(splitDraws[1].text, 'Poin panjang baris satu');
  assert.equal(splitDraws[1].page, 1);
  assert.equal(splitDraws[1].y, 276);
  // Remaining lines of point "1." continue on page 2 at y = 18 with same hanging indent, without repeating "1."
  assert.equal(splitDraws[2].text, 'Poin panjang baris dua Poin panjang baris tiga');
  assert.equal(splitDraws[2].page, 2);
  assert.equal(splitDraws[2].y, 18);
  assert.equal(splitDraws[2].x, 27.5);
  // Sub-point "a." follows right after on page 2
  assert.equal(splitDraws[3].text, 'a.');
  assert.equal(splitDraws[3].page, 2);
  assert.ok(splitDraws[3].y > 18);

  // Verify spacing after a multi-line paragraph matches single-line spacing without phantom enter drift
  const oneLineEnd = pdfModule.drawParagraphBlock(
    fakeListDoc as never,
    'Paragraf pendek.',
    40,
    18,
    174,
    279,
    { fontSize: 9 }
  );
  const threeLineEnd = pdfModule.drawParagraphBlock(
    fakeListDoc as never,
    'Poin panjang multi baris',
    40,
    18,
    174,
    279,
    { fontSize: 9 }
  );
  const lineH9pt = 9 * 0.352778 * 1.15;
  assert.ok(Math.abs(oneLineEnd - 40 - (lineH9pt + 1.0)) < 0.05);
  assert.ok(Math.abs(threeLineEnd - 40 - (3 * lineH9pt + 1.0)) < 0.05);

  // Verify a lettered sub-point (a.) itself can also split across pages right above bottomLimit
  listPage = 1;
  const subSplitStart = textCalls.length;
  pdfModule.drawParagraphBlock(
    fakeListDoc as never,
    'a. Subpoin panjang multi baris',
    278,
    18,
    174,
    279
  );
  const subSplitDraws = textCalls.slice(subSplitStart);
  assert.equal(subSplitDraws[0].text, 'a.');
  assert.equal(subSplitDraws[0].page, 1);
  assert.equal(subSplitDraws[0].y, 278);
  assert.equal(subSplitDraws[1].text, 'Subpoin panjang baris satu');
  assert.equal(subSplitDraws[1].page, 1);
  assert.equal(subSplitDraws[1].y, 278);
  assert.equal(subSplitDraws[2].text, 'Subpoin panjang baris dua');
  assert.equal(subSplitDraws[2].page, 2);
  assert.equal(subSplitDraws[2].y, 18);
  assert.equal(subSplitDraws[2].x, 31.5);

  const sampleWorkOrder = createEmptyWorkOrder(99, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME);
  sampleWorkOrder.namaProyek = project.namaProyek;
  sampleWorkOrder.namaKlien = project.namaKlien;
  sampleWorkOrder.alamatPemasangan = formatFullWilayahAddress(project.alamat);
  sampleWorkOrder.nomorPenawaranReferensi = bundle.quotation.nomorPenawaran;
  sampleWorkOrder.nomorSpksReferensi = bundle.agreement.nomorKontrak;
  sampleWorkOrder.nomorInvoiceReferensi = bundle.invoice.nomorInvoice;
  sampleWorkOrder.nilaiKontrakReferensi = project.nilaiKontrak;

  await assert.doesNotReject(async () => {
    await pdfModule.downloadQuotationPdf(bundle.quotation, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME);
    await pdfModule.downloadWorkOrderPdf(sampleWorkOrder, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME);
    await pdfModule.downloadAgreementPdf(bundle.agreement, BUSINESS_CONFIG, DEFAULT_PAYMENT_SCHEME);
    await pdfModule.downloadDeliveryOrderPdf(bundle.deliveryOrder, BUSINESS_CONFIG);
    await pdfModule.downloadHandoverPdf(
      bundle.handoverCertificate,
      BUSINESS_CONFIG,
      DEFAULT_PAYMENT_SCHEME,
      bundle.invoice
    );
    await pdfModule.downloadProjectInvoicePdf(
      bundle.invoice,
      BUSINESS_CONFIG,
      DEFAULT_PAYMENT_SCHEME
    );
    await pdfModule.downloadTerminInvoicePdf(
      bundle.invoice,
      0,
      BUSINESS_CONFIG,
      DEFAULT_PAYMENT_SCHEME
    );

    const workspace = workspaceModule.buildProjectWorkspaceData(project, {
      quotations: [bundle.quotation],
      workOrders: [],
      agreements: [bundle.agreement],
      deliveryOrders: [bundle.deliveryOrder],
      handoverCertificates: [bundle.handoverCertificate],
      invoices: [bundle.invoice],
      transactions: [],
      paymentScheme: DEFAULT_PAYMENT_SCHEME,
    });
    await exportModule.openProjectSummaryPdf(workspace, BUSINESS_CONFIG);

    // Exercise optional branches: discount + tax on Invoice, client-verified SJ, fallback 7-clause SPK
    await pdfModule.downloadProjectInvoicePdf(
      { ...bundle.invoice, nominalDiskon: 500000, persenPajak: 11 },
      BUSINESS_CONFIG,
      DEFAULT_PAYMENT_SCHEME
    );
    await pdfModule.downloadDeliveryOrderPdf(
      {
        ...bundle.deliveryOrder,
        statusVerifikasiKlien: 'Diterima Lengkap & Baik',
        tanggalVerifikasiKlien: '2026-12-08',
        catatanAuditAdmin: 'Salinan asli bertanda tangan telah diterima admin.',
      },
      BUSINESS_CONFIG
    );
    await pdfModule.downloadWorkOrderPdf(
      { ...sampleWorkOrder, syaratKetentuan: '' },
      BUSINESS_CONFIG,
      DEFAULT_PAYMENT_SCHEME
    );
  });

  const spkContent = pdfModule.buildWorkOrderDocumentContent(sampleWorkOrder, BUSINESS_CONFIG);
  assert.equal(spkContent.leftMeta[0].label, 'Kepada Yth.');
  assert.match(spkContent.leftMeta[0].value, new RegExp(sampleWorkOrder.namaKlien));
  assert.equal(spkContent.rightMeta[0].label, 'Dari / Owner');
  assert.match(spkContent.rightMeta[0].value, /Shansus Dzar Indonesia/);
  assert.match(spkContent.openingText, /ditujukan kepada/i);
  assert.match(spkContent.openingText, /perintah kerja resmi dari Klien/i);
  assert.match(spkContent.openingText, /ditandatangani.*disetujui.*segera dikerjakan/i);
  assert.match(spkContent.closingText, /disampaikan dari Owner/i);
  assert.match(spkContent.closingText, /ditandatangani oleh Klien/i);
  assert.match(spkContent.closingText, /disetujui dan akan segera dikerjakan/i);
  assert.match(spkContent.termsText, /Persetujuan & Perintah Mulai Kerja/i);
  assert.equal(spkContent.signatureSlots.length, 2);
  assert.equal(spkContent.signatureSlots[0].signerName, sampleWorkOrder.namaKlien);
  assert.match(spkContent.signatureSlots[0].subRole ?? '', /Klien \/ Pemberi Kerja/);
  assert.equal(spkContent.signatureSlots[1].signerName, sampleWorkOrder.namaPengawas);
  assert.match(spkContent.signatureSlots[1].subRole ?? '', /Owner \/ Pelaksana/);
  assert.equal(spkContent.signatureSlots[1].includeCompanyStamp, true);

  const sjContent = pdfModule.buildDeliveryOrderDocumentContent(
    { ...bundle.deliveryOrder, penanggungJawabPengirimanInstalasi: 'Bpk. Hendra Kusuma' },
    BUSINESS_CONFIG
  );
  assert.deepEqual(
    sjContent.rightMeta.map((m) => m.label),
    ['Tanggal Kirim', 'Penanggung Jawab', 'Total Muatan']
  );
  assert.deepEqual(
    sjContent.leftMeta.map((m) => m.label),
    ['Nama Proyek', 'Alamat Tujuan', 'Telepon Tujuan']
  );
  const sjCombinedMeta = [...sjContent.leftMeta, ...sjContent.rightMeta]
    .map((m) => `${m.label}: ${m.value}`)
    .join(' | ');
  assert.doesNotMatch(
    sjCombinedMeta,
    /Armada|Sopir|Tim Instalasi|PT Karya Mandiri|Hilman Aziz|Rendi Saputra|Fajar Maulana|Zaki Permana|Nomor Surat|Referensi Kerja|Koord/i
  );
  assert.match(sjCombinedMeta, /Penanggung Jawab: Bpk\. Hendra Kusuma/);
  assert.match(sjContent.openingText, /rincian barang.*benar serta sampai/i);
  assert.equal(sjContent.deliveryStage.heading, 'SAAT PENGIRIMAN (BARANG DATANG)');
  assert.doesNotMatch(sjContent.deliveryStage.heading, /^\d+\./);
  assert.equal(sjContent.deliveryStage.slots.length, 2);
  assert.equal(sjContent.deliveryStage.slots[0].roleHeading, 'Owner');
  assert.equal(sjContent.deliveryStage.slots[0].includeCompanyStamp, true);
  assert.equal(sjContent.deliveryStage.slots[1].roleHeading, 'Klien');
  assert.equal(sjContent.deliveryStage.slots[1].includeCompanyStamp, false);
  assert.equal(sjContent.archiveStage.heading, 'SETELAH INSTALASI SELESAI (ARSIP)');
  assert.doesNotMatch(sjContent.archiveStage.heading, /^\d+\./);
  assert.equal(sjContent.archiveStage.slot.roleHeading, 'Klien');
  assert.equal(sjContent.archiveStage.slot.includeCompanyStamp, false);

  const spksSendMsg = buildDocumentSendText('spks', {
    project,
    businessConfig: BUSINESS_CONFIG,
    docNumber: bundle.agreement.nomorKontrak,
  });
  assert.match(spksSendMsg, /SPK\/SDI-K\/099\/XI\/2026/);
  assert.match(spksSendMsg, /Surat Perjanjian Kerja \(SPK\)/);
  assert.match(spksSendMsg, /PT Karya Mandiri/);

  const spkStructure = pdfModule.buildAgreementDocumentStructure(
    bundle.agreement,
    DEFAULT_PAYMENT_SCHEME
  );
  assert.deepEqual(spkStructure.sectionHeadings, [
    'I. Identitas Para Pihak',
    'II. Ruang Lingkup',
    'III. Nilai Kontrak',
    'IV. Metode Pembayaran',
    'V. Ketentuan-Ketentuan',
  ]);
  assert.equal(spkStructure.clauses.length, 8);
  assert.match(spkStructure.clauses[0].judulPasal, /^Pasal 1/);
  assert.match(spkStructure.clauses[7].judulPasal, /^Pasal 8/);
  assert.match(spkStructure.closingClause.judulPasal, /^Pasal 9/);
  assert.equal(
    spkStructure.transitionText,
    'PIHAK PERTAMA dan PIHAK KEDUA secara bersama-sama disebut (PARA PIHAK) dengan ini sepakat mengikatkan diri dalam Surat Perjanjian Kerja (SPK) dengan pokok kesepakatan dan ketentuan-ketentuan yang berlaku.'
  );
  assert.match(spkStructure.contractValueRows[0].value, /45\.000\.000/);
  assert.equal(spkStructure.paymentBreakdown.length, 4);

  const { buildOrderPdfDataModel } = await import('../../../../src/lib/pdf/order-pdf-data');
  const { buildOrderSummaryPdf } = await import('../../../../src/lib/pdf/build-order-pdf');
  const orderModel = buildOrderPdfDataModel({
    items: [
      {
        kind: 'custom',
        lineId: 'ord-1',
        serviceMode: 'design-and-build',
        serviceModeLabel: 'Desain + Build',
        projectTypeId: 'dapur',
        projectTypeLabel: 'Dapur & Pantry',
        itemTypeId: 'kitchen-set',
        itemTypeLabel: 'Kabinet Dapur',
        dimensions: {
          length: 300,
          width: 60,
          height: 85,
          unit: 'cm',
          normalizedLengthCm: 300,
          normalizedWidthCm: 60,
          normalizedHeightCm: 85,
        },
        materialId: 'multipleks',
        materialLabel: 'Multipleks',
        finishId: 'hpl',
        finishLabel: 'HPL',
        colorId: 'walnut',
        colorName: 'Cokelat Walnut',
        colorHex: '#634E3F',
        additionalOptions: ['Engsel Soft-Close'],
        notes: 'Mohon ukur ulang titik sink',
        quantity: 1,
        designAmount: 750000,
        buildAmount: 14250000,
        estimatedUnitTotal: 15000000,
        estimatedDpAmount: 4500000,
        estimateStatus: 'configured',
      },
    ],
    customer: {
      fullName: 'Bapak Hendra',
      rawPhone: '081234567890',
      normalizedPhone: '+6281234567890',
      address: 'Jl. Veteran No. 12, Purwakarta',
      notes: 'Survei pagi pukul 09.00',
      coordinates: null,
    },
    referenceCode: 'REF-SZ-20261125-0900-1122',
    createdAt: new Date('2026-11-25T09:00:00'),
  });
  const builtOrderPdf = await buildOrderSummaryPdf(orderModel);
  assert.equal(builtOrderPdf.totalPages >= 1, true);
  assert.ok(builtOrderPdf.arrayBuffer.byteLength > 1000);
});

test('splitAccountingRupiahDisplay separates Rp prefix from numeric value cleanly', async () => {
  const { splitAccountingRupiahDisplay } = await import('../../../../src/lib/finance-utils');
  assert.deepEqual(splitAccountingRupiahDisplay('Rp 15.000.000'), {
    symbol: 'Rp',
    amount: '15.000.000',
  });
  assert.deepEqual(splitAccountingRupiahDisplay('Rp\u00a026.500.000'), {
    symbol: 'Rp',
    amount: '26.500.000',
  });
  assert.deepEqual(splitAccountingRupiahDisplay('-Rp\u00a0500.000'), {
    symbol: '-Rp',
    amount: '500.000',
  });
  assert.deepEqual(splitAccountingRupiahDisplay('+Rp 1.250.000'), {
    symbol: '+Rp',
    amount: '1.250.000',
  });
  assert.equal(splitAccountingRupiahDisplay('12 Unit / 2 Paket'), null);
});

test('drawFormalGridTable wraps and centers all headers, uses thin soft bank-statement borders with zebra rows, and splits Rp left / nominal right', async () => {
  const pdfModule = await import('../../../../src/lib/pdf/build-workshop-documents-pdf');
  const calls: Array<{ text: string; x: number; y: number; align?: string }> = [];
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
  const fillColors: Array<[number, number, number]> = [];
  const textColors: Array<[number, number, number]> = [];
  const lineWidths: number[] = [];

  const mockDoc = {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    addPage: () => {},
    setFillColor: (r: number, g: number, b: number) => {
      fillColors.push([r, g, b]);
    },
    setDrawColor: () => {},
    setLineWidth: (w: number) => {
      lineWidths.push(w);
    },
    setFont: () => {},
    setFontSize: () => {},
    setTextColor: (r: number, g: number, b: number) => {
      textColors.push([r, g, b]);
    },
    splitTextToSize: (val: string) =>
      val.includes('PANJANG') ? ['HEADER PANJANG', 'DUA BARIS'] : [val],
    rect: (x: number, y: number, w: number, h: number) => {
      rects.push({ x, y, w, h });
    },
    line: () => {},
    text: (val: string, x: number, y: number, opts?: { align?: string }) => {
      calls.push({ text: val, x, y, align: opts?.align });
    },
  };

  pdfModule.drawFormalGridTable(
    mockDoc as never,
    [
      { header: 'NO', width: 10, align: 'center' },
      { header: 'URAIAN PEKERJAAN PANJANG', width: 100 },
      { header: 'HARGA SATUAN PANJANG', width: 64, align: 'right' },
    ],
    [
      [{ text: '1' }, { text: 'Kabinet Dapur' }, { text: 'Rp 15.000.000', bold: true }],
      [{ text: '2' }, { text: 'Backdrop TV' }, { text: 'Rp 6.500.000', bold: false }],
    ],
    50,
    18,
    277,
    { label: 'TOTAL KONTRAK', value: 'Rp\u00a021.500.000', labelSpanCols: 2 }
  );

  // Header background is #282726 (40,39,38) with white text (255,255,255),
  // rows alternate white (255,255,255) & soft off-white (246,246,245),
  // total row sits below the table with NO background fill and NO border box
  assert.equal(fillColors.length, 3);
  assert.deepEqual(fillColors[0], [40, 39, 38]);
  assert.deepEqual(fillColors[1], [255, 255, 255]);
  assert.deepEqual(fillColors[2], [246, 246, 245]);
  assert.equal(rects.length, 3); // header + 2 data rows only; footer total has no rect/border
  assert.equal(
    textColors.some(([r, g, b]) => r === 255 && g === 255 && b === 255),
    true
  );
  // Thin hairline borders (max <= 0.25mm)
  assert.ok(lineWidths.length > 0 && lineWidths.every((w) => w <= 0.25));

  // Header height expands above 7.5mm when header wraps onto 2 lines
  assert.ok(rects[0].h > 7.5, `Expected wrapped header height > 7.5mm, got ${rects[0].h}`);

  // All headers centered at column midpoint regardless of column body align
  const noHeader = calls.find((c) => c.text === 'NO');
  assert.equal(noHeader?.align, 'center');
  assert.equal(noHeader?.x, 18 + 5);

  const wrappedColHeader = calls.filter((c) => c.text === 'HEADER PANJANG' || c.text === 'DUA BARIS');
  assert.equal(wrappedColHeader.length, 4); // 2 lines on col 2 + 2 lines on col 3
  assert.ok(wrappedColHeader.every((c) => c.align === 'center'));

  // Body row 1 cell splits Rp (left) and 15.000.000 (right) on the same baseline
  const bodyCalls = calls.filter((c) => c.y >= rects[1].y && c.y <= rects[1].y + rects[1].h);
  const bodyRp = bodyCalls.find((c) => c.text === 'Rp');
  const bodyAmt = bodyCalls.find((c) => c.text === '15.000.000');
  assert.ok(bodyRp && bodyAmt);
  assert.equal(bodyRp.align, 'left');
  assert.equal(bodyRp.x, 18 + 10 + 100 + 2);
  assert.equal(bodyAmt.align, 'right');
  assert.equal(bodyAmt.x, 18 + 174 - 2);
  assert.equal(bodyRp.y, bodyAmt.y);

  // Footer total sits below row 2 with no rect/border box, aligned to columns and split Rp / 21.500.000
  const lastBodyBottomY = rects[2].y + rects[2].h;
  const footerCalls = calls.filter((c) => c.y > lastBodyBottomY);
  const footerLabel = footerCalls.find((c) => c.text === 'TOTAL KONTRAK');
  const footerRp = footerCalls.find((c) => c.text === 'Rp');
  const footerAmt = footerCalls.find((c) => c.text === '21.500.000');
  assert.ok(footerLabel && footerRp && footerAmt);
  assert.equal(footerLabel.align, 'right');
  assert.equal(footerRp.align, 'left');
  assert.equal(footerAmt.align, 'right');
});

test('drawFormalGridTable does not repeat dark header row when table splits across pages', async () => {
  const pdfModule = await import('../../../../src/lib/pdf/build-workshop-documents-pdf');
  const headerFills: number[] = [];
  const headerTexts: string[] = [];
  let pageCount = 1;

  const mockDoc = {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    addPage: () => {
      pageCount += 1;
    },
    setFillColor: (r: number, g: number, b: number) => {
      if (r === 40 && g === 39 && b === 38) headerFills.push(pageCount);
    },
    setDrawColor: () => {},
    setLineWidth: () => {},
    setFont: () => {},
    setFontSize: () => {},
    setTextColor: () => {},
    splitTextToSize: (val: string) => [val],
    rect: () => {},
    line: () => {},
    text: (val: string) => {
      if (val === 'TAHAPAN PEMBAYARAN') headerTexts.push(val);
    },
  };

  pdfModule.drawFormalGridTable(
    mockDoc as never,
    [
      { header: 'NO', width: 10, align: 'center' },
      { header: 'TAHAPAN PEMBAYARAN', width: 100 },
      { header: 'NOMINAL', width: 64, align: 'right' },
    ],
    [
      [{ text: '1' }, { text: 'Termin 1' }, { text: 'Rp 7.200.000' }],
      [{ text: '2' }, { text: 'Termin 2' }, { text: 'Rp 9.600.000' }],
      [{ text: '3' }, { text: 'Termin 3' }, { text: 'Rp 4.800.000' }],
      [{ text: '4' }, { text: 'Termin 4' }, { text: 'Rp 2.400.000' }],
    ],
    248,
    18,
    277
  );

  assert.ok(pageCount >= 2, 'Expected table to spill onto page 2');
  assert.deepEqual(headerFills, [1]);
  assert.equal(headerTexts.length, 1);
});

test('drawFormalGridTable left-aligns standardized 6-column product total label starting at DIMENSI (cm)', async () => {
  const pdfModule = await import('../../../../src/lib/pdf/build-workshop-documents-pdf');
  const { STANDARD_DOCUMENT_PRODUCT_TABLE_COLUMNS } = await import('../../../../src/lib/document-product-table');
  const calls: Array<{ text: string; x: number; y: number; align?: string }> = [];

  const mockDoc = {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    addPage: () => {},
    setFillColor: () => {},
    setDrawColor: () => {},
    setLineWidth: () => {},
    setFont: () => {},
    setFontSize: () => {},
    setTextColor: () => {},
    splitTextToSize: (val: string) => [val],
    rect: () => {},
    line: () => {},
    text: (val: string, x: number, y: number, opts?: { align?: string }) => {
      calls.push({ text: val, x, y, align: opts?.align });
    },
  };

  pdfModule.drawFormalGridTable(
    mockDoc as never,
    STANDARD_DOCUMENT_PRODUCT_TABLE_COLUMNS,
    [[{ text: '1' }, { text: 'Meja Kerja' }, { text: 'Multiplek' }, { text: '220 x 60 x 75' }, { text: 'Rp 5.500.000' }, { text: 'Rp 11.000.000', bold: true }]],
    50,
    18,
    277,
    { label: 'TOTAL HARGA PENAWARAN', value: 'Rp\u00a011.000.000', labelSpanCols: 5 }
  );

  const totalLabel = calls.find((c) => c.text === 'TOTAL HARGA PENAWARAN');
  assert.ok(totalLabel);
  assert.equal(totalLabel.align, 'left');
  assert.equal(totalLabel.x, 18 + 8 + 53 + 34 + 2);
});

test('drawFormalCostBreakdownTable renders Rincian Komponen Biaya, strikethrough fees without Rp 0, minus left of Rp on Potongan Promo, and total below PPN', async () => {
  const pdfModule = await import('../../../../src/lib/pdf/build-workshop-documents-pdf');
  const fillColors: Array<[number, number, number]> = [];
  const rects: number[] = [];
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const textColors: Array<[number, number, number]> = [];
  const texts: Array<{ val: string; x: number; y: number; align?: string; color: [number, number, number] }> = [];
  let currentColor: [number, number, number] = [0, 0, 0];

  const mockDoc = {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    addPage: () => {},
    setFillColor: (r: number, g: number, b: number) => {
      fillColors.push([r, g, b]);
    },
    setDrawColor: () => {},
    setLineWidth: () => {},
    setFont: () => {},
    setFontSize: () => {},
    setTextColor: (r: number, g: number, b: number) => {
      currentColor = [r, g, b];
      textColors.push(currentColor);
    },
    getTextWidth: (s: string) => s.length * 1.8,
    rect: () => {
      rects.push(1);
    },
    line: (x1: number, y1: number, x2: number, y2: number) => {
      lines.push({ x1, y1, x2, y2 });
    },
    text: (val: string, x: number, y: number, opts?: { align?: string }) => {
      texts.push({ val, x, y, align: opts?.align, color: currentColor });
    },
  };

  pdfModule.drawFormalCostBreakdownTable(
    mockDoc as never,
    {
      surveyFee: 150000,
      surveyRatePercent: 5,
      design3dFee: 500000,
      deliveryFee: 350000,
      deliveryFleetLabel: 'Pickup',
      isPromo: true,
      productPriceAmount: 10000000,
      promoDiscountAmount: 500000,
      priceAfterDiscount: 9500000,
      ppnAmount: 1045000,
      totalAmount: 10545000,
    },
    40,
    18,
    277,
    'TOTAL HARGA PENAWARAN'
  );

  assert.equal(fillColors.length, 0);
  assert.equal(rects.length, 0);
  assert.equal(
    textColors.some(([r, g, b]) => r === 180 && g === 35 && b === 24),
    false
  );
  const joined = texts.map((t) => t.val).join(' | ');
  assert.ok(joined.includes('Rincian Komponen Biaya'));
  assert.equal(joined.includes('Biaya Survei'), false);
  assert.ok(joined.includes('Biaya Desain 3D'));
  assert.ok(joined.includes('Biaya Pengiriman (Pickup)'));
  assert.ok(joined.includes('Harga Produk'));
  assert.ok(joined.includes('Potongan Promo'));
  assert.ok(joined.includes('Harga Setelah Potongan'));
  assert.ok(joined.includes('PPN (11%)'));
  assert.ok(joined.includes('TOTAL HARGA PENAWARAN'));
  assert.equal(joined.includes('Rp 0'), false);
  assert.equal(joined.includes('500.000-'), false);
  assert.equal(joined.includes('Gratis Survei & Pengukuran Lokasi'), false);
  assert.equal(joined.includes('Dasar Pengenaan Pajak'), false);
  assert.equal(joined.includes('KOMPONEN BIAYA'), false);
  assert.equal(joined.includes('KETERANGAN'), false);

  const expectedDimensiTextX = 18 + 8 + 53 + 34 + 2;
  const expectedValLeftX = 18 + 174 - 28 + 2;
  const headingCall = texts.find((t) => t.val === 'Rincian Komponen Biaya');
  const designCall = texts.find((t) => t.val === 'Biaya Desain 3D');
  const designRpCall = texts.find((t) => designCall && t.y === designCall.y && t.val === 'Rp');
  const designAmtCall = texts.find((t) => designCall && t.y === designCall.y && t.val === '500.000');
  const promoCall = texts.find((t) => t.val === 'Potongan Promo');
  const promoMinusCall = texts.find((t) => promoCall && t.y === promoCall.y && t.val === '-');
  const promoRpCall = texts.find((t) => promoCall && t.y === promoCall.y && t.val === 'Rp');
  const promoAmtCall = texts.find((t) => promoCall && t.y === promoCall.y && t.val === '500.000');
  const ppnCall = texts.find((t) => t.val === 'PPN (11%)');
  const finalTotalCall = texts.find((t) => t.val === 'TOTAL HARGA PENAWARAN');
  const finalTotalAmtCall = texts.find((t) => finalTotalCall && t.y === finalTotalCall.y && t.val === '10.545.000');

  assert.equal(headingCall?.x, expectedDimensiTextX);
  assert.equal(designCall?.x, expectedDimensiTextX);
  assert.ok(designRpCall && designAmtCall);
  assert.equal(designRpCall.align, 'left');
  assert.equal(designRpCall.x, expectedValLeftX);
  assert.equal(designAmtCall.align, 'right');
  assert.equal(lines.length, 3); // 2 free fee strikethrough lines + 1 divider line before total
  const dividerLine = lines.find((l) => l.x1 === expectedDimensiTextX);
  assert.ok(dividerLine);
  assert.ok(dividerLine.x2 > dividerLine.x1);
  assert.ok(ppnCall && finalTotalCall && finalTotalAmtCall);
  assert.ok(dividerLine.y1 > ppnCall.y && dividerLine.y1 < finalTotalCall.y);
  assert.equal(promoCall?.x, expectedDimensiTextX + 4);
  assert.ok(promoMinusCall && promoRpCall && promoAmtCall);
  assert.equal(promoMinusCall.align, 'right');
  assert.ok(promoMinusCall.x < promoRpCall.x);
  assert.equal(promoRpCall.align, 'left');
  assert.equal(promoRpCall.x, expectedValLeftX);
  assert.equal(promoAmtCall.align, 'right');
  assert.ok(finalTotalCall.y > ppnCall.y);
  assert.equal(finalTotalCall.x, expectedDimensiTextX);
  assert.equal(finalTotalCall.align, 'left');
});

test('drawFormalCostBreakdownTable supports spk-colon layout aligned left with bold Total Nilai Kontrak aligned to PPN and right-aligned nominal', async () => {
  const pdfModule = await import('../../../../src/lib/pdf/build-workshop-documents-pdf');
  const texts: Array<{
    val: string;
    x: number;
    y: number;
    align?: string;
    fontStyle?: string;
  }> = [];
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  let currentFontStyle = 'normal';

  const mockDoc = {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    addPage: () => {},
    setFillColor: () => {},
    setDrawColor: () => {},
    setLineWidth: () => {},
    setFont: (_family: string, style?: string) => {
      currentFontStyle = style ?? 'normal';
    },
    setFontSize: () => {},
    setTextColor: () => {},
    getTextWidth: (s: string) => s.length * 1.8,
    rect: () => {},
    line: (x1: number, y1: number, x2: number, y2: number) => {
      lines.push({ x1, y1, x2, y2 });
    },
    text: (val: string, x: number, y: number, opts?: { align?: string }) => {
      texts.push({ val, x, y, align: opts?.align, fontStyle: currentFontStyle });
    },
  };

  pdfModule.drawFormalCostBreakdownTable(
    mockDoc as never,
    {
      surveyFee: 150000,
      surveyRatePercent: 5,
      design3dFee: 500000,
      deliveryFee: 350000,
      deliveryFleetLabel: 'Pickup',
      isPromo: true,
      productPriceAmount: 10000000,
      promoDiscountAmount: 500000,
      priceAfterDiscount: 9500000,
      ppnAmount: 1045000,
      totalAmount: 10545000,
    },
    80,
    18,
    277,
    'Total Nilai Kontrak',
    {
      variant: 'spk-colon',
      colonLabelX: 28,
      colonOffset: 45,
      itemsStartX: 32,
      valLeftX: 76,
      blockRightX: 102,
      amountColW: 28,
      hideDeliveryFleetLabel: true,
    }
  );

  const heading = texts.find((t) => t.val === 'Rincian Komponen Biaya');
  const colon = texts.find((t) => t.val === ':');
  const design = texts.find((t) => t.val === 'Biaya Desain 3D');
  const delivery = texts.find((t) => t.val === 'Biaya Pengiriman');
  const deliveryWithFleet = texts.find((t) => t.val.includes('(Pickup)'));
  const designRp = texts.find((t) => design && t.y === design.y && t.val === 'Rp');
  const promo = texts.find((t) => t.val === 'Potongan Promo');
  const ppn = texts.find((t) => t.val === 'PPN (11%)');
  const total = texts.find((t) => t.val === 'Total Nilai Kontrak');
  const totalRp = texts.find((t) => total && t.y === total.y && t.val === 'Rp');
  const totalAmount = texts.find((t) => total && t.y === total.y && t.val === '10.545.000');
  const divider = lines.find((l) => l.x1 === 32 && l.x2 === 102);

  assert.equal(heading?.x, 28);
  assert.equal(colon?.x, 73);
  assert.equal(heading?.y, colon?.y);
  assert.equal(design?.x, 32);
  assert.equal(delivery?.x, 32);
  assert.equal(deliveryWithFleet, undefined);
  assert.equal(designRp?.x, 76);
  assert.equal(promo?.x, 36);
  assert.equal(total?.x, ppn?.x);
  assert.equal(total?.fontStyle, 'bold');
  assert.equal(totalRp?.x, 76);
  assert.equal(totalRp?.fontStyle, 'bold');
  assert.equal(totalAmount?.x, 102);
  assert.equal(totalAmount?.align, 'right');
  assert.equal(totalAmount?.fontStyle, 'bold');
  assert.ok(divider);
  assert.equal(lines.length, 3); // 2 strikethrough fee lines + 1 divider line before Total Nilai Kontrak
});

test('drawFormalBankPaymentCard renders both BNI and BSI cards side-by-side with transparent logos, accent bars, and 3 right-aligned lines each', async () => {
  const pdfModule = await import('../../../../src/lib/pdf/build-workshop-documents-pdf');
  const drawnText: Array<{
    val: string;
    align?: string;
    fontStyle?: string;
    fontSize?: number;
    color?: [number, number, number];
  }> = [];
  const drawnImages: Array<{ data: string; x: number; y: number; w: number; h: number }> = [];
  const drawnRects: Array<{ x: number; y: number; w: number; h: number; style: string; fill?: [number, number, number] }> = [];
  let currentFill: [number, number, number] | undefined;
  let currentFontStyle = 'normal';
  let currentFontSize = 10;
  let currentTextColor: [number, number, number] = [20, 20, 20];
  const mockDoc = {
    addPage: () => {},
    setFillColor: (r: number, g: number, b: number) => {
      currentFill = [r, g, b];
    },
    setDrawColor: () => {},
    setLineWidth: () => {},
    setFont: (_family: string, style?: string) => {
      if (style) currentFontStyle = style;
    },
    setFontSize: (size: number) => {
      currentFontSize = size;
    },
    setTextColor: (r: number, g: number, b: number) => {
      currentTextColor = [r, g, b];
    },
    rect: (x: number, y: number, w: number, h: number, style = 'S') => {
      drawnRects.push({ x, y, w, h, style, fill: currentFill });
    },
    text: (val: string, _x: number, _y: number, options?: { align?: string }) => {
      drawnText.push({
        val,
        align: options?.align,
        fontStyle: currentFontStyle,
        fontSize: currentFontSize,
        color: currentTextColor,
      });
    },
    addImage: (data: string, _fmt: string, x: number, y: number, w: number, h: number) => {
      drawnImages.push({ data, x, y, w, h });
    },
  };

  const nextY = pdfModule.drawFormalBankPaymentCard(
    mockDoc as never,
    BUSINESS_CONFIG,
    80,
    18,
    174,
    277,
    {
      logo: null,
      ownerSignature: null,
      companyStamp: null,
      bniLogo: { dataUrl: 'data:image/png;base64,BNI', width: 2560, height: 747 },
      bsiLogo: { dataUrl: 'data:image/png;base64,BSI', width: 1200, height: 750 },
    },
    'SPK/SDI-K/008/XI/2026'
  );

  assert.ok(nextY > 100);
  assert.equal(drawnImages.length, 2);
  assert.equal(drawnImages[0].data, 'data:image/png;base64,BNI');
  assert.equal(drawnImages[1].data, 'data:image/png;base64,BSI');
  // Second card starts to the right of first card on standard A4
  assert.ok(drawnImages[1].x > drawnImages[0].x + 70);

  // No white rectangle box behind logos
  assert.equal(
    drawnRects.some((r) => r.fill?.[0] === 255 && r.fill?.[1] === 255 && r.fill?.[2] === 255),
    false
  );

  // BNI accent bars (#005E6A + #F15A23) and BSI accent bars (#00A39D + #F9A01B)
  const orangeRect = drawnRects.find((r) => r.fill?.[0] === 241 && r.fill?.[1] === 90 && r.fill?.[2] === 35);
  const bniTealRect = drawnRects.find((r) => r.fill?.[0] === 0 && r.fill?.[1] === 94 && r.fill?.[2] === 106);
  const goldRect = drawnRects.find((r) => r.fill?.[0] === 249 && r.fill?.[1] === 160 && r.fill?.[2] === 27);
  const bsiTealRect = drawnRects.find((r) => r.fill?.[0] === 0 && r.fill?.[1] === 163 && r.fill?.[2] === 157);
  assert.ok(orangeRect && bniTealRect && goldRect && bsiTealRect);
  assert.equal(Math.round(bniTealRect.w * 10) / 10, 84.5);
  assert.equal(Math.round(bsiTealRect.w * 10) / 10, 84.5);

  // Right-aligned 3 lines for BNI followed by 3 lines for BSI
  assert.deepEqual(
    drawnText.map((t) => t.val),
    [
      'BANK NEGARA INDONESIA',
      '1905207398',
      'HILMAN AZIZ NAPIS',
      'BANK SYARIAH INDONESIA',
      '7370860534',
      'HILMAN AZIZ NAPIS',
    ]
  );
  assert.equal(drawnText.every((t) => t.align === 'right'), true);

  // Bank full names rendered smaller, thin (normal), and muted dark gray
  for (const idx of [0, 3]) {
    assert.equal(drawnText[idx].fontStyle, 'normal');
    assert.equal(drawnText[idx].fontSize, 6.2);
    assert.deepEqual(drawnText[idx].color, [90, 90, 90]);
  }
});

test('sanitizeQuotationTechnicalNote strips internal termin/status notes while preserving real technical notes', async () => {
  const { buildAutoProjectDocuments, sanitizeQuotationTechnicalNote } = await import(
    '../../../../src/lib/project-documents-auto'
  );

  assert.equal(
    sanitizeQuotationTechnicalNote('Menunggu Termin 3 : Pra-Instalasi 20% dan Termin 4 : Serah Terima 10%.'),
    ''
  );
  assert.equal(
    sanitizeQuotationTechnicalNote('Penawaran telah disetujui, menunggu transfer Termin 1 : Down Payment 30%.'),
    ''
  );
  assert.equal(
    sanitizeQuotationTechnicalNote('Finishing HPL Walnut Matte + Engsel Soft-Close Blum'),
    'Finishing HPL Walnut Matte + Engsel Soft-Close Blum'
  );

  const bundle = buildAutoProjectDocuments(
    {
      id: 'K-003',
      namaProyek: 'Meja Kerja & Wall Panel',
      namaKlien: 'PT Sinar Cipta Karawang',
      teleponKlien: '+628119200450',
      alamat: {
        detail: 'Karawang Barat',
      },
      nilaiKontrak: 24000000,
      tanggalMulai: '2026-10-05',
      tanggalTargetSelesai: '2026-11-28',
      status: 'Instalasi',
      dibuatPada: '2026-10-05T09:00:00.000Z',
      tanggalDokumen: {
        tanggalPenawaran: '2026-10-01',
        berlakuHingga: '2026-10-04',
        tanggalSpk: '2026-10-05',
        tanggalKirim: '2026-11-24',
      },
    },
    BUSINESS_CONFIG,
    DEFAULT_PAYMENT_SCHEME
  );
  assert.doesNotMatch(bundle.quotation.catatanTambahan, /Menunggu Termin/i);

  const { formatLongDateId } = await import('../../../../src/lib/finance-utils');
  assert.equal(formatLongDateId('2026-10-01'), '01 Oktober 2026');

  const pdfModule = await import('../../../../src/lib/pdf/build-workshop-documents-pdf');
  const quoHeader = pdfModule.buildQuotationDocumentContent(bundle.quotation, BUSINESS_CONFIG);
  assert.equal(quoHeader.cityDateLine, 'Purwakarta, 01 Oktober 2026');
  assert.equal(quoHeader.subjectRow.label, 'Perihal');
  assert.equal(quoHeader.subjectRow.value, 'Penawaran Harga Meja Kerja & Wall Panel');
  assert.equal(quoHeader.subjectRow.boldValue, true);
  assert.equal(quoHeader.recipientSalutation, 'Kepada Yth.');
  assert.equal(quoHeader.recipientName, 'PT Sinar Cipta Karawang');
  assert.equal(quoHeader.recipientAddress, 'Karawang Barat');
  assert.match(quoHeader.openingText, /hari kerja efektif/i);
  assert.match(quoHeader.openingText, /04 Oktober 2026/);
});

test('formatAgreementClauseHeading and drawAgreementClauseHeading render 2 centered lines (PASAL N + uppercase title)', async () => {
  const pdfModule = await import('../../../../src/lib/pdf/build-workshop-documents-pdf');

  assert.deepEqual(
    pdfModule.formatAgreementClauseHeading('Pasal 2 — Nilai Kontrak & Sistem Pembayaran (Termin)'),
    {
      pasalLabel: 'PASAL 2',
      titleLabel: 'NILAI KONTRAK & SISTEM PEMBAYARAN (TERMIN)',
    }
  );
  assert.deepEqual(pdfModule.formatAgreementClauseHeading('Pasal 2 - abcdfg'), {
    pasalLabel: 'PASAL 2',
    titleLabel: 'ABCDFG',
  });
  assert.deepEqual(pdfModule.formatAgreementClauseHeading('Pasal 3: Jangka Waktu'), {
    pasalLabel: 'PASAL 3',
    titleLabel: 'JANGKA WAKTU',
  });
  assert.deepEqual(pdfModule.formatAgreementClauseHeading('Pasal 4\nPekerjaan Tambah'), {
    pasalLabel: 'PASAL 4',
    titleLabel: 'PEKERJAAN TAMBAH',
  });
  assert.deepEqual(pdfModule.formatAgreementClauseHeading('Ketentuan Khusus', 9), {
    pasalLabel: 'PASAL 9',
    titleLabel: 'KETENTUAN KHUSUS',
  });

  const drawnLines: Array<{ text: string; x: number; y: number; align?: string }> = [];
  let addedPages = 0;
  const mockDoc = {
    getNumberOfPages: () => 1 + addedPages,
    addPage: () => {
      addedPages += 1;
    },
    setFont: () => {},
    setFontSize: () => {},
    setTextColor: () => {},
    splitTextToSize: (val: string) => [val],
    text: (val: string, x: number, y: number, opts?: { align?: string }) => {
      drawnLines.push({ text: val, x, y, align: opts?.align });
    },
  };

  const endY = pdfModule.drawAgreementClauseHeading(
    mockDoc as never,
    'Pasal 2 — Nilai Kontrak & Sistem Pembayaran (Termin)',
    80,
    18,
    174,
    277,
    2,
    true
  );

  assert.equal(addedPages, 0);
  assert.equal(drawnLines.length, 2);
  assert.deepEqual(
    drawnLines.map((l) => l.text),
    ['PASAL 2', 'NILAI KONTRAK & SISTEM PEMBAYARAN (TERMIN)']
  );
  assert.equal(drawnLines[0].x, 105);
  assert.equal(drawnLines[1].x, 105);
  assert.equal(drawnLines[0].align, 'center');
  assert.equal(drawnLines[1].align, 'center');
  assert.equal(drawnLines[0].y, 80);
  assert.ok(drawnLines[1].y > drawnLines[0].y);
  assert.ok(endY > drawnLines[1].y);

  // Page break triggers when near bottomLimit so heading stays with body
  const beforeBreakCount = drawnLines.length;
  const page2Y = pdfModule.drawAgreementClauseHeading(
    mockDoc as never,
    'Pasal 9 — Penutup',
    270,
    18,
    174,
    277,
    9,
    true
  );
  assert.equal(addedPages, 1);
  assert.equal(drawnLines[beforeBreakCount].y, 18);
  assert.equal(drawnLines[beforeBreakCount].text, 'PASAL 9');
  assert.equal(drawnLines[beforeBreakCount + 1].text, 'PENUTUP');
  assert.ok(page2Y > drawnLines[beforeBreakCount + 1].y);
});

test('normalizeAgreementClauseNumbering enforces numbered points across Pasal 2 and legacy clauses', async () => {
  const pdfModule = await import('../../../../src/lib/pdf/build-workshop-documents-pdf');

  const legacyClause2 = [
    'Nilai total kontrak yang disepakati adalah sebesar Rp 24.000.000. Total nilai pekerjaan disepakati sebesar nilai kontrak tercantum dengan sistem pembayaran bertahap.',
    '1. Rekening Tujuan Resmi: Pembayaran resmi hanya dianggap sah apabila ditransfer ke rekening BNI 1905207398.',
    '2. Penangguhan Produksi: Keterlambatan pembayaran termin berhak mengakibatkan penangguhan sementara jadwal produksi.',
  ].join('\n');

  const normalized = pdfModule.normalizeAgreementClauseNumbering(legacyClause2);
  const normalizedLines = normalized.split('\n');
  assert.equal(normalizedLines.length, 3);
  assert.match(normalizedLines[0], /^1\.\s+Nilai Kontrak & Skema Termin:/);
  assert.match(normalizedLines[1], /^2\.\s+Rekening Tujuan Resmi:/);
  assert.match(normalizedLines[2], /^3\.\s+Penangguhan Produksi:/);

  // Already numbered clauses stay unchanged
  const alreadyNumbered = '1. Poin Satu: A.\n2. Poin Dua: B.';
  assert.equal(pdfModule.normalizeAgreementClauseNumbering(alreadyNumbered), alreadyNumbered);

  // Freshly generated agreement Pasal 2 has 1., 2., 3. and no unnumbered paragraph
  const bundle = buildAutoProjectDocuments(
    {
      id: 'K-005',
      namaProyek: 'Meja Kerja & Wall Panel',
      namaKlien: 'PT Sinar Cipta Karawang',
      teleponKlien: '+628119200450',
      alamat: {
        provinsi: { id: '32', name: 'Jawa Barat' },
        kabupaten: { id: '32.15', name: 'Kabupaten Karawang' },
        kecamatan: { id: '32.15.01', name: 'Karawang Barat' },
      },
      nilaiKontrak: 24000000,
      tanggalMulai: '2026-10-05',
      tanggalTargetSelesai: '2026-11-28',
      status: 'Produksi',
      dibuatPada: '2026-10-05T09:00:00.000Z',
    },
    BUSINESS_CONFIG,
    DEFAULT_PAYMENT_SCHEME
  );
  const structure = pdfModule.buildAgreementDocumentStructure(
    bundle.agreement,
    DEFAULT_PAYMENT_SCHEME
  );
  const pasal2Lines = structure.clauses[1].isiPasal.split('\n');
  assert.equal(pasal2Lines.length, 3);
  assert.match(pasal2Lines[0], /^1\.\s+/);
  assert.match(pasal2Lines[1], /^2\.\s+/);
  assert.match(pasal2Lines[2], /^3\.\s+/);
});

test('drawFormalSectionHeading applies spaceBefore mid-page and omits it at top of new page', async () => {
  const pdfModule = await import('../../../../src/lib/pdf/build-workshop-documents-pdf');
  const drawn: Array<{ text: string; y: number }> = [];
  let pages = 1;
  const mockDoc = {
    getNumberOfPages: () => pages,
    addPage: () => {
      pages += 1;
    },
    setFont: () => {},
    setFontSize: () => {},
    setTextColor: () => {},
    text: (val: string, _x: number, y: number) => {
      drawn.push({ text: val, y });
    },
  };

  // Mid-page (y = 90 > 22) should advance by spaceBefore (4.5mm) before drawing heading
  const nextY = pdfModule.drawFormalSectionHeading(
    mockDoc as never,
    'II. Ruang Lingkup',
    90,
    18,
    174,
    279,
    18,
    4.5
  );
  assert.equal(pages, 1);
  assert.equal(drawn[0].text, 'II. RUANG LINGKUP');
  assert.equal(drawn[0].y, 94.5);
  assert.equal(nextY, 99.5);

  // Near bottom (y = 262 + 4.5 + 18 = 284.5 > 279) should page-break and draw right at y = 18 without top spaceBefore
  const page2NextY = pdfModule.drawFormalSectionHeading(
    mockDoc as never,
    'III. Nilai Kontrak',
    262,
    18,
    174,
    279,
    18,
    4.5
  );
  assert.equal(pages, 2);
  assert.equal(drawn[1].text, 'III. NILAI KONTRAK');
  assert.equal(drawn[1].y, 18);
  assert.equal(page2NextY, 23);
});

test('SPK (Surat Perjanjian Kerja) PDF includes detailed product table with specs and finishing color codes', async () => {
  const pdfModule = await import('../../../../src/lib/pdf/build-workshop-documents-pdf');
  const workspaceModule = await import('../../../../src/lib/project-workspace');

  const sampleProject: WorkshopProject = {
    id: 'K-088',
    namaProyek: 'Kitchen Set & Wardrobe Custom',
    namaKlien: 'Ibu Nadia Wijaya',
    teleponKlien: '+6281234567890',
    alamat: {
      provinsi: { id: '32', name: 'Jawa Barat' },
      kabupaten: { id: '32.75', name: 'Kota Bekasi' },
    },
    nilaiKontrak: 38650000,
    tanggalMulai: '2026-11-10',
    tanggalTargetSelesai: '2026-12-05',
    status: 'Produksi',
    dibuatPada: '2026-11-10T08:00:00.000Z',
    daftarProduk: [
      {
        id: 'katalog-kitchen-set-01',
        namaProduk: 'Kitchen Set Letter L',
        dimensi: '300 x 60 x 85 cm',
        customisasi: 'Letter L Standar',
        material: 'Multipleks',
        finishing: 'HPL',
        kodeWarna: 'TH 015 AA',
        tambahan: [
          { jenis: 'Engsel Soft-Motion Huben', biaya: 0 },
          { jenis: 'Lampu LED Strip Bawah Kabinet', biaya: 650000 },
        ],
        spesifikasiMaterial:
          'Letter L Standar, Multipleks 18 MM, Finishing HPL (TH 015 AA), Engsel Soft-Motion Huben',
        jumlah: 1,
        hargaSatuan: 24000000,
      },
      {
        id: 'prd-wd-2',
        namaProduk: 'Lemari Pakaian Sliding',
        dimensi: '200 x 60 x 240 cm',
        customisasi: 'Pintu Sliding Cermin',
        material: 'Blockboard',
        finishing: 'Cat Duco',
        kodeWarna: 'NCS S 1005-Y20R',
        spesifikasiMaterial: 'Cat Duco Satin Anti-Gores, Rel Pintu Gantung Aluminium',
        jumlah: 1,
        hargaSatuan: 14000000,
      },
    ],
  };

  const bundle = buildAutoProjectDocuments(
    sampleProject,
    BUSINESS_CONFIG,
    DEFAULT_PAYMENT_SCHEME
  );
  assert.equal(bundle.agreement.daftarProduk?.length, 2);
  assert.equal(bundle.agreement.daftarProduk?.[0].kodeWarna, 'TH 015 AA');
  assert.equal(bundle.agreement.daftarProduk?.[0].finishing, 'HPL');
  assert.equal(bundle.agreement.daftarProduk?.[0].subtotal, 24650000);
  assert.match(
    bundle.agreement.daftarProduk?.[0].spesifikasiMaterial ?? '',
    /Lampu LED Strip Bawah Kabinet/
  );

  const spksDraft = workspaceModule.buildProjectSpksDraft(
    sampleProject,
    88,
    BUSINESS_CONFIG,
    DEFAULT_PAYMENT_SCHEME
  );
  assert.equal(spksDraft.daftarProduk?.length, 2);
  assert.equal(spksDraft.daftarProduk?.[1].kodeWarna, 'NCS S 1005-Y20R');

  const finishExplicit = pdfModule.resolveAgreementProductFinishingInfo({
    finishing: 'Cat Duco',
    kodeWarna: 'RAL 9010',
    spesifikasiMaterial: 'Multipleks 18 MM',
  });
  assert.deepEqual(finishExplicit, { finishing: 'Cat Duco', kodeWarna: 'RAL 9010' });

  const finishParsed = pdfModule.resolveAgreementProductFinishingInfo({
    spesifikasiMaterial: 'Multipleks 18 MM, Finishing HPL (TH 388 J), Edging PVC',
  });
  assert.deepEqual(finishParsed, { finishing: 'HPL', kodeWarna: 'TH 388 J' });

  const formattedSpec = pdfModule.formatAgreementProductSpecText({
    customisasi: 'Pintu Sliding Cermin',
    material: 'Blockboard',
    spesifikasiMaterial: 'Rel Pintu Gantung Aluminium',
  });
  assert.match(formattedSpec, /Model: Pintu Sliding Cermin/);
  assert.match(formattedSpec, /Material: Blockboard 18 MM/);
  assert.match(formattedSpec, /Rel Pintu Gantung Aluminium/);

  // Verify linkedProject fallback when agreement was saved before daftarProduk existed
  const legacyAgreement = { ...bundle.agreement, daftarProduk: undefined };
  const fallbackStructure = pdfModule.buildAgreementDocumentStructure(
    legacyAgreement,
    DEFAULT_PAYMENT_SCHEME,
    sampleProject
  );
  assert.equal(fallbackStructure.productItems.length, 2);
  assert.equal(fallbackStructure.productsTotal, 38650000);
  assert.match(fallbackStructure.productReferenceNote, /komplain/i);

  // Capture real generated PDF bytes passed into Blob by openPdfDocumentInNewTab
  const OriginalBlob = globalThis.Blob;
  let capturedPdfAscii = '';
  globalThis.Blob = class CapturePdfBlob extends OriginalBlob {
    constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      if (options?.type === 'application/pdf' && Array.isArray(parts)) {
        capturedPdfAscii = parts
          .map((part) => {
            if (part instanceof ArrayBuffer) {
              return Buffer.from(part).toString('latin1');
            }
            if (ArrayBuffer.isView(part)) {
              return Buffer.from(part.buffer, part.byteOffset, part.byteLength).toString('latin1');
            }
            return String(part);
          })
          .join('\n');
      }
    }
  };

  try {
    await pdfModule.downloadAgreementPdf(
      bundle.agreement,
      BUSINESS_CONFIG,
      DEFAULT_PAYMENT_SCHEME,
      sampleProject
    );
  } finally {
    globalThis.Blob = OriginalBlob;
  }

  const extractedPdfText = Array.from(
    capturedPdfAscii.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g)
  )
    .map((m) => m[1].replace(/\\([()\\])/g, '$1'))
    .join(' ')
    .replace(/\s+/g, ' ');

  assert.match(
    extractedPdfText,
    /Tabel Rincian Detail Produk, Spesifikasi Teknis & Kode Warna Finishing:/
  );
  assert.match(extractedPdfText, /PRODUK & SPESIFIKASI/);
  assert.match(extractedPdfText, /MATERIAL/);
  assert.match(extractedPdfText, /DIMENSI \(cm\)/);
  assert.match(extractedPdfText, /HARGA SATUAN/);
  assert.match(extractedPdfText, /JUMLAH/);
  assert.match(extractedPdfText, /Kitchen Set Letter L/);
  assert.match(extractedPdfText, /Letter L Standar/);
  assert.match(extractedPdfText, /Engsel Soft-Motion Huben/);
  assert.match(extractedPdfText, /18 mm \(Grade A\)/);
  assert.match(extractedPdfText, /HPL.*TH 015 AA/);
  assert.match(extractedPdfText, /Lemari Pakaian Sliding/);
  assert.match(extractedPdfText, /Cat Duco.*NCS S 1005-Y20R/);
  assert.match(extractedPdfText, /TOTAL RINCIAN PRODUK/);
  assert.match(extractedPdfText, /Catatan Acuan Mutu & Komplain:/);
  assert.equal(/Biaya Survei/.test(extractedPdfText), false);
  assert.match(extractedPdfText, /Biaya Desain 3D/);
  assert.match(extractedPdfText, /Biaya Pengiriman/);
  assert.match(extractedPdfText, /Harga Produk/);
  assert.match(extractedPdfText, /Potongan Promo/);
  assert.match(extractedPdfText, /Harga Setelah Potongan/);
  assert.match(extractedPdfText, /PPN \(11%\)/);
  assert.match(extractedPdfText, /Total Nilai Kontrak/);
  assert.equal(/TOTAL NILAI KONTRAK/.test(extractedPdfText), false);
  assert.match(extractedPdfText, /38\.650\.000/);
});

test('Quotation, Invoice Induk, and Project Summary PDFs include full 7-component detailed cost breakdown matching exact total', async () => {
  const pdfModule = await import('../../../../src/lib/pdf/build-workshop-documents-pdf');
  const exportModule = await import('../../../../src/lib/project-export');
  const workspaceModule = await import('../../../../src/lib/project-workspace');

  const sampleProject: WorkshopProject = {
    id: 'K-091',
    namaProyek: 'Kitchen Set & Wardrobe Custom',
    namaKlien: 'Ibu Nadia Wijaya',
    teleponKlien: '+6281234567890',
    alamat: {
      provinsi: { id: '32', name: 'Jawa Barat' },
      kabupaten: { id: '32.14', name: 'Kabupaten Purwakarta' },
    },
    nilaiKontrak: 30000000,
    tanggalMulai: '2026-11-10',
    tanggalTargetSelesai: '2026-12-05',
    status: 'Produksi',
    dibuatPada: '2026-11-10T08:00:00.000Z',
    daftarProduk: [
      {
        id: 'katalog-kitchen-set-01',
        namaProduk: 'Kitchen Set Custom',
        dimensi: '300 x 60 x 100',
        customisasi: 'Letter L Standar',
        material: 'Multipleks',
        finishing: 'HPL',
        kodeWarna: 'TH 015 AA',
        spesifikasiMaterial: 'Multipleks 18 MM, Finishing HPL (TH 015 AA)',
        jumlah: 1,
        hargaSatuan: 30000000,
      },
    ],
  };

  const bundle = buildAutoProjectDocuments(
    sampleProject,
    BUSINESS_CONFIG,
    DEFAULT_PAYMENT_SCHEME
  );
  const workspace = workspaceModule.buildProjectWorkspaceData(sampleProject, {
    quotations: [bundle.quotation],
    workOrders: [],
    agreements: [bundle.agreement],
    deliveryOrders: [bundle.deliveryOrder],
    handoverCertificates: [bundle.handoverCertificate],
    invoices: [bundle.invoice],
    transactions: [],
    paymentScheme: DEFAULT_PAYMENT_SCHEME,
  });

  const OriginalBlob = globalThis.Blob;
  let capturedBlobs: string[] = [];
  globalThis.Blob = class CaptureCostPdfBlob extends OriginalBlob {
    constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      if (options?.type === 'application/pdf' && Array.isArray(parts)) {
        const ascii = parts
          .map((part) => {
            if (part instanceof ArrayBuffer) {
              return Buffer.from(part).toString('latin1');
            }
            if (ArrayBuffer.isView(part)) {
              return Buffer.from(part.buffer, part.byteOffset, part.byteLength).toString('latin1');
            }
            return String(part);
          })
          .join('\n');
        capturedBlobs.push(ascii);
      }
    }
  };

  const extractText = (ascii: string) =>
    Array.from(ascii.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g))
      .map((m) => m[1].replace(/\\([()\\])/g, '$1'))
      .join(' ')
      .replace(/\s+/g, ' ');

  try {
    await pdfModule.downloadQuotationPdf(
      bundle.quotation,
      BUSINESS_CONFIG,
      DEFAULT_PAYMENT_SCHEME,
      sampleProject
    );
    await pdfModule.downloadProjectInvoicePdf(
      bundle.invoice,
      BUSINESS_CONFIG,
      DEFAULT_PAYMENT_SCHEME,
      sampleProject
    );
    await exportModule.openProjectSummaryPdf(workspace, BUSINESS_CONFIG);
  } finally {
    globalThis.Blob = OriginalBlob;
  }

  assert.equal(capturedBlobs.length, 3);
  const expectedLabels = [
    'Biaya Desain 3D',
    'Biaya Pengiriman',
    'Harga Produk',
    'Potongan Promo',
    'Harga Setelah Potongan',
    'PPN (11%)',
    '30.000.000',
  ];
  for (const ascii of capturedBlobs) {
    const text = extractText(ascii);
    assert.equal(text.includes('Biaya Survei'), false);
    for (const label of expectedLabels) {
      assert.ok(text.includes(label), `Expected PDF text to contain "${label}"`);
    }
  }
});

test('SPK PDF renders 5-field Pihak Pertama identity and entity-specific Pihak Kedua rows for pribadi, perusahaan, and instansi', async () => {
  const identityModule = await import('../../../../src/lib/agreement-identity');
  const pdfModule = await import('../../../../src/lib/pdf/build-workshop-documents-pdf');

  const makeProject = (
    id: string,
    jenisKlien: 'pribadi' | 'perusahaan' | 'instansi',
    namaKlien: string,
    penanggungJawabKlien?: string,
    jabatanKlien?: string
  ): WorkshopProject => ({
    id,
    namaProyek: 'Interior Custom Proyek',
    jenisKlien,
    namaKlien,
    penanggungJawabKlien,
    jabatanKlien,
    teleponKlien: '+6281234567890',
    alamat: {
      provinsi: { id: '32', name: 'Jawa Barat' },
      kabupaten: { id: '32.14', name: 'Kabupaten Purwakarta' },
    },
    nilaiKontrak: 20000000,
    tanggalMulai: '2026-11-10',
    tanggalTargetSelesai: '2026-12-01',
    status: 'Produksi',
    dibuatPada: '2026-11-10T08:00:00.000Z',
    daftarProduk: [
      {
        id: 'prd-1',
        namaProduk: 'Meja Kerja Custom',
        dimensi: '200 x 60 x 75',
        finishing: 'HPL',
        kodeWarna: 'TH 015 AA',
        spesifikasiMaterial: 'Multipleks 18 MM, Finishing HPL',
        jumlah: 1,
        hargaSatuan: 20000000,
      },
    ],
  });

  const personalProject = makeProject('K-201', 'pribadi', 'Ibu Ratna Dewi');
  const companyProject = makeProject(
    'K-202',
    'perusahaan',
    'PT Sinar Cipta Karawang',
    'Bapak Andi Wijaya',
    'Manager Operasional'
  );
  const instansiProject = makeProject(
    'K-203',
    'instansi',
    'Dinas PUPR Kabupaten Purwakarta',
    'Ibu Dewi Lestari',
    'Kepala Bagian Umum'
  );

  const personalBundle = buildAutoProjectDocuments(
    personalProject,
    BUSINESS_CONFIG,
    DEFAULT_PAYMENT_SCHEME
  );
  const companyBundle = buildAutoProjectDocuments(
    companyProject,
    BUSINESS_CONFIG,
    DEFAULT_PAYMENT_SCHEME
  );
  const instansiBundle = buildAutoProjectDocuments(
    instansiProject,
    BUSINESS_CONFIG,
    DEFAULT_PAYMENT_SCHEME
  );

  const personalParty = identityModule.resolveAgreementPartyIdentities(
    personalBundle.agreement,
    BUSINESS_CONFIG,
    personalProject
  );
  assert.deepEqual(
    personalParty.firstPartyRows.map((r) => r.label),
    [
      'Nama Perusahaan',
      'Penanggung Jawab',
      'Jabatan',
      'Telepon / WhatsApp',
      'Alamat Domisili',
    ]
  );
  assert.deepEqual(
    personalParty.secondPartyRows.map((r) => r.label),
    ['Nama Lengkap', 'Telepon / WhatsApp', 'Alamat Domisili']
  );

  const companyParty = identityModule.resolveAgreementPartyIdentities(
    companyBundle.agreement,
    BUSINESS_CONFIG,
    companyProject
  );
  assert.deepEqual(
    companyParty.secondPartyRows.map((r) => r.label),
    [
      'Nama Perusahaan',
      'Penanggung Jawab',
      'Jabatan',
      'Telepon / WhatsApp',
      'Alamat Domisili',
    ]
  );
  assert.equal(companyParty.secondPartySignerName, 'Bapak Andi Wijaya');

  const instansiParty = identityModule.resolveAgreementPartyIdentities(
    instansiBundle.agreement,
    BUSINESS_CONFIG,
    instansiProject
  );
  assert.deepEqual(
    instansiParty.secondPartyRows.map((r) => r.label),
    [
      'Nama Instansi',
      'Penanggung Jawab',
      'Jabatan',
      'Telepon / WhatsApp',
      'Alamat Domisili',
    ]
  );
  assert.equal(instansiParty.secondPartySignerName, 'Ibu Dewi Lestari');

  const OriginalBlob = globalThis.Blob;
  const capturedPdfs: string[] = [];
  globalThis.Blob = class CaptureSpkPartyBlob extends OriginalBlob {
    constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      if (options?.type === 'application/pdf' && Array.isArray(parts)) {
        const ascii = parts
          .map((part) => {
            if (part instanceof ArrayBuffer) {
              return Buffer.from(part).toString('latin1');
            }
            if (ArrayBuffer.isView(part)) {
              return Buffer.from(part.buffer, part.byteOffset, part.byteLength).toString('latin1');
            }
            return String(part);
          })
          .join('\n');
        capturedPdfs.push(ascii);
      }
    }
  };

  const extractText = (ascii: string) =>
    Array.from(ascii.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g))
      .map((m) => m[1].replace(/\\([()\\])/g, '$1'))
      .join(' ')
      .replace(/\s+/g, ' ');

  try {
    await pdfModule.downloadAgreementPdf(
      personalBundle.agreement,
      BUSINESS_CONFIG,
      DEFAULT_PAYMENT_SCHEME,
      personalProject
    );
    await pdfModule.downloadAgreementPdf(
      companyBundle.agreement,
      BUSINESS_CONFIG,
      DEFAULT_PAYMENT_SCHEME,
      companyProject
    );
    await pdfModule.downloadAgreementPdf(
      instansiBundle.agreement,
      BUSINESS_CONFIG,
      DEFAULT_PAYMENT_SCHEME,
      instansiProject
    );
  } finally {
    globalThis.Blob = OriginalBlob;
  }

  assert.equal(capturedPdfs.length, 3);
  const [personalPdfText, companyPdfText, instansiPdfText] = capturedPdfs.map(extractText);

  for (const text of [personalPdfText, companyPdfText, instansiPdfText]) {
    assert.ok(text.includes('Nama Perusahaan'));
    assert.ok(text.includes('Penanggung Jawab'));
    assert.ok(text.includes('Jabatan'));
    assert.ok(text.includes('Telepon / WhatsApp'));
    assert.ok(text.includes('Alamat Domisili'));
  }

  assert.ok(personalPdfText.includes('Nama Lengkap'));
  assert.ok(personalPdfText.includes('Ibu Ratna Dewi'));
  assert.doesNotMatch(personalPdfText, /Identitas \(NIK\/NPWP\)/);

  assert.ok(companyPdfText.includes('PT Sinar Cipta Karawang'));
  assert.ok(companyPdfText.includes('Bapak Andi Wijaya'));
  assert.ok(companyPdfText.includes('Manager Operasional'));

  assert.ok(instansiPdfText.includes('Nama Instansi'));
  assert.ok(instansiPdfText.includes('Dinas PUPR Kabupaten Purwakarta'));
  assert.ok(instansiPdfText.includes('Ibu Dewi Lestari'));
  assert.ok(instansiPdfText.includes('Kepala Bagian Umum'));
});

test('standardized product breakdown helper formats spec cleanly as [customisasi], [include] and Material in 3 lines across all documents', async () => {
  const stdModule = await import('../../../../src/lib/document-product-table');

  assert.deepEqual([...stdModule.STANDARD_DOCUMENT_PRODUCT_TABLE_HEADERS], [
    'NO',
    'PRODUK & SPESIFIKASI',
    'MATERIAL',
    'DIMENSI (cm)',
    'HARGA SATUAN',
    'JUMLAH',
  ]);

  const row = stdModule.formatStandardDocumentProductRow(
    {
      namaProduk: 'Wardrobe Pintu Sliding',
      customisasi: 'Full Plafon & Cermin Penuh',
      tambahan: [
        { jenis: 'Engsel & Rel Soft-Close', biaya: 0 },
        { jenis: 'Lampu LED Strip', biaya: 750000 },
      ],
      material: 'Multiplek',
      finishing: 'Duco',
      kodeWarna: 'NCS S 1005-Y20R',
      dimensi: '240 x 60 x 280 cm',
      jumlah: 1,
      satuan: 'Unit',
      hargaSatuan: 18500000,
    },
    0
  );

  assert.equal(row.noText, '1');
  assert.equal(row.productTitle, 'Wardrobe Pintu Sliding');
  assert.equal(
    row.specText,
    'Full Plafon & Cermin Penuh, Engsel & Rel Soft-Close, Lampu LED Strip (+Rp 750.000)'
  );
  assert.equal(row.materialTitle, 'Multiplek');
  assert.equal(row.materialThicknessLine, '18 mm (Grade A)');
  assert.equal(row.materialFinishingLine, 'Duco • NCS S 1005-Y20R');
  assert.equal(row.materialSubText, '18 mm (Grade A)\nDuco • NCS S 1005-Y20R');
  assert.equal(row.dimensionText, '240 x 60 x 280');
  assert.equal(row.quantityText, '1 Unit');
  assert.equal(row.subtotal, 18500000);
});

test('Surat Jalan PDF omits numeric prefixes on signature stage headers, and BAST PDF preserves Termin 4 date and appends QC attachment with empty bordered cells', async () => {
  const pdfModule = await import('../../../../src/lib/pdf/build-workshop-documents-pdf');

  const sampleProject: WorkshopProject = {
    id: 'K-005',
    namaProyek: 'Meja Kerja & Wall Panel',
    jenisKlien: 'perusahaan',
    namaKlien: 'PT Sinar Cipta Karawang',
    penanggungJawabKlien: 'Bapak Andi Wijaya',
    jabatanKlien: 'Manager Operasional',
    teleponKlien: '+628119200450',
    alamat: {
      provinsi: { id: '32', name: 'Jawa Barat' },
      kabupaten: { id: '32.15', name: 'Kabupaten Karawang' },
      kecamatan: { id: '32.15.01', name: 'Karawang Barat' },
      detail: 'Kawasan Industri Karawang',
    },
    nilaiKontrak: 24000000,
    tanggalMulai: '2026-10-05',
    tanggalTargetSelesai: '2026-11-28',
    status: 'Instalasi',
    dibuatPada: '2026-10-05T09:00:00.000Z',
    daftarProduk: [
      {
        id: 'katalog-meja-kerja-11',
        namaProduk: 'Meja Kerja Custom',
        dimensi: '220 x 60 x 75',
        material: 'Multipleks',
        finishing: 'HPL',
        spesifikasiMaterial: 'Multipleks 18 MM, Finishing HPL',
        jumlah: 2,
        hargaSatuan: 5500000,
      },
    ],
    tanggalDokumen: {
      tanggalPenawaran: '2026-10-01',
      tanggalSpk: '2026-10-05',
      tanggalKirim: '2026-11-24',
      tanggalTermin1: '2026-10-05',
      tanggalTermin2: '2026-10-26',
      tanggalTermin3: '2026-11-24',
      tanggalTermin4: '2026-11-28',
    },
  };

  const partialInvoice: ProjectInvoice = {
    id: 'inv-qc-1',
    projectId: sampleProject.id,
    nomorInvoice: 'INV/SDI-K/005/X/2026',
    namaProyek: sampleProject.namaProyek,
    namaKlien: sampleProject.namaKlien,
    lokasi: formatFullWilayahAddress(sampleProject.alamat),
    nilaiTotalKontrak: 24000000,
    tanggalJatuhTempo: '2026-11-28',
    status: 'Berjalan',
    nomorSpkReferensi: 'SPK/SDI-K/005/X/2026',
    nomorBastReferensi: 'BST/SDI-K/005/X/2026',
    riwayatPembayaran: [
      {
        id: 'pay-1',
        tanggal: '2026-10-05',
        label: 'Termin 1 : Down Payment 30%',
        nominal: 7200000,
        metodePembayaran: 'Transfer Bank',
        catatan: '',
      },
      {
        id: 'pay-2',
        tanggal: '2026-10-26',
        label: 'Termin 2 : Progress Produksi 40%',
        nominal: 9600000,
        metodePembayaran: 'Termin Proyek',
        catatan: '',
      },
    ],
    catatan: '',
  };

  const bundle = buildAutoProjectDocuments(
    sampleProject,
    BUSINESS_CONFIG,
    DEFAULT_PAYMENT_SCHEME,
    { invoice: partialInvoice }
  );

  assert.deepEqual(bundle.handoverCertificate.tanggalTermin, [
    '2026-10-05',
    '2026-10-26',
    '2026-11-24',
    '2026-11-28',
  ]);

  const qcRows = pdfModule.buildBastQcTableRows();
  assert.equal(qcRows.length, pdfModule.BAST_QC_DEFAULT_ITEMS.length);
  assert.ok(qcRows.length >= 6);
  for (const row of qcRows) {
    assert.equal(row[3].text, '');
    assert.equal(row[4].text, '');
  }

  // Verify drawFormalGridTable respects preserveEmptyCells & showColumnBorders (no '-' fallback, draws inner column dividers)
  const drawnTexts: string[] = [];
  const drawnLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const mockQcDoc = {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    addPage: () => {},
    setFillColor: () => {},
    setDrawColor: () => {},
    setLineWidth: () => {},
    setFont: () => {},
    setFontSize: () => {},
    setTextColor: () => {},
    splitTextToSize: (val: string) => [val],
    rect: () => {},
    line: (x1: number, y1: number, x2: number, y2: number) => {
      drawnLines.push({ x1, y1, x2, y2 });
    },
    text: (val: string) => {
      drawnTexts.push(val);
    },
  };
  pdfModule.drawFormalGridTable(
    mockQcDoc as never,
    pdfModule.BAST_QC_TABLE_COLUMNS,
    qcRows,
    50,
    18,
    279,
    undefined,
    { showColumnBorders: true, preserveEmptyCells: true, minRowHeightMm: 14 }
  );
  assert.equal(drawnTexts.includes('-'), false);
  // Inner vertical column dividers at x = 18+9=27, 27+42=69, 69+61=130, 130+24=154
  const verticalXs = new Set(
    drawnLines
      .filter((l) => Math.abs(l.x1 - l.x2) < 0.01 && Math.abs(l.y2 - l.y1) > 1)
      .map((l) => Math.round(l.x1))
  );
  assert.equal(verticalXs.has(27), true);
  assert.equal(verticalXs.has(69), true);
  assert.equal(verticalXs.has(130), true);
  assert.equal(verticalXs.has(154), true);

  const OriginalBlob = globalThis.Blob;
  const capturedPdfs: string[] = [];
  globalThis.Blob = class CaptureSjBastPdfBlob extends OriginalBlob {
    constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      if (options?.type === 'application/pdf' && Array.isArray(parts)) {
        const ascii = parts
          .map((part) => {
            if (part instanceof ArrayBuffer) {
              return Buffer.from(part).toString('latin1');
            }
            if (ArrayBuffer.isView(part)) {
              return Buffer.from(part.buffer, part.byteOffset, part.byteLength).toString('latin1');
            }
            return String(part);
          })
          .join('\n');
        capturedPdfs.push(ascii);
      }
    }
  };

  const extractText = (ascii: string) =>
    Array.from(ascii.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g))
      .map((m) => m[1].replace(/\\([()\\])/g, '$1'))
      .join(' ')
      .replace(/\s+/g, ' ');

  try {
    await pdfModule.downloadDeliveryOrderPdf(bundle.deliveryOrder, BUSINESS_CONFIG, sampleProject);
    await pdfModule.downloadHandoverPdf(
      bundle.handoverCertificate,
      BUSINESS_CONFIG,
      DEFAULT_PAYMENT_SCHEME,
      bundle.invoice,
      sampleProject
    );
  } finally {
    globalThis.Blob = OriginalBlob;
  }

  assert.equal(capturedPdfs.length, 2);
  const [sjPdfText, bastPdfText] = capturedPdfs.map(extractText);

  assert.ok(sjPdfText.includes('SAAT PENGIRIMAN (BARANG DATANG)'));
  assert.ok(sjPdfText.includes('SETELAH INSTALASI SELESAI (ARSIP)'));
  assert.equal(sjPdfText.includes('1. SAAT PENGIRIMAN'), false);
  assert.equal(sjPdfText.includes('2. SETELAH INSTALASI'), false);

  assert.match(bastPdfText, /Termin 4/i);
  assert.ok(bastPdfText.includes('28 Nov 2026'));
  assert.ok(bastPdfText.includes('LAMPIRAN BERITA ACARA SERAH TERIMA'));
  assert.ok(bastPdfText.includes('DAFTAR PERIKSA KENDALI MUTU (QUALITY CONTROL / QC)'));
  assert.ok(bastPdfText.includes('LULUS / TIDAK'));
  assert.ok(bastPdfText.includes('CATATAN / KETERANGAN'));
  assert.ok(bastPdfText.includes('Dimensi & Kesesuaian Desain'));
});


