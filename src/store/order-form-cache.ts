import type { CapturedCoordinates, CustomerFormValues } from '../pages/pesanan/types';

export const ORDER_FORM_STORAGE_KEY = 'shansusdzar-order-customer-v1';
export const ORDER_FORM_SCHEMA_VERSION = 1;

export interface PersistedOrderFormState {
  schemaVersion: number;
  values: CustomerFormValues;
  coordinates: CapturedCoordinates | null;
}

const EMPTY_FORM_VALUES: CustomerFormValues = {
  fullName: '',
  phone: '',
  address: '',
  notes: '',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeCoordinates(raw: unknown): CapturedCoordinates | null {
  if (!isRecord(raw)) return null;
  const latitude = typeof raw.latitude === 'number' && Number.isFinite(raw.latitude) ? raw.latitude : null;
  const longitude = typeof raw.longitude === 'number' && Number.isFinite(raw.longitude) ? raw.longitude : null;
  if (latitude === null || longitude === null) return null;

  const accuracyMeters =
    typeof raw.accuracyMeters === 'number' && Number.isFinite(raw.accuracyMeters)
      ? raw.accuracyMeters
      : 0;
  const capturedAtIso =
    typeof raw.capturedAtIso === 'string' && raw.capturedAtIso.trim()
      ? raw.capturedAtIso
      : new Date().toISOString();

  return {
    latitude,
    longitude,
    accuracyMeters,
    capturedAtIso,
  };
}

export function sanitizeOrderFormCache(raw: unknown): {
  values: CustomerFormValues;
  coordinates: CapturedCoordinates | null;
} {
  if (!isRecord(raw)) {
    return { values: { ...EMPTY_FORM_VALUES }, coordinates: null };
  }

  const valuesSource = isRecord(raw.values) ? raw.values : raw;

  return {
    values: {
      fullName: typeof valuesSource.fullName === 'string' ? valuesSource.fullName : '',
      phone: typeof valuesSource.phone === 'string' ? valuesSource.phone : '',
      address: typeof valuesSource.address === 'string' ? valuesSource.address : '',
      notes: typeof valuesSource.notes === 'string' ? valuesSource.notes : '',
    },
    coordinates: sanitizeCoordinates(raw.coordinates),
  };
}

export function loadPersistedOrderForm(): {
  values: CustomerFormValues;
  coordinates: CapturedCoordinates | null;
} {
  if (typeof window === 'undefined') {
    return { values: { ...EMPTY_FORM_VALUES }, coordinates: null };
  }

  try {
    const rawText = window.localStorage.getItem(ORDER_FORM_STORAGE_KEY);
    if (!rawText) {
      return { values: { ...EMPTY_FORM_VALUES }, coordinates: null };
    }

    const parsed: unknown = JSON.parse(rawText);
    if (!isRecord(parsed) || parsed.schemaVersion !== ORDER_FORM_SCHEMA_VERSION) {
      return { values: { ...EMPTY_FORM_VALUES }, coordinates: null };
    }

    return sanitizeOrderFormCache(parsed);
  } catch {
    return { values: { ...EMPTY_FORM_VALUES }, coordinates: null };
  }
}

export function savePersistedOrderForm(
  values: CustomerFormValues,
  coordinates: CapturedCoordinates | null
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedOrderFormState = {
      schemaVersion: ORDER_FORM_SCHEMA_VERSION,
      values: {
        fullName: values.fullName,
        phone: values.phone,
        address: values.address,
        notes: values.notes,
      },
      coordinates,
    };
    window.localStorage.setItem(ORDER_FORM_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private mode restrictions
  }
}

export function clearPersistedOrderForm(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ORDER_FORM_STORAGE_KEY);
  } catch {
    // Ignore storage access errors
  }
}

