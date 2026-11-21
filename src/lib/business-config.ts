import businessConfigData from '../data/konfigurasi-bisnis.json';
import type { BusinessConfig } from '../types/business';

export const BUSINESS_CONFIG: BusinessConfig = businessConfigData as BusinessConfig;

export function buildWhatsAppUrl(message?: string): string {
  if (!message || !message.trim()) {
    return BUSINESS_CONFIG.whatsapp.urlDasar;
  }
  return `${BUSINESS_CONFIG.whatsapp.urlDasar}?text=${encodeURIComponent(message.trim())}`;
}

export function buildMapsSearchUrl(): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    BUSINESS_CONFIG.alamat.alamatLengkap
  )}`;
}
