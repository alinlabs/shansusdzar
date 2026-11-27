export interface PhoneNormalizationInfo {
  /** Normalized country-code digits without leading +, e.g. "6281234567890" */
  digits: string;
  /** Subscriber digits after "62" (for Indonesian numbers) */
  subscriberDigits: string;
  /** Canonical E.164 string, e.g. "+6281234567890" (or "" when empty) */
  e164: string;
  /** Visual formatted string, e.g. "+62 812-3456-7890" (or "+62 " when prefix only, "" when empty) */
  formatted: string;
  isIndonesian: boolean;
  isPrefixOnly: boolean;
}

export interface IndonesianPhoneValidation {
  isValid: boolean;
  normalized: string;
  error?: string;
}

export const MAX_INDONESIAN_SUBSCRIBER_DIGITS = 13; // 62 + 13 = 15 digits (ITU-T E.164 max)
export const MIN_INDONESIAN_SUBSCRIBER_DIGITS = 8; // 62 + 8 = 10 digits min

/**
 * Formats Indonesian subscriber digits (after +62) into 3-4-4-4 groups:
 * e.g. "81234567890" -> "812-3456-7890"
 *      "8123456789012" -> "812-3456-7890-12"
 */
export function formatIndonesianSubscriberGroups(subscriberDigits: string): string {
  const clean = subscriberDigits.replace(/\D/g, '').slice(0, MAX_INDONESIAN_SUBSCRIBER_DIGITS);
  if (!clean) return '';

  const parts: string[] = [];
  parts.push(clean.slice(0, 3));
  if (clean.length > 3) parts.push(clean.slice(3, 7));
  if (clean.length > 7) parts.push(clean.slice(7, 11));
  if (clean.length > 11) parts.push(clean.slice(11, 15));
  return parts.join('-');
}

/**
 * Formats a client phone number into the Indonesian local document display standard
 * (`08xx-xxxx-xxxx`), without altering stored E.164 / raw values or form inputs.
 */
export function formatDocumentPhoneDisplay(rawInput?: string | null): string {
  const trimmed = String(rawInput ?? '').trim();
  if (!trimmed || trimmed === '-') return '';

  const info = parseIndonesianPhoneInput(trimmed);
  if (!info.digits) {
    return trimmed.replace(/\D/g, '') ? '' : trimmed;
  }

  if (!info.isIndonesian) {
    return info.formatted || trimmed;
  }

  if (!info.subscriberDigits) return '';
  return `0${formatIndonesianSubscriberGroups(info.subscriberDigits)}`;
}

/**
 * Normalizes any Indonesian phone input variation (from typing, paste, or hydrated store data)
 * into clean canonical +62 digits and "+62 8XX-XXXX-XXXX-XXXX" display format.
 */
export function parseIndonesianPhoneInput(
  rawInput: string,
  options?: { preservePrefixOnly?: boolean }
): PhoneNormalizationInfo {
  const preservePrefixOnly = options?.preservePrefixOnly ?? false;
  const trimmed = String(rawInput ?? '').trim();

  if (!trimmed) {
    return {
      digits: '',
      subscriberDigits: '',
      e164: '',
      formatted: '',
      isIndonesian: true,
      isPrefixOnly: false,
    };
  }

  const hasPlus = trimmed.startsWith('+');
  const rawDigits = trimmed.replace(/\D/g, '');

  if (!rawDigits) {
    if (preservePrefixOnly && trimmed === '+') {
      return {
        digits: '62',
        subscriberDigits: '',
        e164: '',
        formatted: '+62 ',
        isIndonesian: true,
        isPrefixOnly: true,
      };
    }
    return {
      digits: '',
      subscriberDigits: '',
      e164: '',
      formatted: '',
      isIndonesian: true,
      isPrefixOnly: false,
    };
  }

  // Non-Indonesian international number explicitly entered with + (not +62)
  if (hasPlus && !rawDigits.startsWith('62') && !(rawDigits === '6' && trimmed === '+6')) {
    const intlDigits = rawDigits.slice(0, 15);
    return {
      digits: intlDigits,
      subscriberDigits: intlDigits,
      e164: `+${intlDigits}`,
      formatted: `+${intlDigits}`,
      isIndonesian: false,
      isPrefixOnly: false,
    };
  }

  let subscriber = '';
  let prefixOnly = false;

  if (!hasPlus) {
    if (rawDigits === '0' || rawDigits === '6') {
      prefixOnly = true;
      subscriber = '';
    } else if (rawDigits.startsWith('0')) {
      subscriber = rawDigits.slice(1);
    } else if (rawDigits.startsWith('620')) {
      subscriber = rawDigits.slice(3);
    } else if (rawDigits.startsWith('62')) {
      subscriber = rawDigits.slice(2);
      if (!subscriber) prefixOnly = true;
    } else {
      // Covers "8...", "12345679", etc.
      subscriber = rawDigits;
    }
  } else {
    if (rawDigits === '6' || rawDigits === '62') {
      prefixOnly = true;
      subscriber = '';
    } else if (rawDigits.startsWith('620')) {
      subscriber = rawDigits.slice(3);
    } else if (rawDigits.startsWith('62')) {
      subscriber = rawDigits.slice(2);
    } else {
      subscriber = rawDigits;
    }
  }

  // Handle mistaken "+62 62 812..." or "0062..."
  if (subscriber.startsWith('0')) {
    subscriber = subscriber.replace(/^0+/, '');
  }

  subscriber = subscriber.slice(0, MAX_INDONESIAN_SUBSCRIBER_DIGITS);

  if (!subscriber) {
    if (preservePrefixOnly && prefixOnly) {
      return {
        digits: '62',
        subscriberDigits: '',
        e164: '',
        formatted: '+62 ',
        isIndonesian: true,
        isPrefixOnly: true,
      };
    }
    return {
      digits: '',
      subscriberDigits: '',
      e164: '',
      formatted: '',
      isIndonesian: true,
      isPrefixOnly: false,
    };
  }

  const grouped = formatIndonesianSubscriberGroups(subscriber);
  const fullDigits = `62${subscriber}`;

  return {
    digits: fullDigits,
    subscriberDigits: subscriber,
    e164: `+${fullDigits}`,
    formatted: `+62 ${grouped}`,
    isIndonesian: true,
    isPrefixOnly: false,
  };
}

/**
 * Computes formatted display string and next caret index when editing a controlled PhoneInput.
 */
export function formatPhoneWithCaret(params: {
  rawValue: string;
  rawCaret: number;
  previousFormatted?: string;
}): {
  formatted: string;
  e164: string;
  digits: string;
  caret: number;
} {
  const { rawValue, rawCaret, previousFormatted = '' } = params;

  // If user is backspacing inside or at the end of "+62 " prefix with no subscriber digits, clear completely.
  if (
    previousFormatted === '+62 ' &&
    rawValue.length < previousFormatted.length &&
    rawValue.replace(/\D/g, '') === '62'
  ) {
    return { formatted: '', e164: '', digits: '', caret: 0 };
  }

  // If user deleted part of "+62" itself (e.g. selected "+6" or backspaced on "+62 " leaving "62" or "+6")
  if (previousFormatted.startsWith('+62 ') && !rawValue.startsWith('+62')) {
    const prevDigits = previousFormatted.replace(/\D/g, '');
    const currDigits = rawValue.replace(/\D/g, '');
    if (currDigits.length < prevDigits.length && !rawValue.startsWith('0')) {
      // User deleted inside the "+62" prefix; clear prefix if no subscriber digits remain
      const subscriberOnly = currDigits.startsWith('6') ? currDigits.slice(1) : currDigits;
      if (!subscriberOnly || currDigits.length <= 2) {
        return { formatted: '', e164: '', digits: '', caret: 0 };
      }
    }
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { formatted: '', e164: '', digits: '', caret: 0 };
  }

  const info = parseIndonesianPhoneInput(rawValue, { preservePrefixOnly: true });
  if (!info.formatted) {
    return { formatted: '', e164: '', digits: '', caret: 0 };
  }

  if (info.isPrefixOnly) {
    return {
      formatted: info.formatted,
      e164: info.e164,
      digits: info.digits,
      caret: info.formatted.length,
    };
  }

  // Map caret based on how many subscriber digits appeared before rawCaret.
  const prefixSlice = rawValue.slice(0, Math.max(0, rawCaret));
  const rawDigitsBeforeCaret = prefixSlice.replace(/\D/g, '');

  let subscriberDigitsBeforeCaret = 0;
  if (info.isIndonesian) {
    const fullRawDigits = rawValue.replace(/\D/g, '');
    if (rawValue.startsWith('+62') || fullRawDigits.startsWith('62')) {
      if (rawDigitsBeforeCaret.startsWith('620')) {
        subscriberDigitsBeforeCaret = Math.max(0, rawDigitsBeforeCaret.length - 3);
      } else if (rawDigitsBeforeCaret.startsWith('62')) {
        subscriberDigitsBeforeCaret = Math.max(0, rawDigitsBeforeCaret.length - 2);
      } else {
        // Caret was inside "+62" prefix
        subscriberDigitsBeforeCaret = 0;
      }
    } else if (rawDigitsBeforeCaret.startsWith('0')) {
      subscriberDigitsBeforeCaret = Math.max(0, rawDigitsBeforeCaret.length - 1);
    } else {
      subscriberDigitsBeforeCaret = rawDigitsBeforeCaret.length;
    }
  } else {
    subscriberDigitsBeforeCaret = rawDigitsBeforeCaret.length;
  }

  // Locate position in formatted string right after passing `subscriberDigitsBeforeCaret` subscriber digits
  const formatted = info.formatted;
  if (!info.isIndonesian) {
    let seen = 0;
    let targetPos = 1; // after '+'
    for (let i = 0; i < formatted.length; i += 1) {
      if (/\d/.test(formatted[i])) {
        seen += 1;
        targetPos = i + 1;
        if (seen >= subscriberDigitsBeforeCaret) break;
      }
    }
    return {
      formatted,
      e164: info.e164,
      digits: info.digits,
      caret: subscriberDigitsBeforeCaret === 0 ? 1 : targetPos,
    };
  }

  const prefixLen = 4; // "+62 "
  if (subscriberDigitsBeforeCaret <= 0) {
    return {
      formatted,
      e164: info.e164,
      digits: info.digits,
      caret: Math.min(prefixLen, formatted.length),
    };
  }

  let seenSub = 0;
  let caretPos = prefixLen;
  for (let i = prefixLen; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i])) {
      seenSub += 1;
      caretPos = i + 1;
      if (seenSub >= subscriberDigitsBeforeCaret) {
        break;
      }
    }
  }

  return {
    formatted,
    e164: info.e164,
    digits: info.digits,
    caret: caretPos,
  };
}

/**
 * Handles smart paste normalization so pasting any Indonesian phone format
 * ("081234567890", "6281234567890", "+6281234567890", "+62 812-3456-7890", "81234567890")
 * yields a clean, non-duplicated formatted phone number.
 */
export function normalizePastedPhone(pastedText: string): PhoneNormalizationInfo {
  const cleaned = String(pastedText ?? '').trim();
  if (!cleaned) {
    return parseIndonesianPhoneInput('');
  }
  // Normalize accidental double country codes like "+62 62 812..." or "6262812..."
  const digits = cleaned.replace(/\D/g, '');
  if (digits.startsWith('6262') && digits.length >= 12) {
    return parseIndonesianPhoneInput(`+${digits.slice(2)}`);
  }
  return parseIndonesianPhoneInput(cleaned);
}

/**
 * Validates an Indonesian (or explicit +intl) phone string for form submission.
 */
export function validateIndonesianPhoneNumber(rawInput: string): IndonesianPhoneValidation {
  const trimmed = String(rawInput ?? '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      normalized: '',
      error: 'Masukkan nomor telepon atau WhatsApp yang dapat dihubungi.',
    };
  }

  if (/[a-zA-Z]/.test(trimmed)) {
    return {
      isValid: false,
      normalized: '',
      error: 'Nomor telepon hanya boleh berisi angka, spasi, tanda hubung, atau awalan +.',
    };
  }

  const info = parseIndonesianPhoneInput(trimmed);
  if (!info.digits) {
    return {
      isValid: false,
      normalized: '',
      error: 'Masukkan nomor telepon atau WhatsApp yang valid.',
    };
  }

  if (info.isIndonesian) {
    const subLen = info.subscriberDigits.length;
    if (subLen < MIN_INDONESIAN_SUBSCRIBER_DIGITS || subLen > MAX_INDONESIAN_SUBSCRIBER_DIGITS) {
      return {
        isValid: false,
        normalized: '',
        error: 'Nomor telepon Indonesia harus terdiri dari 8 hingga 13 digit setelah +62.',
      };
    }
    return {
      isValid: true,
      normalized: info.e164,
    };
  }

  if (info.digits.length < 8 || info.digits.length > 15) {
    return {
      isValid: false,
      normalized: '',
      error: 'Nomor telepon harus terdiri dari 8 hingga 15 digit.',
    };
  }

  return {
    isValid: true,
    normalized: info.e164,
  };
}
