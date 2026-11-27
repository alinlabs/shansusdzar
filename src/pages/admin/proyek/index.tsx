import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  FolderKanban,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { Link } from 'react-router';
import {
  AdminActionButton,
  AdminActionLink,
} from '../../../components/admin/admin-action-buttons';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import { formatRupiahSigned, formatShortDateId } from '../../../lib/finance-utils';
import {
  PROJECT_STATUSES,
  type ProjectSortKey,
  buildProjectWorkspaceData,
  computeProjectStatusCounts,
  computeProjectsDirectoryOverview,
  filterProjectWorkspaceRows,
  formatProjectCardCity,
  sortProjectWorkspaceRows,
} from '../../../lib/project-workspace';
import { canEditPage } from '../../../lib/rbac';
import { useAdminAuthStore } from '../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../store/documents-store';
import { useFinanceStore } from '../../../store/finance-store';
import { useProjectsStore } from '../../../store/projects-store';
import { useSiteContentStore } from '../../../store/site-content-store';
import type { WorkshopProjectStatus } from '../../../types/finance';
import { AdminPageHeader } from '../admin-shell';

const SORT_OPTIONS: ReadonlyArray<{ value: ProjectSortKey; label: string }> = [
  { value: 'target_asc', label: 'Prioritas & Target Terdekat' },
  { value: 'remaining_desc', label: 'Sisa Tagihan Terbesar' },
  { value: 'contract_desc', label: 'Nilai Kontrak Tertinggi' },
  { value: 'margin_desc', label: 'Margin Tertinggi' },
  { value: 'recent', label: 'Terbaru Dibuat' },
];

export default function AdminProyekDirectoryPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const paymentScheme = useSiteContentStore((state) => state.paymentScheme);

  const projects = useProjectsStore((state) => state.projects);

  const quotations = useDocumentsStore((state) => state.quotations);
  const agreements = useDocumentsStore((state) => state.agreements);
  const workOrders = useDocumentsStore((state) => state.workOrders);
  const deliveryOrders = useDocumentsStore((state) => state.deliveryOrders);
  const handoverCertificates = useDocumentsStore((state) => state.handoverCertificates);

  const invoices = useFinanceStore((state) => state.invoices);
  const transactions = useFinanceStore((state) => state.transactions);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);

  useDocumentTitle(`Proyek | Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'proyek');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WorkshopProjectStatus>('all');
  const [sortBy, setSortBy] = useState<ProjectSortKey>('target_asc');
  const [isSearchActive, setIsSearchActive] = useState(false);

  const workspaceRows = useMemo(
    () =>
      projects.map((project) =>
        buildProjectWorkspaceData(project, {
          quotations,
          agreements,
          workOrders,
          deliveryOrders,
          handoverCertificates,
          invoices,
          transactions,
          paymentScheme,
        })
      ),
    [
      projects,
      quotations,
      agreements,
      workOrders,
      deliveryOrders,
      handoverCertificates,
      invoices,
      transactions,
      paymentScheme,
    ]
  );

  const statusCounts = useMemo(
    () => computeProjectStatusCounts(workspaceRows),
    [workspaceRows]
  );

  const visibleRows = useMemo(() => {
    const filtered = filterProjectWorkspaceRows(workspaceRows, searchQuery, statusFilter);
    return sortProjectWorkspaceRows(filtered, sortBy);
  }, [workspaceRows, searchQuery, statusFilter, sortBy]);

  const overview = useMemo(
    () => computeProjectsDirectoryOverview(workspaceRows, transactions),
    [workspaceRows, transactions]
  );

  const collectionPercent =
    overview.totalContractValue > 0
      ? Math.min(100, Math.round((overview.totalIncome / overview.totalContractValue) * 100))
      : 0;

  const hasCustomFilterOrSort = statusFilter !== 'all' || sortBy !== 'target_asc';
  const hasAnyFilter = searchQuery.trim() !== '' || hasCustomFilterOrSort;

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSortBy('target_asc');
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Proyek"
        description="Kelola progres, dokumen resmi, dan arus keuangan tiap proyek pengerjaan."
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Cari nama proyek, klien, lokasi, atau nomor dokumen...',
          ariaLabel: 'Cari proyek, klien, lokasi, atau dokumen',
          onActiveChange: setIsSearchActive,
          hasActiveFilter: hasCustomFilterOrSort,
          onResetAll: handleResetFilters,
          filterAriaLabel: 'Filter tahap dan urutkan proyek',
          filterTitle: 'Menu filter dan urutan proyek',
          renderFilterContent: (closeFilter) => (
            <>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Tahap Proyek
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { value: 'all', label: 'Semua' },
                      ...PROJECT_STATUSES.map((st) => ({ value: st, label: st })),
                    ] as const
                  ).map((item) => {
                    const active = statusFilter === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setStatusFilter(item.value)}
                        className={[
                          'flex items-center justify-between gap-2 px-2.5 py-2 rounded-[var(--radius-sm)] text-xs font-medium cursor-pointer transition-colors tabular-nums',
                          active
                            ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold'
                            : 'border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--surface-muted)]',
                        ].join(' ')}
                      >
                        <span className="truncate">{item.label}</span>
                        <span className={active ? 'opacity-80' : 'text-[var(--text-muted)]'}>
                          {statusCounts[item.value]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border)] space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Urutkan Berdasarkan
                </p>
                <div className="space-y-1">
                  {SORT_OPTIONS.map((opt) => {
                    const active = sortBy === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSortBy(opt.value)}
                        className={[
                          'w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-[var(--radius-sm)] text-xs cursor-pointer transition-colors text-left',
                          active
                            ? 'bg-[var(--surface-muted)] text-[var(--text)] font-semibold'
                            : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]/60',
                        ].join(' ')}
                      >
                        <span>{opt.label}</span>
                        {active && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!hasCustomFilterOrSort}
                  onClick={() => {
                    setStatusFilter('all');
                    setSortBy('target_asc');
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
              to="/admin/proyek/baru"
              variant="primary"
              icon={<Plus className="size-3.5" />}
              label="Buat Proyek"
              mobileLabel="Proyek"
            />
          ) : undefined
        }
      />

      {!isSearchActive && (
        <dl className="admin-stat-grid-1x2x4 admin-stat-grid-1x2x4-lg border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
          <div className="px-3.5 py-3 sm:px-4 min-w-0">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Nilai Kontrak ({overview.totalProjects} Proyek)
            </dt>
            <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
              {formatRupiahSigned(overview.totalContractValue)}
            </dd>
          </div>

          <div className="px-3.5 py-3 sm:px-4 min-w-0">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Pembayaran Masuk ({collectionPercent}%)
            </dt>
            <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--success)] tabular-nums truncate">
              {formatRupiahSigned(overview.totalIncome)}
            </dd>
          </div>

          <div className="px-3.5 py-3 sm:px-4 min-w-0">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Sisa Tagihan Termin
            </dt>
            <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
              {formatRupiahSigned(overview.totalRemainingBill)}
            </dd>
          </div>

          <div className="px-3.5 py-3 sm:px-4 min-w-0">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Margin Bersih Proyek
            </dt>
            <dd
              className={[
                'mt-0.5 text-sm sm:text-base font-semibold tabular-nums truncate',
                overview.netMargin >= 0 ? 'text-[var(--text)]' : 'text-[var(--danger)]',
              ].join(' ')}
            >
              {formatRupiahSigned(overview.netMargin)}
            </dd>
          </div>
        </dl>
      )}

      {/* Empty State */}
      {visibleRows.length === 0 ? (
        <div className="p-8 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] text-center space-y-3">
          <FolderKanban
            className="size-8 text-[var(--text-muted)] mx-auto"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--text)]">
              Tidak ada proyek yang cocok
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Ubah kata kunci pencarian atau pilih tahap lain pada menu filter.
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleRows.map((row) => {
            const { project, summary } = row;

            return (
              <Link
                key={project.id}
                to={`/admin/proyek/${project.id}`}
                aria-label={`Buka proyek ${project.namaKlien}`}
                className="group block p-4 sm:p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] transition-colors space-y-3.5"
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 flex-1 text-base font-semibold text-[var(--text)] leading-snug truncate">
                      {project.namaKlien}
                    </h2>

                    <span
                      aria-hidden="true"
                      className="shrink-0 p-1 rounded-[var(--radius-sm)] text-[var(--text-muted)] group-hover:text-[var(--text)] group-hover:bg-[var(--surface-muted)] transition-colors"
                    >
                      <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-3 text-xs font-normal text-[var(--text-muted)]">
                    <p className="min-w-0 truncate">{formatProjectCardCity(project)}</p>
                    <span className="shrink-0 font-normal text-[var(--text-muted)]">
                      {project.status}
                    </span>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-2.5 tabular-nums text-center">
                  <div className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] min-w-0">
                    <dt className="text-[11px] text-[var(--text-muted)] truncate">
                      Tanggal Mulai
                    </dt>
                    <dd className="mt-0.5 text-xs font-semibold text-[var(--text)] truncate">
                      {formatShortDateId(project.tanggalMulai)}
                    </dd>
                  </div>
                  <div className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] min-w-0">
                    <dt className="text-[11px] text-[var(--text-muted)] truncate">
                      Target Selesai
                    </dt>
                    <dd className="mt-0.5 text-xs font-semibold text-[var(--text)] truncate">
                      {formatShortDateId(project.tanggalTargetSelesai)}
                    </dd>
                  </div>
                </dl>

                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs tabular-nums text-center">
                  <div className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] min-w-0">
                    <dt className="text-[11px] text-[var(--text-muted)] truncate">Kontrak</dt>
                    <dd className="mt-0.5 font-semibold text-[var(--text)] truncate">
                      {formatRupiahSigned(summary.contractValue)}
                    </dd>
                  </div>
                  <div className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] min-w-0">
                    <dt className="text-[11px] text-[var(--text-muted)] truncate">Masuk</dt>
                    <dd className="mt-0.5 font-semibold text-[var(--success)] truncate">
                      {formatRupiahSigned(summary.paidAmount)}
                    </dd>
                  </div>
                  <div className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] min-w-0">
                    <dt className="text-[11px] text-[var(--text-muted)] truncate">Belanja</dt>
                    <dd className="mt-0.5 font-semibold text-[var(--danger)] truncate">
                      {formatRupiahSigned(summary.expenseTotal)}
                    </dd>
                  </div>
                  <div className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] min-w-0">
                    <dt className="text-[11px] text-[var(--text-muted)] truncate">Margin</dt>
                    <dd
                      className={[
                        'mt-0.5 font-semibold truncate',
                        summary.netMargin >= 0 ? 'text-[var(--text)]' : 'text-[var(--danger)]',
                      ].join(' ')}
                    >
                      {formatRupiahSigned(summary.netMargin)}
                    </dd>
                  </div>
                </dl>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
