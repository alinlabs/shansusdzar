import type { ServicePolicyItem } from '../../../../types/cms';

export interface PolicyValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function createEmptyPolicy(): ServicePolicyItem {
  return {
    id: `pol-${Date.now()}`,
    judul: '',
    ringkasan: '',
    rincian: '',
  };
}

export function validatePolicyDraft(policy: ServicePolicyItem): PolicyValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!policy.judul.trim()) {
    fieldErrors.judul = 'Judul kebijakan layanan wajib diisi.';
  }
  const keys = Object.keys(fieldErrors);
  if (keys.length > 0) {
    return {
      valid: false,
      formError: fieldErrors[keys[0]] ?? 'Periksa kolom kebijakan layanan.',
      fieldErrors,
    };
  }
  return { valid: true, formError: null, fieldErrors: {} };
}

export function normalizePolicyPayload(policy: ServicePolicyItem): ServicePolicyItem {
  return {
    ...policy,
    judul: policy.judul.trim(),
    ringkasan: policy.ringkasan.trim(),
    rincian: policy.rincian.trim(),
  };
}
