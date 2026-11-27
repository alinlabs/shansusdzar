import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Clock, Download } from 'lucide-react';
import { Link } from 'react-router';
import { AdminActionButton } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  buildFinanceCsv,
  computeCategoryBreakdown,
  computeFinanceSummary,
  computeMonthlyCashflow,
  formatRupiahSigned,
  formatShortDateId,
} from '../../../../lib/finance-utils';
import { computeFinanceScheduleSummary } from '../../../../lib/payment-scheme';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useFinanceStore } from '../../../../store/finance-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminArusKasPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const paymentScheme = useSiteContentStore((state) => state.paymentScheme);
  const transactions = useFinanceStore((state) => state.transactions);
  const invoices = useFinanceStore((state) => state.invoices);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Arus Kas & Analisis | Keuangan Admin ${shortBrandName}`);

  const [feedback, setFeedback] = useAdminFeedbackState();

  const summary = useMemo(
    () => computeFinanceSummary(transactions, invoices),
    [transactions, invoices]
  );

  const stageScheduleSummary = useMemo(
    () => computeFinanceScheduleSummary(invoices, paymentScheme),
    [invoices, paymentScheme]
  );

  const monthlyBuckets = useMemo(() => computeMonthlyCashflow(transactions), [transactions]);
  const expenseCategories = useMemo(
    () => computeCategoryBreakdown(transactions, 'pengeluaran'),
    [transactions]
  );
  const incomeCategories = useMemo(
    () => computeCategoryBreakdown(transactions, 'pemasukan'),
    [transactions]
  );
  const pendingItems = useMemo(
    () => transactions.filter((tx) => tx.status === 'Tertunda'),
    [transactions]
  );

  const maxMonthlyVolume = monthlyBuckets.reduce(
    (max, item) => Math.max(max, item.income, item.expense),
    1
  );

  const handleExportCsv = () => {
    const csv = buildFinanceCsv(transactions);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arus-kas-shansusdzar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    recordActivity('Mengekspor laporan arus kas CSV', 'Arus Kas', `${transactions.length} Transaksi`);
    setFeedback({
      type: 'ok',
      text: `Laporan CSV berisi ${transactions.length} transaksi kas berhasil diunduh.`,
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Arus Kas"
        actions={
          <AdminActionButton
            icon={<Download className="size-3.5" />}
            label="Ekspor CSV Kas"
            onClick={handleExportCsv}
          />
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <dl className="admin-stat-grid-1x2x4 admin-stat-grid-1x2x4-lg border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Pemasukan Selesai
          </dt>
          <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--success)] tabular-nums truncate">
            {formatRupiahSigned(summary.totalIncome)}
          </dd>
        </div>
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Pengeluaran Selesai
          </dt>
          <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--danger)] tabular-nums truncate">
            {formatRupiahSigned(summary.totalExpense)}
          </dd>
        </div>
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Saldo Arus Kas
          </dt>
          <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
            {formatRupiahSigned(summary.netCashflow)}
          </dd>
        </div>
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Sisa Piutang Termin
          </dt>
          <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
            {formatRupiahSigned(summary.pendingReceivables)}
          </dd>
        </div>
      </dl>

      {/* Proyeksi Piutang per Tahapan Skema Pembayaran */}
      <section
        aria-labelledby="stage-schedule-heading"
        className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 id="stage-schedule-heading" className="text-base font-semibold text-[var(--text)]">
            Piutang per Termin
          </h2>
          <Link
            to="/admin/keuangan?tab=skema"
            className="text-xs font-medium text-[var(--text)] hover:underline self-start sm:self-auto"
          >
            Kelola Skema Pembayaran
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stageScheduleSummary.map((stage) => {
            const collectedPct =
              stage.totalTarget > 0
                ? Math.min(100, Math.round((stage.totalCollected / stage.totalTarget) * 100))
                : 0;
            return (
              <div
                key={stage.stageId}
                className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text)] truncate">
                      {stage.nama}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] line-clamp-2">
                      {stage.keterangan}
                    </p>
                  </div>
                  <span className="font-semibold text-[var(--text)] tabular-nums shrink-0">
                    {stage.persentase}%
                  </span>
                </div>

                <div className="h-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--success)] transition-all duration-300"
                    style={{ width: `${collectedPct}%` }}
                  />
                </div>

                <dl className="space-y-1 text-[11px] tabular-nums">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[var(--text-muted)]">Target</dt>
                    <dd className="font-medium text-[var(--text)]">
                      {formatRupiahSigned(stage.totalTarget)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[var(--text-muted)]">Terkumpul ({collectedPct}%)</dt>
                    <dd className="font-semibold text-[var(--success)]">
                      {formatRupiahSigned(stage.totalCollected)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border)]">
                    <dt className="text-[var(--text-muted)]">
                      Piutang ({stage.pendingInvoiceCount} proyek)
                    </dt>
                    <dd className="font-semibold text-[var(--text)]">
                      {formatRupiahSigned(stage.totalRemaining)}
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Arus Kas Bulanan */}
        <section
          aria-labelledby="monthly-cashflow-heading"
          className="lg:col-span-7 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-4 sm:p-5 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 id="monthly-cashflow-heading" className="text-base font-semibold text-[var(--text)]">
              Arus Kas Bulanan
            </h2>
            <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-[var(--radius-sm)] bg-[var(--success)]" />
                Pemasukan
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-[var(--radius-sm)] bg-[var(--danger)]" />
                Pengeluaran
              </span>
            </div>
          </div>

          {monthlyBuckets.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">
              Belum ada transaksi selesai untuk dihitung per bulan.
            </p>
          ) : (
            <div className="space-y-4">
              {monthlyBuckets.map((bucket) => {
                const incomePct = Math.round((bucket.income / maxMonthlyVolume) * 100);
                const expensePct = Math.round((bucket.expense / maxMonthlyVolume) * 100);
                return (
                  <div
                    key={bucket.monthKey}
                    className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]/35 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--text)]">{bucket.label}</span>
                      <span
                        className={[
                          'text-xs font-semibold tabular-nums',
                          bucket.net >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]',
                        ].join(' ')}
                      >
                        Selisih {bucket.net >= 0 ? '+' : ''}
                        {formatRupiahSigned(bucket.net)}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 sm:gap-3 text-xs">
                        <span className="w-12 sm:w-20 text-[var(--text-muted)] shrink-0">Masuk</span>
                        <div className="flex-1 min-w-10 h-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] overflow-hidden">
                          <div
                            className="h-full bg-[var(--success)] transition-all duration-300"
                            style={{ width: `${Math.max(bucket.income > 0 ? 4 : 0, incomePct)}%` }}
                          />
                        </div>
                        <span className="w-24 sm:w-32 text-right font-medium text-[var(--text)] tabular-nums shrink-0 truncate">
                          {formatRupiahSigned(bucket.income)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 text-xs">
                        <span className="w-12 sm:w-20 text-[var(--text-muted)] shrink-0">Keluar</span>
                        <div className="flex-1 min-w-10 h-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] overflow-hidden">
                          <div
                            className="h-full bg-[var(--danger)] transition-all duration-300"
                            style={{ width: `${Math.max(bucket.expense > 0 ? 4 : 0, expensePct)}%` }}
                          />
                        </div>
                        <span className="w-24 sm:w-32 text-right font-medium text-[var(--text)] tabular-nums shrink-0 truncate">
                          {formatRupiahSigned(bucket.expense)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Distribusi Kategori */}
        <section
          aria-labelledby="category-distribution-heading"
          className="lg:col-span-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-4 sm:p-5 space-y-5"
        >
          <h2
            id="category-distribution-heading"
            className="text-base font-semibold text-[var(--text)]"
          >
            Pos Keuangan
          </h2>

          <div className="space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] inline-flex items-center gap-1.5">
                  <ArrowUpRight className="size-3.5 text-[var(--success)]" aria-hidden="true" />
                  Sumber Pemasukan
                </h3>
                <Link
                  to="/admin/keuangan/buku-kas?type=income"
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
                >
                  Lihat Buku Kas
                </Link>
              </div>
              {incomeCategories.length === 0 ? (
                <p className="text-xs text-[var(--text-subtle)]">Belum ada pemasukan selesai.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius-md)]">
                  {incomeCategories.map((item) => (
                    <li
                      key={item.category}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--text)] truncate">{item.category}</p>
                        <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                          {item.count} transaksi · {item.percentage}%
                        </p>
                      </div>
                      <span className="font-semibold text-[var(--success)] tabular-nums whitespace-nowrap">
                        {formatRupiahSigned(item.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] inline-flex items-center gap-1.5">
                  <ArrowDownRight className="size-3.5 text-[var(--danger)]" aria-hidden="true" />
                  Pos Pengeluaran
                </h3>
                <Link
                  to="/admin/keuangan/buku-kas?type=expense"
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
                >
                  Lihat Buku Kas
                </Link>
              </div>
              {expenseCategories.length === 0 ? (
                <p className="text-xs text-[var(--text-subtle)]">Belum ada pengeluaran selesai.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius-md)]">
                  {expenseCategories.map((item) => (
                    <li
                      key={item.category}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--text)] truncate">{item.category}</p>
                        <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                          {item.count} transaksi · {item.percentage}%
                        </p>
                      </div>
                      <span className="font-semibold text-[var(--danger)] tabular-nums whitespace-nowrap">
                        {formatRupiahSigned(item.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Transaksi Menunggu Konfirmasi */}
      <section
        aria-labelledby="pending-finance-heading"
        className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-4 sm:p-5 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-[var(--text-muted)]" aria-hidden="true" />
            <h2 id="pending-finance-heading" className="text-base font-semibold text-[var(--text)]">
              Tertunda ({pendingItems.length})
            </h2>
          </div>
          {pendingItems.length > 0 && (
            <Link
              to="/admin/keuangan/buku-kas?status=Tertunda"
              className="text-xs font-medium text-[var(--text)] hover:underline self-start sm:self-auto"
            >
              Saring di Buku Kas
            </Link>
          )}
        </div>

        {pendingItems.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            Semua catatan kas masuk dan keluar saat ini telah berstatus selesai.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius-md)]">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="font-medium text-[var(--text)]">{item.judul}</p>
                  <p className="text-[var(--text-muted)]">
                    {formatShortDateId(item.tanggal)} · {item.kategori} · {item.pihakTerkait}
                  </p>
                </div>
                <span className="font-semibold text-[var(--text)] tabular-nums whitespace-nowrap">
                  {item.jenis === 'pemasukan' ? '+' : '-'}
                  {formatRupiahSigned(item.nominal)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
