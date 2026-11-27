import type { FaqItem } from '../../../../types/cms';

export interface FaqValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function createEmptyFaq(nextOrder: number): FaqItem {
  return {
    id: `faq-${Date.now()}`,
    kategori: 'Survei & Pemesanan',
    pertanyaan: '',
    jawaban: '',
    urutan: Math.max(1, nextOrder),
    terbit: true,
  };
}

export function validateFaqDraft(faq: FaqItem): FaqValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!faq.kategori.trim()) {
    fieldErrors.kategori = 'Kategori FAQ wajib diisi.';
  }
  if (!faq.pertanyaan.trim()) {
    fieldErrors.pertanyaan = 'Pertanyaan wajib diisi.';
  }
  if (!faq.jawaban.trim()) {
    fieldErrors.jawaban = 'Jawaban wajib diisi.';
  }
  const keys = Object.keys(fieldErrors);
  if (keys.length > 0) {
    return {
      valid: false,
      formError: fieldErrors[keys[0]] ?? 'Lengkapi kolom FAQ.',
      fieldErrors,
    };
  }
  return { valid: true, formError: null, fieldErrors: {} };
}

export function normalizeFaqPayload(faq: FaqItem): FaqItem {
  return {
    ...faq,
    kategori: faq.kategori.trim(),
    pertanyaan: faq.pertanyaan.trim(),
    jawaban: faq.jawaban.trim(),
    urutan: Math.max(1, Number(faq.urutan) || 1),
    terbit: Boolean(faq.terbit),
  };
}
