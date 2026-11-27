import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Printer, Trash2 } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
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
import { formatRupiahSigned, formatShortDateId } from '../../../../lib/finance-utils';
import { DEFAULT_PAYMENT_SCHEME } from '../../../../lib/payment-scheme';
import { downloadHandoverPdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import {
  buildProjectBastDraft,
  buildProjectWorkspaceData,
} from '../../../../lib/project-workspace';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useFinanceStore } from '../../../../store/finance-store';
import { useProjectsStore } from '../../../../store/projects-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type {
  HandoverCertificateDocument,
  HandoverItemCondition,
} from '../../../../types/documents';
import {
  HANDOVER_ITEM_CONDITIONS,
  HANDOVER_STATUSES,
  HANDOVER_TYPES,
  buildHandoverPrefillFromAgreement,
  buildHandoverPrefillFromDeliveryOrder,
  buildHandoverPrefillFromInvoice,
  computeHandoverStats,
  createEmptyHandover,
  createEmptyHandoverItem,
  duplicateHandoverDraft,
  normalizeHandoverPayload,
  resolveBastPaymentRecordSummary,
  validateHandoverDraft,
} from './logic';

export default function AdminBastFormPage() {
  const { id, projectId } = useParams<{ id?: string; projectId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const handoverCertificates = useDocumentsStore((state) => state.handoverCertificates);
  const quotations = useDocumentsStore((state) => state.quotations);
  const workOrders = useDocumentsStore((state) => state.workOrders);
  const deliveryOrders = useDocumentsStore((state) => state.deliveryOrders);
  const agreements = useDocumentsStore((state) => state.agreements);
  const upsertHandoverCertificate = useDocumentsStore((state) => state.upsertHandoverCertificate);
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
    () => (id ? handoverCertificates.find((doc) => doc.id === id) ?? null : null),
    [id, handoverCertificates]
  );

  const resolvedProjectId = projectId ?? existingDoc?.projectId;
  const project = useMemo(
    () => (resolvedProjectId ? projects.find((p) => p.id === resolvedProjectId) ?? null : null),
    [resolvedProjectId, projects]
  );
  const backPath = resolvedProjectId
    ? `/admin/proyek/${resolvedProjectId}?tab=dokumen`
    : '/admin/proyek';

  const [values, setValues] = useState<HandoverCertificateDocument>(() => {
    if (existingDoc) return structuredClone(existingDoc);
    if (duplicateId) {
      const source = handoverCertificates.find((doc) => doc.id === duplicateId);
      if (source) {
        return {
          ...duplicateHandoverDraft(source, handoverCertificates.length + 6),
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
      return buildProjectBastDraft(
        project,
        handoverCertificates.length + 6,
        businessConfig,
        paymentScheme,
        siblings
      );
    }
    return createEmptyHandover(handoverCertificates.length + 6, businessConfig, paymentScheme);
  });

  const [selectedSpksId, setSelectedSpksId] = useState('');
  const [selectedSjId, setSelectedSjId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode && existingDoc ? `Ubah ${existingDoc.nomorBast}` : 'Buat BAST Baru'} | Dokumen Admin ${businessConfig.namaMerek}`
  );

  const stats = useMemo(() => computeHandoverStats(values.daftarItem), [values.daftarItem]);

  const linkedInvoice = useMemo(
    () =>
      invoices.find(
        (inv) =>
          (resolvedProjectId && inv.projectId === resolvedProjectId) ||
          (values.nomorInvoiceReferensi &&
            inv.nomorInvoice.toLowerCase() === values.nomorInvoiceReferensi.toLowerCase())
      ) ?? null,
    [invoices, resolvedProjectId, values.nomorInvoiceReferensi]
  );

  const paymentSummary = useMemo(
    () => resolveBastPaymentRecordSummary(values, linkedInvoice, paymentScheme, project),
    [values, linkedInvoice, paymentScheme, project]
  );

  const handleApplySpksPrefill = (spksId: string) => {
    setSelectedSpksId(spksId);
    const spks = agreements.find((item) => item.id === spksId);
    if (!spks) return;
    setValues((prev) => buildHandoverPrefillFromAgreement(spks, prev, paymentScheme));
  };

  const handleApplySjPrefill = (sjId: string) => {
    setSelectedSjId(sjId);
    const sj = deliveryOrders.find((item) => item.id === sjId);
    if (!sj) return;
    setValues((prev) => buildHandoverPrefillFromDeliveryOrder(sj, prev));
  };

  const handleApplyInvoicePrefill = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice) return;
    setValues((prev) => buildHandoverPrefillFromInvoice(invoice, prev, paymentScheme));
  };

  const sections = useMemo<AdminFormSectionConfig<HandoverCertificateDocument>[]>(
    () => [
      {
        id: 'identitas-bast',
        mobileTabLabel: 'Identitas',
        title: 'Identitas BAST',
        columns: 3,
        fields: [
          {
            name: 'nomorBast',
            label: 'Nomor BAST',
            type: 'text',
            required: true,
          },
          {
            name: 'jenisSerahTerima',
            label: 'Jenis Serah Terima',
            type: 'select',
            options: HANDOVER_TYPES.map((t) => ({ value: t, label: t })),
          },
          {
            name: 'status',
            label: 'Status Dokumen',
            type: 'select',
            options: HANDOVER_STATUSES.map((st) => ({ value: st, label: st })),
          },
          {
            name: 'kotaSerahTerima',
            label: 'Kota Serah Terima',
            type: 'text',
          },
          {
            name: 'tanggalSerahTerima',
            label: 'Tanggal Serah Terima',
            type: 'date',
            required: true,
          },
          {
            name: 'persentaseSelesai',
            label: 'Progres Pekerjaan (%)',
            type: 'number',
            min: 0,
            max: 100,
          },
          {
            name: 'nomorSpksReferensi',
            label: 'Referensi Nomor SPK',
            type: 'text',
            placeholder: 'Opsional, mis. SPK/SDI-K/002/XI/2026',
          },
          {
            name: 'nomorSuratJalanReferensi',
            label: 'Referensi Nomor Surat Jalan',
            type: 'text',
            placeholder: 'Opsional, mis. SJI/SDI-K/002/XI/2026',
          },
          {
            name: 'nomorInvoiceReferensi',
            label: 'Referensi Nomor Invoice',
            type: 'text',
            placeholder: 'Opsional, mis. INV/SDI-K/002/XI/2026',
          },
        ],
        renderContent: ({ readOnly }) => {
          if (
            readOnly ||
            (agreements.length === 0 && deliveryOrders.length === 0 && invoices.length === 0)
          ) {
            return null;
          }
          return (
            <div className="pt-3 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-3 gap-3">
              {agreements.length > 0 && (
                <FormField
                  id="prefill-from-spks"
                  label="Salin Cepat dari SPK"
                >
                  <Select
                    id="prefill-from-spks"
                    value={selectedSpksId}
                    onChange={(e) => handleApplySpksPrefill(e.target.value)}
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

              {deliveryOrders.length > 0 && (
                <FormField
                  id="prefill-from-sj"
                  label="Salin Cepat dari Surat Jalan"
                >
                  <Select
                    id="prefill-from-sj"
                    value={selectedSjId}
                    onChange={(e) => handleApplySjPrefill(e.target.value)}
                  >
                    <option value="">— Pilih Surat Jalan —</option>
                    {deliveryOrders.map((sj) => (
                      <option key={sj.id} value={sj.id}>
                        {sj.nomorSuratJalan} · {sj.namaKlien}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}

              {invoices.length > 0 && (
                <FormField
                  id="prefill-from-invoice"
                  label="Salin Cepat dari Invoice"
                >
                  <Select
                    id="prefill-from-invoice"
                    value={selectedInvoiceId}
                    onChange={(e) => handleApplyInvoicePrefill(e.target.value)}
                  >
                    <option value="">— Pilih Invoice —</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.nomorInvoice} · {inv.namaKlien}
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
        id: 'pihak-pertama',
        mobileTabLabel: 'Pihak 1',
        title: 'Pihak Pertama',
        columns: 3,
        fields: [
          {
            name: 'perusahaanPihakPertama',
            label: 'Nama Perusahaan / Studio',
            type: 'text',
          },
          {
            name: 'perwakilanPihakPertama',
            label: 'Perwakilan Workshop',
            type: 'text',
          },
          {
            name: 'jabatanPihakPertama',
            label: 'Jabatan',
            type: 'text',
          },
          {
            name: 'alamatPihakPertama',
            label: 'Alamat Workshop',
            type: 'textarea',
            rows: 2,
            colSpan: 'full',
          },
        ],
      },
      {
        id: 'pihak-kedua',
        mobileTabLabel: 'Pihak 2',
        title: 'Pihak Kedua',
        columns: 3,
        fields: [
          {
            name: 'namaPihakKedua',
            label: 'Nama Penerima / Klien',
            type: 'text',
            required: true,
          },
          {
            name: 'jabatanPihakKedua',
            label: 'Kedudukan / Peran',
            type: 'text',
          },
          {
            name: 'teleponPihakKedua',
            label: 'No. HP / WhatsApp',
            type: 'tel',
          },
          {
            name: 'alamatPihakKedua',
            label: 'Alamat Klien',
            type: 'textarea',
            rows: 2,
            colSpan: 'full',
          },
        ],
      },
      {
        id: 'proyek-garansi',
        mobileTabLabel: 'Proyek',
        title: 'Rangkuman Proyek & Garansi',
        columns: 3,
        fields: [
          {
            name: 'namaProyek',
            label: 'Nama Proyek / Pekerjaan',
            type: 'text',
            required: true,
            colSpan: 2,
            placeholder: 'Contoh: Kitchen Set L-Shape HPL & Pantry',
          },
          {
            name: 'masaGaransiBulan',
            label: 'Masa Garansi (Bulan)',
            type: 'number',
            min: 0,
          },
          {
            name: 'lokasiPemasangan',
            label: 'Lokasi Pemasangan',
            type: 'text',
            colSpan: 2,
          },
          {
            name: 'tanggalMulaiGaransi',
            label: 'Mulai Berlaku Garansi',
            type: 'date',
          },
        ],
      },
      {
        id: 'record-pembayaran-bast',
        mobileTabLabel: 'Pembayaran',
        title: 'Record Pembayaran (Pasca Termin 4)',
        columns: 2,
        fields: [
          {
            name: 'nilaiKontrakReferensi',
            label: 'Total Nilai Kontrak (IDR)',
            type: 'currency',
            zeroAsEmpty: true,
          },
          {
            name: 'catatanPembayaran',
            label: 'Catatan Verifikasi Kelunasan',
            type: 'text',
            placeholder:
              'Diterbitkan setelah penerimaan Termin 4 & verifikasi kelunasan kontrak',
          },
        ],
        renderContent: () => (
          <div className="space-y-3 pt-1">
            <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
              <div className="space-y-0.5">
                <p className="font-semibold text-[var(--text)]">
                  Status Pelunasan Proyek (Final Pasca Termin 4)
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  BAST hanya diterbitkan setelah seluruh tahapan pembayaran hingga Termin 4 diterima.
                </p>
              </div>
              <div className="sm:text-right shrink-0">
                <p className="font-bold text-[var(--text)] tabular-nums">
                  {paymentSummary.contractValue > 0
                    ? formatRupiahSigned(paymentSummary.totalPaid)
                    : '—'}
                </p>
                <p className="text-[11px] font-semibold text-[var(--success)]">
                  LUNAS (100% — Pasca Termin 4)
                </p>
              </div>
            </div>

            {paymentSummary.records.length > 0 && (
              <div className="border border-[var(--border)] rounded-[var(--radius-md)] divide-y divide-[var(--border)] bg-[var(--bg)]">
                {paymentSummary.records.map((rec) => (
                  <div
                    key={rec.id}
                    className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-[var(--text)]">{rec.label}</span>
                      <span className="text-[11px] text-[var(--text-muted)] ml-2 tabular-nums">
                        {formatShortDateId(rec.tanggal)} · {rec.metodePembayaran}
                      </span>
                    </div>
                    <span className="font-semibold text-[var(--text)] tabular-nums shrink-0">
                      {formatRupiahSigned(rec.nominal)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'checklist-serah-terima',
        mobileTabLabel: 'Checklist',
        title: `Checklist Unit (${values.daftarItem.length})`,
        errorFields: ['daftarItem'],
        headerAction: ({ readOnly, setFieldValue, values: current }) =>
          !readOnly ? (
            <AdminActionButton
              icon={<Plus className="size-3.5" />}
              label="Tambah Unit"
              mobileLabel="Unit"
              onClick={() =>
                setFieldValue('daftarItem', [...current.daftarItem, createEmptyHandoverItem()])
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
                    Unit #{idx + 1}
                  </span>
                  {!readOnly && current.daftarItem.length > 1 && (
                    <AdminActionButton
                      variant="danger"
                      icon={<Trash2 className="size-3.5" />}
                      label={`Hapus Unit #${idx + 1}`}
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
                  <div className="sm:col-span-9">
                    <FormField id={`bast-unit-${item.id}`} label="Nama Unit / Bagian" required>
                      <Input
                        id={`bast-unit-${item.id}`}
                        required
                        disabled={readOnly}
                        placeholder="Contoh: Kabinet Dapur Bawah"
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
                    <FormField id={`bast-qty-${item.id}`} label="Jumlah">
                      <Input
                        id={`bast-qty-${item.id}`}
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
                    <FormField id={`bast-dim-${item.id}`} label="Dimensi (cm)">
                      <DimensionInput
                        id={`bast-dim-${item.id}`}
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
                    <FormField id={`bast-cond-${item.id}`} label="Hasil Pemeriksaan">
                      <Select
                        id={`bast-cond-${item.id}`}
                        disabled={readOnly}
                        value={item.kondisi}
                        onChange={(e) =>
                          setFieldValue(
                            'daftarItem',
                            current.daftarItem.map((row) =>
                              row.id === item.id
                                ? {
                                    ...row,
                                    kondisi: e.target.value as HandoverItemCondition,
                                  }
                                : row
                            )
                          )
                        }
                      >
                        {HANDOVER_ITEM_CONDITIONS.map((cond) => (
                          <option key={cond} value={cond}>
                            {cond}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>

                  <div className="sm:col-span-8">
                    <FormField id={`bast-note-${item.id}`} label="Catatan Lapangan">
                      <Input
                        id={`bast-note-${item.id}`}
                        disabled={readOnly}
                        placeholder="Engsel rata, laci halus, sealant rapi"
                        value={item.catatan}
                        onChange={(e) =>
                          setFieldValue(
                            'daftarItem',
                            current.daftarItem.map((row) =>
                              row.id === item.id ? { ...row, catatan: e.target.value } : row
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
        id: 'pernyataan-saksi',
        mobileTabLabel: 'Saksi',
        title: 'Pernyataan & Saksi',
        columns: 2,
        fields: [
          {
            name: 'teksPernyataan',
            label: 'Naskah Pernyataan Serah Terima',
            type: 'textarea',
            rows: 3,
            colSpan: 'full',
          },
          {
            name: 'catatanTindakLanjut',
            label: 'Catatan Tindak Lanjut & Pemeliharaan',
            type: 'textarea',
            rows: 2,
            colSpan: 'full',
          },
          {
            name: 'saksiPihakPertama',
            label: 'Saksi Pihak Pertama',
            type: 'text',
          },
          {
            name: 'saksiPihakKedua',
            label: 'Saksi Pihak Kedua',
            type: 'text',
          },
        ],
      },
    ],
    [
      values.daftarItem.length,
      agreements,
      deliveryOrders,
      invoices,
      selectedSpksId,
      selectedSjId,
      selectedInvoiceId,
      paymentSummary,
      paymentScheme,
    ]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validateHandoverDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload: HandoverCertificateDocument = {
      ...normalizeHandoverPayload(values),
      projectId: values.projectId ?? resolvedProjectId,
    };
    upsertHandoverCertificate(payload);
    recordActivity(
      isEditMode
        ? 'Memperbarui Berita Acara Serah Terima'
        : 'Membuat Berita Acara Serah Terima baru',
      'Dokumen BAST',
      payload.nomorBast
    );

    navigate(backPath, {
      state: {
        feedback: {
          type: 'ok',
          text: isEditMode
            ? `Perubahan BAST ${payload.nomorBast} berhasil disimpan.`
            : `Berita Acara Serah Terima ${payload.nomorBast} telah diterbitkan.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={isEditMode ? 'Edit BAST' : 'Buat BAST'}
      description={
        project
          ? `Proyek: ${[project.id, project.namaProyek].filter(Boolean).join(' · ')}`
          : undefined
      }
      backTo={backPath}
      backLabel={project ? 'Kembali ke Proyek' : 'Kembali ke Daftar Proyek'}
      submitLabel={isEditMode ? 'Simpan Perubahan BAST' : 'Simpan BAST'}
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
            label="Cetak PDF BAST"
            onClick={() =>
              downloadHandoverPdf(
                normalizeHandoverPayload(values),
                businessConfig,
                paymentScheme,
                linkedInvoice,
                project
              )
            }
          />
        ) : undefined
      }
      notFoundState={
        isEditMode && !existingDoc
          ? {
              title: 'Dokumen BAST Tidak Ditemukan',
              message:
                'Data Berita Acara Serah Terima yang dicari tidak tersedia atau sudah dihapus.',
            }
          : undefined
      }
      asideTabLabel="Ringkasan"
      aside={
        <AdminFormSectionCard title="Ringkasan BAST">
          <dl className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Nomor BAST</dt>
              <dd className="font-mono font-semibold text-[var(--text)]">
                {values.nomorBast || '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Status &amp; Progres</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {values.status} · {values.persentaseSelesai}%
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Tanggal Serah Terima</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {values.tanggalSerahTerima ? formatShortDateId(values.tanggalSerahTerima) : '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Checklist Unit</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {stats.passedRows}/{stats.totalRows} baik · {stats.totalUnits} unit
              </dd>
            </div>
            <div className="pt-2 border-t border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-muted)]">Record Pembayaran</dt>
                <dd className="font-semibold text-[var(--text)] tabular-nums">
                  {paymentSummary.contractValue > 0
                    ? formatRupiahSigned(paymentSummary.totalPaid)
                    : '-'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-muted)]">Status Kelunasan</dt>
                <dd className="font-semibold text-[var(--success)] text-right">
                  Lunas (Pasca Termin 4)
                </dd>
              </div>
            </div>
            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Masa Garansi</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {values.masaGaransiBulan} bulan
              </dd>
            </div>
          </dl>
        </AdminFormSectionCard>
      }
    />
  );
}
