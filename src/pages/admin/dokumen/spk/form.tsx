import { useMemo, useState, type FormEvent } from 'react';
import { FileDown, Plus, RefreshCw } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { FormField, Input, Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatRupiahSigned, formatShortDateId } from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  calculatePaymentSchemeBreakdown,
  clonePaymentSchemeStages,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import { downloadWorkOrderPdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useFinanceStore } from '../../../../store/finance-store';
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
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const workOrders = useDocumentsStore((state) => state.workOrders);
  const agreements = useDocumentsStore((state) => state.agreements);
  const upsertWorkOrder = useDocumentsStore((state) => state.upsertWorkOrder);
  const invoices = useFinanceStore((state) => state.invoices);

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
    return createEmptyWorkOrder(workOrders.length + 16, businessConfig, paymentScheme);
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode && existingDoc ? `Ubah ${existingDoc.nomorSpk}` : 'Buat SPK Baru'} | Dokumen Admin ${businessConfig.namaMerekSingkat}`
  );

  const effectiveScheme = useMemo(
    () =>
      resolveEffectivePaymentScheme(
        values.tahapanPembayaran,
        paymentScheme,
        values.catatanPembayaran
      ),
    [values.tahapanPembayaran, values.catatanPembayaran, paymentScheme]
  );

  const paymentBreakdown = useMemo(
    () => calculatePaymentSchemeBreakdown(values.nilaiKontrakReferensi || 0, effectiveScheme),
    [values.nilaiKontrakReferensi, effectiveScheme]
  );

  const applyInvoiceReference = (invoiceId: string) => {
    const selected = invoices.find((inv) => inv.id === invoiceId);
    if (!selected) return;
    setValues((prev) => ({
      ...prev,
      nomorInvoiceReferensi: selected.nomorInvoice,
      namaProyek: prev.namaProyek.trim() ? prev.namaProyek : selected.namaProyek,
      namaKlien: prev.namaKlien.trim() ? prev.namaKlien : selected.namaKlien,
      alamatPemasangan: prev.alamatPemasangan.trim() ? prev.alamatPemasangan : selected.lokasi,
      nilaiKontrakReferensi: selected.nilaiTotalKontrak,
      tahapanPembayaran:
        selected.skemaPembayaran && selected.skemaPembayaran.length > 0
          ? structuredClone(selected.skemaPembayaran)
          : clonePaymentSchemeStages(paymentScheme),
      catatanPembayaran: prev.catatanPembayaran?.trim() || paymentScheme.catatan,
    }));
  };

  const applyAgreementReference = (agreementId: string) => {
    const selected = agreements.find((ag) => ag.id === agreementId);
    if (!selected) return;
    setValues((prev) => ({
      ...prev,
      nomorSpksReferensi: selected.nomorKontrak,
      namaProyek: prev.namaProyek.trim() ? prev.namaProyek : selected.judulProyek,
      namaKlien: prev.namaKlien.trim() ? prev.namaKlien : selected.namaPihakKedua,
      alamatPemasangan: prev.alamatPemasangan.trim()
        ? prev.alamatPemasangan
        : selected.lokasiProyek,
      nilaiKontrakReferensi: selected.nilaiKontrak,
      tahapanPembayaran:
        selected.tahapanPembayaran && selected.tahapanPembayaran.length > 0
          ? structuredClone(selected.tahapanPembayaran)
          : clonePaymentSchemeStages(paymentScheme),
      catatanPembayaran: selected.catatanPembayaran || paymentScheme.catatan,
    }));
  };

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
            placeholder: 'Contoh: Kitchen Set HPL',
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
                      placeholder="PVC Board + Finishing/Laminasi HPL"
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
        id: 'landasan-pembayaran',
        title: 'Landasan Skema Pembayaran & Milestone Produksi',
        description:
          'Hubungkan SPK dengan Invoice / SPKS agar progres produksi (DP, 50% workshop, pra-instalasi, dan BAST) mengacu ke skema pembayaran resmi.',
        columns: 3,
        headerAction: ({ readOnly, setFieldValue }) =>
          !readOnly ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setFieldValue('tahapanPembayaran', clonePaymentSchemeStages(paymentScheme));
                setFieldValue('catatanPembayaran', paymentScheme.catatan);
              }}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Terapkan Skema Resmi
            </Button>
          ) : null,
        fields: [
          {
            name: 'nomorInvoiceReferensi',
            label: 'No. Invoice Referensi',
            type: 'text',
            placeholder: 'INV-SDI-2026-041',
          },
          {
            name: 'nomorSpksReferensi',
            label: 'No. SPKS Referensi',
            type: 'text',
            placeholder: 'SPKS-SDI-2026-008',
          },
          {
            name: 'nilaiKontrakReferensi',
            label: 'Nilai Kontrak Acuan (IDR)',
            type: 'currency',
            zeroAsEmpty: true,
          },
          {
            name: 'catatanPembayaran',
            label: 'Catatan Landasan Termin',
            type: 'textarea',
            rows: 2,
            colSpan: 'full',
          },
        ],
        renderContent: ({ readOnly }) => (
          <div className="space-y-3 pt-1">
            {!readOnly && (invoices.length > 0 || agreements.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)]">
                {invoices.length > 0 && (
                  <FormField id="spk-pick-invoice" label="Tarik Referensi dari Invoice">
                    <Select
                      id="spk-pick-invoice"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) applyInvoiceReference(e.target.value);
                      }}
                    >
                      <option value="">— Pilih Invoice Proyek —</option>
                      {invoices.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.nomorInvoice} · {inv.namaKlien}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                )}
                {agreements.length > 0 && (
                  <FormField id="spk-pick-spks" label="Tarik Referensi dari SPKS">
                    <Select
                      id="spk-pick-spks"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) applyAgreementReference(e.target.value);
                      }}
                    >
                      <option value="">— Pilih Kontrak SPKS —</option>
                      {agreements.map((ag) => (
                        <option key={ag.id} value={ag.id}>
                          {ag.nomorKontrak} · {ag.namaPihakKedua}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                )}
              </div>
            )}

            <div className="border border-[var(--border)] rounded-[var(--radius-md)] divide-y divide-[var(--border)] bg-[var(--bg)]">
              {paymentBreakdown.map((stage) => (
                <div
                  key={stage.id}
                  className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text)]">
                      {stage.nama} {stage.persentase}%
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">{stage.keterangan}</p>
                  </div>
                  <span className="font-semibold text-[var(--text)] tabular-nums shrink-0">
                    {stage.amount !== null ? formatRupiahSigned(stage.amount) : '—'}
                  </span>
                </div>
              ))}
            </div>
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
    [values.daftarItem.length, paymentBreakdown, paymentScheme, invoices, agreements]
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
      description="Lengkapi informasi proyek, daftar item produksi, standar QC, serta landasan skema pembayaran untuk dicetak menjadi dokumen resmi workshop."
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
            onClick={() =>
              downloadWorkOrderPdf(normalizeWorkOrderPayload(values), businessConfig, paymentScheme)
            }
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
          description="Pratinjau parameter SPK dan milestone pembayaran."
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
            <div className="pt-2 border-t border-[var(--border)] space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-muted)]">Acuan Invoice / Kontrak</dt>
                <dd className="font-mono text-[var(--text)]">
                  {values.nomorInvoiceReferensi || values.nomorSpksReferensi || '-'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-muted)]">Nilai Kontrak Acuan</dt>
                <dd className="font-semibold text-[var(--text)] tabular-nums">
                  {(values.nilaiKontrakReferensi || 0) > 0
                    ? formatRupiahSigned(values.nilaiKontrakReferensi || 0)
                    : '-'}
                </dd>
              </div>
              <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
                Termin: {effectiveScheme.tahapan.map((st) => `${st.persentase}%`).join(' · ')}
              </div>
            </div>
          </dl>
        </AdminFormSectionCard>
      }
    />
  );
}
