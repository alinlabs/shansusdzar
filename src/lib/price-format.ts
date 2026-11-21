import type { PriceStatus } from '../types/product';

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function formatCurrencyIDR(amount: number | null | undefined): string | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return idrFormatter.format(Math.round(amount));
}

export interface ProductPriceDisplay {
  label: string;
  formattedAmount: string | null;
  isAvailable: boolean;
}

export function formatProductPrice(params: {
  price: number | null;
  priceFrom: number | null;
  priceStatus: PriceStatus;
}): ProductPriceDisplay {
  if (params.priceStatus === 'tetap') {
    const formatted = formatCurrencyIDR(params.price);
    if (formatted) {
      return {
        label: formatted,
        formattedAmount: formatted,
        isAvailable: true,
      };
    }
  }

  if (params.priceStatus === 'mulai') {
    const formatted = formatCurrencyIDR(params.priceFrom);
    if (formatted) {
      return {
        label: `Mulai dari ${formatted}`,
        formattedAmount: formatted,
        isAvailable: true,
      };
    }
  }

  return {
    label: 'Hubungi kami untuk harga',
    formattedAmount: null,
    isAvailable: false,
  };
}

export function formatPreliminaryEstimate(amount: number | null): string {
  const formatted = formatCurrencyIDR(amount);
  if (!formatted) {
    return 'Hubungi kami untuk estimasi';
  }
  return `Estimasi ${formatted}`;
}
