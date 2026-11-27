export type DimensionParts = [string, string, string];

function cleanNumericToken(raw: string, stripTrailingDot: boolean): string {
  const normalized = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  if (!normalized) return '';

  const firstDot = normalized.indexOf('.');
  let singleDot =
    firstDot === -1
      ? normalized
      : normalized.slice(0, firstDot + 1) + normalized.slice(firstDot + 1).replace(/\./g, '');

  if (stripTrailingDot) {
    singleDot = singleDot.replace(/\.$/, '');
  }

  if (!singleDot || singleDot === '.') return '';

  // Collapse redundant leading zeroes for multi-digit integer tokens (e.g. "060" -> "60"), keeping "0.5" or "0"
  if (/^0\d+$/.test(singleDot)) {
    singleDot = String(Number(singleDot));
  }

  return singleDot;
}

/**
 * Sanitizes a single live-typing dimension input column (`P`, `L`, or `T` in cm),
 * keeping valid numeric digits and at most one decimal separator.
 */
export function sanitizeDimensionColumnInput(raw: string): string {
  const cleaned = cleanNumericToken(raw, false);
  return cleaned;
}

/**
 * Parses a dimension string (such as `"320 x 60 x 85 cm"`, `"250 × 220"`, `"320x60x85"`)
 * into three separate cm column values `[P, L, T]`. Non-numeric notes return empty slots.
 */
export function parseDimensionParts(raw?: string | null): DimensionParts {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return ['', '', ''];

  // Strip unit suffix/tokens like "cm"
  const withoutUnit = trimmed.replace(/(\d|\s|^)cm\b/gi, '$1').trim();
  if (!withoutUnit) return ['', '', ''];

  const segments = withoutUnit.split(/\s*[x×*]\s*/i);
  if (segments.length === 1) {
    // Only treat single token as numeric if the whole token is a number
    if (!/^\d+(?:[.,]\d+)?$/.test(segments[0].trim())) {
      return ['', '', ''];
    }
    const single = cleanNumericToken(segments[0], true);
    return single ? [single, '', ''] : ['', '', ''];
  }

  const parsed: DimensionParts = ['', '', ''];
  for (let idx = 0; idx < Math.min(3, segments.length); idx += 1) {
    const seg = segments[idx].trim();
    if (/^\d+(?:[.,]\d+)?$/.test(seg)) {
      parsed[idx] = cleanNumericToken(seg, true);
    }
  }

  const hasAnyNumber = parsed.some((part) => part.length > 0);
  return hasAnyNumber ? parsed : ['', '', ''];
}

/**
 * Serializes `[P, L, T]` numeric cm column values into `"P x L x T"` without `"cm"`.
 */
export function formatDimensionParts(parts: readonly [string, string, string]): string {
  const cleaned = parts
    .map((part) => cleanNumericToken(part, true))
    .filter((part) => part.length > 0);
  return cleaned.join(' x ');
}

/**
 * Normalizes a persisted or pasted dimension string into clean `"P x L x T"` without `"cm"`,
 * preserving descriptive non-numeric labels (e.g. `"Sesuai Gambar Kerja Lapangan"`).
 */
export function normalizeDimensionString(raw?: string | null): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';

  const withoutUnit = trimmed.replace(/(\d|\s|^)cm\b/gi, '$1').trim();
  const hasSeparator = /[x×*]/i.test(withoutUnit);

  if (hasSeparator) {
    const parts = parseDimensionParts(trimmed);
    const nonEmptyCount = parts.filter(Boolean).length;
    if (nonEmptyCount >= 2) {
      return formatDimensionParts(parts);
    }
    if (nonEmptyCount === 1) {
      return formatDimensionParts(parts);
    }
  }

  if (/^\d+(?:[.,]\d+)?$/.test(withoutUnit)) {
    return cleanNumericToken(withoutUnit, true);
  }

  return trimmed;
}

/**
 * Formats dimension data for formal documents, PDFs, previews, and tables where the
 * `(cm)` unit belongs in the table column header (`DIMENSI (cm)`).
 */
export function formatDocumentDimensionDisplay(raw?: string | null): string {
  return normalizeDimensionString(raw);
}

/**
 * Extracts `[lengthCm, heightOrWidthCm]` for area calculations (`P × T`) from either
 * 2-part (`"250 x 220"`) or 3-part (`"250 x 60 x 220"`) dimension strings.
 */
export function extractDimensionAreaPairCm(
  raw?: string | null
): { lengthCm: number; widthCm: number } | null {
  const [pStr, lStr, tStr] = parseDimensionParts(raw);
  const p = Number(pStr);
  const l = Number(lStr);
  const t = Number(tStr);

  if (!Number.isFinite(p) || p <= 0) return null;
  if (Number.isFinite(t) && t > 0) {
    return { lengthCm: Math.round(p), widthCm: Math.round(t) };
  }
  if (Number.isFinite(l) && l > 0) {
    return { lengthCm: Math.round(p), widthCm: Math.round(l) };
  }
  return null;
}
