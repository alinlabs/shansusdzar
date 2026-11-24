import { useMemo, useState } from 'react';
import { ArrowRight, Banknote, Download, ExternalLink, Plus, RotateCcw, Search } from 'lucide-react';
import { Link } from 'react-router';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Input, Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  buildFinanceCsv,
  computeCategoryBreakdown,
  formatRupiahSigned,
  formatShortDateId,
} from '../../../../lib/finance-utils';
import { formatPaymentSchemeSummary } from '../../../../lib/payment-scheme';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useFinanceStore } from '../../../../store/finance-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { ProjectInvoiceStatus } from '../../../../types/finance';
import { AdminPageHeader } from '../../admin-shell';
import { buildProjectMarginRows, computeProjectDashboardMetrics } from './logic';

export default function AdminProyekPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const paymentScheme = useSiteContentStore((state) => state.paymentScheme);
  const workOrders = useDocumentsStore((state) => state.workOrders);
  const handoverCertificates = useDocumentsStore((state) => state.handoverCertificates);
  const transactions = useFinanceStore((state) => state.transactions);
  const invoices = useFinanceStore((state) => state.invoices);
  const resetFinanceDefaults = useFinanceStore((state) => state.resetFinanceDefaults);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Daftar Project & Margin | Keuangan Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'keuangan.edit');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectInvoiceStatus>('all');

  const projectRows = useMemo(
    () =>
      buildProjectMarginRows(
        invoices,
        transactions,
        workOrders,
        handoverCertificates,
        paymentScheme
      ),
    [invoices, transactions, workOrders, handoverCertificates, paymentScheme]
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projectRows.filter(({ invoice, progress }) => {
      if (statusFilter !== 'all' && progress.computedStatus !== statusFilter) return false;
      if (q) {
        const hay = `${invoice.nomorInvoice} ${invoice.namaProyek} ${invoice.namaKlien} ${invoice.lokasi}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [projectRows, searchQuery, statusFilter]);

  const dashboardMetrics = useMemo(
    () => computeProjectDashboardMetrics(invoices, projectRows, transactions),
    [invoices, projectRows, transactions]
  );

  const expenseBreakdown = useMemo(
    () => computeCategoryBreakdown(transactions, 'pengeluaran'),
    [transactions]
  );

  const recentPurchases = useMemo(
    () => transactions.filter((tx) => tx.jenis === 'pengeluaran').slice(0, 4),
    [transactions]
  );

  const handleExportCsv = () => {
    const csv = buildFinanceCsv(transactions);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keuangan-shansusdzar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    recordActivity('Mengekspor laporan buku kas CSV', 'Keuangan', `${transactions.length} Transaksi`);
    setFeedback({
      type: 'ok',
      text: `Laporan CSV berisi ${transactions.length} transaksi kas berhasil diunduh.`,
    });
  };

  const handleResetDefaults = () => {
    if (!canEdit) return;
    resetFinanceDefaults();
    recordActivity('Mengembalikan data contoh keuangan', 'Keuangan', 'Reset Default');
    setFeedback({
      type: 'ok',
      text: 'Data keuangan dikembalikan ke dataset awal workshop.',
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Proyek"
        actions={
          <>
            <AdminActionButton
              icon={<Download className="size-3.5" />}
              label="Ekspor CSV Kas"
              onClick={handleExportCsv}
            />
            {canEdit && (
              <AdminActionButton
                icon={<RotateCcw className="size-3.5" />}
                label="Reset Data Awal"
                onClick={handleResetDefaults}
              />
            )}
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Project Finance Overview Strip */}
      <dl className="admin-stat-grid-1x2x4 admin-stat-grid-1x2x4-lg border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Nilai Kontrak ({invoices.length})
          </dt>
          <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
            {formatRupiahSigned(dashboardMetrics.totalContractPortfolio)}
          </dd>
        </div>

        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Pembayaran Masuk
          </dt>
          <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--success)] tabular-nums truncate">
            {formatRupiahSigned(dashboardMetrics.totalCollected)}
          </dd>
        </div>

        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Belanja &amp; Biaya
          </dt>
          <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--danger)] tabular-nums truncate">
            {formatRupiahSigned(dashboardMetrics.totalPurchases)}
          </dd>
        </div>

        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Selisih Kas Proyek
          </dt>
          <dd
            className={[
              'mt-0.5 text-sm sm:text-base font-semibold tabular-nums truncate',
              dashboardMetrics.netProjectBalance >= 0
                ? 'text-[var(--text)]'
                : 'text-[var(--danger)]',
            ].join(' ')}
          >
            {formatRupiahSigned(dashboardMetrics.netProjectBalance)}
          </dd>
        </div>
      </dl>

      <div className="px-4 py-3 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="space-y-0.5 min-w-0">
          <p className="font-semibold text-[var(--text)]">Acuan Skema Pembayaran Proyek</p>
          <p className="text-[var(--text-muted)]">
            {formatPaymentSchemeSummary(paymentScheme)}
          </p>
        </div>
        <Link
          to="/admin/produk/skema-pembayaran"
          className="inline-flex items-center gap-1.5 font-medium text-[var(--text)] hover:underline whitespace-nowrap shrink-0"
        >
          Atur Skema Pembayaran
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      {/* Main Split: Daftar Project Cards + Sidebar Analytics/Pembelian */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--text)]">
              Daftar Project
            </h2>
            <Link
              to="/admin/dokumen/invoice"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text)] hover:underline whitespace-nowrap shrink-0"
            >
              Kelola Invoice di Dokumen
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="relative flex-1 sm:max-w-xs">
              <Search
                className="size-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <Input
                aria-label="Cari proyek keuangan"
                placeholder="Cari proyek, klien, atau nomor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              aria-label="Filter status proyek"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | ProjectInvoiceStatus)}
              className="w-full sm:w-auto"
            >
              <option value="all">Semua Status Project</option>
              <option value="Berjalan">Berjalan</option>
              <option value="Menunggu DP">Menunggu DP</option>
              <option value="Lunas">Lunas</option>
            </Select>
          </div>

          <div className="space-y-3.5">
            {filteredRows.map(
              ({
                invoice,
                progress,
                purchaseTotal,
                purchaseCount,
                netMargin,
                linkedSpk,
                linkedBast,
                paymentSchedule,
              }) => (
                <article
                  key={invoice.id}
                  className="p-4 sm:p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                        {invoice.nomorInvoice}
                        {linkedSpk ? ` · ${linkedSpk.nomorSpk} (${linkedSpk.status})` : ''}
                        {linkedBast
                          ? ` · ${linkedBast.nomorBast} (${linkedBast.statusTerminAkhir ?? linkedBast.status})`
                          : ''}
                      </p>
                      <h3 className="text-base font-semibold text-[var(--text)] leading-snug">
                        {invoice.namaProyek}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)]">
                        {invoice.namaKlien}
                        {invoice.lokasi ? ` · ${invoice.lokasi}` : ''} · Jatuh tempo{' '}
                        {formatShortDateId(invoice.tanggalJatuhTempo)}
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

                  {/* 4 Financial Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs">
                    <div>
                      <p className="text-[var(--text-muted)]">Nilai Kontrak</p>
                      <p className="mt-0.5 font-semibold text-[var(--text)] tabular-nums">
                        {formatRupiahSigned(invoice.nilaiTotalKontrak)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--text-muted)]">Masuk ({progress.progressPercent}%)</p>
                      <p className="mt-0.5 font-semibold text-[var(--success)] tabular-nums">
                        {formatRupiahSigned(progress.paidAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--text-muted)]">Pembelian ({purchaseCount})</p>
                      <p className="mt-0.5 font-semibold text-[var(--danger)] tabular-nums">
                        {formatRupiahSigned(purchaseTotal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--text-muted)]">Margin Proyek</p>
                      <p
                        className={[
                          'mt-0.5 font-semibold tabular-nums',
                          netMargin >= 0 ? 'text-[var(--text)]' : 'text-[var(--danger)]',
                        ].join(' ')}
                      >
                        {formatRupiahSigned(netMargin)}
                      </p>
                    </div>
                  </div>

                  {/* Tahapan Skema Pembayaran */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    {paymentSchedule.stages.map((stage) => (
                      <div
                        key={stage.id}
                        className="px-2.5 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)]/70 space-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium text-[var(--text)] truncate">
                            {stage.nama}
                          </span>
                          <span className="text-[var(--text-muted)] tabular-nums shrink-0">
                            {stage.persentase}%
                          </span>
                        </div>
                        <p className="font-semibold text-[var(--text)] tabular-nums">
                          {formatRupiahSigned(stage.targetAmount)}
                        </p>
                        <p
                          className={[
                            'font-medium',
                            stage.status === 'Lunas'
                              ? 'text-[var(--success)]'
                              : stage.status === 'Sebagian'
                                ? 'text-[var(--text)]'
                                : 'text-[var(--text-muted)]',
                          ].join(' ')}
                        >
                          {stage.status}
                          {stage.status === 'Sebagian' ? ` (${stage.progressPercent}%)` : ''}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <div className="h-2 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] transition-all duration-300"
                        style={{ width: `${progress.progressPercent}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-[var(--text-muted)] tabular-nums">
                        Sisa tagihan klien: {formatRupiahSigned(progress.remainingAmount)}
                        {paymentSchedule.nextStage
                          ? ` · Berikutnya: ${paymentSchedule.nextStage.nama} (${formatRupiahSigned(paymentSchedule.nextStage.remainingAmount)})`
                          : ''}
                      </span>
                      {canEdit && (
                        <div className="flex items-center gap-1.5">
                          {progress.remainingAmount > 0 && (
                            <AdminActionLink
                              to={`/admin/dokumen/invoice/${invoice.id}/pembayaran`}
                              icon={<Banknote className="size-3.5" />}
                              label="Catat Pembayaran"
                              mobileLabel="Bayar"
                            />
                          )}
                          <AdminActionLink
                            to={`/admin/keuangan/pembelian/baru?projectRef=${encodeURIComponent(invoice.nomorInvoice)}`}
                            icon={<Plus className="size-3.5" />}
                            label="Catat Pembelian"
                            mobileLabel="Belanja"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            )}
          </div>
        </div>

        {/* Right Side Analytics & Recent Purchases */}
        <div className="xl:col-span-4 space-y-4">
          <section className="p-4 sm:p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--text)]">Komposisi Pembelian</h3>
              <Link
                to="/admin/keuangan/pembelian"
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:underline inline-flex items-center gap-1"
              >
                Kelola Pembelian
                <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </div>

            {expenseBreakdown.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">Belum ada data pembelian.</p>
            ) : (
              <div className="space-y-3">
                {expenseBreakdown.map((item) => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-[var(--text)] font-medium truncate">
                        {item.category}
                      </span>
                      <span className="text-[var(--text-muted)] tabular-nums shrink-0">
                        {formatRupiahSigned(item.amount)} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--danger)]/80"
                        style={{ width: `${Math.max(4, item.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--text)]">Pembelian Terbaru</h3>
              <Link
                to="/admin/keuangan/buku-kas"
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
              >
                Lihat Buku Kas
              </Link>
            </div>

            {recentPurchases.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">Belum ada catatan pembelian.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {recentPurchases.map((tx) => (
                  <li key={tx.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-medium text-[var(--text)] truncate">{tx.judul}</p>
                      <p className="text-[var(--text-muted)] truncate">
                        {tx.pihakTerkait} · {formatShortDateId(tx.tanggal)}
                      </p>
                    </div>
                    <span className="font-semibold text-[var(--danger)] tabular-nums shrink-0">
                      -{formatRupiahSigned(tx.nominal)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
