import { create } from 'zustand';
import defaultProjectsData from '../data/proyek.json';
import { normalizeClientEntityType } from '../lib/agreement-identity';
import { normalizeDimensionString, parseDimensionParts } from '../lib/dimension-format';
import { migrateLegacyProjectId } from '../lib/document-numbering';
import {
  computeWarrantyEndDateIso,
  resolveProjectDocumentDates,
} from '../lib/project-documents-auto';
import {
  readLocalCacheItem,
  subscribeLocalCacheChange,
  writeLocalCacheItem,
} from '../lib/indexeddb-storage';
import { findCatalogProduct } from '../lib/project-products';
import { normalizeClientWilayahAddress } from '../lib/wilayah-indonesia';
import type { WorkshopProject } from '../types/finance';

export const PROJECTS_STORAGE_KEY = 'shansusdzar-projects-v1';

export const DEFAULT_WORKSHOP_PROJECTS: WorkshopProject[] =
  defaultProjectsData as WorkshopProject[];

interface PersistedProjectsPayload {
  schemaVersion: number;
  updatedAt: string;
  projects: WorkshopProject[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const CURRENT_PROJECTS_SCHEMA_VERSION = 14;

function resolveBackfilledSeedDimension(
  rawDimension: string | undefined,
  seedDimension: string | undefined
): string {
  const normalizedRaw = normalizeDimensionString(rawDimension);
  if (!normalizedRaw) {
    return seedDimension ?? '';
  }
  if (!seedDimension) {
    return rawDimension ?? '';
  }
  const [seedP, seedL, seedT] = parseDimensionParts(seedDimension);
  if (seedP && seedL && seedT && normalizedRaw === `${seedP} x ${seedT}`) {
    return seedDimension;
  }
  return rawDimension ?? '';
}

function sanitizeLegacyProductItems(
  items: WorkshopProject['daftarProduk'],
  seed?: WorkshopProject
): WorkshopProject['daftarProduk'] {
  const source = Array.isArray(items) ? items : structuredClone(seed?.daftarProduk ?? []);
  return source.map((rawItem, idx) => {
    const legacy = rawItem as unknown as Record<string, unknown>;
    const legacyKodeProduk =
      typeof legacy.kodeProduk === 'string' ? legacy.kodeProduk.trim() : '';
    const seedMatch = seed?.daftarProduk?.[idx];
    const matchedCatalog =
      findCatalogProduct(legacyKodeProduk || rawItem.id) ??
      ('catatanQc' in legacy ? findCatalogProduct(seedMatch?.id) : undefined);

    const rawTambahan = Array.isArray(rawItem.tambahan)
      ? rawItem.tambahan
      : seedMatch?.tambahan
        ? structuredClone(seedMatch.tambahan)
        : [];
    const cleanTambahan = rawTambahan
      .filter((addon) => String(addon?.jenis ?? '').trim().length > 0)
      .map((addon) => ({
        jenis: String(addon.jenis).trim(),
        biaya: Math.max(0, Math.round(Number(addon.biaya) || 0)),
      }));

    return {
      id: matchedCatalog?.id ?? '',
      ...(!matchedCatalog && (rawItem.namaProduk ?? seedMatch?.namaProduk)
        ? { namaProduk: rawItem.namaProduk ?? seedMatch?.namaProduk }
        : {}),
      dimensi: resolveBackfilledSeedDimension(rawItem.dimensi, seedMatch?.dimensi),
      customisasi: rawItem.customisasi ?? seedMatch?.customisasi,
      material: rawItem.material ?? seedMatch?.material,
      finishing: rawItem.finishing ?? seedMatch?.finishing,
      kodeWarna: rawItem.kodeWarna ?? seedMatch?.kodeWarna ?? '',
      ...(cleanTambahan.length > 0 ? { tambahan: cleanTambahan } : {}),
      spesifikasiMaterial: rawItem.spesifikasiMaterial ?? seedMatch?.spesifikasiMaterial ?? '',
      spesifikasiManual: rawItem.spesifikasiManual,
      jumlah: Math.max(1, Math.round(rawItem.jumlah || 1)),
      hargaSatuan: Math.max(0, Math.round(rawItem.hargaSatuan || 0)),
      hargaManual: rawItem.hargaManual,
    };
  });
}

function hydrateProjectEntry(project: WorkshopProject): WorkshopProject {
  const migratedId = migrateLegacyProjectId(project.id) || project.id;
  const seed = DEFAULT_WORKSHOP_PROJECTS.find((item) => item.id === migratedId);
  const raw = project as unknown as Record<string, unknown>;
  const {
    kodeKlien: _legacyKodeKlien,
    lokasi: _legacyLokasi,
    kodeProyek: _legacyCode,
    catatan: _legacyNotes,
    koordinat: _legacyCoord,
    invoice: _legacyEmbeddedInvoice,
    ...rest
  } = raw;
  void _legacyKodeKlien;
  void _legacyLokasi;
  void _legacyCode;
  void _legacyNotes;
  void _legacyCoord;
  void _legacyEmbeddedInvoice;

  const rawDates = project.tanggalDokumen ?? seed?.tanggalDokumen;
  const resolvedDates = rawDates
    ? resolveProjectDocumentDates({
        tanggalMulai: project.tanggalMulai ?? '',
        tanggalTargetSelesai: project.tanggalTargetSelesai ?? '',
        tanggalDokumen: rawDates,
      })
    : undefined;
  const completionDate = project.tanggalTargetSelesai?.trim() || seed?.tanggalTargetSelesai || '';

  const baseTech = project.detailTeknis ?? (seed ? structuredClone(seed.detailTeknis) : undefined);
  const legacyBaseTech = baseTech as
    | (typeof baseTech & { koordinatorPengirimanInstalasi?: string })
    | undefined;
  const cleanTech = baseTech
    ? {
        penanggungJawabPengirimanInstalasi:
          baseTech.penanggungJawabPengirimanInstalasi ??
          legacyBaseTech?.koordinatorPengirimanInstalasi ??
          '',
        masaGaransiBulan: baseTech.masaGaransiBulan,
        tanggalGaransiBerakhir: computeWarrantyEndDateIso(
          completionDate,
          baseTech.masaGaransiBulan ?? 6
        ),
      }
    : undefined;

  const resolvedEntityType = normalizeClientEntityType(
    project.jenisKlien ?? seed?.jenisKlien,
    project.namaKlien
  );

  const resolvedAlamat =
    normalizeClientWilayahAddress(project.alamat) ??
    (seed?.alamat ? structuredClone(seed.alamat) : undefined);

  return {
    ...(rest as unknown as WorkshopProject),
    id: migratedId,
    jenisKlien: resolvedEntityType,
    penanggungJawabKlien:
      resolvedEntityType === 'pribadi'
        ? undefined
        : project.penanggungJawabKlien?.trim() || seed?.penanggungJawabKlien,
    jabatanKlien:
      resolvedEntityType === 'pribadi'
        ? undefined
        : project.jabatanKlien?.trim() || seed?.jabatanKlien,
    ...(resolvedAlamat ? { alamat: resolvedAlamat } : {}),
    daftarProduk: sanitizeLegacyProductItems(project.daftarProduk, seed),
    tanggalDokumen: resolvedDates,
    detailTeknis: cleanTech,
  };
}

function loadProjectsState(): PersistedProjectsPayload {
  const fallback: PersistedProjectsPayload = {
    schemaVersion: CURRENT_PROJECTS_SCHEMA_VERSION,
    updatedAt: '2026-11-25T09:00:00.000Z',
    projects: structuredClone(DEFAULT_WORKSHOP_PROJECTS),
  };

  if (typeof window === 'undefined') return fallback;

  try {
    const raw = readLocalCacheItem(PROJECTS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      typeof parsed.schemaVersion !== 'number' ||
      parsed.schemaVersion < 1 ||
      parsed.schemaVersion > CURRENT_PROJECTS_SCHEMA_VERSION
    ) {
      return fallback;
    }

    const baseProjects = Array.isArray(parsed.projects)
      ? (parsed.projects as WorkshopProject[])
      : fallback.projects;
    const migratedProjects = baseProjects.map(hydrateProjectEntry);

    const payload: PersistedProjectsPayload = {
      schemaVersion: CURRENT_PROJECTS_SCHEMA_VERSION,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : fallback.updatedAt,
      projects: migratedProjects,
    };
    if (parsed.schemaVersion !== CURRENT_PROJECTS_SCHEMA_VERSION) {
      saveProjectsState(payload);
    }
    return payload;
  } catch {
    return fallback;
  }
}

function saveProjectsState(payload: PersistedProjectsPayload): void {
  if (typeof window === 'undefined') return;
  try {
    writeLocalCacheItem(PROJECTS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage serialization errors
  }
}

interface ProjectsStoreState extends PersistedProjectsPayload {
  upsertProject: (project: WorkshopProject) => void;
  deleteProject: (projectId: string) => void;
  reloadFromStorage: () => void;
  resetProjectsDefaults: () => void;
}

function persistFromState(state: ProjectsStoreState): void {
  saveProjectsState({
    schemaVersion: CURRENT_PROJECTS_SCHEMA_VERSION,
    updatedAt: state.updatedAt,
    projects: state.projects,
  });
}

const initialProjects = loadProjectsState();

export const useProjectsStore = create<ProjectsStoreState>((set, get) => ({
  ...initialProjects,

  upsertProject: (project) => {
    const state = get();
    const exists = state.projects.some((item) => item.id === project.id);
    const nextProjects = exists
      ? state.projects.map((item) => (item.id === project.id ? project : item))
      : [project, ...state.projects];

    set({
      updatedAt: new Date().toISOString(),
      projects: nextProjects,
    });
    persistFromState(get());
  },

  deleteProject: (projectId) => {
    set({
      updatedAt: new Date().toISOString(),
      projects: get().projects.filter((item) => item.id !== projectId),
    });
    persistFromState(get());
  },

  reloadFromStorage: () => {
    set(loadProjectsState());
  },

  resetProjectsDefaults: () => {
    set({
      updatedAt: new Date().toISOString(),
      projects: structuredClone(DEFAULT_WORKSHOP_PROJECTS),
    });
    persistFromState(get());
  },
}));

if (typeof window !== 'undefined') {
  subscribeLocalCacheChange(PROJECTS_STORAGE_KEY, () => {
    useProjectsStore.setState(loadProjectsState());
  });
}
