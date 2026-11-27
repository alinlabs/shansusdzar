import { useMemo, useState } from 'react';
import { Check, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Input, Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  EXPENSE_CATEGORIES,
  buildFinanceCsv,
  formatRupiahSigned,
  formatShortDateId,
} from '../../../../lib/finance-utils';
import { canEditPage } from '../../../../lib/rbac';
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
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const transactions = useFinanceStore((state) => state.transactions);
  const upsertTransaction = useFinanceStore((state) => state.upsertTransaction);
  const deleteTransaction = useFinanceStore((state) => state.deleteTransaction);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Pembelian Workshop & Material | Keuangan Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'keuangan');
  const canDelete = canEdit;

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
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Pembelian"
        actions={
          <>
            <AdminActionButton
              icon={<Download className="size-3.5" />}
              label="Ekspor CSV"
              onClick={handleExportCsv}
            />
            {canEdit && (
              <AdminActionLink
                to="/admin/keuangan/pembelian/baru"
                variant="primary"
                icon={<Plus className="size-3.5" />}
                label="Catat Pembelian"
              />
            )}
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Purchase Summary Strip */}
      <dl className="admin-stat-grid-2x3 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Pembelian Lunas ({purchaseStats.totalCount})
          </dt>
          <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
            {formatRupiahSigned(purchaseStats.totalCompleted)}
          </dd>
        </div>
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Bahan &amp; Hardware
          </dt>
          <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
            {formatRupiahSigned(purchaseStats.materialSpend)}
          </dd>
        </div>
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0 flex items-center justify-between gap-2 sm:block">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Tertunda / Tempo ({purchaseStats.pendingCount})
          </dt>
          <dd
            className={[
              'sm:mt-0.5 text-sm sm:text-base font-semibold tabular-nums shrink-0',
              purchaseStats.totalPending > 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]',
            ].join(' ')}
          >
            {formatRupiahSigned(purchaseStats.totalPending)}
          </dd>
        </div>
      </dl>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative flex-1 sm:max-w-xs">
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

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5">
          <Select
            aria-label="Filter kategori pembelian"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | FinanceTransactionCategory)}
            className="w-full sm:w-auto px-2.5 sm:px-3.5 text-xs sm:text-sm"
          >
            <option value="all">Semua Kategori</option>
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
            className="w-full sm:w-auto px-2.5 sm:px-3.5 text-xs sm:text-sm"
          >
            <option value="all">Semua Status</option>
            <option value="Selesai">Lunas / Selesai</option>
            <option value="Tertunda">Tempo / Tertunda</option>
          </Select>
        </div>
      </div>

      {/* Mobile Purchase List */}
      <div className="md:hidden space-y-2.5">
        {filteredPurchases.length === 0 ? (
          <div className="p-8 text-center border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] text-xs text-[var(--text-muted)]">
            Tidak ada catatan pembelian yang sesuai filter.
          </div>
        ) : (
          filteredPurchases.map((tx) => (
            <div
              key={tx.id}
              className="p-3.5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                    {formatShortDateId(tx.tanggal)} · {tx.kategori}
                  </p>
                  <p className="text-sm font-semibold text-[var(--text)] truncate">{tx.judul}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    {tx.pihakTerkait}
                    {tx.referensiProyek ? ` · ${tx.referensiProyek}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0 tabular-nums">
                  <p className="text-xs font-semibold text-[var(--danger)]">
                    -{formatRupiahSigned(tx.nominal)}
                  </p>
                  <p
                    className={
                      tx.status === 'Selesai'
                        ? 'text-[11px] font-medium text-[var(--success)]'
                        : 'text-[11px] font-medium text-[var(--danger)]'
                    }
                  >
                    {tx.status === 'Selesai' ? 'Lunas' : 'Tempo'}
                  </p>
                </div>
              </div>

              {(canEdit || canDelete) && (
                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[var(--border)]">
                  {canEdit && tx.status === 'Tertunda' && (
                    <AdminActionButton
                      variant="success"
                      icon={<Check className="size-3.5" />}
                      label={`Lunasi ${tx.judul}`}
                      iconOnly
                      onClick={() => handleMarkPaid(tx)}
                    />
                  )}
                  {canEdit && (
                    <AdminActionLink
                      to={`/admin/keuangan/pembelian/${tx.id}/edit`}
                      icon={<Pencil className="size-3.5" />}
                      label={`Ubah ${tx.judul}`}
                      iconOnly
                    />
                  )}
                  {canDelete && (
                    <AdminActionButton
                      variant="danger"
                      icon={<Trash2 className="size-3.5" />}
                      label={`Hapus ${tx.judul}`}
                      iconOnly
                      onClick={() => handleDelete(tx)}
                    />
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop Purchase Table */}
      <div className="hidden md:block border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-x-auto">
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
                      <div className="inline-flex items-center gap-1.5">
                        {canEdit && tx.status === 'Tertunda' && (
                          <AdminActionButton
                            variant="success"
                            icon={<Check className="size-3.5" />}
                            label={`Lunasi ${tx.judul}`}
                            iconOnly
                            onClick={() => handleMarkPaid(tx)}
                          />
                        )}
                        {canEdit && (
                          <AdminActionLink
                            to={`/admin/keuangan/pembelian/${tx.id}/edit`}
                            icon={<Pencil className="size-3.5" />}
                            label={`Ubah ${tx.judul}`}
                            iconOnly
                          />
                        )}
                        {canDelete && (
                          <AdminActionButton
                            variant="danger"
                            icon={<Trash2 className="size-3.5" />}
                            label={`Hapus ${tx.judul}`}
                            iconOnly
                            onClick={() => handleDelete(tx)}
                          />
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
