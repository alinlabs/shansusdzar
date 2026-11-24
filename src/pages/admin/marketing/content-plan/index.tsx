import { useMemo, useState } from 'react';
import { Calendar, Check, Copy, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Button } from '../../../../components/ui/button';
import { Input, Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { hasPermission } from '../../../../lib/rbac';
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
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const socialPlans = useSiteContentStore((state) => state.socialPlans) ?? [];
  const upsertSocialPlan = useSiteContentStore((state) => state.upsertSocialPlan);
  const deleteSocialPlan = useSiteContentStore((state) => state.deleteSocialPlan);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Content Plan Sosial Media | Marketing Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit =
    hasPermission(currentRole, 'marketing.edit') ||
    hasPermission(currentRole, 'tentang.edit') ||
    hasPermission(currentRole, 'bisnis.edit');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [platformFilter, setPlatformFilter] = useState<'all' | SocialMediaPlatform>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SocialMediaPlanStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
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
    <div className="space-y-6">
      <AdminPageHeader
        title="Content Plan — Sosial Media"
        description="Kalender editorial, hook pembuka, naskah caption, dan jadwal tayang konten Instagram, TikTok, dan Facebook."
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => exportSocialPlansCsv(socialPlans)}
            >
              <Download className="size-3.5" aria-hidden="true" />
              Ekspor Jadwal CSV
            </Button>
            {canEdit && (
              <Link
                to="/admin/marketing/content-plan/baru"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Tambah Rencana Konten
              </Link>
            )}
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <dl className="admin-stat-grid-2x4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Total Rencana Konten</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {metrics.total}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">IG, TikTok &amp; Facebook</dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Siap Upload &amp; Terjadwal</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {metrics.readyOrScheduled}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Antrean tayang terdekat</dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Ide &amp; Produksi</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {metrics.inProduction}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Dalam proses materi</dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Sudah Terbit</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--success)] tabular-nums">
            {metrics.published}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Arsip konten tayang</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
          <Search
            className="size-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <Input
            aria-label="Cari rencana konten"
            placeholder="Cari judul, hook, atau PIC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          aria-label="Filter platform"
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value as 'all' | SocialMediaPlatform)}
          className="w-auto"
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
          className="w-auto"
        >
          <option value="all">Semua Status</option>
          {SOCIAL_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </Select>
      </div>

      {filteredPlans.length === 0 ? (
        <div className="p-8 text-center border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-2">
          <p className="text-sm font-medium text-[var(--text)]">
            Belum ada rencana konten yang sesuai filter.
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Ubah filter pencarian atau buat jadwal konten baru untuk Instagram, TikTok, atau Facebook.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPlans.map((item) => (
            <article
              key={item.id}
              className="p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-col justify-between gap-4"
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

              <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopyCaption(item)}
                >
                  {copiedId === item.id ? (
                    <>
                      <Check className="size-3.5" aria-hidden="true" />
                      Naskah Disalin
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" aria-hidden="true" />
                      Salin Caption
                    </>
                  )}
                </Button>

                {canEdit && (
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/admin/marketing/content-plan/${item.id}/edit`}
                      aria-label={`Edit ${item.judul}`}
                      className="p-2 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] inline-flex items-center"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      aria-label={`Hapus ${item.judul}`}
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
                      className="p-2 rounded-[var(--radius-md)] text-[var(--danger)] hover:bg-[var(--danger-surface)] cursor-pointer"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
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
