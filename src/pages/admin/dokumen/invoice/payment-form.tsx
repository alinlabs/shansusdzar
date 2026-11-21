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
      ? createDefaultPaymentForm(targetInvoice)
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

  const sections = useMemo<AdminFormSectionConfig<InvoicePaymentFormValues>[]>(
    () => [
      {
        id: 'detail-pembayaran',
        title: 'Detail Pembayaran DP / Termin Klien',
        description:
          'Pembayaran yang dicatat akan mengurangi sisa tagihan proyek secara otomatis.',
        columns: 2,
        fields: [
          {
            name: 'label',
            label: 'Tahap Pembayaran',
            type: 'text',
            required: true,
            placeholder: 'Contoh: DP 50% atau Pelunasan',
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
      },
    ],
    []
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
        targetInvoice
          ? `Catat Pembayaran ${targetInvoice.nomorInvoice}`
          : 'Catat Pembayaran Termin'
      }
      description={
        targetInvoice
          ? `${targetInvoice.namaProyek} — Klien: ${targetInvoice.namaKlien}`
          : undefined
      }
      backTo={BACK_PATH}
      backLabel="Kembali ke Daftar Invoice"
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
          <AdminFormSectionCard
            title="Progres Tagihan Proyek"
            description="Kondisi pembayaran sebelum entri ini ditambahkan."
          >
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
