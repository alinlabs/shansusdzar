import { useMemo, useState } from 'react';
import {
  Database,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
import { Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatShortDateId } from '../../../../lib/finance-utils';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useMarketingStore } from '../../../../store/marketing-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { MarketingCampaign, MarketingCampaignStatus } from '../../../../types/marketing';
import { AdminPageHeader } from '../../admin-shell';
import { CAMPAIGN_STATUSES, resolveCampaignRecipients } from './logic';

function getStatusTextClass(status: MarketingCampaignStatus): string {
  if (status === 'Aktif') return 'text-[var(--success)] font-semibold';
  if (status === 'Selesai') return 'text-[var(--text)] font-semibold';
  return 'text-[var(--text-muted)]';
}

export default function AdminMarketingCampaignPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const contacts = useMarketingStore((state) => state.contacts);
  const campaignItems = useMarketingStore((state) => state.campaignItems);
  const campaignsLog = useMarketingStore((state) => state.campaigns);
  const deleteCampaignItem = useMarketingStore((state) => state.deleteCampaignItem);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Campaign Marketing | Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'profil-usaha');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MarketingCampaignStatus>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'email'>('all');
  const [isSearchActive, setIsSearchActive] = useState(false);

  const metrics = useMemo(() => {
    const activeCount = campaignItems.filter((c) => c.status === 'Aktif').length;
    const totalSent = campaignItems.reduce((acc, c) => acc + c.jumlahTerkirim, 0);
    const totalLogs = campaignsLog.length;
    return {
      total: campaignItems.length,
      activeCount,
      totalSent,
      totalLogs,
    };
  }, [campaignItems, campaignsLog]);

  const filteredCampaigns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return campaignItems.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (channelFilter !== 'all' && !item.saluran.includes(channelFilter)) return false;
      if (q) {
        const hay = `${item.judul} ${item.tujuan} ${item.targetSegmen.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [campaignItems, searchQuery, statusFilter, channelFilter]);

  const hasCustomFilter = statusFilter !== 'all' || channelFilter !== 'all';
  const hasAnyFilter = searchQuery.trim() !== '' || hasCustomFilter;

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setChannelFilter('all');
  };

  const handleDelete = (item: MarketingCampaign) => {
    if (!canEdit) return;
    deleteCampaignItem(item.id);
    recordActivity('Menghapus campaign marketing', 'Marketing Campaign', item.judul);
    setFeedback({
      type: 'ok',
      text: `Campaign "${item.judul}" telah dihapus.`,
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Campaign"
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Cari judul, tujuan, atau segmen...',
          ariaLabel: 'Cari campaign marketing',
          onActiveChange: setIsSearchActive,
          hasActiveFilter: hasCustomFilter,
          onResetAll: handleResetFilters,
          filterAriaLabel: 'Filter campaign marketing',
          filterTitle: 'Filter Campaign',
          renderFilterContent: (closeFilter) => (
            <>
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Filter Campaign
                </p>
                <div className="space-y-2">
                  <Select
                    aria-label="Filter status campaign"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | MarketingCampaignStatus)}
                    className="px-2.5 text-xs"
                  >
                    <option value="all">Semua Status</option>
                    {CAMPAIGN_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </Select>

                  <Select
                    aria-label="Filter saluran campaign"
                    value={channelFilter}
                    onChange={(e) => setChannelFilter(e.target.value as 'all' | 'whatsapp' | 'email')}
                    className="px-2.5 text-xs"
                  >
                    <option value="all">Semua Saluran</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                  </Select>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!hasCustomFilter}
                  onClick={() => {
                    setStatusFilter('all');
                    setChannelFilter('all');
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
            <AdminActionLink
              to="/admin/marketing/database"
              label={`Database (${contacts.length})`}
              icon={<Database className="size-3.5 text-[var(--text-muted)]" />}
            />
            {canEdit && (
              <AdminActionLink
                to="/admin/marketing/campaign/baru"
                variant="primary"
                label="Buat Campaign Baru"
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
              Total Campaign
            </dt>
            <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
              {metrics.total}
            </dd>
          </div>
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Campaign Aktif
            </dt>
            <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--success)] tabular-nums truncate">
              {metrics.activeCount}
            </dd>
          </div>
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Pesan Terkirim
            </dt>
            <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
              {metrics.totalSent}
            </dd>
          </div>
          <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
            <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
              Sesi Broadcast
            </dt>
            <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
              {metrics.totalLogs}
            </dd>
          </div>
        </dl>
      )}

      {/* Campaign List */}
      {filteredCampaigns.length === 0 ? (
        <div className="p-8 text-center border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--text)]">
              Belum ada campaign yang sesuai filter pencarian.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Buat campaign baru untuk menyiapkan materi pesan dan target audiens broadcast WA maupun Email.
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
          {filteredCampaigns.map((item) => {
            const waTargets = item.saluran.includes('whatsapp')
              ? resolveCampaignRecipients(item, contacts, 'whatsapp').length
              : 0;
            const emailTargets = item.saluran.includes('email')
              ? resolveCampaignRecipients(item, contacts, 'email').length
              : 0;
            const defaultChannel = item.saluran[0] ?? 'whatsapp';

            return (
              <article
                key={item.id}
                className="p-4 sm:p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">{item.tujuan}</p>
                      <h2 className="text-base font-semibold text-[var(--text)] leading-snug">
                        {item.judul}
                      </h2>
                    </div>
                    <span className={`text-xs shrink-0 ${getStatusTextClass(item.status)}`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-1.5 text-xs">
                    <p className="text-[var(--text-muted)]">
                      Target Segmen:{' '}
                      <span className="font-medium text-[var(--text)]">
                        {item.targetSegmen.length > 0
                          ? item.targetSegmen.join(', ')
                          : 'Semua Segmen Database'}
                      </span>
                    </p>
                    <p className="text-[var(--text-muted)] tabular-nums">
                      Estimasi Target:{' '}
                      <strong className="text-[var(--text)]">{waTargets} WA</strong>
                      {' · '}
                      <strong className="text-[var(--text)]">{emailTargets} Email</strong>
                      {' · '}
                      Terkirim <strong className="text-[var(--success)]">{item.jumlahTerkirim}x</strong>
                    </p>
                    {item.terakhirDikirim && (
                      <p className="text-[11px] text-[var(--text-subtle)] tabular-nums">
                        Broadcast terakhir: {formatShortDateId(item.terakhirDikirim.slice(0, 10))}
                      </p>
                    )}
                  </div>

                  {item.pesanWhatsapp && item.saluran.includes('whatsapp') && (
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                      WA: {item.pesanWhatsapp}
                    </p>
                  )}
                  {item.subjekEmail && item.saluran.includes('email') && (
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      Subjek Email: <span className="text-[var(--text)]">{item.subjekEmail}</span>
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.saluran.includes('whatsapp') && (
                      <AdminActionLink
                        to={`/admin/marketing/campaign/${item.id}/kirim?channel=whatsapp`}
                        variant="primary"
                        label="Tools WA"
                        mobileLabel="WA"
                        icon={<MessageCircle className="size-3.5" />}
                      />
                    )}
                    {item.saluran.includes('email') && (
                      <AdminActionLink
                        to={`/admin/marketing/campaign/${item.id}/kirim?channel=email`}
                        label="Tools Email"
                        mobileLabel="Email"
                        icon={<Mail className="size-3.5" />}
                      />
                    )}
                    {item.saluran.length === 0 && (
                      <AdminActionLink
                        to={`/admin/marketing/campaign/${item.id}/kirim?channel=${defaultChannel}`}
                        label="Buka Tools Kirim"
                        mobileLabel="Kirim"
                        icon={<Send className="size-3.5" />}
                      />
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1.5">
                      <AdminActionLink
                        to={`/admin/marketing/campaign/${item.id}/edit`}
                        aria-label={`Edit campaign ${item.judul}`}
                        label="Edit"
                        icon={<Pencil className="size-3.5" />}
                      />
                      <AdminActionButton
                        variant="danger"
                        iconOnly
                        label={`Hapus campaign ${item.judul}`}
                        icon={<Trash2 className="size-3.5" />}
                        onClick={() => handleDelete(item)}
                      />
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Campaign Execution History */}
      {!isSearchActive && campaignsLog.length > 0 && (
        <AdminFormSectionCard title="Riwayat Kirim">
          <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius-md)]">
            {campaignsLog.slice(0, 8).map((log) => (
              <div
                key={log.id}
                className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="font-semibold text-[var(--text)]">
                    [{log.saluran === 'whatsapp' ? 'WhatsApp' : 'Email'}] {log.judul}
                  </p>
                  <p className="text-[var(--text-muted)] truncate">
                    Penerima ({log.jumlahPenerima}): {log.ringkasanPenerima}
                  </p>
                </div>
                <div className="text-right text-[var(--text-subtle)] shrink-0 tabular-nums">
                  <p>{formatShortDateId(log.waktuKirim.slice(0, 10))}</p>
                  <p>Oleh {log.dikirimOleh}</p>
                </div>
              </div>
            ))}
          </div>
        </AdminFormSectionCard>
      )}
    </div>
  );
}
