import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  FINANCE_PAYMENT_METHODS,
  computeInvoiceProgress,
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
import {
  createDefaultPaymentForm,
  validatePaymentForm,
  type InvoicePaymentFormValues,
} from './logic';

const BACK_PATH = '/admin/dokumen/invoice';

export default function AdminInvoicePaymentFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const invoices = useFinanceStore((state) => state.invoices);
  const recordInvoicePayment = useFinanceStore((state) => state.recordInvoicePayment);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'keuangan.edit');

  const targetInvoice = useMemo(
    () => (id ? invoices.find((inv) => inv.id === id) ?? null : null),
    [id, invoices]
  );

  const [values, setValues] = useState<InvoicePaymentFormValues>(() =>
    targetInvoice
      ? createDefaultPaymentForm(targetInvoice, paymentScheme)
      : {
          date: new Date().toISOString().slice(0, 10),
          label: 'Termin Pembayaran',
          amount: 0,
          paymentMethod: 'Transfer Bank',
          notes: '',
          alsoRecordCashTransaction: true,
        }
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${targetInvoice ? `Catat Pembayaran ${targetInvoice.nomorInvoice}` : 'Invoice Tidak Ditemukan'} | Dokumen Admin ${shortBrandName}`
  );

  const schedule = useMemo(() => {
    if (!targetInvoice) return null;
    const effective = resolveEffectivePaymentScheme(
      targetInvoice.skemaPembayaran,
      paymentScheme
    );
    return evaluateInvoicePaymentSchedule(
      targetInvoice.nilaiTotalKontrak,
      targetInvoice.riwayatPembayaran,
      effective
    );
  }, [targetInvoice, paymentScheme]);

  const sections = useMemo<AdminFormSectionConfig<InvoicePaymentFormValues>[]>(
    () => [
      {
        id: 'detail-pembayaran',
        title: 'Detail Pembayaran',
        columns: 2,
        fields: [
          {
            name: 'label',
            label: 'Tahap Pembayaran',
            type: 'text',
            required: true,
            placeholder: 'Contoh: Termin 1 : Down Payment 30%',
          },
          {
            name: 'date',
            label: 'Tanggal Diterima',
            type: 'date',
            required: true,
          },
          {
            name: 'amount',
            label: 'Nominal Diterima (IDR)',
            type: 'currency',
            required: true,
            zeroAsEmpty: true,
          },
          {
            name: 'paymentMethod',
            label: 'Metode Pembayaran',
            type: 'select',
            required: true,
            options: FINANCE_PAYMENT_METHODS.map((method) => ({ value: method, label: method })),
          },
          {
            name: 'notes',
            label: 'Catatan Pembayaran',
            type: 'textarea',
            rows: 3,
            colSpan: 'full',
            placeholder: 'Nomor bukti transfer atau keterangan progres...',
          },
          {
            name: 'alsoRecordCashTransaction',
            label: 'Catat otomatis sebagai pemasukan di Buku Kas Transaksi',
            type: 'checkbox',
            colSpan: 'full',
            checkboxDescription:
              'Menambahkan entri pemasukan yang langsung terhubung dengan laporan arus kas.',
          },
        ],
        renderContent: ({ setValues: updateValues, readOnly }) => {
          if (!schedule || readOnly) return null;
          return (
            <div className="pt-2 space-y-2">
              <p className="text-xs font-semibold text-[var(--text)]">
                Pilih Cepat Tahapan Skema Pembayaran:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {schedule.stages.map((st) => {
                  const isPaid = st.remainingAmount === 0;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      disabled={isPaid}
                      onClick={() =>
                        updateValues((prev) => ({
                          ...prev,
                          label: `${st.nama} ${st.persentase}%`,
                          amount: st.remainingAmount,
                          notes: st.keterangan,
                        }))
                      }
                      className={[
                        'p-3 rounded-[var(--radius-md)] border text-left text-xs transition-colors',
                        isPaid
                          ? 'border-[var(--border)] bg-[var(--surface-muted)]/40 opacity-60 cursor-not-allowed'
                          : 'border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--surface-muted)] cursor-pointer',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[var(--text)] truncate">
                          {st.nama} {st.persentase}%
                        </span>
                        <span
                          className={
                            isPaid
                              ? 'text-[11px] font-semibold text-[var(--success)] shrink-0'
                              : 'text-[11px] font-semibold text-[var(--text)] tabular-nums shrink-0'
                          }
                        >
                          {isPaid ? 'Lunas' : formatRupiahSigned(st.remainingAmount)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)] line-clamp-1">
                        {st.keterangan}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        },
      },
    ],
    [schedule]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!targetInvoice || !canEdit) return;

    const validation = validatePaymentForm(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    recordInvoicePayment({
      invoiceId: targetInvoice.id,
      date: values.date,
      label: values.label,
      amount: values.amount,
      paymentMethod: values.paymentMethod,
      notes: values.notes,
      alsoRecordCashTransaction: values.alsoRecordCashTransaction,
    });
    recordActivity(
      'Mencatat pembayaran termin proyek',
      'Dokumen Invoice',
      `${targetInvoice.nomorInvoice} · ${values.label}`
    );

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: values.alsoRecordCashTransaction
            ? `Pembayaran "${values.label}" tercatat di invoice dan masuk otomatis ke modul Keuangan.`
            : `Pembayaran "${values.label}" berhasil ditambahkan ke invoice proyek.`,
        },
      },
    });
  };

  const progress = targetInvoice ? computeInvoiceProgress(targetInvoice) : null;

  return (
    <AdminForm
      title={
        targetInvoice ? `Bayar ${targetInvoice.nomorInvoice}` : 'Catat Pembayaran'
      }
      description={
        targetInvoice ? `${targetInvoice.namaProyek} · ${targetInvoice.namaKlien}` : undefined
      }
      backTo={BACK_PATH}
      backLabel="Kembali ke Invoice"
      submitLabel="Simpan Pembayaran"
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      notFoundState={
        !targetInvoice
          ? {
              title: 'Invoice Proyek Tidak Ditemukan',
              message: 'Data tagihan proyek yang dipilih tidak tersedia atau telah dihapus.',
            }
          : undefined
      }
      aside={
        targetInvoice && progress ? (
          <AdminFormSectionCard title="Progres Tagihan">
            <dl className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-muted)]">Nilai Kontrak</dt>
                <dd className="font-semibold text-[var(--text)] tabular-nums">
                  {formatRupiahSigned(targetInvoice.nilaiTotalKontrak)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-muted)]">Terbayar ({progress.progressPercent}%)</dt>
                <dd className="font-medium text-[var(--success)] tabular-nums">
                  {formatRupiahSigned(progress.paidAmount)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-muted)]">Sisa Tagihan</dt>
                <dd className="font-semibold text-[var(--danger)] tabular-nums">
                  {formatRupiahSigned(progress.remainingAmount)}
                </dd>
              </div>
            </dl>

            {schedule && (
              <div className="pt-3 border-t border-[var(--border)] space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Target Skema Pembayaran
                </p>
                <ul className="space-y-1.5 text-xs">
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
                        {st.status === 'Lunas'
                          ? 'Lunas'
                          : `Sisa ${formatRupiahSigned(st.remainingAmount)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {targetInvoice.riwayatPembayaran.length > 0 && (
              <div className="pt-3 border-t border-[var(--border)] space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Riwayat Sebelumnya ({targetInvoice.riwayatPembayaran.length})
                </p>
                <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
                  {targetInvoice.riwayatPembayaran.map((pay) => (
                    <li key={pay.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {formatShortDateId(pay.tanggal)} · {pay.label}
                      </span>
                      <span className="font-medium text-[var(--text)] tabular-nums shrink-0">
                        {formatRupiahSigned(pay.nominal)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AdminFormSectionCard>
        ) : undefined
      }
    />
  );
}
