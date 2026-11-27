import { getCustomServiceModeLabel } from '../../lib/custom-pricing';
import { formatCurrencyIDR } from '../../lib/price-format';
import type { CartItem } from '../../types/cart';
import type {
  CapturedCoordinates,
  CustomerFormErrors,
  CustomerFormValues,
} from './types';

export interface PhoneNormalizationResult {
  isValid: boolean;
  normalized: string;
  error?: string;
}

export function normalizeIndonesianPhone(rawInput: string): PhoneNormalizationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      isValid: false,
      normalized: '',
      error: 'Masukkan nomor telepon atau WhatsApp yang dapat dihubungi.',
    };
  }

  // Allow digits, leading +, spaces, hyphens, parentheses, and dots cleanly; reject letters/other chars.
  if (/[a-zA-Z]/.test(trimmed)) {
    return {
      isValid: false,
      normalized: '',
      error: 'Nomor telepon hanya boleh berisi angka, spasi, tanda hubung, atau awalan +.',
    };
  }

  const hasPlusPrefix = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (!digitsOnly) {
    return {
      isValid: false,
      normalized: '',
      error: 'Masukkan nomor telepon atau WhatsApp yang valid.',
    };
  }

  let normalizedDigits = digitsOnly;
  if (!hasPlusPrefix) {
    if (digitsOnly.startsWith('0')) {
      normalizedDigits = `62${digitsOnly.slice(1)}`;
    } else if (digitsOnly.startsWith('62')) {
      normalizedDigits = digitsOnly;
    } else if (digitsOnly.startsWith('8')) {
      normalizedDigits = `62${digitsOnly}`;
    }
  } else if (digitsOnly.startsWith('620')) {
    // Handle mistaken +6208... gracefully
    normalizedDigits = `62${digitsOnly.slice(3)}`;
  }

  // Indonesian numbers: 62 + 8..13 digits (total 10..15). International +... accepts 8..15 digits.
  const isIndonesian = normalizedDigits.startsWith('62');
  const minLength = isIndonesian ? 10 : 8;
  const maxLength = 15;

  if (normalizedDigits.length < minLength || normalizedDigits.length > maxLength) {
    return {
      isValid: false,
      normalized: '',
      error: isIndonesian
        ? 'Periksa kembali jumlah digit nomor Indonesia Anda (misal: 081234567890).'
        : 'Nomor telepon harus terdiri dari 8 hingga 15 digit.',
    };
  }

  return {
    isValid: true,
    normalized: `+${normalizedDigits}`,
  };
}

export function validateCustomerForm(values: CustomerFormValues): {
  isValid: boolean;
  errors: CustomerFormErrors;
  normalizedPhone: string;
} {
  const errors: CustomerFormErrors = {};
  const trimmedName = values.fullName.trim();
  const trimmedAddress = values.address.trim();

  if (!trimmedName) {
    errors.fullName = 'Masukkan nama lengkap Anda.';
  } else if (trimmedName.length < 2) {
    errors.fullName = 'Nama minimal terdiri dari 2 karakter.';
  }

  const phoneCheck = normalizeIndonesianPhone(values.phone);
  if (!phoneCheck.isValid) {
    errors.phone = phoneCheck.error ?? 'Nomor telepon tidak valid.';
  }

  if (!trimmedAddress) {
    errors.address = 'Masukkan alamat atau lokasi lengkap Anda.';
  } else if (trimmedAddress.length < 8) {
    errors.address = 'Alamat terlalu singkat. Cantumkan nama jalan, wilayah, atau patokan.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    normalizedPhone: phoneCheck.normalized,
  };
}

export function formatCoordinatesLabel(coords: CapturedCoordinates): string {
  const accuracyText =
    Number.isFinite(coords.accuracyMeters) && coords.accuracyMeters > 0
      ? ` (±${Math.round(coords.accuracyMeters)} m)`
      : '';
  return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}${accuracyText}`;
}

export function buildGeolocationErrorMessage(code: number | 'unsupported'): string {
  if (code === 'unsupported') {
    return 'Peramban atau perangkat ini tidak mendukung akses geolokasi. Silakan tulis alamat secara manual.';
  }
  if (code === 1) {
    return 'Akses lokasi belum diizinkan. Anda tetap dapat menuliskan alamat pengiriman atau survei secara manual di bawah.';
  }
  if (code === 2) {
    return 'Lokasi perangkat tidak dapat ditentukan saat ini. Silakan isi alamat lengkap secara manual.';
  }
  if (code === 3) {
    return 'Permintaan lokasi melebihi batas waktu. Anda dapat mencoba ulang atau mengisi alamat secara manual.';
  }
  return 'Gagal mengambil titik lokasi. Silakan lengkapi alamat secara manual.';
}

export function formatCartItemSpecifications(item: CartItem): string[] {
  if (item.kind === 'product') {
    const specs: string[] = [`Kategori: ${item.category}`];
    if (item.selectedColorName) {
      specs.push(`Warna: ${item.selectedColorName}`);
    }
    for (const [key, val] of Object.entries(item.selectedOptions)) {
      specs.push(`${key}: ${val}`);
    }
    return specs;
  }

  const serviceModeLabel = item.serviceModeLabel || getCustomServiceModeLabel(item.serviceMode);
  const dim = item.dimensions;
  const dimText = dim.height
    ? `${dim.length} × ${dim.width} × ${dim.height} ${dim.unit}`
    : `${dim.length} × ${dim.width} ${dim.unit}`;
  const convertedText =
    dim.unit === 'm'
      ? `(${dim.normalizedLengthCm} × ${dim.normalizedWidthCm}${dim.normalizedHeightCm ? ` × ${dim.normalizedHeightCm}` : ''} cm)`
      : '';
  const materialPrefix = item.serviceMode === 'design-only' ? 'Ref. Material' : 'Material';

  const specs: string[] = [
    `Layanan: ${serviceModeLabel}`,
    ...(item.projectTypeLabel?.trim() ? [`Ruangan: ${item.projectTypeLabel.trim()}`] : []),
    `Ukuran: ${dimText}${convertedText ? ` ${convertedText}` : ''}`,
    `${materialPrefix}: ${item.materialLabel}${item.finishLabel ? ` (${item.finishLabel})` : ''}`,
    `Warna: ${item.colorName}`,
  ];
  if (
    item.designAmount != null &&
    item.designAmount > 0 &&
    item.buildAmount != null &&
    item.buildAmount > 0
  ) {
    specs.push(
      `Rincian estimasi: Desain ${formatCurrencyIDR(item.designAmount)} + Build ${formatCurrencyIDR(item.buildAmount)}`
    );
  }
  if (item.additionalOptions.length > 0) {
    specs.push(`Opsi tambahan: ${item.additionalOptions.join(', ')}`);
  }
  if (item.notes.trim()) {
    specs.push(`Catatan item: ${item.notes.trim()}`);
  }
  return specs;
}
