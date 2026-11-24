import { create } from 'zustand';
import defaultAgreementsData from '../data/dokumen-spks.json';
import defaultHandoverCertificatesData from '../data/dokumen-bast.json';
import defaultWorkOrdersData from '../data/dokumen-spk.json';
import type {
  CooperationAgreementDocument,
  HandoverCertificateDocument,
  WorkOrderDocument,
} from '../types/documents';

export const DOCUMENTS_STORAGE_KEY = 'shansusdzar-documents-v1';

export const DEFAULT_WORK_ORDERS: WorkOrderDocument[] =
  defaultWorkOrdersData as WorkOrderDocument[];

export const DEFAULT_AGREEMENTS: CooperationAgreementDocument[] =
  defaultAgreementsData as CooperationAgreementDocument[];

export const DEFAULT_HANDOVER_CERTIFICATES: HandoverCertificateDocument[] =
  defaultHandoverCertificatesData as HandoverCertificateDocument[];

interface PersistedDocumentsPayload {
  schemaVersion: number;
  updatedAt: string;
  workOrders: WorkOrderDocument[];
  agreements: CooperationAgreementDocument[];
  handoverCertificates: HandoverCertificateDocument[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadDocumentsState(): PersistedDocumentsPayload {
  const fallback: PersistedDocumentsPayload = {
    schemaVersion: 2,
    updatedAt: '2026-11-20T09:00:00.000Z',
    workOrders: structuredClone(DEFAULT_WORK_ORDERS),
    agreements: structuredClone(DEFAULT_AGREEMENTS),
    handoverCertificates: structuredClone(DEFAULT_HANDOVER_CERTIFICATES),
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(DOCUMENTS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== 2) return fallback;

    return {
      schemaVersion: 2,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : fallback.updatedAt,
      workOrders: Array.isArray(parsed.workOrders)
        ? (parsed.workOrders as WorkOrderDocument[])
        : fallback.workOrders,
      agreements: Array.isArray(parsed.agreements)
        ? (parsed.agreements as CooperationAgreementDocument[])
        : fallback.agreements,
      handoverCertificates: Array.isArray(parsed.handoverCertificates)
        ? (parsed.handoverCertificates as HandoverCertificateDocument[])
        : fallback.handoverCertificates,
    };
  } catch {
    return fallback;
  }
}

function saveDocumentsState(payload: PersistedDocumentsPayload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

interface DocumentsStoreState extends PersistedDocumentsPayload {
  upsertWorkOrder: (doc: WorkOrderDocument) => void;
  deleteWorkOrder: (id: string) => void;
  upsertAgreement: (doc: CooperationAgreementDocument) => void;
  deleteAgreement: (id: string) => void;
  upsertHandoverCertificate: (doc: HandoverCertificateDocument) => void;
  deleteHandoverCertificate: (id: string) => void;
  resetDocumentsDefaults: () => void;
}

function persistFromState(state: DocumentsStoreState): void {
  saveDocumentsState({
    schemaVersion: 2,
    updatedAt: state.updatedAt,
    workOrders: state.workOrders,
    agreements: state.agreements,
    handoverCertificates: state.handoverCertificates,
  });
}

const initialDocuments = loadDocumentsState();

export const useDocumentsStore = create<DocumentsStoreState>((set, get) => ({
  ...initialDocuments,

  upsertWorkOrder: (doc) => {
    const existing = get().workOrders;
    const exists = existing.some((item) => item.id === doc.id);
    const next = exists ? existing.map((item) => (item.id === doc.id ? doc : item)) : [doc, ...existing];
    set({ updatedAt: new Date().toISOString(), workOrders: next });
    persistFromState(get());
  },

  deleteWorkOrder: (id) => {
    set({
      updatedAt: new Date().toISOString(),
      workOrders: get().workOrders.filter((item) => item.id !== id),
    });
    persistFromState(get());
  },

  upsertAgreement: (doc) => {
    const existing = get().agreements;
    const exists = existing.some((item) => item.id === doc.id);
    const next = exists ? existing.map((item) => (item.id === doc.id ? doc : item)) : [doc, ...existing];
    set({ updatedAt: new Date().toISOString(), agreements: next });
    persistFromState(get());
  },

  deleteAgreement: (id) => {
    set({
      updatedAt: new Date().toISOString(),
      agreements: get().agreements.filter((item) => item.id !== id),
    });
    persistFromState(get());
  },

  upsertHandoverCertificate: (doc) => {
    const existing = get().handoverCertificates;
    const exists = existing.some((item) => item.id === doc.id);
    const next = exists ? existing.map((item) => (item.id === doc.id ? doc : item)) : [doc, ...existing];
    set({ updatedAt: new Date().toISOString(), handoverCertificates: next });
    persistFromState(get());
  },

  deleteHandoverCertificate: (id) => {
    set({
      updatedAt: new Date().toISOString(),
      handoverCertificates: get().handoverCertificates.filter((item) => item.id !== id),
    });
    persistFromState(get());
  },

  resetDocumentsDefaults: () => {
    set({
      updatedAt: new Date().toISOString(),
      workOrders: structuredClone(DEFAULT_WORK_ORDERS),
      agreements: structuredClone(DEFAULT_AGREEMENTS),
      handoverCertificates: structuredClone(DEFAULT_HANDOVER_CERTIFICATES),
    });
    persistFromState(get());
  },
}));

