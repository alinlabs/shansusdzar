import { useMemo, useState } from 'react';
import {
  Database,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
import { Input, Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatShortDateId } from '../../../../lib/finance-utils';
import { hasPermission } from '../../../../lib/rbac';
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
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const contacts = useMarketingStore((state) => state.contacts);
  const campaignItems = useMarketingStore((state) => state.campaignItems);
  const campaignsLog = useMarketingStore((state) => state.campaigns);
  const deleteCampaignItem = useMarketingStore((state) => state.deleteCampaignItem);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Campaign Marketing | Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'marketing.edit');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MarketingCampaignStatus>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'email'>('all');

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
    <div className="space-y-6">
      <AdminPageHeader
        title="Daftar Campaign & Tools Broadcast"
        description="Buat daftar campaign promosi maupun follow up, lalu jalankan tools broadcast ke WhatsApp atau Email sesuai kebutuhan."
        actions={
          <>
            <Link
              to="/admin/marketing/database"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
            >
              <Database className="size-3.5" aria-hidden="true" />
              Database ({contacts.length})
            </Link>
            {canEdit && (
              <Link
                to="/admin/marketing/campaign/baru"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Buat Campaign Baru
              </Link>
            )}
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Summary Metrics */}
      <dl className="grid grid-cols-2 lg:grid-cols-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Total Campaign</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {metrics.total}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Draf, aktif &amp; selesai</dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Campaign Aktif</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--success)] tabular-nums">
            {metrics.activeCount}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Siap dijalankan tim admin</dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Total Pesan Terkirim</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {metrics.totalSent}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Akumulasi WA &amp; Email</dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Sesi Broadcast Tercatat</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {metrics.totalLogs}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Riwayat pengiriman log</dd>
        </div>
      </dl>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
          <Search
            className="size-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <Input
            aria-label="Cari campaign marketing"
            placeholder="Cari judul, tujuan, atau segmen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          aria-label="Filter status campaign"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | MarketingCampaignStatus)}
          className="w-auto"
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
          className="w-auto"
        >
          <option value="all">Semua Saluran</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
        </Select>
      </div>

      {/* Campaign List */}
      {filteredCampaigns.length === 0 ? (
        <div className="p-8 text-center border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-2">
          <p className="text-sm font-medium text-[var(--text)]">
            Belum ada campaign yang sesuai filter pencarian.
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Buat campaign baru untuk menyiapkan materi pesan dan target audiens broadcast WA maupun Email.
          </p>
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
                className="p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-col justify-between gap-4"
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
                      <Link
                        to={`/admin/marketing/campaign/${item.id}/kirim?channel=whatsapp`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-8 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
                      >
                        <MessageCircle className="size-3.5" aria-hidden="true" />
                        Tools WA
                      </Link>
                    )}
                    {item.saluran.includes('email') && (
                      <Link
                        to={`/admin/marketing/campaign/${item.id}/kirim?channel=email`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
                      >
                        <Mail className="size-3.5" aria-hidden="true" />
                        Tools Email
                      </Link>
                    )}
                    {item.saluran.length === 0 && (
                      <Link
                        to={`/admin/marketing/campaign/${item.id}/kirim?channel=${defaultChannel}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
                      >
                        <Send className="size-3.5" aria-hidden="true" />
                        Buka Tools Kirim
                      </Link>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <Link
                        to={`/admin/marketing/campaign/${item.id}/edit`}
                        aria-label={`Edit campaign ${item.judul}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Edit
                      </Link>
                      <button
                        type="button"
                        aria-label={`Hapus campaign ${item.judul}`}
                        onClick={() => handleDelete(item)}
                        className="p-2 rounded-[var(--radius-sm)] border border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger)] cursor-pointer"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Campaign Execution History */}
      {campaignsLog.length > 0 && (
        <AdminFormSectionCard
          title="Riwayat Pengiriman Campaign Terakhir"
          description="Log eksekusi broadcast WhatsApp dan Email yang tersimpan dari halaman tools pengiriman."
        >
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
