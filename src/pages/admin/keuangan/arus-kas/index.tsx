import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Clock, Download } from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Button } from '../../../../components/ui/button';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  buildFinanceCsv,
  computeCategoryBreakdown,
  computeFinanceSummary,
  computeMonthlyCashflow,
  formatRupiahSigned,
  formatShortDateId,
} from '../../../../lib/finance-utils';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useFinanceStore } from '../../../../store/finance-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminArusKasPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const transactions = useFinanceStore((state) => state.transactions);
  const invoices = useFinanceStore((state) => state.invoices);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Arus Kas & Analisis | Keuangan Admin ${shortBrandName}`);

  const [feedback, setFeedback] = useAdminFeedbackState();

  const summary = useMemo(
    () => computeFinanceSummary(transactions, invoices),
    [transactions, invoices]
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
    <div className="space-y-6">
      <AdminPageHeader
        title="Arus Kas & Analisis Keuangan"
        description="Perbandingan pemasukan dan pengeluaran bulanan, komposisi pos keuangan, serta daftar catatan tertunda."
        actions={
          <Button variant="secondary" size="sm" onClick={handleExportCsv}>
            <Download className="size-3.5" aria-hidden="true" />
            Ekspor CSV Kas
          </Button>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Total Pemasukan Selesai</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--success)] tabular-nums">
            {formatRupiahSigned(summary.totalIncome)}
          </dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Total Pengeluaran Selesai</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--danger)] tabular-nums">
            {formatRupiahSigned(summary.totalExpense)}
          </dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Saldo Arus Kas Bersih</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {formatRupiahSigned(summary.netCashflow)}
          </dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Piutang / Sisa Termin</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {formatRupiahSigned(summary.pendingReceivables)}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Arus Kas Bulanan */}
        <section
          aria-labelledby="monthly-cashflow-heading"
          className="lg:col-span-7 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-5 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 id="monthly-cashflow-heading" className="text-base font-semibold text-[var(--text)]">
                Perbandingan Arus Kas Bulanan
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Total transaksi masuk dan keluar berstatus selesai per bulan.
              </p>
            </div>
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
                      <div className="flex items-center gap-3 text-xs">
                        <span className="w-20 text-[var(--text-muted)] shrink-0">Masuk</span>
                        <div className="flex-1 h-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] overflow-hidden">
                          <div
                            className="h-full bg-[var(--success)] transition-all duration-300"
                            style={{ width: `${Math.max(bucket.income > 0 ? 4 : 0, incomePct)}%` }}
                          />
                        </div>
                        <span className="w-32 text-right font-medium text-[var(--text)] tabular-nums shrink-0">
                          {formatRupiahSigned(bucket.income)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="w-20 text-[var(--text-muted)] shrink-0">Keluar</span>
                        <div className="flex-1 h-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] overflow-hidden">
                          <div
                            className="h-full bg-[var(--danger)] transition-all duration-300"
                            style={{ width: `${Math.max(bucket.expense > 0 ? 4 : 0, expensePct)}%` }}
                          />
                        </div>
                        <span className="w-32 text-right font-medium text-[var(--text)] tabular-nums shrink-0">
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
          className="lg:col-span-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-5 space-y-5"
        >
          <div>
            <h2
              id="category-distribution-heading"
              className="text-base font-semibold text-[var(--text)]"
            >
              Komposisi Pos Keuangan
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Rincian sumber pemasukan dan alokasi biaya produksi workshop.
            </p>
          </div>

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
        className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-5 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-[var(--text-muted)]" aria-hidden="true" />
            <h2 id="pending-finance-heading" className="text-base font-semibold text-[var(--text)]">
              Catatan Berstatus Tertunda ({pendingItems.length})
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
