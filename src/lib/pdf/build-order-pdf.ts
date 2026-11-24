import { jsPDF } from 'jspdf';
import {
  prepareProductImageForPdf,
  renderColorSwatchForPdf,
  type PreparedPdfImage,
} from './image-prep';
import type { OrderPdfDataModel } from './order-pdf-data';

export interface BuiltOrderPdfResult {
  doc: jsPDF;
  arrayBuffer: ArrayBuffer;
  blob: Blob;
  file: File;
  filename: string;
  totalPages: number;
}

export async function buildOrderSummaryPdf(
  model: OrderPdfDataModel
): Promise<BuiltOrderPdfResult> {
  // 1. Preload & normalize item thumbnails / color swatches before drawing PDF
  const itemImages: Array<PreparedPdfImage | null> = await Promise.all(
    model.items.map((item) => {
      if (item.imageUrl) {
        return prepareProductImageForPdf(item.imageUrl, 480, 0.82);
      }
      if (item.swatchHex) {
        return Promise.resolve(renderColorSwatchForPdf(item.swatchHex));
      }
      return Promise.resolve(null);
    })
  );

  // 2. Initialize A4 document in physical millimeter units (210 x 297 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  doc.setProperties({
    title: `${model.documentTitle} - ${model.referenceCode}`,
    subject: model.documentTitle,
    author: model.brandName,
    creator: 'Shansus Dzar Indonesia',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const margin = 15;
  const contentWidth = pageWidth - margin * 2; // 180 mm
  const footerSafeBottom = pageHeight - 17;

  let y = margin;

  // Table column coordinates within 180 mm content area
  const col = {
    imgX: margin,
    imgW: 18,
    infoX: margin + 22,
    infoW: 84,
    qtyRightX: margin + 120,
    unitPriceRightX: margin + 150,
    totalRightX: margin + contentWidth, // margin + 180
  };

  const drawTableHeader = () => {
    doc.setFillColor(39, 39, 42); // Neutral charcoal #27272A
    doc.rect(margin, y, contentWidth, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(250, 249, 247);

    doc.text('ITEM & SPESIFIKASI', col.imgX + 2, y + 5.2);
    doc.text('JML', col.qtyRightX - 2, y + 5.2, { align: 'right' });
    doc.text('SATUAN', col.unitPriceRightX - 2, y + 5.2, { align: 'right' });
    doc.text('SUBTOTAL', col.totalRightX - 2, y + 5.2, { align: 'right' });

    y += 10;
  };

  const ensureSpace = (neededHeight: number, repeatTableHeader = false) => {
    if (y + neededHeight > footerSafeBottom) {
      doc.addPage();
      y = margin;
      if (repeatTableHeader) {
        drawTableHeader();
      }
    }
  };

  // --------------------------------------------------------------------------
  // HEADER BRAND & DRAF REFERENCE
  // --------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(37, 35, 33); // #252321
  const brandLines = doc.splitTextToSize(model.brandName, 102);
  doc.text(brandLines, margin, y + 4.5);

  let leftHeaderY = y + 4.5 + brandLines.length * 5.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(102, 98, 94); // #66625E
  const brandAddrLines = doc.splitTextToSize(model.brandAddress, 102);
  doc.text(brandAddrLines, margin, leftHeaderY);
  leftHeaderY += brandAddrLines.length * 3.8;
  doc.text(`WhatsApp: ${model.brandWhatsApp}`, margin, leftHeaderY);
  leftHeaderY += 4;

  // Right side: Document Type + Draft Reference + Indonesian Timestamp
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(73, 70, 65);
  doc.text('RINGKASAN PERMINTAAN', pageWidth - margin, y + 4.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(37, 35, 33);
  doc.text(model.referenceCode, pageWidth - margin, y + 10, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(102, 98, 94);
  doc.text(model.formattedDateTime, pageWidth - margin, y + 14.5, { align: 'right' });
  doc.text('Ringkasan Pesanan (Menunggu Konfirmasi)', pageWidth - margin, y + 18.5, {
    align: 'right',
  });

  y = Math.max(leftHeaderY, y + 21) + 3;

  doc.setDrawColor(226, 223, 218); // #E2DFDA
  doc.setLineWidth(0.35);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Document full title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(37, 35, 33);
  doc.text(model.documentTitle, margin, y);
  y += 4.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(102, 98, 94);
  doc.text(model.referenceLabel, margin, y);
  y += 6;

  // --------------------------------------------------------------------------
  // CUSTOMER BLOCK
  // --------------------------------------------------------------------------
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const custAddrLines = doc.splitTextToSize(model.customer.address, contentWidth - 8);
  const custNotesLines = model.customer.notes
    ? doc.splitTextToSize(`Catatan pemesan: ${model.customer.notes}`, contentWidth - 8)
    : [];

  const custBoxHeight =
    15 +
    custAddrLines.length * 3.8 +
    (model.customer.coordinatesLabel ? 4.2 : 0) +
    (custNotesLines.length > 0 ? custNotesLines.length * 3.8 + 1 : 0);

  ensureSpace(custBoxHeight + 4, false);

  doc.setDrawColor(226, 223, 218);
  doc.setFillColor(247, 246, 244); // #F7F6F4
  doc.rect(margin, y, contentWidth, custBoxHeight, 'FD');

  let custY = y + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(102, 98, 94);
  doc.text('DATA PEMESAN & LOKASI', margin + 4, custY);
  custY += 4.8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(37, 35, 33);
  doc.text(`${model.customer.fullName} · ${model.customer.phone}`, margin + 4, custY);
  custY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 52, 49);
  doc.text(custAddrLines, margin + 4, custY);
  custY += custAddrLines.length * 3.8;

  if (model.customer.coordinatesLabel) {
    doc.setFontSize(8);
    doc.setTextColor(102, 98, 94);
    doc.text(`Koordinat GPS opsional: ${model.customer.coordinatesLabel}`, margin + 4, custY + 0.5);
    custY += 4.2;
  }

  if (custNotesLines.length > 0) {
    doc.setFontSize(8.2);
    doc.setTextColor(55, 52, 49);
    doc.text(custNotesLines, margin + 4, custY + 1);
  }

  y += custBoxHeight + 6;

  // --------------------------------------------------------------------------
  // ITEMIZED TABLE WITH THUMBNAILS, SPECS & AUTOMATIC HEADER REPEAT
  // --------------------------------------------------------------------------
  drawTableHeader();

  model.items.forEach((item, index) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const titleLines = doc.splitTextToSize(item.title, col.infoW);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    const metaLines = doc.splitTextToSize(item.metaLine, col.infoW);

    const wrappedSpecs: string[] = [];
    for (const spec of item.specLines) {
      wrappedSpecs.push(...doc.splitTextToSize(spec, col.infoW));
    }

    const unitPriceLines = doc.splitTextToSize(item.unitPriceLabel, 28);
    const subtotalLines = doc.splitTextToSize(item.subtotalLabel, 28);

    const textBlockHeight =
      titleLines.length * 4.0 +
      metaLines.length * 3.5 +
      wrappedSpecs.length * 3.5 +
      1.5;
    const numBlockHeight = Math.max(unitPriceLines.length, subtotalLines.length) * 3.6 + 2;

    const imgBoxSize = 18;
    const rowPaddingY = 3;
    const rowHeight = Math.max(imgBoxSize, textBlockHeight, numBlockHeight) + rowPaddingY * 2;

    // Crucial pre-flight space check before drawing row
    ensureSpace(rowHeight, true);

    const rowTopY = y;

    // Thumbnail / Swatch Box (aspect-ratio contain)
    const imgObj = itemImages[index];
    doc.setDrawColor(226, 223, 218);
    doc.setFillColor(247, 246, 244);
    doc.rect(col.imgX, rowTopY + rowPaddingY, imgBoxSize, imgBoxSize, 'FD');

    if (imgObj) {
      const scale = Math.min((imgBoxSize - 1) / imgObj.width, (imgBoxSize - 1) / imgObj.height);
      const dw = imgObj.width * scale;
      const dh = imgObj.height * scale;
      const dx = col.imgX + (imgBoxSize - dw) / 2;
      const dy = rowTopY + rowPaddingY + (imgBoxSize - dh) / 2;
      doc.addImage(imgObj.dataUrl, 'JPEG', dx, dy, dw, dh);
    }

    // Info column
    let cursorY = rowTopY + rowPaddingY + 3.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(37, 35, 33);
    doc.text(titleLines, col.infoX, cursorY);
    cursorY += titleLines.length * 4.0;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(102, 98, 94);
    doc.text(metaLines, col.infoX, cursorY);
    cursorY += metaLines.length * 3.5 + 0.5;

    if (wrappedSpecs.length > 0) {
      doc.setTextColor(55, 52, 49);
      doc.text(wrappedSpecs, col.infoX, cursorY);
    }

    // Numeric columns (right-aligned)
    const numY = rowTopY + rowPaddingY + 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(37, 35, 33);
    doc.text(String(item.quantity), col.qtyRightX - 2, numY, { align: 'right' });
    doc.text(unitPriceLines, col.unitPriceRightX - 2, numY, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text(subtotalLines, col.totalRightX - 2, numY, { align: 'right' });

    // Row divider
    y += rowHeight;
    doc.setDrawColor(226, 223, 218);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
  });

  y += 6;

  // --------------------------------------------------------------------------
  // SUMMARY, DISCLAIMER & WHATSAPP NEXT STEP
  // --------------------------------------------------------------------------
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const disclaimerLines = doc.splitTextToSize(model.disclaimerText, contentWidth - 8);
  const nextStepLines = doc.splitTextToSize(model.nextStepsText, contentWidth - 8);

  const summaryRowsHeight = model.summary.estimatedDpLabel ? 19 : 13;
  const infoBoxHeight =
    (disclaimerLines.length + nextStepLines.length) * 3.6 + 10;

  ensureSpace(summaryRowsHeight + infoBoxHeight + 8, false);

  // Summary Totals (Right-aligned summary block)
  const labelX = margin + 78;
  const valueX = pageWidth - margin;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(102, 98, 94);
  doc.text(`Total Unit (${model.summary.totalLineCount} baris):`, labelX, y);
  doc.setTextColor(37, 35, 33);
  doc.text(`${model.summary.totalQuantity} unit`, valueX, y, { align: 'right' });
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(37, 35, 33);
  doc.text('Ringkasan Subtotal:', labelX, y);
  doc.text(model.summary.subtotalLabel, valueX, y, { align: 'right' });
  y += 5;

  if (model.summary.estimatedDpLabel) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(102, 98, 94);
    doc.text('Perkiraan Uang Muka (DP):', labelX, y);
    doc.setTextColor(37, 35, 33);
    doc.text(model.summary.estimatedDpLabel, valueX, y, { align: 'right' });
    y += 5;
  }

  y += 3;

  // Disclaimer & WhatsApp instructions box
  doc.setDrawColor(204, 199, 192);
  doc.setFillColor(247, 246, 244);
  doc.rect(margin, y, contentWidth, infoBoxHeight, 'FD');

  let infoY = y + 4.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(73, 70, 65);
  doc.text(disclaimerLines, margin + 4, infoY);
  infoY += disclaimerLines.length * 3.6 + 2.5;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 35, 33);
  doc.text(nextStepLines, margin + 4, infoY);

  // --------------------------------------------------------------------------
  // AUTOMATIC FOOTER ON ALL PAGES
  // --------------------------------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 223, 218);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(131, 126, 120);
    doc.text(`${model.brandName} · ${model.referenceCode}`, margin, pageHeight - 8.5);
    doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - margin, pageHeight - 8.5, {
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
