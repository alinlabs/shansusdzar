export interface CurrencyFormatResult {
  /** Clean integer value (or null when input is empty) */
  numericValue: number | null;
  /** Formatted string with Indonesian "." thousand separators, e.g. "1.500.000" (or "" when empty) */
  formatted: string;
}

/**
 * Formats an integer amount with "." thousand separators (without "Rp" prefix,
 * since "Rp" lives inside the CurrencyInput visual prefix slot).
 */
export function formatNominalDigits(digits: string): string {
  const clean = digits.replace(/\D/g, '');
  if (!clean) return '';
  // Normalize leading zeros: "000" -> "0", "00500" -> "500"
  const normalized = clean.replace(/^0+(?=\d)/, '');
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatNominalNumber(
  value: number | null | undefined,
  options?: { zeroAsEmpty?: boolean }
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  const rounded = Math.max(0, Math.round(value));
  if (rounded === 0 && options?.zeroAsEmpty) return '';
  return formatNominalDigits(String(rounded));
}

export function parseNominalInput(rawInput: string): CurrencyFormatResult {
  const rawDigits = String(rawInput ?? '').replace(/\D/g, '');
  if (!rawDigits) {
    return { numericValue: null, formatted: '' };
  }
  const normalizedDigits = rawDigits.replace(/^0+(?=\d)/, '');
  const cappedDigits = normalizedDigits.slice(0, 15);
  const numericValue = Number(cappedDigits);
  if (!Number.isFinite(numericValue)) {
    return { numericValue: null, formatted: '' };
  }
  return {
    numericValue,
    formatted: formatNominalDigits(cappedDigits),
  };
}

/**
 * Computes formatted display value and exact caret position when typing/editing
 * nominal currency input with "." thousand separators.
 */
export function formatNominalWithCaret(params: {
  rawValue: string;
  rawCaret: number;
}): {
  formatted: string;
  numericValue: number | null;
  caret: number;
} {
  const { rawValue, rawCaret } = params;
  const parsed = parseNominalInput(rawValue);
  if (!parsed.formatted) {
    return { formatted: '', numericValue: null, caret: 0 };
  }

  const rawDigitsBeforeCaret = rawValue.slice(0, Math.max(0, rawCaret)).replace(/\D/g, '');
  // Adjust if user typed leading zeros before another digit
  const normalizedRawBefore = rawDigitsBeforeCaret.replace(/^0+(?=\d)/, '');
  const targetDigitCount =
    rawDigitsBeforeCaret.length > 0 && normalizedRawBefore.length === 0
      ? 1
      : Math.min(normalizedRawBefore.length, 15);

  if (targetDigitCount === 0) {
    return {
      formatted: parsed.formatted,
      numericValue: parsed.numericValue,
      caret: 0,
    };
  }

  let seenDigits = 0;
  let caretPos = parsed.formatted.length;
  for (let i = 0; i < parsed.formatted.length; i += 1) {
    if (/\d/.test(parsed.formatted[i])) {
      seenDigits += 1;
      caretPos = i + 1;
      if (seenDigits >= targetDigitCount) {
        break;
      }
    }
  }

  return {
    formatted: parsed.formatted,
    numericValue: parsed.numericValue,
    caret: caretPos,
  };
}
