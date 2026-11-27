import { create } from 'zustand';
import { formatDisplayDateId } from '../lib/date-utils';
import {
  readLocalCacheItem,
  registerStoreReloadHandler,
  removeLocalCacheItem,
  subscribeLocalCacheChange,
  writeLocalCacheItem,
} from '../lib/indexeddb-storage';
import type { CapturedCoordinates } from '../pages/pesanan/types';
import {
  formatCoordinatesLabel,
  normalizeIndonesianPhone,
  validateCustomerForm,
} from '../pages/pesanan/utils';
import {
  clearPersistedOrderForm,
  loadPersistedOrderForm,
  savePersistedOrderForm,
} from './order-form-cache';

export const USER_PROFILE_STORAGE_KEY = 'shansusdzar-user-profile-v1';
export const USER_PROFILE_SCHEMA_VERSION = 1;

export interface UserProfileData {
  profileId: string;
  fullName: string;
  phone: string;
  normalizedPhone: string;
  address: string;
  coordinates: CapturedCoordinates | null;
  updatedAt: string;
}

interface PersistedUserProfilePayload {
  schemaVersion: number;
  profile: UserProfileData;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createProfileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyUserProfile(existingId?: string): UserProfileData {
  return {
    profileId: existingId && existingId.trim() ? existingId.trim() : createProfileId(),
    fullName: '',
    phone: '',
    normalizedPhone: '',
    address: '',
    coordinates: null,
    updatedAt: '',
  };
}

function sanitizeCoordinates(raw: unknown): CapturedCoordinates | null {
  if (!isRecord(raw)) return null;
  const latitude =
    typeof raw.latitude === 'number' && Number.isFinite(raw.latitude) ? raw.latitude : null;
  const longitude =
    typeof raw.longitude === 'number' && Number.isFinite(raw.longitude) ? raw.longitude : null;
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

export function sanitizeUserProfile(raw: unknown): UserProfileData {
  if (!isRecord(raw)) {
    return createEmptyUserProfile();
  }

  const source = isRecord(raw.profile) ? raw.profile : raw;
  const profileId =
    typeof source.profileId === 'string' && source.profileId.trim()
      ? source.profileId.trim()
      : createProfileId();
  const fullName = typeof source.fullName === 'string' ? source.fullName : '';
  const phone = typeof source.phone === 'string' ? source.phone : '';
  const phoneCheck = normalizeIndonesianPhone(phone);
  const normalizedPhone =
    typeof source.normalizedPhone === 'string' && source.normalizedPhone.trim()
      ? source.normalizedPhone.trim()
      : phoneCheck.isValid
        ? phoneCheck.normalized
        : '';
  const address = typeof source.address === 'string' ? source.address : '';
  const coordinates = sanitizeCoordinates(source.coordinates);
  const updatedAt = typeof source.updatedAt === 'string' ? source.updatedAt : '';

  return {
    profileId,
    fullName,
    phone,
    normalizedPhone,
    address,
    coordinates,
    updatedAt,
  };
}

export function isUserProfileComplete(profile: Pick<UserProfileData, 'fullName' | 'phone' | 'address'>): boolean {
  const result = validateCustomerForm({
    fullName: profile.fullName,
    phone: profile.phone,
    address: profile.address,
    notes: '',
  });
  return result.isValid;
}

const KNOWN_CITIES = [
  'Purwakarta',
  'Karawang',
  'Subang',
  'Bandung',
  'Bekasi',
  'Cikarang',
  'Cikampek',
  'Jakarta',
  'Bogor',
  'Depok',
  'Tangerang',
];

export function extractCityFromAddress(address: string): string {
  const clean = address.trim();
  if (!clean) return 'Purwakarta';

  const lower = clean.toLowerCase();
  for (const city of KNOWN_CITIES) {
    if (lower.includes(city.toLowerCase())) {
      return city;
    }
  }

  const segments = clean
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !/^\d{5}$/.test(part));

  if (segments.length >= 2) {
    const candidate = segments[segments.length - 1]
      .replace(/^(kab\.?|kabupaten|kota)\s+/i, '')
      .trim();
    if (candidate.length >= 3 && candidate.length <= 40) {
      return candidate;
    }
  }

  return 'Purwakarta';
}

export function resolveSafeInternalRedirect(rawRedirect?: string | null): string | null {
  if (!rawRedirect) return null;
  const trimmed = rawRedirect.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null;
  }
  const pathOnly = trimmed.split('?')[0].split('#')[0];
  if (
    pathOnly === '/profil' ||
    pathOnly === '/akun' ||
    pathOnly === '/profile' ||
    pathOnly === '/pengaturan' ||
    pathOnly === '/settings'
  ) {
    return null;
  }
  return trimmed;
}

export function buildSurveyRequestWhatsAppMessage(params: {
  brandName: string;
  profile: UserProfileData;
  contextLabel?: string;
  surveyDateIso?: string;
  surveyNotes?: string;
}): string {
  const cleanBrand = params.brandName.trim() || 'Shansus Dzar Indonesia';
  const phoneDisplay = params.profile.normalizedPhone || params.profile.phone.trim();
  const formattedDate = params.surveyDateIso
    ? formatDisplayDateId(params.surveyDateIso, 'long')
    : '';
  const cleanNotes = params.surveyNotes?.trim() || '';
  const lines = [
    `Halo ${cleanBrand},`,
    params.contextLabel?.trim()
      ? params.contextLabel.trim()
      : 'Saya ingin mengajukan permintaan survei lokasi & pengukuran interior.',
    '',
    'Data Pemesan:',
    `- Nama: ${params.profile.fullName.trim()}`,
    `- Telepon/WA: ${phoneDisplay}`,
    `- Lokasi/Alamat: ${params.profile.address.trim()}`,
    params.profile.coordinates
      ? `- Koordinat: ${formatCoordinatesLabel(params.profile.coordinates)}`
      : null,
    formattedDate ? '' : null,
    formattedDate || cleanNotes ? 'Detail Permintaan Survei:' : null,
    formattedDate ? `- Tanggal Survei: ${formattedDate}` : null,
    cleanNotes ? `- Catatan: ${cleanNotes}` : null,
    '',
    'Mohon informasikan ketersediaan jadwal survei tersebut. Terima kasih.',
  ];
  return lines.filter((line): line is string => line !== null).join('\n');
}

export function appendProfileToWhatsAppMessage(
  baseMessage: string,
  profile: UserProfileData
): string {
  if (!isUserProfileComplete(profile)) {
    return baseMessage;
  }
  const phoneDisplay = profile.normalizedPhone || profile.phone.trim();
  const profileBlock = [
    '',
    'Data Pemesan:',
    `- Nama: ${profile.fullName.trim()}`,
    `- Telepon/WA: ${phoneDisplay}`,
    `- Lokasi/Alamat: ${profile.address.trim()}`,
    profile.coordinates ? `- Koordinat: ${formatCoordinatesLabel(profile.coordinates)}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  return `${baseMessage.trimEnd()}\n${profileBlock}`;
}

function loadInitialUserProfile(): UserProfileData {
  if (typeof window === 'undefined') {
    return createEmptyUserProfile();
  }

  try {
    const raw = readLocalCacheItem(USER_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed) && parsed.schemaVersion === USER_PROFILE_SCHEMA_VERSION) {
        return sanitizeUserProfile(parsed);
      }
    }
  } catch {
    // Fallback to order-form cache migration or empty profile
  }

  // Migrate any existing saved customer draft so user does not lose previously typed data
  const legacyDraft = loadPersistedOrderForm();
  const hasLegacyValues = Boolean(
    legacyDraft.values.fullName.trim() ||
      legacyDraft.values.phone.trim() ||
      legacyDraft.values.address.trim() ||
      legacyDraft.coordinates
  );

  if (hasLegacyValues) {
    const phoneCheck = normalizeIndonesianPhone(legacyDraft.values.phone);
    return {
      profileId: createProfileId(),
      fullName: legacyDraft.values.fullName,
      phone: legacyDraft.values.phone,
      normalizedPhone: phoneCheck.isValid ? phoneCheck.normalized : '',
      address: legacyDraft.values.address,
      coordinates: legacyDraft.coordinates,
      updatedAt: new Date().toISOString(),
    };
  }

  return createEmptyUserProfile();
}

function persistUserProfileToLocalStorage(profile: UserProfileData): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedUserProfilePayload = {
      schemaVersion: USER_PROFILE_SCHEMA_VERSION,
      profile,
    };
    writeLocalCacheItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage serialization restrictions
  }
}

function syncProfileSilentlyToAdmin(
  profile: UserProfileData,
  activityNote?: string,
  extraTags: string[] = []
): void {
  if (!isUserProfileComplete(profile)) return;
  const phoneDigits = (profile.normalizedPhone || profile.phone).replace(/\D/g, '');
  if (phoneDigits.length < 9) return;

  const coordinatesLabel = profile.coordinates
    ? formatCoordinatesLabel(profile.coordinates)
    : null;
  const city = extractCityFromAddress(profile.address);
  const nowIso = profile.updatedAt || new Date().toISOString();

  void import('./marketing-store')
    .then(({ useMarketingStore }) => {
      useMarketingStore.getState().syncPublicProfileContact({
        profileId: profile.profileId,
        fullName: profile.fullName,
        phone: profile.normalizedPhone || profile.phone,
        normalizedPhoneDigits: phoneDigits,
        city,
        address: profile.address,
        coordinatesLabel,
        tags: ['profil-user', ...extraTags],
        activityNote: activityNote ?? 'Menyimpan profil pelanggan via web',
        nowIso,
      });
    })
    .catch(() => {
      // Silent admin sync should never interrupt public user experience
    });
}

export type ProfileModalIntent = 'pesanan' | 'survei' | 'general';

export interface ProfileModalRequest {
  intent: ProfileModalIntent;
  title?: string;
  description?: string;
  submitLabel?: string;
  surveyContextLabel?: string;
  surveyActivityNote?: string;
}

export interface SurveyModalRequest {
  surveyContextLabel?: string;
  surveyActivityNote?: string;
}

export interface ProfileModalCopy {
  title: string;
  description?: string;
  submitLabel: string;
}

export function resolveProfileModalCopy(
  request: ProfileModalRequest,
  hasExistingProfile: boolean
): ProfileModalCopy {
  if (request.intent === 'survei') {
    return {
      title: request.title ?? 'Data Pemesan',
      description: request.description,
      submitLabel: request.submitLabel ?? 'Simpan & Lanjut',
    };
  }

  if (request.intent === 'pesanan') {
    return {
      title: request.title ?? (hasExistingProfile ? 'Ubah Data Pemesan' : 'Data Pemesan'),
      description: request.description,
      submitLabel:
        request.submitLabel ??
        (hasExistingProfile ? 'Simpan Perubahan' : 'Simpan & Lanjutkan'),
    };
  }

  return {
    title: request.title ?? 'Data Pengguna',
    description: request.description,
    submitLabel: request.submitLabel ?? 'Simpan Data',
  };
}

export interface SaveUserProfileInput {
  fullName: string;
  phone: string;
  address: string;
  coordinates: CapturedCoordinates | null;
}

export interface SaveUserProfileResult {
  ok: boolean;
  profile?: UserProfileData;
  errors?: {
    fullName?: string;
    phone?: string;
    address?: string;
  };
}

interface UserProfileStoreState {
  profile: UserProfileData;
  modalRequest: ProfileModalRequest | null;
  surveyModalRequest: SurveyModalRequest | null;
  openProfileModal: (request?: Partial<ProfileModalRequest>) => void;
  closeProfileModal: () => void;
  openSurveyModal: (request?: SurveyModalRequest) => void;
  closeSurveyModal: () => void;
  requestSurvey: (request?: SurveyModalRequest) => void;
  saveProfile: (input: SaveUserProfileInput) => SaveUserProfileResult;
  syncProfileActivity: (activityNote: string, extraTags?: string[]) => void;
  reloadFromStorage: () => void;
  clearProfile: () => void;
}

const initialProfile = loadInitialUserProfile();

export const useUserProfileStore = create<UserProfileStoreState>((set, get) => ({
  profile: initialProfile,
  modalRequest: null,
  surveyModalRequest: null,

  openProfileModal: (request) => {
    set({
      modalRequest: {
        intent: request?.intent ?? 'general',
        title: request?.title,
        description: request?.description,
        submitLabel: request?.submitLabel,
        surveyContextLabel: request?.surveyContextLabel,
        surveyActivityNote: request?.surveyActivityNote,
      },
    });
  },

  closeProfileModal: () => {
    set({ modalRequest: null });
  },

  openSurveyModal: (request) => {
    set({
      modalRequest: null,
      surveyModalRequest: request ?? {},
    });
  },

  closeSurveyModal: () => {
    set({ surveyModalRequest: null });
  },

  requestSurvey: (request) => {
    if (isUserProfileComplete(get().profile)) {
      set({
        modalRequest: null,
        surveyModalRequest: request ?? {},
      });
      return;
    }

    set({
      surveyModalRequest: null,
      modalRequest: {
        intent: 'survei',
        surveyContextLabel: request?.surveyContextLabel,
        surveyActivityNote: request?.surveyActivityNote,
      },
    });
  },

  saveProfile: (input) => {
    const check = validateCustomerForm({
      fullName: input.fullName,
      phone: input.phone,
      address: input.address,
      notes: '',
    });

    if (!check.isValid) {
      return { ok: false, errors: check.errors };
    }

    const current = get().profile;
    const nextProfile: UserProfileData = {
      profileId: current.profileId || createProfileId(),
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      normalizedPhone: check.normalizedPhone,
      address: input.address.trim(),
      coordinates: input.coordinates,
      updatedAt: new Date().toISOString(),
    };

    set({ profile: nextProfile });
    persistUserProfileToLocalStorage(nextProfile);

    // Keep legacy order-form cache aligned (preserving any existing order notes)
    const existingOrderCache = loadPersistedOrderForm();
    savePersistedOrderForm(
      {
        fullName: nextProfile.fullName,
        phone: nextProfile.phone,
        address: nextProfile.address,
        notes: existingOrderCache.values.notes,
      },
      nextProfile.coordinates
    );

    // Silently store/update in Admin Marketing Database
    syncProfileSilentlyToAdmin(nextProfile, 'Menyimpan profil pelanggan via web');

    return { ok: true, profile: nextProfile };
  },

  syncProfileActivity: (activityNote, extraTags = []) => {
    const current = get().profile;
    syncProfileSilentlyToAdmin(current, activityNote, extraTags);
  },

  reloadFromStorage: () => {
    set({ profile: loadInitialUserProfile() });
  },

  clearProfile: () => {
    const nextEmpty = createEmptyUserProfile();
    set({ profile: nextEmpty });
    if (typeof window !== 'undefined') {
      try {
        removeLocalCacheItem(USER_PROFILE_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    }
    clearPersistedOrderForm();
  },
}));

registerStoreReloadHandler(() => {
  useUserProfileStore.getState().reloadFromStorage();
});

if (typeof window !== 'undefined') {
  subscribeLocalCacheChange(USER_PROFILE_STORAGE_KEY, () => {
    useUserProfileStore.setState({ profile: loadInitialUserProfile() });
  });
}
