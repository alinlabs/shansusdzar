import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { AdminActionButton } from '../../../../components/admin/admin-action-buttons';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { CurrencyInput, Input } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { computeInvoiceProgress, formatRupiahSigned } from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  clonePaymentSchemeStages,
  evaluateInvoicePaymentSchedule,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import { downloadProjectInvoicePdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import {
  buildProjectInvoiceDraft,
  buildProjectWorkspaceData,
} from '../../../../lib/project-workspace';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useFinanceStore } from '../../../../store/finance-store';
import { useProjectsStore } from '../../../../store/projects-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { ProjectInvoice } from '../../../../types/finance';
import {
  createEmptyInvoice,
  createEmptyInvoiceLineItem,
  normalizeInvoicePayload,
  validateInvoiceDraft,
} from './logic';

export default function AdminInvoiceFormPage() {
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
  const invoices = useFinanceStore((state) => state.invoices);
  const transactions = useFinanceStore((state) => state.transactions);
  const upsertProjectInvoice = useFinanceStore((state) => state.upsertProjectInvoice);
  const projects = useProjectsStore((state) => state.projects);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'proyek');

  const isEditMode = Boolean(id);
  const existingInvoice = useMemo(
    () => (id ? invoices.find((inv) => inv.id === id) ?? null : null),
    [id, invoices]
  );

  const resolvedProjectId = projectId ?? existingInvoice?.projectId;
  const project = useMemo(
    () => (resolvedProjectId ? projects.find((p) => p.id === resolvedProjectId) ?? null : null),
    [resolvedProjectId, projects]
  );
  const backPath = resolvedProjectId
    ? `/admin/proyek/${resolvedProjectId}?tab=dokumen`
    : '/admin/proyek';

  const [values, setValues] = useState<ProjectInvoice>(() => {
    if (existingInvoice) return structuredClone(existingInvoice);
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
      return buildProjectInvoiceDraft(project, invoices.length + 45, paymentScheme, siblings);
    }
    return createEmptyInvoice(invoices.length + 45, paymentScheme);
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode && existingInvoice ? `Ubah ${existingInvoice.nomorInvoice}` : 'Buat Tagihan Proyek'} | Dokumen Admin ${businessConfig.namaMerek}`
  );

  const lineItems = values.rincianItem ?? [];
  const lineItemsTotal = lineItems.reduce(
    (sum, item) => sum + Math.max(1, item.jumlah || 1) * Math.max(0, item.hargaSatuan || 0),
    0
  );

  const effectiveScheme = useMemo(
    () => resolveEffectivePaymentScheme(values.skemaPembayaran, paymentScheme),
    [values.skemaPembayaran, paymentScheme]
  );

  const schedule = useMemo(
    () =>
      evaluateInvoicePaymentSchedule(
        values.nilaiTotalKontrak || 0,
        values.riwayatPembayaran,
        effectiveScheme
      ),
    [values.nilaiTotalKontrak, values.riwayatPembayaran, effectiveScheme]
  );

  const sections = useMemo<AdminFormSectionConfig<ProjectInvoice>[]>(
    () => [
      {
        id: 'identitas-invoice',
        mobileTabLabel: 'Identitas',
        title: 'Identitas Tagihan',
        columns: 2,
        fields: [
          {
            name: 'nomorInvoice',
            label: 'Nomor Invoice',
            type: 'text',
            required: true,
          },
          {
            name: 'tanggalJatuhTempo',
            label: 'Target Jatuh Tempo',
            type: 'date',
            required: true,
          },
          {
            name: 'namaProyek',
            label: 'Nama Proyek',
            type: 'text',
            required: true,
            colSpan: 'full',
            placeholder: 'Contoh: Kitchen Set HPL & Pantry Area',
          },
          {
            name: 'namaKlien',
            label: 'Nama Klien',
            type: 'text',
            required: true,
          },
          {
            name: 'lokasi',
            label: 'Lokasi Pemasangan',
            type: 'text',
            placeholder: 'Purwakarta / Karawang / Bandung',
          },
          {
            name: 'nilaiTotalKontrak',
            label: 'Nilai Kontrak (IDR)',
            type: 'currency',
            required: true,
            zeroAsEmpty: true,
          },
        ],
      },
      {
        id: 'skema-termin-dokumen',
        mobileTabLabel: 'Referensi',
        title: 'Skema & Referensi',
        columns: 2,
        headerAction: ({ readOnly, setFieldValue }) =>
          !readOnly ? (
            <AdminActionButton
              icon={<RefreshCw className="size-3.5" />}
              label="Terapkan Skema Resmi"
              onClick={() =>
                setFieldValue('skemaPembayaran', clonePaymentSchemeStages(paymentScheme))
              }
            />
          ) : null,
        fields: [
          {
            name: 'nomorSpkReferensi',
            label: 'Referensi SPK (Opsional)',
            type: 'select',
            options: [
              { value: '', label: '— Tidak ditautkan —' },
              ...agreements.map((spks) => ({
                value: spks.nomorKontrak,
                label: `${spks.nomorKontrak} · ${spks.judulProyek}`,
              })),
            ],
          },
          {
            name: 'nomorBastReferensi',
            label: 'Referensi BAST Serah Terima (Opsional)',
            type: 'select',
            options: [
              { value: '', label: '— Tidak ditautkan —' },
              ...handoverCertificates.map((bast) => ({
                value: bast.nomorBast,
                label: `${bast.nomorBast} · ${bast.namaProyek}`,
              })),
            ],
          },
        ],
        renderContent: () => (
          <div className="border border-[var(--border)] rounded-[var(--radius-md)] divide-y divide-[var(--border)] bg-[var(--bg)]">
            {schedule.stages.map((stage) => (
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
                <div className="sm:text-right shrink-0 tabular-nums">
                  <p className="font-semibold text-[var(--text)]">
                    {formatRupiahSigned(stage.targetAmount)}
                  </p>
                  <p
                    className={
                      stage.status === 'Lunas'
                        ? 'text-[11px] font-medium text-[var(--success)]'
                        : 'text-[11px] text-[var(--text-muted)]'
                    }
                  >
                    {stage.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: 'rincian-item',
        mobileTabLabel: 'Item',
        title: `Rincian Item (${lineItems.length})`,
        headerAction: ({ readOnly, setFieldValue, values: current }) =>
          !readOnly ? (
            <AdminActionButton
              icon={<Plus className="size-3.5" />}
              label="Tambah Item"
              mobileLabel="Item"
              onClick={() =>
                setFieldValue('rincianItem', [
                  ...(current.rincianItem ?? []),
                  createEmptyInvoiceLineItem(),
                ])
              }
            />
          ) : null,
        renderContent: ({ values: current, setFieldValue, readOnly }) => {
          const items = current.rincianItem ?? [];
          if (items.length === 0) {
            return (
              <p className="text-xs text-[var(--text-muted)]">
                Belum ada rincian item tambahan. Klik &ldquo;Tambah Item&rdquo; jika ingin
                mencantumkan uraian harga satuan di PDF Invoice.
              </p>
            );
          }

          return (
            <div className="space-y-2.5">
              {items.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 sm:col-span-6">
                    <Input
                      aria-label={`Deskripsi item ${idx + 1}`}
                      disabled={readOnly}
                      placeholder="Deskripsi pekerjaan/unit"
                      value={item.deskripsi}
                      onChange={(e) =>
                        setFieldValue(
                          'rincianItem',
                          items.map((row) =>
                            row.id === item.id ? { ...row, deskripsi: e.target.value } : row
                          )
                        )
                      }
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      aria-label={`Jumlah item ${idx + 1}`}
                      type="number"
                      min={1}
                      disabled={readOnly}
                      value={item.jumlah}
                      onChange={(e) =>
                        setFieldValue(
                          'rincianItem',
                          items.map((row) =>
                            row.id === item.id
                              ? { ...row, jumlah: Number(e.target.value) || 1 }
                              : row
                          )
                        )
                      }
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <CurrencyInput
                      aria-label={`Harga satuan item ${idx + 1}`}
                      disabled={readOnly}
                      zeroAsEmpty
                      placeholder="0"
                      value={item.hargaSatuan}
                      onValueChange={(nextPrice) =>
                        setFieldValue(
                          'rincianItem',
                          items.map((row) =>
                            row.id === item.id ? { ...row, hargaSatuan: nextPrice } : row
                          )
                        )
                      }
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    {!readOnly && (
                      <AdminActionButton
                        variant="danger"
                        icon={<Trash2 className="size-3.5" />}
                        label={`Hapus item ${idx + 1}`}
                        iconOnly
                        onClick={() =>
                          setFieldValue(
                            'rincianItem',
                            items.filter((r) => r.id !== item.id)
                          )
                        }
                      />
                    )}
                  </div>
                </div>
              ))}
              {lineItemsTotal > 0 && !readOnly && (
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[var(--text-muted)] tabular-nums">
                    Total dari rincian item:{' '}
                    <strong className="text-[var(--text)]">
                      {formatRupiahSigned(lineItemsTotal)}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFieldValue('nilaiTotalKontrak', lineItemsTotal)}
                    className="text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    Gunakan sebagai Nilai Kontrak
                  </button>
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: 'catatan-rekening',
        mobileTabLabel: 'Rekening',
        title: 'Rekening & Catatan',
        columns: 1,
        fields: [
          {
            name: 'catatanRekening',
            label: 'Catatan Rekening Bank Transfer (Opsional)',
            type: 'text',
            placeholder: 'Contoh: BCA 1234567890 a.n. Hilman Aziz Napis',
          },
          {
            name: 'catatan',
            label: 'Catatan Kontrak',
            type: 'textarea',
            rows: 3,
          },
        ],
      },
    ],
    [lineItems.length, lineItemsTotal, paymentScheme, workOrders, handoverCertificates, schedule]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validateInvoiceDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload: ProjectInvoice = {
      ...normalizeInvoicePayload(values),
      projectId: values.projectId ?? resolvedProjectId,
    };
    upsertProjectInvoice(payload);
    recordActivity(
      isEditMode ? 'Memperbarui invoice proyek' : 'Membuat invoice proyek baru',
      'Dokumen Invoice',
      payload.nomorInvoice
    );

    navigate(backPath, {
      state: {
        feedback: {
          type: 'ok',
          text: `Invoice proyek ${payload.nomorInvoice} (${payload.namaProyek}) disimpan.`,
        },
      },
    });
  };

  const progress = computeInvoiceProgress(values);

  return (
    <AdminForm
      title={isEditMode ? 'Edit Invoice' : 'Buat Invoice'}
      description={
        project
          ? `Proyek: ${[project.id, project.namaProyek].filter(Boolean).join(' · ')}`
          : undefined
      }
      backTo={backPath}
      backLabel={project ? 'Kembali ke Proyek' : 'Kembali ke Daftar Proyek'}
      submitLabel={isEditMode ? 'Simpan Perubahan Tagihan' : 'Simpan Tagihan'}
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      extraHeaderActions={
        isEditMode && existingInvoice ? (
          <AdminActionButton
            icon={<Printer className="size-3.5" />}
            label="Cetak PDF Invoice"
            onClick={() =>
              downloadProjectInvoicePdf(
                normalizeInvoicePayload(values),
                businessConfig,
                paymentScheme,
                project
              )
            }
          />
        ) : undefined
      }
      notFoundState={
        isEditMode && !existingInvoice
          ? {
              title: 'Invoice Proyek Tidak Ditemukan',
              message: 'Data tagihan proyek yang dicari tidak tersedia atau telah dihapus.',
            }
          : undefined
      }
      asideTabLabel="Ringkasan"
      aside={
        <AdminFormSectionCard title="Ringkasan Tagihan">
          <dl className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Nomor Invoice</dt>
              <dd className="font-mono font-semibold text-[var(--text)]">
                {values.nomorInvoice || '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Nilai Kontrak</dt>
              <dd className="font-semibold text-[var(--text)] tabular-nums">
                {formatRupiahSigned(values.nilaiTotalKontrak || 0)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Sudah Terbayar</dt>
              <dd className="font-medium text-[var(--success)] tabular-nums">
                {formatRupiahSigned(progress.paidAmount)} ({progress.progressPercent}%)
              </dd>
            </div>
            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Sisa Tagihan</dt>
              <dd className="font-semibold text-[var(--danger)] tabular-nums">
                {formatRupiahSigned(progress.remainingAmount)}
              </dd>
            </div>
          </dl>

          <div className="pt-3 border-t border-[var(--border)] space-y-2 text-xs">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Jadwal Termin Resmi
            </p>
            <ul className="space-y-1.5">
              {schedule.stages.map((st) => (
                <li key={st.id} className="flex items-center justify-between gap-2 tabular-nums">
                  <span className="text-[var(--text-muted)] truncate">
                    {st.nama} {st.persentase}%
                  </span>
                  <span
                    className={
                      st.status === 'Lunas'
                        ? 'font-medium text-[var(--success)] shrink-0'
                        : 'font-medium text-[var(--text)] shrink-0'
                    }
                  >
                    {formatRupiahSigned(st.targetAmount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </AdminFormSectionCard>
      }
    />
  );
}
