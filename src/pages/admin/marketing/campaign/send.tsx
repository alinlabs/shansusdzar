import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  Mail,
  MessageCircle,
  Pencil,
  RotateCcw,
  Save,
  Search,
  SkipForward,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { Checkbox, FormField, Input, Select, Textarea } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useMarketingStore } from '../../../../store/marketing-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { MarketingChannel, MarketingContactSegment } from '../../../../types/marketing';
import { AdminPageHeader } from '../../admin-shell';
import {
  MARKETING_SEGMENTS,
  buildBccMailtoBatches,
  buildEmlDraftContent,
  buildPersonalMailtoUrl,
  buildWhatsAppBroadcastUrl,
  interpolateMarketingTemplate,
} from '../database/logic';
import { resolveCampaignRecipients } from './logic';

type QueueStatus = 'pending' | 'sent' | 'skipped';

const PLACEHOLDER_CHIPS = [
  { token: '{nama}', label: 'Nama' },
  { token: '{kota}', label: 'Kota' },
  { token: '{segmen}', label: 'Segmen' },
  { token: '{perusahaan}', label: 'Perusahaan' },
] as const;

export default function AdminMarketingCampaignSendPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const contacts = useMarketingStore((state) => state.contacts);
  const campaignItems = useMarketingStore((state) => state.campaignItems);
  const markContactsContacted = useMarketingStore((state) => state.markContactsContacted);
  const markCampaignSent = useMarketingStore((state) => state.markCampaignSent);
  const recordCampaignLog = useMarketingStore((state) => state.recordCampaignLog);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'marketing.edit');

  const campaign = useMemo(
    () => campaignItems.find((item) => item.id === id) ?? null,
    [campaignItems, id]
  );

  const initialChannel: MarketingChannel =
    searchParams.get('channel') === 'email'
      ? 'email'
      : campaign?.saluran[0] ?? 'whatsapp';

  const [selectedChannel, setSelectedChannel] = useState<MarketingChannel>(initialChannel);
  const [feedback, setFeedback] = useAdminFeedbackState();

  const [searchQuery, setSearchQuery] = useState('');
  const [segmentScope, setSegmentScope] = useState<'campaign' | 'all' | MarketingContactSegment>(
    'campaign'
  );
  const [onlyNeverContacted, setOnlyNeverContacted] = useState(false);

  const [waDraft, setWaDraft] = useState(
    () =>
      campaign?.pesanWhatsapp ??
      'Halo Bapak/Ibu {nama}, kami dari Interior & Furniture Shansusdzar Indonesia.'
  );
  const [emailSubjectDraft, setEmailSubjectDraft] = useState(
    () => campaign?.subjekEmail ?? 'Penawaran & Katalog Shansusdzar Indonesia'
  );
  const [emailBodyDraft, setEmailBodyDraft] = useState(
    () => campaign?.isiEmail ?? 'Yth. Bapak/Ibu {nama},\n\nBerikut penawaran dari kami.'
  );
  const [replyToDraft, setReplyToDraft] = useState(
    () => campaign?.emailBalasan || currentUser?.email || 'admin@shansusdzar.id'
  );

  const [excludedIds, setExcludedIds] = useState<Record<string, boolean>>({});
  const [queueStatuses, setQueueStatuses] = useState<Record<string, QueueStatus>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [copiedText, setCopiedText] = useState(false);

  useDocumentTitle(
    `${campaign ? `Tools Kirim: ${campaign.judul}` : 'Tools Kirim Campaign'} | Admin ${shortBrandName}`
  );

  const eligibleContacts = useMemo(() => {
    if (!campaign) return [];
    return resolveCampaignRecipients(campaign, contacts, selectedChannel, {
      search: searchQuery,
      segmentOverride: segmentScope,
      onlyNeverContacted,
    });
  }, [campaign, contacts, selectedChannel, searchQuery, segmentScope, onlyNeverContacted]);

  const queueContacts = useMemo(
    () => eligibleContacts.filter((c) => !excludedIds[c.id]),
    [eligibleContacts, excludedIds]
  );

  const safeActiveIndex =
    queueContacts.length === 0 ? 0 : Math.min(activeIndex, queueContacts.length - 1);
  const activeContact = queueContacts[safeActiveIndex] ?? null;

  const queueStats = useMemo(() => {
    let sent = 0;
    let skipped = 0;
    for (const c of queueContacts) {
      const st = queueStatuses[c.id] ?? 'pending';
      if (st === 'sent') sent += 1;
      else if (st === 'skipped') skipped += 1;
    }
    return {
      total: queueContacts.length,
      sent,
      skipped,
      pending: Math.max(0, queueContacts.length - sent - skipped),
    };
  }, [queueContacts, queueStatuses]);

  const activeWaMessage = useMemo(
    () => (activeContact ? interpolateMarketingTemplate(waDraft, activeContact) : ''),
    [activeContact, waDraft]
  );
  const activeWaUrl = useMemo(
    () => (activeContact ? buildWhatsAppBroadcastUrl(activeContact, activeWaMessage) : ''),
    [activeContact, activeWaMessage]
  );

  const activeEmailSubject = useMemo(
    () => (activeContact ? interpolateMarketingTemplate(emailSubjectDraft, activeContact) : ''),
    [activeContact, emailSubjectDraft]
  );
  const activeEmailBody = useMemo(
    () => (activeContact ? interpolateMarketingTemplate(emailBodyDraft, activeContact) : ''),
    [activeContact, emailBodyDraft]
  );
  const activeMailtoUrl = useMemo(
    () =>
      activeContact
        ? buildPersonalMailtoUrl(activeContact.email, activeEmailSubject, activeEmailBody)
        : '',
    [activeContact, activeEmailSubject, activeEmailBody]
  );

  const bccBatches = useMemo(() => {
    const genericSubject = emailSubjectDraft
      .replace(/\{nama\}/gi, 'Bapak/Ibu')
      .replace(/\{kota\}/gi, 'Indonesia')
      .replace(/\{segmen\}/gi, 'Mitra & Klien')
      .replace(/\{perusahaan\}/gi, 'Klien');
    const genericBody = emailBodyDraft
      .replace(/\{nama\}/gi, 'Bapak/Ibu')
      .replace(/\{kota\}/gi, 'wilayah Anda')
      .replace(/\{segmen\}/gi, 'Klien')
      .replace(/\{perusahaan\}/gi, 'Bapak/Ibu');
    return buildBccMailtoBatches(
      queueContacts.map((c) => c.email),
      genericSubject,
      genericBody,
      replyToDraft,
      20
    );
  }, [queueContacts, emailSubjectDraft, emailBodyDraft, replyToDraft]);

  if (!campaign) {
    return (
      <div className="space-y-4 max-w-xl">
        <AdminPageHeader
          title="Campaign Tidak Ditemukan"
          description="Campaign yang Anda pilih tidak tersedia."
        />
        <Link
          to="/admin/marketing/campaign"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Kembali ke Daftar Campaign
        </Link>
      </div>
    );
  }

  const switchChannel = (nextChannel: MarketingChannel) => {
    setSelectedChannel(nextChannel);
    setSearchParams({ channel: nextChannel }, { replace: true });
    setQueueStatuses({});
    setActiveIndex(0);
  };

  const handleMarkStatus = (contactId: string, status: QueueStatus, moveNext: boolean) => {
    const nextStatuses: Record<string, QueueStatus> = {
      ...queueStatuses,
      [contactId]: status,
    };
    setQueueStatuses(nextStatuses);
    if (status === 'sent' && canEdit) {
      markContactsContacted([contactId]);
    }
    if (moveNext && safeActiveIndex + 1 < queueContacts.length) {
      setActiveIndex(safeActiveIndex + 1);
    }
  };

  const handleCopyCurrent = async () => {
    const content =
      selectedChannel === 'whatsapp'
        ? activeWaMessage
        : queueContacts.map((c) => c.email).filter(Boolean).join(', ');
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedText(true);
      window.setTimeout(() => setCopiedText(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleDownloadEml = () => {
    if (queueContacts.length === 0) return;
    const genericSubject = emailSubjectDraft
      .replace(/\{nama\}/gi, 'Bapak/Ibu')
      .replace(/\{kota\}/gi, 'Indonesia')
      .replace(/\{segmen\}/gi, 'Mitra & Klien')
      .replace(/\{perusahaan\}/gi, 'Klien');
    const genericBody = emailBodyDraft
      .replace(/\{nama\}/gi, 'Bapak/Ibu')
      .replace(/\{kota\}/gi, 'wilayah Anda')
      .replace(/\{segmen\}/gi, 'Klien')
      .replace(/\{perusahaan\}/gi, 'Bapak/Ibu');

    const eml = buildEmlDraftContent({
      fromEmail: replyToDraft,
      bccEmails: queueContacts.map((c) => c.email),
      subject: genericSubject,
      body: genericBody,
    });
    const blob = new Blob([eml], { type: 'message/rfc822;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `campaign-${campaign.id}-${new Date().toISOString().slice(0, 10)}.eml`;
    link.click();
    URL.revokeObjectURL(url);
    setFeedback({
      type: 'ok',
      text: `Draf email (.eml) untuk ${queueContacts.length} penerima berhasil diunduh.`,
    });
  };

  const handleSaveBroadcastLog = () => {
    if (!canEdit) return;
    const sentList = queueContacts.filter((c) => queueStatuses[c.id] === 'sent');
    const finalRecipients =
      selectedChannel === 'email' && sentList.length === 0 ? queueContacts : sentList;

    if (finalRecipients.length === 0) {
      setFeedback({
        type: 'err',
        text: 'Tandai minimal satu kontak sebagai Terkirim sebelum menyimpan log sesi.',
      });
      return;
    }

    const summary = finalRecipients
      .slice(0, 4)
      .map((c) => (selectedChannel === 'whatsapp' ? c.nama : c.email))
      .join(', ');
    const suffix =
      finalRecipients.length > 4 ? ` (+${finalRecipients.length - 4} lainnya)` : '';

    markContactsContacted(finalRecipients.map((c) => c.id));
    markCampaignSent(campaign.id, finalRecipients.length);
    recordCampaignLog({
      idKampanye: campaign.id,
      saluran: selectedChannel,
      judul: campaign.judul,
      subjek: selectedChannel === 'email' ? emailSubjectDraft.trim() : undefined,
      jumlahPenerima: finalRecipients.length,
      ringkasanPenerima: `${summary}${suffix}`,
      dikirimOleh: currentUser?.nama || 'Admin',
    });
    recordActivity(
      `Menyimpan log broadcast ${selectedChannel === 'whatsapp' ? 'WhatsApp' : 'Email'}`,
      'Marketing Campaign',
      `${campaign.judul} (${finalRecipients.length} penerima)`
    );
    setFeedback({
      type: 'ok',
      text: `Log broadcast ${selectedChannel === 'whatsapp' ? 'WhatsApp' : 'Email'} untuk ${finalRecipients.length} penerima berhasil dicatat.`,
    });
  };

  const progressPercent =
    queueStats.total > 0
      ? Math.round(((queueStats.sent + queueStats.skipped) / queueStats.total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`Tools Broadcast: ${campaign.judul}`}
        description={`Tujuan: ${campaign.tujuan} · Pilih saluran WhatsApp atau Email untuk menjalankan distribusi pesan ke kontak database.`}
        actions={
          <>
            <Link
              to="/admin/marketing/campaign"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Daftar Campaign
            </Link>
            {canEdit && (
              <Link
                to={`/admin/marketing/campaign/${campaign.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                Ubah Campaign
              </Link>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setQueueStatuses({});
                setActiveIndex(0);
              }}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset Antrean
            </Button>
            {canEdit && (
              <Button type="button" variant="primary" size="sm" onClick={handleSaveBroadcastLog}>
                <Save className="size-3.5" aria-hidden="true" />
                Simpan Log ({queueStats.sent})
              </Button>
            )}
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Channel Switcher (Radio/Group Button Control - No Tablist) */}
      <div className="p-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-[var(--text)]">Pilih Saluran Pengiriman</p>
          <p className="text-xs text-[var(--text-muted)]">
            Jalankan broadcast WhatsApp satu per satu atau bagikan langsung ke Email klien dari campaign ini.
          </p>
        </div>

        <div
          role="group"
          aria-label="Pilih tools saluran broadcast campaign"
          className="inline-flex items-center p-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] shrink-0"
        >
          <button
            type="button"
            aria-pressed={selectedChannel === 'whatsapp'}
            onClick={() => switchChannel('whatsapp')}
            className={[
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--radius-sm)] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
              selectedChannel === 'whatsapp'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]',
            ].join(' ')}
          >
            <MessageCircle className="size-3.5" aria-hidden="true" />
            Broadcast WhatsApp
          </button>
          <button
            type="button"
            aria-pressed={selectedChannel === 'email'}
            onClick={() => switchChannel('email')}
            className={[
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--radius-sm)] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap',
              selectedChannel === 'email'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]',
            ].join(' ')}
          >
            <Mail className="size-3.5" aria-hidden="true" />
            Share ke Email
          </button>
        </div>
      </div>

      {/* Progress Strip */}
      <dl className="grid grid-cols-2 lg:grid-cols-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
        <div className="p-4">
          <dt className="text-xs text-[var(--text-muted)]">Penerima Dipilih</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {queueStats.total}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">
            Dari {eligibleContacts.length} kontak siap
          </dd>
        </div>
        <div className="p-4">
          <dt className="text-xs text-[var(--text-muted)]">Terkirim Sesi Ini</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--success)] tabular-nums">
            {queueStats.sent}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Sudah ditindaklanjuti</dd>
        </div>
        <div className="p-4">
          <dt className="text-xs text-[var(--text-muted)]">Menunggu Kirim</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {queueStats.pending}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">{queueStats.skipped} dilewati</dd>
        </div>
        <div className="p-4">
          <dt className="text-xs text-[var(--text-muted)]">Progres Campaign</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {progressPercent}%
          </dd>
          <dd className="mt-2 h-1.5 rounded-full bg-[var(--surface-muted)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </dd>
        </div>
      </dl>

      {/* Channel Delivery Workspace */}
      {selectedChannel === 'whatsapp' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-6">
            <AdminFormSectionCard
              title="1. Naskah WhatsApp Campaign"
              description="Sesuaikan teks sebelum membuka tautan WhatsApp personal satu per satu."
            >
              <FormField id="send-wa-body" label="Isi Pesan Broadcast WhatsApp">
                <Textarea
                  id="send-wa-body"
                  rows={8}
                  value={waDraft}
                  onChange={(e) => setWaDraft(e.target.value)}
                />
              </FormField>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-[var(--text-muted)] mr-1">Variabel:</span>
                {PLACEHOLDER_CHIPS.map((chip) => (
                  <button
                    key={chip.token}
                    type="button"
                    onClick={() =>
                      setWaDraft((prev) =>
                        `${prev}${prev.endsWith(' ') || prev.endsWith('\n') || !prev ? '' : ' '}${chip.token}`
                      )
                    }
                    className="px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-xs font-mono text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
                  >
                    {chip.token}
                  </button>
                ))}
              </div>
            </AdminFormSectionCard>
          </div>

          <div className="xl:col-span-6">
            <AdminFormSectionCard
              title="2. Kirim WhatsApp Satu per Satu"
              description={
                activeContact
                  ? `Penerima ${safeActiveIndex + 1} dari ${queueContacts.length} kontak antrean.`
                  : 'Belum ada penerima WhatsApp terpilih.'
              }
            >
              {!activeContact ? (
                <p className="text-xs text-[var(--text-muted)]">
                  Sesuaikan filter atau centang penerima pada daftar target di bawah.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] flex flex-wrap items-start justify-between gap-2 text-xs">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {activeContact.nama}
                      </p>
                      <p className="text-[var(--text-muted)]">
                        {activeContact.namaPerusahaan || 'Pribadi'} · {activeContact.kota} ·{' '}
                        <span className="font-mono text-[var(--text)]">
                          +{activeContact.teleponTerstandar}
                        </span>
                      </p>
                    </div>
                    <span className="text-[var(--text-muted)] font-medium">
                      {queueStatuses[activeContact.id] === 'sent'
                        ? 'Terkirim'
                        : queueStatuses[activeContact.id] === 'skipped'
                          ? 'Dilewati'
                          : 'Menunggu'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[var(--text)]">
                        Pratinjau Pesan untuk {activeContact.nama}
                      </p>
                      <button
                        type="button"
                        onClick={handleCopyCurrent}
                        className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                      >
                        <Copy className="size-3.5" aria-hidden="true" />
                        {copiedText ? 'Disalin' : 'Salin Teks'}
                      </button>
                    </div>
                    <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)] whitespace-pre-line max-h-52 overflow-y-auto">
                      {activeWaMessage}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {activeWaUrl && (
                      <a
                        href={activeWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleMarkStatus(activeContact.id, 'sent', false)}
                        className="inline-flex items-center gap-2 px-4 py-2 min-h-10 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-semibold hover:opacity-90"
                      >
                        <MessageCircle className="size-4" aria-hidden="true" />
                        Buka WhatsApp ({activeContact.nama})
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                      </a>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleMarkStatus(activeContact.id, 'sent', true)}
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                      Tandai Terkirim &amp; Lanjut
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleMarkStatus(activeContact.id, 'skipped', true)}
                    >
                      <SkipForward className="size-3.5" aria-hidden="true" />
                      Lewati
                    </Button>
                  </div>
                </div>
              )}
            </AdminFormSectionCard>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-6">
            <AdminFormSectionCard
              title="1. Materi & Subjek Email Campaign"
              description="Sesuaikan subjek, isi pesan, dan alamat Reply-To sebelum dibagikan ke email klien."
            >
              <FormField id="send-email-replyto" label="Email Pengirim / Tujuan BCC">
                <Input
                  id="send-email-replyto"
                  type="email"
                  value={replyToDraft}
                  onChange={(e) => setReplyToDraft(e.target.value)}
                />
              </FormField>
              <FormField id="send-email-subject" label="Subjek Email">
                <Input
                  id="send-email-subject"
                  value={emailSubjectDraft}
                  onChange={(e) => setEmailSubjectDraft(e.target.value)}
                />
              </FormField>
              <FormField id="send-email-body" label="Isi Email">
                <Textarea
                  id="send-email-body"
                  rows={7}
                  value={emailBodyDraft}
                  onChange={(e) => setEmailBodyDraft(e.target.value)}
                />
              </FormField>
            </AdminFormSectionCard>
          </div>

          <div className="xl:col-span-6 space-y-6">
            <AdminFormSectionCard
              title="2A. Share Email Personal Satu per Satu"
              description={
                activeContact
                  ? `Penerima ${safeActiveIndex + 1} dari ${queueContacts.length} kontak terpilih.`
                  : 'Belum ada penerima email yang terpilih.'
              }
            >
              {!activeContact ? (
                <p className="text-xs text-[var(--text-muted)]">
                  Pilih minimal satu kontak dengan alamat email valid pada tabel di bawah.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-semibold text-[var(--text)]">{activeContact.nama}</p>
                      <p className="font-mono text-[var(--text-muted)]">{activeContact.email}</p>
                    </div>
                    <span className="text-[var(--text-muted)]">
                      {activeContact.namaPerusahaan || 'Pribadi'} · {activeContact.kota}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-1 text-xs">
                    <p className="font-semibold text-[var(--text)]">Subjek: {activeEmailSubject}</p>
                    <p className="text-[var(--text-muted)] whitespace-pre-line max-h-36 overflow-y-auto">
                      {activeEmailBody}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {activeMailtoUrl && (
                      <a
                        href={activeMailtoUrl}
                        onClick={() => handleMarkStatus(activeContact.id, 'sent', false)}
                        className="inline-flex items-center gap-2 px-4 py-2 min-h-10 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-semibold hover:opacity-90"
                      >
                        <Mail className="size-4" aria-hidden="true" />
                        Buka Email ({activeContact.nama})
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                      </a>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleMarkStatus(activeContact.id, 'sent', true)}
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                      Tandai Terkirim &amp; Lanjut
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleMarkStatus(activeContact.id, 'skipped', true)}
                    >
                      <SkipForward className="size-3.5" aria-hidden="true" />
                      Lewati
                    </Button>
                  </div>
                </div>
              )}
            </AdminFormSectionCard>

            <AdminFormSectionCard
              title="2B. Share Massal BCC & Ekspor Draf .EML"
              description={`Kirim serentak ke ${queueContacts.length} alamat email terpilih dengan BCC agar privasi tetap terjaga.`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {bccBatches.map((batch) => (
                  <a
                    key={batch.batchNumber}
                    href={batch.mailtoUrl}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
                  >
                    <Mail className="size-3.5" aria-hidden="true" />
                    Buka BCC Batch {batch.batchNumber} ({batch.emails.length})
                  </a>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyCurrent}
                  disabled={queueContacts.length === 0}
                >
                  <Copy className="size-3.5" aria-hidden="true" />
                  {copiedText ? 'Email Disalin' : 'Salin Semua Email'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadEml}
                  disabled={queueContacts.length === 0}
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Unduh .EML
                </Button>
              </div>
            </AdminFormSectionCard>
          </div>
        </div>
      )}

      {/* Audience Selection Table */}
      <AdminFormSectionCard
        title="3. Daftar Target Penerima Campaign"
        description="Secara default mengikuti segmen campaign; Anda dapat memperluas ke seluruh database atau mengecualikan kontak tertentu."
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <Search
              className="size-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <Input
              aria-label="Cari penerima campaign"
              placeholder="Cari nama, perusahaan, kota, kontak..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            aria-label="Filter cakupan segmen"
            value={segmentScope}
            onChange={(e) => {
              setSegmentScope(
                e.target.value as 'campaign' | 'all' | MarketingContactSegment
              );
              setActiveIndex(0);
            }}
            className="w-auto"
          >
            <option value="campaign">
              Segmen Campaign ({campaign.targetSegmen.length > 0 ? campaign.targetSegmen.join(', ') : 'Semua'})
            </option>
            <option value="all">Semua Segmen Database</option>
            {MARKETING_SEGMENTS.map((seg) => (
              <option key={seg} value={seg}>
                {seg}
              </option>
            ))}
          </Select>

          <Checkbox
            id="cmp-only-never"
            label="Hanya yang belum pernah dihubungi"
            checked={onlyNeverContacted}
            onChange={(e) => {
              setOnlyNeverContacted(e.target.checked);
              setActiveIndex(0);
            }}
          />
        </div>

        <div className="border border-[var(--border)] rounded-[var(--radius-md)] overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-[var(--text-muted)]">
                <th className="py-2.5 px-3 font-semibold w-10">Ikut</th>
                <th className="py-2.5 px-3 font-semibold">Nama &amp; Perusahaan</th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                  {selectedChannel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                </th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Kota &amp; Segmen</th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Status</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {eligibleContacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--text-muted)]">
                    Tidak ada kontak database yang memenuhi syarat saluran ini.
                  </td>
                </tr>
              ) : (
                eligibleContacts.map((contact) => {
                  const included = !excludedIds[contact.id];
                  const queuePos = queueContacts.findIndex((q) => q.id === contact.id);
                  const isActiveRow = activeContact?.id === contact.id;
                  const status = queueStatuses[contact.id] ?? 'pending';
                  const directHref =
                    selectedChannel === 'whatsapp'
                      ? buildWhatsAppBroadcastUrl(
                          contact,
                          interpolateMarketingTemplate(waDraft, contact)
                        )
                      : buildPersonalMailtoUrl(
                          contact.email,
                          interpolateMarketingTemplate(emailSubjectDraft, contact),
                          interpolateMarketingTemplate(emailBodyDraft, contact)
                        );

                  return (
                    <tr
                      key={contact.id}
                      className={
                        isActiveRow
                          ? 'bg-[var(--surface-muted)]/60'
                          : 'hover:bg-[var(--surface-muted)]/30'
                      }
                    >
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          aria-label={`Sertakan ${contact.nama}`}
                          checked={included}
                          onChange={(e) => {
                            const nextChecked = e.target.checked;
                            setExcludedIds((prev) => ({
                              ...prev,
                              [contact.id]: !nextChecked,
                            }));
                          }}
                          className="size-4 accent-[var(--accent)] cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-[var(--text)]">{contact.nama}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {contact.namaPerusahaan || 'Pribadi'}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[var(--text)] whitespace-nowrap">
                        {selectedChannel === 'whatsapp'
                          ? `+${contact.teleponTerstandar}`
                          : contact.email}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-muted)] whitespace-nowrap">
                        {contact.kota} · {contact.segmen}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {!included ? (
                          <span className="text-[var(--text-subtle)]">Dikecualikan</span>
                        ) : status === 'sent' ? (
                          <span className="text-[var(--success)] font-medium">Terkirim</span>
                        ) : status === 'skipped' ? (
                          <span className="text-[var(--text-muted)]">Dilewati</span>
                        ) : (
                          <span className="text-[var(--text)]">Menunggu</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {included && queuePos >= 0 && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setActiveIndex(queuePos)}
                            >
                              Fokuskan
                            </Button>
                          )}
                          {included && directHref && (
                            <a
                              href={directHref}
                              target={selectedChannel === 'whatsapp' ? '_blank' : undefined}
                              rel={
                                selectedChannel === 'whatsapp' ? 'noopener noreferrer' : undefined
                              }
                              onClick={() => handleMarkStatus(contact.id, 'sent', false)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
                            >
                              {selectedChannel === 'whatsapp' ? 'Kirim WA' : 'Kirim Email'}
                              <ExternalLink className="size-3" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminFormSectionCard>
    </div>
  );
}
