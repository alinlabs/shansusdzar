import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Printer, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { AdminActionButton } from '../../../../components/admin/admin-action-buttons';
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
import { formatShortDateId } from '../../../../lib/finance-utils';
import { DEFAULT_PAYMENT_SCHEME } from '../../../../lib/payment-scheme';
import { downloadDeliveryOrderPdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import {
  buildProjectDeliveryOrderDraft,
  buildProjectWorkspaceData,
} from '../../../../lib/project-workspace';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useFinanceStore } from '../../../../store/finance-store';
import { useProjectsStore } from '../../../../store/projects-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type {
  DeliveryOrderDocument,
  DeliveryOrderItemCondition,
} from '../../../../types/documents';
import {
  DELIVERY_ORDER_CLIENT_VERIFICATIONS,
  DELIVERY_ORDER_CONDITIONS,
  DELIVERY_ORDER_STATUSES,
  buildDeliveryOrderPrefillFromAgreement,
  buildDeliveryOrderPrefillFromQuotation,
  computeDeliveryOrderStats,
  createEmptyDeliveryOrder,
  createEmptyDeliveryOrderItem,
  normalizeDeliveryOrderPayload,
  validateDeliveryOrderDraft,
} from './logic';

export default function AdminSuratJalanFormPage() {
  const { id, projectId } = useParams<{ id?: string; projectId?: string }>();
  const navigate = useNavigate();

  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const quotations = useDocumentsStore((state) => state.quotations);
  const agreements = useDocumentsStore((state) => state.agreements);
  const workOrders = useDocumentsStore((state) => state.workOrders);
  const deliveryOrders = useDocumentsStore((state) => state.deliveryOrders);
  const handoverCertificates = useDocumentsStore((state) => state.handoverCertificates);
  const upsertDeliveryOrder = useDocumentsStore((state) => state.upsertDeliveryOrder);
  const invoices = useFinanceStore((state) => state.invoices);
  const transactions = useFinanceStore((state) => state.transactions);
  const projects = useProjectsStore((state) => state.projects);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'proyek');

  const isEditMode = Boolean(id);
  const existingDoc = useMemo(
    () => (id ? deliveryOrders.find((doc) => doc.id === id) ?? null : null),
    [id, deliveryOrders]
  );

  const resolvedProjectId = projectId ?? existingDoc?.projectId;
  const project = useMemo(
    () => (resolvedProjectId ? projects.find((p) => p.id === resolvedProjectId) ?? null : null),
    [resolvedProjectId, projects]
  );
  const backPath = resolvedProjectId
    ? `/admin/proyek/${resolvedProjectId}?tab=dokumen`
    : '/admin/proyek';

  const [values, setValues] = useState<DeliveryOrderDocument>(() => {
    if (existingDoc) return structuredClone(existingDoc);
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
      return buildProjectDeliveryOrderDraft(
        project,
        deliveryOrders.length + 20,
        businessConfig,
        siblings
      );
    }
    return createEmptyDeliveryOrder(deliveryOrders.length + 20, businessConfig);
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode && existingDoc ? `Ubah ${existingDoc.nomorSuratJalan}` : 'Buat Surat Jalan'} | Dokumen Admin ${businessConfig.namaMerek}`
  );

  const stats = useMemo(() => computeDeliveryOrderStats(values.daftarItem), [values.daftarItem]);

  const sections = useMemo<AdminFormSectionConfig<DeliveryOrderDocument>[]>(
    () => [
      {
        id: 'identitas-pengiriman',
        mobileTabLabel: 'Identitas',
        title: 'Identitas Surat Jalan & Referensi',
        columns: 3,
        fields: [
          {
            name: 'nomorSuratJalan',
            label: 'Nomor Surat Jalan',
            type: 'text',
            required: true,
          },
          {
            name: 'tanggalKirim',
            label: 'Tanggal Kirim',
            type: 'date',
            required: true,
          },
          {
            name: 'status',
            label: 'Status Surat Jalan',
            type: 'select',
            options: DELIVERY_ORDER_STATUSES.map((st) => ({ value: st, label: st })),
          },
          {
            name: 'nomorSpkReferensi',
            label: 'Referensi Nomor SPK',
            type: 'text',
            placeholder: 'SPK/SDI-K/002/XI/2026',
          },
          {
            name: 'nomorInvoiceReferensi',
            label: 'Referensi Invoice',
            type: 'text',
            placeholder: 'INV/SDI-K/002/XI/2026',
          },
        ],
        renderContent: ({ readOnly }) => {
          if (readOnly || (agreements.length === 0 && quotations.length === 0)) return null;
          return (
            <div className="pt-3 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 gap-3">
              {agreements.length > 0 && (
                <FormField id="sj-pick-spks" label="Salin Referensi dari SPK">
                  <Select
                    id="sj-pick-spks"
                    value=""
                    onChange={(e) => {
                      const spks = agreements.find((item) => item.id === e.target.value);
                      if (spks) setValues((prev) => buildDeliveryOrderPrefillFromAgreement(spks, prev));
                    }}
                  >
                    <option value="">— Pilih SPK —</option>
                    {agreements.map((spks) => (
                      <option key={spks.id} value={spks.id}>
                        {spks.nomorKontrak} · {spks.judulProyek}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
              {quotations.length > 0 && (
                <FormField id="sj-pick-quo" label="Salin Barang dari Surat Penawaran">
                  <Select
                    id="sj-pick-quo"
                    value=""
                    onChange={(e) => {
                      const quo = quotations.find((item) => item.id === e.target.value);
                      if (quo) setValues((prev) => buildDeliveryOrderPrefillFromQuotation(quo, prev));
                    }}
                  >
                    <option value="">— Pilih Penawaran —</option>
                    {quotations.map((quo) => (
                      <option key={quo.id} value={quo.id}>
                        {quo.nomorPenawaran} · {quo.namaProyek}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
            </div>
          );
        },
      },
      {
        id: 'tujuan-lokasi',
        mobileTabLabel: 'Tujuan',
        title: 'Tujuan & Lokasi Pengiriman',
        columns: 2,
        fields: [
          {
            name: 'namaProyek',
            label: 'Nama Proyek',
            type: 'text',
            required: true,
          },
          {
            name: 'teleponKlien',
            label: 'No. HP / WhatsApp Tujuan',
            type: 'tel',
          },
          {
            name: 'alamatTujuan',
            label: 'Alamat Lokasi Pengiriman & Pemasangan',
            type: 'text',
            required: true,
            colSpan: 'full',
          },
          {
            name: 'penanggungJawabPengirimanInstalasi',
            label: 'Penanggung Jawab',
            type: 'text',
            placeholder: 'Nama penanggung jawab pengiriman & instalasi',
            colSpan: 'full',
          },
        ],
      },
      {
        id: 'daftar-barang',
        mobileTabLabel: 'Barang',
        title: `Daftar Detail Barang Pengiriman (${values.daftarItem.length})`,
        errorFields: ['daftarItem'],
        headerAction: ({ readOnly, setFieldValue, values: current }) =>
          !readOnly ? (
            <AdminActionButton
              icon={<Plus className="size-3.5" />}
              label="Tambah Barang"
              mobileLabel="Barang"
              onClick={() =>
                setFieldValue('daftarItem', [...current.daftarItem, createEmptyDeliveryOrderItem()])
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
                    Barang #{idx + 1}
                  </span>
                  {!readOnly && current.daftarItem.length > 1 && (
                    <AdminActionButton
                      variant="danger"
                      icon={<Trash2 className="size-3.5" />}
                      label={`Hapus Barang #${idx + 1}`}
                      iconOnly
                      onClick={() =>
                        setFieldValue(
                          'daftarItem',
                          current.daftarItem.filter((row) => row.id !== item.id)
                        )
                      }
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-10">
                    <FormField id={`sj-item-${item.id}`} label="Nama Barang / Unit" required>
                      <Input
                        id={`sj-item-${item.id}`}
                        required
                        disabled={readOnly}
                        placeholder="Contoh: Kitchen Set / Kabinet Bawah"
                        value={item.namaBarang}
                        onChange={(e) =>
                          setFieldValue(
                            'daftarItem',
                            current.daftarItem.map((row) =>
                              row.id === item.id ? { ...row, namaBarang: e.target.value } : row
                            )
                          )
                        }
                      />
                    </FormField>
                  </div>
                  <div className="sm:col-span-2">
                    <FormField id={`sj-unit-${item.id}`} label="Unit">
                      <Input
                        id={`sj-unit-${item.id}`}
                        type="number"
                        min={1}
                        disabled={readOnly}
                        value={item.jumlahUnit}
                        onChange={(e) =>
                          setFieldValue(
                            'daftarItem',
                            current.daftarItem.map((row) =>
                              row.id === item.id
                                ? { ...row, jumlahUnit: Number(e.target.value) || 1 }
                                : row
                            )
                          )
                        }
                      />
                    </FormField>
                  </div>
                  <div className="sm:col-span-12">
                    <FormField id={`sj-dim-${item.id}`} label="Dimensi (cm)">
                      <DimensionInput
                        id={`sj-dim-${item.id}`}
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

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4">
                    <FormField id={`sj-cond-${item.id}`} label="Kondisi Barang">
                      <Select
                        id={`sj-cond-${item.id}`}
                        disabled={readOnly}
                        value={item.kondisiSaatKeluar}
                        onChange={(e) =>
                          setFieldValue(
                            'daftarItem',
                            current.daftarItem.map((row) =>
                              row.id === item.id
                                ? {
                                    ...row,
                                    kondisiSaatKeluar: e.target.value as DeliveryOrderItemCondition,
                                  }
                                : row
                            )
                          )
                        }
                      >
                        {DELIVERY_ORDER_CONDITIONS.map((cond) => (
                          <option key={cond} value={cond}>
                            {cond}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>
                  <div className="sm:col-span-8">
                    <FormField id={`sj-note-${item.id}`} label="Detail Spesifikasi & Kelengkapan Barang">
                      <Input
                        id={`sj-note-${item.id}`}
                        disabled={readOnly}
                        placeholder="Material, finishing, kelengkapan aksesoris & catatan unit"
                        value={item.catatanPemasangan}
                        onChange={(e) =>
                          setFieldValue(
                            'daftarItem',
                            current.daftarItem.map((row) =>
                              row.id === item.id
                                ? { ...row, catatanPemasangan: e.target.value }
                                : row
                            )
                          )
                        }
                      />
                    </FormField>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: 'verifikasi-arsip-audit',
        mobileTabLabel: 'Pengesahan',
        title: 'Ketentuan Pemeriksaan & Pengesahan 3 Tanda Tangan',
        columns: 2,
        fields: [
          {
            name: 'instruksiPemasangan',
            label: 'Ketentuan Pemeriksaan Barang & Pengesahan Arsip',
            type: 'textarea',
            rows: 4,
            colSpan: 'full',
          },
          {
            name: 'statusVerifikasiKlien',
            label: 'Status TTD Barang Datang (Saat Pengiriman)',
            type: 'select',
            options: DELIVERY_ORDER_CLIENT_VERIFICATIONS.map((v) => ({ value: v, label: v })),
          },
          {
            name: 'tanggalVerifikasiKlien',
            label: 'Tanggal Tanda Tangan',
            type: 'date',
          },
          {
            name: 'salinanDiarsipkanAdmin',
            label: 'Tanda tangan verifikasi ulang klien setelah instalasi sudah lengkap & diarsipkan',
            type: 'checkbox',
            colSpan: 'full',
          },
          {
            name: 'catatanAuditAdmin',
            label: 'Catatan Arsip Surat Jalan',
            type: 'textarea',
            rows: 2,
            colSpan: 'full',
          },
        ],
      },
    ],
    [values.daftarItem.length, agreements, quotations]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validateDeliveryOrderDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload: DeliveryOrderDocument = {
      ...normalizeDeliveryOrderPayload(values),
      projectId: values.projectId ?? resolvedProjectId,
    };
    upsertDeliveryOrder(payload);
    recordActivity(
      isEditMode ? 'Memperbarui Surat Jalan' : 'Menerbitkan Surat Jalan baru',
      'Dokumen Surat Jalan',
      payload.nomorSuratJalan
    );

    navigate(backPath, {
      state: {
        feedback: {
          type: 'ok',
          text: isEditMode
            ? `Surat Jalan ${payload.nomorSuratJalan} berhasil diperbarui.`
            : `Surat Jalan ${payload.nomorSuratJalan} berhasil disimpan.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={isEditMode ? 'Edit Surat Jalan' : 'Buat Surat Jalan'}
      description={
        project
          ? `Proyek: ${[project.id, project.namaProyek].filter(Boolean).join(' · ')}`
          : undefined
      }
      backTo={backPath}
      backLabel={project ? 'Kembali ke Proyek' : 'Kembali ke Daftar Proyek'}
      submitLabel={isEditMode ? 'Simpan Perubahan Surat Jalan' : 'Simpan Surat Jalan'}
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      extraHeaderActions={
        isEditMode && existingDoc ? (
          <AdminActionButton
            icon={<Printer className="size-3.5" />}
            label="Cetak PDF Surat Jalan"
            onClick={() =>
              downloadDeliveryOrderPdf(normalizeDeliveryOrderPayload(values), businessConfig)
            }
          />
        ) : undefined
      }
      notFoundState={
        isEditMode && !existingDoc
          ? {
              title: 'Surat Jalan Tidak Ditemukan',
              message: 'Data Surat Jalan yang dicari tidak tersedia atau sudah dihapus.',
            }
          : undefined
      }
      asideTabLabel="Ringkasan"
      aside={
        <AdminFormSectionCard title="Ringkasan Surat Jalan">
          <dl className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Nomor Surat Jalan</dt>
              <dd className="font-mono font-semibold text-[var(--text)]">
                {values.nomorSuratJalan || '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Tanggal Kirim</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {values.tanggalKirim ? formatShortDateId(values.tanggalKirim) : '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Muatan Pengiriman</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {stats.totalUnits} unit
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Penanggung Jawab</dt>
              <dd className="font-medium text-[var(--text)] text-right">
                {values.penanggungJawabPengirimanInstalasi || '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Verifikasi Klien</dt>
              <dd className="font-medium text-[var(--text)] text-right">
                {values.statusVerifikasiKlien}
              </dd>
            </div>
            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Arsip Salinan Admin</dt>
              <dd
                className={
                  values.salinanDiarsipkanAdmin
                    ? 'font-semibold text-[var(--success)]'
                    : 'font-medium text-[var(--text-muted)]'
                }
              >
                {values.salinanDiarsipkanAdmin ? 'Sudah Diarsipkan' : 'Belum Kembali'}
              </dd>
            </div>
          </dl>
        </AdminFormSectionCard>
      }
    />
  );
}
