import siteProfileData from '../data/bisnis.json';
import type { BusinessBankAccount, BusinessConfig } from '../types/business';

export const BUSINESS_CONFIG: BusinessConfig = siteProfileData.profilUsaha as BusinessConfig;

export const DEFAULT_WORKSHOP_BANK_ACCOUNT: BusinessBankAccount = {
  namaBank: 'BNI',
  namaLengkapBank: 'Bank Negara Indonesia (BNI)',
  kodeBank: '009',
  nomorRekening: '1905207398',
  atasNama: 'Hilman Aziz Napis',
  cabang: 'KC Purwakarta',
  logoUrl: '/bni.webp',
};

export const DEFAULT_WORKSHOP_BSI_BANK_ACCOUNT: BusinessBankAccount = {
  namaBank: 'BSI',
  namaLengkapBank: 'Bank Syariah Indonesia (BSI)',
  kodeBank: '451',
  nomorRekening: '7370860534',
  atasNama: 'Hilman Aziz Napis',
  logoUrl: '/bsi.webp',
};

export const DEFAULT_WORKSHOP_BANK_ACCOUNTS: BusinessBankAccount[] = [
  DEFAULT_WORKSHOP_BANK_ACCOUNT,
  DEFAULT_WORKSHOP_BSI_BANK_ACCOUNT,
];

function resolveDefaultLogoForBank(bank?: Partial<BusinessBankAccount> | null): string | undefined {
  const rawUrl = bank?.logoUrl?.trim();
  if (rawUrl && rawUrl !== '/bni.png') {
    return rawUrl;
  }
  const code = `${bank?.namaBank ?? ''} ${bank?.namaLengkapBank ?? ''}`.toUpperCase();
  if (code.includes('BSI') || code.includes('SYARIAH')) {
    return '/bsi.webp';
  }
  if (code.includes('BNI') || code.includes('NEGARA INDONESIA')) {
    return '/bni.webp';
  }
  return rawUrl === '/bni.png' ? '/bni.webp' : undefined;
}

function normalizeBankAccountEntry(
  raw: Partial<BusinessBankAccount> | null | undefined,
  fallback: BusinessBankAccount
): BusinessBankAccount {
  return {
    namaBank: raw?.namaBank?.trim() || fallback.namaBank,
    namaLengkapBank: raw?.namaLengkapBank?.trim() || fallback.namaLengkapBank,
    kodeBank: raw?.kodeBank?.trim() || fallback.kodeBank,
    nomorRekening: raw?.nomorRekening?.trim() || fallback.nomorRekening,
    atasNama: raw?.atasNama?.trim() || fallback.atasNama,
    cabang: raw?.cabang?.trim() || fallback.cabang,
    logoUrl: resolveDefaultLogoForBank(raw) ?? fallback.logoUrl,
  };
}

export function resolveWorkshopBankAccount(
  businessConfig?: Partial<BusinessConfig> | null
): BusinessBankAccount {
  const bank = businessConfig?.rekeningBank ?? businessConfig?.daftarRekeningBank?.[0];
  return normalizeBankAccountEntry(bank, DEFAULT_WORKSHOP_BANK_ACCOUNT);
}

export function resolveWorkshopBankAccounts(
  businessConfig?: Partial<BusinessConfig> | null
): BusinessBankAccount[] {
  const list = Array.isArray(businessConfig?.daftarRekeningBank)
    ? businessConfig.daftarRekeningBank.filter(
        (item): item is BusinessBankAccount =>
          Boolean(item && (item.nomorRekening?.trim() || item.namaBank?.trim()))
      )
    : [];

  if (list.length > 0) {
    return list.map((entry, idx) =>
      normalizeBankAccountEntry(
        entry,
        DEFAULT_WORKSHOP_BANK_ACCOUNTS[idx] ?? DEFAULT_WORKSHOP_BANK_ACCOUNT
      )
    );
  }

  const primary = resolveWorkshopBankAccount(businessConfig);
  const hasBsi = primary.namaBank.toUpperCase().includes('BSI');
  return hasBsi
    ? [primary]
    : [primary, { ...DEFAULT_WORKSHOP_BSI_BANK_ACCOUNT }];
}

export function formatWorkshopBankAccountsText(
  businessConfig?: Partial<BusinessConfig> | null
): string {
  const accounts = resolveWorkshopBankAccounts(businessConfig);
  if (accounts.length === 0) {
    return `${DEFAULT_WORKSHOP_BANK_ACCOUNT.namaBank} ${DEFAULT_WORKSHOP_BANK_ACCOUNT.nomorRekening} a.n. ${DEFAULT_WORKSHOP_BANK_ACCOUNT.atasNama}`;
  }
  const uniqueHolders = Array.from(new Set(accounts.map((acc) => acc.atasNama.trim())));
  if (uniqueHolders.length === 1) {
    const accountList = accounts
      .map((acc) => `${acc.namaBank} ${acc.nomorRekening}`)
      .join(' atau ');
    return `${accountList} a.n. ${uniqueHolders[0]}`;
  }
  return accounts
    .map((acc) => `${acc.namaBank} ${acc.nomorRekening} a.n. ${acc.atasNama}`)
    .join(' atau ');
}

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

export const FORMAL_DOCUMENT_HEADER_META = {
  tagline: 'Interior Design & Building',
  website: 'www.shansusdzar.com',
  email: 'shansusdzar@gmail.com',
} as const;

export function formatFormalDocumentAddress(address: string): string {
  const normalized = address
    .trim()
    .replace(/\bKecamatan\s+/gi, 'Kec. ')
    .replace(/\bKabupaten\s+/gi, 'Kab. ')
    .replace(/\s+/g, ' ');
  if (!normalized) return '-';
  return normalized.endsWith('.') ? normalized : `${normalized}.`;
}

export function formatFormalDocumentContacts(whatsappDisplay: string): string {
  const wa = whatsappDisplay.trim() || BUSINESS_CONFIG.whatsapp.nomorTampil;
  return `${FORMAL_DOCUMENT_HEADER_META.website} · ${FORMAL_DOCUMENT_HEADER_META.email} · ${wa}`;
}

