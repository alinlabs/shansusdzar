import { useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AdminForm,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { FormField, Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  EXPENSE_CATEGORIES,
  FINANCE_PAYMENT_METHODS,
  FINANCE_TRANSACTION_STATUSES,
  INCOME_CATEGORIES,
  formatRupiahSigned,
} from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  evaluateInvoicePaymentSchedule,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import { buildProjectTransactionDraft } from '../../../../lib/project-workspace';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useFinanceStore } from '../../../../store/finance-store';
import { useProjectsStore } from '../../../../store/projects-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type {
  FinanceTransaction,
  FinanceTransactionCategory,
  FinanceTransactionType,
} from '../../../../types/finance';
import {
  createEmptyTransaction,
  normalizeTransactionPayload,
  resolveCategoryForType,
  validateTransactionDraft,
} from './logic';

function resolveCategoryForPaymentStage(
  stageName: string,
  stageIndex: number,
  totalStages: number
): FinanceTransactionCategory {
  const lower = stageName.toLowerCase();
  if (
    stageIndex === 0 ||
    lower.includes('down payment') ||
    lower.includes('termin 1') ||
    lower.includes('uang muka') ||
    lower.includes('dp')
  ) {
    return 'DP Proyek';
  }
  if (
    stageIndex === totalStages - 1 ||
    lower.includes('serah terima') ||
    lower.includes('termin 4') ||
    lower.includes('bast') ||
    lower.includes('pelunasan') ||
    lower.includes('akhir')
  ) {
    return 'Pelunasan Proyek';
  }
  return 'Termin Proyek';
}

export default function AdminBukuKasFormPage() {
  const { id, projectId } = useParams<{ id?: string; projectId?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const transactions = useFinanceStore((state) => state.transactions);
  const invoices = useFinanceStore((state) => state.invoices);
  const upsertTransaction = useFinanceStore((state) => state.upsertTransaction);
  const projects = useProjectsStore((state) => state.projects);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const isProjectScopedRoute = Boolean(projectId) || location.pathname.startsWith('/admin/proyek/');
  const canEdit = canEditPage(currentUser, isProjectScopedRoute ? 'proyek' : 'keuangan');

  const existingTx = useMemo(
    () => (id ? transactions.find((t) => t.id === id) ?? null : null),
    [id, transactions]
  );
  const isEditMode = Boolean(id);

  const resolvedProjectId = projectId ?? existingTx?.projectId;
  const project = useMemo(
    () => (resolvedProjectId ? projects.find((p) => p.id === resolvedProjectId) ?? null : null),
    [resolvedProjectId, projects]
  );
  const backPath = resolvedProjectId
    ? `/admin/proyek/${resolvedProjectId}?tab=keuangan`
    : '/admin/keuangan';

  const queryJenisParam = searchParams.get('jenis');
  const requestedJenis: FinanceTransactionType | null =
    queryJenisParam === 'pemasukan'
      ? 'pemasukan'
      : queryJenisParam === 'pengeluaran' || location.pathname.includes('/pembelian/')
        ? 'pengeluaran'
        : null;

  const [values, setValues] = useState<FinanceTransaction>(() => {
    if (existingTx) return structuredClone(existingTx);
    if (project) {
      const projectInvoices = invoices.filter((inv) => inv.projectId === project.id);
      return buildProjectTransactionDraft(project, requestedJenis ?? 'pemasukan', {
        invoices: projectInvoices,
      });
    }
    const base = createEmptyTransaction();
    if (requestedJenis) {
      return {
        ...base,
        jenis: requestedJenis,
        kategori: resolveCategoryForType(requestedJenis, base.kategori),
      };
    }
    return base;
  });
  const availableInvoices = useMemo(
    () => (project ? invoices.filter((inv) => inv.projectId === project.id) : invoices),
    [invoices, project]
  );
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(() =>
    project ? invoices.find((inv) => inv.projectId === project.id)?.id ?? '' : ''
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const pageTitle = isEditMode
    ? values.jenis === 'pengeluaran'
      ? 'Edit Pembelian / Pengeluaran'
      : 'Edit Transaksi Masuk'
    : 'Buat Transaksi';

  useDocumentTitle(`${pageTitle} | Buku Kas Admin ${shortBrandName}`);

  const selectedInvoice = useMemo(
    () => availableInvoices.find((inv) => inv.id === selectedInvoiceId) ?? null,
    [availableInvoices, selectedInvoiceId]
  );

  const selectedInvoiceSchedule = useMemo(() => {
    if (!selectedInvoice) return null;
    const effective = resolveEffectivePaymentScheme(
      selectedInvoice.skemaPembayaran,
      paymentScheme
    );
    return evaluateInvoicePaymentSchedule(
      selectedInvoice.nilaiTotalKontrak,
      selectedInvoice.riwayatPembayaran,
      effective
    );
  }, [selectedInvoice, paymentScheme]);

  const sections = useMemo<AdminFormSectionConfig<FinanceTransaction>[]>(
    () => [
      {
        id: 'acuan-skema-pemasukan',
        title: 'Acuan Termin',
        mobileTabLabel: 'Termin',
        visibleWhen: (vals) => !isEditMode && vals.jenis === 'pemasukan' && availableInvoices.length > 0,
        renderContent: (ctx) => (
          <div className="space-y-3">
            <FormField id="buku-kas-invoice-ref" label="Pilih Invoice Proyek">
              <Select
                id="buku-kas-invoice-ref"
                value={selectedInvoiceId}
                onChange={(e) => setSelectedInvoiceId(e.target.value)}
              >
                <option value="">-- Pilih invoice untuk isi otomatis tahap --</option>
                {availableInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.nomorInvoice} — {inv.namaProyek} ({inv.namaKlien})
                  </option>
                ))}
              </Select>
            </FormField>

            {selectedInvoice && selectedInvoiceSchedule && (
              <div className="space-y-2">
                <p className="text-xs font-light tracking-[0.01em] text-[var(--text-muted)]">
                  Klik tahap termin untuk mengisi nominal dan kategori pemasukan
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {selectedInvoiceSchedule.stages.map((stage, idx) => {
                    const suggestedNominal =
                      stage.remainingAmount > 0 ? stage.remainingAmount : stage.targetAmount;
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() =>
                          ctx.setValues((prev) => ({
                            ...prev,
                            projectId: prev.projectId ?? selectedInvoice.projectId,
                            kategori: resolveCategoryForPaymentStage(
                              stage.nama,
                              idx,
                              selectedInvoiceSchedule.stages.length
                            ),
                            judul: `${stage.nama} ${stage.persentase}% — ${selectedInvoice.namaProyek}`,
                            pihakTerkait: selectedInvoice.namaKlien,
                            referensiProyek: selectedInvoice.nomorInvoice,
                            nominal: suggestedNominal,
                            catatan: stage.keterangan,
                          }))
                        }
                        className="text-left p-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface-muted)] transition-colors space-y-0.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-[var(--text)] truncate">
                            {stage.nama}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                            {stage.persentase}%
                          </span>
                        </div>
                        <p className="font-semibold text-[var(--text)] tabular-nums">
                          {formatRupiahSigned(suggestedNominal)}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {stage.status}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'klasifikasi',
        title: 'Klasifikasi',
        mobileTabLabel: 'Klasifikasi',
        columns: 3,
        fields: [
          {
            name: 'jenis',
            label: 'Jenis Arus Kas',
            type: 'select',
            required: true,
            options: [
              { value: 'pemasukan', label: 'Pemasukan (+)' },
              { value: 'pengeluaran', label: 'Pengeluaran (-)' },
            ],
            onValueChange: (nextVal, prev) => {
              const nextJenis = nextVal as FinanceTransactionType;
              let nextPihak = prev.pihakTerkait;
              if (project) {
                if (nextJenis === 'pengeluaran' && prev.pihakTerkait.trim() === project.namaKlien.trim()) {
                  nextPihak = '';
                } else if (nextJenis === 'pemasukan' && !prev.pihakTerkait.trim()) {
                  nextPihak = project.namaKlien;
                }
              }
              return {
                kategori: resolveCategoryForType(nextJenis, prev.kategori),
                pihakTerkait: nextPihak,
              };
            },
          },
          {
            name: 'kategori',
            label: 'Kategori',
            type: 'select',
            required: true,
            options: (vals) =>
              (vals.jenis === 'pengeluaran' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((cat) => ({
                value: cat,
                label: cat,
              })),
          },
          {
            name: 'tanggal',
            label: 'Tanggal Transaksi',
            type: 'date',
            required: true,
          },
          {
            name: 'judul',
            label: 'Judul / Uraian Transaksi',
            type: 'text',
            required: true,
            colSpan: 'full',
            placeholder: 'Contoh: Pembelian Multipleks 18mm atau Termin 1 : Down Payment 30% Kitchen Set',
          },
          {
            name: 'pihakTerkait',
            label: 'Pihak Terkait (Klien / Supplier)',
            type: 'text',
            required: true,
            colSpan: 2,
            placeholder: 'Contoh: Bapak Hendra atau TB Sumber Jaya',
          },
          {
            name: 'referensiProyek',
            label: 'Referensi Proyek / Invoice',
            type: 'text',
            placeholder: 'Contoh: INV/SDI-K/003/IX/2026',
          },
        ],
      },
      {
        id: 'nominal-status',
        title: 'Nominal & Status',
        mobileTabLabel: 'Nominal',
        columns: 3,
        fields: [
          {
            name: 'nominal',
            label: 'Nominal (IDR)',
            type: 'currency',
            required: true,
            zeroAsEmpty: true,
          },
          {
            name: 'metodePembayaran',
            label: 'Metode Pembayaran',
            type: 'select',
            required: true,
            options: FINANCE_PAYMENT_METHODS.map((m) => ({ value: m, label: m })),
          },
          {
            name: 'status',
            label: 'Status Transaksi',
            type: 'select',
            required: true,
            options: FINANCE_TRANSACTION_STATUSES.map((s) => ({ value: s, label: s })),
          },
          {
            name: 'catatan',
            label: 'Catatan Internal',
            type: 'textarea',
            rows: 3,
            colSpan: 'full',
            placeholder: 'Rincian ukuran bahan, nomor resi, atau keterangan termin...',
          },
        ],
      },
    ],
    [isEditMode, availableInvoices, selectedInvoiceId, selectedInvoice, selectedInvoiceSchedule, paymentScheme, project]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validateTransactionDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const matchedInvoice = invoices.find((inv) => inv.nomorInvoice === values.referensiProyek);
    const payload: FinanceTransaction = {
      ...normalizeTransactionPayload(values),
      projectId: values.projectId ?? resolvedProjectId ?? matchedInvoice?.projectId,
    };
    upsertTransaction(payload);
    recordActivity(
      isEditMode ? 'Memperbarui catatan keuangan' : 'Mencatat transaksi keuangan baru',
      'Buku Kas',
      payload.judul
    );

    navigate(backPath, {
      state: {
        feedback: {
          type: 'ok',
          text: isEditMode
            ? `Perubahan "${payload.judul}" berhasil disimpan.`
            : `Catatan baru "${payload.judul}" telah disimpan.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={pageTitle}
      description={
        project
          ? `Proyek: ${[project.id, project.namaProyek].filter(Boolean).join(' · ')}`
          : undefined
      }
      backTo={backPath}
      backLabel={project ? 'Kembali ke Proyek' : 'Kembali ke Keuangan'}
      submitLabel={isEditMode ? 'Simpan Perubahan' : 'Simpan Transaksi'}
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      notFoundState={
        isEditMode && !existingTx
          ? {
              title: 'Transaksi Tidak Ditemukan',
              message: 'Catatan kas yang diminta tidak ditemukan atau sudah dihapus.',
            }
          : undefined
      }
    />
  );
}
