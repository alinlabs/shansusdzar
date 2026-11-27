import { jsPDF } from 'jspdf';
import {
  FORMAL_DOCUMENT_HEADER_META,
  formatFormalDocumentAddress,
  formatFormalDocumentContacts,
} from './business-config';
import { buildCostBreakdownFromProject } from './document-cost-breakdown';
import {
  STANDARD_DOCUMENT_PRODUCT_TABLE_COLUMNS,
  formatStandardDocumentProductRow,
} from './document-product-table';
import { formatDocumentDimensionDisplay } from './dimension-format';
import { sanitizeNumberForFilename } from './document-numbering';
import { formatShortDateId, splitAccountingRupiahDisplay } from './finance-utils';
import { formatDocumentPhoneDisplay } from './phone-format';
import {
  addFormalPageFooters,
  drawColonMetadataRows,
  drawFormalCostBreakdownTable,
  drawFormalGridTable,
  drawFormalLetterhead,
  drawFormalSectionHeading,
  drawFormalSignatures,
  drawTwoColumnMetadata,
  toStandardProductFormalTableRows,
} from './pdf/build-workshop-documents-pdf';
import {
  WORKSHOP_BRAND_ASSETS,
  getCachedWorkshopBrandPdfAssets,
  loadWorkshopBrandPdfAssets,
  type WorkshopBrandPdfAssets,
} from './pdf/image-prep';
import { openPdfDocumentInNewTab, type OpenPdfBlobResult } from './pdf/open-pdf-blob';
import {
  computeProjectProductSubtotal,
  computeProjectProductTambahanTotal,
  resolveProjectProductName,
} from './project-products';
import { formatFullWilayahAddress } from './wilayah-indonesia';
import type { ProjectWorkspaceData } from './project-workspace';
import type { BusinessConfig } from '../types/business';

function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function formatAccountingIdrTd(amount: number, bold = false): string {
  const formatted = formatIdr(amount);
  const split = splitAccountingRupiahDisplay(formatted);
  const boldAttr = bold ? ' style="font-weight:bold;"' : '';
  if (!split) {
    return `<td style="text-align:right;${bold ? 'font-weight:bold;' : ''}">${escapeHtml(formatted)}</td>`;
  }
  return `<td${boldAttr}><table class="idr-cell-table"><tr><td class="idr-symbol">${escapeHtml(split.symbol)}</td><td class="idr-amount">${escapeHtml(split.amount)}</td></tr></table></td>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerFileDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

export function buildProjectCsvContent(workspace: ProjectWorkspaceData): string {
  const { project, summary, paymentSchedule, transactions } = workspace;
  const products = project.daftarProduk ?? [];

  const rows: Array<Array<string | number>> = [
    ['RINGKASAN PROYEK'],
    ['Kode Klien', project.id || '-'],
    ['Nama Proyek', project.namaProyek],
    ['Klien', project.namaKlien],
    ['Telepon Klien', formatDocumentPhoneDisplay(project.teleponKlien) || '-'],
    ['Lokasi', formatFullWilayahAddress(project.alamat) || '-'],
    ['Status', project.status],
    ['Tanggal Mulai', project.tanggalMulai],
    ['Target Selesai', project.tanggalTargetSelesai],
    ['Nilai Kontrak (IDR)', summary.contractValue],
    ['Pemasukan Proyek (IDR)', summary.paidAmount],
    ['Progres Pembayaran (%)', `${summary.progressPercent}%`],
    ['Sisa Tagihan (IDR)', summary.remainingBill],
    ['Belanja & Biaya (IDR)', summary.expenseTotal],
    ['Margin Proyek (IDR)', summary.netMargin],
    [],
    ['DAFTAR PRODUK / ITEM PEKERJAAN'],
    ['No', 'Nama Produk', 'Dimensi (cm)', 'Material', 'Jumlah', 'Satuan', 'Harga Satuan', 'Tambahan (IDR)', 'Subtotal'],
    ...products.map((item, idx) => {
      const qty = Math.max(1, item.jumlah || 1);
      const price = Math.max(0, item.hargaSatuan || 0);
      const addonsCost = computeProjectProductTambahanTotal(item);
      return [
        idx + 1,
        resolveProjectProductName(item) || '-',
        formatDocumentDimensionDisplay(item.dimensi) || '-',
        item.spesifikasiMaterial || '-',
        qty,
        item.satuan?.trim() || 'Unit',
        price,
        addonsCost,
        computeProjectProductSubtotal(item),
      ];
    }),
    [],
    ['SKEMA TERMIN PEMBAYARAN'],
    ['Termin', 'Persentase', 'Target (IDR)', 'Terbayar (IDR)', 'Sisa (IDR)', 'Status'],
    ...paymentSchedule.stages.map((st) => [
      st.nama,
      `${st.persentase}%`,
      st.targetAmount,
      st.paidAmount,
      st.remainingAmount,
      st.status,
    ]),
    [],
    ['TRANSAKSI KEUANGAN PROYEK'],
    ['Tanggal', 'Jenis', 'Kategori', 'Judul', 'Metode', 'Nominal (IDR)', 'Status', 'Catatan'],
    ...transactions.map((tx) => [
      tx.tanggal,
      tx.jenis,
      tx.kategori,
      tx.judul,
      tx.metodePembayaran,
      tx.nominal,
      tx.status,
      tx.catatan || '',
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

export function downloadProjectCsv(workspace: ProjectWorkspaceData): void {
  const csv = buildProjectCsvContent(workspace);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const dateSuffix = new Date().toISOString().slice(0, 10);
  const fileKey = workspace.project.id || workspace.project.namaProyek;
  const filename = `${sanitizeNumberForFilename(fileKey)}-${dateSuffix}.csv`;
  triggerFileDownload(blob, filename);
}

export function buildProjectDocsHtml(
  workspace: ProjectWorkspaceData,
  businessConfig: BusinessConfig,
  brandAssets?: WorkshopBrandPdfAssets | null
): string {
  const {
    project,
    summary,
    paymentSchedule,
    quotations,
    agreements,
    workOrders,
    deliveryOrders,
    handoverCertificates,
    invoices,
    transactions,
  } = workspace;
  const products = project.daftarProduk ?? [];

  const productRows =
    products.length > 0
      ? products
          .map((item, idx) => {
            const formattedRow = formatStandardDocumentProductRow(
              {
                productId: item.id,
                namaProduk: item.namaProduk,
                customisasi: item.customisasi,
                tambahan: item.tambahan,
                material: item.material,
                finishing: item.finishing,
                kodeWarna: item.kodeWarna,
                spesifikasiMaterial: item.spesifikasiMaterial,
                dimensi: item.dimensi,
                jumlah: item.jumlah,
                satuan: item.satuan,
                hargaSatuan: item.hargaSatuan,
                subtotal: computeProjectProductSubtotal(item),
                linkedProjectProduct: item,
              },
              idx
            );
            const specHtml = formattedRow.specText
              ? `<br/><span style="color:#555;font-size:10.5pt;">${escapeHtml(formattedRow.specText)}</span>`
              : '';
            const materialLines = [
              `<strong>${escapeHtml(formattedRow.materialTitle)}</strong>`,
              formattedRow.materialThicknessLine
                ? `<span style="color:#555;font-size:10pt;">${escapeHtml(formattedRow.materialThicknessLine)}</span>`
                : '',
              formattedRow.materialFinishingLine
                ? `<span style="color:#555;font-size:10pt;">${escapeHtml(formattedRow.materialFinishingLine)}</span>`
                : '',
            ]
              .filter(Boolean)
              .join('<br/>');
            return `<tr>
              <td style="text-align:center;">${escapeHtml(formattedRow.noText)}</td>
              <td><strong>${escapeHtml(formattedRow.productTitle)}</strong>${specHtml}</td>
              <td>${materialLines}</td>
              <td>${escapeHtml(formattedRow.dimensionText)}<br/><span style="color:#555;font-size:10pt;">${escapeHtml(formattedRow.quantityText)}</span></td>
              ${formatAccountingIdrTd(formattedRow.unitPrice ?? 0)}
              ${formatAccountingIdrTd(formattedRow.subtotal ?? 0, true)}
            </tr>`;
          })
          .join('')
      : '<tr><td colspan="6" style="color:#666;">Belum ada rincian produk.</td></tr>';

  const formatStrikethroughAccountingIdrTd = (amount: number) => {
    const formatted = formatIdr(amount);
    const split = splitAccountingRupiahDisplay(formatted);
    if (!split) {
      return `<td style="text-align:right;">${amount > 0 ? `<del>${escapeHtml(formatted)}</del>` : escapeHtml(formatted)}</td>`;
    }
    return amount > 0
      ? `<td><table class="idr-cell-table"><tr><td class="idr-symbol">${escapeHtml(split.symbol)}</td><td class="idr-amount"><del>${escapeHtml(split.amount)}</del></td></tr></table></td>`
      : `<td><table class="idr-cell-table"><tr><td class="idr-symbol">${escapeHtml(split.symbol)}</td><td class="idr-amount">${escapeHtml(split.amount)}</td></tr></table></td>`;
  };
  const costBreakdown = buildCostBreakdownFromProject(project, summary.contractValue);
  const costBreakdownHtml = costBreakdown
    ? `<tr class="cost-breakdown-heading">
        <td colspan="3"></td>
        <td colspan="3" style="font-weight:bold;padding-top:5px;padding-bottom:3px;">Rincian Komponen Biaya</td>
      </tr>
      <tr>
        <td colspan="3"></td>
        <td colspan="2">Biaya Desain 3D</td>
        ${formatStrikethroughAccountingIdrTd(costBreakdown.design3dFee)}
      </tr>
      <tr>
        <td colspan="3"></td>
        <td colspan="2">Biaya Pengiriman (${escapeHtml(costBreakdown.deliveryFleetLabel)})</td>
        ${formatStrikethroughAccountingIdrTd(costBreakdown.deliveryFee)}
      </tr>
      <tr>
        <td colspan="3"></td>
        <td colspan="2">Harga Produk</td>
        ${formatAccountingIdrTd(costBreakdown.productPriceAmount)}
      </tr>
      <tr>
        <td colspan="3"></td>
        <td colspan="2" style="padding-left:20px;">Potongan Promo</td>
        ${
          costBreakdown.promoDiscountAmount > 0
            ? `<td><table class="idr-cell-table"><tr><td class="idr-symbol"><span style="display:inline-block;width:0.45em;margin-left:-0.45em;">-</span>Rp</td><td class="idr-amount">${escapeHtml(splitAccountingRupiahDisplay(formatIdr(costBreakdown.promoDiscountAmount))?.amount ?? formatIdr(costBreakdown.promoDiscountAmount))}</td></tr></table></td>`
            : formatAccountingIdrTd(0)
        }
      </tr>
      <tr>
        <td colspan="3"></td>
        <td colspan="2"><strong>Harga Setelah Potongan</strong></td>
        ${formatAccountingIdrTd(costBreakdown.priceAfterDiscount, true)}
      </tr>
      <tr>
        <td colspan="3"></td>
        <td colspan="2">PPN (11%)</td>
        ${formatAccountingIdrTd(costBreakdown.ppnAmount)}
      </tr>
      <tr class="cost-breakdown-divider-row">
        <td colspan="3"></td>
        <td colspan="3" style="padding:4px 8px 2px;"><div style="border-top:1px solid #828282;height:0;overflow:hidden;"></div></td>
      </tr>
      <tr class="total-row" style="background:transparent;font-weight:bold;">
        <td colspan="3"></td>
        <td colspan="2" style="text-align:left;padding-top:4px;">TOTAL NILAI KONTRAK PEKERJAAN</td>
        ${formatAccountingIdrTd(costBreakdown.totalAmount, true)}
      </tr>`
    : '';

  const adminDocsList: Array<{ label: string; number: string; date: string }> = [
    ...quotations.map((q) => ({
      label: 'Surat Penawaran',
      number: q.nomorPenawaran,
      date: formatShortDateId(q.tanggalPenawaran),
    })),
    ...agreements.map((ag) => ({
      label: 'Surat Perjanjian Kerja (SPK)',
      number: ag.nomorKontrak,
      date: formatShortDateId(ag.tanggalPenandatanganan),
    })),
    ...deliveryOrders.map((sj) => ({
      label: 'Surat Jalan',
      number: sj.nomorSuratJalan,
      date: formatShortDateId(sj.tanggalKirim),
    })),
    ...handoverCertificates.map((b) => ({
      label: 'BAST',
      number: b.nomorBast,
      date: formatShortDateId(b.tanggalSerahTerima),
    })),
  ];

  const adminDocRows =
    adminDocsList.length > 0
      ? adminDocsList
          .map(
            (d) => `<tr>
            <td>${escapeHtml(d.label)}</td>
            <td>${escapeHtml(d.number)}</td>
            <td>${escapeHtml(d.date)}</td>
          </tr>`
          )
          .join('')
      : '<tr><td colspan="3" style="color:#666;">Belum ada dokumen administrasi.</td></tr>';

  const stageRows = paymentSchedule.stages
    .map(
      (st) => `<tr>
        <td>${escapeHtml(st.nama)} (${st.persentase}%)</td>
        ${formatAccountingIdrTd(st.targetAmount)}
        ${formatAccountingIdrTd(st.paidAmount)}
        ${formatAccountingIdrTd(st.remainingAmount)}
        <td>${escapeHtml(st.status)}</td>
      </tr>`
    )
    .join('');

  const txRows =
    transactions.length > 0
      ? transactions
          .map(
            (tx) => `<tr>
            <td>${escapeHtml(formatShortDateId(tx.tanggal))}</td>
            <td>${escapeHtml(tx.jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran')}</td>
            <td>${escapeHtml(tx.judul)}</td>
            <td>${escapeHtml(tx.kategori)}</td>
            ${formatAccountingIdrTd(tx.nominal)}
            <td>${escapeHtml(tx.status)}</td>
          </tr>`
          )
          .join('')
      : '<tr><td colspan="6" style="color:#666;">Belum ada transaksi kas tercatat.</td></tr>';

  const invoiceSummary =
    invoices.length > 0
      ? invoices.map((inv) => inv.nomorInvoice).join(', ')
      : 'Belum diterbitkan';
  const logoSrc = brandAssets?.logo?.dataUrl ?? WORKSHOP_BRAND_ASSETS.logoUrl;
  const stampSrc = brandAssets?.companyStamp?.dataUrl ?? WORKSHOP_BRAND_ASSETS.companyStampUrl;
  const stampCssOpacity = brandAssets?.companyStamp?.dataUrl ? '1' : '0.4';

  const refLabel = project.id || project.namaProyek;

  const projectLocationLabel = formatFullWilayahAddress(project.alamat) || '-';
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="id">
<head>
  <meta charset="utf-8" />
  <title>Ringkasan Proyek ${escapeHtml(refLabel)}</title>
  <style>
    body { font-family: "Times New Roman", Times, serif; color: #141414; font-size: 11.5pt; line-height: 1.45; margin: 24px; }
    .kop { border-bottom: 3px double #141414; padding-bottom: 8px; margin-bottom: 14px; }
    .kop-table { width: 100%; border-collapse: collapse; margin: 0; }
    .kop-table td { border: none; padding: 0; vertical-align: middle; }
    .kop h1 { font-size: 15pt; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 0.5px; }
    .kop p { margin: 1px 0; font-size: 9.5pt; color: #373737; }
    .doc-title { text-align: center; margin-bottom: 14px; }
    .doc-title h2 { display: inline-block; font-size: 12.5pt; margin: 0; border-bottom: 1px solid #141414; text-transform: uppercase; padding-bottom: 1px; }
    .doc-title p { margin: 4px 0 0; font-size: 10pt; font-weight: bold; }
    h3 { font-size: 10.5pt; margin: 18px 0 6px; text-transform: uppercase; }
    p { margin: 2px 0; text-align: justify; }
    .kop p, .doc-title p { text-align: center; }
    .formal-list-item { margin: 2px 0 2px 32px; text-indent: -16px; text-align: justify; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0 16px; font-size: 10pt; border: 1px solid #d6d5d2; }
    table.has-tfoot-total { border: none; margin-bottom: 6px; }
    table.has-tfoot-total tbody td:first-child { border-left: 1px solid #d6d5d2; }
    table.has-tfoot-total tbody td:last-child { border-right: 1px solid #d6d5d2; }
    table.has-tfoot-total tbody tr:last-child td { border-bottom: 1px solid #d6d5d2; }
    tfoot.cost-breakdown-plain tr { background: transparent !important; }
    tfoot.cost-breakdown-plain td { border: none !important; background: transparent !important; padding: 2px 8px; vertical-align: baseline; }
    .kop-table { margin: 0; }
    .meta-table { margin: 4px 0 12px; }
    .kop-table, .meta-table, .idr-cell-table { border: none; }
    th, td { border-top: 1px solid #e5e4e1; border-bottom: 1px solid #e5e4e1; border-left: none; border-right: none; padding: 6px 8px; vertical-align: top; text-align: left; }
    th { background: #282726; color: #ffffff; font-weight: bold; text-align: center; vertical-align: middle; border-top: 1px solid #282726; border-bottom: 1px solid #282726; }
    thead { display: table-row-group; }
    tbody tr:nth-child(odd) { background: #ffffff; }
    tbody tr:nth-child(even) { background: #f6f6f5; }
    tfoot tr, tr.total-row, tr.total-row td { border: none !important; background: transparent !important; padding-top: 8px; }
    .kop-table tr, .meta-table tr, .idr-cell-table tr { background: transparent !important; }
    .meta-table td { border: none; padding: 2px 6px 2px 0; }
    .idr-cell-table { width: 100%; border-collapse: collapse; margin: 0; border: none; }
    .idr-cell-table td { border: none; padding: 0; font-size: inherit; font-weight: inherit; vertical-align: baseline; }
    .idr-cell-table .idr-symbol { text-align: left; white-space: nowrap; padding-right: 6px; }
    .idr-cell-table .idr-amount { text-align: right; white-space: nowrap; }
  </style>
</head>
<body>
  <div class="kop">
    <table class="kop-table">
      <tr>
        <td style="width:64px;text-align:left;">
          <img src="${escapeHtml(logoSrc)}" alt="Logo ${escapeHtml(businessConfig.namaMerek)}" width="50" height="44" style="display:block;object-fit:contain;" />
        </td>
        <td style="text-align:center;">
          <p><em>${escapeHtml(FORMAL_DOCUMENT_HEADER_META.tagline)}</em></p>
          <h1>${escapeHtml(businessConfig.namaMerek)}</h1>
          <p>${escapeHtml(formatFormalDocumentAddress(businessConfig.alamat.alamatLengkap))}</p>
          <p>${escapeHtml(formatFormalDocumentContacts(businessConfig.whatsapp.nomorTampil))}</p>
        </td>
        <td style="width:64px;"></td>
      </tr>
    </table>
  </div>
  <div class="doc-title">
    <h2>Laporan Ringkasan Proyek &amp; Realisasi Keuangan</h2>
    <p>Kode Klien: ${escapeHtml(project.id || '-')} · ${escapeHtml(project.namaProyek)}</p>
  </div>

  <h3>I. Identitas &amp; Jadwal Proyek</h3>
  <table class="meta-table">
    <tr><td style="width:160px;"><strong>Kode Klien</strong></td><td>${escapeHtml(project.id || '-')}</td><td style="width:140px;"><strong>Jumlah Item</strong></td><td>${products.length} item</td></tr>
    <tr><td><strong>Nama Proyek</strong></td><td>${escapeHtml(project.namaProyek)}</td><td><strong>Tanggal Mulai</strong></td><td>${escapeHtml(formatShortDateId(project.tanggalMulai))}</td></tr>
    <tr><td><strong>Klien</strong></td><td>${escapeHtml(project.namaKlien)}${formatDocumentPhoneDisplay(project.teleponKlien) ? ` (${escapeHtml(formatDocumentPhoneDisplay(project.teleponKlien))})` : ''}</td><td><strong>Target Selesai</strong></td><td>${escapeHtml(formatShortDateId(project.tanggalTargetSelesai))}</td></tr>
    <tr><td><strong>Lokasi</strong></td><td colspan="3">${escapeHtml(projectLocationLabel)}</td></tr>
  </table>

  <h3>II. Ringkasan Keuangan Proyek</h3>
  <table>
    <thead>
      <tr>
        <th>Nilai Kontrak</th>
        <th>Pemasukan (${summary.progressPercent}%)</th>
        <th>Sisa Tagihan</th>
        <th>Belanja &amp; Biaya</th>
        <th>Margin Proyek</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        ${formatAccountingIdrTd(summary.contractValue, true)}
        ${formatAccountingIdrTd(summary.paidAmount)}
        ${formatAccountingIdrTd(summary.remainingBill)}
        ${formatAccountingIdrTd(summary.expenseTotal)}
        ${formatAccountingIdrTd(summary.netMargin, true)}
      </tr>
    </tbody>
  </table>
  <p style="margin:0 0 12px;">Invoice Induk: <strong>${escapeHtml(invoiceSummary)}</strong></p>

  <h3>III. Daftar Produk &amp; Pekerjaan</h3>
  <table class="has-tfoot-total">
    <thead>
      <tr><th>No</th><th>Produk &amp; Spesifikasi</th><th>Material</th><th>Dimensi (cm)</th><th>Harga Satuan</th><th>Jumlah</th></tr>
    </thead>
    <tbody>${productRows}</tbody>
    <tfoot class="cost-breakdown-plain">
      <tr class="total-row" style="background:transparent;font-weight:bold;">
        <td colspan="3"></td>
        <td colspan="2" style="text-align:left;padding-top:8px;">TOTAL NILAI KONTRAK PEKERJAAN</td>
        ${formatAccountingIdrTd(summary.contractValue, true)}
      </tr>
      ${costBreakdownHtml}
    </tfoot>
  </table>

  <h3>IV. Dokumen Administrasi Proyek</h3>
  <table>
    <thead><tr><th>Dokumen</th><th>Nomor</th><th>Tanggal</th></tr></thead>
    <tbody>${adminDocRows}</tbody>
  </table>

  <h3>V. Jadwal Termin Pembayaran</h3>
  <table>
    <thead><tr><th>Termin</th><th>Target</th><th>Terbayar</th><th>Sisa</th><th>Status</th></tr></thead>
    <tbody>${stageRows}</tbody>
  </table>

  <h3>VI. Riwayat Transaksi Kas Proyek</h3>
  <table>
    <thead><tr><th>Tanggal</th><th>Jenis</th><th>Judul</th><th>Kategori</th><th>Nominal</th><th>Status</th></tr></thead>
    <tbody>${txRows}</tbody>
  </table>

  <p style="text-align:center;margin:28px 0 8px;font-size:10.5pt;">${escapeHtml(businessConfig.alamat.kabupaten.replace(/^Kabupaten\s+/i, '').trim() || 'Purwakarta')}, ${escapeHtml(formatShortDateId(new Date().toISOString().slice(0, 10)))}</p>
  <table style="width:auto;margin:0 0 0 auto;border:none;">
    <tr>
      <td style="border:none;padding:0;width:210px;text-align:center;font-size:10.5pt;">
        <p style="margin-top:2px;"><strong>${escapeHtml(businessConfig.namaMerek)}</strong></p>
        <div style="width:190px;height:72px;line-height:72px;margin:8px auto 4px;text-align:center;">
          <img src="${escapeHtml(stampSrc)}" alt="Stempel Resmi ${escapeHtml(businessConfig.namaMerek)}" width="142" height="34" style="display:inline-block;vertical-align:middle;opacity:${stampCssOpacity};object-fit:contain;" />
        </div>
        <p style="margin-top:2px;font-weight:bold;text-decoration:underline;">${escapeHtml(businessConfig.drafPemilik.namaPemilik || 'Pimpinan Workshop')}</p>
        <p style="font-size:9.5pt;color:#373737;">${escapeHtml(businessConfig.drafPemilik.jabatanPemilik || 'Penanggung Jawab')}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function downloadProjectDocs(
  workspace: ProjectWorkspaceData,
  businessConfig: BusinessConfig
): Promise<void> {
  const brandAssets = getCachedWorkshopBrandPdfAssets() ?? (await loadWorkshopBrandPdfAssets());
  const html = buildProjectDocsHtml(workspace, businessConfig, brandAssets);
  const blob = new Blob([`\uFEFF${html}`], { type: 'application/msword;charset=utf-8' });
  const dateSuffix = new Date().toISOString().slice(0, 10);
  const fileKey = workspace.project.id || workspace.project.namaProyek;
  const filename = `${sanitizeNumberForFilename(fileKey)}-${dateSuffix}.doc`;
  triggerFileDownload(blob, filename);
}

function buildProjectSummaryPdfDocument(
  workspace: ProjectWorkspaceData,
  businessConfig: BusinessConfig,
  brandAssets: WorkshopBrandPdfAssets
): OpenPdfBlobResult {
  const { project, summary, paymentSchedule, transactions } = workspace;
  const products = project.daftarProduk ?? [];
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 18;
  const projectRefLabel = project.id || project.namaProyek;

  doc.setProperties({
    title: `${projectRefLabel} - ${project.namaProyek}`,
    subject: 'Laporan Ringkasan Proyek & Realisasi Keuangan',
    author: businessConfig.namaMerek,
  });

  let y = drawFormalLetterhead(
    doc,
    businessConfig,
    'Laporan Ringkasan Proyek & Keuangan',
    project.id ? `${project.id} · ${project.namaProyek}` : project.namaProyek,
    `Periode: ${formatShortDateId(project.tanggalMulai)} s.d. ${formatShortDateId(project.tanggalTargetSelesai)}`,
    brandAssets.logo
  );

  // I. Identitas & Jadwal Proyek (tanpa card box)
  y = drawFormalSectionHeading(
    doc,
    'I. Identitas & Jadwal Proyek',
    y,
    margin,
    contentWidth,
    bottomLimit
  );

  const clientPhoneDisplay = formatDocumentPhoneDisplay(project.teleponKlien);
  y = drawTwoColumnMetadata(
    doc,
    [
      { label: 'Nama Proyek', value: project.namaProyek, boldValue: true },
      {
        label: 'Nama Klien',
        value: `${project.namaKlien}${clientPhoneDisplay ? ` (${clientPhoneDisplay})` : ''}`,
      },
      { label: 'Lokasi Kerja', value: formatFullWilayahAddress(project.alamat) || '-' },
    ],
    [
      { label: 'Kode Klien', value: project.id || '-', boldValue: true },
      { label: 'Jumlah Item', value: `${products.length || 1} item pekerjaan` },
      {
        label: 'Jadwal Kerja',
        value: `${formatShortDateId(project.tanggalMulai)} s.d. ${formatShortDateId(project.tanggalTargetSelesai)}`,
      },
    ],
    y,
    margin,
    contentWidth
  );

  // II. Ringkasan Keuangan Proyek
  y = drawFormalSectionHeading(
    doc,
    'II. Ringkasan Realisasi Keuangan Proyek',
    y,
    margin,
    contentWidth,
    bottomLimit,
    18,
    2.0
  );

  y = drawColonMetadataRows(
    doc,
    [
      { label: 'Nilai Kontrak Disepakati', value: formatIdr(summary.contractValue), boldValue: true },
      {
        label: `Pemasukan Termin (${summary.progressPercent}%)`,
        value: formatIdr(summary.paidAmount),
      },
      { label: 'Sisa Tagihan Klien', value: formatIdr(summary.remainingBill) },
      { label: 'Total Belanja & Biaya Produksi', value: formatIdr(summary.expenseTotal) },
      { label: 'Estimasi Margin Bersih Proyek', value: formatIdr(summary.netMargin), boldValue: true },
    ],
    y,
    margin,
    58,
    contentWidth,
    bottomLimit
  );

  // III. Daftar Produk & Item Pekerjaan
  y = drawFormalSectionHeading(
    doc,
    'III. Rincian Produk & Item Pekerjaan',
    y,
    margin,
    contentWidth,
    bottomLimit,
    23,
    4.5
  );

  const summaryStdRows = products.map((item, idx) =>
    formatStandardDocumentProductRow(
      {
        productId: item.id,
        namaProduk: item.namaProduk,
        customisasi: item.customisasi,
        tambahan: item.tambahan,
        material: item.material,
        finishing: item.finishing,
        kodeWarna: item.kodeWarna,
        spesifikasiMaterial: item.spesifikasiMaterial,
        dimensi: item.dimensi,
        jumlah: item.jumlah,
        satuan: item.satuan,
        hargaSatuan: item.hargaSatuan,
        subtotal: computeProjectProductSubtotal(item),
        linkedProjectProduct: item,
      },
      idx
    )
  );

  y = drawFormalGridTable(
    doc,
    [...STANDARD_DOCUMENT_PRODUCT_TABLE_COLUMNS],
    summaryStdRows.length > 0
      ? toStandardProductFormalTableRows(summaryStdRows)
      : [
          [
            { text: '-' },
            { text: 'Belum ada rincian item pekerjaan tercatat pada proyek ini.' },
            { text: '-' },
            { text: '-' },
            { text: '-' },
            { text: formatIdr(summary.contractValue), bold: true },
          ],
        ],
    y,
    margin,
    bottomLimit,
    {
      label: 'TOTAL NILAI KONTRAK PEKERJAAN',
      value: formatIdr(summary.contractValue),
      labelSpanCols: 5,
    }
  );

  const summaryCostBreakdown = buildCostBreakdownFromProject(project, summary.contractValue);
  if (summaryCostBreakdown) {
    y = drawFormalCostBreakdownTable(
      doc,
      summaryCostBreakdown,
      y - 6.5,
      margin,
      bottomLimit,
      'TOTAL NILAI KONTRAK PEKERJAAN'
    );
  }

  // IV. Jadwal & Status Termin Pembayaran
  y = drawFormalSectionHeading(
    doc,
    'IV. Jadwal & Status Termin Pembayaran',
    y,
    margin,
    contentWidth,
    bottomLimit,
    23
  );

  y = drawFormalGridTable(
    doc,
    [
      { header: 'NO', width: 9, align: 'center' },
      { header: 'TAHAPAN TERMIN', width: 63 },
      { header: 'PORSI', width: 15, align: 'center' },
      { header: 'TARGET NOMINAL', width: 31, align: 'right' },
      { header: 'TERBAYAR', width: 30, align: 'right' },
      { header: 'STATUS', width: 26, align: 'center' },
    ],
    paymentSchedule.stages.map((st, idx) => [
      { text: String(idx + 1) },
      { text: st.nama, bold: true },
      { text: `${st.persentase}%` },
      { text: formatIdr(st.targetAmount) },
      { text: formatIdr(st.paidAmount) },
      { text: st.status, bold: true },
    ]),
    y,
    margin,
    bottomLimit
  );

  // V. Riwayat Transaksi Kas Proyek
  if (transactions.length > 0) {
    y = drawFormalSectionHeading(
      doc,
      `V. Riwayat Transaksi Kas Proyek (${transactions.length} Transaksi)`,
      y,
      margin,
      contentWidth,
      bottomLimit,
      23
    );

    y = drawFormalGridTable(
      doc,
      [
        { header: 'TANGGAL', width: 26 },
        { header: 'JENIS', width: 26 },
        { header: 'URAIAN TRANSAKSI', width: 64 },
        { header: 'KATEGORI & METODE', width: 30 },
        { header: 'NOMINAL', width: 28, align: 'right' },
      ],
      transactions.map((tx) => [
        { text: formatShortDateId(tx.tanggal) },
        { text: tx.jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran', bold: true },
        { text: tx.judul, subText: tx.pihakTerkait || undefined },
        { text: tx.kategori, subText: tx.metodePembayaran },
        {
          text: `${tx.jenis === 'pemasukan' ? '+' : '-'}${formatIdr(tx.nominal)}`,
          bold: true,
        },
      ]),
      y,
      margin,
      bottomLimit
    );
  }

  const city =
    businessConfig.alamat.kabupaten.replace(/^Kabupaten\s+/i, '').trim() || 'Purwakarta';
  const todayIso = new Date().toISOString().slice(0, 10);

  drawFormalSignatures(
    doc,
    [
      {
        roleHeading: 'Disahkan Oleh,',
        subRole: businessConfig.namaMerek,
        signerName: businessConfig.drafPemilik.namaPemilik || 'Pimpinan Workshop',
        caption: businessConfig.drafPemilik.jabatanPemilik || 'Penanggung Jawab',
        includeCompanyStamp: true,
      },
      {
        roleHeading: 'Klien / Pemberi Tugas,',
        subRole: project.namaProyek,
        signerName: project.namaKlien,
        caption: clientPhoneDisplay || '-',
      },
    ],
    y + 2,
    margin,
    contentWidth,
    bottomLimit,
    `${city}, ${formatShortDateId(todayIso)}`,
    brandAssets
  );

  addFormalPageFooters(doc, `${businessConfig.namaMerek} · Laporan Proyek ${projectRefLabel}`);
  return openPdfDocumentInNewTab(doc);
}

export async function openProjectSummaryPdf(
  workspace: ProjectWorkspaceData,
  businessConfig: BusinessConfig
): Promise<OpenPdfBlobResult> {
  const cached = getCachedWorkshopBrandPdfAssets();
  if (cached) {
    return buildProjectSummaryPdfDocument(workspace, businessConfig, cached);
  }
  const assets = await loadWorkshopBrandPdfAssets();
  return buildProjectSummaryPdfDocument(workspace, businessConfig, assets);
}
