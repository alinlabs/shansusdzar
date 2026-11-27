import marketingLookupsData from '../../../../data/referensi-marketing.json';
import {
  formatClientCode,
  resolveNextClientSequence,
} from '../../../../lib/document-numbering';
import {
  formatKabupatenShort,
  normalizeClientWilayahAddress,
  type ClientWilayahAddress,
} from '../../../../lib/wilayah-indonesia';
import type { CooperationAgreementDocument } from '../../../../types/documents';
import type { ProjectInvoice } from '../../../../types/finance';
import type {
  MarketingContact,
  MarketingContactSegment,
  MarketingContactSource,
  MarketingTemplate,
} from '../../../../types/marketing';

export const MARKETING_SEGMENTS: MarketingContactSegment[] =
  marketingLookupsData.daftarSegmen as MarketingContactSegment[];

export const MARKETING_SOURCES: MarketingContactSource[] =
  marketingLookupsData.daftarSumber as MarketingContactSource[];

export const WHATSAPP_TEMPLATES: MarketingTemplate[] =
  marketingLookupsData.templatWhatsapp as MarketingTemplate[];

export const EMAIL_TEMPLATES: MarketingTemplate[] =
  marketingLookupsData.templatEmail as MarketingTemplate[];

export interface MarketingContactFormDraft {
  id: string;
  clientCode: string;
  name: string;
  companyName: string;
  phone: string;
  email: string;
  city: string;
  alamat?: ClientWilayahAddress;
  segment: MarketingContactSegment;
  source: MarketingContactSource;
  tagsText: string;
  allowWhatsApp: boolean;
  allowEmail: boolean;
  notes: string;
  lastContactedAt: string | null;
  createdAt: string;
}

export interface ContactValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function normalizeWhatsAppDigits(rawPhone: string): string {
  const digits = String(rawPhone ?? '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
}

export function isValidWhatsAppDigits(digits: string): boolean {
  return digits.length >= 9 && digits.length <= 15;
}

export function isValidEmailAddress(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function createEmptyContactDraft(clientCode = ''): MarketingContactFormDraft {
  return {
    id: `mkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    clientCode,
    name: '',
    companyName: '',
    phone: '',
    email: '',
    city: 'Purwakarta',
    alamat: undefined,
    segment: 'Prospek Baru',
    source: 'Manual Admin',
    tagsText: '',
    allowWhatsApp: true,
    allowEmail: true,
    notes: '',
    lastContactedAt: null,
    createdAt: new Date().toISOString(),
  };
}

export function toContactFormDraft(contact: MarketingContact): MarketingContactFormDraft {
  return {
    id: contact.id,
    clientCode: contact.kodeKlien ?? '',
    name: contact.nama,
    companyName: contact.namaPerusahaan,
    phone: contact.telepon,
    email: contact.email,
    city: contact.kota,
    alamat: contact.alamat ? structuredClone(contact.alamat) : undefined,
    segment: contact.segmen,
    source: contact.sumber,
    tagsText: contact.labelTag.join(', '),
    allowWhatsApp: contact.izinWhatsapp,
    allowEmail: contact.izinEmail,
    notes: contact.catatan,
    lastContactedAt: contact.terakhirDihubungi,
    createdAt: contact.dibuatPada,
  };
}

export function validateContactDraft(draft: MarketingContactFormDraft): ContactValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!draft.name.trim()) {
    fieldErrors.name = 'Nama kontak wajib diisi.';
  }

  const normalizedPhone = normalizeWhatsAppDigits(draft.phone);
  const trimmedEmail = draft.email.trim();

  if (!draft.phone.trim() && !trimmedEmail) {
    fieldErrors.phone = 'Isi minimal nomor WhatsApp atau alamat email.';
    fieldErrors.email = 'Isi minimal alamat email atau nomor WhatsApp.';
  } else {
    if (draft.phone.trim() && !isValidWhatsAppDigits(normalizedPhone)) {
      fieldErrors.phone = 'Format nomor WhatsApp tidak valid (minimal 9 digit angka).';
    }
    if (trimmedEmail && !isValidEmailAddress(trimmedEmail)) {
      fieldErrors.email = 'Format alamat email tidak valid.';
    }
  }

  if (draft.alamat?.provinsi?.id) {
    if (!draft.alamat.kabupaten?.id) {
      fieldErrors['alamat.kabupaten'] = 'Kabupaten / Kota wajib dipilih.';
    } else if (!draft.alamat.kecamatan?.id) {
      fieldErrors['alamat.kecamatan'] = 'Kecamatan wajib dipilih.';
    } else if (!draft.alamat.desa?.id) {
      fieldErrors['alamat.desa'] = 'Desa / Kelurahan wajib dipilih.';
    }
  }

  const keys = Object.keys(fieldErrors);
  if (keys.length > 0) {
    return {
      valid: false,
      formError: fieldErrors[keys[0]] ?? 'Periksa kembali kolom kontak yang wajib diisi.',
      fieldErrors,
    };
  }

  return { valid: true, formError: null, fieldErrors: {} };
}

export function normalizeContactFromDraft(draft: MarketingContactFormDraft): MarketingContact {
  const normalizedPhone = normalizeWhatsAppDigits(draft.phone);
  const tags = draft.tagsText
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const cleanAlamat = normalizeClientWilayahAddress(draft.alamat);
  const resolvedCity =
    formatKabupatenShort(cleanAlamat?.kabupaten?.name) ||
    draft.city.trim() ||
    'Purwakarta';

  return {
    id: draft.id,
    kodeKlien: draft.clientCode.trim().toUpperCase() || undefined,
    nama: draft.name.trim(),
    namaPerusahaan: draft.companyName.trim() || 'Pribadi',
    telepon: draft.phone.trim(),
    teleponTerstandar: normalizedPhone,
    email: draft.email.trim().toLowerCase(),
    kota: resolvedCity,
    ...(cleanAlamat ? { alamat: cleanAlamat } : {}),
    segmen: draft.segment,
    sumber: draft.source,
    labelTag: Array.from(new Set(tags)),
    izinWhatsapp: draft.allowWhatsApp && isValidWhatsAppDigits(normalizedPhone),
    izinEmail: draft.allowEmail && isValidEmailAddress(draft.email),
    catatan: draft.notes.trim(),
    terakhirDihubungi: draft.lastContactedAt,
    dibuatPada: draft.createdAt || new Date().toISOString(),
  };
}

export function filterMarketingContacts(
  contacts: readonly MarketingContact[],
  filters: {
    search?: string;
    segment?: 'all' | MarketingContactSegment;
    source?: 'all' | MarketingContactSource;
    channel?: 'all' | 'wa' | 'email';
  }
): MarketingContact[] {
  const q = (filters.search ?? '').trim().toLowerCase();
  const segment = filters.segment ?? 'all';
  const source = filters.source ?? 'all';
  const channel = filters.channel ?? 'all';

  return contacts.filter((c) => {
    if (segment !== 'all' && c.segmen !== segment) return false;
    if (source !== 'all' && c.sumber !== source) return false;
    if (channel === 'wa' && !(c.izinWhatsapp && isValidWhatsAppDigits(c.teleponTerstandar))) {
      return false;
    }
    if (channel === 'email' && !(c.izinEmail && isValidEmailAddress(c.email))) {
      return false;
    }
    if (q) {
      const hay =
        `${c.kodeKlien ?? ''} ${c.nama} ${c.namaPerusahaan} ${c.telepon} ${c.teleponTerstandar} ${c.email} ${c.kota} ${c.alamat?.desa?.name ?? ''} ${c.alamat?.kecamatan?.name ?? ''} ${c.alamat?.kabupaten?.name ?? ''} ${c.alamat?.provinsi?.name ?? ''} ${c.alamat?.detail ?? ''} ${c.labelTag.join(' ')} ${c.catatan}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function interpolateMarketingTemplate(
  template: string,
  contact: Pick<MarketingContact, 'nama' | 'kota' | 'segmen' | 'namaPerusahaan'>
): string {
  const firstOrFullName = contact.nama.trim() || 'Bapak/Ibu';
  const city = contact.kota.trim() || 'lokasi Anda';
  const segment = contact.segmen || 'Pelanggan';
  const company =
    contact.namaPerusahaan.trim() && contact.namaPerusahaan.trim() !== 'Pribadi'
      ? contact.namaPerusahaan.trim()
      : firstOrFullName;

  return template
    .replace(/\{nama\}/gi, firstOrFullName)
    .replace(/\{kota\}/gi, city)
    .replace(/\{segmen\}/gi, segment)
    .replace(/\{perusahaan\}/gi, company);
}

export function buildWhatsAppBroadcastUrl(
  contact: Pick<MarketingContact, 'teleponTerstandar' | 'telepon'>,
  renderedMessage: string
): string {
  const digits = isValidWhatsAppDigits(contact.teleponTerstandar)
    ? contact.teleponTerstandar
    : normalizeWhatsAppDigits(contact.telepon);
  if (!isValidWhatsAppDigits(digits)) return '';
  const text = renderedMessage.trim();
  if (!text) return `https://wa.me/${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function buildPersonalMailtoUrl(
  email: string,
  subject: string,
  body: string
): string {
  const cleanEmail = email.trim();
  if (!isValidEmailAddress(cleanEmail)) return '';
  const params = new URLSearchParams();
  if (subject.trim()) params.set('subject', subject.trim());
  if (body.trim()) params.set('body', body.trim());
  const query = params.toString().replace(/\+/g, '%20');
  return query ? `mailto:${cleanEmail}?${query}` : `mailto:${cleanEmail}`;
}

export interface EmailBccBatch {
  batchNumber: number;
  emails: string[];
  mailtoUrl: string;
}

export function buildBccMailtoBatches(
  emails: readonly string[],
  subject: string,
  body: string,
  replyToEmail = '',
  batchSize = 20
): EmailBccBatch[] {
  const validEmails = Array.from(
    new Set(emails.map((e) => e.trim().toLowerCase()).filter(isValidEmailAddress))
  );
  if (validEmails.length === 0) return [];

  const safeBatchSize = Math.max(1, Math.min(50, batchSize));
  const batches: EmailBccBatch[] = [];

  for (let i = 0; i < validEmails.length; i += safeBatchSize) {
    const slice = validEmails.slice(i, i + safeBatchSize);
    const params = new URLSearchParams();
    params.set('bcc', slice.join(','));
    if (subject.trim()) params.set('subject', subject.trim());
    if (body.trim()) params.set('body', body.trim());
    const query = params.toString().replace(/\+/g, '%20');
    const targetTo = isValidEmailAddress(replyToEmail) ? replyToEmail.trim() : '';
    batches.push({
      batchNumber: batches.length + 1,
      emails: slice,
      mailtoUrl: `mailto:${targetTo}?${query}`,
    });
  }

  return batches;
}

export function buildEmlDraftContent(params: {
  fromEmail?: string;
  bccEmails: readonly string[];
  subject: string;
  body: string;
}): string {
  const validBcc = params.bccEmails.filter(isValidEmailAddress);
  const lines = [
    `From: ${params.fromEmail || 'admin@shansusdzar.id'}`,
    ...(validBcc.length > 0 ? [`Bcc: ${validBcc.join(', ')}`] : []),
    `Subject: ${params.subject.trim() || 'Informasi Shansusdzar Indonesia'}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    params.body,
  ];
  return lines.join('\r\n');
}

export function syncContactsFromWorkshopRecords(
  existingContacts: readonly MarketingContact[],
  invoices: readonly ProjectInvoice[],
  agreements: readonly CooperationAgreementDocument[]
): { imported: MarketingContact[]; skippedCount: number } {
  const existingPhones = new Set(
    existingContacts.map((c) => c.teleponTerstandar).filter((p) => p.length > 0)
  );
  const existingNames = new Set(
    existingContacts.map((c) => c.nama.trim().toLowerCase()).filter(Boolean)
  );

  const imported: MarketingContact[] = [];
  let nextSeq = resolveNextClientSequence(existingContacts);
  let skippedCount = 0;

  const tryAddCandidate = (candidate: {
    clientCode?: string;
    name: string;
    phone: string;
    city?: string;
    segment: MarketingContactSegment;
    notes: string;
  }) => {
    const cleanName = candidate.name.trim();
    if (!cleanName) return;

    const normalizedPhone = normalizeWhatsAppDigits(candidate.phone);
    const nameKey = cleanName.toLowerCase();

    if (
      (normalizedPhone && existingPhones.has(normalizedPhone)) ||
      existingNames.has(nameKey)
    ) {
      skippedCount += 1;
      return;
    }

    if (normalizedPhone) existingPhones.add(normalizedPhone);
    existingNames.add(nameKey);

    const assignedCode = candidate.clientCode?.trim() || formatClientCode(nextSeq);
    if (!candidate.clientCode?.trim()) {
      nextSeq += 1;
    }

    imported.push({
      id: `mkt-sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kodeKlien: assignedCode,
      nama: cleanName,
      namaPerusahaan: 'Pribadi',
      telepon: candidate.phone.trim(),
      teleponTerstandar: normalizedPhone,
      email: '',
      kota: candidate.city?.trim() || 'Purwakarta',
      segmen: candidate.segment,
      sumber: 'Invoice / SPK',
      labelTag: ['sinkron-workshop'],
      izinWhatsapp: isValidWhatsAppDigits(normalizedPhone),
      izinEmail: false,
      catatan: candidate.notes,
      terakhirDihubungi: null,
      dibuatPada: new Date().toISOString(),
    });
  };

  for (const spks of agreements) {
    tryAddCandidate({
      name: spks.namaPihakKedua,
      phone: spks.teleponPihakKedua || '',
      city: spks.kotaPenandatanganan,
      segment: spks.status === 'Selesai' ? 'Klien Selesai' : 'Klien Aktif',
      notes: `Disinkronkan dari Kontrak ${spks.nomorKontrak} (${spks.judulProyek}).`,
    });
  }

  for (const inv of invoices) {
    tryAddCandidate({
      clientCode: inv.projectId,
      name: inv.namaKlien,
      phone: '',
      city: inv.lokasi,
      segment: inv.status === 'Lunas' ? 'Klien Selesai' : 'Klien Aktif',
      notes: `Disinkronkan dari Invoice ${inv.nomorInvoice} (${inv.namaProyek}).`,
    });
  }

  return { imported, skippedCount };
}

export function buildMarketingContactsCsv(contacts: readonly MarketingContact[]): string {
  const header = [
    'Kode Klien',
    'Nama',
    'Perusahaan',
    'WhatsApp',
    'Nomor WA Normal',
    'Email',
    'Kota',
    'Segmen',
    'Sumber',
    'Opt-In WA',
    'Opt-In Email',
    'Tag',
    'Catatan',
  ];
  const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = contacts.map((c) =>
    [
      c.kodeKlien ?? '',
      c.nama,
      c.namaPerusahaan,
      c.telepon,
      c.teleponTerstandar,
      c.email,
      c.kota,
      c.segmen,
      c.sumber,
      c.izinWhatsapp ? 'Ya' : 'Tidak',
      c.izinEmail ? 'Ya' : 'Tidak',
      c.labelTag.join('; '),
      c.catatan,
    ]
      .map(escapeCell)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

export function parseCsvContactsInput(
  rawText: string,
  existingContacts: readonly MarketingContact[]
): { imported: MarketingContact[]; skippedCount: number } {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { imported: [], skippedCount: 0 };
  }

  const existingPhones = new Set(
    existingContacts.map((c) => c.teleponTerstandar).filter((p) => p.length > 0)
  );
  const existingEmails = new Set(
    existingContacts.map((c) => c.email.trim().toLowerCase()).filter(Boolean)
  );

  const imported: MarketingContact[] = [];
  let nextSeq = resolveNextClientSequence(existingContacts);
  let skippedCount = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const cols = rawLine
      .split(',')
      .map((cell) => cell.trim().replace(/^"|"$/g, '').trim());

    if (i === 0 && (cols[0]?.toLowerCase() === 'nama' || cols[0]?.toLowerCase() === 'kode klien')) {
      continue;
    }

    const name = cols[0] ?? '';
    const phone = cols[1] ?? '';
    const email = (cols[2] ?? '').toLowerCase();
    const city = cols[3] || 'Purwakarta';
    const rawSegment = cols[4] ?? '';

    const normalizedPhone = normalizeWhatsAppDigits(phone);
    const hasPhone = isValidWhatsAppDigits(normalizedPhone);
    const hasEmail = isValidEmailAddress(email);

    if (!name || (!hasPhone && !hasEmail)) {
      skippedCount += 1;
      continue;
    }

    if ((hasPhone && existingPhones.has(normalizedPhone)) || (hasEmail && existingEmails.has(email))) {
      skippedCount += 1;
      continue;
    }

    if (hasPhone) existingPhones.add(normalizedPhone);
    if (hasEmail) existingEmails.add(email);

    const matchedSegment = MARKETING_SEGMENTS.includes(rawSegment as MarketingContactSegment)
      ? (rawSegment as MarketingContactSegment)
      : 'Prospek Baru';

    imported.push({
      id: `mkt-imp-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
      kodeKlien: formatClientCode(nextSeq),
      nama: name,
      namaPerusahaan: 'Pribadi',
      telepon: phone,
      teleponTerstandar: normalizedPhone,
      email,
      kota: city,
      segmen: matchedSegment,
      sumber: 'Manual Admin',
      labelTag: ['impor-csv'],
      izinWhatsapp: hasPhone,
      izinEmail: hasEmail,
      catatan: '',
      terakhirDihubungi: null,
      dibuatPada: new Date().toISOString(),
    });
    nextSeq += 1;
  }

  return { imported, skippedCount };
}
