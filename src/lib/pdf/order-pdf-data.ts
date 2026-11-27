import { getCustomServiceModeLabel } from '../custom-pricing';
import { formatCurrencyIDR, formatProductPrice } from '../price-format';
import type { ValidatedCustomerData } from '../../pages/pesanan/types';
import { calculateCartSummary } from '../../store/cart-store';
import type { CartItem } from '../../types/cart';
import { BUSINESS_CONFIG } from '../business-config';
import { formatDocumentPhoneDisplay } from '../phone-format';
import { formatStandardDocumentProductRow } from '../document-product-table';

export interface OrderPdfItemRow {
  lineId: string;
  kind: 'product' | 'custom';
  title: string;
  metaLine: string;
  specLines: string[];
  productTitle: string;
  specSummary: string;
  materialTitle: string;
  materialSubText: string;
  dimensionText: string;
  quantityText: string;
  quantity: number;
  unitPriceLabel: string;
  subtotalLabel: string;
  imageUrl: string | null;
  swatchHex: string | null;
}

export interface OrderPdfDataModel {
  documentTitle: string;
  referenceCode: string;
  referenceLabel: string;
  formattedDateTime: string;
  brandName: string;
  brandAddress: string;
  brandWhatsApp: string;
  brandOwnerName: string;
  brandOwnerRole: string;
  customer: {
    fullName: string;
    phone: string;
    address: string;
    coordinatesLabel: string | null;
    notes: string | null;
  };
  items: OrderPdfItemRow[];
  summary: {
    totalLineCount: number;
    totalQuantity: number;
    subtotalLabel: string;
    estimatedDpLabel: string | null;
    hasUnpricedItems: boolean;
  };
  disclaimerText: string;
  nextStepsText: string;
  filename: string;
}

/**
 * Ensures strings rendered via standard PDF built-in fonts avoid unsupported glyphs
 * while keeping standard Indonesian Latin letters, numerals, punctuation, ×, ·, and ± intact.
 */
export function sanitizePdfText(input: string): string {
  return input
    .replace(/\u2192/g, '->')
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF\u2022\n]/g, '')
    .trim();
}

export function generateLocalReferenceCode(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `REF-SZ-${yyyy}${mm}${dd}-${hh}${min}-${suffix}`;
}

export function formatIndonesianDateTime(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

export function buildSafePdfFilename(referenceCode: string): string {
  const safeSlug = referenceCode
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `ringkasan-pesanan-${safeSlug || 'sdi'}.pdf`;
}

function mapCartItemToPdfRow(item: CartItem, index: number): OrderPdfItemRow {
  if (item.kind === 'product') {
    const metaParts: string[] = [`Kategori: ${item.category}`];
    if (item.selectedColorName) {
      metaParts.push(`Warna: ${item.selectedColorName}`);
    }

    const specLines: string[] = [];
    for (const [key, val] of Object.entries(item.selectedOptions)) {
      specLines.push(sanitizePdfText(`${key}: ${val}`));
    }

    const stdRow = formatStandardDocumentProductRow(
      {
        namaProduk: item.name,
        customisasi: Object.entries(item.selectedOptions)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', '),
        includeList: item.selectedColorName ? [`Warna ${item.selectedColorName}`] : [],
        jumlah: item.quantity,
        satuan: 'Unit',
        hargaSatuan: item.unitPrice,
        subtotal:
          item.unitPrice !== null && item.unitPrice > 0 ? item.unitPrice * item.quantity : null,
      },
      index
    );

    const priceDisplay = formatProductPrice({
      price: item.unitPrice,
      priceFrom: item.priceStatus === 'mulai' ? item.unitPrice : null,
      priceStatus: item.priceStatus,
    });
    const subtotalText =
      item.unitPrice !== null && item.unitPrice > 0
        ? formatCurrencyIDR(item.unitPrice * item.quantity) ?? 'Hubungi kami'
        : 'Konfirmasi';

    return {
      lineId: item.lineId,
      kind: 'product',
      title: sanitizePdfText(item.name),
      metaLine: sanitizePdfText(metaParts.join(' · ')),
      specLines,
      productTitle: sanitizePdfText(stdRow.productTitle),
      specSummary: sanitizePdfText(stdRow.specText),
      materialTitle: sanitizePdfText(stdRow.materialTitle),
      materialSubText: sanitizePdfText(stdRow.materialSubText),
      dimensionText: sanitizePdfText(stdRow.dimensionText),
      quantityText: sanitizePdfText(stdRow.quantityText),
      quantity: item.quantity,
      unitPriceLabel: sanitizePdfText(priceDisplay.label),
      subtotalLabel: sanitizePdfText(subtotalText),
      imageUrl: item.image,
      swatchHex: null,
    };
  }

  const serviceModeLabel = item.serviceModeLabel || getCustomServiceModeLabel(item.serviceMode);
  const dim = item.dimensions;
  const dimDisplay = dim.height
    ? `${dim.length} × ${dim.width} × ${dim.height} ${dim.unit}`
    : `${dim.length} × ${dim.width} ${dim.unit}`;
  const cmEquivalent =
    dim.unit === 'm'
      ? ` (${dim.normalizedLengthCm} × ${dim.normalizedWidthCm}${
          dim.normalizedHeightCm ? ` × ${dim.normalizedHeightCm}` : ''
        } cm)`
      : '';
  const materialPrefix = item.serviceMode === 'design-only' ? 'Ref. Material Utama' : 'Material Utama';

  const specLines: string[] = [
    sanitizePdfText(`Ukuran ruang: ${dimDisplay}${cmEquivalent}`),
    sanitizePdfText(
      `${materialPrefix}: ${item.materialLabel}${item.finishLabel ? ` · Finishing/Laminasi: ${item.finishLabel}` : ''}`
    ),
    sanitizePdfText(`Warna: ${item.colorName}`),
  ];
  if (
    item.designAmount != null &&
    item.designAmount > 0 &&
    item.buildAmount != null &&
    item.buildAmount > 0
  ) {
    specLines.push(
      sanitizePdfText(
        `Rincian estimasi: Desain ${formatCurrencyIDR(item.designAmount)} + Build ${formatCurrencyIDR(item.buildAmount)}`
      )
    );
  }
  if (item.additionalOptions.length > 0) {
    specLines.push(sanitizePdfText(`Opsi: ${item.additionalOptions.join(', ')}`));
  }
  if (item.notes.trim()) {
    specLines.push(sanitizePdfText(`Catatan item: ${item.notes.trim()}`));
  }

  const cmDimText = dim.normalizedHeightCm
    ? `${dim.normalizedLengthCm} x ${dim.normalizedWidthCm} x ${dim.normalizedHeightCm}`
    : `${dim.normalizedLengthCm} x ${dim.normalizedWidthCm}`;
  const customRow = formatStandardDocumentProductRow(
    {
      namaProduk: item.itemTypeLabel,
      customisasi: item.notes.trim() || item.projectTypeLabel?.trim() || serviceModeLabel,
      includeList: item.additionalOptions,
      material: item.materialLabel,
      finishing: item.finishLabel,
      kodeWarna: item.colorName,
      dimensi: cmDimText,
      jumlah: item.quantity,
      satuan: 'Unit',
      hargaSatuan: item.estimatedUnitTotal,
      subtotal:
        item.estimatedUnitTotal !== null && item.estimatedUnitTotal > 0
          ? item.estimatedUnitTotal * item.quantity
          : null,
    },
    index
  );

  const unitLabel =
    item.estimatedUnitTotal !== null && item.estimatedUnitTotal > 0
      ? `Estimasi ${formatCurrencyIDR(item.estimatedUnitTotal)}`
      : 'Hubungi kami';
  const subtotalLabel =
    item.estimatedUnitTotal !== null && item.estimatedUnitTotal > 0
      ? formatCurrencyIDR(item.estimatedUnitTotal * item.quantity) ?? 'Konfirmasi'
      : 'Konfirmasi';

  return {
    lineId: item.lineId,
    kind: 'custom',
    title: sanitizePdfText(`${item.itemTypeLabel} (Custom Interior)`),
    metaLine: sanitizePdfText(
      item.projectTypeLabel?.trim()
        ? `Ruangan: ${item.projectTypeLabel.trim()} · Layanan: ${serviceModeLabel}`
        : `Layanan: ${serviceModeLabel}`
    ),
    specLines,
    productTitle: sanitizePdfText(customRow.productTitle),
    specSummary: sanitizePdfText(customRow.specText),
    materialTitle: sanitizePdfText(customRow.materialTitle),
    materialSubText: sanitizePdfText(customRow.materialSubText),
    dimensionText: sanitizePdfText(customRow.dimensionText),
    quantityText: sanitizePdfText(customRow.quantityText),
    quantity: item.quantity,
    unitPriceLabel: sanitizePdfText(unitLabel),
    subtotalLabel: sanitizePdfText(subtotalLabel),
    imageUrl: null,
    swatchHex: item.colorHex,
  };
}

export function buildOrderPdfDataModel(params: {
  items: CartItem[];
  customer: ValidatedCustomerData;
  referenceCode?: string;
  createdAt?: Date;
}): OrderPdfDataModel {
  const createdAt = params.createdAt ?? new Date();
  const referenceCode = params.referenceCode ?? generateLocalReferenceCode(createdAt);
  const summary = calculateCartSummary(params.items);

  const formattedSubtotal = formatCurrencyIDR(summary.pricedSubtotal);
  const formattedDp = formatCurrencyIDR(summary.estimatedDpTotal);

  let subtotalLabel = 'Menunggu konfirmasi harga resmi';
  if (formattedSubtotal && !summary.hasUnpricedItems) {
    subtotalLabel = formattedSubtotal;
  } else if (formattedSubtotal && summary.hasUnpricedItems) {
    subtotalLabel = `${formattedSubtotal} (+ item konfirmasi)`;
  }

  const coordsLabel = params.customer.coordinates
    ? `${params.customer.coordinates.latitude.toFixed(6)}, ${params.customer.coordinates.longitude.toFixed(
        6
      )}${
        params.customer.coordinates.accuracyMeters > 0
          ? ` (±${Math.round(params.customer.coordinates.accuracyMeters)} m)`
          : ''
      }`
    : null;

  return {
    documentTitle: 'Ringkasan Permintaan Furniture & Interior',
    referenceCode: sanitizePdfText(referenceCode),
    referenceLabel: 'Referensi Ringkasan Pesanan',
    formattedDateTime: sanitizePdfText(formatIndonesianDateTime(createdAt)),
    brandName: sanitizePdfText(BUSINESS_CONFIG.namaMerek),
    brandAddress: sanitizePdfText(BUSINESS_CONFIG.alamat.alamatLengkap),
    brandWhatsApp: sanitizePdfText(BUSINESS_CONFIG.whatsapp.nomorTampil),
    brandOwnerName: sanitizePdfText(BUSINESS_CONFIG.drafPemilik.namaPemilik || 'Hilman Aziz Napis'),
    brandOwnerRole: sanitizePdfText(BUSINESS_CONFIG.drafPemilik.jabatanPemilik || 'Owner SDI Furniture'),
    customer: {
      fullName: sanitizePdfText(params.customer.fullName),
      phone: sanitizePdfText(
        formatDocumentPhoneDisplay(params.customer.normalizedPhone) || params.customer.normalizedPhone
      ),
      address: sanitizePdfText(params.customer.address),
      coordinatesLabel: coordsLabel ? sanitizePdfText(coordsLabel) : null,
      notes: params.customer.notes.trim() ? sanitizePdfText(params.customer.notes) : null,
    },
    items: params.items.map(mapCartItemToPdfRow),
    summary: {
      totalLineCount: summary.lineCount,
      totalQuantity: summary.totalQuantity,
      subtotalLabel: sanitizePdfText(subtotalLabel),
      estimatedDpLabel: formattedDp ? sanitizePdfText(formattedDp) : null,
      hasUnpricedItems: summary.hasUnpricedItems,
    },
    disclaimerText: sanitizePdfText(
      'Catatan Penting: Dokumen ini adalah ringkasan permintaan pelanggan dan estimasi awal (jika tersedia). Harga akhir, ketersediaan material, ukuran aktual di lapangan, ongkos kirim, serta uang muka (DP) menunggu survei/konfirmasi resmi dari Shansus Dzar Indonesia.'
    ),
    nextStepsText: sanitizePdfText(
      `Langkah Berikutnya: Unduh dokumen PDF ini lalu kirim atau lampirkan saat menghubungi WhatsApp resmi kami di ${BUSINESS_CONFIG.whatsapp.nomorTampil} untuk penjadwalan konsultasi dan penawaran resmi.`
    ),
    filename: buildSafePdfFilename(referenceCode),
  };
}
