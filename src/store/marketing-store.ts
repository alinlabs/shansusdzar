import { create } from 'zustand';
import marketingCampaignItemsData from '../data/daftar-kampanye-marketing.json';
import marketingCampaignsData from '../data/riwayat-kampanye-marketing.json';
import marketingContactsData from '../data/kontak-marketing.json';
import type {
  MarketingCampaign,
  MarketingCampaignLog,
  MarketingContact,
} from '../types/marketing';

export const MARKETING_STORAGE_KEY = 'shansusdzar-marketing-v1';

interface PersistedMarketingPayload {
  schemaVersion: number;
  updatedAt: string;
  contacts: MarketingContact[];
  campaignItems: MarketingCampaign[];
  campaigns: MarketingCampaignLog[];
}

const DEFAULT_CONTACTS = marketingContactsData as MarketingContact[];
const DEFAULT_CAMPAIGN_ITEMS = marketingCampaignItemsData as MarketingCampaign[];
const DEFAULT_CAMPAIGNS = marketingCampaignsData as MarketingCampaignLog[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadMarketingState(): PersistedMarketingPayload {
  const fallback: PersistedMarketingPayload = {
    schemaVersion: 2,
    updatedAt: '2026-11-20T09:00:00.000Z',
    contacts: structuredClone(DEFAULT_CONTACTS),
    campaignItems: structuredClone(DEFAULT_CAMPAIGN_ITEMS),
    campaigns: structuredClone(DEFAULT_CAMPAIGNS),
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(MARKETING_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== 2) return fallback;

    return {
      schemaVersion: 2,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : fallback.updatedAt,
      contacts: Array.isArray(parsed.contacts)
        ? (parsed.contacts as MarketingContact[])
        : fallback.contacts,
      campaignItems:
        Array.isArray(parsed.campaignItems) && parsed.campaignItems.length > 0
          ? (parsed.campaignItems as MarketingCampaign[])
          : fallback.campaignItems,
      campaigns: Array.isArray(parsed.campaigns)
        ? (parsed.campaigns as MarketingCampaignLog[])
        : fallback.campaigns,
    };
  } catch {
    return fallback;
  }
}

function saveMarketingState(payload: PersistedMarketingPayload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MARKETING_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export interface PublicProfileAdminSyncInput {
  profileId: string;
  fullName: string;
  phone: string;
  normalizedPhoneDigits: string;
  city: string;
  address: string;
  coordinatesLabel?: string | null;
  tags?: string[];
  activityNote?: string | null;
  nowIso?: string;
}

function buildWebProfileNote(input: PublicProfileAdminSyncInput): string {
  const parts: string[] = [`Alamat: ${input.address.trim()}`];
  if (input.coordinatesLabel?.trim()) {
    parts.push(`Koordinat: ${input.coordinatesLabel.trim()}`);
  }
  if (input.activityNote?.trim()) {
    parts.push(input.activityNote.trim());
  }
  return parts.join(' · ');
}

export function upsertPublicProfileContact(
  contacts: readonly MarketingContact[],
  input: PublicProfileAdminSyncInput
): MarketingContact[] {
  const cleanName = input.fullName.trim();
  const cleanDigits = input.normalizedPhoneDigits.replace(/\D/g, '');
  if (!cleanName || cleanDigits.length < 9) {
    return [...contacts];
  }

  const nowIso = input.nowIso || new Date().toISOString();
  const deterministicId = `mkt-usr-${input.profileId}`;
  const incomingTags = (input.tags ?? ['profil-user']).filter(Boolean);
  const nextWebNote = buildWebProfileNote(input);

  const existingIndex = contacts.findIndex(
    (item) => item.id === deterministicId || (item.teleponTerstandar && item.teleponTerstandar === cleanDigits)
  );

  if (existingIndex >= 0) {
    const existing = contacts[existingIndex];
    const mergedTags = Array.from(new Set([...existing.labelTag, ...incomingTags]));
    const updatedCatatan =
      existing.sumber === 'Form Pesanan Web'
        ? nextWebNote
        : existing.catatan.trim()
          ? `${existing.catatan.trim()} | ${nextWebNote}`
          : nextWebNote;

    const updatedContact: MarketingContact = {
      ...existing,
      nama: cleanName,
      telepon: input.phone.trim() || existing.telepon,
      teleponTerstandar: cleanDigits,
      kota: input.city.trim() || existing.kota || 'Purwakarta',
      labelTag: mergedTags,
      izinWhatsapp: true,
      catatan: updatedCatatan,
    };

    return contacts.map((item, idx) => (idx === existingIndex ? updatedContact : item));
  }

  const createdContact: MarketingContact = {
    id: deterministicId,
    nama: cleanName,
    namaPerusahaan: 'Pribadi',
    telepon: input.phone.trim(),
    teleponTerstandar: cleanDigits,
    email: '',
    kota: input.city.trim() || 'Purwakarta',
    segmen: 'Prospek Baru',
    sumber: 'Form Pesanan Web',
    labelTag: Array.from(new Set(incomingTags)),
    izinWhatsapp: true,
    izinEmail: false,
    catatan: nextWebNote,
    terakhirDihubungi: null,
    dibuatPada: nowIso,
  };

  return [createdContact, ...contacts];
}

interface MarketingStoreState extends PersistedMarketingPayload {
  upsertContact: (contact: MarketingContact) => void;
  syncPublicProfileContact: (input: PublicProfileAdminSyncInput) => void;
  importContacts: (contacts: readonly MarketingContact[]) => void;
  deleteContact: (contactId: string) => void;
  markContactsContacted: (contactIds: readonly string[], timestamp?: string) => void;
  upsertCampaignItem: (campaign: MarketingCampaign) => void;
  deleteCampaignItem: (campaignId: string) => void;
  markCampaignSent: (campaignId: string, sentCountDelta: number, timestamp?: string) => void;
  recordCampaignLog: (log: Omit<MarketingCampaignLog, 'id' | 'waktuKirim'>) => void;
  deleteCampaignLog: (logId: string) => void;
  resetMarketingDefaults: () => void;
}

function persistFromState(state: MarketingStoreState): void {
  saveMarketingState({
    schemaVersion: 2,
    updatedAt: state.updatedAt,
    contacts: state.contacts,
    campaignItems: state.campaignItems,
    campaigns: state.campaigns,
  });
}

const initialState = loadMarketingState();

export const useMarketingStore = create<MarketingStoreState>((set, get) => ({
  ...initialState,

  upsertContact: (contact) => {
    const state = get();
    const exists = state.contacts.some((item) => item.id === contact.id);
    const nextContacts = exists
      ? state.contacts.map((item) => (item.id === contact.id ? contact : item))
      : [contact, ...state.contacts];

    set({
      updatedAt: new Date().toISOString(),
      contacts: nextContacts,
    });
    persistFromState(get());
  },

  syncPublicProfileContact: (input) => {
    const state = get();
    const nextContacts = upsertPublicProfileContact(state.contacts, input);
    set({
      updatedAt: new Date().toISOString(),
      contacts: nextContacts,
    });
    persistFromState(get());
  },

  importContacts: (contacts) => {
    if (contacts.length === 0) return;
    const state = get();
    set({
      updatedAt: new Date().toISOString(),
      contacts: [...contacts, ...state.contacts],
    });
    persistFromState(get());
  },

  deleteContact: (contactId) => {
    set({
      updatedAt: new Date().toISOString(),
      contacts: get().contacts.filter((item) => item.id !== contactId),
    });
    persistFromState(get());
  },

  markContactsContacted: (contactIds, timestamp) => {
    if (contactIds.length === 0) return;
    const idSet = new Set(contactIds);
    const ts = timestamp || new Date().toISOString();
    set({
      updatedAt: ts,
      contacts: get().contacts.map((item) =>
        idSet.has(item.id) ? { ...item, terakhirDihubungi: ts } : item
      ),
    });
    persistFromState(get());
  },

  upsertCampaignItem: (campaign) => {
    const state = get();
    const exists = state.campaignItems.some((item) => item.id === campaign.id);
    const nextItems = exists
      ? state.campaignItems.map((item) => (item.id === campaign.id ? campaign : item))
      : [campaign, ...state.campaignItems];

    set({
      updatedAt: new Date().toISOString(),
      campaignItems: nextItems,
    });
    persistFromState(get());
  },

  deleteCampaignItem: (campaignId) => {
    set({
      updatedAt: new Date().toISOString(),
      campaignItems: get().campaignItems.filter((item) => item.id !== campaignId),
    });
    persistFromState(get());
  },

  markCampaignSent: (campaignId, sentCountDelta, timestamp) => {
    const ts = timestamp || new Date().toISOString();
    set({
      updatedAt: ts,
      campaignItems: get().campaignItems.map((item) =>
        item.id === campaignId
          ? {
              ...item,
              jumlahTerkirim: item.jumlahTerkirim + Math.max(0, sentCountDelta),
              terakhirDikirim: ts,
              diperbaruiPada: ts,
            }
          : item
      ),
    });
    persistFromState(get());
  },

  recordCampaignLog: (input) => {
    const newLog: MarketingCampaignLog = {
      ...input,
      id: `mkt-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      waktuKirim: new Date().toISOString(),
    };
    set({
      updatedAt: newLog.waktuKirim,
      campaigns: [newLog, ...get().campaigns],
    });
    persistFromState(get());
  },

  deleteCampaignLog: (logId) => {
    set({
      updatedAt: new Date().toISOString(),
      campaigns: get().campaigns.filter((item) => item.id !== logId),
    });
    persistFromState(get());
  },

  resetMarketingDefaults: () => {
    set({
      updatedAt: new Date().toISOString(),
      contacts: structuredClone(DEFAULT_CONTACTS),
      campaignItems: structuredClone(DEFAULT_CAMPAIGN_ITEMS),
      campaigns: structuredClone(DEFAULT_CAMPAIGNS),
    });
    persistFromState(get());
  },
}));
