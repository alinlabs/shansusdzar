import { jsPDF } from 'jspdf';
import {
  FORMAL_DOCUMENT_HEADER_META,
  formatFormalDocumentAddress,
  formatFormalDocumentContacts,
} from '../business-config';
import { drawFormalSignatures, drawParagraphBlock } from './build-workshop-documents-pdf';
import { splitAccountingRupiahDisplay } from '../finance-utils';
import { fitImageInBox, loadWorkshopBrandPdfAssets } from './image-prep';
import type { OrderPdfDataModel } from './order-pdf-data';

export interface BuiltOrderPdfResult {
  doc: jsPDF;
  arrayBuffer: ArrayBuffer;
  blob: Blob;
  file: File;
  filename: string;
  totalPages: number;
}

const FONT_FAMILY = 'times';
const INK_PRIMARY: [number, number, number] = [20, 20, 20];
const INK_SECONDARY: [number, number, number] = [55, 55, 55];
const INK_MUTED: [number, number, number] = [90, 90, 90];
const BORDER_DARK: [number, number, number] = [30, 30, 30];
const BORDER_LINE: [number, number, number] = [130, 130, 130];
const TABLE_HEADER_BG: [number, number, number] = [40, 39, 38];
const TABLE_HEADER_TEXT: [number, number, number] = [255, 255, 255];
const TABLE_ROW_EVEN_BG: [number, number, number] = [255, 255, 255];
const TABLE_ROW_ODD_BG: [number, number, number] = [246, 246, 245];
const TABLE_BORDER_OUTER: [number, number, number] = [214, 213, 210];
const TABLE_BORDER_ROW: [number, number, number] = [229, 228, 225];

/**
 * Menghasilkan PDF Ringkasan Permintaan Pesanan bergaya surat resmi formal:
 * Times New Roman, kop surat bergaris ganda, tabel kotak garis tegas (tanpa card/box modern).
 */
export async function buildOrderSummaryPdf(
  model: OrderPdfDataModel
): Promise<BuiltOrderPdfResult> {
  const brandAssets = await loadWorkshopBrandPdfAssets();

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  doc.setProperties({
    title: `${model.documentTitle} - ${model.referenceCode}`,
    subject: model.documentTitle,
    author: model.brandName,
    creator: model.brandName,
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const margin = 18;
  const contentWidth = pageWidth - margin * 2; // 174 mm
  const centerX = pageWidth / 2;
  const bottomLimit = pageHeight - 20;

  let y = margin;

  // Column widths summing to 174 mm
  const cols = {
    noW: 8,
    specW: 53,
    materialW: 34,
    dimW: 23,
    unitW: 28,
    totalW: 28,
  };

  const drawSectionHeading = (title: string) => {
    if (y + 12 > bottomLimit) {
      doc.addPage();
      y = margin;
    }
    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK_PRIMARY);
    doc.text(title.toUpperCase(), margin, y);
    y += 4.8;
  };

  const drawTableHeader = () => {
    const headerDefs = [
      { label: 'NO', width: cols.noW },
      { label: 'PRODUK & SPESIFIKASI', width: cols.specW },
      { label: 'MATERIAL', width: cols.materialW },
      { label: 'DIMENSI (cm)', width: cols.dimW },
      { label: 'HARGA SATUAN', width: cols.unitW },
      { label: 'JUMLAH', width: cols.totalW },
    ];
    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(8.2);
    const wrappedHeaders = headerDefs.map((col) =>
      doc.splitTextToSize(col.label, Math.max(8, col.width - 3)) as string[]
    );
    const lineH = 3.6;
    const maxLines = wrappedHeaders.reduce((max, lines) => Math.max(max, lines.length), 1);
    const headerH = Math.max(8.0, maxLines * lineH + 4.0);

    doc.setFillColor(...TABLE_HEADER_BG);
    doc.setDrawColor(...TABLE_HEADER_BG);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentWidth, headerH, 'FD');

    let curX = margin;
    doc.setTextColor(...TABLE_HEADER_TEXT);
    headerDefs.forEach((col, idx) => {
      const lines = wrappedHeaders[idx];
      const totalTextH = lines.length * lineH;
      const firstBaselineY = y + (headerH - totalTextH) / 2 + 2.7;
      const centerColX = curX + col.width / 2;
      lines.forEach((line, lineIdx) => {
        doc.text(line, centerColX, firstBaselineY + lineIdx * lineH, { align: 'center' });
      });
      curX += col.width;
    });

    y += headerH;
  };

  const ensureSpace = (neededHeight: number, isInsideTable = false) => {
    if (y + neededHeight > bottomLimit) {
      if (isInsideTable) {
        doc.setDrawColor(...TABLE_BORDER_OUTER);
        doc.setLineWidth(0.2);
        doc.line(margin, y, margin + contentWidth, y);
      }
      doc.addPage();
      y = margin;
      if (isInsideTable) {
        doc.setDrawColor(...TABLE_BORDER_OUTER);
        doc.setLineWidth(0.2);
        doc.line(margin, y, margin + contentWidth, y);
      }
    }
  };

  // --------------------------------------------------------------------------
  // KOP SURAT RESMI & JUDUL DOKUMEN
  // --------------------------------------------------------------------------
  const headerTopY = margin - 3.5;
  const contactMaxW = brandAssets.logo ? contentWidth - 36 : contentWidth - 10;

  doc.setFont(FONT_FAMILY, 'italic');
  doc.setFontSize(9.2);
  doc.setTextColor(...INK_SECONDARY);
  doc.text(FORMAL_DOCUMENT_HEADER_META.tagline, centerX, y, { align: 'center' });
  y += 4.6;

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...INK_PRIMARY);
  doc.text(model.brandName.toUpperCase(), centerX, y, { align: 'center' });
  y += 4.7;

  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...INK_SECONDARY);
  const addressLines = doc.splitTextToSize(
    formatFormalDocumentAddress(model.brandAddress),
    contactMaxW
  ) as string[];
  doc.text(addressLines, centerX, y, { align: 'center' });
  y += addressLines.length * 3.6;

  const contactLines = doc.splitTextToSize(
    formatFormalDocumentContacts(model.brandWhatsApp),
    contactMaxW
  ) as string[];
  doc.text(contactLines, centerX, y, { align: 'center' });
  y += contactLines.length * 3.6 + 1.5;

  if (brandAssets.logo) {
    const { width: logoW, height: logoH } = fitImageInBox(
      brandAssets.logo.width,
      brandAssets.logo.height,
      14.5,
      14.5
    );
    const headerBottomY = y - 1.5;
    const logoY = headerTopY + Math.max(0, (headerBottomY - headerTopY - logoH) / 2);
    doc.addImage(brandAssets.logo.dataUrl, 'PNG', margin, logoY, logoW, logoH);
  }

  doc.setDrawColor(...BORDER_DARK);
  doc.setLineWidth(0.85);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineWidth(0.25);
  doc.line(margin, y + 1.1, pageWidth - margin, y + 1.1);
  y += 7;

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK_PRIMARY);
  const headingUpper = 'RINGKASAN PERMINTAAN PESANAN';
  doc.text(headingUpper, centerX, y, { align: 'center' });
  const headingW = doc.getTextWidth(headingUpper);
  doc.setLineWidth(0.35);
  doc.line(centerX - headingW / 2, y + 1.2, centerX + headingW / 2, y + 1.2);
  y += 5.5;

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(9.5);
  doc.text(`Nomor Referensi: ${model.referenceCode}`, centerX, y, { align: 'center' });
  y += 4.2;

  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK_MUTED);
  doc.text(model.formattedDateTime, centerX, y, { align: 'center' });
  y += 6.5;

  // --------------------------------------------------------------------------
  // I. DATA PEMESAN & LOKASI (FORMAT SURAT RESMI TANPA CARD BOX)
  // --------------------------------------------------------------------------
  drawSectionHeading('I. Identitas Pemesan & Alamat Tujuan');

  const metaRows: Array<{ label: string; value: string; bold?: boolean }> = [
    { label: 'Nama Pemesan', value: model.customer.fullName, bold: true },
    { label: 'Telepon / WhatsApp', value: model.customer.phone },
    { label: 'Alamat Lengkap', value: model.customer.address },
  ];
  if (model.customer.coordinatesLabel) {
    metaRows.push({ label: 'Koordinat Lokasi', value: model.customer.coordinatesLabel });
  }
  if (model.customer.notes) {
    metaRows.push({ label: 'Catatan Pemesan', value: model.customer.notes });
  }

  const labelW = 36;
  const valW = contentWidth - labelW - 3;
  metaRows.forEach((row) => {
    const wrapped = doc.splitTextToSize(row.value || '-', valW) as string[];
    const needed = Math.max(4.5, wrapped.length * 4.1 + 0.6);
    ensureSpace(needed, false);

    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK_SECONDARY);
    doc.text(row.label, margin, y);
    doc.text(':', margin + labelW, y);

    doc.setFont(FONT_FAMILY, row.bold ? 'bold' : 'normal');
    doc.setTextColor(...INK_PRIMARY);
    doc.text(wrapped, margin + labelW + 3, y);
    y += needed;
  });

  y += 4;

  // --------------------------------------------------------------------------
  // II. DAFTAR ITEM PERMINTAAN (TABEL GARIS TEGAS)
  // --------------------------------------------------------------------------
  drawSectionHeading('II. Rincian Item Permintaan & Estimasi');
  drawTableHeader();

  model.items.forEach((item, index) => {
    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(8.6);
    const titleLines = doc.splitTextToSize(
      item.productTitle || item.title,
      cols.specW - 4
    ) as string[];

    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(7.8);
    const wrappedSpecs = item.specSummary
      ? (doc.splitTextToSize(item.specSummary, cols.specW - 4) as string[])
      : [];

    doc.setFont(FONT_FAMILY, item.materialTitle && item.materialTitle !== '-' ? 'bold' : 'normal');
    doc.setFontSize(8.6);
    const materialTitleLines = doc.splitTextToSize(
      item.materialTitle || '-',
      cols.materialW - 4
    ) as string[];

    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(7.8);
    const materialSubLines = item.materialSubText
      ? item.materialSubText.split('\n').flatMap((seg) => {
          const wrapped = doc.splitTextToSize(seg, cols.materialW - 4) as string[];
          return wrapped.length > 0 ? wrapped : [seg];
        })
      : [];

    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(8.6);
    const dimLines = doc.splitTextToSize(item.dimensionText || '-', cols.dimW - 4) as string[];
    doc.setFontSize(7.8);
    const qtySubLines = item.quantityText
      ? (doc.splitTextToSize(item.quantityText, cols.dimW - 4) as string[])
      : [];

    const hasEstimatePrefix = /^Estimasi\s+/i.test(item.unitPriceLabel);
    const unitSplit = splitAccountingRupiahDisplay(
      hasEstimatePrefix ? item.unitPriceLabel.replace(/^Estimasi\s+/i, '') : item.unitPriceLabel
    );
    const subtotalSplit = splitAccountingRupiahDisplay(item.subtotalLabel);

    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(8.4);
    const unitPriceLines = unitSplit
      ? [item.unitPriceLabel]
      : (doc.splitTextToSize(item.unitPriceLabel, cols.unitW - 4) as string[]);
    doc.setFont(FONT_FAMILY, 'bold');
    const subtotalLines = subtotalSplit
      ? [item.subtotalLabel]
      : (doc.splitTextToSize(item.subtotalLabel, cols.totalW - 4) as string[]);

    const specBlockHeight =
      titleLines.length * 4.0 + (wrappedSpecs.length > 0 ? wrappedSpecs.length * 3.6 + 0.8 : 0);
    const materialBlockHeight =
      materialTitleLines.length * 4.0 +
      (materialSubLines.length > 0 ? materialSubLines.length * 3.6 + 0.8 : 0);
    const dimBlockHeight =
      dimLines.length * 4.0 + (qtySubLines.length > 0 ? qtySubLines.length * 3.6 + 0.8 : 0);
    const unitLineCount = unitSplit ? (hasEstimatePrefix ? 2 : 1) : unitPriceLines.length;
    const subtotalLineCount = subtotalSplit ? 1 : subtotalLines.length;
    const numBlockHeight = Math.max(unitLineCount, subtotalLineCount) * 4.0;

    const rowPaddingY = 2.4;
    const rowHeight = Math.max(
      8.2,
      Math.max(specBlockHeight, materialBlockHeight, dimBlockHeight, numBlockHeight) +
        rowPaddingY * 2
    );

    ensureSpace(rowHeight, true);

    const rowTopY = y;
    const xs = [
      margin,
      margin + cols.noW,
      margin + cols.noW + cols.specW,
      margin + cols.noW + cols.specW + cols.materialW,
      margin + cols.noW + cols.specW + cols.materialW + cols.dimW,
      margin + cols.noW + cols.specW + cols.materialW + cols.dimW + cols.unitW,
    ];

    const rowBg = index % 2 === 0 ? TABLE_ROW_EVEN_BG : TABLE_ROW_ODD_BG;
    doc.setFillColor(...rowBg);
    doc.rect(margin, rowTopY, contentWidth, rowHeight, 'F');

    const isFinalRow = index === model.items.length - 1;
    doc.setDrawColor(...TABLE_BORDER_OUTER);
    doc.setLineWidth(0.18);
    doc.line(margin, rowTopY, margin, rowTopY + rowHeight);
    doc.line(margin + contentWidth, rowTopY, margin + contentWidth, rowTopY + rowHeight);

    doc.setDrawColor(...(isFinalRow ? TABLE_BORDER_OUTER : TABLE_BORDER_ROW));
    doc.setLineWidth(isFinalRow ? 0.2 : 0.15);
    doc.line(margin, rowTopY + rowHeight, margin + contentWidth, rowTopY + rowHeight);

    const baseLineY = rowTopY + 5.2;

    // 1. NO
    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK_PRIMARY);
    doc.text(String(index + 1), xs[0] + cols.noW / 2, baseLineY, {
      align: 'center',
    });

    // 2. PRODUK & SPESIFIKASI
    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(...INK_PRIMARY);
    titleLines.forEach((line, lIdx) => {
      doc.text(line, xs[1] + 2.2, baseLineY + lIdx * 4.0);
    });
    if (wrappedSpecs.length > 0) {
      doc.setFont(FONT_FAMILY, 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(...INK_SECONDARY);
      const specStartY = baseLineY + titleLines.length * 4.0 + 0.6;
      wrappedSpecs.forEach((line, lIdx) => {
        doc.text(line, xs[1] + 2.2, specStartY + lIdx * 3.6);
      });
    }

    // 3. MATERIAL (3 lines)
    doc.setFont(FONT_FAMILY, item.materialTitle && item.materialTitle !== '-' ? 'bold' : 'normal');
    doc.setFontSize(8.6);
    doc.setTextColor(...INK_PRIMARY);
    materialTitleLines.forEach((line, lIdx) => {
      doc.text(line, xs[2] + 2.2, baseLineY + lIdx * 4.0);
    });
    if (materialSubLines.length > 0) {
      doc.setFont(FONT_FAMILY, 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(...INK_SECONDARY);
      const matSubStartY = baseLineY + materialTitleLines.length * 4.0 + 0.6;
      materialSubLines.forEach((line, lIdx) => {
        doc.text(line, xs[2] + 2.2, matSubStartY + lIdx * 3.6);
      });
    }

    // 4. DIMENSI (cm) + Qty
    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(8.6);
    doc.setTextColor(...INK_PRIMARY);
    dimLines.forEach((line, lIdx) => {
      doc.text(line, xs[3] + 2.2, baseLineY + lIdx * 4.0);
    });
    if (qtySubLines.length > 0) {
      doc.setFont(FONT_FAMILY, 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(...INK_SECONDARY);
      const qtyStartY = baseLineY + dimLines.length * 4.0 + 0.6;
      qtySubLines.forEach((line, lIdx) => {
        doc.text(line, xs[3] + 2.2, qtyStartY + lIdx * 3.6);
      });
    }

    // 5. HARGA SATUAN
    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(8.4);
    doc.setTextColor(...INK_PRIMARY);
    if (unitSplit) {
      doc.text(unitSplit.symbol, xs[4] + 2, baseLineY, { align: 'left' });
      doc.text(unitSplit.amount, xs[4] + cols.unitW - 2, baseLineY, { align: 'right' });
      if (hasEstimatePrefix) {
        doc.setFont(FONT_FAMILY, 'italic');
        doc.setFontSize(7.2);
        doc.setTextColor(...INK_MUTED);
        doc.text('(Estimasi)', xs[4] + cols.unitW - 2, baseLineY + 3.5, { align: 'right' });
        doc.setFontSize(8.4);
        doc.setTextColor(...INK_PRIMARY);
      }
    } else {
      doc.text(unitPriceLines, xs[4] + cols.unitW - 2, baseLineY, { align: 'right' });
    }

    // 6. JUMLAH
    doc.setFont(FONT_FAMILY, 'bold');
    if (subtotalSplit) {
      doc.text(subtotalSplit.symbol, xs[5] + 2, baseLineY, { align: 'left' });
      doc.text(subtotalSplit.amount, xs[5] + cols.totalW - 2, baseLineY, { align: 'right' });
    } else {
      doc.text(subtotalLines, xs[5] + cols.totalW - 2, baseLineY, { align: 'right' });
    }

    y += rowHeight;
  });

  // Table Footer Summary Row (di bawah tabel tanpa border & tanpa latar belakang)
  const footerCurrency = splitAccountingRupiahDisplay(model.summary.subtotalLabel);
  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(8.8);
  const footerFallbackLines = footerCurrency
    ? []
    : (doc.splitTextToSize(model.summary.subtotalLabel, cols.totalW - 4) as string[]);
  const footerRowH = Math.max(8.0, (footerFallbackLines.length || 1) * 3.8 + 4.0);
  ensureSpace(footerRowH + 8, false);
  const labelColsW = cols.noW + cols.specW + cols.materialW + cols.dimW + cols.unitW;
  const labelLeftX = margin + cols.noW + cols.specW + cols.materialW + 2;

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(8.6);
  doc.setTextColor(...INK_PRIMARY);
  doc.text(
    `TOTAL (${model.summary.totalLineCount} ITEM · ${model.summary.totalQuantity} UNIT)`,
    labelLeftX,
    y + 5.6,
    { align: 'left', maxWidth: margin + labelColsW - labelLeftX - 2 }
  );
  if (footerCurrency) {
    doc.text(footerCurrency.symbol, margin + labelColsW + 2, y + 5.6, { align: 'left' });
    doc.text(footerCurrency.amount, margin + contentWidth - 2, y + 5.6, { align: 'right' });
  } else {
    doc.text(footerFallbackLines, margin + contentWidth - 2, y + 5.6, { align: 'right' });
  }
  y += footerRowH + 7.5;

  if (model.summary.estimatedDpLabel) {
    ensureSpace(8, false);
    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK_SECONDARY);
    doc.text('Perkiraan Uang Muka (DP):', margin + 92, y);
    doc.setFont(FONT_FAMILY, 'bold');
    doc.setTextColor(...INK_PRIMARY);
    doc.text(model.summary.estimatedDpLabel, pageWidth - margin, y, { align: 'right' });
    y += 7.5;
  }

  // --------------------------------------------------------------------------
  // III. KETENTUAN & TINDAK LANJUT RESMI (TANPA BOX CARD)
  // --------------------------------------------------------------------------
  drawSectionHeading('III. Ketentuan & Langkah Konfirmasi Resmi');

  y = drawParagraphBlock(
    doc,
    `1. ${model.disclaimerText}`,
    y,
    margin,
    contentWidth,
    bottomLimit,
    { fontStyle: 'normal', fontSize: 8.8 }
  );
  y = drawParagraphBlock(
    doc,
    `2. ${model.nextStepsText}`,
    y,
    margin,
    contentWidth,
    bottomLimit,
    { fontStyle: 'bold', fontSize: 8.8 }
  );
  y += 2;

  drawFormalSignatures(
    doc,
    [
      {
        roleHeading: 'Diterbitkan / Diketahui Workshop,',
        subRole: model.brandName,
        signerName: model.brandOwnerName || 'Hilman Aziz Napis',
        caption: model.brandOwnerRole || 'Owner SDI Furniture',
        includeCompanyStamp: true,
      },
      {
        roleHeading: 'Pemohon / Pemesan,',
        subRole: 'Calon Klien',
        signerName: model.customer.fullName,
        caption: model.customer.phone,
      },
    ],
    y,
    margin,
    contentWidth,
    bottomLimit,
    model.formattedDateTime,
    brandAssets
  );

  // --------------------------------------------------------------------------
  // FOOTER HALAMAN RESMI
  // --------------------------------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(...BORDER_LINE);
    doc.setLineWidth(0.25);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

    doc.setFont(FONT_FAMILY, 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...INK_MUTED);
    doc.text(`${model.brandName} · ${model.referenceCode}`, margin, pageHeight - 9.5);
    doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - margin, pageHeight - 9.5, {
      align: 'right',
    });
  }

  const arrayBuffer = doc.output('arraybuffer');
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const file = new File([blob], model.filename, { type: 'application/pdf' });

  return {
    doc,
    arrayBuffer,
    blob,
    file,
    filename: model.filename,
    totalPages,
  };
}
