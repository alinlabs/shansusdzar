import type { MaterialSpecItem } from '../../../../types/cms';

export interface MaterialFormDraft extends MaterialSpecItem {
  bestForText: string;
  kelebihanText: string;
}

export interface MaterialValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function createEmptyMaterialDraft(): MaterialFormDraft {
  return {
    id: `mat-${Date.now()}`,
    nama: '',
    kategori: 'papan',
    ketahananLembap: 75,
    peringkatKeawetan: 80,
    keterjangkauan: 75,
    terbuatDari: '',
    kelebihan: [],
    kelebihanText: '',
    gambarReferensi: '',
    cocokUntuk: ['Kabinet Interior'],
    bestForText: 'Kabinet Interior',
    ringkasan: '',
    tipsPerawatan: '',
  };
}

export function toMaterialFormDraft(item: MaterialSpecItem): MaterialFormDraft {
  return {
    ...structuredClone(item),
    keterjangkauan: item.keterjangkauan ?? 75,
    terbuatDari: item.terbuatDari ?? '',
    kelebihanText: (item.kelebihan ?? []).join('\n'),
    gambarReferensi: item.gambarReferensi ?? '',
    bestForText: item.cocokUntuk.join(', '),
  };
}

export function validateMaterialDraft(draft: MaterialFormDraft): MaterialValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!draft.nama.trim()) {
    fieldErrors.nama = 'Nama material wajib diisi.';
  }
  const keys = Object.keys(fieldErrors);
  if (keys.length > 0) {
    return {
      valid: false,
      formError: fieldErrors[keys[0]] ?? 'Periksa kolom spesifikasi material.',
      fieldErrors,
    };
  }
  return { valid: true, formError: null, fieldErrors: {} };
}

export function normalizeMaterialFromDraft(draft: MaterialFormDraft): MaterialSpecItem {
  const { bestForText: _bft, kelebihanText: _kt, ...rest } = draft;
  void _bft;
  void _kt;
  const kelebihan = draft.kelebihanText
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const terbuatDari = (draft.terbuatDari ?? '').trim();
  const gambarReferensi = (draft.gambarReferensi ?? '').trim();

  return {
    ...rest,
    nama: draft.nama.trim(),
    ketahananLembap: Math.min(100, Math.max(0, Math.round(Number(draft.ketahananLembap) || 0))),
    peringkatKeawetan: Math.min(100, Math.max(0, Math.round(Number(draft.peringkatKeawetan) || 0))),
    keterjangkauan: Math.min(100, Math.max(0, Math.round(Number(draft.keterjangkauan) || 0))),
    terbuatDari,
    kelebihan,
    gambarReferensi,
    cocokUntuk: draft.bestForText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5),
    ringkasan: draft.ringkasan.trim(),
    tipsPerawatan: draft.tipsPerawatan.trim(),
  };
}
