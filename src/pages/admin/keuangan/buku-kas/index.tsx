import { useEffect, useMemo, useState } from 'react';
import { Download, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Button } from '../../../../components/ui/button';
import { Input, Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  ALL_FINANCE_CATEGORIES,
  FINANCE_TRANSACTION_STATUSES,
  buildFinanceCsv,
  extractAvailableMonths,
  filterFinanceTransactions,
  formatFinanceMonthLabel,
  formatRupiahSigned,
  formatShortDateId,
} from '../../../../lib/finance-utils';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useFinanceStore } from '../../../../store/finance-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type {
  FinanceFilterOptions,
  FinanceTransaction,
  FinanceTransactionCategory,
  FinanceTransactionStatus,
} from '../../../../types/finance';
import { AdminPageHeader } from '../../admin-shell';
import { computeFilteredLedgerTotals } from './logic';

export default function AdminBukuKasPage() {
  const [searchParams] = useSearchParams();
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const transactions = useFinanceStore((state) => state.transactions);
  const deleteTransaction = useFinanceStore((state) => state.deleteTransaction);
  const resetFinanceDefaults = useFinanceStore((state) => state.resetFinanceDefaults);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Buku Kas Transaksi | Keuangan Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'keuangan.edit');
  const canDelete = hasPermission(currentRole, 'keuangan.delete');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [filters, setFilters] = useState<FinanceFilterOptions>(() => {
    const typeParam = searchParams.get('type');
    const normalizedType =
      typeParam === 'pemasukan' || typeParam === 'income'
        ? 'pemasukan'
        : typeParam === 'pengeluaran' || typeParam === 'expense'
          ? 'pengeluaran'
          : 'all';
    const statusParam = searchParams.get('status');
    return {
      search: '',
      type: normalizedType,
      category: 'all',
      month: 'all',
      status: statusParam === 'Selesai' || statusParam === 'Tertunda' ? statusParam : 'all',
    };
  });

  useEffect(() => {
    const typeParam = searchParams.get('type');
    const normalizedType =
      typeParam === 'pemasukan' || typeParam === 'income'
        ? 'pemasukan'
        : typeParam === 'pengeluaran' || typeParam === 'expense'
          ? 'pengeluaran'
          : null;
    const statusParam = searchParams.get('status');
    if (normalizedType || statusParam) {
      setFilters((prev) => ({
        ...prev,
        type: normalizedType ?? prev.type,
        status:
          statusParam === 'Selesai' || statusParam === 'Tertunda' ? statusParam : prev.status,
      }));
    }
  }, [searchParams]);

  const availableMonths = useMemo(() => extractAvailableMonths(transactions), [transactions]);

  const filteredTransactions = useMemo(
    () => filterFinanceTransactions(transactions, filters),
    [transactions, filters]
  );

  const filteredTotals = useMemo(
    () => computeFilteredLedgerTotals(filteredTransactions),
    [filteredTransactions]
  );

  const handleConfirmDelete = (tx: FinanceTransaction) => {
    if (!canDelete) return;
    deleteTransaction(tx.id);
    recordActivity('Menghapus catatan kas', 'Buku Kas', tx.judul);
    setFeedback({ type: 'ok', text: `Transaksi "${tx.judul}" telah dihapus dari buku kas.` });
  };

  const handleExportCsv = () => {
    const csv = buildFinanceCsv(transactions);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buku-kas-shansusdzar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    recordActivity('Mengekspor laporan buku kas CSV', 'Buku Kas', `${transactions.length} Transaksi`);
    setFeedback({
      type: 'ok',
      text: `Laporan CSV berisi ${transactions.length} transaksi kas berhasil diunduh.`,
    });
  };

  const handleResetDefaults = () => {
    if (!canEdit) return;
    resetFinanceDefaults();
    recordActivity('Mengembalikan data contoh keuangan', 'Buku Kas', 'Reset Default');
    setFeedback({
      type: 'ok',
      text: 'Data keuangan dikembalikan ke dataset awal workshop.',
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Buku Kas Transaksi"
        description="Seluruh catatan pemasukan proyek serta pengeluaran material, hardware, upah, dan operasional."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleExportCsv}>
              <Download className="size-3.5" aria-hidden="true" />
              Ekspor CSV Kas
            </Button>
            {canEdit && (
              <>
                <Button variant="secondary" size="sm" onClick={handleResetDefaults}>
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Reset Data Awal
                </Button>
                <Link
                  to="/admin/keuangan/buku-kas/baru"
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Catat Transaksi
                </Link>
              </>
            )}
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Toolbar & Filters */}
      <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              className="size-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <Input
              aria-label="Cari transaksi keuangan"
              placeholder="Cari judul, klien, supplier, atau nomor proyek..."
              value={filters.search ?? ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10"
            />
          </div>

          {(filters.search ||
            (filters.type && filters.type !== 'all') ||
            (filters.category && filters.category !== 'all') ||
            (filters.month && filters.month !== 'all') ||
            (filters.status && filters.status !== 'all')) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setFilters({
                  search: '',
                  type: 'all',
                  category: 'all',
                  month: 'all',
                  status: 'all',
                })
              }
            >
              Reset Saringan
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Select
            aria-label="Filter jenis transaksi"
            value={filters.type ?? 'all'}
            onChange={(e) =>
              setFilters({
                ...filters,
                type: e.target.value as FinanceFilterOptions['type'],
              })
            }
          >
            <option value="all">Semua Jenis (Masuk &amp; Keluar)</option>
            <option value="pemasukan">Pemasukan Saja</option>
            <option value="pengeluaran">Pengeluaran Saja</option>
          </Select>

          <Select
            aria-label="Filter kategori transaksi"
            value={filters.category ?? 'all'}
            onChange={(e) =>
              setFilters({
                ...filters,
                category: e.target.value as 'all' | FinanceTransactionCategory,
              })
            }
          >
            <option value="all">Semua Kategori</option>
            {ALL_FINANCE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter bulan transaksi"
            value={filters.month ?? 'all'}
            onChange={(e) => setFilters({ ...filters, month: e.target.value })}
          >
            <option value="all">Semua Periode Bulan</option>
            {availableMonths.map((month) => (
              <option key={month} value={month}>
                {formatFinanceMonthLabel(month)}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter status transaksi"
            value={filters.status ?? 'all'}
            onChange={(e) =>
              setFilters({
                ...filters,
                status: e.target.value as 'all' | FinanceTransactionStatus,
              })
            }
          >
            <option value="all">Semua Status</option>
            {FINANCE_TRANSACTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                Status: {status}
              </option>
            ))}
          </Select>
        </div>

        <div className="pt-2 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
          <span className="tabular-nums">
            Menampilkan <strong className="text-[var(--text)]">{filteredTransactions.length}</strong>{' '}
            dari {transactions.length} transaksi
          </span>
          <div className="flex flex-wrap items-center gap-4 tabular-nums">
            <span>
              Masuk Tersaring:{' '}
              <strong className="text-[var(--success)]">
                {formatRupiahSigned(filteredTotals.income)}
              </strong>
            </span>
            <span>
              Keluar Tersaring:{' '}
              <strong className="text-[var(--danger)]">
                {formatRupiahSigned(filteredTotals.expense)}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-medium text-[var(--text)]">
              Tidak ada transaksi yang cocok dengan filter saat ini.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Ubah kata kunci pencarian atau reset saringan untuk melihat seluruh buku kas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs text-[var(--text-muted)]">
                  <th className="py-3 px-4 font-medium">Tanggal</th>
                  <th className="py-3 px-4 font-medium">Uraian &amp; Referensi</th>
                  <th className="py-3 px-4 font-medium">Kategori &amp; Metode</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Nominal</th>
                  {(canEdit || canDelete) && (
                    <th className="py-3 px-4 font-medium text-right">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[var(--surface-elevated)] align-top">
                    <td className="py-3 px-4 text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                      {formatShortDateId(tx.tanggal)}
                    </td>
                    <td className="py-3 px-4 min-w-[220px]">
                      <p className="text-xs font-semibold text-[var(--text)]">{tx.judul}</p>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        {tx.pihakTerkait}
                        {tx.referensiProyek ? ` · ${tx.referensiProyek}` : ''}
                      </p>
                      {tx.catatan && (
                        <p className="text-[11px] text-[var(--text-subtle)] mt-1 line-clamp-2">
                          {tx.catatan}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="text-xs font-medium text-[var(--text)]">{tx.kategori}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">{tx.metodePembayaran}</p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={[
                          'text-xs font-medium',
                          tx.status === 'Selesai'
                            ? 'text-[var(--success)]'
                            : 'text-[var(--text-muted)]',
                        ].join(' ')}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums">
                      <span
                        className={[
                          'text-xs font-semibold',
                          tx.jenis === 'pemasukan' ? 'text-[var(--success)]' : 'text-[var(--danger)]',
                        ].join(' ')}
                      >
                        {tx.jenis === 'pemasukan' ? '+' : '-'}
                        {formatRupiahSigned(tx.nominal)}
                      </span>
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          {canEdit && (
                            <Link
                              to={`/admin/keuangan/buku-kas/${tx.id}/edit`}
                              aria-label={`Ubah transaksi ${tx.judul}`}
                              className="p-2 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] inline-flex items-center"
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                            </Link>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              aria-label={`Hapus transaksi ${tx.judul}`}
                              onClick={() => handleConfirmDelete(tx)}
                              className="p-2 rounded-[var(--radius-md)] text-[var(--danger)] hover:bg-[var(--danger-surface)] cursor-pointer"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
