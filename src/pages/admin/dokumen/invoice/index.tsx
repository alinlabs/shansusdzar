import { useMemo, useState } from 'react';
import { Banknote, FileDown, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  computeFinanceSummary,
  computeInvoiceProgress,
  formatRupiahSigned,
  formatShortDateId,
} from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  evaluateInvoicePaymentSchedule,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import { downloadProjectInvoicePdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useFinanceStore } from '../../../../store/finance-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { ProjectInvoice } from '../../../../types/finance';
import { AdminPageHeader } from '../../admin-shell';
import { filterInvoices } from './logic';

export default function AdminInvoicePage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const transactions = useFinanceStore((state) => state.transactions);
  const invoices = useFinanceStore((state) => state.invoices);
  const deleteProjectInvoice = useFinanceStore((state) => state.deleteProjectInvoice);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Invoice & Termin Proyek | Dokumen Admin ${businessConfig.namaMerekSingkat}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'keuangan.edit');
  const canDelete = hasPermission(currentRole, 'keuangan.delete');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [searchQuery, setSearchQuery] = useState('');

  const summary = useMemo(
    () => computeFinanceSummary(transactions, invoices),
    [transactions, invoices]
  );

  const filteredInvoices = useMemo(
    () => filterInvoices(invoices, searchQuery),
    [invoices, searchQuery]
  );

  const handleDelete = (invoice: ProjectInvoice) => {
    if (!canDelete) return;
    deleteProjectInvoice(invoice.id);
    recordActivity('Menghapus invoice proyek', 'Dokumen Invoice', invoice.nomorInvoice);
    setFeedback({
      type: 'ok',
      text: `Invoice ${invoice.nomorInvoice} telah dihapus.`,
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Invoice & Termin Proyek"
        description="Kelola tagihan proyek kustom, pantau progres pembayaran DP hingga pelunasan akhir, dan unduh PDF invoice."
        actions={
          canEdit ? (
            <Link
              to="/admin/dokumen/invoice/baru"
              className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
            >
              <Plus className="size-4" aria-hidden="true" />
              Buat Tagihan Proyek
            </Link>
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Invoice Summary Strip */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Total Dokumen Invoice</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {invoices.length} Proyek
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Terdaftar di buku tagihan</dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Invoice Belum Lunas</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {summary.activeInvoicesCount} Termin Aktif
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Menunggu DP / pelunasan</dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Sisa Tagihan Invoice</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--danger)] tabular-nums">
            {formatRupiahSigned(summary.pendingReceivables)}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">
            Terhubung otomatis ke modul Keuangan
          </dd>
        </div>
      </dl>

      {/* Search */}
      <div className="relative max-w-md">
        <Search
          className="size-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <Input
          aria-label="Cari invoice proyek"
          placeholder="Cari nomor invoice, nama proyek, atau klien..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="p-8 text-center border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-2">
          <p className="text-sm font-medium text-[var(--text)]">
            Belum ada tagihan proyek yang sesuai pencarian.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredInvoices.map((invoice) => {
            const progress = computeInvoiceProgress(invoice);
            const schedule = evaluateInvoicePaymentSchedule(
              invoice.nilaiTotalKontrak,
              invoice.riwayatPembayaran,
              resolveEffectivePaymentScheme(invoice.skemaPembayaran, paymentScheme)
            );
            return (
              <article
                key={invoice.id}
                className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                        {invoice.nomorInvoice} · Jatuh tempo {formatShortDateId(invoice.tanggalJatuhTempo)}
                      </p>
                      <h2 className="text-base font-semibold text-[var(--text)] leading-snug">
                        {invoice.namaProyek}
                      </h2>
                      <p className="text-xs text-[var(--text-muted)]">
                        {invoice.namaKlien}
                        {invoice.lokasi ? ` · ${invoice.lokasi}` : ''}
                      </p>
                    </div>

                    <span
                      className={[
                        'text-xs font-semibold shrink-0',
                        progress.computedStatus === 'Lunas'
                          ? 'text-[var(--success)]'
                          : progress.computedStatus === 'Berjalan'
                            ? 'text-[var(--text)]'
                            : 'text-[var(--danger)]',
                      ].join(' ')}
                    >
                      {progress.computedStatus}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs tabular-nums">
                      <span className="text-[var(--text-muted)]">
                        Terbayar {progress.progressPercent}% ({formatRupiahSigned(progress.paidAmount)})
                      </span>
                      <span className="font-semibold text-[var(--text)]">
                        Kontrak {formatRupiahSigned(invoice.nilaiTotalKontrak)}
                      </span>
                    </div>
                    <div className="h-2 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] transition-all duration-300"
                        style={{ width: `${progress.progressPercent}%` }}
                      />
                    </div>
                    {progress.remainingAmount > 0 && (
                      <p className="text-xs text-[var(--danger)] font-medium tabular-nums">
                        Sisa tagihan: {formatRupiahSigned(progress.remainingAmount)}
                        {schedule.nextStage
                          ? ` · Berikutnya: ${schedule.nextStage.nama} ${schedule.nextStage.persentase}%`
                          : ''}
                      </p>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1.5">
                      {schedule.stages.map((st) => (
                        <div
                          key={st.id}
                          className="p-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-[11px] tabular-nums"
                        >
                          <p className="font-medium text-[var(--text)] truncate">
                            {st.nama}
                          </p>
                          <p className="text-[var(--text-muted)]">
                            {st.persentase}% · {formatRupiahSigned(st.targetAmount)}
                          </p>
                          <p
                            className={
                              st.status === 'Lunas'
                                ? 'font-semibold text-[var(--success)]'
                                : st.status === 'Sebagian'
                                  ? 'font-semibold text-[var(--text)]'
                                  : 'text-[var(--text-subtle)]'
                            }
                          >
                            {st.status}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment history */}
                  {invoice.riwayatPembayaran.length > 0 && (
                    <div className="border-t border-[var(--border)] pt-3 space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Riwayat Pembayaran ({invoice.riwayatPembayaran.length})
                      </p>
                      <ul className="space-y-1">
                        {invoice.riwayatPembayaran.map((pay) => (
                          <li
                            key={pay.id}
                            className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]"
                          >
                            <span className="truncate">
                              {formatShortDateId(pay.tanggal)} · {pay.label} ({pay.metodePembayaran})
                            </span>
                            <span className="font-medium text-[var(--text)] tabular-nums shrink-0">
                              {formatRupiahSigned(pay.nominal)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {invoice.catatan && (
                    <p className="text-xs text-[var(--text-subtle)] leading-relaxed">
                      {invoice.catatan}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => downloadProjectInvoicePdf(invoice, businessConfig, paymentScheme)}
                    >
                      <FileDown className="size-3.5" aria-hidden="true" />
                      Unduh PDF Invoice
                    </Button>
                    {canEdit && progress.remainingAmount > 0 && (
                      <Link
                        to={`/admin/dokumen/invoice/${invoice.id}/pembayaran`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
                      >
                        <Banknote className="size-3.5" aria-hidden="true" />
                        Catat Pembayaran
                      </Link>
                    )}
                  </div>

                  {(canEdit || canDelete) && (
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <Link
                          to={`/admin/dokumen/invoice/${invoice.id}/edit`}
                          aria-label={`Ubah tagihan ${invoice.namaProyek}`}
                          className="p-2 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] inline-flex items-center"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </Link>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          aria-label={`Hapus tagihan ${invoice.namaProyek}`}
                          onClick={() => handleDelete(invoice)}
                          className="p-2 rounded-[var(--radius-md)] text-[var(--danger)] hover:bg-[var(--danger-surface)] cursor-pointer"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
