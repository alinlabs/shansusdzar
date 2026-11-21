import { useMemo, useState, type FormEvent } from 'react';
import { FileDown, Plus } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { FormField, Input } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatShortDateId } from '../../../../lib/finance-utils';
import { downloadWorkOrderPdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { WorkOrderDocument } from '../../../../types/documents';
import {
  PRIORITIES,
  WORK_ORDER_STATUSES,
  createEmptyWorkOrder,
  createEmptyWorkOrderItem,
  duplicateWorkOrderDraft,
  normalizeWorkOrderPayload,
  validateWorkOrderDraft,
} from './logic';

const BACK_PATH = '/admin/dokumen/spk';

export default function AdminSpkFormPage() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const workOrders = useDocumentsStore((state) => state.workOrders);
  const upsertWorkOrder = useDocumentsStore((state) => state.upsertWorkOrder);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'keuangan.edit');

  const isEditMode = Boolean(id);
  const duplicateId = searchParams.get('duplicate');
  const existingDoc = useMemo(
    () => (id ? workOrders.find((doc) => doc.id === id) ?? null : null),
    [id, workOrders]
  );

  const [values, setValues] = useState<WorkOrderDocument>(() => {
    if (existingDoc) return structuredClone(existingDoc);
    if (duplicateId) {
      const source = workOrders.find((doc) => doc.id === duplicateId);
      if (source) return duplicateWorkOrderDraft(source, workOrders.length + 16);
    }
    return createEmptyWorkOrder(workOrders.length + 16, businessConfig);
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode && existingDoc ? `Ubah ${existingDoc.nomorSpk}` : 'Buat SPK Baru'} | Dokumen Admin ${businessConfig.namaMerekSingkat}`
  );

  const sections = useMemo<AdminFormSectionConfig<WorkOrderDocument>[]>(
    () => [
      {
        id: 'identitas-spk',
        title: 'Identitas & Jadwal SPK',
        description: 'Nomor dokumen resmi, tanggal terbit, target selesai, dan status produksi.',
        columns: 3,
        fields: [
          {
            name: 'nomorSpk',
            label: 'Nomor SPK',
            type: 'text',
            required: true,
          },
          {
            name: 'tanggalTerbit',
            label: 'Tanggal Terbit',
            type: 'date',
            required: true,
          },
          {
            name: 'tanggalTargetSelesai',
            label: 'Target Selesai',
            type: 'date',
            required: true,
          },
          {
            name: 'prioritas',
            label: 'Prioritas Pengerjaan',
            type: 'select',
            options: PRIORITIES.map((p) => ({ value: p, label: p })),
          },
          {
            name: 'status',
            label: 'Status Tahap SPK',
            type: 'select',
            options: WORK_ORDER_STATUSES.map((st) => ({ value: st, label: st })),
          },
        ],
      },
      {
        id: 'data-proyek',
        title: 'Informasi Proyek, Klien & Penanggung Jawab',
        columns: 2,
        fields: [
          {
            name: 'namaProyek',
            label: 'Nama Proyek',
            type: 'text',
            required: true,
            placeholder: 'Contoh: Kitchen Set HPL Matte',
          },
          {
            name: 'namaKlien',
            label: 'Nama Klien',
            type: 'text',
            required: true,
          },
          {
            name: 'alamatPemasangan',
            label: 'Alamat Pemasangan / Lokasi Proyek',
            type: 'text',
            colSpan: 'full',
          },
          {
            name: 'namaPengawas',
            label: 'Pemberi Perintah / Pimpinan',
            type: 'text',
          },
          {
            name: 'koordinatorProduksi',
            label: 'Kepala Produksi / Mandor',
            type: 'text',
          },
          {
            name: 'pemeriksaQc',
            label: 'Pemeriksa QC',
            type: 'text',
          },
        ],
      },
      {
        id: 'daftar-item',
        title: `Daftar Item Pekerjaan (${values.daftarItem.length})`,
        description: 'Rincian unit produksi, dimensi ukuran, material, serta standar pemeriksaan QC.',
        headerAction: ({ readOnly, setFieldValue, values: current }) =>
          !readOnly ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setFieldValue('daftarItem', [...current.daftarItem, createEmptyWorkOrderItem()])
              }
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Tambah Item
            </Button>
          ) : null,
        renderContent: ({ values: current, setFieldValue, readOnly, errors }) => (
          <div className="space-y-3">
            {errors.daftarItem && (
              <p role="alert" className="text-xs font-medium text-[var(--danger)]">
                {errors.daftarItem}
              </p>
            )}
            {current.daftarItem.map((item, idx) => (
              <div
                key={item.id}
                className="p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    Item #{idx + 1}
                  </span>
                  {!readOnly && current.daftarItem.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setFieldValue(
                          'daftarItem',
                          current.daftarItem.filter((i) => i.id !== item.id)
                        )
                      }
                      className="text-xs text-[var(--danger)] hover:underline cursor-pointer"
                    >
                      Hapus Item
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-5">
                    <FormField id={`item-name-${item.id}`} label="Nama Unit / Bagian" required>
                      <Input
                        id={`item-name-${item.id}`}
                        required
                        disabled={readOnly}
                        placeholder="Contoh: Kabinet Bawah Sink"
                        value={item.namaUnit}
                        onChange={(e) =>
                          setFieldValue(
                            'daftarItem',
                            current.daftarItem.map((row) =>
                              row.id === item.id ? { ...row, namaUnit: e.target.value } : row
                            )
                          )
                        }
                      />
                    </FormField>
                  </div>
                  <div className="sm:col-span-5">
                    <FormField id={`item-dim-${item.id}`} label="Dimensi">
                      <Input
                        id={`item-dim-${item.id}`}
                        disabled={readOnly}
                        placeholder="320 × 60 cm"
                        value={item.dimensi}
                        onChange={(e) =>
                          setFieldValue(
                            'daftarItem',
                            current.daftarItem.map((row) =>
                              row.id === item.id ? { ...row, dimensi: e.target.value } : row
                            )
                          )
                        }
                      />
                    </FormField>
                  </div>
                  <div className="sm:col-span-2">
                    <FormField id={`item-qty-${item.id}`} label="Jumlah">
                      <Input
                        id={`item-qty-${item.id}`}
                        type="number"
                        min={1}
                        disabled={readOnly}
                        value={item.jumlah}
                        onChange={(e) =>
                          setFieldValue(
                            'daftarItem',
                            current.daftarItem.map((row) =>
                              row.id === item.id
                                ? { ...row, jumlah: Number(e.target.value) || 1 }
                                : row
                            )
                          )
                        }
                      />
                    </FormField>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    id={`item-mat-${item.id}`}
                    label="Spesifikasi Material Utama & Finishing/Laminasi"
                  >
                    <Input
                      id={`item-mat-${item.id}`}
                      disabled={readOnly}
                      placeholder="PVC + Finishing/Laminasi HPL"
                      value={item.spesifikasiMaterial}
                      onChange={(e) =>
                        setFieldValue(
                          'daftarItem',
                          current.daftarItem.map((row) =>
                            row.id === item.id ? { ...row, spesifikasiMaterial: e.target.value } : row
                          )
                        )
                      }
                    />
                  </FormField>
                  <FormField id={`item-qc-${item.id}`} label="Standar Pemeriksaan QC">
                    <Input
                      id={`item-qc-${item.id}`}
                      disabled={readOnly}
                      placeholder="Engsel rata, finishing/laminasi rapi, bebas celah"
                      value={item.daftarPeriksaQc}
                      onChange={(e) =>
                        setFieldValue(
                          'daftarItem',
                          current.daftarItem.map((row) =>
                            row.id === item.id ? { ...row, daftarPeriksaQc: e.target.value } : row
                          )
                        )
                      }
                    />
                  </FormField>
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: 'catatan-k3',
        title: 'Catatan Teknis & Prosedur K3',
        columns: 2,
        fields: [
          {
            name: 'catatanTeknis',
            label: 'Catatan Teknis Lapangan',
            type: 'textarea',
            rows: 3,
          },
          {
            name: 'ketentuanKeselamatan',
            label: 'Prosedur K3 & Pengemasan',
            type: 'textarea',
            rows: 3,
          },
        ],
      },
    ],
    [values.daftarItem.length]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validateWorkOrderDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = normalizeWorkOrderPayload(values);
    upsertWorkOrder(payload);
    recordActivity(
      isEditMode ? 'Memperbarui Surat Perintah Kerja' : 'Membuat Surat Perintah Kerja baru',
      'Dokumen SPK',
      payload.nomorSpk
    );

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: isEditMode
            ? `Perubahan SPK ${payload.nomorSpk} berhasil disimpan.`
            : `SPK baru ${payload.nomorSpk} (${payload.namaProyek}) telah dibuat.`,
        },
      },
    });
  };

  const totalUnits = values.daftarItem.reduce((sum, item) => sum + (item.jumlah || 1), 0);

  return (
    <AdminForm
      title={
        isEditMode && existingDoc
          ? `Ubah ${existingDoc.nomorSpk}`
          : 'Buat Surat Perintah Kerja (SPK)'
      }
      description="Lengkapi informasi proyek, daftar item produksi, serta standar QC untuk dicetak menjadi dokumen resmi workshop."
      backTo={BACK_PATH}
      backLabel="Kembali ke Daftar SPK"
      submitLabel={isEditMode ? 'Simpan Perubahan SPK' : 'Simpan SPK'}
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      extraHeaderActions={
        isEditMode && existingDoc ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => downloadWorkOrderPdf(normalizeWorkOrderPayload(values), businessConfig)}
          >
            <FileDown className="size-3.5" aria-hidden="true" />
            Unduh PDF SPK
          </Button>
        ) : undefined
      }
      notFoundState={
        isEditMode && !existingDoc
          ? {
              title: 'Dokumen SPK Tidak Ditemukan',
              message: 'Data Surat Perintah Kerja yang dicari tidak tersedia atau sudah dihapus.',
            }
          : undefined
      }
      aside={
        <AdminFormSectionCard
          title="Ringkasan Instruksi Kerja"
          description="Pratinjau parameter SPK yang akan dicetak."
        >
          <dl className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Nomor SPK</dt>
              <dd className="font-mono font-semibold text-[var(--text)]">{values.nomorSpk || '-'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Status &amp; Prioritas</dt>
              <dd className="font-medium text-[var(--text)]">
                {values.status} · {values.prioritas}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Target Selesai</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {values.tanggalTargetSelesai ? formatShortDateId(values.tanggalTargetSelesai) : '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Jumlah Item / Unit</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {values.daftarItem.length} baris · {totalUnits} unit
              </dd>
            </div>
            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Mandor &amp; QC</dt>
              <dd className="font-medium text-[var(--text)] text-right">
                {values.koordinatorProduksi || '-'} / {values.pemeriksaQc || '-'}
              </dd>
            </div>
          </dl>
        </AdminFormSectionCard>
      }
    />
  );
}
