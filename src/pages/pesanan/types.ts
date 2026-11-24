export interface CustomerFormValues {
  fullName: string;
  phone: string;
  address: string;
  notes: string;
}

export interface CustomerFormErrors {
  fullName?: string;
  phone?: string;
  address?: string;
}

export type GeolocationStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'denied'
  | 'timeout'
  | 'unavailable'
  | 'error';

export interface CapturedCoordinates {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAtIso: string;
}

export interface GeolocationState {
  status: GeolocationStatus;
  coordinates: CapturedCoordinates | null;
  message: string | null;
}

export interface ValidatedCustomerData {
  fullName: string;
  rawPhone: string;
  normalizedPhone: string;
  address: string;
  notes: string;
  coordinates: CapturedCoordinates | null;
}
