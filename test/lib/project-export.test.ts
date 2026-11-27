import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PAYMENT_SCHEME } from '../../src/lib/payment-scheme';
import { buildProjectCsvContent, buildProjectDocsHtml } from '../../src/lib/project-export';
import { DEFAULT_CATALOG_PRODUCTS } from '../../src/lib/project-products';
import type { ProjectWorkspaceData } from '../../src/lib/project-workspace';
import type { BusinessConfig } from '../../src/types/business';

const sampleBusinessConfig: BusinessConfig = {
  namaMerek: 'Shansus Dzar Indonesia',
  drafSlogan: 'Interior Design & Building',
  whatsapp: {
    nomorTampil: '0813-1500-0234',
    digitTerstandar: '6281315000234',
    urlDasar: 'https://wa.me/6281315000234',
  },
  alamat: {
    jalan: 'Kp. Tegal Jati',
    rtRw: 'RT 019/RW 010',
    desa: 'Cibogohilir',
    kabupaten: 'Kabupaten Purwakarta',
    kodePos: '41162',
    negara: 'Indonesia',
    alamatLengkap: 'Kp. Tegal Jati, Plered, Kabupaten Purwakarta',
  },
  mediaSosial: {
    urlFacebook: '',
    urlInstagram: '',
    urlTiktok: '',
  },
  drafPemilik: {
    terverifikasi: false,
    namaPemilik: 'Admin Workshop',
    jabatanPemilik: 'Pimpinan',
    kutipanPemilik: '',
    jalurFoto: '',
    teksAltFoto: '',
  },
};

const sampleStage = {
  id: 'termin-dp',
  urutan: 1,
  nama: 'Termin 1 (DP)',
  persentase: 30,
  keterangan: 'Uang muka',
  targetAmount: 7950000,
  paidAmount: 7950000,
  remainingAmount: 0,
  progressPercent: 100,
  status: 'Lunas' as const,
};

const sampleWorkspace: ProjectWorkspaceData = {
  project: {
    id: 'K-002',
    namaProyek: 'Kitchen Set L-Shape HPL & Kabinet Pantry',
    namaKlien: 'Ibu Ratna Dewi',
    teleponKlien: '+6281294401122',
    alamat: {
      detail: 'Perumahan Bukit Indah Blok C4',
    },
    nilaiKontrak: 26500000,
    tanggalMulai: '2026-11-17',
    tanggalTargetSelesai: '2026-12-02',
    status: 'Selesai',
    dibuatPada: '2026-11-17T08:00:00.000Z',
    daftarProduk: [
      {
        id: 'item-1',
        namaProduk: 'Kitchen Set L-Shape',
        spesifikasiMaterial: 'Multiplek 18mm + HPL Taco',
        dimensi: '320 x 180 cm',
        jumlah: 1,
        satuan: 'Set',
        hargaSatuan: 26500000,
      },
    ],
  },
  quotations: [],
  agreements: [],
  workOrders: [],
  deliveryOrders: [],
  handoverCertificates: [],
  invoices: [],
  transactions: [
    {
      id: 'tx-1',
      projectId: 'K-002',
      tanggal: '2026-11-18',
      jenis: 'pemasukan',
      kategori: 'DP Proyek',
      judul: 'Pembayaran DP Termin 1',
      referensiProyek: 'K-002',
      pihakTerkait: 'Ibu Ratna Dewi',
      metodePembayaran: 'Transfer Bank',
      nominal: 7950000,
      status: 'Selesai',
      catatan: '',
      dibuatPada: '2026-11-18T08:00:00.000Z',
    },
  ],
  incomeTransactions: [],
  expenseTransactions: [],
  primaryInvoice: null,
  paymentSchedule: {
    scheme: DEFAULT_PAYMENT_SCHEME,
    totalContract: 26500000,
    totalPaid: 7950000,
    remainingTotal: 18550000,
    stages: [sampleStage],
    nextStage: null,
    finalStage: sampleStage,
  },
  summary: {
    contractValue: 26500000,
    paidAmount: 7950000,
    remainingBill: 18550000,
    expenseTotal: 0,
    pendingExpenseTotal: 0,
    netMargin: 7950000,
    progressPercent: 30,
    documentCount: 0,
    financeCount: 1,
  },
};

test('buildProjectCsvContent includes project metadata, products, schedule, and transactions', () => {
  const csv = buildProjectCsvContent(sampleWorkspace);
  assert.ok(csv.includes('K-002'));
  assert.ok(csv.includes('0812-9440-1122'));
  assert.equal(csv.includes('+6281294401122'), false);
  assert.ok(csv.includes('Dimensi (cm)'));
  assert.ok(csv.includes('320 x 180'));
  assert.equal(csv.includes('320 x 180 cm'), false);
  assert.ok(csv.includes('Kitchen Set L-Shape HPL & Kabinet Pantry'));
  assert.ok(csv.includes('Multiplek 18mm + HPL Taco'));
  assert.ok(csv.includes('Termin 1 (DP)'));
  assert.ok(csv.includes('Pembayaran DP Termin 1'));
});

test('buildProjectDocsHtml escapes HTML safely and renders formal Word-compatible letter sections without cards', () => {
  const html = buildProjectDocsHtml(sampleWorkspace, sampleBusinessConfig);
  assert.ok(html.includes('Shansus Dzar Indonesia'));
  assert.ok(html.includes('Interior Design &amp; Building'));
  assert.ok(html.indexOf('Interior Design &amp; Building') < html.indexOf('<h1>Shansus Dzar Indonesia</h1>'));
  assert.ok(html.includes('Kab. Purwakarta.'));
  assert.ok(html.includes('www.shansusdzar.com · shansusdzar@gmail.com · 0813-1500-0234'));
  assert.equal(html.includes('WhatsApp:'), false);
  assert.equal(html.includes('Email:'), false);
  assert.ok(html.includes('Laporan Ringkasan Proyek &amp; Realisasi Keuangan'));
  assert.ok(html.includes('class="kop"'));
  assert.ok(html.includes('Times New Roman'));
  assert.equal(html.includes('border-radius'), false);
  assert.ok(html.includes('/logo-gelap.webp'));
  assert.ok(html.includes('/stempel.webp'));
  assert.ok(html.includes('opacity:0.4'));
  assert.equal(html.includes('/ttd-owner.webp'), false);
  assert.equal(html.includes('Status Tahap'), false);
  assert.ok(html.includes('<thead><tr><th>Dokumen</th><th>Nomor</th><th>Tanggal</th></tr></thead>'));
  assert.ok(html.includes('<th>Dimensi (cm)</th>'));
  assert.ok(html.includes('320 x 180'));
  assert.equal(html.includes('320 x 180 cm'), false);
  assert.ok(html.includes('Ibu Ratna Dewi (0812-9440-1122)'));
  assert.equal(html.includes('+6281294401122'), false);
  assert.equal(/h3\s*\{[^}]*border-bottom/.test(html), false);
  assert.ok(/table\s*\{[^}]*margin:\s*6px 0 16px/.test(html));
  assert.ok(html.includes('.kop-table { margin: 0; }'));
  assert.ok(html.includes('Kitchen Set L-Shape'));
  assert.ok(html.includes('Termin 1 (DP)'));
  assert.ok(html.includes('Pembayaran DP Termin 1'));

  const embeddedHtml = buildProjectDocsHtml(sampleWorkspace, sampleBusinessConfig, {
    logo: { dataUrl: 'data:image/png;base64,LOGO123', width: 100, height: 88 },
    ownerSignature: { dataUrl: 'data:image/png;base64,SIG123', width: 200, height: 120 },
    companyStamp: { dataUrl: 'data:image/png;base64,STAMP123', width: 300, height: 70 },
  });
  assert.ok(embeddedHtml.includes('data:image/png;base64,LOGO123'));
  assert.equal(embeddedHtml.includes('data:image/png;base64,SIG123'), false);
  assert.ok(embeddedHtml.includes('data:image/png;base64,STAMP123'));
  assert.ok(embeddedHtml.includes('opacity:1'));
  assert.ok(/th\s*\{[^}]*background:\s*#282726/i.test(html));
  assert.ok(/th\s*\{[^}]*color:\s*#ffffff/i.test(html));
  assert.ok(/th\s*\{[^}]*text-align:\s*center/.test(html));
  assert.equal(/<th[^>]*text-align:\s*right/i.test(html), false);
  assert.ok(html.includes('<table class="idr-cell-table"><tr><td class="idr-symbol">Rp</td><td class="idr-amount">26.500.000</td></tr></table>'));
  assert.ok(html.includes('Rincian Komponen Biaya'));
  assert.ok(html.includes('class="cost-breakdown-plain"'));
  assert.ok(html.includes('<td colspan="3"></td>\n        <td colspan="2" style="text-align:left;padding-top:8px;">TOTAL NILAI KONTRAK PEKERJAAN</td>'));
  assert.ok(html.includes('<td colspan="3"></td>\n        <td colspan="2">Biaya Desain 3D</td>'));
  assert.ok(html.includes('<td colspan="3"></td>\n        <td colspan="2" style="padding-left:20px;">Potongan Promo</td>'));
  assert.ok(html.includes('class="cost-breakdown-divider-row"'));
  assert.ok(html.includes('<td colspan="2" style="text-align:left;padding-top:4px;">TOTAL NILAI KONTRAK PEKERJAAN</td>'));
  assert.equal(html.includes('<th>Komponen Biaya</th>'), false);
  assert.equal(html.includes('Gratis Survei &amp; Pengukuran Lokasi'), false);
  assert.equal(html.includes('Biaya Survei'), false);
  assert.ok(html.includes('Biaya Desain 3D'));
  assert.ok(html.includes('Biaya Pengiriman'));
  assert.ok(html.includes('Harga Produk'));
  assert.ok(html.includes('Potongan Promo'));
  assert.ok(html.includes('Harga Setelah Potongan'));
  assert.ok(html.includes('PPN (11%)'));
  assert.ok(html.includes('TOTAL NILAI KONTRAK PEKERJAAN'));
  assert.ok(html.includes('<th>No</th><th>Produk &amp; Spesifikasi</th><th>Material</th><th>Dimensi (cm)</th><th>Harga Satuan</th><th>Jumlah</th>'));
  assert.ok(html.includes('<strong>Multiplek</strong><br/><span style="color:#555;font-size:10pt;">18 mm (Grade A)</span><br/><span style="color:#555;font-size:10pt;">HPL Taco</span>'));
  assert.ok(html.includes('<tr class="total-row" style="background:transparent;font-weight:bold;">'));
  assert.ok(html.includes('tfoot tr, tr.total-row, tr.total-row td { border: none !important; background: transparent !important; padding-top: 8px; }'));
  assert.ok(html.includes('border: 1px solid #d6d5d2'));
  assert.ok(html.includes('border-top: 1px solid #e5e4e1; border-bottom: 1px solid #e5e4e1; border-left: none; border-right: none;'));
  assert.ok(html.includes('tbody tr:nth-child(odd) { background: #ffffff; }'));
  assert.ok(html.includes('tbody tr:nth-child(even) { background: #f6f6f5; }'));

  const promoProduct = DEFAULT_CATALOG_PRODUCTS.find((p) => Boolean(p.promo));
  assert.ok(promoProduct);
  const promoWorkspace: ProjectWorkspaceData = {
    ...sampleWorkspace,
    project: {
      ...sampleWorkspace.project,
      daftarProduk: [
        {
          ...sampleWorkspace.project.daftarProduk![0],
          id: promoProduct.id,
          namaProduk: promoProduct.nama,
        },
      ],
    },
  };
  const promoHtml = buildProjectDocsHtml(promoWorkspace, sampleBusinessConfig);
  assert.equal(html.includes('<del>Rp</del>'), false);
  assert.match(html, /Biaya Desain 3D<\/td>\s*<td><table class="idr-cell-table"><tr><td class="idr-symbol">Rp<\/td><td class="idr-amount"><del>[^<]+<\/del><\/td><\/tr><\/table><\/td>/);
  assert.equal(promoHtml.includes('Rp 0'), false);
  assert.equal(promoHtml.includes('#b42318'), false);
  assert.match(promoHtml, /Potongan Promo<\/td>\s*<td><table class="idr-cell-table"><tr><td class="idr-symbol"><span style="[^"]*">-<\/span>Rp<\/td><td class="idr-amount">[^<-]+<\/td><\/tr><\/table><\/td>/);
});

