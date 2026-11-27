import type {
  ProjectProductAddonItem,
  ProjectProductItem,
} from '../types/finance';
import type { ProductItem } from '../types/product';
import { formatDocumentDimensionDisplay } from './dimension-format';
import {
  DEFAULT_CATALOG_PRODUCTS,
  resolveProjectProductName,
} from './project-products';

export interface StandardTableColumnDef {
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
}

export const STANDARD_DOCUMENT_PRODUCT_TABLE_COLUMNS: readonly StandardTableColumnDef[] = [
  { header: 'NO', width: 8, align: 'center' },
  { header: 'PRODUK & SPESIFIKASI', width: 53 },
  { header: 'MATERIAL', width: 34 },
  { header: 'DIMENSI (cm)', width: 23 },
  { header: 'HARGA SATUAN', width: 28, align: 'right' },
  { header: 'JUMLAH', width: 28, align: 'right' },
];

export const STANDARD_DOCUMENT_PRODUCT_TABLE_HEADERS = [
  'NO',
  'PRODUK & SPESIFIKASI',
  'MATERIAL',
  'DIMENSI (cm)',
  'HARGA SATUAN',
  'JUMLAH',
] as const;

export interface StandardDocumentProductInput {
  productId?: string | null;
  namaProduk?: string | null;
  customisasi?: string | null;
  tambahan?: ReadonlyArray<Pick<ProjectProductAddonItem, 'jenis' | 'biaya'>> | null;
  includeList?: ReadonlyArray<string> | null;
  material?: string | null;
  finishing?: string | null;
  kodeWarna?: string | null;
  spesifikasiMaterial?: string | null;
  dimensi?: string | null;
  jumlah?: number | null;
  satuan?: string | null;
  hargaSatuan?: number | null;
  subtotal?: number | null;
  linkedProjectProduct?: Partial<ProjectProductItem> | null;
  catalogProducts?: ReadonlyArray<ProductItem>;
}

export interface StandardDocumentProductFormattedRow {
  noText: string;
  productTitle: string;
  specText: string;
  materialTitle: string;
  materialThicknessLine: string;
  materialFinishingLine: string;
  materialSubText: string;
  dimensionText: string;
  quantityText: string;
  unitPrice: number | null;
  subtotal: number | null;
  unitPriceText: string;
  subtotalText: string;
}

function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

const KNOWN_MATERIAL_RE =
  /\b(PVC\s*Board|Solid\s*Wood|Kayu\s*Solid|Particle\s*Board|Multipleks|Multiplek|Blockboard|Teakblock|Plywood|MDF|HDF|HMR|Stainless)\b/i;

const MATERIAL_SPEC_SEGMENT_RE =
  /^(?:material\s*:|ref\.?\s*material|pvc\s*board|solid\s*wood|kayu\s*solid|particle\s*board|multipleks|multiplek|blockboard|teakblock|plywood|mdf|hdf|hmr|stainless)(?:\b|\s|$)/i;

const THICKNESS_ONLY_SEGMENT_RE = /^\d+(?:[.,]\d+)?\s*mm(?:\s*\([^)]*\))?$/i;

const FINISHING_COLOR_SEGMENT_RE =
  /^(?:finishing(?:\s*\/\s*laminasi)?\b|cat\s+duco\b|duco\b|hpl\b|tacosheet\b|melamik\b|laminasi\b|kode\s*warna\b|warna\s*:)/i;

const DIMENSION_SEGMENT_RE = /^(?:dimensi|ukuran(?:\s+ruang)?)\s*:/i;

const GENERIC_PLACEHOLDER_SEGMENT_RE =
  /^(?:sesuai\s+shop\s+drawing|sesuai\s+gambar\s+kerja|sesuai\s+spesifikasi|sesuai\s+pesanan)/i;

function extractThicknessAndCleanMaterial(rawMaterial: string): {
  materialTitle: string;
  thicknessMm: string;
} {
  const cleaned = rawMaterial.replace(/^(?:ref\.?\s*)?material(?:\s+utama)?\s*:\s*/i, '').trim();
  const thicknessMatch = cleaned.match(/\b(\d+(?:[.,]\d+)?)\s*mm\b/i);
  const thicknessMm = thicknessMatch ? `${thicknessMatch[1]} mm` : '18 mm';
  const materialTitle = cleaned
    .replace(/\b\d+(?:[.,]\d+)?\s*mm(?:\s*\([^)]*\))?/gi, '')
    .replace(/\(\s*Grade\s+[A-Z0-9]+\s*\)/gi, '')
    .replace(/[\s,·-]+$/g, '')
    .trim();
  return { materialTitle, thicknessMm };
}

function extractMaterialFromSpec(spec: string): {
  materialTitle: string;
  thicknessMm: string;
} {
  if (!spec.trim()) {
    return { materialTitle: '', thicknessMm: '18 mm' };
  }
  const thicknessMatch = spec.match(/\b(\d+(?:[.,]\d+)?)\s*mm\b/i);
  const thicknessMm = thicknessMatch ? `${thicknessMatch[1]} mm` : '18 mm';

  const explicitPrefixMatch = spec.match(/(?:^|[,;\n·])\s*(?:ref\.?\s*)?material(?:\s+utama)?\s*:\s*([^,;\n·]+)/i);
  if (explicitPrefixMatch?.[1]) {
    const extracted = extractThicknessAndCleanMaterial(explicitPrefixMatch[1]);
    return {
      materialTitle: extracted.materialTitle,
      thicknessMm: thicknessMatch ? thicknessMm : extracted.thicknessMm,
    };
  }

  const knownMatch = spec.match(KNOWN_MATERIAL_RE);
  if (knownMatch?.[1]) {
    return {
      materialTitle: knownMatch[1].replace(/\s+/g, ' ').trim(),
      thicknessMm,
    };
  }

  return { materialTitle: '', thicknessMm };
}

export function resolveMaterialColumnInfo(params: {
  material?: string | null;
  finishing?: string | null;
  kodeWarna?: string | null;
  spesifikasiMaterial?: string | null;
}): {
  materialTitle: string;
  thicknessLine: string;
  finishingLine: string;
  subText: string;
} {
  const rawMaterial = String(params.material ?? '').trim();
  const rawSpec = String(params.spesifikasiMaterial ?? '').trim();

  let materialTitle = '';
  let thicknessMm = '18 mm';

  if (rawMaterial) {
    const parsed = extractThicknessAndCleanMaterial(rawMaterial);
    materialTitle = parsed.materialTitle || rawMaterial;
    thicknessMm = parsed.thicknessMm;
  } else if (rawSpec) {
    const parsed = extractMaterialFromSpec(rawSpec);
    materialTitle = parsed.materialTitle;
    thicknessMm = parsed.thicknessMm;
  }

  let finishing = String(params.finishing ?? '').trim();
  let kodeWarna = String(params.kodeWarna ?? '').trim();

  if (rawSpec) {
    if (!finishing) {
      const finishMatch = rawSpec.match(
        /\bfinishing(?:\s*\/\s*laminasi)?\s*:?\s*([^,(;\n\]·]+?)(?:\s*\(([^)]+)\)|(?=[,;\n\]·]|$))/i
      );
      if (finishMatch?.[1]) {
        finishing = finishMatch[1].trim();
        if (!kodeWarna && finishMatch[2]) {
          kodeWarna = finishMatch[2].trim();
        }
      } else {
        const directFinishMatch = rawSpec.match(
          /(?:^|[,;\n·+])\s*(Cat\s+Duco|Duco|HPL(?:\s+(?!mm\b)[A-Za-z0-9-]+)?|Tacosheet(?:\s+[A-Za-z0-9-]+)?|Melamik)(?:\s*\(([^)]+)\))?(?=\s*(?:[,;\n·+]|$))/i
        );
        if (directFinishMatch?.[1]) {
          finishing = directFinishMatch[1].trim();
          if (!kodeWarna && directFinishMatch[2]) {
            kodeWarna = directFinishMatch[2].trim();
          }
        }
      }
    } else if (!kodeWarna) {
      const finishParenMatch = rawSpec.match(
        /\bfinishing(?:\s*\/\s*laminasi)?\s*:?\s*[^,(;\n\]]+?\s*\(([^)]+)\)/i
      );
      if (finishParenMatch?.[1]) {
        kodeWarna = finishParenMatch[1].trim();
      }
    }

    if (!kodeWarna) {
      const codeMatch = rawSpec.match(/\bkode\s*warna\s*[:\-]?\s*([^,;\n\]·]+)/i);
      if (codeMatch?.[1]) {
        kodeWarna = codeMatch[1].trim();
      }
    }
  }

  finishing = finishing.replace(/^finishing(?:\s*\/\s*laminasi)?\s*:?\s*/i, '').trim();
  if (kodeWarna === '-' || /^tanpa\s+kode/i.test(kodeWarna)) {
    kodeWarna = '';
  }

  const finishingLine =
    finishing && kodeWarna
      ? `${finishing} • ${kodeWarna}`
      : finishing
        ? finishing
        : kodeWarna
          ? kodeWarna
          : '';

  if (!materialTitle && !finishingLine) {
    return {
      materialTitle: '-',
      thicknessLine: '',
      finishingLine: '',
      subText: '',
    };
  }

  const resolvedTitle = materialTitle || '-';
  const thicknessLine = `${thicknessMm} (Grade A)`;
  const subLines = [thicknessLine, finishingLine].filter(Boolean);

  return {
    materialTitle: resolvedTitle,
    thicknessLine,
    finishingLine,
    subText: subLines.join('\n'),
  };
}

export function formatProductSpecOnlyCustomAndIncludes(params: {
  customisasi?: string | null;
  tambahan?: ReadonlyArray<Pick<ProjectProductAddonItem, 'jenis' | 'biaya'>> | null;
  includeList?: ReadonlyArray<string> | null;
  spesifikasiMaterial?: string | null;
}): string {
  const parts: string[] = [];
  const seen = new Set<string>();

  const pushPart = (raw: string) => {
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    parts.push(cleaned);
  };

  const customisasi = String(params.customisasi ?? '').trim();
  if (customisasi) {
    pushPart(customisasi);
  }

  if (Array.isArray(params.tambahan)) {
    for (const addon of params.tambahan) {
      const jenis = String(addon?.jenis ?? '').trim();
      if (!jenis) continue;
      const biaya = Math.round(Number(addon?.biaya) || 0);
      pushPart(biaya > 0 ? `${jenis} (+${formatIdr(biaya)})` : jenis);
    }
  }

  if (Array.isArray(params.includeList)) {
    for (const entry of params.includeList) {
      pushPart(String(entry ?? ''));
    }
  }

  const hasStructuredIncludes =
    (Array.isArray(params.tambahan) && params.tambahan.length > 0) ||
    (Array.isArray(params.includeList) && params.includeList.length > 0);

  const rawSpec = String(params.spesifikasiMaterial ?? '').trim();
  if (rawSpec && (!customisasi || !hasStructuredIncludes)) {
    const unwrapped = rawSpec.replace(/\[([^\]]+)\]/g, ', $1');
    const segments = unwrapped.split(/[,;\n·]+|\s+\+\s+/);
    for (const segment of segments) {
      const stripped = segment
        .replace(/^Model\s*:\s*/i, '')
        .replace(/^Include\s*:\s*/i, '')
        .replace(/^Opsi\s*:\s*/i, '')
        .trim();
      if (!stripped) continue;
      if (MATERIAL_SPEC_SEGMENT_RE.test(stripped)) continue;
      if (THICKNESS_ONLY_SEGMENT_RE.test(stripped)) continue;
      if (FINISHING_COLOR_SEGMENT_RE.test(stripped)) continue;
      if (DIMENSION_SEGMENT_RE.test(stripped)) continue;
      if (GENERIC_PLACEHOLDER_SEGMENT_RE.test(stripped)) continue;
      pushPart(stripped);
    }
  }

  return parts.join(', ');
}

export function matchLinkedProjectProduct(
  item: {
    id?: string | null;
    namaProduk?: string | null;
  },
  index: number,
  linkedProducts?: ReadonlyArray<ProjectProductItem> | null,
  catalogProducts: ReadonlyArray<ProductItem> = DEFAULT_CATALOG_PRODUCTS
): ProjectProductItem | null {
  if (!linkedProducts || linkedProducts.length === 0) return null;

  if (item.id) {
    const byId = linkedProducts.find((p) => p.id === item.id);
    if (byId) return byId;
  }

  const targetName = String(item.namaProduk ?? '').trim().toLowerCase();
  if (targetName) {
    const byName = linkedProducts.find((p) => {
      const resolved = resolveProjectProductName(p, catalogProducts).toLowerCase();
      return resolved && (resolved === targetName || targetName.startsWith(resolved));
    });
    if (byName) return byName;
  }

  return linkedProducts[index] ?? null;
}

export function formatStandardDocumentProductRow(
  input: StandardDocumentProductInput,
  index: number
): StandardDocumentProductFormattedRow {
  const linked = input.linkedProjectProduct;
  const catalogProducts = input.catalogProducts ?? DEFAULT_CATALOG_PRODUCTS;

  const productId = input.productId?.trim() || linked?.id?.trim() || '';
  const rawName = input.namaProduk?.trim() || linked?.namaProduk?.trim() || '';
  const productTitle =
    resolveProjectProductName({ id: productId, namaProduk: rawName }, catalogProducts) ||
    rawName ||
    'Unit Custom Interior';

  const customisasi = input.customisasi?.trim() || linked?.customisasi?.trim() || '';
  const tambahan =
    Array.isArray(input.tambahan) && input.tambahan.length > 0
      ? input.tambahan
      : linked?.tambahan ?? [];
  const spesifikasiMaterial =
    input.spesifikasiMaterial?.trim() || linked?.spesifikasiMaterial?.trim() || '';

  const specText = formatProductSpecOnlyCustomAndIncludes({
    customisasi,
    tambahan,
    includeList: input.includeList,
    spesifikasiMaterial,
  });

  const materialInfo = resolveMaterialColumnInfo({
    material: input.material?.trim() || linked?.material?.trim() || '',
    finishing: input.finishing?.trim() || linked?.finishing?.trim() || '',
    kodeWarna: input.kodeWarna?.trim() || linked?.kodeWarna?.trim() || '',
    spesifikasiMaterial,
  });

  const rawDimensi = input.dimensi?.trim() || linked?.dimensi?.trim() || '';
  const dimensionText = formatDocumentDimensionDisplay(rawDimensi) || '-';

  const qty = Math.max(1, Math.round(Number(input.jumlah ?? linked?.jumlah) || 1));
  const satuan = input.satuan?.trim() || linked?.satuan?.trim() || 'Unit';
  const quantityText = `${qty} ${satuan}`;

  const rawUnitPrice =
    input.hargaSatuan !== undefined && input.hargaSatuan !== null
      ? input.hargaSatuan
      : linked?.hargaSatuan !== undefined
        ? linked.hargaSatuan
        : null;
  const unitPrice =
    rawUnitPrice !== null && Number.isFinite(Number(rawUnitPrice))
      ? Math.max(0, Math.round(Number(rawUnitPrice)))
      : null;

  const rawSubtotal =
    input.subtotal !== undefined && input.subtotal !== null && Number.isFinite(Number(input.subtotal))
      ? Math.max(0, Math.round(Number(input.subtotal)))
      : unitPrice !== null
        ? qty * unitPrice
        : null;

  return {
    noText: String(index + 1),
    productTitle,
    specText,
    materialTitle: materialInfo.materialTitle,
    materialThicknessLine: materialInfo.thicknessLine,
    materialFinishingLine: materialInfo.finishingLine,
    materialSubText: materialInfo.subText,
    dimensionText,
    quantityText,
    unitPrice,
    subtotal: rawSubtotal,
    unitPriceText: unitPrice !== null ? formatIdr(unitPrice) : '-',
    subtotalText: rawSubtotal !== null ? formatIdr(rawSubtotal) : '-',
  };
}

export function parseInvoiceLineDescription(deskripsi: string): {
  namaProduk: string;
  dimensi: string;
  spesifikasiMaterial: string;
} {
  const trimmed = String(deskripsi ?? '').trim();
  const dashIdx = trimmed.indexOf(' — ');
  if (dashIdx === -1) {
    return {
      namaProduk: trimmed,
      dimensi: '',
      spesifikasiMaterial: '',
    };
  }
  const head = trimmed.slice(0, dashIdx).trim();
  const tail = trimmed.slice(dashIdx + 3).trim();
  const dimMatch = head.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (dimMatch) {
    return {
      namaProduk: dimMatch[1].trim(),
      dimensi: dimMatch[2].trim(),
      spesifikasiMaterial: tail,
    };
  }
  return {
    namaProduk: head,
    dimensi: '',
    spesifikasiMaterial: tail,
  };
}
