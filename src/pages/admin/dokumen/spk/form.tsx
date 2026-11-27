import { useMemo, useState, type FormEvent } from 'react';
import { Eye, Plus, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import {
  DimensionInput,
  FormField,
  Input,
  Select,
} from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatRupiahSigned, formatShortDateId } from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  calculatePaymentSchemeBreakdown,
  clonePaymentSchemeStages,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import { downloadWorkOrderPdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import {
  buildProjectSpkDraft,
  buildProjectWorkspaceData,
} from '../../../../lib/project-workspace';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useFinanceStore } from '../../../../store/finance-store';
import { useProjectsStore } from '../../../../store/projects-store';
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

export default function AdminSpkFormPage() {
  const { id, projectId } = useParams<{ id?: string; projectId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const quotations = useDocumentsStore((state) => state.quotations);
  const workOrders = useDocumentsStore((state) => state.workOrders);
  const deliveryOrders = useDocumentsStore((state) => state.deliveryOrders);
  const agreements = useDocumentsStore((state) => state.agreements);
  const handoverCertificates = useDocumentsStore((state) => state.handoverCertificates);
  const upsertWorkOrder = useDocumentsStore((state) => state.upsertWorkOrder);
  const invoices = useFinanceStore((state) => state.invoices);
  const transactions = useFinanceStore((state) => state.transactions);
  const projects = useProjectsStore((state) => state.projects);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'proyek');

  const isEditMode = Boolean(id);
  const duplicateId = searchParams.get('duplicate');
  const existingDoc = useMemo(
    () => (id ? workOrders.find((doc) => doc.id === id) ?? null : null),
    [id, workOrders]
  );

  const resolvedProjectId = projectId ?? existingDoc?.projectId;
  const project = useMemo(
    () => (resolvedProjectId ? projects.find((p) => p.id === resolvedProjectId) ?? null : null),
    [resolvedProjectId, projects]
  );
  const backPath = resolvedProjectId
    ? `/admin/proyek/${resolvedProjectId}?tab=dokumen`
    : '/admin/proyek';

  const [values, setValues] = useState<WorkOrderDocument>(() => {
    if (existingDoc) return structuredClone(existingDoc);
    if (duplicateId) {
      const source = workOrders.find((doc) => doc.id === duplicateId);
      if (source) {
        return {
          ...duplicateWorkOrderDraft(source, workOrders.length + 16),
          projectId: resolvedProjectId ?? source.projectId,
        };
      }
    }
    if (project) {
      const siblings = buildProjectWorkspaceData(project, {
        quotations,
        agreements,
        workOrders,
        deliveryOrders,
        handoverCertificates,
        invoices,
        transactions,
        paymentScheme,
      });
      return buildProjectSpkDraft(
        project,
        workOrders.length + 16,
        businessConfig,
        paymentScheme,
        siblings
      );
    }
    return createEmptyWorkOrder(workOrders.length + 16, businessConfig, paymentScheme);
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode && existingDoc ? `Ubah ${existingDoc.nomorSpk}` : 'Buat SPK Baru'} | Dokumen Admin ${businessConfig.namaMerek}`
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

  const applyQuotationReference = (quotationId: string) => {
    const selected = quotations.find((q) => q.id === quotationId);
    if (!selected) return;
    const quoTotal = selected.daftarItem.reduce(
      (sum, item) => sum + Math.max(1, item.jumlah || 1) * Math.max(0, item.hargaSatuan || 0),
      0
    );
    setValues((prev) => ({
      ...prev,
      nomorPenawaranReferensi: selected.nomorPenawaran,
      namaProyek: prev.namaProyek.trim() ? prev.namaProyek : selected.namaProyek,
      namaKlien: prev.namaKlien.trim() ? prev.namaKlien : selected.namaKlien,
      teleponKlien: prev.teleponKlien?.trim() ? prev.teleponKlien : selected.teleponKlien,
      alamatPemasangan: prev.alamatPemasangan.trim()
        ? prev.alamatPemasangan
        : selected.alamatLokasi,
      nilaiKontrakReferensi: quoTotal > 0 ? quoTotal : prev.nilaiKontrakReferensi,
      daftarItem:
        selected.daftarItem.length > 0
          ? selected.daftarItem.map((item, idx) => ({
              id: `spk-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
              namaUnit: item.namaItem,
              dimensi: item.dimensi,
              spesifikasiMaterial: item.spesifikasiMaterial,
              jumlah: item.jumlah,
            }))
          : prev.daftarItem,
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
        mobileTabLabel: 'Identitas',
        title: 'Identitas, Jadwal & Referensi',
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
            label: 'Tanggal Terbit SPK',
            type: 'date',
            required: true,
          },
          {
            name: 'tanggalMulai',
            label: 'Tanggal Mulai Kerja',
            type: 'date',
          },
          {
            name: 'tanggalTargetSelesai',
            label: 'Target Selesai Proyek',
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
          {
            name: 'referensiGambarKerja',
            label: 'Referensi Gambar Kerja / Shop Drawing',
            type: 'text',
            colSpan: 'full',
            placeholder: 'Contoh: Gambar Kerja Revisi-02 & Surat Penawaran disetujui',
          },
        ],
      },
      {
        id: 'data-proyek',
        mobileTabLabel: 'Pihak',
        title: 'Tujuan Surat (Klien) & Pengirim (Owner)',
        columns: 2,
        fields: [
          {
            name: 'namaProyek',
            label: 'Nama Proyek / Ruang Lingkup',
            type: 'text',
            required: true,
          },
          {
            name: 'perusahaanPelaksana',
            label: 'Dari Perusahaan / Workshop (Pelaksana)',
            type: 'text',
          },
          {
            name: 'namaKlien',
            label: 'Kepada Yth. / Nama Klien (Pemberi Kerja)',
            type: 'text',
            required: true,
          },
          {
            name: 'teleponKlien',
            label: 'No. HP / WhatsApp Klien',
            type: 'tel',
          },
          {
            name: 'alamatPemasangan',
            label: 'Alamat Pemasangan / Lokasi Proyek',
            type: 'text',
            colSpan: 'full',
          },
          {
            name: 'namaPengawas',
            label: 'Dari / Owner Penanggung Jawab',
            type: 'text',
            colSpan: 'full',
          },
        ],
      },
      {
        id: 'daftar-item',
        mobileTabLabel: 'Item',
        title: `Item Pekerjaan (${values.daftarItem.length})`,
        errorFields: ['daftarItem'],
        headerAction: ({ readOnly, setFieldValue, values: current }) =>
          !readOnly ? (
            <AdminActionButton
              icon={<Plus className="size-3.5" />}
              label="Tambah Item"
              mobileLabel="Item"
              onClick={() =>
                setFieldValue('daftarItem', [...current.daftarItem, createEmptyWorkOrderItem()])
              }
            />
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
                className="p-3.5 sm:p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    Item #{idx + 1}
                  </span>
                  {!readOnly && current.daftarItem.length > 1 && (
                    <AdminActionButton
                      variant="danger"
                      icon={<Trash2 className="size-3.5" />}
                      label={`Hapus Item #${idx + 1}`}
                      iconOnly
                      onClick={() =>
                        setFieldValue(
                          'daftarItem',
                          current.daftarItem.filter((i) => i.id !== item.id)
                        )
                      }
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-9">
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
                  <div className="sm:col-span-3">
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
                  <div className="sm:col-span-12">
                    <FormField id={`item-dim-${item.id}`} label="Dimensi (cm)">
                      <DimensionInput
                        id={`item-dim-${item.id}`}
                        disabled={readOnly}
                        value={item.dimensi}
                        onValueChange={(nextDimensi) =>
                          setFieldValue(
                            'daftarItem',
                            current.daftarItem.map((row) =>
                              row.id === item.id ? { ...row, dimensi: nextDimensi } : row
                            )
                          )
                        }
                      />
                    </FormField>
                  </div>
                </div>

                <div>
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
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: 'landasan-pembayaran',
        mobileTabLabel: 'Pembayaran',
        title: 'Skema Pembayaran',
        columns: 3,
        headerAction: ({ readOnly, setFieldValue }) =>
          !readOnly ? (
            <AdminActionButton
              icon={<RefreshCw className="size-3.5" />}
              label="Terapkan Skema Resmi"
              onClick={() => {
                setFieldValue('tahapanPembayaran', clonePaymentSchemeStages(paymentScheme));
                setFieldValue('catatanPembayaran', paymentScheme.catatan);
              }}
            />
          ) : null,
        fields: [
          {
            name: 'nomorPenawaranReferensi',
            label: 'No. Surat Penawaran Referensi',
            type: 'text',
            placeholder: 'QUO/SDI-K/002/XI/2026',
          },
          {
            name: 'nomorInvoiceReferensi',
            label: 'No. Invoice Referensi',
            type: 'text',
            placeholder: 'INV/SDI-K/002/XI/2026',
          },
          {
            name: 'nilaiKontrakReferensi',
            label: 'Nilai Kontrak Acuan (IDR)',
            type: 'currency',
            zeroAsEmpty: true,
          },
          {
            name: 'catatanPembayaran',
            label: 'Catatan Landasan Termin (Pemicu Tagihan Termin 1 DP)',
            type: 'textarea',
            rows: 2,
            colSpan: 'full',
          },
        ],
        renderContent: ({ readOnly }) => (
          <div className="space-y-3 pt-1">
            {!readOnly && (quotations.length > 0 || invoices.length > 0 || agreements.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)]">
                {quotations.length > 0 && (
                  <FormField id="spk-pick-quo" label="Salin dari Surat Penawaran">
                    <Select
                      id="spk-pick-quo"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) applyQuotationReference(e.target.value);
                      }}
                    >
                      <option value="">— Pilih Penawaran —</option>
                      {quotations.map((quo) => (
                        <option key={quo.id} value={quo.id}>
                          {quo.nomorPenawaran} · {quo.namaKlien}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                )}
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
                  <FormField id="spk-pick-spks" label="Tarik Referensi dari SPK">
                    <Select
                      id="spk-pick-spks"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) applyAgreementReference(e.target.value);
                      }}
                    >
                      <option value="">— Pilih Kontrak SPK —</option>
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
        mobileTabLabel: 'K3 & Syarat',
        title: 'Syarat & Ketentuan, Catatan Teknis & K3',
        columns: 2,
        fields: [
          {
            name: 'syaratKetentuan',
            label: 'Ketentuan-Ketentuan SPK (Persetujuan Klien untuk Memulai Kerja)',
            type: 'textarea',
            rows: 5,
            colSpan: 'full',
          },
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
    [values.daftarItem.length, paymentBreakdown, paymentScheme, quotations, invoices, agreements]
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

    const payload: WorkOrderDocument = {
      ...normalizeWorkOrderPayload(values),
      projectId: values.projectId ?? resolvedProjectId,
    };
    upsertWorkOrder(payload);
    recordActivity(
      isEditMode ? 'Memperbarui Surat Perintah Kerja' : 'Membuat Surat Perintah Kerja baru',
      'Dokumen SPK',
      payload.nomorSpk
    );

    navigate(backPath, {
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
      title={isEditMode ? 'Edit SPK' : 'Buat SPK'}
      description={
        project
          ? `Proyek: ${[project.id, project.namaProyek].filter(Boolean).join(' · ')}`
          : undefined
      }
      backTo={backPath}
      backLabel={project ? 'Kembali ke Proyek' : 'Kembali ke Daftar Proyek'}
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
          <>
            {resolvedProjectId && (
              <AdminActionLink
                to={`/admin/proyek/${resolvedProjectId}/dokumen/spk/${existingDoc.id}/pratinjau`}
                icon={<Eye className="size-3.5" />}
                label="Pratinjau"
              />
            )}
            <AdminActionButton
              icon={<Printer className="size-3.5" />}
              label="Cetak PDF SPK"
              onClick={() =>
                downloadWorkOrderPdf(normalizeWorkOrderPayload(values), businessConfig, paymentScheme)
              }
            />
          </>
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
      asideTabLabel="Ringkasan"
      aside={
        <AdminFormSectionCard title="Ringkasan SPK">
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
