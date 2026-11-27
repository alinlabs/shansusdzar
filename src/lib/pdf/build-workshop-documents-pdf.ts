import { jsPDF } from 'jspdf';
import { formatTerminDocumentNumber } from '../document-numbering';
import {
  fitImageInBox,
  getCachedWorkshopBrandPdfAssets,
  loadWorkshopBrandPdfAssets,
  renderBniLogoForPdf,
  renderBsiLogoForPdf,
  type PreparedPdfImage,
  type WorkshopBrandPdfAssets,
} from './image-prep';
import { openPdfDocumentInNewTab } from './open-pdf-blob';
import { resolveAgreementPartyIdentities } from '../agreement-identity';
import {
  BUSINESS_CONFIG,
  FORMAL_DOCUMENT_HEADER_META,
  formatFormalDocumentAddress,
  formatFormalDocumentContacts,
  formatWorkshopBankAccountsText,
  resolveWorkshopBankAccounts,
} from '../business-config';
import { formatDocumentDimensionDisplay } from '../dimension-format';
import {
  computeInvoiceProgress,
  formatLongDateId,
  formatShortDateId,
  splitAccountingRupiahDisplay,
} from '../finance-utils';
import { parseFormalTextBlocks } from '../formal-list-format';
import { formatDocumentPhoneDisplay } from '../phone-format';
import {
  DEFAULT_PAYMENT_SCHEME,
  calculatePaymentSchemeBreakdown,
  evaluateInvoicePaymentSchedule,
  resolveEffectivePaymentScheme,
} from '../payment-scheme';
import {
  STANDARD_DOCUMENT_PRODUCT_TABLE_COLUMNS,
  formatStandardDocumentProductRow,
  matchLinkedProjectProduct,
  parseInvoiceLineDescription,
  type StandardDocumentProductFormattedRow,
} from '../document-product-table';
import {
  buildAgreementProductItemsFromProject,
  sanitizeQuotationTechnicalNote,
} from '../project-documents-auto';
import {
  buildCostBreakdownFromAgreement,
  buildCostBreakdownFromInvoice,
  buildCostBreakdownFromQuotation,
  type DocumentCostBreakdown,
} from '../document-cost-breakdown';
import { resolveBastPaymentRecordSummary } from '../../pages/admin/dokumen/bast/logic';
import type { BusinessConfig } from '../../types/business';
import type { PaymentSchemeConfig } from '../../types/cms';
import type {
  CooperationAgreementDocument,
  CooperationAgreementProductItem,
  DeliveryOrderDocument,
  HandoverCertificateDocument,
  QuotationDocument,
  WorkOrderDocument,
} from '../../types/documents';
import type { ProjectInvoice, WorkshopProject } from '../../types/finance';

const FONT_FAMILY = 'times';
const INK_PRIMARY: [number, number, number] = [20, 20, 20];
const INK_SECONDARY: [number, number, number] = [55, 55, 55];
const INK_MUTED: [number, number, number] = [90, 90, 90];
const BORDER_DARK: [number, number, number] = [30, 30, 30];
const BORDER_LINE: [number, number, number] = [130, 130, 130];
const TABLE_HEADER_BG: [number, number, number] = [40, 39, 38];
const TABLE_HEADER_TEXT: [number, number, number] = [255, 255, 255];
const TABLE_HEADER_DIVIDER: [number, number, number] = [74, 72, 70];
const TABLE_ROW_EVEN_BG: [number, number, number] = [255, 255, 255];
const TABLE_ROW_ODD_BG: [number, number, number] = [246, 246, 245];
const TABLE_BORDER_OUTER: [number, number, number] = [214, 213, 210];
const TABLE_BORDER_ROW: [number, number, number] = [229, 228, 225];

function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function resolveCityName(businessConfig: BusinessConfig): string {
  return (
    businessConfig.alamat.kabupaten.replace(/^Kabupaten\s+/i, '').trim() || 'Purwakarta'
  );
}

/**
 * Kop Surat Resmi Standar Indonesia + Judul & Nomor Dokumen Terpusat.
 * Tanpa card, tanpa border melengkung, tegas dengan garis ganda resmi.
 */
export function drawFormalLetterhead(
  doc: jsPDF,
  businessConfig: BusinessConfig,
  documentHeading: string,
  documentNumber: string,
  metaSubtitle?: string,
  logoAsset: PreparedPdfImage | null = getCachedWorkshopBrandPdfAssets()?.logo ?? null
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const centerX = pageWidth / 2;
  const headerTopY = margin - 3.5;
  const textMaxWidth = logoAsset ? contentWidth - 36 : contentWidth - 10;
  let y = margin;

  doc.setFont(FONT_FAMILY, 'italic');
  doc.setFontSize(9.2);
  doc.setTextColor(...INK_SECONDARY);
  doc.text(FORMAL_DOCUMENT_HEADER_META.tagline, centerX, y, { align: 'center' });
  y += 4.6;

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...INK_PRIMARY);
  doc.text(businessConfig.namaMerek.toUpperCase(), centerX, y, { align: 'center' });
  y += 4.7;

  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...INK_SECONDARY);
  const addressLine = formatFormalDocumentAddress(businessConfig.alamat.alamatLengkap);
  const addressLines = doc.splitTextToSize(addressLine, textMaxWidth);
  doc.text(addressLines, centerX, y, { align: 'center' });
  y += addressLines.length * 3.6;

  const contactLine = formatFormalDocumentContacts(businessConfig.whatsapp.nomorTampil);
  const contactLines = doc.splitTextToSize(contactLine, textMaxWidth);
  doc.text(contactLines, centerX, y, { align: 'center' });
  y += contactLines.length * 3.6 + 1.5;

  if (logoAsset) {
    const { width: logoW, height: logoH } = fitImageInBox(
      logoAsset.width,
      logoAsset.height,
      14.5,
      14.5
    );
    const headerBottomY = y - 1.5;
    const logoY = headerTopY + Math.max(0, (headerBottomY - headerTopY - logoH) / 2);
    doc.addImage(logoAsset.dataUrl, 'PNG', margin, logoY, logoW, logoH);
  }

  // Garis ganda Kop Surat Resmi
  doc.setDrawColor(...BORDER_DARK);
  doc.setLineWidth(0.85);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineWidth(0.25);
  doc.line(margin, y + 1.1, pageWidth - margin, y + 1.1);
  y += 7;

  // Judul Dokumen Resmi & Nomor
  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK_PRIMARY);
  const headingUpper = documentHeading.toUpperCase();
  doc.text(headingUpper, centerX, y, { align: 'center' });
  const titleWidth = doc.getTextWidth(headingUpper);
  doc.setDrawColor(...BORDER_DARK);
  doc.setLineWidth(0.35);
  doc.line(centerX - titleWidth / 2, y + 1.2, centerX + titleWidth / 2, y + 1.2);
  y += 5.5;

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK_PRIMARY);
  doc.text(`Nomor: ${documentNumber}`, centerX, y, { align: 'center' });
  y += 4.2;

  if (metaSubtitle?.trim()) {
    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK_MUTED);
    doc.text(metaSubtitle, centerX, y, { align: 'center' });
    y += 4.5;
  }

  return y + 3;
}

export function addFormalPageFooters(doc: jsPDF, labelLeft: string): void {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;

  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(...BORDER_LINE);
    doc.setLineWidth(0.25);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.setFont(FONT_FAMILY, 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...INK_MUTED);
    doc.text(labelLeft, margin, pageHeight - 9.5);
    doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - margin, pageHeight - 9.5, {
      align: 'right',
    });
  }
}

export function drawFormalSectionHeading(
  doc: jsPDF,
  title: string,
  y: number,
  margin: number,
  contentWidth: number,
  bottomLimitOrEnsureSpace: number | ((needed: number) => number | void),
  minFollowSpace = 10,
  spaceBefore = 0
): number {
  let drawY = y;
  const applySpaceBefore = spaceBefore > 0 && drawY > 22 ? spaceBefore : 0;
  const requiredSpace = applySpaceBefore + minFollowSpace;

  if (typeof bottomLimitOrEnsureSpace === 'number') {
    if (drawY + requiredSpace > bottomLimitOrEnsureSpace) {
      doc.addPage();
      drawY = 18;
    } else {
      drawY += applySpaceBefore;
    }
  } else {
    const pagesBefore =
      typeof (doc as unknown as { getNumberOfPages?: () => number }).getNumberOfPages === 'function'
        ? doc.getNumberOfPages()
        : null;
    const checkedY = bottomLimitOrEnsureSpace(requiredSpace);
    const pagesAfter =
      typeof (doc as unknown as { getNumberOfPages?: () => number }).getNumberOfPages === 'function'
        ? doc.getNumberOfPages()
        : null;
    const brokePage =
      pagesBefore !== null && pagesAfter !== null
        ? pagesAfter > pagesBefore
        : typeof checkedY === 'number' && checkedY < drawY;
    if (brokePage) {
      drawY = typeof checkedY === 'number' ? checkedY : 18;
    } else {
      drawY += applySpaceBefore;
    }
  }
  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK_PRIMARY);
  doc.text(title.toUpperCase(), margin, drawY);
  return drawY + 5;
}

export interface KeyValuePair {
  label: string;
  value: string;
  boldValue?: boolean;
}

export function drawColonMetadataRows(
  doc: jsPDF,
  rows: KeyValuePair[],
  startY: number,
  x: number,
  labelWidth: number,
  maxWidth: number,
  bottomLimitOrEnsureSpace?: number | ((needed: number) => number | void)
): number {
  let y = startY;
  const valueX = x + labelWidth + 3;
  const valueWidth = Math.max(25, maxWidth - labelWidth - 3);

  rows.forEach((row) => {
    doc.setFont(FONT_FAMILY, row.boldValue ? 'bold' : 'normal');
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(row.value || '-', valueWidth) as string[];
    const needed = Math.max(4.6, wrapped.length * 3.65 + 1.0);
    const rowFootprint = Math.max(0, wrapped.length - 1) * 3.65;
    if (typeof bottomLimitOrEnsureSpace === 'number') {
      if (y + rowFootprint > bottomLimitOrEnsureSpace) {
        doc.addPage();
        y = 18;
      }
    } else if (bottomLimitOrEnsureSpace) {
      const pagesBefore =
        typeof (doc as unknown as { getNumberOfPages?: () => number }).getNumberOfPages ===
        'function'
          ? doc.getNumberOfPages()
          : null;
      const checkedY = bottomLimitOrEnsureSpace(needed);
      const pagesAfter =
        typeof (doc as unknown as { getNumberOfPages?: () => number }).getNumberOfPages ===
        'function'
          ? doc.getNumberOfPages()
          : null;
      const brokePage =
        pagesBefore !== null && pagesAfter !== null
          ? pagesAfter > pagesBefore
          : typeof checkedY === 'number' && checkedY < y;
      if (brokePage) {
        y = typeof checkedY === 'number' ? checkedY : 18;
      }
    }

    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK_SECONDARY);
    doc.text(row.label, x, y);
    doc.text(':', x + labelWidth, y);

    doc.setFont(FONT_FAMILY, row.boldValue ? 'bold' : 'normal');
    doc.setTextColor(...INK_PRIMARY);
    doc.text(wrapped, valueX, y);
    y += needed;
  });

  return y;
}

export function drawTwoColumnMetadata(
  doc: jsPDF,
  leftRows: KeyValuePair[],
  rightRows: KeyValuePair[],
  startY: number,
  margin: number,
  contentWidth: number
): number {
  const gap = 8;
  const colWidth = (contentWidth - gap) / 2;
  const leftEndY = drawColonMetadataRows(doc, leftRows, startY, margin, 29, colWidth);
  const rightEndY = drawColonMetadataRows(
    doc,
    rightRows,
    startY,
    margin + colWidth + gap,
    29,
    colWidth
  );
  return Math.max(leftEndY, rightEndY) + 3;
}

export function drawParagraphBlock(
  doc: jsPDF,
  text: string,
  startY: number,
  margin: number,
  contentWidth: number,
  bottomLimit: number,
  options?: { fontStyle?: 'normal' | 'bold' | 'italic'; fontSize?: number; indent?: number }
): number {
  const fontStyle = options?.fontStyle ?? 'normal';
  const fontSize = options?.fontSize ?? 9.2;
  const indent = options?.indent ?? 0;
  let y = startY;

  const blocks = parseFormalTextBlocks(text);

  const applyFont = () => {
    doc.setFont(FONT_FAMILY, fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(...INK_PRIMARY);
  };
  applyFont();
  const internalScale =
    (doc.internal as unknown as { scaleFactor?: number } | undefined)?.scaleFactor ?? 0;
  const lineH =
    typeof (doc as unknown as { getLineHeight?: () => number }).getLineHeight === 'function' &&
    internalScale > 0
      ? doc.getLineHeight() / internalScale
      : fontSize * 0.352778 * 1.15;
  const blockGap = 1.0;

  blocks.forEach((block) => {
    applyFont();

    let markerX = margin + indent;
    let bodyX = margin + indent;
    let bodyWidth = Math.max(30, contentWidth - indent);
    let bodyText = '';
    let marker: string | null = null;

    if (block.kind === 'list') {
      const listIndent = indent + (block.level === 1 ? 8 : 4);
      const markerGap = Math.max(5.5, doc.getTextWidth(block.marker) + 1.8);
      markerX = margin + listIndent;
      bodyX = markerX + markerGap;
      bodyWidth = Math.max(30, contentWidth - listIndent - markerGap);
      bodyText = block.body;
      marker = block.marker;
    } else {
      bodyText = block.text;
    }

    const lines = doc.splitTextToSize(bodyText, bodyWidth) as string[];
    if (lines.length === 0) return;

    if (y > bottomLimit) {
      doc.addPage();
      y = 18;
      applyFont();
    }

    if (y + Math.max(0, lines.length - 1) * lineH <= bottomLimit) {
      if (marker) {
        doc.text(marker, markerX, y);
      }
      doc.text(bodyText, bodyX, y, { maxWidth: bodyWidth, align: 'justify' });
      y += lines.length * lineH + blockGap;
      return;
    }

    let cursor = 0;
    let isFirstChunk = true;
    while (cursor < lines.length) {
      if (y > bottomLimit) {
        doc.addPage();
        y = 18;
        applyFont();
      }
      const fit = Math.max(1, Math.floor((bottomLimit - y) / lineH) + 1);
      const chunk = lines.slice(cursor, cursor + fit);
      if (isFirstChunk && marker) {
        doc.text(marker, markerX, y);
      }
      doc.text(chunk.join(' '), bodyX, y, { maxWidth: bodyWidth, align: 'justify' });
      y += chunk.length * lineH;
      cursor += chunk.length;
      isFirstChunk = false;

      if (cursor < lines.length) {
        doc.addPage();
        y = 18;
        applyFont();
      }
    }

    y += blockGap;
  });

  return y;
}

export interface FormalTableColumn {
  header: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

export interface FormalTableCell {
  text: string;
  subText?: string;
  bold?: boolean;
}

export interface FormalGridTableOptions {
  showColumnBorders?: boolean;
  preserveEmptyCells?: boolean;
  minRowHeightMm?: number;
}

/**
 * Tabel bergaya rekening koran modern: header gelap kontras, baris selang-seling putih & abu sangat tipis,
 * dan garis batas tipis yang lembut tanpa kotak grid berat (kecuali opsi showColumnBorders aktif).
 */
export function drawFormalGridTable(
  doc: jsPDF,
  columns: readonly FormalTableColumn[],
  rows: FormalTableCell[][],
  startY: number,
  margin: number,
  bottomLimit: number,
  footerTotalRow?: { label: string; value: string; labelSpanCols: number },
  options?: FormalGridTableOptions
): number {
  let y = startY;
  const totalWidth = columns.reduce((acc, c) => acc + c.width, 0);
  const showColumnBorders = Boolean(options?.showColumnBorders);
  const preserveEmptyCells = Boolean(options?.preserveEmptyCells);
  const minRowHeightMm = options?.minRowHeightMm ?? 8.2;
  const gridBorderColor: [number, number, number] = showColumnBorders
    ? [175, 174, 170]
    : TABLE_BORDER_OUTER;
  const gridRowColor: [number, number, number] = showColumnBorders
    ? [175, 174, 170]
    : TABLE_BORDER_ROW;

  const computeHeaderMetrics = () => {
    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(8.2);
    const wrappedHeaders = columns.map((col) => {
      const maxW = Math.max(8, col.width - 3);
      return doc.splitTextToSize(col.header, maxW) as string[];
    });
    const lineH = 3.6;
    const maxLines = wrappedHeaders.reduce((max, lines) => Math.max(max, lines.length), 1);
    const headerHeight = Math.max(8.0, maxLines * lineH + 4.0);
    return { wrappedHeaders, lineH, headerHeight };
  };

  const drawHeader = () => {
    const { wrappedHeaders, lineH, headerHeight } = computeHeaderMetrics();
    doc.setFillColor(...TABLE_HEADER_BG);
    doc.setDrawColor(...TABLE_HEADER_BG);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, totalWidth, headerHeight, 'FD');

    if (showColumnBorders && columns.length > 1) {
      doc.setDrawColor(...TABLE_HEADER_DIVIDER);
      doc.setLineWidth(0.2);
      let dividerX = margin;
      columns.slice(0, -1).forEach((col) => {
        dividerX += col.width;
        doc.line(dividerX, y, dividerX, y + headerHeight);
      });
    }

    let colX = margin;
    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...TABLE_HEADER_TEXT);

    columns.forEach((col) => {
      const lines = wrappedHeaders[columns.indexOf(col)];
      const totalTextH = lines.length * lineH;
      const firstBaselineY = y + (headerHeight - totalTextH) / 2 + 2.7;
      const centerColX = colX + col.width / 2;
      lines.forEach((line, lineIdx) => {
        doc.text(line, centerColX, firstBaselineY + lineIdx * lineH, { align: 'center' });
      });
      colX += col.width;
    });

    y += headerHeight;
  };

  const initialHeaderMetrics = computeHeaderMetrics();
  if (y + initialHeaderMetrics.headerHeight + 10 > bottomLimit) {
    doc.addPage();
    y = 18;
  }
  drawHeader();

  rows.forEach((rowCells, rowIdx) => {
    const prepared = rowCells.map((cell, colIdx) => {
      const col = columns[colIdx];
      const innerWidth = Math.max(8, col.width - 4);
      const splitCurrency = !cell.subText ? splitAccountingRupiahDisplay(cell.text) : null;
      doc.setFont(FONT_FAMILY, cell.bold ? 'bold' : 'normal');
      doc.setFontSize(8.6);
      const rawText = preserveEmptyCells ? cell.text : (cell.text || '-');
      const mainLines = splitCurrency
        ? [cell.text]
        : rawText === ''
          ? []
          : rawText.split('\n').flatMap((seg) => {
              const wrapped = doc.splitTextToSize(seg, innerWidth) as string[];
              return wrapped.length > 0 ? wrapped : [seg];
            });
      doc.setFont(FONT_FAMILY, 'normal');
      doc.setFontSize(7.8);
      const subLines = cell.subText
        ? cell.subText.split('\n').flatMap((seg) => {
            const wrapped = doc.splitTextToSize(seg, innerWidth) as string[];
            return wrapped.length > 0 ? wrapped : [seg];
          })
        : [];
      return { mainLines, subLines, cell, splitCurrency };
    });

    const maxContentHeight = prepared.reduce((maxH, p) => {
      const h = p.mainLines.length * 4.0 + (p.subLines.length > 0 ? p.subLines.length * 3.6 + 0.8 : 0);
      return Math.max(maxH, h);
    }, 4.5);
    const rowHeight = Math.max(minRowHeightMm, maxContentHeight + 4.2);

    if (y + rowHeight > bottomLimit) {
      if (rowIdx > 0) {
        doc.setDrawColor(...gridBorderColor);
        doc.setLineWidth(0.2);
        doc.line(margin, y, margin + totalWidth, y);
      }
      doc.addPage();
      y = 18;
      doc.setDrawColor(...gridBorderColor);
      doc.setLineWidth(0.2);
      doc.line(margin, y, margin + totalWidth, y);
    }

    const rowBg = rowIdx % 2 === 0 ? TABLE_ROW_EVEN_BG : TABLE_ROW_ODD_BG;
    doc.setFillColor(...rowBg);
    doc.rect(margin, y, totalWidth, rowHeight, 'F');

    const isFinalRow = rowIdx === rows.length - 1;
    doc.setDrawColor(...gridBorderColor);
    doc.setLineWidth(0.18);
    doc.line(margin, y, margin, y + rowHeight);
    doc.line(margin + totalWidth, y, margin + totalWidth, y + rowHeight);

    if (showColumnBorders && columns.length > 1) {
      let dividerX = margin;
      columns.slice(0, -1).forEach((col) => {
        dividerX += col.width;
        doc.line(dividerX, y, dividerX, y + rowHeight);
      });
    }

    doc.setDrawColor(...(isFinalRow ? gridBorderColor : gridRowColor));
    doc.setLineWidth(isFinalRow ? 0.2 : 0.15);
    doc.line(margin, y + rowHeight, margin + totalWidth, y + rowHeight);

    let colX = margin;
    prepared.forEach((p, colIdx) => {
      const col = columns[colIdx];
      const pad = 2;
      const textX =
        col.align === 'right'
          ? colX + col.width - pad
          : col.align === 'center'
            ? colX + col.width / 2
            : colX + pad;

      let cellY = y + 4.8;
      doc.setFont(FONT_FAMILY, p.cell.bold ? 'bold' : 'normal');
      doc.setFontSize(8.6);
      doc.setTextColor(...INK_PRIMARY);
      if (p.splitCurrency) {
        doc.text(p.splitCurrency.symbol, colX + pad, cellY, { align: 'left' });
        doc.text(p.splitCurrency.amount, colX + col.width - pad, cellY, { align: 'right' });
      } else {
        p.mainLines.forEach((line) => {
          doc.text(line, textX, cellY, { align: col.align ?? 'left' });
          cellY += 4.0;
        });
      }

      if (p.subLines.length > 0) {
        doc.setFont(FONT_FAMILY, 'normal');
        doc.setFontSize(7.8);
        doc.setTextColor(...INK_SECONDARY);
        p.subLines.forEach((line) => {
          doc.text(line, textX, cellY, { align: col.align ?? 'left' });
          cellY += 3.6;
        });
      }

      colX += col.width;
    });

    y += rowHeight;
  });

  if (footerTotalRow) {
    const rowH = 8.0;
    if (y + rowH > bottomLimit) {
      doc.addPage();
      y = 18;
    }
    const labelColsWidth = columns
      .slice(0, footerTotalRow.labelSpanCols)
      .reduce((acc, c) => acc + c.width, 0);
    const isStandardProductFooter =
      columns.length >= 6 &&
      columns[3]?.header === 'DIMENSI (cm)' &&
      footerTotalRow.labelSpanCols >= 5;

    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(isStandardProductFooter ? 8.6 : 9);
    doc.setTextColor(...INK_PRIMARY);
    if (isStandardProductFooter) {
      const labelLeftX =
        margin + columns.slice(0, 3).reduce((acc, c) => acc + c.width, 0) + 2;
      doc.text(footerTotalRow.label, labelLeftX, y + 5.6, {
        align: 'left',
        maxWidth: margin + labelColsWidth - labelLeftX - 2,
      });
    } else {
      doc.text(footerTotalRow.label, margin + labelColsWidth - 3, y + 5.6, { align: 'right' });
    }
    const footerCurrency = splitAccountingRupiahDisplay(footerTotalRow.value);
    if (footerCurrency) {
      doc.text(footerCurrency.symbol, margin + labelColsWidth + 2, y + 5.6, { align: 'left' });
      doc.text(footerCurrency.amount, margin + totalWidth - 2, y + 5.6, { align: 'right' });
    } else {
      doc.text(footerTotalRow.value, margin + totalWidth - 2, y + 5.6, { align: 'right' });
    }
    y += rowH;
  }

  return y + 9;
}

export function toStandardProductFormalTableRows(
  rows: readonly StandardDocumentProductFormattedRow[]
): FormalTableCell[][] {
  return rows.map((row) => [
    { text: row.noText },
    {
      text: row.productTitle,
      subText: row.specText || undefined,
      bold: true,
    },
    {
      text: row.materialTitle,
      subText: row.materialSubText || undefined,
      bold: row.materialTitle !== '-',
    },
    {
      text: row.dimensionText,
      subText: row.quantityText,
    },
    { text: row.unitPriceText },
    { text: row.subtotalText, bold: row.subtotal !== null },
  ]);
}

export interface CostBreakdownRenderOptions {
  variant?: 'table-aligned' | 'spk-colon';
  colonLabelX?: number;
  colonOffset?: number;
  itemsStartX?: number;
  valLeftX?: number;
  blockRightX?: number;
  amountColW?: number;
  hideTotalRow?: boolean;
  hideDeliveryFleetLabel?: boolean;
}

export function drawFormalCostBreakdownTable(
  doc: jsPDF,
  breakdown: DocumentCostBreakdown,
  startY: number,
  margin: number,
  bottomLimit: number,
  totalLabel = 'TOTAL KESELURUHAN',
  options?: CostBreakdownRenderOptions
): number {
  const isSpkColon = options?.variant === 'spk-colon';
  const hideTotalRow = Boolean(options?.hideTotalRow);
  const totalWidth = 174;
  const amountColW = options?.amountColW ?? 28;
  const labelStartX = isSpkColon
    ? (options?.itemsStartX ?? margin + 14)
    : margin + 8 + 53 + 34 + 2; // Sejajar dengan awal teks kolom DIMENSI (cm)
  const valLeftX =
    options?.valLeftX ??
    (isSpkColon ? labelStartX + 44 : margin + totalWidth - amountColW + 2);
  const valRightX = isSpkColon
    ? (options?.blockRightX ?? valLeftX + 26)
    : margin + totalWidth - 2;
  const headingH = isSpkColon ? 1.4 : 5.6;
  const rowH = 5.4;
  const totalRowH = 6.5;

  type BreakdownValueCell =
    | { kind: 'free'; strikeAmount: number }
    | { kind: 'currency'; amount: number; bold?: boolean }
    | { kind: 'discount'; amount: number };

  const rows: Array<{
    label: string;
    boldLabel?: boolean;
    indented?: boolean;
    value: BreakdownValueCell;
  }> = [
    {
      label: 'Biaya Desain 3D',
      value: { kind: 'free', strikeAmount: breakdown.design3dFee },
    },
    {
      label: options?.hideDeliveryFleetLabel
        ? 'Biaya Pengiriman'
        : `Biaya Pengiriman (${breakdown.deliveryFleetLabel})`,
      value: { kind: 'free', strikeAmount: breakdown.deliveryFee },
    },
    {
      label: 'Harga Produk',
      value: { kind: 'currency', amount: breakdown.productPriceAmount },
    },
    {
      label: 'Potongan Promo',
      indented: true,
      value: { kind: 'discount', amount: breakdown.promoDiscountAmount },
    },
    {
      label: 'Harga Setelah Potongan',
      boldLabel: true,
      value: { kind: 'currency', amount: breakdown.priceAfterDiscount, bold: true },
    },
    {
      label: 'PPN (11%)',
      value: { kind: 'currency', amount: breakdown.ppnAmount },
    },
  ];

  let y = startY;
  const blockHeight =
    headingH + rows.length * rowH + (hideTotalRow ? 0 : 1.5 + totalRowH);
  if (y + blockHeight > bottomLimit) {
    doc.addPage();
    y = 18;
  }

  if (isSpkColon) {
    const colonLabelX = options?.colonLabelX ?? margin + 10;
    const colonOffset = options?.colonOffset ?? 34;
    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(9.0);
    doc.setTextColor(...INK_SECONDARY);
    doc.text('Rincian Komponen Biaya', colonLabelX, y);
    doc.text(':', colonLabelX + colonOffset, y);
    y += headingH;
  } else {
    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(9.0);
    doc.setTextColor(...INK_PRIMARY);
    doc.text('Rincian Komponen Biaya', labelStartX, y + 3.4);
    y += headingH;
  }

  rows.forEach((row) => {
    if (y + rowH > bottomLimit) {
      doc.addPage();
      y = 18;
    }

    const lineY = y + 3.8;
    const rowLabelX = row.indented ? labelStartX + 4 : labelStartX;

    doc.setFont(FONT_FAMILY, row.boldLabel ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK_PRIMARY);
    doc.text(row.label, rowLabelX, lineY, { maxWidth: valLeftX - rowLabelX - 2 });

    if (row.value.kind === 'free') {
      const formatted = formatIdr(row.value.strikeAmount);
      const split = splitAccountingRupiahDisplay(formatted);
      doc.setFont(FONT_FAMILY, 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...INK_PRIMARY);
      if (split) {
        doc.text(split.symbol, valLeftX, lineY, { align: 'left' });
        doc.text(split.amount, valRightX, lineY, { align: 'right' });
        if (row.value.strikeAmount > 0) {
          const amtW = doc.getTextWidth(split.amount);
          doc.setDrawColor(...INK_PRIMARY);
          doc.setLineWidth(0.25);
          doc.line(valRightX - amtW - 0.3, lineY - 1.0, valRightX + 0.3, lineY - 1.0);
        }
      } else {
        doc.text(formatted, valRightX, lineY, { align: 'right' });
        if (row.value.strikeAmount > 0) {
          const strikeW = doc.getTextWidth(formatted);
          doc.setDrawColor(...INK_PRIMARY);
          doc.setLineWidth(0.25);
          doc.line(valRightX - strikeW - 0.3, lineY - 1.0, valRightX + 0.3, lineY - 1.0);
        }
      }
    } else if (row.value.kind === 'discount') {
      const formatted = formatIdr(row.value.amount);
      const split = splitAccountingRupiahDisplay(formatted);
      doc.setFont(FONT_FAMILY, 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...INK_PRIMARY);
      if (row.value.amount > 0) {
        if (split) {
          doc.text('-', valLeftX - 0.6, lineY, { align: 'right' });
          doc.text(split.symbol, valLeftX, lineY, { align: 'left' });
          doc.text(split.amount, valRightX, lineY, { align: 'right' });
        } else {
          doc.text(`-${formatted}`, valRightX, lineY, { align: 'right' });
        }
      } else {
        doc.text('Rp', valLeftX, lineY, { align: 'left' });
        doc.text('0', valRightX, lineY, { align: 'right' });
      }
    } else {
      const formatted = formatIdr(row.value.amount);
      const split = splitAccountingRupiahDisplay(formatted);
      doc.setFont(FONT_FAMILY, row.value.bold ? 'bold' : 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...INK_PRIMARY);
      if (split) {
        doc.text(split.symbol, valLeftX, lineY, { align: 'left' });
        doc.text(split.amount, valRightX, lineY, { align: 'right' });
      } else {
        doc.text(formatted, valRightX, lineY, { align: 'right' });
      }
    }

    y += rowH;
  });

  if (hideTotalRow) {
    return y + 4.2;
  }

  y += 1.5;
  if (y + totalRowH > bottomLimit) {
    doc.addPage();
    y = 18;
  }
  doc.setDrawColor(...BORDER_LINE);
  doc.setLineWidth(0.25);
  doc.line(labelStartX, y + 0.6, valRightX, y + 0.6);
  const totalLineY = y + 4.8;
  const totalFormatted = formatIdr(breakdown.totalAmount);
  const totalSplit = splitAccountingRupiahDisplay(totalFormatted);
  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(...INK_PRIMARY);
  doc.text(totalLabel, labelStartX, totalLineY, {
    align: 'left',
    maxWidth: valLeftX - labelStartX - 2,
  });
  if (totalSplit) {
    doc.text(totalSplit.symbol, valLeftX, totalLineY, { align: 'left' });
    doc.text(totalSplit.amount, valRightX, totalLineY, { align: 'right' });
  } else {
    doc.text(totalFormatted, valRightX, totalLineY, { align: 'right' });
  }
  y += totalRowH;

  return isSpkColon ? y + 3.0 : y + 6;
}

export interface SignatureSlot {
  roleHeading: string;
  subRole?: string;
  stampNote?: string;
  signerName: string;
  caption?: string;
  includeOwnerSignature?: boolean;
  includeCompanyStamp?: boolean;
}

export function drawFormalSignatures(
  doc: jsPDF,
  slots: SignatureSlot[],
  startY: number,
  margin: number,
  contentWidth: number,
  bottomLimit: number,
  cityDateLine?: string,
  brandAssets: WorkshopBrandPdfAssets | null = getCachedWorkshopBrandPdfAssets()
): number {
  const blockNeeded = cityDateLine ? 46 : 40;
  let y = startY;
  if (y + blockNeeded > bottomLimit) {
    doc.addPage();
    y = 18;
  }

  if (cityDateLine) {
    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK_PRIMARY);
    doc.text(cityDateLine, margin + contentWidth / 2, y, { align: 'center' });
    y += 5.5;
  }

  const slotWidth = contentWidth / slots.length;
  slots.forEach((slot, idx) => {
    const centerX = margin + slotWidth * idx + slotWidth / 2;

    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(8.8);
    doc.setTextColor(...INK_PRIMARY);
    doc.text(slot.roleHeading, centerX, y, { align: 'center' });

    if (slot.subRole) {
      doc.setFontSize(8);
      doc.setTextColor(...INK_SECONDARY);
      doc.text(slot.subRole, centerX, y + 4, { align: 'center' });
    }

    const stampImg = slot.includeCompanyStamp ? brandAssets?.companyStamp ?? null : null;

    if (stampImg) {
      const { width: stampW, height: stampH } = fitImageInBox(
        stampImg.width,
        stampImg.height,
        Math.min(34, slotWidth * 0.56),
        9.5
      );
      const stampX = centerX - stampW / 2;
      const stampY = y + 14.5 - stampH / 2;
      doc.addImage(stampImg.dataUrl, 'PNG', stampX, stampY, stampW, stampH);
    }

    if (slot.stampNote && !stampImg) {
      doc.setFont(FONT_FAMILY, 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(...INK_MUTED);
      doc.text(slot.stampNote, centerX, y + 14.5, { align: 'center' });
    }

    const nameY = y + 25.5;
    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK_PRIMARY);
    const displayName = slot.signerName || '____________________';
    doc.text(displayName, centerX, nameY, { align: 'center', maxWidth: slotWidth - 6 });
    const nameWidth = Math.min(slotWidth - 8, Math.max(28, doc.getTextWidth(displayName) + 4));
    doc.setDrawColor(...BORDER_DARK);
    doc.setLineWidth(0.25);
    doc.line(centerX - nameWidth / 2, nameY + 1.2, centerX + nameWidth / 2, nameY + 1.2);

    if (slot.caption) {
      doc.setFont(FONT_FAMILY, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...INK_SECONDARY);
      doc.text(slot.caption, centerX, nameY + 5, { align: 'center', maxWidth: slotWidth - 6 });
    }
  });

  return y + 34.5;
}

export function drawFormalBankPaymentCard(
  doc: jsPDF,
  businessConfig: BusinessConfig,
  startY: number,
  margin: number,
  contentWidth: number,
  bottomLimit: number,
  brandAssets: WorkshopBrandPdfAssets | null = getCachedWorkshopBrandPdfAssets(),
  _referenceLabel?: string
): number {
  const banks = resolveWorkshopBankAccounts(businessConfig);
  const useTwoCols = banks.length > 1 && contentWidth >= 130;
  const colGap = 5;
  const cardW = useTwoCols ? (contentWidth - colGap) / 2 : contentWidth;
  const cardH = 22.5;
  const rowGap = 3.5;

  let y = startY;
  for (let i = 0; i < banks.length; i += useTwoCols ? 2 : 1) {
    if (y + cardH > bottomLimit) {
      doc.addPage();
      y = 18;
    }

    const rowBanks = useTwoCols ? banks.slice(i, i + 2) : [banks[i]];
    rowBanks.forEach((bank, colIdx) => {
      const cardX = margin + colIdx * (cardW + colGap);
      const bankUpper = `${bank.namaBank} ${bank.namaLengkapBank}`.toUpperCase();
      const isBsi = bankUpper.includes('BSI') || bankUpper.includes('SYARIAH');

      const primaryRgb: [number, number, number] = isBsi ? [0, 163, 157] : [0, 94, 106];
      const secondaryRgb: [number, number, number] = isBsi ? [249, 160, 27] : [241, 90, 35];

      // Background & crisp sharp border
      doc.setFillColor(248, 250, 251);
      doc.setDrawColor(...BORDER_DARK);
      doc.setLineWidth(0.32);
      doc.rect(cardX, y, cardW, cardH, 'FD');

      // Logo transparan langsung di atas latar kartu (tanpa kotak putih)
      const logoPadLeft = useTwoCols ? 3.5 : 4.5;
      const logoX = cardX + logoPadLeft;
      const maxLogoW = useTwoCols ? 24 : 38;
      const maxLogoH = useTwoCols ? 11 : 12;
      const bodyTopY = y + 1.6;
      const bodyH = cardH - 1.6;
      const logoImg = isBsi
        ? (brandAssets?.bsiLogo ?? renderBsiLogoForPdf())
        : (brandAssets?.bniLogo ?? renderBniLogoForPdf());

      let logoDisplayW = useTwoCols ? 20 : 30;
      if (logoImg) {
        const fitted = fitImageInBox(logoImg.width, logoImg.height, maxLogoW, maxLogoH);
        logoDisplayW = fitted.width;
        const logoY = bodyTopY + (bodyH - fitted.height) / 2;
        doc.addImage(logoImg.dataUrl, 'PNG', logoX, logoY, fitted.width, fitted.height);
      } else {
        doc.setFont(FONT_FAMILY, 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...primaryRgb);
        doc.text(bank.namaBank, logoX, y + 13.5, { align: 'left' });
      }

      // Garis atas dua warna: aksen sekunder sampai ujung kanan logo, sisanya warna utama bank
      const accentBarWidth = Math.min(cardW, Math.max(14, logoPadLeft + logoDisplayW));
      doc.setFillColor(...primaryRgb);
      doc.rect(cardX, y, cardW, 1.6, 'F');
      doc.setFillColor(...secondaryRgb);
      doc.rect(cardX, y, accentBarWidth, 1.6, 'F');

      // Isi kartu hanya 3 baris dan rata kanan
      const rightX = cardX + cardW - (useTwoCols ? 3.5 : 4.5);
      const bankFullName = bank.namaLengkapBank
        .replace(/\s*\([^)]*\)\s*/g, '')
        .trim()
        .toUpperCase();

      doc.setFont(FONT_FAMILY, 'normal');
      doc.setFontSize(useTwoCols ? 6.2 : 6.8);
      doc.setTextColor(...INK_MUTED);
      doc.text(bankFullName, rightX, y + 7.4, { align: 'right' });

      doc.setFont(FONT_FAMILY, 'bold');
      doc.setFontSize(useTwoCols ? 11 : 12);
      doc.setTextColor(...INK_PRIMARY);
      doc.text(bank.nomorRekening, rightX, y + 13.2, { align: 'right' });

      doc.setFont(FONT_FAMILY, 'bold');
      doc.setFontSize(useTwoCols ? 8 : 8.8);
      doc.setTextColor(...INK_PRIMARY);
      doc.text(bank.atasNama.toUpperCase(), rightX, y + 18.2, { align: 'right' });
    });

    y += cardH + (i + (useTwoCols ? 2 : 1) < banks.length ? rowGap : 5);
  }

  return y;
}

function runWithWorkshopBrandAssets(
  builder: (assets: WorkshopBrandPdfAssets) => void
): Promise<void> {
  const cached = getCachedWorkshopBrandPdfAssets();
  if (cached) {
    builder(cached);
    return Promise.resolve();
  }
  return loadWorkshopBrandPdfAssets().then((assets) => {
    builder(assets);
  });
}

// ============================================================================
// 1. SURAT PERINTAH KERJA (SPK)
// ============================================================================
export function buildWorkOrderDocumentContent(
  spk: WorkOrderDocument,
  businessConfig: BusinessConfig
) {
  const startDateLabel = formatShortDateId(spk.tanggalMulai || spk.tanggalTerbit);
  const targetDateLabel = formatShortDateId(spk.tanggalTargetSelesai);
  const pelaksana = spk.perusahaanPelaksana || businessConfig.namaMerek;
  const ownerName = spk.namaPengawas || businessConfig.drafPemilik.namaPemilik;
  const spkClientPhone = formatDocumentPhoneDisplay(spk.teleponKlien);

  const openingText =
    `Dengan hormat,\nSurat Perintah Kerja (SPK) ini diterbitkan oleh ${pelaksana} dan ditujukan kepada ${spk.namaKlien} selaku Klien / Pemberi Kerja sebagai bentuk perintah kerja resmi dari Klien kepada ${pelaksana}. Dokumen ini memuat rincian spesifikasi pekerjaan, jadwal pelaksanaan, skema pembayaran, serta ketentuan-ketentuan pelaksanaan untuk ditinjau dan ditandatangani oleh Klien; setelah SPK ini ditandatangani, maka pekerjaan tersebut dinyatakan telah disetujui secara resmi dan akan segera dikerjakan:`;

  const leftMeta: KeyValuePair[] = [
    {
      label: 'Kepada Yth.',
      value: `${spk.namaKlien}${spkClientPhone ? ` (${spkClientPhone})` : ''}`,
      boldValue: true,
    },
    {
      label: 'Perihal',
      value: 'Surat Perintah Kerja dari Klien (Untuk Ditandatangani)',
      boldValue: true,
    },
    { label: 'Nama Proyek', value: spk.namaProyek, boldValue: true },
    { label: 'Lokasi Pasang', value: spk.alamatPemasangan || '-' },
  ];

  const rightMeta: KeyValuePair[] = [
    { label: 'Dari / Owner', value: `${ownerName} (${pelaksana})`, boldValue: true },
    { label: 'Jadwal Kerja', value: `${startDateLabel} s.d. ${targetDateLabel}`, boldValue: true },
    { label: 'Acuan Gambar', value: spk.referensiGambarKerja || 'Shop Drawing Final Terlampir' },
  ];

  const fallbackTerms = [
    `1. Persetujuan & Perintah Mulai Kerja: Dengan ditandatanganinya Surat Perintah Kerja (SPK) ini oleh Klien (Pemberi Kerja) dan Owner / Pelaksana (${pelaksana}), seluruh lingkup pekerjaan, desain/gambar kerja, serta spesifikasi material dinyatakan telah disetujui oleh Klien dan pekerjaan akan segera dikerjakan.`,
    `2. Lingkup & Acuan Teknis: ${pelaksana} wajib memproduksi dan memasang seluruh unit sesuai ${spk.nomorPenawaranReferensi ? `Surat Penawaran ${spk.nomorPenawaranReferensi}` : 'Penawaran final'} serta gambar kerja (shop drawing) final yang telah disetujui bersama.`,
    `3. Jangka Waktu & Pelaksanaan: Pekerjaan dilaksanakan pada periode ${startDateLabel} hingga ${targetDateLabel}, terhitung efektif setelah SPK ini ditandatangani oleh Klien dan pembayaran Termin 1 (Uang Muka / DP) diterima.`,
    `4. Perubahan Pekerjaan (Addendum): Setiap perubahan desain, ukuran, material, atau penambahan/pengurangan item setelah SPK ditandatangani wajib disepakati secara tertulis oleh Klien dan ${pelaksana} karena dapat memengaruhi biaya serta jadwal penyelesaian.`,
    '5. Pengawasan Mutu & Pengemasan: Setiap modul diperiksa kesesuaian spesifikasinya serta dikemas aman dengan pelindung sudut sebelum dikirim dan dipasang di lokasi Klien.',
    '6. Keamanan & Kebersihan Lokasi: Tim pelaksana wajib menggunakan APD standar, menjaga keamanan properti Klien, serta membersihkan area kerja setelah proses instalasi selesai.',
    `7. Serah Terima & Pembayaran Termin: Pembayaran dilakukan bertahap sesuai jadwal termin${spk.nomorInvoiceReferensi ? ` pada Invoice ${spk.nomorInvoiceReferensi}` : ''}, dan penyelesaian pekerjaan dibuktikan melalui Surat Jalan serta Berita Acara Serah Terima (BAST).`,
  ].join('\n');

  const termsText = spk.syaratKetentuan?.trim() ? spk.syaratKetentuan.trim() : fallbackTerms;

  const closingText =
    `Demikian Surat Perintah Kerja (SPK) ini disampaikan dari Owner ${pelaksana} kepada ${spk.namaKlien} untuk ditinjau dan ditandatangani. Setelah SPK ini ditandatangani oleh Klien, maka pekerjaan tersebut dinyatakan resmi disetujui dan akan segera dikerjakan sesuai jadwal serta ketentuan yang tercantum.`;

  const signatureSlots: SignatureSlot[] = [
    {
      roleHeading: 'Menyetujui & Memberi Perintah Kerja,',
      subRole: 'Klien / Pemberi Kerja',
      stampNote: '[ Tanda Tangan Persetujuan Klien ]',
      signerName: spk.namaKlien,
      caption: spkClientPhone || spk.namaProyek,
    },
    {
      roleHeading: 'Diterbitkan & Dilaksanakan Oleh,',
      subRole: 'Owner / Pelaksana',
      signerName: ownerName,
      caption: pelaksana,
      includeCompanyStamp: true,
    },
  ];

  return {
    startDateLabel,
    targetDateLabel,
    openingText,
    leftMeta,
    rightMeta,
    termsText,
    closingText,
    signatureSlots,
  };
}

export function downloadWorkOrderPdf(
  spk: WorkOrderDocument,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  linkedProject?: WorkshopProject | null
): Promise<void> {
  return runWithWorkshopBrandAssets((brandAssets) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 18;

  doc.setProperties({
    title: `SPK ${spk.nomorSpk} - ${spk.namaProyek}`,
    subject: 'Surat Perintah Kerja Resmi',
    author: businessConfig.namaMerek,
  });

  const city = resolveCityName(businessConfig);
  const content = buildWorkOrderDocumentContent(spk, businessConfig);

  let y = drawFormalLetterhead(
    doc,
    businessConfig,
    'SURAT PERINTAH KERJA (SPK)',
    spk.nomorSpk,
    `Tanggal Terbit: ${formatShortDateId(spk.tanggalTerbit)} · Prioritas: ${spk.prioritas}`,
    brandAssets.logo
  );

  y = drawParagraphBlock(doc, content.openingText, y, margin, contentWidth, bottomLimit);

  y = drawTwoColumnMetadata(
    doc,
    content.leftMeta,
    content.rightMeta,
    y,
    margin,
    contentWidth
  );

  const refs = [
    spk.nomorPenawaranReferensi ? `Penawaran: ${spk.nomorPenawaranReferensi}` : null,
    spk.nomorSpksReferensi ? `Kontrak/SPK: ${spk.nomorSpksReferensi}` : null,
    spk.nomorInvoiceReferensi ? `Invoice: ${spk.nomorInvoiceReferensi}` : null,
    (spk.nilaiKontrakReferensi ?? 0) > 0
      ? `Nilai Kontrak: ${formatIdr(spk.nilaiKontrakReferensi ?? 0)}`
      : null,
  ]
    .filter(Boolean)
    .join('   |   ');

  if (refs) {
    y = drawParagraphBlock(doc, `Dokumen Acuan Resmi: ${refs}`, y, margin, contentWidth, bottomLimit, {
      fontStyle: 'italic',
      fontSize: 8.5,
    });
  }

  y = drawFormalSectionHeading(
    doc,
    'I. Rincian Unit Pekerjaan & Spesifikasi Material',
    y,
    margin,
    contentWidth,
    bottomLimit,
    23,
    refs ? 4.5 : 2.0
  );

  const workOrderStdRows = spk.daftarItem.map((item, idx) =>
    formatStandardDocumentProductRow(
      {
        productId: item.id,
        namaProduk: item.namaUnit,
        customisasi: item.customisasi,
        material: item.material,
        finishing: item.finishing,
        kodeWarna: item.kodeWarna,
        tambahan: item.tambahan,
        spesifikasiMaterial: item.spesifikasiMaterial,
        dimensi: item.dimensi,
        jumlah: item.jumlah,
        satuan: item.satuan || 'Unit',
        hargaSatuan: item.hargaSatuan,
        subtotal: item.subtotal,
        linkedProjectProduct: matchLinkedProjectProduct(
          { id: item.id, namaProduk: item.namaUnit },
          idx,
          linkedProject?.daftarProduk
        ),
      },
      idx
    )
  );
  const workOrderHasPrices = workOrderStdRows.some((r) => r.subtotal !== null);
  const workOrderTotal = workOrderStdRows.reduce((sum, r) => sum + (r.subtotal ?? 0), 0);

  y = drawFormalGridTable(
    doc,
    STANDARD_DOCUMENT_PRODUCT_TABLE_COLUMNS,
    toStandardProductFormalTableRows(workOrderStdRows),
    y,
    margin,
    bottomLimit,
    workOrderHasPrices
      ? {
          label: 'TOTAL NILAI PEKERJAAN',
          value: formatIdr(workOrderTotal),
          labelSpanCols: 5,
        }
      : undefined
  );

  // Landasan Skema Pembayaran & Progres Kontrak
  const effectiveSpkScheme = resolveEffectivePaymentScheme(
    spk.tahapanPembayaran,
    paymentScheme,
    spk.catatanPembayaran
  );
  const spkBreakdown = calculatePaymentSchemeBreakdown(
    spk.nilaiKontrakReferensi || 0,
    effectiveSpkScheme
  );

  if (spkBreakdown.length > 0) {
    y = drawFormalSectionHeading(
      doc,
      'II. Landasan Skema Pembayaran & Verifikasi Progres',
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
        { header: 'TAHAPAN TERMIN', width: 48 },
        { header: 'PORSI', width: 16, align: 'center' },
        { header: 'NOMINAL ACUAN', width: 34, align: 'right' },
        { header: 'SYARAT PENCAPAIAN / KETERANGAN', width: 67 },
      ],
      spkBreakdown.map((st, idx) => [
        { text: String(idx + 1) },
        { text: st.nama, bold: true },
        { text: `${st.persentase}%` },
        { text: st.amount !== null ? formatIdr(st.amount) : '-', bold: true },
        { text: st.keterangan },
      ]),
      y,
      margin,
      bottomLimit
    );
  }

  y = drawFormalSectionHeading(
    doc,
    'III. Ketentuan-Ketentuan SPK & Persetujuan Pelaksanaan',
    y,
    margin,
    contentWidth,
    bottomLimit
  );

  y = drawParagraphBlock(doc, content.termsText, y, margin, contentWidth, bottomLimit, {
    fontSize: 9,
  });

  if (spk.catatanTeknis.trim() || spk.ketentuanKeselamatan.trim()) {
    y = drawFormalSectionHeading(
      doc,
      'IV. Instruksi Teknis Lapangan & Keselamatan Kerja (K3)',
      y,
      margin,
      contentWidth,
      bottomLimit,
      14,
      4.5
    );
    if (spk.catatanTeknis.trim()) {
      y = drawParagraphBlock(
        doc,
        `Catatan Teknis: ${spk.catatanTeknis.trim()}`,
        y,
        margin,
        contentWidth,
        bottomLimit,
        { fontSize: 9 }
      );
    }
    if (spk.ketentuanKeselamatan.trim()) {
      y = drawParagraphBlock(
        doc,
        `Prosedur K3 & Pengemasan: ${spk.ketentuanKeselamatan.trim()}`,
        y,
        margin,
        contentWidth,
        bottomLimit,
        { fontSize: 9 }
      );
    }
  }

  if (y > 22) {
    y += 2.5;
  }

  y = drawParagraphBlock(
    doc,
    content.closingText,
    y,
    margin,
    contentWidth,
    bottomLimit,
    { fontSize: 9 }
  );

  drawFormalSignatures(
    doc,
    content.signatureSlots,
    y + 2,
    margin,
    contentWidth,
    bottomLimit,
    `${city}, ${formatShortDateId(spk.tanggalTerbit)}`,
    brandAssets
  );

  addFormalPageFooters(doc, `${businessConfig.namaMerek} · Surat Perintah Kerja ${spk.nomorSpk}`);
  openPdfDocumentInNewTab(doc);
  });
}

// ============================================================================
// 2. SURAT PERJANJIAN KERJA (SPK)
// ============================================================================
export interface AgreementClauseHeadingParts {
  pasalLabel: string;
  titleLabel: string;
}

export function formatAgreementClauseHeading(
  judulPasal: string,
  fallbackIndex?: number
): AgreementClauseHeadingParts {
  const normalized = judulPasal.trim();
  if (!normalized) {
    return {
      pasalLabel: fallbackIndex ? `PASAL ${fallbackIndex}` : 'PASAL',
      titleLabel: '',
    };
  }

  const explicitLines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (explicitLines.length >= 2) {
    return {
      pasalLabel: explicitLines[0].toUpperCase(),
      titleLabel: explicitLines.slice(1).join(' ').toUpperCase(),
    };
  }

  const match = normalized.match(/^(pasal\s+[^\s—–\-:]+)(?:\s*[—–\-:]\s*|\s+)(.+)$/i);
  if (match) {
    return {
      pasalLabel: match[1].trim().toUpperCase(),
      titleLabel: match[2].trim().toUpperCase(),
    };
  }

  if (/^pasal\b/i.test(normalized)) {
    return {
      pasalLabel: normalized.toUpperCase(),
      titleLabel: '',
    };
  }

  return {
    pasalLabel: fallbackIndex ? `PASAL ${fallbackIndex}` : 'PASAL',
    titleLabel: normalized.toUpperCase(),
  };
}

export function drawAgreementClauseHeading(
  doc: jsPDF,
  judulPasal: string,
  y: number,
  margin: number,
  contentWidth: number,
  bottomLimitOrEnsureSpace: number | ((needed: number) => number | void),
  clauseIndex?: number,
  hasBody = true
): number {
  const { pasalLabel, titleLabel } = formatAgreementClauseHeading(judulPasal, clauseIndex);
  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(...INK_PRIMARY);

  const titleLines = titleLabel
    ? (doc.splitTextToSize(titleLabel, Math.max(40, contentWidth - 8)) as string[])
    : [];
  const lineH = 4.1;
  const headingHeight = lineH + titleLines.length * lineH + 0.8;
  const needed = headingHeight + (hasBody ? 5.0 : 0);

  let drawY = y;
  if (typeof bottomLimitOrEnsureSpace === 'number') {
    if (drawY + needed > bottomLimitOrEnsureSpace) {
      doc.addPage();
      drawY = 18;
    }
  } else {
    const pagesBefore =
      typeof (doc as unknown as { getNumberOfPages?: () => number }).getNumberOfPages === 'function'
        ? doc.getNumberOfPages()
        : null;
    const checkedY = bottomLimitOrEnsureSpace(needed);
    const pagesAfter =
      typeof (doc as unknown as { getNumberOfPages?: () => number }).getNumberOfPages === 'function'
        ? doc.getNumberOfPages()
        : null;
    const brokePage =
      pagesBefore !== null && pagesAfter !== null
        ? pagesAfter > pagesBefore
        : typeof checkedY === 'number' && checkedY < drawY;
    if (brokePage) {
      drawY = typeof checkedY === 'number' ? checkedY : 18;
    }
  }

  const centerX = margin + contentWidth / 2;
  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(...INK_PRIMARY);
  doc.text(pasalLabel, centerX, drawY, { align: 'center' });
  drawY += lineH;

  titleLines.forEach((line) => {
    doc.text(line, centerX, drawY, { align: 'center' });
    drawY += lineH;
  });

  return drawY + 0.8;
}

export function normalizeAgreementClauseNumbering(isiPasal: string): string {
  const trimmed = isiPasal.trim();
  if (!trimmed) return '';

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/g, ''))
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return '';

  const numberedTopRe = /^\s*(?:\d{1,3}[.)]|\(\d{1,3}\))\s+(.+)$/;
  const subOrBulletRe = /^\s*(?:[a-zA-Z][.)]|\([a-zA-Z]\)|[•‣▪◦–—*-])\s+/;
  const hasUnnumberedTopLine = lines.some(
    (line) => !numberedTopRe.test(line) && !subOrBulletRe.test(line)
  );
  if (!hasUnnumberedTopLine) {
    return trimmed;
  }

  let topNumber = 0;
  return lines
    .map((line) => {
      if (subOrBulletRe.test(line)) {
        return line;
      }
      const numberedMatch = line.match(numberedTopRe);
      if (numberedMatch) {
        topNumber += 1;
        return `${topNumber}. ${numberedMatch[1].trim()}`;
      }
      topNumber += 1;
      const body = line.trim();
      const needsPaymentPrefix =
        /^(?:Nilai total kontrak|Total nilai pekerjaan)/i.test(body) &&
        !/^Nilai Kontrak\s*&/i.test(body);
      return `${topNumber}. ${needsPaymentPrefix ? `Nilai Kontrak & Skema Termin: ${body}` : body}`;
    })
    .join('\n');
}

export function resolveAgreementProductFinishingInfo(
  item: Pick<CooperationAgreementProductItem, 'finishing' | 'kodeWarna' | 'spesifikasiMaterial'>
): { finishing: string; kodeWarna: string } {
  const explicitFinishing = item.finishing?.trim() ?? '';
  const explicitColorCode = item.kodeWarna?.trim() ?? '';
  const spec = item.spesifikasiMaterial?.trim() ?? '';

  let parsedFinishing = '';
  let parsedColorCode = '';

  if (spec) {
    const finishMatch = spec.match(
      /\bfinishing\s+([^,(;\n\]]+?)(?:\s*\(([^)]+)\)|(?=[,;\n\]]|$))/i
    );
    if (finishMatch) {
      parsedFinishing = finishMatch[1].trim();
      if (finishMatch[2]) {
        parsedColorCode = finishMatch[2].trim();
      }
    }
    if (!parsedColorCode) {
      const codeMatch = spec.match(/\bkode\s*warna\s*[:\-]?\s*([^,;\n\]]+)/i);
      if (codeMatch?.[1]) {
        parsedColorCode = codeMatch[1].trim();
      }
    }
  }

  return {
    finishing: explicitFinishing || parsedFinishing,
    kodeWarna: explicitColorCode || parsedColorCode,
  };
}

export function formatAgreementProductSpecText(
  item: Pick<
    CooperationAgreementProductItem,
    'customisasi' | 'material' | 'finishing' | 'kodeWarna' | 'spesifikasiMaterial'
  >
): string {
  const rawSpec = item.spesifikasiMaterial?.trim() ?? '';
  const specLower = rawSpec.toLowerCase();
  const prefixes: string[] = [];

  const customisasi = item.customisasi?.trim() ?? '';
  if (customisasi && !specLower.includes(customisasi.toLowerCase())) {
    prefixes.push(`Model: ${customisasi}`);
  }

  const material = item.material?.trim() ?? '';
  if (material && !specLower.includes(material.toLowerCase())) {
    const normalizedMat = /\b18\s*mm\b/i.test(material) ? material : `${material} 18 MM`;
    prefixes.push(`Material: ${normalizedMat}`);
  }

  if (rawSpec) {
    return prefixes.length > 0 ? `${prefixes.join(' · ')} · ${rawSpec}` : rawSpec;
  }

  if (prefixes.length > 0) {
    return prefixes.join(' · ');
  }

  return 'Sesuai Shop Drawing & BOQ Final';
}

export function buildAgreementDocumentStructure(
  spks: CooperationAgreementDocument,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  linkedProject?: WorkshopProject | null,
  businessConfig: BusinessConfig = BUSINESS_CONFIG
) {
  const startDateDisplay = spks.tanggalMulaiKerja?.trim()
    ? formatShortDateId(spks.tanggalMulaiKerja)
    : formatShortDateId(spks.tanggalPenandatanganan);
  const endDateDisplay = spks.tanggalSelesaiKerja?.trim()
    ? formatShortDateId(spks.tanggalSelesaiKerja)
    : `${spks.durasiKerjaHari} hari kerja efektif sejak DP & gambar kerja disetujui`;
  const attachmentText =
    spks.lampiranAcuan?.trim() ||
    `${spks.nomorPenawaranReferensi ? `Surat Penawaran (${spks.nomorPenawaranReferensi}), ` : ''}Rincian RAB / Bill of Quantities (BOQ), Gambar Kerja Teknis (Shop Drawing Final), dan Spesifikasi Material & Finishing.`;

  const effectiveScheme = resolveEffectivePaymentScheme(
    spks.tahapanPembayaran,
    paymentScheme,
    spks.catatanPembayaran
  );
  const paymentBreakdown = calculatePaymentSchemeBreakdown(
    spks.nilaiKontrak || 0,
    effectiveScheme
  );

  const productItems: CooperationAgreementProductItem[] =
    Array.isArray(spks.daftarProduk) && spks.daftarProduk.length > 0
      ? spks.daftarProduk
      : linkedProject
        ? buildAgreementProductItemsFromProject(linkedProject)
        : [];

  const productsTotal = productItems.reduce((sum, item) => {
    const qty = Math.max(1, Math.round(Number(item.jumlah) || 1));
    const unitPrice = Math.max(0, Math.round(Number(item.hargaSatuan) || 0));
    const subtotal =
      typeof item.subtotal === 'number' && Number.isFinite(item.subtotal) && item.subtotal > 0
        ? Math.round(item.subtotal)
        : qty * unitPrice;
    return sum + subtotal;
  }, 0);

  const clauses = spks.daftarPasal.map((clause, idx) => ({
    id: clause.id,
    judulPasal: clause.judulPasal?.trim() || `Pasal ${idx + 1}`,
    isiPasal: normalizeAgreementClauseNumbering(clause.isiPasal ?? ''),
  }));

  const closingClause = {
    judulPasal: `Pasal ${clauses.length + 1} — Penutup`,
    isiPasal:
      'Demikian Surat Perjanjian Kerja (SPK) ini dibuat dalam rangkap 2 (dua) asli di atas kertas bermeterai cukup, masing-masing mempunyai kekuatan hukum yang sama setelah ditandatangani oleh PARA PIHAK serta para saksi dalam keadaan sadar dan tanpa paksaan dari pihak manapun.',
  };

  const scopeRows: KeyValuePair[] = [
    {
      label: 'Jenis Pekerjaan',
      value: `${spks.judulProyek} (${spks.jenisPerjanjian})`,
      boldValue: true,
    },
    { label: 'Lokasi Proyek', value: spks.lokasiProyek || '-' },
    {
      label: 'Jangka Waktu',
      value: `${spks.durasiKerjaHari} hari kerja efektif (${startDateDisplay} s.d. ${endDateDisplay})`,
    },
    {
      label: 'Masa Garansi',
      value: `${spks.masaGaransiBulan} bulan terhitung sejak penandatanganan BAST`,
    },
    { label: 'Lampiran Acuan', value: attachmentText },
  ];

  const contractValueRows: KeyValuePair[] = [
    { label: 'Total Nilai Kontrak', value: formatIdr(spks.nilaiKontrak || 0), boldValue: true },
    ...(spks.nomorPenawaranReferensi?.trim()
      ? [{ label: 'Penawaran Acuan', value: spks.nomorPenawaranReferensi.trim() }]
      : []),
    {
      label: 'Cakupan Harga',
      value:
        'Termasuk material BOQ, fabrikasi workshop, pengiriman & instalasi (di luar pekerjaan tambah).',
    },
  ];

  const partyIdentities = resolveAgreementPartyIdentities(
    spks,
    businessConfig,
    linkedProject
  );

  return {
    sectionHeadings: [
      'I. Identitas Para Pihak',
      'II. Ruang Lingkup',
      'III. Nilai Kontrak',
      'IV. Metode Pembayaran',
      'V. Ketentuan-Ketentuan',
    ] as const,
    openingText: `Pada hari ini, tanggal ${formatShortDateId(spks.tanggalPenandatanganan)}, bertempat di ${spks.kotaPenandatanganan}, yang bertanda tangan di bawah ini:`,
    partyIdentities,
    transitionText:
      'PIHAK PERTAMA dan PIHAK KEDUA secara bersama-sama disebut (PARA PIHAK) dengan ini sepakat mengikatkan diri dalam Surat Perjanjian Kerja (SPK) dengan pokok kesepakatan dan ketentuan-ketentuan yang berlaku.',
    scopeRows,
    scopeSummaryText: `PIHAK PERTAMA berkewajiban melaksanakan pekerjaan survei pengukuran ulang lokasi, penyusunan gambar kerja teknis (shop drawing), pengadaan material, fabrikasi di workshop ${spks.perusahaanPihakPertama}, pengiriman, hingga pemasangan unit untuk pekerjaan "${spks.judulProyek}" sesuai Lampiran Acuan di atas.`,
    productItems,
    productsTotal,
    productReferenceNote:
      'Catatan Acuan Mutu & Komplain: Tabel rincian produk, dimensi, spesifikasi material/hardware, jenis finishing, serta kode warna finishing di atas merupakan acuan teknis resmi yang mengikat PARA PIHAK dalam pemeriksaan mutu (QC), serah terima (BAST), dan penyelesaian komplain di kemudian hari.',
    contractValueRows,
    costBreakdown: buildCostBreakdownFromAgreement(spks, linkedProject),
    effectiveScheme,
    paymentBreakdown,
    clausesIntroText:
      'Pelaksanaan pekerjaan sebagaimana dimaksud pada Bagian II sampai dengan Bagian IV di atas tunduk pada ketentuan pasal-pasal berikut:',
    clauses,
    closingClause,
  };
}

export function downloadAgreementPdf(
  spks: CooperationAgreementDocument,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  linkedProject?: WorkshopProject | null
): Promise<void> {
  return runWithWorkshopBrandAssets((brandAssets) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 18;

  const ensureSpace = (needed: number): number => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = 18;
    }
    return y;
  };

  const structure = buildAgreementDocumentStructure(
    spks,
    paymentScheme,
    linkedProject,
    businessConfig
  );

  doc.setProperties({
    title: `${spks.nomorKontrak} - ${spks.judulProyek}`,
    subject: 'Surat Perjanjian Kerja (SPK) Resmi',
    author: businessConfig.namaMerek,
  });

  let y = drawFormalLetterhead(
    doc,
    businessConfig,
    'SURAT PERJANJIAN KERJA',
    spks.nomorKontrak,
    undefined,
    brandAssets.logo
  );

  y = drawParagraphBlock(
    doc,
    structure.openingText,
    y - 1.5,
    margin,
    contentWidth,
    bottomLimit
  );

  // I. IDENTITAS PARA PIHAK
  y = drawFormalSectionHeading(
    doc,
    structure.sectionHeadings[0],
    y,
    margin,
    contentWidth,
    bottomLimit,
    18,
    4.5
  );

  const pointMarkerX = margin + 4;
  const pointBodyX = margin + 10;
  const pointBodyWidth = contentWidth - 10;

  ensureSpace(10);
  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(...INK_PRIMARY);
  doc.text('a.', pointMarkerX, y);
  doc.text('PIHAK PERTAMA (PELAKSANA)', pointBodyX, y);
  y += 4.5;
  y = drawColonMetadataRows(
    doc,
    structure.partyIdentities.firstPartyRows,
    y,
    pointBodyX,
    38,
    pointBodyWidth,
    bottomLimit
  );
  y = drawParagraphBlock(
    doc,
    'Dalam perjanjian ini bertindak untuk dan atas nama pelaksana pekerjaan, selanjutnya disebut sebagai PIHAK PERTAMA (PELAKSANA).',
    y,
    margin,
    contentWidth,
    bottomLimit,
    { fontStyle: 'italic', fontSize: 8.8, indent: 10 }
  );

  ensureSpace(12);
  if (y > 22) {
    y += 1.5;
  }
  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(...INK_PRIMARY);
  doc.text('b.', pointMarkerX, y);
  doc.text('PIHAK KEDUA (PEMBERI TUGAS)', pointBodyX, y);
  y += 4.5;
  y = drawColonMetadataRows(
    doc,
    structure.partyIdentities.secondPartyRows,
    y,
    pointBodyX,
    38,
    pointBodyWidth,
    bottomLimit
  );
  y = drawParagraphBlock(
    doc,
    structure.partyIdentities.secondPartyLegalDescription,
    y,
    margin,
    contentWidth,
    bottomLimit,
    { fontStyle: 'italic', fontSize: 8.8, indent: 10 }
  );

  if (y > 22) {
    y += 3.5;
  }
  y = drawParagraphBlock(
    doc,
    structure.transitionText,
    y,
    margin,
    contentWidth,
    bottomLimit
  );

  // II. RUANG LINGKUP
  y = drawFormalSectionHeading(
    doc,
    structure.sectionHeadings[1],
    y,
    margin,
    contentWidth,
    bottomLimit,
    18,
    4.5
  );
  y = drawColonMetadataRows(
    doc,
    structure.scopeRows,
    y,
    pointBodyX,
    34,
    pointBodyWidth,
    bottomLimit
  );
  y = drawParagraphBlock(
    doc,
    structure.scopeSummaryText,
    y,
    margin,
    contentWidth,
    bottomLimit,
    { fontSize: 9 }
  );

  if (structure.productItems.length > 0) {
    ensureSpace(24);
    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK_PRIMARY);
    doc.text(
      'Tabel Rincian Detail Produk, Spesifikasi Teknis & Kode Warna Finishing:',
      margin,
      y + 1
    );
    y += 4;

    const agreementStdRows = structure.productItems.map((item, idx) =>
      formatStandardDocumentProductRow(
        {
          productId: item.id,
          namaProduk: item.namaProduk,
          customisasi: item.customisasi,
          material: item.material,
          finishing: item.finishing,
          kodeWarna: item.kodeWarna,
          tambahan: item.tambahan,
          spesifikasiMaterial: item.spesifikasiMaterial,
          dimensi: item.dimensi,
          jumlah: item.jumlah,
          satuan: item.satuan,
          hargaSatuan: item.hargaSatuan,
          subtotal: item.subtotal,
          linkedProjectProduct: matchLinkedProjectProduct(
            { id: item.id, namaProduk: item.namaProduk },
            idx,
            linkedProject?.daftarProduk
          ),
        },
        idx
      )
    );

    y = drawFormalGridTable(
      doc,
      STANDARD_DOCUMENT_PRODUCT_TABLE_COLUMNS,
      toStandardProductFormalTableRows(agreementStdRows),
      y,
      margin,
      bottomLimit,
      {
        label: 'TOTAL RINCIAN PRODUK',
        value: formatIdr(structure.productsTotal),
        labelSpanCols: 5,
      }
    );

    y = drawParagraphBlock(
      doc,
      structure.productReferenceNote,
      Math.max(18, y - 5),
      margin,
      contentWidth,
      bottomLimit,
      { fontStyle: 'italic', fontSize: 8.2 }
    );
  }

  // III. NILAI KONTRAK
  y = drawFormalSectionHeading(
    doc,
    structure.sectionHeadings[2],
    y,
    margin,
    contentWidth,
    bottomLimit,
    18,
    4.5
  );
  if (structure.costBreakdown) {
    y = drawFormalCostBreakdownTable(
      doc,
      structure.costBreakdown,
      y,
      margin,
      bottomLimit,
      'Total Nilai Kontrak',
      {
        variant: 'spk-colon',
        colonLabelX: pointBodyX,
        colonOffset: 45,
        itemsStartX: pointBodyX + 4,
        valLeftX: pointBodyX + 48,
        blockRightX: pointBodyX + 48 + 26,
        amountColW: 28,
        hideDeliveryFleetLabel: true,
      }
    );
  }
  const spkRemainingContractRows = structure.costBreakdown
    ? structure.contractValueRows.filter((row) => row.label !== 'Total Nilai Kontrak')
    : structure.contractValueRows;
  y = drawColonMetadataRows(
    doc,
    spkRemainingContractRows,
    y,
    pointBodyX,
    45,
    pointBodyWidth,
    bottomLimit
  );
  y += 2;

  // IV. METODE PEMBAYARAN
  y = drawFormalSectionHeading(
    doc,
    structure.sectionHeadings[3],
    y,
    margin,
    contentWidth,
    bottomLimit,
    23,
    4.5
  );

  if (structure.paymentBreakdown.length > 0) {
    y = drawFormalGridTable(
      doc,
      [
        { header: 'NO', width: 9, align: 'center' },
        { header: 'SKEMA TERMIN PEMBAYARAN', width: 48 },
        { header: 'PORSI', width: 16, align: 'center' },
        { header: 'NOMINAL', width: 34, align: 'right' },
        { header: 'KETENTUAN PENAGIHAN', width: 67 },
      ],
      structure.paymentBreakdown.map((st, idx) => [
        { text: String(idx + 1) },
        { text: st.nama, bold: true },
        { text: `${st.persentase}%` },
        { text: st.amount !== null ? formatIdr(st.amount) : '-', bold: true },
        { text: st.keterangan },
      ]),
      y,
      margin,
      bottomLimit
    );
  }

  y = drawFormalBankPaymentCard(
    doc,
    businessConfig,
    y - 3,
    margin,
    contentWidth,
    bottomLimit,
    brandAssets,
    spks.nomorKontrak
  );

  // V. KETENTUAN-KETENTUAN (Penjabaran Pasal-Pasal)
  y = drawFormalSectionHeading(
    doc,
    structure.sectionHeadings[4],
    y,
    margin,
    contentWidth,
    bottomLimit,
    18,
    4.0
  );

  y = drawParagraphBlock(
    doc,
    structure.clausesIntroText,
    y,
    margin,
    contentWidth,
    bottomLimit,
    { fontSize: 9 }
  );

  [...structure.clauses, structure.closingClause].forEach((clause, idx) => {
    y += idx === 0 ? 1.0 : 0.6;
    y = drawAgreementClauseHeading(
      doc,
      clause.judulPasal,
      y,
      margin,
      contentWidth,
      ensureSpace,
      idx + 1,
      Boolean(clause.isiPasal)
    );
    if (clause.isiPasal) {
      y = drawParagraphBlock(doc, clause.isiPasal, y, margin, contentWidth, bottomLimit, {
        fontSize: 9,
      });
      y += 1.6;
    }
  });

  drawFormalSignatures(
    doc,
    [
      {
        roleHeading: 'PIHAK PERTAMA (PELAKSANA),',
        subRole: spks.perusahaanPihakPertama,
        stampNote: '[ Meterai Rp10.000 / Cap Perusahaan ]',
        signerName: spks.perwakilanPihakPertama,
        caption: `Saksi I: ${spks.saksiPihakPertama || '____________________'}`,
        includeCompanyStamp: true,
      },
      {
        roleHeading: 'PIHAK KEDUA (PEMBERI TUGAS),',
        subRole: structure.partyIdentities.secondPartySubRole,
        stampNote: '[ Meterai Rp10.000 / Tanda Tangan ]',
        signerName: structure.partyIdentities.secondPartySignerName,
        caption: `Saksi II: ${spks.saksiPihakKedua || '____________________'}`,
      },
    ],
    y + 2,
    margin,
    contentWidth,
    bottomLimit,
    `${spks.kotaPenandatanganan}, ${formatShortDateId(spks.tanggalPenandatanganan)}`,
    brandAssets
  );

  addFormalPageFooters(doc, `${businessConfig.namaMerek} · SPK Resmi ${spks.nomorKontrak}`);
  openPdfDocumentInNewTab(doc);
  });
}

// ============================================================================
// 3. INVOICE TAGIHAN PROYEK (INDUK)
// ============================================================================
export function downloadProjectInvoicePdf(
  invoice: ProjectInvoice,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  linkedProject?: WorkshopProject | null
): Promise<void> {
  return runWithWorkshopBrandAssets((brandAssets) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 18;

  const progress = computeInvoiceProgress(invoice);
  const city = resolveCityName(businessConfig);

  doc.setProperties({
    title: `Invoice ${invoice.nomorInvoice} - ${invoice.namaProyek}`,
    subject: 'Invoice Tagihan Resmi Proyek',
    author: businessConfig.namaMerek,
  });

  let y = drawFormalLetterhead(
    doc,
    businessConfig,
    'INVOICE TAGIHAN PROYEK',
    invoice.nomorInvoice,
    `Jatuh Tempo Akhir: ${formatShortDateId(invoice.tanggalJatuhTempo)}`,
    brandAssets.logo
  );

  y = drawTwoColumnMetadata(
    doc,
    [
      { label: 'Ditagihkan Kepada', value: invoice.namaKlien, boldValue: true },
      { label: 'Nama Proyek', value: invoice.namaProyek },
      { label: 'Lokasi Pekerjaan', value: invoice.lokasi || '-' },
      {
        label: 'Referensi Dokumen',
        value:
          [
            invoice.nomorSpkReferensi ? `SPK ${invoice.nomorSpkReferensi}` : null,
            invoice.nomorBastReferensi ? `BAST ${invoice.nomorBastReferensi}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || '-',
      },
    ],
    [
      { label: 'Total Nilai Kontrak', value: formatIdr(invoice.nilaiTotalKontrak), boldValue: true },
      { label: 'Sudah Dibayarkan', value: `${formatIdr(progress.paidAmount)} (${progress.progressPercent}%)` },
      { label: 'Sisa Tagihan', value: formatIdr(progress.remainingAmount), boldValue: true },
      { label: 'Jatuh Tempo', value: formatShortDateId(invoice.tanggalJatuhTempo) },
    ],
    y,
    margin,
    contentWidth
  );

  y = drawFormalSectionHeading(
    doc,
    'I. Rincian Pekerjaan / Tagihan Kontrak',
    y,
    margin,
    contentWidth,
    bottomLimit,
    23,
    2.0
  );

  const lineItems =
    invoice.rincianItem && invoice.rincianItem.length > 0
      ? invoice.rincianItem
      : [
          {
            id: 'default-contract',
            deskripsi: `${invoice.namaProyek} (${invoice.lokasi || 'Custom Workshop'})`,
            jumlah: 1,
            hargaSatuan: invoice.nilaiTotalKontrak,
          },
        ];

  const invoiceStdRows = lineItems.map((line, idx) => {
    const parsedDesc = parseInvoiceLineDescription(line.deskripsi);
    const namaProduk = line.namaProduk?.trim() || parsedDesc.namaProduk;
    return formatStandardDocumentProductRow(
      {
        productId: line.id,
        namaProduk,
        customisasi: line.customisasi,
        material: line.material,
        finishing: line.finishing,
        kodeWarna: line.kodeWarna,
        tambahan: line.tambahan,
        spesifikasiMaterial: line.spesifikasiMaterial?.trim() || parsedDesc.spesifikasiMaterial,
        dimensi: line.dimensi?.trim() || parsedDesc.dimensi,
        jumlah: line.jumlah,
        satuan: line.satuan || 'Unit',
        hargaSatuan: line.hargaSatuan,
        subtotal: line.subtotal,
        linkedProjectProduct: matchLinkedProjectProduct(
          { id: line.id, namaProduk },
          idx,
          linkedProject?.daftarProduk
        ),
      },
      idx
    );
  });

  y = drawFormalGridTable(
    doc,
    STANDARD_DOCUMENT_PRODUCT_TABLE_COLUMNS,
    toStandardProductFormalTableRows(invoiceStdRows),
    y,
    margin,
    bottomLimit,
    { label: 'TOTAL NILAI TAGIHAN KONTRAK', value: formatIdr(invoice.nilaiTotalKontrak), labelSpanCols: 5 }
  );

  const invoiceCostBreakdown = buildCostBreakdownFromInvoice(invoice, linkedProject);
  if (invoiceCostBreakdown) {
    y = drawFormalCostBreakdownTable(
      doc,
      invoiceCostBreakdown,
      y - 6.5,
      margin,
      bottomLimit,
      'TOTAL NILAI TAGIHAN KONTRAK'
    );
  }

  const effectiveInvoiceScheme = resolveEffectivePaymentScheme(
    invoice.skemaPembayaran,
    paymentScheme
  );
  const evaluatedSchedule = evaluateInvoicePaymentSchedule(
    invoice.nilaiTotalKontrak,
    invoice.riwayatPembayaran,
    effectiveInvoiceScheme
  );

  if (evaluatedSchedule.stages.length > 0) {
    y = drawFormalSectionHeading(
      doc,
      'II. Jadwal & Status Termin Pembayaran',
      y,
      margin,
      contentWidth,
      bottomLimit,
      23,
      0
    );
    y = drawFormalGridTable(
      doc,
      [
        { header: 'NO', width: 9, align: 'center' },
        { header: 'TAHAPAN TERMIN', width: 62 },
        { header: 'PORSI', width: 15, align: 'center' },
        { header: 'TARGET NOMINAL', width: 32, align: 'right' },
        { header: 'TERBAYAR', width: 30, align: 'right' },
        { header: 'STATUS', width: 26, align: 'center' },
      ],
      evaluatedSchedule.stages.map((stage, idx) => [
        { text: String(idx + 1) },
        { text: stage.nama, subText: stage.keterangan, bold: true },
        { text: `${stage.persentase}%` },
        { text: formatIdr(stage.targetAmount) },
        { text: formatIdr(stage.paidAmount) },
        { text: stage.status, bold: true },
      ]),
      y,
      margin,
      bottomLimit
    );
  }

  if (invoice.riwayatPembayaran.length > 0) {
    y = drawFormalSectionHeading(
      doc,
      'III. Riwayat Pembayaran Diterima',
      y,
      margin,
      contentWidth,
      bottomLimit,
      23,
      evaluatedSchedule.stages.length === 0 && invoiceCostBreakdown ? 3.5 : 0
    );
    y = drawFormalGridTable(
      doc,
      [
        { header: 'TANGGAL', width: 32 },
        { header: 'URAIAN PEMBAYARAN', width: 76 },
        { header: 'METODE', width: 34 },
        { header: 'NOMINAL DITERIMA', width: 32, align: 'right' },
      ],
      invoice.riwayatPembayaran.map((pay) => [
        { text: formatShortDateId(pay.tanggal) },
        { text: pay.label },
        { text: pay.metodePembayaran },
        { text: formatIdr(pay.nominal), bold: true },
      ]),
      y,
      margin,
      bottomLimit
    );
  }

  y = drawFormalSectionHeading(
    doc,
    'IV. Instruksi Pembayaran & Ketentuan Penagihan',
    y,
    margin,
    contentWidth,
    bottomLimit,
    29
  );

  y = drawFormalBankPaymentCard(
    doc,
    businessConfig,
    y,
    margin,
    contentWidth,
    bottomLimit,
    brandAssets,
    invoice.nomorInvoice
  );

  const invoiceBanksLabel = formatWorkshopBankAccountsText(businessConfig);
  const bankNote =
    invoice.catatanRekening?.trim() ||
    `1. Pembayaran dilakukan melalui transfer ke rekening resmi ${invoiceBanksLabel}.`;
  const confirmNote = `2. Mohon mencantumkan nomor invoice (${invoice.nomorInvoice}) pada berita transfer serta mengirimkan bukti pembayaran resmi melalui WhatsApp ${businessConfig.whatsapp.nomorTampil}.`;
  const noteParts = [bankNote, confirmNote, invoice.catatan.trim() ? `3. Catatan: ${invoice.catatan.trim()}` : null]
    .filter(Boolean)
    .join('\n');

  y = drawParagraphBlock(doc, noteParts, y, margin, contentWidth, bottomLimit, { fontSize: 9 });

  drawFormalSignatures(
    doc,
    [
      {
        roleHeading: 'Diterbitkan Oleh,',
        subRole: 'Keuangan / Pimpinan Workshop',
        signerName: businessConfig.drafPemilik.namaPemilik,
        caption: businessConfig.namaMerek,
        includeCompanyStamp: true,
      },
      {
        roleHeading: 'Mengetahui / Penerima Tagihan,',
        subRole: 'Klien / Pemberi Tugas',
        signerName: invoice.namaKlien,
        caption: invoice.namaProyek,
      },
    ],
    y + 2,
    margin,
    contentWidth,
    bottomLimit,
    `${city}, ${formatShortDateId(invoice.tanggalJatuhTempo)}`,
    brandAssets
  );

  addFormalPageFooters(doc, `${businessConfig.namaMerek} · Invoice Resmi ${invoice.nomorInvoice}`);
  openPdfDocumentInNewTab(doc);
  });
}

// ============================================================================
// 4. BERITA ACARA SERAH TERIMA PEKERJAAN (BAST)
// ============================================================================
export function downloadHandoverPdf(
  bast: HandoverCertificateDocument,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  linkedInvoice?: ProjectInvoice | null,
  linkedProject?: WorkshopProject | null
): Promise<void> {
  return runWithWorkshopBrandAssets((brandAssets) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 18;

  const ensureSpace = (needed: number): number => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = 18;
    }
    return y;
  };

  const paymentSummary = resolveBastPaymentRecordSummary(
    bast,
    linkedInvoice,
    paymentScheme,
    linkedProject
  );

  doc.setProperties({
    title: `${bast.nomorBast} - ${bast.namaProyek}`,
    subject: 'Berita Acara Serah Terima Pekerjaan Resmi',
    author: businessConfig.namaMerek,
  });

  // --------------------------------------------------------------------------
  // HALAMAN 1+: BERITA ACARA SERAH TERIMA (FINAL PASCA TERMIN 4)
  // --------------------------------------------------------------------------
  let y = drawFormalLetterhead(
    doc,
    businessConfig,
    'BERITA ACARA SERAH TERIMA PEKERJAAN',
    bast.nomorBast,
    `${bast.jenisSerahTerima} · ${bast.kotaSerahTerima}, ${formatShortDateId(bast.tanggalSerahTerima)}`,
    brandAssets.logo
  );

  const bastSpksRef = bast.nomorSpksReferensi || bast.nomorSpkReferensi;
  const refs = [
    bast.nomorPenawaranReferensi ? `Penawaran: ${bast.nomorPenawaranReferensi}` : null,
    bastSpksRef ? `SPK: ${bastSpksRef}` : null,
    bast.nomorSuratJalanReferensi ? `Surat Jalan: ${bast.nomorSuratJalanReferensi}` : null,
    bast.nomorInvoiceReferensi ? `Invoice: ${bast.nomorInvoiceReferensi}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  y = drawParagraphBlock(
    doc,
    `Pada hari ini, tanggal ${formatShortDateId(bast.tanggalSerahTerima)}, bertempat di ${bast.kotaSerahTerima}, telah dilaksanakan pemeriksaan fisik serta verifikasi akhir untuk serah terima pekerjaan${refs ? ` (berdasarkan ${refs})` : ''} antara pihak-pihak di bawah ini:`,
    y,
    margin,
    contentWidth,
    bottomLimit
  );

  // PIHAK PERTAMA
  ensureSpace(14);
  if (y > 22) {
    y += 3.5;
  }
  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(9.2);
  doc.text('1. PIHAK PERTAMA (YANG MENYERAHKAN PEKERJAAN)', margin, y);
  y += 4.5;
  y = drawColonMetadataRows(
    doc,
    [
      { label: 'Perusahaan', value: bast.perusahaanPihakPertama, boldValue: true },
      { label: 'Diwakili Oleh', value: `${bast.perwakilanPihakPertama} (${bast.jabatanPihakPertama})` },
      { label: 'Alamat Workshop', value: bast.alamatPihakPertama },
    ],
    y,
    margin + 5,
    30,
    contentWidth - 5,
    bottomLimit
  );

  // PIHAK KEDUA
  ensureSpace(12);
  if (y > 22) {
    y += 1.5;
  }
  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(9.2);
  doc.text('2. PIHAK KEDUA (YANG MENERIMA PEKERJAAN)', margin, y);
  y += 4.5;
  y = drawColonMetadataRows(
    doc,
    [
      { label: 'Nama / Klien', value: bast.namaPihakKedua, boldValue: true },
      { label: 'Jabatan / Peran', value: bast.jabatanPihakKedua },
      { label: 'Telepon / WA', value: formatDocumentPhoneDisplay(bast.teleponPihakKedua) || '-' },
      { label: 'Alamat Lokasi', value: bast.alamatPihakKedua || '-' },
    ],
    y,
    margin + 5,
    30,
    contentWidth - 5,
    bottomLimit
  );

  y = drawFormalSectionHeading(
    doc,
    'I. Rangkuman Proyek, Masa Garansi & Record Pembayaran',
    y,
    margin,
    contentWidth,
    bottomLimit,
    18,
    4.5
  );

  y = drawTwoColumnMetadata(
    doc,
    [
      { label: 'Nama Proyek', value: bast.namaProyek, boldValue: true },
      { label: 'Lokasi Pemasangan', value: bast.lokasiPemasangan || '-' },
      { label: 'Progres Selesai', value: `${bast.persentaseSelesai}% (Final)`, boldValue: true },
    ],
    [
      {
        label: 'Masa Garansi',
        value: `${paymentSummary.warrantyMonths} bulan (mulai ${formatShortDateId(paymentSummary.warrantyStartDate)})`,
        boldValue: true,
      },
      { label: 'Total Nilai Kontrak', value: formatIdr(paymentSummary.contractValue), boldValue: true },
      { label: 'Status Pembayaran', value: 'LUNAS (100% — Pasca Termin 4)', boldValue: true },
    ],
    y,
    margin,
    contentWidth
  );

  if (paymentSummary.records.length > 0) {
    y = drawFormalGridTable(
      doc,
      [
        { header: 'TANGGAL', width: 28 },
        { header: 'RECORD PEMBAYARAN DITERIMA', width: 68 },
        { header: 'METODE / REKENING', width: 44 },
        { header: 'NOMINAL', width: 34, align: 'right' },
      ],
      paymentSummary.records.map((rec) => [
        { text: formatShortDateId(rec.tanggal) },
        { text: rec.label, subText: rec.catatan || undefined, bold: true },
        { text: rec.metodePembayaran },
        { text: formatIdr(rec.nominal), bold: true },
      ]),
      y,
      margin,
      bottomLimit,
      {
        label: 'TOTAL TERBAYAR (LUNAS — PASCA TERMIN 4)',
        value: formatIdr(paymentSummary.totalPaid),
        labelSpanCols: 3,
      }
    );
  }

  y = drawFormalSectionHeading(
    doc,
    'II. Daftar Pemeriksaan Fisik & Serah Terima Unit',
    y,
    margin,
    contentWidth,
    bottomLimit,
    23,
    paymentSummary.records.length > 0 ? 0 : 2.0
  );

  const bastStdRows = bast.daftarItem.map((item, idx) =>
    formatStandardDocumentProductRow(
      {
        productId: item.id,
        namaProduk: item.namaUnit,
        customisasi: item.customisasi,
        material: item.material,
        finishing: item.finishing,
        kodeWarna: item.kodeWarna,
        tambahan: item.tambahan,
        spesifikasiMaterial: item.spesifikasiMaterial?.trim() || item.catatan,
        dimensi: item.dimensi,
        jumlah: item.jumlah,
        satuan: item.satuan || 'Unit',
        hargaSatuan: item.hargaSatuan,
        subtotal: item.subtotal,
        linkedProjectProduct: matchLinkedProjectProduct(
          { id: item.id, namaProduk: item.namaUnit },
          idx,
          linkedProject?.daftarProduk
        ),
      },
      idx
    )
  );
  const bastHasPrices = bastStdRows.some((r) => r.subtotal !== null);
  const bastTotal = bastStdRows.reduce((sum, r) => sum + (r.subtotal ?? 0), 0);

  y = drawFormalGridTable(
    doc,
    STANDARD_DOCUMENT_PRODUCT_TABLE_COLUMNS,
    toStandardProductFormalTableRows(bastStdRows),
    y,
    margin,
    bottomLimit,
    bastHasPrices
      ? {
          label: 'TOTAL NILAI SERAH TERIMA',
          value: formatIdr(bastTotal),
          labelSpanCols: 5,
        }
      : undefined
  );

  y = drawFormalSectionHeading(
    doc,
    'III. Pernyataan Hukum Serah Terima & Ketentuan Garansi',
    y,
    margin,
    contentWidth,
    bottomLimit
  );

  if (bast.teksPernyataan.trim()) {
    y = drawParagraphBlock(doc, bast.teksPernyataan.trim(), y, margin, contentWidth, bottomLimit, {
      fontSize: 9,
    });
  }

  if (bast.catatanTindakLanjut.trim()) {
    y = drawParagraphBlock(
      doc,
      `Catatan Tindak Lanjut & Pemeliharaan: ${bast.catatanTindakLanjut.trim()}`,
      y,
      margin,
      contentWidth,
      bottomLimit,
      { fontStyle: 'italic', fontSize: 8.8 }
    );
  }

  if (y > 22 && (bast.teksPernyataan.trim() || bast.catatanTindakLanjut.trim())) {
    y += 2.0;
  }

  y = drawParagraphBlock(
    doc,
    'Demikian Berita Acara Serah Terima Pekerjaan ini dibuat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya.',
    y,
    margin,
    contentWidth,
    bottomLimit,
    { fontSize: 9 }
  );

  drawFormalSignatures(
    doc,
    [
      {
        roleHeading: 'Yang Menyerahkan (PIHAK PERTAMA),',
        subRole: bast.perusahaanPihakPertama,
        stampNote: '[ Tanda Tangan / Cap Resmi ]',
        signerName: bast.perwakilanPihakPertama,
        caption: `Saksi: ${bast.saksiPihakPertama || '-'}`,
        includeCompanyStamp: true,
      },
      {
        roleHeading: 'Yang Menerima (PIHAK KEDUA),',
        subRole: bast.jabatanPihakKedua,
        stampNote: '[ Tanda Tangan Penerima ]',
        signerName: bast.namaPihakKedua,
        caption: `Saksi: ${bast.saksiPihakKedua || '-'}`,
      },
    ],
    y + 2,
    margin,
    contentWidth,
    bottomLimit,
    `${bast.kotaSerahTerima}, ${formatShortDateId(bast.tanggalSerahTerima)}`,
    brandAssets
  );

  // --------------------------------------------------------------------------
  // HALAMAN LAMPIRAN: DAFTAR PERIKSA KENDALI MUTU (QUALITY CONTROL / QC)
  // --------------------------------------------------------------------------
  doc.addPage();
  let qcY = 18;
  const qcCenterX = pageWidth / 2;

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(...INK_SECONDARY);
  doc.text('LAMPIRAN BERITA ACARA SERAH TERIMA', qcCenterX, qcY, { align: 'center' });
  qcY += 5.2;

  const qcTitle = 'DAFTAR PERIKSA KENDALI MUTU (QUALITY CONTROL / QC)';
  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(11.2);
  doc.setTextColor(...INK_PRIMARY);
  doc.text(qcTitle, qcCenterX, qcY, { align: 'center' });
  const qcTitleW = doc.getTextWidth(qcTitle);
  doc.setDrawColor(...BORDER_DARK);
  doc.setLineWidth(0.35);
  doc.line(qcCenterX - qcTitleW / 2, qcY + 1.2, qcCenterX + qcTitleW / 2, qcY + 1.2);
  qcY += 5.2;

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(...INK_PRIMARY);
  doc.text(`Referensi BAST: ${bast.nomorBast}`, qcCenterX, qcY, { align: 'center' });
  qcY += 3.8;

  doc.setDrawColor(...BORDER_DARK);
  doc.setLineWidth(0.65);
  doc.line(margin, qcY, pageWidth - margin, qcY);
  doc.setLineWidth(0.2);
  doc.line(margin, qcY + 1.0, pageWidth - margin, qcY + 1.0);
  qcY += 6.2;

  qcY = drawTwoColumnMetadata(
    doc,
    [
      { label: 'Nama Proyek', value: bast.namaProyek, boldValue: true },
      { label: 'Lokasi Pemasangan', value: bast.lokasiPemasangan || '-' },
    ],
    [
      { label: 'Klien / Penerima', value: bast.namaPihakKedua, boldValue: true },
      { label: 'Tanggal Pemeriksaan', value: '____ / ____ / ________' },
    ],
    qcY,
    margin,
    contentWidth
  );

  qcY = drawParagraphBlock(
    doc,
    'Petunjuk Pengisian: Lembar lampiran QC ini digunakan untuk pemeriksaan fisik bersama di lokasi. Kolom Lulus / Tidak serta Catatan / Keterangan dikosongkan untuk diisi secara manual setelah dokumen dicetak.',
    qcY,
    margin,
    contentWidth,
    bottomLimit,
    { fontStyle: 'italic', fontSize: 8.4 }
  );
  qcY += 1.5;

  qcY = drawFormalGridTable(
    doc,
    BAST_QC_TABLE_COLUMNS,
    buildBastQcTableRows(),
    qcY,
    margin,
    bottomLimit,
    undefined,
    {
      showColumnBorders: true,
      preserveEmptyCells: true,
      minRowHeightMm: 14,
    }
  );

  drawFormalSignatures(
    doc,
    [
      {
        roleHeading: 'Diperiksa Oleh (Tim QC),',
        subRole: bast.perusahaanPihakPertama || businessConfig.namaMerek,
        stampNote: '[ Tanda Tangan Pemeriksa ]',
        signerName: '____________________',
        caption: 'Tanggal: ____ / ____ / ________',
        includeCompanyStamp: false,
      },
      {
        roleHeading: 'Mengetahui (Klien / Penerima),',
        subRole: bast.jabatanPihakKedua || 'Pemilik / Penerima Pekerjaan',
        stampNote: '[ Tanda Tangan Penerima ]',
        signerName: bast.namaPihakKedua || '____________________',
        caption: 'Tanggal: ____ / ____ / ________',
        includeCompanyStamp: false,
      },
    ],
    qcY,
    margin,
    contentWidth,
    bottomLimit,
    undefined,
    brandAssets
  );

  addFormalPageFooters(doc, `${businessConfig.namaMerek} · BAST ${bast.nomorBast}`);
  openPdfDocumentInNewTab(doc);
  });
}

export interface BastQcChecklistItem {
  title: string;
  indicator: string;
}

export const BAST_QC_DEFAULT_ITEMS: readonly BastQcChecklistItem[] = [
  {
    title: 'Dimensi & Kesesuaian Desain',
    indicator: 'Ukuran panjang, lebar, tinggi, serta tata letak modul sesuai gambar kerja dan kesepakatan kontrak.',
  },
  {
    title: 'Struktur & Konstruksi Rangka',
    indicator: 'Rangka kokoh, sambungan rapat dan presisi, tidak goyang, serta dudukan/penopang terpasang kuat.',
  },
  {
    title: 'Permukaan & Finishing',
    indicator: 'Permukaan finishing rata, bersih dari goresan, gelembung, atau noda lem, serta warna seragam.',
  },
  {
    title: 'Edging & Nat Sambungan',
    indicator: 'Tepi panel menempel rapi tanpa celah tajam dan pertemuan nat antarmodul lurus serta rapat.',
  },
  {
    title: 'Hardware & Aksesoris',
    indicator: 'Engsel, rel laci, handle, kunci, dan aksesoris terpasang lengkap, lurus, dan bebas cacat.',
  },
  {
    title: 'Fungsi Pintu, Laci & Bukaan',
    indicator: 'Seluruh pintu dan laci dapat dibuka-tutup dengan halus, sejajar (simetris), serta tidak macet.',
  },
  {
    title: 'Pemasangan, Leveling & Utilitas',
    indicator: 'Unit terpasang rata air (level), siku terhadap dinding/lantai, serta bukaan kabel atau pipa rapi.',
  },
  {
    title: 'Kebersihan & Kesiapan Pakai',
    indicator: 'Seluruh unit dan area pemasangan bebas debu/sisa material serta siap digunakan dengan baik.',
  },
];

export const BAST_QC_TABLE_COLUMNS: readonly FormalTableColumn[] = [
  { header: 'NO', width: 9, align: 'center' },
  { header: 'JUDUL / ASPEK QC', width: 42 },
  { header: 'INDIKATOR PEMERIKSAAN UMUM', width: 61 },
  { header: 'LULUS / TIDAK', width: 24, align: 'center' },
  { header: 'CATATAN / KETERANGAN', width: 38 },
];

export function buildBastQcTableRows(
  items: readonly BastQcChecklistItem[] = BAST_QC_DEFAULT_ITEMS
): FormalTableCell[][] {
  return items.map((item, idx) => [
    { text: String(idx + 1) },
    { text: item.title, bold: true },
    { text: item.indicator },
    { text: '' },
    { text: '' },
  ]);
}

// ============================================================================
// 5. SURAT PENAWARAN HARGA (QUOTATION)
// ============================================================================
export interface QuotationDocumentHeaderContent {
  cityDateLine: string;
  subjectRow: KeyValuePair;
  recipientSalutation: string;
  recipientName: string;
  recipientAddress: string;
  openingText: string;
}

export function buildQuotationDocumentContent(
  quo: QuotationDocument,
  businessConfig: BusinessConfig
): QuotationDocumentHeaderContent {
  const city = resolveCityName(businessConfig);
  return {
    cityDateLine: `${city}, ${formatLongDateId(quo.tanggalPenawaran)}`,
    subjectRow: {
      label: 'Perihal',
      value: `Penawaran Harga ${quo.namaProyek}`,
      boldValue: true,
    },
    recipientSalutation: 'Kepada Yth.',
    recipientName: quo.namaKlien || '-',
    recipientAddress: quo.alamatLokasi || '-',
    openingText: `Dengan hormat,\nBersama surat ini kami dari ${businessConfig.namaMerek} mengajukan penawaran harga resmi beserta rincian spesifikasi material untuk pelaksanaan pekerjaan "${quo.namaProyek}" di ${quo.alamatLokasi || '-'} dengan estimasi durasi pengerjaan selama ${quo.estimasiDurasiHari} hari kerja efektif dan masa berlaku penawaran hingga ${formatLongDateId(quo.berlakuHingga)} sebagai berikut:`,
  };
}

export function downloadQuotationPdf(
  quo: QuotationDocument,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  linkedProject?: WorkshopProject | null
): Promise<void> {
  return runWithWorkshopBrandAssets((brandAssets) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 18;

  const quotationContent = buildQuotationDocumentContent(quo, businessConfig);
  const grandTotal = quo.daftarItem.reduce(
    (sum, item) => sum + Math.max(1, item.jumlah || 1) * Math.max(0, item.hargaSatuan || 0),
    0
  );

  doc.setProperties({
    title: `${quo.nomorPenawaran} - ${quo.namaProyek}`,
    subject: 'Surat Penawaran Harga Resmi',
    author: businessConfig.namaMerek,
  });

  let y = drawFormalLetterhead(
    doc,
    businessConfig,
    'SURAT PENAWARAN HARGA',
    quo.nomorPenawaran,
    undefined,
    brandAssets.logo
  );

  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(...INK_PRIMARY);
  doc.text(quotationContent.cityDateLine, margin + contentWidth, y, { align: 'right' });
  y += 6.5;

  y = drawColonMetadataRows(
    doc,
    [quotationContent.subjectRow],
    y,
    margin,
    18,
    contentWidth
  );
  y += 2.5;

  const recipientMaxW = Math.min(contentWidth, 110);
  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(...INK_PRIMARY);
  doc.text(quotationContent.recipientSalutation, margin, y);
  y += 4.3;

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(...INK_PRIMARY);
  const recipientNameLines = doc.splitTextToSize(
    quotationContent.recipientName,
    recipientMaxW
  ) as string[];
  doc.text(recipientNameLines, margin, y);
  y += recipientNameLines.length * 4.3;

  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(...INK_SECONDARY);
  const recipientAddressLines = doc.splitTextToSize(
    quotationContent.recipientAddress,
    recipientMaxW
  ) as string[];
  doc.text(recipientAddressLines, margin, y);
  y += recipientAddressLines.length * 4.3 + 4;

  y = drawParagraphBlock(
    doc,
    quotationContent.openingText,
    y,
    margin,
    contentWidth,
    bottomLimit
  );

  y = drawFormalSectionHeading(
    doc,
    'I. Rincian Pekerjaan & Harga (Bill of Quantities)',
    y,
    margin,
    contentWidth,
    bottomLimit,
    23,
    4.5
  );

  const quotationStdRows = quo.daftarItem.map((item, idx) =>
    formatStandardDocumentProductRow(
      {
        productId: item.id,
        namaProduk: item.namaItem,
        customisasi: item.customisasi,
        material: item.material,
        finishing: item.finishing,
        kodeWarna: item.kodeWarna,
        tambahan: item.tambahan,
        spesifikasiMaterial: item.spesifikasiMaterial,
        dimensi: item.dimensi,
        jumlah: item.jumlah,
        satuan: item.satuan,
        hargaSatuan: item.hargaSatuan,
        linkedProjectProduct: matchLinkedProjectProduct(
          { id: item.id, namaProduk: item.namaItem },
          idx,
          linkedProject?.daftarProduk
        ),
      },
      idx
    )
  );

  y = drawFormalGridTable(
    doc,
    STANDARD_DOCUMENT_PRODUCT_TABLE_COLUMNS,
    toStandardProductFormalTableRows(quotationStdRows),
    y,
    margin,
    bottomLimit,
    { label: 'TOTAL HARGA PENAWARAN', value: formatIdr(grandTotal), labelSpanCols: 5 }
  );

  const quotationCostBreakdown = buildCostBreakdownFromQuotation(quo, linkedProject);
  if (quotationCostBreakdown) {
    y = drawFormalCostBreakdownTable(
      doc,
      quotationCostBreakdown,
      y - 6.5,
      margin,
      bottomLimit,
      'TOTAL HARGA PENAWARAN'
    );
  }

  const effectiveScheme = resolveEffectivePaymentScheme(
    quo.tahapanPembayaran,
    paymentScheme,
    quo.catatanPembayaran
  );
  const breakdown = calculatePaymentSchemeBreakdown(grandTotal, effectiveScheme);

  y = drawFormalSectionHeading(
    doc,
    'II. Ketentuan & Jadwal Pembayaran Termin',
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
      { header: 'TAHAPAN PEMBAYARAN', width: 46 },
      { header: 'PORSI', width: 16, align: 'center' },
      { header: 'NOMINAL', width: 32, align: 'right' },
      { header: 'KETERANGAN / TRIGGER PENAGIHAN', width: 71 },
    ],
    breakdown.map((st, idx) => [
      { text: String(idx + 1) },
      { text: st.nama, bold: true },
      { text: `${st.persentase}%` },
      { text: st.amount !== null ? formatIdr(st.amount) : '-', bold: true },
      { text: st.keterangan },
    ]),
    y,
    margin,
    bottomLimit
  );

  y = drawFormalBankPaymentCard(
    doc,
    businessConfig,
    y - 3,
    margin,
    contentWidth,
    bottomLimit,
    brandAssets,
    quo.nomorPenawaran
  );

  const sanitizedQuotationNote = sanitizeQuotationTechnicalNote(quo.catatanTambahan);
  if (quo.syaratKetentuan.trim() || sanitizedQuotationNote) {
    y = drawFormalSectionHeading(
      doc,
      'III. Syarat & Ketentuan Penawaran',
      y,
      margin,
      contentWidth,
      bottomLimit,
      14,
      4.0
    );
    if (quo.syaratKetentuan.trim()) {
      y = drawParagraphBlock(doc, quo.syaratKetentuan.trim(), y, margin, contentWidth, bottomLimit, {
        fontSize: 9,
      });
    }
    if (sanitizedQuotationNote) {
      y = drawParagraphBlock(
        doc,
        `Catatan Teknis Tambahan: ${sanitizedQuotationNote}`,
        y,
        margin,
        contentWidth,
        bottomLimit,
        { fontStyle: 'italic', fontSize: 8.8 }
      );
    }
    if (y > 22) {
      y += 2.5;
    }
  }

  y = drawParagraphBlock(
    doc,
    'Demikian surat penawaran harga ini kami sampaikan. Apabila penawaran ini disetujui, mohon menandatangani kolom persetujuan di bawah ini sebagai dasar penerbitan Surat Perjanjian Kerja (SPK). Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.',
    y,
    margin,
    contentWidth,
    bottomLimit
  );

  drawFormalSignatures(
    doc,
    [
      {
        roleHeading: 'Hormat Kami,',
        subRole: businessConfig.namaMerek,
        signerName: quo.disusunOleh || businessConfig.drafPemilik.namaPemilik,
        caption: businessConfig.drafPemilik.jabatanPemilik,
        includeCompanyStamp: true,
      },
      {
        roleHeading: 'Disetujui Oleh Klien,',
        subRole: 'Pemberi Tugas',
        signerName: quo.namaKlien,
        caption: 'Tanggal Persetujuan: ____ / ____ / ________',
      },
    ],
    y + 2,
    margin,
    contentWidth,
    bottomLimit,
    quotationContent.cityDateLine,
    brandAssets
  );

  addFormalPageFooters(doc, `${businessConfig.namaMerek} · Surat Penawaran ${quo.nomorPenawaran}`);
  openPdfDocumentInNewTab(doc);
  });
}

// ============================================================================
// 6. SURAT JALAN PENGIRIMAN & INSTALASI (DELIVERY ORDER)
// ============================================================================
export interface DeliveryOrderSignatureSlot {
  roleHeading: string;
  subRole: string;
  stampNote: string;
  includeCompanyStamp: boolean;
  dateLine: string;
}

export interface DeliveryOrderDocumentContent {
  totalUnits: number;
  leftMeta: KeyValuePair[];
  rightMeta: KeyValuePair[];
  openingText: string;
  termsText: string;
  deliveryStage: {
    heading: string;
    subtitle: string;
    slots: [DeliveryOrderSignatureSlot, DeliveryOrderSignatureSlot];
  };
  archiveStage: {
    heading: string;
    subtitle: string;
    slot: DeliveryOrderSignatureSlot;
  };
}

export function buildDeliveryOrderDocumentContent(
  sj: DeliveryOrderDocument,
  businessConfig: BusinessConfig
): DeliveryOrderDocumentContent {
  const totalUnits = sj.daftarItem.reduce(
    (sum, item) => sum + Math.max(1, Math.round(item.jumlahUnit || 1)),
    0
  );
  const sjClientPhone = formatDocumentPhoneDisplay(sj.teleponKlien);

  const leftMeta: KeyValuePair[] = [
    { label: 'Nama Proyek', value: sj.namaProyek || '-', boldValue: true },
    { label: 'Alamat Tujuan', value: sj.alamatTujuan || '-' },
    { label: 'Telepon Tujuan', value: sjClientPhone || '-' },
  ];

  const rightMeta: KeyValuePair[] = [
    { label: 'Tanggal Kirim', value: formatShortDateId(sj.tanggalKirim) },
    {
      label: 'Penanggung Jawab',
      value: sj.penanggungJawabPengirimanInstalasi?.trim() || '-',
    },
    { label: 'Total Muatan', value: `${totalUnits} unit (${sj.daftarItem.length} item)`, boldValue: true },
  ];

  const openingText =
    'Dokumen Surat Jalan ini diterbitkan untuk memastikan seluruh rincian barang, dimensi, spesifikasi, serta jumlah unit yang dikirimkan telah sesuai, lengkap, dan dinyatakan benar serta sampai di lokasi tujuan.';

  const fallbackTerms = [
    '1. Pemeriksaan Detail Barang Saat Pengiriman (Barang Datang): Seluruh rincian barang, dimensi, spesifikasi, jumlah unit, dan kondisi fisik wajib diperiksa bersama di lokasi untuk memastikan setiap item benar dan telah sampai lengkap sebelum ditandatangani oleh Owner dan Klien.',
    '2. Pencatatan Selisih / Cacat Kirim: Apabila ditemukan ketidaksesuaian spesifikasi, jumlah, atau kerusakan selama pengangkutan, wajib dicatat langsung pada kolom kondisi sebelum penandatanganan penerimaan barang.',
    '3. Verifikasi Ulang Setelah Instalasi Selesai (Arsip): Setelah seluruh unit terpasang dengan baik di lokasi, Klien menandatangani kolom verifikasi ulang (tanda tangan ke-3) pada Surat Jalan ini sebelum salinan resmi diarsipkan.',
  ].join('\n');

  const termsText = sj.instruksiPemasangan?.trim() || fallbackTerms;

  return {
    totalUnits,
    leftMeta,
    rightMeta,
    openingText,
    termsText,
    deliveryStage: {
      heading: 'SAAT PENGIRIMAN (BARANG DATANG)',
      subtitle: 'Detail barang benar & sampai di lokasi',
      slots: [
        {
          roleHeading: 'Owner',
          subRole: businessConfig.namaMerek,
          stampNote: '[ Tanda Tangan & Cap ]',
          includeCompanyStamp: true,
          dateLine: 'Tgl: ____ / ____ / ________',
        },
        {
          roleHeading: 'Klien',
          subRole: 'Penerima Barang Datang',
          stampNote: '[ Tanda Tangan Klien ]',
          includeCompanyStamp: false,
          dateLine: 'Tgl: ____ / ____ / ________',
        },
      ],
    },
    archiveStage: {
      heading: 'SETELAH INSTALASI SELESAI (ARSIP)',
      subtitle: 'Verifikasi ulang Klien untuk arsip',
      slot: {
        roleHeading: 'Klien',
        subRole: 'Verifikasi Ulang Pasca Pasang',
        stampNote: '[ Tanda Tangan Klien ]',
        includeCompanyStamp: false,
        dateLine: 'Tgl: ____ / ____ / ________',
      },
    },
  };
}

function drawDeliveryOrderThreeStageSignatures(
  doc: jsPDF,
  content: DeliveryOrderDocumentContent,
  startY: number,
  margin: number,
  contentWidth: number,
  bottomLimit: number,
  cityDateLine: string,
  brandAssets: WorkshopBrandPdfAssets | null = getCachedWorkshopBrandPdfAssets()
): number {
  const blockNeeded = 56;
  let y = startY;
  if (y + blockNeeded > bottomLimit) {
    doc.addPage();
    y = 18;
  }

  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK_PRIMARY);
  doc.text(cityDateLine, margin + contentWidth / 2, y, { align: 'center' });
  y += 4.5;

  const colWidth = contentWidth / 3;
  const stageHeaderH = 10.5;
  const boxHeight = 36;

  // Stage group headers (left 2 columns = Saat Pengiriman, right 1 column = Setelah Instalasi Selesai)
  doc.setFillColor(...TABLE_HEADER_BG);
  doc.setDrawColor(...TABLE_HEADER_DIVIDER);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, colWidth * 2, stageHeaderH, 'FD');
  doc.rect(margin + colWidth * 2, y, colWidth, stageHeaderH, 'FD');

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(...TABLE_HEADER_TEXT);
  doc.text(content.deliveryStage.heading, margin + colWidth, y + 4.3, { align: 'center' });
  doc.text(content.archiveStage.heading, margin + colWidth * 2 + colWidth / 2, y + 4.3, {
    align: 'center',
  });

  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(7.1);
  doc.setTextColor(225, 224, 220);
  doc.text(content.deliveryStage.subtitle, margin + colWidth, y + 8.3, { align: 'center' });
  doc.text(content.archiveStage.subtitle, margin + colWidth * 2 + colWidth / 2, y + 8.3, {
    align: 'center',
  });

  y += stageHeaderH;

  const allSlots: DeliveryOrderSignatureSlot[] = [
    content.deliveryStage.slots[0],
    content.deliveryStage.slots[1],
    content.archiveStage.slot,
  ];

  allSlots.forEach((slot, idx) => {
    const boxX = margin + colWidth * idx;
    const centerX = boxX + colWidth / 2;

    doc.setDrawColor(...TABLE_BORDER_OUTER);
    doc.setLineWidth(0.2);
    doc.rect(boxX, y, colWidth, boxHeight, 'S');

    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(...INK_PRIMARY);
    doc.text(slot.roleHeading, centerX, y + 5, { align: 'center' });

    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(...INK_SECONDARY);
    doc.text(slot.subRole, centerX, y + 8.8, { align: 'center', maxWidth: colWidth - 4 });

    const stampImg = slot.includeCompanyStamp ? brandAssets?.companyStamp ?? null : null;
    if (stampImg) {
      const { width: stampW, height: stampH } = fitImageInBox(
        stampImg.width,
        stampImg.height,
        Math.min(28, colWidth * 0.52),
        8.5
      );
      doc.addImage(
        stampImg.dataUrl,
        'PNG',
        centerX - stampW / 2,
        y + 18 - stampH / 2,
        stampW,
        stampH
      );
    } else {
      doc.setFont(FONT_FAMILY, 'italic');
      doc.setFontSize(7.2);
      doc.setTextColor(...INK_MUTED);
      doc.text(slot.stampNote, centerX, y + 18, { align: 'center' });
    }

    const lineY = y + 27.5;
    doc.setDrawColor(...BORDER_DARK);
    doc.setLineWidth(0.25);
    doc.line(centerX - 18, lineY, centerX + 18, lineY);

    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...INK_SECONDARY);
    doc.text(slot.dateLine, centerX, lineY + 4.5, { align: 'center' });
  });

  return y + boxHeight + 4;
}

export function downloadDeliveryOrderPdf(
  sj: DeliveryOrderDocument,
  businessConfig: BusinessConfig,
  linkedProject?: WorkshopProject | null
): Promise<void> {
  return runWithWorkshopBrandAssets((brandAssets) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 18;

  const city = resolveCityName(businessConfig);
  const content = buildDeliveryOrderDocumentContent(sj, businessConfig);

  doc.setProperties({
    title: `${sj.nomorSuratJalan} - ${sj.namaProyek}`,
    subject: 'Surat Jalan Pengiriman & Verifikasi Barang',
    author: businessConfig.namaMerek,
  });

  let y = drawFormalLetterhead(
    doc,
    businessConfig,
    'SURAT JALAN PENGIRIMAN & INSTALASI',
    sj.nomorSuratJalan,
    undefined,
    brandAssets.logo
  );

  y = drawTwoColumnMetadata(
    doc,
    content.leftMeta,
    content.rightMeta,
    y,
    margin,
    contentWidth
  );

  y = drawParagraphBlock(
    doc,
    content.openingText,
    y,
    margin,
    contentWidth,
    bottomLimit
  );

  y = drawFormalSectionHeading(
    doc,
    'I. Daftar Detail Barang & Pemeriksaan Kelengkapan',
    y,
    margin,
    contentWidth,
    bottomLimit,
    23,
    4.5
  );

  const sjStdRows = sj.daftarItem.map((item, idx) =>
    formatStandardDocumentProductRow(
      {
        productId: item.id,
        namaProduk: item.namaBarang,
        customisasi: item.customisasi,
        material: item.material,
        finishing: item.finishing,
        kodeWarna: item.kodeWarna,
        tambahan: item.tambahan,
        spesifikasiMaterial: item.spesifikasiMaterial?.trim() || item.catatanPemasangan,
        dimensi: item.dimensi,
        jumlah: item.jumlahUnit,
        satuan: item.satuan || 'Unit',
        hargaSatuan: item.hargaSatuan,
        subtotal: item.subtotal,
        linkedProjectProduct: matchLinkedProjectProduct(
          { id: item.id, namaProduk: item.namaBarang },
          idx,
          linkedProject?.daftarProduk
        ),
      },
      idx
    )
  );
  const sjHasPrices = sjStdRows.some((r) => r.subtotal !== null);
  const sjTotalPrice = sjStdRows.reduce((sum, r) => sum + (r.subtotal ?? 0), 0);

  y = drawFormalGridTable(
    doc,
    STANDARD_DOCUMENT_PRODUCT_TABLE_COLUMNS,
    toStandardProductFormalTableRows(sjStdRows),
    y,
    margin,
    bottomLimit,
    sjHasPrices
      ? {
          label: `TOTAL MUATAN (${content.totalUnits} UNIT)`,
          value: formatIdr(sjTotalPrice),
          labelSpanCols: 5,
        }
      : {
          label: 'TOTAL MUATAN PENGIRIMAN',
          value: `${content.totalUnits} Unit (${sj.daftarItem.length} Item)`,
          labelSpanCols: 5,
        }
  );

  if (content.termsText) {
    y = drawFormalSectionHeading(
      doc,
      'II. Ketentuan Pemeriksaan & Pengesahan 3 Tanda Tangan',
      y,
      margin,
      contentWidth,
      bottomLimit
    );
    y = drawParagraphBlock(doc, content.termsText, y, margin, contentWidth, bottomLimit, {
      fontSize: 9,
    });
  }

  drawDeliveryOrderThreeStageSignatures(
    doc,
    content,
    y + 2,
    margin,
    contentWidth,
    bottomLimit,
    `${city}, ${formatShortDateId(sj.tanggalKirim)}`,
    brandAssets
  );

  addFormalPageFooters(doc, `${businessConfig.namaMerek} · Surat Jalan ${sj.nomorSuratJalan}`);
  openPdfDocumentInNewTab(doc);
  });
}

// ============================================================================
// 7. SURAT TAGIHAN TERMIN PEMBAYARAN (TERMIN 1 - 4)
// ============================================================================
export function downloadTerminInvoicePdf(
  invoice: ProjectInvoice,
  stageIndex: number,
  businessConfig: BusinessConfig,
  paymentScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  linkedRefs?: { quotationNumber?: string; deliveryOrderNumber?: string; handoverNumber?: string }
): Promise<void> {
  const effectiveScheme = resolveEffectivePaymentScheme(invoice.skemaPembayaran, paymentScheme);
  const schedule = evaluateInvoicePaymentSchedule(
    invoice.nilaiTotalKontrak,
    invoice.riwayatPembayaran,
    effectiveScheme
  );
  const stage = schedule.stages[stageIndex] ?? schedule.stages[0];
  if (!stage) {
    return downloadProjectInvoicePdf(invoice, businessConfig, paymentScheme);
  }

  return runWithWorkshopBrandAssets((brandAssets) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 18;

  const city = resolveCityName(businessConfig);
  const terminCode = formatTerminDocumentNumber(invoice.nomorInvoice, stageIndex);
  const billingDocNames = [
    'SURAT TAGIHAN TERMIN 1 (DP / DOWN PAYMENT)',
    'SURAT TAGIHAN TERMIN 2 (PROGRESS PRODUKSI)',
    'SURAT TAGIHAN TERMIN 3 (PRA-INSTALASI / PENGIRIMAN)',
    'SURAT TAGIHAN TERMIN 4 (PELUNASAN / SERAH TERIMA)',
  ];
  const heading = billingDocNames[stageIndex] ?? `SURAT TAGIHAN ${stage.nama.toUpperCase()}`;
  const terminDueDate = invoice.tanggalTermin?.[stageIndex] || invoice.tanggalJatuhTempo;

  doc.setProperties({
    title: `${terminCode} - ${invoice.namaProyek}`,
    subject: heading,
    author: businessConfig.namaMerek,
  });

  let y = drawFormalLetterhead(
    doc,
    businessConfig,
    heading,
    terminCode,
    `Jatuh Tempo: ${formatShortDateId(terminDueDate)}`,
    brandAssets.logo
  );

  y = drawTwoColumnMetadata(
    doc,
    [
      { label: 'Ditagihkan Kepada', value: invoice.namaKlien, boldValue: true },
      { label: 'Nama Proyek', value: invoice.namaProyek },
      { label: 'Lokasi Pekerjaan', value: invoice.lokasi || '-' },
      { label: 'Induk Invoice', value: invoice.nomorInvoice },
    ],
    [
      { label: 'Total Nilai Kontrak', value: formatIdr(invoice.nilaiTotalKontrak) },
      { label: 'Porsi Tagihan', value: `${stage.persentase}% (${formatIdr(stage.targetAmount)})` },
      { label: 'Jatuh Tempo Termin', value: formatShortDateId(terminDueDate) },
      {
        label: stage.remainingAmount === 0 ? 'Status Pembayaran' : 'Nominal Jatuh Tagih',
        value:
          stage.remainingAmount === 0
            ? `LUNAS (${formatIdr(stage.paidAmount)})`
            : formatIdr(stage.remainingAmount),
        boldValue: true,
      },
    ],
    y,
    margin,
    contentWidth
  );

  const refLine = [
    linkedRefs?.quotationNumber ? `Penawaran: ${linkedRefs.quotationNumber}` : null,
    invoice.nomorSpkReferensi ? `SPK: ${invoice.nomorSpkReferensi}` : null,
    linkedRefs?.deliveryOrderNumber ? `Surat Jalan: ${linkedRefs.deliveryOrderNumber}` : null,
    linkedRefs?.handoverNumber || invoice.nomorBastReferensi
      ? `BAST: ${linkedRefs?.handoverNumber || invoice.nomorBastReferensi}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  y = drawParagraphBlock(
    doc,
    `Dengan hormat,\nBersama surat ini kami sampaikan tagihan resmi ${stage.nama} (${stage.persentase}%) atas pekerjaan "${invoice.namaProyek}". Dasar penerbitan tagihan ini adalah: ${stage.keterangan}.${refLine ? ` (Dokumen Acuan: ${refLine}).` : ''}`,
    y,
    margin,
    contentWidth,
    bottomLimit
  );

  y = drawFormalSectionHeading(
    doc,
    'I. Rincian Tagihan Termin & Rekapitulasi Kontrak',
    y,
    margin,
    contentWidth,
    bottomLimit,
    23,
    4.5
  );

  y = drawFormalGridTable(
    doc,
    [
      { header: 'NO', width: 9, align: 'center' },
      { header: 'TAHAPAN TERMIN KONTRAK', width: 63 },
      { header: 'PORSI', width: 15, align: 'center' },
      { header: 'TARGET NOMINAL', width: 32, align: 'right' },
      { header: 'TERBAYAR', width: 29, align: 'right' },
      { header: 'STATUS', width: 26, align: 'center' },
    ],
    schedule.stages.map((st, idx) => {
      const isCurrent = idx === stageIndex;
      return [
        { text: String(idx + 1), bold: isCurrent },
        { text: isCurrent ? `${st.nama} [TAGIHAN INI]` : st.nama, bold: isCurrent },
        { text: `${st.persentase}%`, bold: isCurrent },
        { text: formatIdr(st.targetAmount), bold: isCurrent },
        { text: formatIdr(st.paidAmount), bold: isCurrent },
        { text: st.status, bold: true },
      ];
    }),
    y,
    margin,
    bottomLimit,
    {
      label: stage.remainingAmount === 0 ? 'NOMINAL SUDAH LUNAS' : 'TOTAL TAGIHAN TERMIN INI',
      value: formatIdr(stage.remainingAmount === 0 ? stage.paidAmount : stage.remainingAmount),
      labelSpanCols: 5,
    }
  );

  y = drawFormalSectionHeading(
    doc,
    'II. Instruksi Pembayaran & Konfirmasi',
    y,
    margin,
    contentWidth,
    bottomLimit,
    29
  );

  y = drawFormalBankPaymentCard(
    doc,
    businessConfig,
    y,
    margin,
    contentWidth,
    bottomLimit,
    brandAssets,
    terminCode
  );

  const terminBanksLabel = formatWorkshopBankAccountsText(businessConfig);
  const bankNote =
    invoice.catatanRekening?.trim() ||
    `1. Mohon melakukan pembayaran sesuai nominal tagihan termin ini ke rekening resmi ${terminBanksLabel}.`;
  const confirmNote = `2. Mohon cantumkan nomor tagihan (${terminCode}) pada keterangan transfer dan kirimkan bukti transfer melalui WhatsApp ${businessConfig.whatsapp.nomorTampil}.`;
  y = drawParagraphBlock(doc, `${bankNote}\n${confirmNote}`, y, margin, contentWidth, bottomLimit, {
    fontSize: 9,
  });

  drawFormalSignatures(
    doc,
    [
      {
        roleHeading: 'Diterbitkan Oleh,',
        subRole: 'Keuangan / Pimpinan Workshop',
        signerName: businessConfig.drafPemilik.namaPemilik,
        caption: businessConfig.namaMerek,
        includeCompanyStamp: true,
      },
      {
        roleHeading: 'Diterima Oleh Klien,',
        subRole: 'Pemberi Tugas',
        signerName: invoice.namaKlien,
        caption: invoice.namaProyek,
      },
    ],
    y + 2,
    margin,
    contentWidth,
    bottomLimit,
    `${city}, ${formatShortDateId(terminDueDate)}`,
    brandAssets
  );

  addFormalPageFooters(doc, `${businessConfig.namaMerek} · Surat Tagihan ${terminCode}`);
  openPdfDocumentInNewTab(doc);
  });
}
