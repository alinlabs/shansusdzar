import { useMemo, useState } from 'react';
import { Check, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Button } from '../../../../components/ui/button';
import { Input, Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  EXPENSE_CATEGORIES,
  buildFinanceCsv,
  formatRupiahSigned,
  formatShortDateId,
} from '../../../../lib/finance-utils';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useFinanceStore } from '../../../../store/finance-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type {
  FinanceTransaction,
  FinanceTransactionCategory,
  FinanceTransactionStatus,
} from '../../../../types/finance';
import { AdminPageHeader } from '../../admin-shell';
import { computePurchaseStats, filterPurchases } from './logic';

export default function AdminPembelianPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const transactions = useFinanceStore((state) => state.transactions);
  const upsertTransaction = useFinanceStore((state) => state.upsertTransaction);
  const deleteTransaction = useFinanceStore((state) => state.deleteTransaction);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Pembelian Workshop & Material | Keuangan Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'keuangan.edit');
  const canDelete = hasPermission(currentRole, 'keuangan.delete');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | FinanceTransactionCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FinanceTransactionStatus>('all');

  const allPurchases = useMemo(
    () => filterPurchases(transactions, { search: '', category: 'all', status: 'all' }),
    [transactions]
  );

  const purchaseStats = useMemo(() => computePurchaseStats(allPurchases), [allPurchases]);

  const filteredPurchases = useMemo(
    () =>
      filterPurchases(transactions, {
        search: searchQuery,
        category: categoryFilter,
        status: statusFilter,
      }),
    [transactions, searchQuery, categoryFilter, statusFilter]
  );

  const handleMarkPaid = (tx: FinanceTransaction) => {
    if (!canEdit) return;
    upsertTransaction({ ...tx, status: 'Selesai' });
    recordActivity('Melunasi pembelian workshop', 'Pembelian', tx.judul);
    setFeedback({ type: 'ok', text: `Pembelian "${tx.judul}" ditandai sudah lunas.` });
  };

  const handleDelete = (tx: FinanceTransaction) => {
    if (!canDelete) return;
    deleteTransaction(tx.id);
    recordActivity('Menghapus catatan pembelian', 'Pembelian', tx.judul);
    setFeedback({ type: 'ok', text: `Catatan pembelian "${tx.judul}" telah dihapus.` });
  };

  const handleExportCsv = () => {
    const csv = buildFinanceCsv(allPurchases);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pembelian-shansusdzar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    recordActivity('Mengekspor laporan pembelian CSV', 'Pembelian', `${allPurchases.length} Catatan`);
    setFeedback({
      type: 'ok',
      text: `Laporan CSV berisi ${allPurchases.length} catatan pembelian berhasil diunduh.`,
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Pembelian Bahan, Hardware & Operasional"
        description="Catat pembelian ke supplier/toko material, kaitkan ke proyek terkait, dan pantau nota tempo."
        actions={
          <>
            <Button type="button" variant="secondary" size="sm" onClick={handleExportCsv}>
              <Download className="size-3.5" aria-hidden="true" />
              Ekspor CSV
            </Button>
            {canEdit && (
              <Link
                to="/admin/keuangan/pembelian/baru"
                className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
              >
                <Plus className="size-4" aria-hidden="true" />
                Catat Pembelian
              </Link>
            )}
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Purchase Summary Strip */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
        <div className="p-4">
          <dt className="text-xs text-[var(--text-muted)]">Total Pembelian Lunas</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--text)] tabular-nums">
            {formatRupiahSigned(purchaseStats.totalCompleted)}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)] tabular-nums">
            Dari {purchaseStats.totalCount} catatan pembelian
          </dd>
        </div>
        <div className="p-4">
          <dt className="text-xs text-[var(--text-muted)]">Belanja Bahan &amp; Hardware</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--text)] tabular-nums">
            {formatRupiahSigned(purchaseStats.materialSpend)}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Multipleks, PVC, MDF, HPL &amp; hardware</dd>
        </div>
        <div className="p-4">
          <dt className="text-xs text-[var(--text-muted)]">Pembelian Tertunda / Tempo</dt>
          <dd
            className={[
              'mt-1 text-lg font-semibold tabular-nums',
              purchaseStats.totalPending > 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]',
            ].join(' ')}
          >
            {formatRupiahSigned(purchaseStats.totalPending)}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)] tabular-nums">
            {purchaseStats.pendingCount} nota menunggu pelunasan
          </dd>
        </div>
      </dl>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
          <Search
            className="size-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <Input
            aria-label="Cari catatan pembelian"
            placeholder="Cari material, supplier, atau ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          aria-label="Filter kategori pembelian"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'all' | FinanceTransactionCategory)}
          className="w-auto"
        >
          <option value="all">Semua Kategori Belanja</option>
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter status pembelian"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | FinanceTransactionStatus)}
          className="w-auto"
        >
          <option value="all">Semua Status</option>
          <option value="Selesai">Lunas / Selesai</option>
          <option value="Tertunda">Tempo / Tertunda</option>
        </Select>
      </div>

      {/* Purchase Table */}
      <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-[var(--text-muted)]">
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Tanggal</th>
              <th className="py-3 px-4 font-semibold">Item Pembelian &amp; Catatan</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Supplier / Vendor</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Kategori</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Ref Proyek</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Status</th>
              <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Nominal</th>
              {(canEdit || canDelete) && (
                <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Aksi</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filteredPurchases.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit || canDelete ? 8 : 7}
                  className="py-10 text-center text-[var(--text-muted)]"
                >
                  Tidak ada catatan pembelian yang sesuai filter.
                </td>
              </tr>
            ) : (
              filteredPurchases.map((tx) => (
                <tr key={tx.id} className="hover:bg-[var(--surface-muted)]/30">
                  <td className="py-3 px-4 text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                    {formatShortDateId(tx.tanggal)}
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    <p className="font-semibold text-[var(--text)]">{tx.judul}</p>
                    {tx.catatan && (
                      <p className="text-[var(--text-subtle)] truncate mt-0.5">{tx.catatan}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-[var(--text)] whitespace-nowrap">
                    {tx.pihakTerkait}
                  </td>
                  <td className="py-3 px-4 text-[var(--text-muted)] whitespace-nowrap">
                    {tx.kategori}
                  </td>
                  <td className="py-3 px-4 text-[var(--text-muted)] font-mono whitespace-nowrap">
                    {tx.referensiProyek || '-'}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={
                        tx.status === 'Selesai'
                          ? 'text-[var(--success)] font-medium'
                          : 'text-[var(--danger)] font-medium'
                      }
                    >
                      {tx.status === 'Selesai' ? 'Lunas' : 'Tempo'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-[var(--danger)] tabular-nums whitespace-nowrap">
                    -{formatRupiahSigned(tx.nominal)}
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {canEdit && tx.status === 'Tertunda' && (
                          <button
                            type="button"
                            title="Tandai pembelian sudah lunas"
                            aria-label={`Lunasi ${tx.judul}`}
                            onClick={() => handleMarkPaid(tx)}
                            className="p-1.5 rounded-[var(--radius-sm)] text-[var(--success)] hover:bg-[var(--success-surface)] cursor-pointer"
                          >
                            <Check className="size-3.5" aria-hidden="true" />
                          </button>
                        )}
                        {canEdit && (
                          <Link
                            to={`/admin/keuangan/pembelian/${tx.id}/edit`}
                            aria-label={`Ubah ${tx.judul}`}
                            className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] inline-flex items-center"
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </Link>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            aria-label={`Hapus ${tx.judul}`}
                            onClick={() => handleDelete(tx)}
                            className="p-1.5 rounded-[var(--radius-sm)] text-[var(--danger)] hover:bg-[var(--danger-surface)] cursor-pointer"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
