import { create } from 'zustand';
import defaultProjectsData from '../data/proyek.json';
import { normalizeClientEntityType } from '../lib/agreement-identity';
import { BUSINESS_CONFIG } from '../lib/business-config';
import { migrateLegacyProjectId } from '../lib/document-numbering';
import { DEFAULT_PROJECT_INVOICES } from '../lib/finance-utils';
import {
  readLocalCacheItem,
  subscribeLocalCacheChange,
  writeLocalCacheItem,
} from '../lib/indexeddb-storage';
import { DEFAULT_PAYMENT_SCHEME } from '../lib/payment-scheme';
import { buildSeededAutoDocumentsForProjects } from '../lib/project-documents-auto';
import type {
  CooperationAgreementDocument,
  DeliveryOrderDocument,
  HandoverCertificateDocument,
  QuotationDocument,
  WorkOrderDocument,
} from '../types/documents';
import type { WorkshopProject } from '../types/finance';

export const DOCUMENTS_STORAGE_KEY = 'shansusdzar-documents-v1';

const CURRENT_DOCUMENTS_SCHEMA_VERSION = 16;

const SEEDED_AUTO_DOCUMENTS = buildSeededAutoDocumentsForProjects(
  defaultProjectsData as WorkshopProject[],
  DEFAULT_PROJECT_INVOICES,
  BUSINESS_CONFIG,
  DEFAULT_PAYMENT_SCHEME
);

export const DEFAULT_QUOTATIONS: QuotationDocument[] = SEEDED_AUTO_DOCUMENTS.quotations;

export const DEFAULT_WORK_ORDERS: WorkOrderDocument[] = [];

export const DEFAULT_DELIVERY_ORDERS: DeliveryOrderDocument[] =
  SEEDED_AUTO_DOCUMENTS.deliveryOrders;

export const DEFAULT_AGREEMENTS: CooperationAgreementDocument[] =
  SEEDED_AUTO_DOCUMENTS.agreements;

export const DEFAULT_HANDOVER_CERTIFICATES: HandoverCertificateDocument[] =
  SEEDED_AUTO_DOCUMENTS.handoverCertificates;

interface PersistedDocumentsPayload {
  schemaVersion: number;
  updatedAt: string;
  quotations: QuotationDocument[];
  workOrders: WorkOrderDocument[];
  deliveryOrders: DeliveryOrderDocument[];
  agreements: CooperationAgreementDocument[];
  handoverCertificates: HandoverCertificateDocument[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadDocumentsState(): PersistedDocumentsPayload {
  const fallback: PersistedDocumentsPayload = {
    schemaVersion: CURRENT_DOCUMENTS_SCHEMA_VERSION,
    updatedAt: '2026-11-25T09:00:00.000Z',
    quotations: structuredClone(DEFAULT_QUOTATIONS),
    workOrders: structuredClone(DEFAULT_WORK_ORDERS),
    deliveryOrders: structuredClone(DEFAULT_DELIVERY_ORDERS),
    agreements: structuredClone(DEFAULT_AGREEMENTS),
    handoverCertificates: structuredClone(DEFAULT_HANDOVER_CERTIFICATES),
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = readLocalCacheItem(DOCUMENTS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      (parsed.schemaVersion !== 12 &&
        parsed.schemaVersion !== 13 &&
        parsed.schemaVersion !== 14 &&
        parsed.schemaVersion !== 15 &&
        parsed.schemaVersion !== CURRENT_DOCUMENTS_SCHEMA_VERSION)
    ) {
      return fallback;
    }

    const sanitizeDocLineItems = (rawItems: unknown): unknown => {
      if (!Array.isArray(rawItems)) return rawItems;
      return rawItems.map((entry) => {
        if (!isRecord(entry)) return entry;
        const { kodeProduk: _kp, ...rest } = entry;
        void _kp;
        if (!Array.isArray(rest.tambahan)) return rest;
        return {
          ...rest,
          tambahan: rest.tambahan
            .filter((addon): addon is { jenis: string; biaya?: number } => isRecord(addon) && typeof addon.jenis === 'string')
            .map((addon) => ({
              jenis: addon.jenis.trim(),
              biaya: Math.max(0, Math.round(Number(addon.biaya) || 0)),
            })),
        };
      });
    };

    const migrateDocList = <T extends { projectId?: string; daftarItem?: unknown; daftarProduk?: unknown }>(
      list: unknown,
      defaultList: T[]
    ): T[] =>
      Array.isArray(list)
        ? (list as T[]).map((doc) => ({
            ...doc,
            projectId: migrateLegacyProjectId(doc.projectId),
            ...(doc.daftarItem !== undefined ? { daftarItem: sanitizeDocLineItems(doc.daftarItem) } : {}),
            ...(doc.daftarProduk !== undefined ? { daftarProduk: sanitizeDocLineItems(doc.daftarProduk) } : {}),
          }))
        : defaultList;

    const migratedAgreements = migrateDocList(parsed.agreements, fallback.agreements).map(
      (doc) => {
        const defaultMatch = DEFAULT_AGREEMENTS.find(
          (candidate) =>
            (doc.projectId && candidate.projectId === doc.projectId) || candidate.id === doc.id
        );
        const resolvedEntityType = normalizeClientEntityType(
          doc.jenisPihakKedua ?? defaultMatch?.jenisPihakKedua,
          doc.namaPerusahaanPihakKedua || doc.namaPihakKedua
        );
        return {
          ...doc,
          teleponPihakPertama:
            doc.teleponPihakPertama?.trim() ||
            defaultMatch?.teleponPihakPertama ||
            BUSINESS_CONFIG.whatsapp.nomorTampil,
          jenisPihakKedua: resolvedEntityType,
          namaPerusahaanPihakKedua:
            resolvedEntityType === 'pribadi'
              ? undefined
              : doc.namaPerusahaanPihakKedua?.trim() ||
                defaultMatch?.namaPerusahaanPihakKedua ||
                doc.namaPihakKedua,
          penanggungJawabPihakKedua:
            resolvedEntityType === 'pribadi'
              ? undefined
              : doc.penanggungJawabPihakKedua?.trim() || defaultMatch?.penanggungJawabPihakKedua,
          jabatanPihakKedua:
            resolvedEntityType === 'pribadi'
              ? doc.jabatanPihakKedua
              : !doc.jabatanPihakKedua ||
                  /^(pemberi tugas \/ klien|pemilik \/ pemberi tugas)$/i.test(
                    doc.jabatanPihakKedua.trim()
                  )
                ? defaultMatch?.jabatanPihakKedua || 'Penanggung Jawab'
                : doc.jabatanPihakKedua,
          daftarProduk:
            Array.isArray(doc.daftarProduk) && doc.daftarProduk.length > 0
              ? doc.daftarProduk
              : defaultMatch?.daftarProduk?.length
                ? structuredClone(defaultMatch.daftarProduk)
                : doc.daftarProduk,
        };
      }
    );

    const rawDeliveryOrders = migrateDocList(parsed.deliveryOrders, fallback.deliveryOrders).map(
      (doc) => {
        const legacyDoc = doc as DeliveryOrderDocument & {
          koordinatorPengirimanInstalasi?: string;
        };
        const resolvedPic =
          doc.penanggungJawabPengirimanInstalasi ??
          legacyDoc.koordinatorPengirimanInstalasi ??
          '';
        const { koordinatorPengirimanInstalasi: _legacyPic, ...cleanDoc } = legacyDoc;
        void _legacyPic;
        return {
          ...cleanDoc,
          penanggungJawabPengirimanInstalasi: resolvedPic,
        };
      }
    );

    const migrated: PersistedDocumentsPayload = {
      schemaVersion: CURRENT_DOCUMENTS_SCHEMA_VERSION,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : fallback.updatedAt,
      quotations: migrateDocList(parsed.quotations, fallback.quotations),
      workOrders: migrateDocList(parsed.workOrders, fallback.workOrders),
      deliveryOrders: rawDeliveryOrders,
      agreements: migratedAgreements,
      handoverCertificates: migrateDocList(
        parsed.handoverCertificates,
        fallback.handoverCertificates
      ),
    };
    if (parsed.schemaVersion !== CURRENT_DOCUMENTS_SCHEMA_VERSION) {
      saveDocumentsState(migrated);
    }
    return migrated;
  } catch {
    return fallback;
  }
}

function saveDocumentsState(payload: PersistedDocumentsPayload): void {
  if (typeof window === 'undefined') return;
  try {
    writeLocalCacheItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage serialization errors
  }
}

interface DocumentsStoreState extends PersistedDocumentsPayload {
  upsertQuotation: (doc: QuotationDocument) => void;
  deleteQuotation: (id: string) => void;
  upsertWorkOrder: (doc: WorkOrderDocument) => void;
  deleteWorkOrder: (id: string) => void;
  upsertDeliveryOrder: (doc: DeliveryOrderDocument) => void;
  deleteDeliveryOrder: (id: string) => void;
  upsertAgreement: (doc: CooperationAgreementDocument) => void;
  deleteAgreement: (id: string) => void;
  upsertHandoverCertificate: (doc: HandoverCertificateDocument) => void;
  deleteHandoverCertificate: (id: string) => void;
  reloadFromStorage: () => void;
  resetDocumentsDefaults: () => void;
}

function persistFromState(state: DocumentsStoreState): void {
  saveDocumentsState({
    schemaVersion: CURRENT_DOCUMENTS_SCHEMA_VERSION,
    updatedAt: state.updatedAt,
    quotations: state.quotations,
    workOrders: state.workOrders,
    deliveryOrders: state.deliveryOrders,
    agreements: state.agreements,
    handoverCertificates: state.handoverCertificates,
  });
}

const initialDocuments = loadDocumentsState();

export const useDocumentsStore = create<DocumentsStoreState>((set, get) => ({
  ...initialDocuments,

  upsertQuotation: (doc) => {
    const existing = get().quotations;
    const exists = existing.some((item) => item.id === doc.id);
    const next = exists
      ? existing.map((item) => (item.id === doc.id ? doc : item))
      : [doc, ...existing];
    set({ updatedAt: new Date().toISOString(), quotations: next });
    persistFromState(get());
  },

  deleteQuotation: (id) => {
    set({
      updatedAt: new Date().toISOString(),
      quotations: get().quotations.filter((item) => item.id !== id),
    });
    persistFromState(get());
  },

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

  upsertDeliveryOrder: (doc) => {
    const existing = get().deliveryOrders;
    const exists = existing.some((item) => item.id === doc.id);
    const next = exists
      ? existing.map((item) => (item.id === doc.id ? doc : item))
      : [doc, ...existing];
    set({ updatedAt: new Date().toISOString(), deliveryOrders: next });
    persistFromState(get());
  },

  deleteDeliveryOrder: (id) => {
    set({
      updatedAt: new Date().toISOString(),
      deliveryOrders: get().deliveryOrders.filter((item) => item.id !== id),
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

  reloadFromStorage: () => {
    set(loadDocumentsState());
  },

  resetDocumentsDefaults: () => {
    set({
      updatedAt: new Date().toISOString(),
      quotations: structuredClone(DEFAULT_QUOTATIONS),
      workOrders: structuredClone(DEFAULT_WORK_ORDERS),
      deliveryOrders: structuredClone(DEFAULT_DELIVERY_ORDERS),
      agreements: structuredClone(DEFAULT_AGREEMENTS),
      handoverCertificates: structuredClone(DEFAULT_HANDOVER_CERTIFICATES),
    });
    persistFromState(get());
  },
}));

if (typeof window !== 'undefined') {
  subscribeLocalCacheChange(DOCUMENTS_STORAGE_KEY, () => {
    useDocumentsStore.setState(loadDocumentsState());
  });
}

