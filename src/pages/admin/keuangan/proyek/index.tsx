import { useMemo, useState } from 'react';
import { ArrowRight, Download, ExternalLink, Plus, RotateCcw, Search } from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Button } from '../../../../components/ui/button';
import { Input, Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  buildFinanceCsv,
  computeCategoryBreakdown,
  formatRupiahSigned,
  formatShortDateId,
} from '../../../../lib/finance-utils';
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
  const workOrders = useDocumentsStore((state) => state.workOrders);
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
    () => buildProjectMarginRows(invoices, transactions, workOrders),
    [invoices, transactions, workOrders]
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
    <div className="space-y-6">
      <AdminPageHeader
        title="Daftar Project & Pemantauan Margin"
        description="Pantau pembayaran klien, progres produksi SPK, serta realisasi belanja material per proyek."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleExportCsv}>
              <Download className="size-3.5" aria-hidden="true" />
              Ekspor CSV Kas
            </Button>
            {canEdit && (
              <Button variant="secondary" size="sm" onClick={handleResetDefaults}>
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reset Data Awal
              </Button>
            )}
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Project Finance Overview Strip */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Total Portofolio Kontrak</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {formatRupiahSigned(dashboardMetrics.totalContractPortfolio)}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)] tabular-nums">
            {invoices.length} proyek terdaftar
          </dd>
        </div>

        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Pembayaran Klien Masuk</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--success)] tabular-nums">
            {formatRupiahSigned(dashboardMetrics.totalCollected)}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">DP &amp; termin terbayar</dd>
        </div>

        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Total Pembelian &amp; Biaya</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--danger)] tabular-nums">
            {formatRupiahSigned(dashboardMetrics.totalPurchases)}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Bahan, hardware &amp; upah</dd>
        </div>

        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Selisih Kas Proyek</dt>
          <dd
            className={[
              'mt-1 text-xl font-semibold tabular-nums',
              dashboardMetrics.netProjectBalance >= 0
                ? 'text-[var(--text)]'
                : 'text-[var(--danger)]',
            ].join(' ')}
          >
            {formatRupiahSigned(dashboardMetrics.netProjectBalance)}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">
            Pemasukan proyek dikurangi belanja
          </dd>
        </div>
      </dl>

      {/* Main Split: Daftar Project Cards + Sidebar Analytics/Pembelian */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--text)]">
                Daftar Project &amp; Realisasi Biaya
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Pantau pembayaran klien, progres produksi SPK, serta realisasi belanja per proyek.
              </p>
            </div>
            <Link
              to="/admin/dokumen/invoice"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text)] hover:underline whitespace-nowrap shrink-0"
            >
              Kelola Invoice di Dokumen
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
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
              className="w-auto"
            >
              <option value="all">Semua Status Project</option>
              <option value="Berjalan">Berjalan</option>
              <option value="Menunggu DP">Menunggu DP</option>
              <option value="Lunas">Lunas</option>
            </Select>
          </div>

          <div className="space-y-3.5">
            {filteredRows.map(
              ({ invoice, progress, purchaseTotal, purchaseCount, netMargin, linkedSpk }) => (
                <article
                  key={invoice.id}
                  className="p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                        {invoice.nomorInvoice}
                        {linkedSpk ? ` · ${linkedSpk.nomorSpk} (${linkedSpk.status})` : ''}
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
                      </span>
                      {canEdit && (
                        <Link
                          to={`/admin/keuangan/pembelian/baru?projectRef=${encodeURIComponent(invoice.nomorInvoice)}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                          Catat Pembelian
                        </Link>
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
          <section className="p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-4">
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
