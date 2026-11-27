import { useMemo, useState } from 'react';
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { filterAdminFaqs, type PublishStatusFilter } from '../../../../lib/admin-header-search';
import { canEditPage, canViewPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminFaqPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const faqs = useSiteContentStore((state) => state.faqs);
  const deleteFaq = useSiteContentStore((state) => state.deleteFaq);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Pusat FAQ | Informasi Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'faq');
  const canViewFinance = canViewPage(currentUser, 'keuangan');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [statusFilter, setStatusFilter] = useState<PublishStatusFilter>('all');
  const [isSearchActive, setIsSearchActive] = useState(false);

  const categories = useMemo(() => {
    const set = new Set(faqs.map((f) => f.kategori).filter(Boolean));
    return ['Semua', ...Array.from(set)];
  }, [faqs]);

  const filteredFaqs = useMemo(
    () =>
      filterAdminFaqs(faqs, {
        search: searchQuery,
        category: categoryFilter,
        status: statusFilter,
      }),
    [faqs, searchQuery, categoryFilter, statusFilter]
  );

  const hasCustomFilter = categoryFilter !== 'Semua' || statusFilter !== 'all';
  const hasAnyFilter = searchQuery.trim() !== '' || hasCustomFilter;

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('Semua');
    setStatusFilter('all');
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="FAQ"
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Cari pertanyaan, jawaban, atau kategori FAQ...',
          ariaLabel: 'Cari FAQ',
          onActiveChange: setIsSearchActive,
          hasActiveFilter: hasCustomFilter,
          onResetAll: handleResetFilters,
          filterAriaLabel: 'Filter FAQ',
          filterTitle: 'Filter FAQ',
          renderFilterContent: (closeFilter) => (
            <>
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Filter FAQ
                </p>
                <div className="space-y-2">
                  <Select
                    aria-label="Filter status FAQ"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as PublishStatusFilter)}
                    className="px-2.5 text-xs"
                  >
                    <option value="all">Semua Status</option>
                    <option value="terbit">Terbit</option>
                    <option value="draft">Draft</option>
                  </Select>
                  <Select
                    aria-label="Filter kategori FAQ"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-2.5 text-xs"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat === 'Semua' ? 'Semua Kategori' : cat}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!hasCustomFilter}
                  onClick={() => {
                    setCategoryFilter('Semua');
                    setStatusFilter('all');
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
        }}
        actions={
          canEdit ? (
            <AdminActionLink
              to="/admin/informasi/faq/baru"
              variant="primary"
              label="Tambah FAQ"
              icon={<Plus className="size-3.5" />}
            />
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {!isSearchActive && canViewFinance && (
        <div className="p-3.5 sm:p-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-md)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 text-xs">
          <p className="text-[var(--text-muted)]">
            Rincian DP &amp; termin di <strong className="text-[var(--text)]">/faq</strong> otomatis mengikuti Skema Pembayaran.
          </p>
          <Link
            to="/admin/keuangan?tab=skema"
            className="inline-flex items-center justify-center px-3 py-1.5 min-h-9 sm:min-h-8 rounded-[var(--radius-sm)] border border-[var(--border)] font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            Atur Skema Pembayaran
          </Link>
        </div>
      )}

      <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y divide-[var(--border)]">
        {filteredFaqs.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-xs text-[var(--text-muted)]">
              {faqs.length === 0
                ? 'Belum ada entri FAQ terdaftar.'
                : 'Tidak ada entri FAQ yang cocok dengan pencarian.'}
            </p>
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
          filteredFaqs.map((faq) => (
            <div
              key={faq.id}
              className="p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
            >
              <div className="space-y-1 min-w-0">
                <p className="text-[11px] sm:text-xs text-[var(--text-muted)]">
                  #{faq.urutan} · {faq.kategori} · {faq.terbit ? 'Terbit' : 'Draft'}
                </p>
                <p className="text-sm font-semibold text-[var(--text)]">{faq.pertanyaan}</p>
                <p className="text-xs text-[var(--text-muted)] line-clamp-2">{faq.jawaban}</p>
              </div>
              {canEdit && (
                <div className="flex items-center justify-end gap-1.5 shrink-0">
                  <AdminActionLink
                    to={`/admin/informasi/faq/${faq.id}/edit`}
                    aria-label={`Edit FAQ ${faq.pertanyaan}`}
                    label="Edit"
                    icon={<Pencil className="size-3.5" />}
                  />
                  <AdminActionButton
                    variant="danger"
                    iconOnly
                    label={`Hapus FAQ ${faq.pertanyaan}`}
                    icon={<Trash2 className="size-3.5" />}
                    onClick={() => {
                      deleteFaq(faq.id);
                      recordActivity('Menghapus entri FAQ', 'Informasi', faq.pertanyaan.slice(0, 40));
                      setFeedback({
                        type: 'ok',
                        text: 'Pertanyaan FAQ telah dihapus.',
                      });
                    }}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
