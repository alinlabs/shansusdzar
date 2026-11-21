import documentLookupsData from '../../../../data/referensi-dokumen.json';
import type { BusinessConfig } from '../../../../types/business';
import type {
  WorkOrderDocument,
  WorkOrderLineItem,
  WorkOrderPriority,
  WorkOrderStatus,
} from '../../../../types/documents';

export const PRIORITIES: WorkOrderPriority[] =
  documentLookupsData.prioritasSpk as WorkOrderPriority[];
export const WORK_ORDER_STATUSES: WorkOrderStatus[] =
  documentLookupsData.statusSpk as WorkOrderStatus[];

export interface WorkOrderValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function createEmptyWorkOrderItem(): WorkOrderLineItem {
  return {
    id: `spk-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    namaUnit: '',
    dimensi: '',
    spesifikasiMaterial: '',
    jumlah: 1,
    daftarPeriksaQc: '',
  };
}

export function createEmptyWorkOrder(
  seq: number,
  businessConfig: BusinessConfig
): WorkOrderDocument {
  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);
  const finish = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  return {
    id: `spk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nomorSpk: `SPK-SDI-${year}-${String(seq).padStart(3, '0')}`,
    tanggalTerbit: today,
    tanggalTargetSelesai: finish,
    prioritas: 'Normal',
    status: 'Draf',
    namaProyek: '',
    namaKlien: '',
    alamatPemasangan: '',
    namaPengawas: businessConfig.drafPemilik.namaPemilik,
    koordinatorProduksi: 'Fajar Maulana',
    pemeriksaQc: 'Aisyah Rahma',
    daftarItem: [createEmptyWorkOrderItem()],
    catatanTeknis: '',
    ketentuanKeselamatan:
      'Gunakan APD standar workshop, cek presisi sikuan dan kerapatan finishing sebelum pengiriman.',
  };
}

export function duplicateWorkOrderDraft(
  source: WorkOrderDocument,
  seq: number
): WorkOrderDocument {
  const year = new Date().getFullYear();
  let nextId = `spk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  if (nextId === source.id) {
    nextId = `${nextId}-copy`;
  }
  return {
    ...structuredClone(source),
    id: nextId,
    nomorSpk: `SPK-SDI-${year}-${String(seq).padStart(3, '0')}`,
    status: 'Draf',
    tanggalTerbit: new Date().toISOString().slice(0, 10),
  };
}

export function filterWorkOrders(
  workOrders: readonly WorkOrderDocument[],
  searchQuery: string,
  statusFilter: 'all' | WorkOrderStatus
): WorkOrderDocument[] {
  const q = searchQuery.trim().toLowerCase();
  return workOrders.filter((doc) => {
    if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
    if (q) {
      const hay = `${doc.nomorSpk} ${doc.namaProyek} ${doc.namaKlien} ${doc.koordinatorProduksi}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function validateWorkOrderDraft(draft: WorkOrderDocument): WorkOrderValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!draft.nomorSpk.trim()) {
    fieldErrors.nomorSpk = 'Nomor SPK wajib diisi.';
  }
  if (!draft.tanggalTerbit.trim()) {
    fieldErrors.tanggalTerbit = 'Tanggal terbit wajib diisi.';
  }
  if (!draft.tanggalTargetSelesai.trim()) {
    fieldErrors.tanggalTargetSelesai = 'Target selesai wajib diisi.';
  }
  if (!draft.namaProyek.trim()) {
    fieldErrors.namaProyek = 'Nama proyek wajib diisi.';
  }
  if (!draft.namaKlien.trim()) {
    fieldErrors.namaKlien = 'Nama klien wajib diisi.';
  }
  const hasNamedItem = draft.daftarItem.some((item) => item.namaUnit.trim().length > 0);
  if (!hasNamedItem) {
    fieldErrors.daftarItem = 'Minimal 1 item pekerjaan harus memiliki nama unit.';
  }

  const hasErrors = Object.keys(fieldErrors).length > 0;
  return {
    valid: !hasErrors,
    formError: hasErrors
      ? 'Lengkapi nomor SPK, tanggal, nama proyek, nama klien, dan minimal satu item pekerjaan.'
      : null,
    fieldErrors,
  };
}

export function normalizeWorkOrderPayload(draft: WorkOrderDocument): WorkOrderDocument {
  const cleanItems = draft.daftarItem
    .filter((item) => item.namaUnit.trim().length > 0)
    .map((item) => ({
      ...item,
      namaUnit: item.namaUnit.trim(),
      dimensi: item.dimensi.trim(),
      spesifikasiMaterial: item.spesifikasiMaterial.trim(),
      jumlah: Math.max(1, Math.round(item.jumlah || 1)),
      daftarPeriksaQc: item.daftarPeriksaQc.trim(),
    }));

  return {
    ...draft,
    nomorSpk: draft.nomorSpk.trim(),
    namaProyek: draft.namaProyek.trim(),
    namaKlien: draft.namaKlien.trim(),
    alamatPemasangan: draft.alamatPemasangan.trim(),
    namaPengawas: draft.namaPengawas.trim(),
    koordinatorProduksi: draft.koordinatorProduksi.trim(),
    pemeriksaQc: draft.pemeriksaQc.trim(),
    daftarItem: cleanItems.length > 0 ? cleanItems : [createEmptyWorkOrderItem()],
    catatanTeknis: draft.catatanTeknis.trim(),
    ketentuanKeselamatan: draft.ketentuanKeselamatan.trim(),
  };
}
