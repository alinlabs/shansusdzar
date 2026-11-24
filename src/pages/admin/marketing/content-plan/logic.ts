import socialLookupsData from '../../../../data/referensi-konten-sosmed.json';
import type {
  SocialMediaFormat,
  SocialMediaPlanItem,
  SocialMediaPlanStatus,
  SocialMediaPlatform,
} from '../../../../types/cms';

export const SOCIAL_PLATFORMS: SocialMediaPlatform[] =
  socialLookupsData.daftarPlatform as SocialMediaPlatform[];
export const SOCIAL_FORMATS: SocialMediaFormat[] =
  socialLookupsData.daftarFormat as SocialMediaFormat[];
export const SOCIAL_STATUSES: SocialMediaPlanStatus[] =
  socialLookupsData.daftarStatus as SocialMediaPlanStatus[];
export const SOCIAL_PILLARS: readonly string[] = socialLookupsData.daftarPilar;

export interface SocialPlanValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function createEmptySocialPlan(): SocialMediaPlanItem {
  return {
    id: `smp-${Date.now()}`,
    judul: '',
    platform: 'Instagram',
    format: 'Reels / Video Pendek',
    pilar: 'Behind the Workshop',
    tanggalTerjadwal: new Date().toISOString().slice(0, 10),
    jamTerjadwal: '19:00',
    status: 'Ide',
    kalimatPembuka: '',
    takaranKonten: '',
    tagar: '#ShansusdzarIndonesia #InteriorPurwakarta #FurnitureCustom',
    targetAksi: '/produk/custom',
    namaPenanggungJawab: 'Aisyah Rahma',
    catatan: '',
  };
}

export function validateSocialPlanDraft(item: SocialMediaPlanItem): SocialPlanValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!item.judul.trim()) {
    fieldErrors.judul = 'Judul kampanye atau topik konten wajib diisi.';
  }
  if (!item.tanggalTerjadwal.trim()) {
    fieldErrors.tanggalTerjadwal = 'Tanggal tayang wajib diisi.';
  }
  const keys = Object.keys(fieldErrors);
  if (keys.length > 0) {
    return {
      valid: false,
      formError: fieldErrors[keys[0]] ?? 'Lengkapi kolom wajib rencana konten.',
      fieldErrors,
    };
  }
  return { valid: true, formError: null, fieldErrors: {} };
}

export function normalizeSocialPlanPayload(item: SocialMediaPlanItem): SocialMediaPlanItem {
  return {
    ...item,
    judul: item.judul.trim(),
    kalimatPembuka: item.kalimatPembuka.trim(),
    takaranKonten: item.takaranKonten.trim(),
    tagar: item.tagar.trim(),
    targetAksi: item.targetAksi.trim(),
    namaPenanggungJawab: item.namaPenanggungJawab.trim() || 'Tim Konten',
    catatan: item.catatan.trim(),
  };
}

export function buildSocialPlansCsv(plans: readonly SocialMediaPlanItem[]): string {
  const header = [
    'Tanggal',
    'Jam',
    'Platform',
    'Format',
    'Pilar',
    'Status',
    'Judul Konten',
    'Hook Pembuka',
    'Caption',
    'Hashtags',
    'CTA Target',
    'PIC',
  ];
  const escapeCell = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const rows = plans.map((p) =>
    [
      p.tanggalTerjadwal,
      p.jamTerjadwal,
      p.platform,
      p.format,
      p.pilar,
      p.status,
      p.judul,
      p.kalimatPembuka,
      p.takaranKonten,
      p.tagar,
      p.targetAksi,
      p.namaPenanggungJawab,
    ]
      .map(escapeCell)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

export function exportSocialPlansCsv(plans: readonly SocialMediaPlanItem[]) {
  const csv = buildSocialPlansCsv(plans);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sosmed-planning-shansusdzar-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
