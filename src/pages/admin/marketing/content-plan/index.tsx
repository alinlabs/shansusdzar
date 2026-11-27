import { useMemo, useState } from 'react';
import { Calendar, Check, Copy, Download, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type {
  SocialMediaPlanItem,
  SocialMediaPlanStatus,
  SocialMediaPlatform,
} from '../../../../types/cms';
import { AdminPageHeader } from '../../admin-shell';
import {
  SOCIAL_PLATFORMS,
  SOCIAL_STATUSES,
  exportSocialPlansCsv,
} from './logic';

function getStatusTextClass(status: SocialMediaPlanStatus): string {
  if (status === 'Terbit') return 'text-[var(--success)]';
  if (status === 'Terjadwal' || status === 'Siap Upload') return 'text-[var(--text)] font-semibold';
  return 'text-[var(--text-muted)]';
}

export default function AdminSosmedPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const socialPlans = useSiteContentStore((state) => state.socialPlans) ?? [];
  const upsertSocialPlan = useSiteContentStore((state) => state.upsertSocialPlan);
  const deleteSocialPlan = useSiteContentStore((state) => state.deleteSocialPlan);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Content Plan Sosial Media | Marketing Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'profil-usaha');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [platformFilter, setPlatformFilter] = useState<'all' | SocialMediaPlatform>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SocialMediaPlanStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const metrics = useMemo(
    () => ({
      total: socialPlans.length,
      readyOrScheduled: socialPlans.filter(
        (p) => p.status === 'Siap Upload' || p.status === 'Terjadwal'
      ).length,
      inProduction: socialPlans.filter((p) => p.status === 'Ide' || p.status === 'Produksi').length,
      published: socialPlans.filter((p) => p.status === 'Terbit').length,
    }),
    [socialPlans]
  );

  const filteredPlans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return socialPlans.filter((item) => {
      if (platformFilter !== 'all' && item.platform !== platformFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (q) {
        const hay =
          `${item.judul} ${item.kalimatPembuka} ${item.pilar} ${item.takaranKonten} ${item.namaPenanggungJawab}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [socialPlans, platformFilter, statusFilter, searchQuery]);

  const hasCustomFilter = platformFilter !== 'all' || statusFilter !== 'all';
  const hasAnyFilter = searchQuery.trim() !== '' || hasCustomFilter;

  const handleResetFilters = () => {
    setSearchQuery('');
    setPlatformFilter('all');
    setStatusFilter('all');
  };

  const handleCopyCaption = async (item: SocialMediaPlanItem) => {
    const fullText = [item.takaranKonten.trim(), item.tagar.trim()].filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId((prev) => (prev === item.id ? null : prev)), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Content Plan"
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Cari judul, hook, atau PIC...',
          ariaLabel: 'Cari rencana konten',
          onActiveChange: setIsSearchActive,
          hasActiveFilter: hasCustomFilter,
          onResetAll: handleResetFilters,
          filterAriaLabel: 'Filter rencana konten',
          filterTitle: 'Filter Rencana Konten',
          renderFilterContent: (closeFilter) => (
            <>
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Filter Konten
                </p>
                <div className="space-y-2">
                  <Select
                    aria-label="Filter platform"
                    value={platformFilter}
                    onChange={(e) => setPlatformFilter(e.target.value as 'all' | SocialMediaPlatform)}
                    className="px-2.5 text-xs"
                  >
                    <option value="all">Semua Platform</option>
                    {SOCIAL_PLATFORMS.map((pl) => (
                      <option key={pl} value={pl}>
                        {pl}
                      </option>
                    ))}
                  </Select>

                  <Select
                    aria-label="Filter status konten"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | SocialMediaPlanStatus)}
                    className="px-2.5 text-xs"
                  >
                    <option value="all">Semua Status</option>
                    {SOCIAL_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
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
                    setPlatformFilter('all');
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
          <>
            <AdminActionButton
              label="Ekspor Jadwal CSV"
              icon={<Download className="size-3.5" />}
              onClick={() => exportSocialPlansCsv(socialPlans)}
            />
            {canEdit && (
              <AdminActionLink
                to="/admin/marketing/content-plan/baru"
                variant="primary"
                label="Tambah Rencana Konten"
                icon={<Plus className="size-3.5" />}
              />
            )}
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {!isSearchActive && (
        <dl className="admin-stat-grid-2x4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Total Konten
            </dt>
            <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
              {metrics.total}
            </dd>
          </div>
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Siap &amp; Terjadwal
            </dt>
            <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
              {metrics.readyOrScheduled}
            </dd>
          </div>
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Ide &amp; Produksi
            </dt>
            <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
              {metrics.inProduction}
            </dd>
          </div>
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Sudah Terbit
            </dt>
            <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--success)] tabular-nums truncate">
              {metrics.published}
            </dd>
          </div>
        </dl>
      )}

      {filteredPlans.length === 0 ? (
        <div className="p-8 text-center border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--text)]">
              Belum ada rencana konten yang sesuai filter.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Ubah filter pencarian atau buat jadwal konten baru untuk Instagram, TikTok, atau Facebook.
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPlans.map((item) => (
            <article
              key={item.id}
              className="p-4 sm:p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span className="font-semibold text-[var(--text)]">{item.platform}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.format}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Calendar className="size-3" aria-hidden="true" />
                        {item.tanggalTerjadwal} {item.jamTerjadwal}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-[var(--text)] leading-snug">
                      {item.judul}
                    </h3>
                  </div>

                  {canEdit ? (
                    <Select
                      aria-label={`Ubah status ${item.judul}`}
                      value={item.status}
                      onChange={(e) => {
                        const nextStatus = e.target.value as SocialMediaPlanStatus;
                        upsertSocialPlan({ ...item, status: nextStatus });
                        recordActivity(
                          'Memperbarui status konten sosial media',
                          'Sosmed Planning',
                          `${item.judul}: ${nextStatus}`
                        );
                        setFeedback({
                          type: 'ok',
                          text: `Status konten "${item.judul}" diubah menjadi ${nextStatus}.`,
                        });
                      }}
                      className="w-auto min-h-8 text-xs py-1 px-2.5 shrink-0"
                    >
                      {SOCIAL_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <span className={`text-xs shrink-0 ${getStatusTextClass(item.status)}`}>
                      {item.status}
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-1.5">
                  <p className="text-xs font-medium text-[var(--text)]">
                    Hook: <span className="font-normal text-[var(--text-muted)]">{item.kalimatPembuka || '-'}</span>
                  </p>
                  {item.takaranKonten && (
                    <p className="text-xs text-[var(--text-muted)] whitespace-pre-line line-clamp-3">
                      {item.takaranKonten}
                    </p>
                  )}
                  {item.tagar && (
                    <p className="text-[11px] text-[var(--text-subtle)]">{item.tagar}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                  <span>
                    Pilar: <strong className="text-[var(--text)]">{item.pilar}</strong> · PIC:{' '}
                    {item.namaPenanggungJawab}
                  </span>
                  {item.targetAksi && (
                    <span className="font-mono text-[11px]">CTA: {item.targetAksi}</span>
                  )}
                </div>

                {item.catatan && (
                  <p className="text-xs text-[var(--text-subtle)] leading-relaxed">
                    Catatan produksi: {item.catatan}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <AdminActionButton
                  label={copiedId === item.id ? 'Naskah Disalin' : 'Salin Caption'}
                  icon={
                    copiedId === item.id ? (
                      <Check className="size-3.5 text-[var(--success)]" />
                    ) : (
                      <Copy className="size-3.5" />
                    )
                  }
                  onClick={() => handleCopyCaption(item)}
                />

                {canEdit && (
                  <div className="flex items-center gap-1.5">
                    <AdminActionLink
                      to={`/admin/marketing/content-plan/${item.id}/edit`}
                      aria-label={`Edit ${item.judul}`}
                      label="Edit"
                      icon={<Pencil className="size-3.5" />}
                    />
                    <AdminActionButton
                      variant="danger"
                      iconOnly
                      label={`Hapus ${item.judul}`}
                      icon={<Trash2 className="size-3.5" />}
                      onClick={() => {
                        deleteSocialPlan(item.id);
                        recordActivity(
                          'Menghapus rencana konten sosial media',
                          'Sosmed Planning',
                          item.judul
                        );
                        setFeedback({
                          type: 'ok',
                          text: `Rencana konten "${item.judul}" telah dihapus.`,
                        });
                      }}
                    />
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
