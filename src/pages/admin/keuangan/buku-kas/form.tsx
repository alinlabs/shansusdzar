import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
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
  formatShortDateId,
} from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  evaluateInvoicePaymentSchedule,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useFinanceStore } from '../../../../store/finance-store';
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

const BACK_PATH = '/admin/keuangan/buku-kas';

export default function AdminBukuKasFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const transactions = useFinanceStore((state) => state.transactions);
  const invoices = useFinanceStore((state) => state.invoices);
  const upsertTransaction = useFinanceStore((state) => state.upsertTransaction);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'keuangan.edit');

  const existingTx = useMemo(
    () => (id ? transactions.find((t) => t.id === id) ?? null : null),
    [id, transactions]
  );
  const isEditMode = Boolean(id);

  const [values, setValues] = useState<FinanceTransaction>(() =>
    existingTx ? structuredClone(existingTx) : createEmptyTransaction()
  );
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode ? 'Ubah Catatan Transaksi' : 'Catat Transaksi Keuangan Baru'} | Buku Kas Admin ${shortBrandName}`
  );

  const selectedInvoice = useMemo(
    () => invoices.find((inv) => inv.id === selectedInvoiceId) ?? null,
    [invoices, selectedInvoiceId]
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
        title: 'Acuan Invoice & Tahap Pembayaran Resmi',
        description:
          'Opsional: pilih invoice proyek untuk mengisi otomatis uraian, kategori, dan nominal sesuai tahapan skema pembayaran.',
        visibleWhen: (vals) => !isEditMode && vals.jenis === 'pemasukan' && invoices.length > 0,
        renderContent: (ctx) => (
          <div className="space-y-3">
            <FormField id="buku-kas-invoice-ref" label="Pilih Invoice Proyek">
              <Select
                id="buku-kas-invoice-ref"
                value={selectedInvoiceId}
                onChange={(e) => setSelectedInvoiceId(e.target.value)}
              >
                <option value="">-- Pilih invoice untuk isi otomatis tahap --</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.nomorInvoice} — {inv.namaProyek} ({inv.namaKlien})
                  </option>
                ))}
              </Select>
            </FormField>

            {selectedInvoice && selectedInvoiceSchedule ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--text-muted)]">
                  Klik tahap termin untuk mengisi nominal dan kategori pemasukan:
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
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                Skema aktif:{' '}
                {paymentScheme.tahapan
                  .map((s) => `${s.nama} ${s.persentase}%`)
                  .join(' · ')}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'klasifikasi',
        title: 'Klasifikasi & Identitas Transaksi',
        description:
          'Catat pemasukan proyek atau pengeluaran material, hardware, dan operasional workshop.',
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
            onValueChange: (nextVal, prev) => ({
              kategori: resolveCategoryForType(nextVal as FinanceTransactionType, prev.kategori),
            }),
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
            placeholder: 'Contoh: INV-SDI-2026-043',
          },
        ],
      },
      {
        id: 'nominal-status',
        title: 'Nominal, Metode & Catatan',
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
    [isEditMode, invoices, selectedInvoiceId, selectedInvoice, selectedInvoiceSchedule, paymentScheme]
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

    const payload = normalizeTransactionPayload(values);
    upsertTransaction(payload);
    recordActivity(
      isEditMode ? 'Memperbarui catatan keuangan' : 'Mencatat transaksi keuangan baru',
      'Buku Kas',
      payload.judul
    );

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: isEditMode
            ? `Perubahan "${payload.judul}" berhasil disimpan.`
            : `Catatan baru "${payload.judul}" telah disimpan ke buku kas.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={isEditMode ? 'Ubah Catatan Transaksi' : 'Catat Transaksi Keuangan Baru'}
      description="Formulir penuh pencatatan transaksi kas masuk dan kas keluar studio."
      backTo={BACK_PATH}
      backLabel="Kembali ke Buku Kas"
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
      aside={
        <AdminFormSectionCard title="Ringkasan Arus Kas">
          <dl className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Jenis</dt>
              <dd
                className={
                  values.jenis === 'pemasukan'
                    ? 'font-semibold text-[var(--success)]'
                    : 'font-semibold text-[var(--danger)]'
                }
              >
                {values.jenis === 'pemasukan' ? 'Pemasukan (+)' : 'Pengeluaran (-)'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Tanggal</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {values.tanggal ? formatShortDateId(values.tanggal) : '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Kategori</dt>
              <dd className="font-medium text-[var(--text)]">{values.kategori}</dd>
            </div>
            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Nominal</dt>
              <dd
                className={[
                  'text-base font-semibold tabular-nums',
                  values.jenis === 'pemasukan' ? 'text-[var(--success)]' : 'text-[var(--danger)]',
                ].join(' ')}
              >
                {values.jenis === 'pemasukan' ? '+' : '-'}
                {formatRupiahSigned(values.nominal || 0)}
              </dd>
            </div>
          </dl>
        </AdminFormSectionCard>
      }
    />
  );
}
