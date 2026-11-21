import { jsPDF } from 'jspdf';
import { computeInvoiceProgress, formatShortDateId } from '../finance-utils';
import type { BusinessConfig } from '../../types/business';
import type {
  CooperationAgreementDocument,
  HandoverCertificateDocument,
  WorkOrderDocument,
} from '../../types/documents';
import type { ProjectInvoice } from '../../types/finance';

function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function drawLetterhead(
  doc: jsPDF,
  businessConfig: BusinessConfig,
  documentHeading: string,
  documentNumber: string,
  metaSubtitle: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let leftY = margin + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(37, 35, 33);
  const brandLines = doc.splitTextToSize(businessConfig.namaMerek, 105);
  doc.text(brandLines, margin, leftY);
  leftY += brandLines.length * 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(102, 98, 94);
  const addrLines = doc.splitTextToSize(businessConfig.alamat.alamatLengkap, 105);
  doc.text(addrLines, margin, leftY);
  leftY += addrLines.length * 3.8;
  doc.text(`WhatsApp: ${businessConfig.whatsapp.nomorTampil}`, margin, leftY);
  leftY += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(73, 70, 65);
  doc.text(documentHeading.toUpperCase(), pageWidth - margin, margin + 4, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(37, 35, 33);
  doc.text(documentNumber, pageWidth - margin, margin + 10, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(102, 98, 94);
  doc.text(metaSubtitle, pageWidth - margin, margin + 15, { align: 'right' });

  const dividerY = Math.max(leftY, margin + 20) + 2;
  doc.setDrawColor(196, 189, 179);
  doc.setLineWidth(0.5);
  doc.line(margin, dividerY, pageWidth - margin, dividerY);

  return dividerY + 6;
}

function addPageFooters(doc: jsPDF, labelLeft: string): void {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(225, 220, 212);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 115, 109);
    doc.text(labelLeft, margin, pageHeight - 9);
    doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - margin, pageHeight - 9, {
      align: 'right',
    });
  }
}

export function downloadWorkOrderPdf(
  spk: WorkOrderDocument,
  businessConfig: BusinessConfig
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 20;

  doc.setProperties({
    title: `SPK ${spk.nomorSpk} - ${spk.namaProyek}`,
    subject: 'Surat Perintah Kerja Workshop',
    author: businessConfig.namaMerek,
  });

  let y = drawLetterhead(
    doc,
    businessConfig,
    'SURAT PERINTAH KERJA (SPK)',
    spk.nomorSpk,
    `Prioritas: ${spk.prioritas} | Status: ${spk.status}`
  );

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = margin;
    }
  };

  // Info Cards Row
  doc.setFillColor(246, 244, 240);
  doc.setDrawColor(214, 208, 198);
  doc.roundedRect(margin, y, contentWidth, 30, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(102, 98, 94);
  doc.text('INFORMASI PROYEK & KLIEN', margin + 4, y + 5.5);
  doc.text('PENANGGUNG JAWAB & JADWAL', margin + contentWidth / 2 + 4, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(37, 35, 33);
  doc.text(spk.namaProyek, margin + 4, y + 11, { maxWidth: contentWidth / 2 - 8 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Klien: ${spk.namaKlien}`, margin + 4, y + 17.5);
  const addrLines = doc.splitTextToSize(`Lokasi: ${spk.alamatPemasangan}`, contentWidth / 2 - 8);
  doc.text(addrLines.slice(0, 2), margin + 4, y + 22);

  const rightX = margin + contentWidth / 2 + 4;
  doc.text(
    `Terbit: ${formatShortDateId(spk.tanggalTerbit)} | Target: ${formatShortDateId(spk.tanggalTargetSelesai)}`,
    rightX,
    y + 11
  );
  doc.text(`Mandor / Kepala Produksi: ${spk.koordinatorProduksi}`, rightX, y + 16.5);
  doc.text(`Pimpinan / Pengawas: ${spk.namaPengawas}`, rightX, y + 21.5);
  doc.text(`Pemeriksa QC: ${spk.pemeriksaQc}`, rightX, y + 26.5);

  y += 36;

  // Items Table
  const drawItemsHeader = () => {
    doc.setFillColor(73, 70, 65);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(250, 249, 247);
    doc.text('NO', margin + 3, y + 5.2);
    doc.text('UNIT PEKERJAAN & SPESIFIKASI MATERIAL', margin + 12, y + 5.2);
    doc.text('DIMENSI', margin + 110, y + 5.2);
    doc.text('JML', margin + 146, y + 5.2, { align: 'right' });
    doc.text('STANDAR QC', margin + 150, y + 5.2);
    y += 9;
  };

  drawItemsHeader();

  spk.daftarItem.forEach((item, index) => {
    const unitLines = doc.splitTextToSize(`${item.namaUnit}\n${item.spesifikasiMaterial}`, 94);
    const qcLines = doc.splitTextToSize(item.daftarPeriksaQc || '-', 30);
    const rowHeight = Math.max(12, Math.max(unitLines.length, qcLines.length) * 4 + 4);

    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = margin;
      drawItemsHeader();
    }

    doc.setDrawColor(228, 223, 215);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(37, 35, 33);
    doc.text(String(index + 1), margin + 3, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.text(item.namaUnit, margin + 12, y + 5, { maxWidth: 94 });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(92, 88, 84);
    const matLines = doc.splitTextToSize(item.spesifikasiMaterial, 94);
    doc.text(matLines, margin + 12, y + 9.5);

    doc.setTextColor(37, 35, 33);
    doc.text(item.dimensi || '-', margin + 110, y + 5, { maxWidth: 32 });
    doc.text(`${item.jumlah} unit`, margin + 146, y + 5, { align: 'right' });
    doc.setFontSize(7.4);
    doc.text(qcLines, margin + 150, y + 5);

    y += rowHeight + 2;
  });

  y += 4;
  ensureSpace(34);

  if (spk.catatanTeknis.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(37, 35, 33);
    doc.text('Catatan Teknis Lapangan:', margin, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 76, 72);
    const notesLines = doc.splitTextToSize(spk.catatanTeknis, contentWidth);
    doc.text(notesLines, margin, y);
    y += notesLines.length * 4 + 4;
  }

  if (spk.ketentuanKeselamatan.trim()) {
    ensureSpace(22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(37, 35, 33);
    doc.text('Prosedur K3 & Pengemasan:', margin, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 76, 72);
    const safeLines = doc.splitTextToSize(spk.ketentuanKeselamatan, contentWidth);
    doc.text(safeLines, margin, y);
    y += safeLines.length * 4 + 6;
  }

  // Signature block
  ensureSpace(38);
  const sigY = y + 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(37, 35, 33);

  doc.text('Pemberi Perintah Kerja,', margin + 10, sigY);
  doc.text('Penerima Tugas (Kepala Produksi),', pageWidth - margin - 58, sigY);

  doc.setFont('helvetica', 'bold');
  doc.text(spk.namaPengawas, margin + 10, sigY + 22);
  doc.text(spk.koordinatorProduksi, pageWidth - margin - 58, sigY + 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(102, 98, 94);
  doc.text('Pimpinan Workshop / Pengawas', margin + 10, sigY + 26.5);
  doc.text('Penanggung Jawab Produksi', pageWidth - margin - 58, sigY + 26.5);

  addPageFooters(doc, `${businessConfig.namaMerek} · Dokumen Internal SPK ${spk.nomorSpk}`);
  doc.save(`${spk.nomorSpk}.pdf`);
}

export function downloadAgreementPdf(
  spks: CooperationAgreementDocument,
  businessConfig: BusinessConfig
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 20;

  doc.setProperties({
    title: `${spks.nomorKontrak} - ${spks.judulProyek}`,
    subject: 'Surat Perjanjian Kerja Sama',
    author: businessConfig.namaMerek,
  });

  let y = drawLetterhead(
    doc,
    businessConfig,
    'SURAT PERJANJIAN KERJA SAMA',
    spks.nomorKontrak,
    `${spks.jenisPerjanjian} · ${spks.kotaPenandatanganan}, ${formatShortDateId(spks.tanggalPenandatanganan)}`
  );

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(37, 35, 33);
  const introText = `Pada hari ini, tanggal ${formatShortDateId(spks.tanggalPenandatanganan)} bertempat di ${spks.kotaPenandatanganan}, kami yang bertanda tangan di bawah ini:`;
  const introLines = doc.splitTextToSize(introText, contentWidth);
  doc.text(introLines, margin, y);
  y += introLines.length * 4.2 + 3;

  // Parties Box
  doc.setFillColor(246, 244, 240);
  doc.setDrawColor(214, 208, 198);
  doc.roundedRect(margin, y, contentWidth, 38, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.text('PIHAK PERTAMA (PENYEDIA JASA)', margin + 4, y + 5.5);
  doc.text('PIHAK KEDUA (KLIEN / MITRA)', margin + contentWidth / 2 + 4, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Perusahaan : ${spks.perusahaanPihakPertama}`, margin + 4, y + 11, { maxWidth: contentWidth / 2 - 8 });
  doc.text(`Diwakili   : ${spks.perwakilanPihakPertama}`, margin + 4, y + 17.5);
  doc.text(`Jabatan    : ${spks.jabatanPihakPertama}`, margin + 4, y + 22.5, { maxWidth: contentWidth / 2 - 8 });
  const fpAddr = doc.splitTextToSize(`Alamat     : ${spks.alamatPihakPertama}`, contentWidth / 2 - 8);
  doc.text(fpAddr.slice(0, 2), margin + 4, y + 27.5);

  const rx = margin + contentWidth / 2 + 4;
  doc.text(`Nama       : ${spks.namaPihakKedua}`, rx, y + 11, { maxWidth: contentWidth / 2 - 8 });
  doc.text(
    `NIK/NPWP   : ${spks.nomorIdentitasPihakKedua || '-'}`,
    rx,
    y + 16.5
  );
  doc.text(`Peran      : ${spks.jabatanPihakKedua}`, rx, y + 21.5);
  doc.text(`Telepon/WA : ${spks.teleponPihakKedua || '-'}`, rx, y + 26.5);
  const spAddr = doc.splitTextToSize(`Alamat     : ${spks.alamatPihakKedua}`, contentWidth / 2 - 8);
  doc.text(spAddr.slice(0, 2), rx, y + 31.5);

  y += 44;

  // Contract Financial & Timeline Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`Objek Kerja Sama: ${spks.judulProyek}`, margin, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(92, 88, 84);
  doc.text(
    `Lokasi: ${spks.lokasiProyek} | Nilai Kontrak: ${formatIdr(spks.nilaiKontrak)} | Durasi: ${spks.durasiKerjaHari} hari kerja | Garansi: ${spks.masaGaransiBulan} bulan`,
    margin,
    y,
    { maxWidth: contentWidth }
  );
  y += 5;
  doc.text(
    `Skema Pembayaran Termin: DP ${spks.persenDp}% (${formatIdr(
      (spks.nilaiKontrak * spks.persenDp) / 100
    )}) · Termin Progres ${spks.persenProgres}% (${formatIdr(
      (spks.nilaiKontrak * spks.persenProgres) / 100
    )}) · Pelunasan ${spks.persenPelunasan}% (${formatIdr(
      (spks.nilaiKontrak * spks.persenPelunasan) / 100
    )})`,
    margin,
    y,
    { maxWidth: contentWidth }
  );
  y += 8;

  // Articles / Clauses
  spks.daftarPasal.forEach((clause) => {
    const bodyLines = doc.splitTextToSize(clause.isiPasal, contentWidth);
    ensureSpace(8 + bodyLines.length * 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(37, 35, 33);
    doc.text(clause.judulPasal, margin, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(65, 62, 58);
    doc.text(bodyLines, margin, y);
    y += bodyLines.length * 4 + 4;
  });

  // Closing & Signatures
  ensureSpace(46);
  y += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(37, 35, 33);
  doc.text(
    'Demikian Surat Perjanjian Kerja Sama ini dibuat rangkap 2 (dua) bermeterai cukup dan memiliki kekuatan hukum yang sama bagi kedua belah pihak.',
    margin,
    y,
    { maxWidth: contentWidth }
  );
  y += 10;

  doc.text('PIHAK PERTAMA,', margin + 8, y);
  doc.text('PIHAK KEDUA,', pageWidth - margin - 52, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(125, 120, 114);
  doc.text('[ Meterai / Cap Resmi ]', margin + 8, y + 12);
  doc.text('[ Meterai / Tanda Tangan ]', pageWidth - margin - 52, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(37, 35, 33);
  doc.text(spks.perwakilanPihakPertama, margin + 8, y + 23);
  doc.text(spks.namaPihakKedua, pageWidth - margin - 52, y + 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(102, 98, 94);
  doc.text(`Saksi: ${spks.saksiPihakPertama || '-'}`, margin + 8, y + 28);
  doc.text(`Saksi: ${spks.saksiPihakKedua || '-'}`, pageWidth - margin - 52, y + 28);

  addPageFooters(doc, `${businessConfig.namaMerek} · Kontrak Resmi ${spks.nomorKontrak}`);
  doc.save(`${spks.nomorKontrak}.pdf`);
}

export function downloadProjectInvoicePdf(
  invoice: ProjectInvoice,
  businessConfig: BusinessConfig
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 20;

  const progress = computeInvoiceProgress(invoice);

  doc.setProperties({
    title: `Invoice ${invoice.nomorInvoice} - ${invoice.namaProyek}`,
    subject: 'Invoice Resmi Proyek',
    author: businessConfig.namaMerek,
  });

  let y = drawLetterhead(
    doc,
    businessConfig,
    'INVOICE TAGIHAN PROYEK',
    invoice.nomorInvoice,
    `Jatuh Tempo: ${formatShortDateId(invoice.tanggalJatuhTempo)} | Status: ${progress.computedStatus}`
  );

  // Client & Project Box
  doc.setFillColor(246, 244, 240);
  doc.setDrawColor(214, 208, 198);
  doc.roundedRect(margin, y, contentWidth, 24, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(102, 98, 94);
  doc.text('DITAGIHKAN KEPADA', margin + 4, y + 5.5);
  doc.text('RINGKASAN NILAI KONTRAK', margin + contentWidth / 2 + 4, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(37, 35, 33);
  doc.text(invoice.namaKlien, margin + 4, y + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(invoice.namaProyek, margin + 4, y + 16.5, { maxWidth: contentWidth / 2 - 8 });
  doc.text(invoice.lokasi || '-', margin + 4, y + 21);

  const rx = margin + contentWidth / 2 + 4;
  doc.text(`Total Nilai Tagihan : ${formatIdr(invoice.nilaiTotalKontrak)}`, rx, y + 11.5);
  doc.text(`Sudah Dibayarkan    : ${formatIdr(progress.paidAmount)} (${progress.progressPercent}%)`, rx, y + 16.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Sisa Pembayaran     : ${formatIdr(progress.remainingAmount)}`, rx, y + 21.5);

  y += 30;

  // Itemized Line Items or Contract Summary Row
  doc.setFillColor(73, 70, 65);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(250, 249, 247);
  doc.text('DESKRIPSI PEKERJAAN / ITEM', margin + 3, y + 5.2);
  doc.text('JML', margin + 120, y + 5.2, { align: 'right' });
  doc.text('HARGA SATUAN', margin + 150, y + 5.2, { align: 'right' });
  doc.text('SUBTOTAL', margin + contentWidth - 3, y + 5.2, { align: 'right' });
  y += 10;

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

  lineItems.forEach((line) => {
    const descLines = doc.splitTextToSize(line.deskripsi, 100);
    const rowH = Math.max(9, descLines.length * 4.2 + 3);
    if (y + rowH > bottomLimit) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(37, 35, 33);
    doc.text(descLines, margin + 3, y + 4);
    doc.text(String(line.jumlah), margin + 120, y + 4, { align: 'right' });
    doc.text(formatIdr(line.hargaSatuan), margin + 150, y + 4, { align: 'right' });
    doc.text(formatIdr(line.jumlah * line.hargaSatuan), margin + contentWidth - 3, y + 4, {
      align: 'right',
    });
    doc.setDrawColor(230, 225, 218);
    doc.line(margin, y + rowH, margin + contentWidth, y + rowH);
    y += rowH + 1.5;
  });

  y += 4;

  // Payment history
  if (invoice.riwayatPembayaran.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(37, 35, 33);
    doc.text('Riwayat Pembayaran Diterima:', margin, y);
    y += 5;

    invoice.riwayatPembayaran.forEach((pay) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(75, 72, 68);
      doc.text(`${formatShortDateId(pay.tanggal)} · ${pay.label} (${pay.metodePembayaran})`, margin + 2, y);
      doc.text(formatIdr(pay.nominal), margin + contentWidth - 3, y, { align: 'right' });
      y += 4.8;
    });
    y += 4;
  }

  // Bank / Notes Box
  const bankNote =
    invoice.catatanRekening?.trim() ||
    `Pembayaran dapat ditransfer ke rekening resmi ${businessConfig.namaMerek}. Konfirmasi bukti transfer melalui WhatsApp ${businessConfig.whatsapp.nomorTampil}.`;
  const noteText = [invoice.catatan.trim(), bankNote].filter(Boolean).join('\n');
  const noteLines = doc.splitTextToSize(noteText, contentWidth - 8);
  doc.setFillColor(250, 249, 247);
  doc.setDrawColor(214, 208, 198);
  doc.roundedRect(margin, y, contentWidth, noteLines.length * 4.2 + 8, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 76, 72);
  doc.text(noteLines, margin + 4, y + 6);

  addPageFooters(doc, `${businessConfig.namaMerek} · Invoice Resmi ${invoice.nomorInvoice}`);
  doc.save(`${invoice.nomorInvoice}.pdf`);
}

export function downloadHandoverPdf(
  bast: HandoverCertificateDocument,
  businessConfig: BusinessConfig
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 20;

  doc.setProperties({
    title: `${bast.nomorBast} - ${bast.namaProyek}`,
    subject: 'Berita Acara Serah Terima Pekerjaan',
    author: businessConfig.namaMerek,
  });

  let y = drawLetterhead(
    doc,
    businessConfig,
    'BERITA ACARA SERAH TERIMA',
    bast.nomorBast,
    `${bast.kotaSerahTerima}, ${formatShortDateId(bast.tanggalSerahTerima)} | Progres ${bast.persentaseSelesai}%`
  );

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.4);
  doc.setTextColor(37, 35, 33);
  const refs = [
    bast.nomorSpkReferensi ? `SPK: ${bast.nomorSpkReferensi}` : null,
    bast.nomorSpksReferensi ? `Kontrak: ${bast.nomorSpksReferensi}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const introText = `Pada hari ini, tanggal ${formatShortDateId(bast.tanggalSerahTerima)} bertempat di ${bast.kotaSerahTerima}, telah dilaksanakan serah terima pekerjaan${refs ? ` (Ref. ${refs})` : ''} antara pihak-pihak di bawah ini:`;
  const introLines = doc.splitTextToSize(introText, contentWidth);
  doc.text(introLines, margin, y);
  y += introLines.length * 4.2 + 3;

  // Parties Box
  doc.setFillColor(246, 244, 240);
  doc.setDrawColor(214, 208, 198);
  doc.roundedRect(margin, y, contentWidth, 34, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('PIHAK PERTAMA (YANG MENYERAHKAN)', margin + 4, y + 5.5);
  doc.text('PIHAK KEDUA (YANG MENERIMA)', margin + contentWidth / 2 + 4, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.9);
  doc.text(`Perusahaan : ${bast.perusahaanPihakPertama}`, margin + 4, y + 11, {
    maxWidth: contentWidth / 2 - 8,
  });
  doc.text(`Diwakili   : ${bast.perwakilanPihakPertama}`, margin + 4, y + 16.5);
  doc.text(`Jabatan    : ${bast.jabatanPihakPertama}`, margin + 4, y + 21.5, {
    maxWidth: contentWidth / 2 - 8,
  });
  const fpAddr = doc.splitTextToSize(`Alamat     : ${bast.alamatPihakPertama}`, contentWidth / 2 - 8);
  doc.text(fpAddr.slice(0, 2), margin + 4, y + 26.5);

  const rx = margin + contentWidth / 2 + 4;
  doc.text(`Nama       : ${bast.namaPihakKedua}`, rx, y + 11, { maxWidth: contentWidth / 2 - 8 });
  doc.text(`Peran      : ${bast.jabatanPihakKedua}`, rx, y + 16.5);
  doc.text(`Telepon/WA : ${bast.teleponPihakKedua || '-'}`, rx, y + 21.5);
  const spAddr = doc.splitTextToSize(`Alamat     : ${bast.alamatPihakKedua}`, contentWidth / 2 - 8);
  doc.text(spAddr.slice(0, 2), rx, y + 26.5);

  y += 40;

  // Project & Warranty Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(37, 35, 33);
  doc.text(`Proyek / Pekerjaan: ${bast.namaProyek}`, margin, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(92, 88, 84);
  doc.text(
    `Jenis: ${bast.jenisSerahTerima} | Lokasi: ${bast.lokasiPemasangan || '-'} | Status: ${bast.status}`,
    margin,
    y,
    { maxWidth: contentWidth }
  );
  y += 4.8;
  doc.text(
    `Persentase Penyelesaian: ${bast.persentaseSelesai}% | Masa Garansi: ${bast.masaGaransiBulan} bulan (berlaku mulai ${formatShortDateId(bast.tanggalMulaiGaransi)})`,
    margin,
    y,
    { maxWidth: contentWidth }
  );
  y += 7;

  // Checklist Items Table
  const drawItemsHeader = () => {
    doc.setFillColor(73, 70, 65);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.7);
    doc.setTextColor(250, 249, 247);
    doc.text('NO', margin + 3, y + 5.2);
    doc.text('UNIT PEKERJAAN & DIMENSI', margin + 12, y + 5.2);
    doc.text('JML', margin + 96, y + 5.2, { align: 'right' });
    doc.text('KONDISI', margin + 102, y + 5.2);
    doc.text('CATATAN PEMERIKSAAN', margin + 138, y + 5.2);
    y += 9;
  };

  drawItemsHeader();

  bast.daftarItem.forEach((item, index) => {
    const unitDesc = item.dimensi ? `${item.namaUnit}\n${item.dimensi}` : item.namaUnit;
    const unitLines = doc.splitTextToSize(unitDesc, 74);
    const noteLines = doc.splitTextToSize(item.catatan || '-', 40);
    const rowHeight = Math.max(11, Math.max(unitLines.length, noteLines.length) * 4 + 3.5);

    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = margin;
      drawItemsHeader();
    }

    doc.setDrawColor(228, 223, 215);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(37, 35, 33);
    doc.text(String(index + 1), margin + 3, y + 4.8);

    doc.setFont('helvetica', 'bold');
    doc.text(item.namaUnit, margin + 12, y + 4.8, { maxWidth: 74 });
    if (item.dimensi) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(92, 88, 84);
      doc.text(item.dimensi, margin + 12, y + 9.2, { maxWidth: 74 });
    }

    doc.setTextColor(37, 35, 33);
    doc.text(`${item.jumlah} unit`, margin + 96, y + 4.8, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.text(item.kondisi, margin + 102, y + 4.8, { maxWidth: 34 });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 76, 72);
    doc.text(noteLines, margin + 138, y + 4.8);

    y += rowHeight + 2;
  });

  y += 5;

  if (bast.teksPernyataan.trim()) {
    const stmtLines = doc.splitTextToSize(bast.teksPernyataan, contentWidth);
    ensureSpace(8 + stmtLines.length * 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(37, 35, 33);
    doc.text('Pernyataan Serah Terima:', margin, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.1);
    doc.setTextColor(65, 62, 58);
    doc.text(stmtLines, margin, y);
    y += stmtLines.length * 4 + 4;
  }

  if (bast.catatanTindakLanjut.trim()) {
    const pendingLines = doc.splitTextToSize(bast.catatanTindakLanjut, contentWidth - 8);
    ensureSpace(14 + pendingLines.length * 4);
    doc.setFillColor(250, 249, 247);
    doc.setDrawColor(214, 208, 198);
    doc.roundedRect(margin, y, contentWidth, pendingLines.length * 4 + 10, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(37, 35, 33);
    doc.text('Catatan Tindak Lanjut / Masa Pemeliharaan:', margin + 4, y + 5.2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 76, 72);
    doc.text(pendingLines, margin + 4, y + 9.5);
    y += pendingLines.length * 4 + 14;
  }

  // Signature block
  ensureSpace(42);
  y += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(37, 35, 33);
  doc.text('Yang Menyerahkan (PIHAK PERTAMA),', margin + 8, y);
  doc.text('Yang Menerima (PIHAK KEDUA),', pageWidth - margin - 58, y);

  doc.setFontSize(7.5);
  doc.setTextColor(125, 120, 114);
  doc.text('[ Tanda Tangan / Cap Workshop ]', margin + 8, y + 12);
  doc.text('[ Tanda Tangan Penerima ]', pageWidth - margin - 58, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(37, 35, 33);
  doc.text(bast.perwakilanPihakPertama, margin + 8, y + 23);
  doc.text(bast.namaPihakKedua, pageWidth - margin - 58, y + 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(102, 98, 94);
  doc.text(`Saksi: ${bast.saksiPihakPertama || '-'}`, margin + 8, y + 28);
  doc.text(`Saksi: ${bast.saksiPihakKedua || '-'}`, pageWidth - margin - 58, y + 28);

  addPageFooters(doc, `${businessConfig.namaMerek} · Berita Acara Serah Terima ${bast.nomorBast}`);
  doc.save(`${bast.nomorBast}.pdf`);
}

