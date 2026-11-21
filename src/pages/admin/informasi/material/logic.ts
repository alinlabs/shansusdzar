import type { MaterialSpecItem } from '../../../../types/cms';

export interface MaterialFormDraft extends MaterialSpecItem {
  bestForText: string;
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
    ketahananLembap: 4,
    peringkatKeawetan: 4,
    tingkatHarga: 'Menengah',
    cocokUntuk: ['Kabinet Interior'],
    bestForText: 'Kabinet Interior',
    ringkasan: '',
    tipsPerawatan: '',
  };
}

export function toMaterialFormDraft(item: MaterialSpecItem): MaterialFormDraft {
  return {
    ...structuredClone(item),
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
  const { bestForText: _bft, ...rest } = draft;
  void _bft;
  return {
    ...rest,
    nama: draft.nama.trim(),
    ketahananLembap: Math.min(5, Math.max(1, Number(draft.ketahananLembap) || 1)),
    peringkatKeawetan: Math.min(5, Math.max(1, Number(draft.peringkatKeawetan) || 1)),
    cocokUntuk: draft.bestForText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    ringkasan: draft.ringkasan.trim(),
    tipsPerawatan: draft.tipsPerawatan.trim(),
  };
}
