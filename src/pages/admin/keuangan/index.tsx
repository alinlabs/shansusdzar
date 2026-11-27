import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Download,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Wallet,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import {
  AdminActionButton,
  AdminActionLink,
} from '../../../components/admin/admin-action-buttons';
import {
  AdminFeedbackBanner,
  useAdminFeedbackState,
} from '../../../components/admin/admin-feedback';
import {
  AdminMobileViewModeToggle,
  useMobileFormViewMode,
} from '../../../components/admin/mobile-form-tabs';
import { Select } from '../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import {
  ALL_FINANCE_CATEGORIES,
  FINANCE_TRANSACTION_STATUSES,
  buildFinanceCsv,
  computeCategoryBreakdown,
  computeFinanceSummary,
  computeMonthlyCashflow,
  extractAvailableMonths,
  filterFinanceTransactions,
  formatFinanceMonthLabel,
  formatRupiahSigned,
  formatShortDateId,
} from '../../../lib/finance-utils';
import { DEFAULT_PAYMENT_SCHEME } from '../../../lib/payment-scheme';
import { canEditPage } from '../../../lib/rbac';
import { useAdminAuthStore } from '../../../store/admin-auth-store';
import { useFinanceStore } from '../../../store/finance-store';
import { useProjectsStore } from '../../../store/projects-store';
import { useSiteContentStore } from '../../../store/site-content-store';
import type {
  FinanceFilterOptions,
  FinanceTransaction,
  FinanceTransactionCategory,
  FinanceTransactionStatus,
} from '../../../types/finance';
import { AdminPageHeader } from '../admin-shell';
import { computeFilteredLedgerTotals } from './buku-kas/logic';
import { PAYMENT_SCHEME_FORM_ID, SkemaPembayaranPanel } from './skema-pembayaran-panel';

type ScopeFilter = 'all' | 'workshop-only' | 'project-only';
type FinancePageTab = 'kas' | 'skema';

export default function AdminKeuanganUmumPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const updatePaymentScheme = useSiteContentStore((state) => state.updatePaymentScheme);
  const transactions = useFinanceStore((state) => state.transactions);
  const invoices = useFinanceStore((state) => state.invoices);
  const deleteTransaction = useFinanceStore((state) => state.deleteTransaction);
  const projects = useProjectsStore((state) => state.projects);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const rawTab = searchParams.get('tab');
  const activeTab: FinancePageTab = rawTab === 'skema' ? 'skema' : 'kas';

  useDocumentTitle(
    activeTab === 'skema'
      ? `Skema Pembayaran & Keuangan | Admin ${shortBrandName}`
      : `Keuangan | Admin ${shortBrandName}`
  );

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'keuangan');
  const canEditScheme = canEdit;
  const canDelete = canEdit;

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [resetSchemeSeq, setResetSchemeSeq] = useState(0);
  const { mode: skemaViewMode, toggleMode: toggleSkemaViewMode } = useMobileFormViewMode();
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [filters, setFilters] = useState<FinanceFilterOptions>({
    search: '',
    type: 'all',
    category: 'all',
    month: 'all',
    status: 'all',
  });

  const switchTab = (nextTab: FinancePageTab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextTab === 'kas') {
          next.delete('tab');
        } else {
          next.set('tab', nextTab);
        }
        return next;
      },
      { replace: true }
    );
  };

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );

  const summary = useMemo(
    () => computeFinanceSummary(transactions, invoices),
    [transactions, invoices]
  );
  const monthlyBuckets = useMemo(() => computeMonthlyCashflow(transactions), [transactions]);
  const incomeCategories = useMemo(
    () => computeCategoryBreakdown(transactions, 'pemasukan'),
    [transactions]
  );
  const expenseCategories = useMemo(
    () => computeCategoryBreakdown(transactions, 'pengeluaran'),
    [transactions]
  );
  const pendingItems = useMemo(
    () => transactions.filter((tx) => tx.status === 'Tertunda'),
    [transactions]
  );
  const availableMonths = useMemo(() => extractAvailableMonths(transactions), [transactions]);

  const filteredTransactions = useMemo(() => {
    const base = filterFinanceTransactions(transactions, filters);
    if (scopeFilter === 'workshop-only') {
      return base.filter((tx) => !tx.projectId);
    }
    if (scopeFilter === 'project-only') {
      return base.filter((tx) => Boolean(tx.projectId));
    }
    return base;
  }, [transactions, filters, scopeFilter]);

  const filteredTotals = useMemo(
    () => computeFilteredLedgerTotals(filteredTransactions),
    [filteredTransactions]
  );

  const maxMonthlyVolume = monthlyBuckets.reduce(
    (max, item) => Math.max(max, item.income, item.expense),
    1
  );

  const hasCustomFilter =
    scopeFilter !== 'all' ||
    filters.type !== 'all' ||
    filters.category !== 'all' ||
    filters.month !== 'all' ||
    filters.status !== 'all';
  const hasAnyFilter = Boolean(filters.search?.trim()) || hasCustomFilter;

  const handleResetFilters = () => {
    setScopeFilter('all');
    setFilters({
      search: '',
      type: 'all',
      category: 'all',
      month: 'all',
      status: 'all',
    });
  };

  const handleExportCsv = () => {
    const csv = buildFinanceCsv(transactions);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keuangan-shansusdzar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    recordActivity('Mengekspor laporan keuangan CSV', 'Keuangan', `${transactions.length} Transaksi`);
    setFeedback({
      type: 'ok',
      text: `Laporan CSV berisi ${transactions.length} transaksi kas berhasil diunduh.`,
    });
  };

  const handleDelete = (tx: FinanceTransaction) => {
    if (!canDelete) return;
    deleteTransaction(tx.id);
    recordActivity('Menghapus catatan keuangan', 'Keuangan', tx.judul);
    setFeedback({ type: 'ok', text: `Transaksi "${tx.judul}" telah dihapus dari buku kas.` });
  };

  const handleResetPaymentScheme = () => {
    if (!canEditScheme) return;
    const fresh = structuredClone(DEFAULT_PAYMENT_SCHEME);
    updatePaymentScheme(fresh);
    setResetSchemeSeq((seq) => seq + 1);
    recordActivity(
      'Mengembalikan skema pembayaran ke standar Shansus Dzar Indonesia',
      'Keuangan',
      '30% / 40% / 20% / 10%'
    );
    setFeedback({
      type: 'ok',
      text: 'Skema pembayaran dikembalikan ke standar 30% DP · 40% Produksi · 20% Pra-Instalasi · 10% BAST.',
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Keuangan"
        description={
          activeTab === 'skema'
            ? 'Atur persentase dan ketentuan termin pembayaran acuan proyek, kalkulator custom, dan dokumen resmi.'
            : 'Arus kas gabungan pembayaran proyek, belanja operasional workshop, penjualan katalog, serta skema pembayaran.'
        }
        search={
          activeTab === 'kas'
            ? {
                value: filters.search ?? '',
                onChange: (next) => setFilters((prev) => ({ ...prev, search: next })),
                placeholder: 'Cari judul, klien, supplier, atau referensi...',
                ariaLabel: 'Cari transaksi keuangan',
                onActiveChange: setIsSearchActive,
                hasActiveFilter: hasCustomFilter,
                onResetAll: handleResetFilters,
                filterAriaLabel: 'Filter transaksi keuangan',
                filterTitle: 'Filter transaksi keuangan',
                renderFilterContent: (closeFilter) => (
                  <>
                    <div className="space-y-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Filter Transaksi
                      </p>

                      <div className="space-y-2">
                        <Select
                          aria-label="Filter lingkup kas"
                          value={scopeFilter}
                          onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)}
                          className="px-2.5 text-xs"
                        >
                          <option value="all">Semua Sumber Kas</option>
                          <option value="workshop-only">Kas Umum Non-Proyek</option>
                          <option value="project-only">Terkait Proyek</option>
                        </Select>

                        <Select
                          aria-label="Filter jenis transaksi"
                          value={filters.type ?? 'all'}
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              type: e.target.value as FinanceFilterOptions['type'],
                            }))
                          }
                          className="px-2.5 text-xs"
                        >
                          <option value="all">Semua Jenis</option>
                          <option value="pemasukan">Pemasukan</option>
                          <option value="pengeluaran">Pengeluaran</option>
                        </Select>

                        <Select
                          aria-label="Filter kategori"
                          value={filters.category ?? 'all'}
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              category: e.target.value as 'all' | FinanceTransactionCategory,
                            }))
                          }
                          className="px-2.5 text-xs"
                        >
                          <option value="all">Semua Kategori</option>
                          {ALL_FINANCE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </Select>

                        <Select
                          aria-label="Filter bulan"
                          value={filters.month ?? 'all'}
                          onChange={(e) =>
                            setFilters((prev) => ({ ...prev, month: e.target.value }))
                          }
                          className="px-2.5 text-xs"
                        >
                          <option value="all">Semua Periode</option>
                          {availableMonths.map((month) => (
                            <option key={month} value={month}>
                              {formatFinanceMonthLabel(month)}
                            </option>
                          ))}
                        </Select>

                        <Select
                          aria-label="Filter status"
                          value={filters.status ?? 'all'}
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              status: e.target.value as 'all' | FinanceTransactionStatus,
                            }))
                          }
                          className="px-2.5 text-xs"
                        >
                          <option value="all">Semua Status</option>
                          {FINANCE_TRANSACTION_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              Status: {st}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[var(--border)] space-y-1 text-[11px] text-[var(--text-muted)] tabular-nums">
                      <p>
                        Menampilkan{' '}
                        <strong className="text-[var(--text)]">{filteredTransactions.length}</strong>{' '}
                        dari {transactions.length} transaksi
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          Masuk:{' '}
                          <strong className="text-[var(--success)]">
                            {formatRupiahSigned(filteredTotals.income)}
                          </strong>
                        </span>
                        <span>
                          Keluar:{' '}
                          <strong className="text-[var(--danger)]">
                            {formatRupiahSigned(filteredTotals.expense)}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={!hasCustomFilter}
                        onClick={() => {
                          setScopeFilter('all');
                          setFilters((prev) => ({
                            ...prev,
                            type: 'all',
                            category: 'all',
                            month: 'all',
                            status: 'all',
                          }));
                        }}
                        className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                      >
                        Reset Setelan
                      </button>
                      <button
                        type="button"
                        onClick={closeFilter}
                        className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-semibold cursor-pointer"
                      >
                        Selesai
                      </button>
                    </div>
                  </>
                ),
              }
            : undefined
        }
        actions={
          activeTab === 'skema' ? (
            <>
              {canEditScheme && (
                <>
                  <AdminActionButton
                    label="Reset Standar"
                    icon={<RotateCcw className="size-3.5" />}
                    onClick={handleResetPaymentScheme}
                  />
                  <span className="hidden md:inline-flex">
                    <AdminActionButton
                      type="submit"
                      form={PAYMENT_SCHEME_FORM_ID}
                      variant="primary"
                      size="sm"
                      iconOnly
                      label="Simpan Skema"
                      icon={<Save className="size-4" />}
                      data-testid="desktop-header-submit-btn"
                    />
                  </span>
                </>
              )}
              <AdminMobileViewModeToggle mode={skemaViewMode} onToggle={toggleSkemaViewMode} />
            </>
          ) : (
            <>
              <AdminActionButton
                icon={<Download className="size-3.5" />}
                label="Ekspor CSV"
                onClick={handleExportCsv}
              />
              {canEdit && (
                <AdminActionLink
                  to="/admin/keuangan/baru"
                  variant="primary"
                  icon={<Plus className="size-3.5" />}
                  label="Catat Transaksi"
                />
              )}
            </>
          )
        }
      />

      {!isSearchActive && (
        <div
          role="tablist"
          aria-label="Bagian Keuangan"
          className="-mt-4 sm:-mt-6 lg:-mt-8 -ml-[max(0.875rem,env(safe-area-inset-left))] -mr-[max(0.875rem,env(safe-area-inset-right))] sm:-mx-6 lg:-mx-8 bg-[var(--surface)] grid grid-cols-2 border-b border-[var(--border)]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'kas'}
            onClick={() => switchTab('kas')}
            className={[
              'w-full py-2.5 sm:py-3 px-3 sm:px-4 -mb-px border-b-2 text-center text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'kas'
                ? 'border-[var(--accent)] text-[var(--text)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] font-medium',
            ].join(' ')}
          >
            Buku &amp; Arus Kas
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'skema'}
            onClick={() => switchTab('skema')}
            className={[
              'w-full py-2.5 sm:py-3 px-3 sm:px-4 -mb-px border-b-2 text-center text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap',
              activeTab === 'skema'
                ? 'border-[var(--accent)] text-[var(--text)] font-semibold'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] font-medium',
            ].join(' ')}
          >
            Skema Pembayaran
          </button>
        </div>
      )}

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {activeTab === 'skema' ? (
        <SkemaPembayaranPanel
          canEdit={canEditScheme}
          resetSignal={resetSchemeSeq}
          mobileViewMode={skemaViewMode}
          onFeedback={setFeedback}
        />
      ) : (
        <>
          {!isSearchActive && (
            <>
              {/* 4 KPI Strip */}
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

          {/* Monthly Cashflow & Category Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <section className="lg:col-span-7 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-4 sm:p-5 space-y-4">
              <h2 className="text-base font-semibold text-[var(--text)]">Arus Kas Bulanan</h2>
              {monthlyBuckets.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">Belum ada transaksi bulanan.</p>
              ) : (
                <div className="space-y-3">
                  {monthlyBuckets.map((bucket) => {
                    const incomePct = Math.round((bucket.income / maxMonthlyVolume) * 100);
                    const expensePct = Math.round((bucket.expense / maxMonthlyVolume) * 100);
                    return (
                      <div
                        key={bucket.monthKey}
                        className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[var(--text)]">{bucket.label}</span>
                          <span
                            className={[
                              'font-semibold tabular-nums',
                              bucket.net >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]',
                            ].join(' ')}
                          >
                            {bucket.net >= 0 ? '+' : ''}
                            {formatRupiahSigned(bucket.net)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-12 text-[var(--text-muted)] shrink-0">Masuk</span>
                            <div className="flex-1 h-2 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] overflow-hidden">
                              <div
                                className="h-full bg-[var(--success)]"
                                style={{ width: `${Math.max(bucket.income > 0 ? 4 : 0, incomePct)}%` }}
                              />
                            </div>
                            <span className="w-28 text-right font-medium tabular-nums shrink-0">
                              {formatRupiahSigned(bucket.income)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-12 text-[var(--text-muted)] shrink-0">Keluar</span>
                            <div className="flex-1 h-2 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] overflow-hidden">
                              <div
                                className="h-full bg-[var(--danger)]"
                                style={{ width: `${Math.max(bucket.expense > 0 ? 4 : 0, expensePct)}%` }}
                              />
                            </div>
                            <span className="w-28 text-right font-medium tabular-nums shrink-0">
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

            <section className="lg:col-span-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-4 sm:p-5 space-y-4">
              <h2 className="text-base font-semibold text-[var(--text)]">Pos Keuangan &amp; Tempo</h2>
              <div className="space-y-4 text-xs">
                <div className="space-y-2">
                  <h3 className="font-semibold text-[var(--text-muted)] inline-flex items-center gap-1.5">
                    <ArrowUpRight className="size-3.5 text-[var(--success)]" aria-hidden="true" />
                    Sumber Pemasukan
                  </h3>
                  <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius-md)]">
                    {incomeCategories.slice(0, 4).map((item) => (
                      <li key={item.category} className="px-3 py-2 flex items-center justify-between gap-2">
                        <span className="truncate text-[var(--text)]">{item.category}</span>
                        <span className="font-semibold text-[var(--success)] tabular-nums shrink-0">
                          {formatRupiahSigned(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-[var(--text-muted)] inline-flex items-center gap-1.5">
                    <ArrowDownRight className="size-3.5 text-[var(--danger)]" aria-hidden="true" />
                    Pos Pengeluaran
                  </h3>
                  <ul className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius-md)]">
                    {expenseCategories.slice(0, 4).map((item) => (
                      <li key={item.category} className="px-3 py-2 flex items-center justify-between gap-2">
                        <span className="truncate text-[var(--text)]">{item.category}</span>
                        <span className="font-semibold text-[var(--danger)] tabular-nums shrink-0">
                          {formatRupiahSigned(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                    {pendingItems.length > 0 && (
                      <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-1">
                        <p className="font-semibold text-[var(--text)] inline-flex items-center gap-1.5">
                          <Clock className="size-3.5 text-[var(--danger)]" aria-hidden="true" />
                          Tertunda / Tempo ({pendingItems.length})
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Gunakan ikon cari di header lalu pilih Filter Status: Tertunda untuk meninjau atau menyelesaikan.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}

          {filteredTransactions.length === 0 ? (
            <div className="p-8 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] text-center space-y-3">
              <Wallet className="size-8 text-[var(--text-muted)] mx-auto" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--text)]">
                  Tidak ada transaksi yang cocok
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Ubah kata kunci pencarian atau pilih filter lain untuk melihat catatan kas.
                </p>
              </div>
              {hasAnyFilter && (
                <AdminActionButton
                  variant="ghost"
                  icon={<RotateCcw className="size-3.5" />}
                  label="Reset Filter"
                  hideLabelOnMobile={false}
                  onClick={handleResetFilters}
                />
              )}
            </div>
          ) : (
            <>
              {/* Ledger Table / Mobile Cards */}
              <div className="md:hidden space-y-2.5">
                {filteredTransactions.map((tx) => {
              const linkedProject = tx.projectId ? projectMap.get(tx.projectId) : null;
              return (
                <div
                  key={tx.id}
                  className="p-3.5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                        {formatShortDateId(tx.tanggal)} · {tx.kategori}
                      </p>
                      <p className="text-sm font-semibold text-[var(--text)]">{tx.judul}</p>
                      <p className="text-[var(--text-muted)] truncate">
                        {tx.pihakTerkait}
                        {linkedProject
                          ? ` · ${[linkedProject.id, linkedProject.namaProyek].filter(Boolean).join(' · ')}`
                          : ' · Umum Workshop'}
                      </p>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <p
                        className={
                          tx.jenis === 'pemasukan'
                            ? 'font-semibold text-[var(--success)]'
                            : 'font-semibold text-[var(--danger)]'
                        }
                      >
                        {tx.jenis === 'pemasukan' ? '+' : '-'}
                        {formatRupiahSigned(tx.nominal)}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">{tx.status}</p>
                    </div>
                  </div>
                  {(canEdit || canDelete) && (
                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[var(--border)]">
                      {canEdit && (
                        <AdminActionLink
                          to={`/admin/keuangan/${tx.id}/edit`}
                          icon={<Pencil className="size-3.5" />}
                          label={`Ubah transaksi ${tx.judul}`}
                          iconOnly
                        />
                      )}
                      {canDelete && (
                        <AdminActionButton
                          variant="danger"
                          icon={<Trash2 className="size-3.5" />}
                          label={`Hapus transaksi ${tx.judul}`}
                          iconOnly
                          onClick={() => handleDelete(tx)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="hidden md:block border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs text-[var(--text-muted)]">
                    <th className="py-3 px-4 font-medium">Tanggal</th>
                    <th className="py-3 px-4 font-medium">Uraian &amp; Lingkup</th>
                    <th className="py-3 px-4 font-medium">Kategori &amp; Metode</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Nominal</th>
                    {(canEdit || canDelete) && (
                      <th className="py-3 px-4 font-medium text-right">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredTransactions.map((tx) => {
                    const linkedProject = tx.projectId ? projectMap.get(tx.projectId) : null;
                    return (
                      <tr key={tx.id} className="hover:bg-[var(--surface-elevated)] align-top">
                        <td className="py-3 px-4 text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                          {formatShortDateId(tx.tanggal)}
                        </td>
                        <td className="py-3 px-4 min-w-[220px]">
                          <p className="text-xs font-semibold text-[var(--text)]">{tx.judul}</p>
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                            {tx.pihakTerkait} ·{' '}
                            {linkedProject ? (
                              <Link
                                to={`/admin/proyek/${linkedProject.id}?tab=keuangan`}
                                className="underline hover:text-[var(--text)]"
                              >
                                {[linkedProject.id, linkedProject.namaProyek].filter(Boolean).join(' · ')}
                              </Link>
                            ) : (
                              'Operasional Umum Workshop'
                            )}
                          </p>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <p className="text-xs font-medium text-[var(--text)]">{tx.kategori}</p>
                          <p className="text-[11px] text-[var(--text-muted)]">{tx.metodePembayaran}</p>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-xs">
                          <span
                            className={
                              tx.status === 'Selesai'
                                ? 'font-medium text-[var(--success)]'
                                : 'text-[var(--danger)] font-medium'
                            }
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums text-xs font-semibold">
                          <span
                            className={
                              tx.jenis === 'pemasukan'
                                ? 'text-[var(--success)]'
                                : 'text-[var(--danger)]'
                            }
                          >
                            {tx.jenis === 'pemasukan' ? '+' : '-'}
                            {formatRupiahSigned(tx.nominal)}
                          </span>
                        </td>
                        {(canEdit || canDelete) && (
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {canEdit && (
                                <AdminActionLink
                                  to={`/admin/keuangan/${tx.id}/edit`}
                                  icon={<Pencil className="size-3.5" />}
                                  label={`Ubah transaksi ${tx.judul}`}
                                  iconOnly
                                />
                              )}
                              {canDelete && (
                                <AdminActionButton
                                  variant="danger"
                                  icon={<Trash2 className="size-3.5" />}
                                  label={`Hapus transaksi ${tx.judul}`}
                                  iconOnly
                                  onClick={() => handleDelete(tx)}
                                />
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
