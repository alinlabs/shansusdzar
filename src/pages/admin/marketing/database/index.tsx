import { useMemo, useState, type ChangeEvent } from 'react';
import {
  Database,
  Download,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { Input, Select, Textarea } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatShortDateId } from '../../../../lib/finance-utils';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useFinanceStore } from '../../../../store/finance-store';
import { useMarketingStore } from '../../../../store/marketing-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type {
  MarketingContact,
  MarketingContactSegment,
  MarketingContactSource,
} from '../../../../types/marketing';
import { AdminPageHeader } from '../../admin-shell';
import {
  MARKETING_SEGMENTS,
  MARKETING_SOURCES,
  buildMarketingContactsCsv,
  buildWhatsAppBroadcastUrl,
  filterMarketingContacts,
  isValidEmailAddress,
  isValidWhatsAppDigits,
  parseCsvContactsInput,
  syncContactsFromWorkshopRecords,
} from './logic';

export default function AdminMarketingDatabasePage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const contacts = useMarketingStore((state) => state.contacts);
  const importContacts = useMarketingStore((state) => state.importContacts);
  const deleteContact = useMarketingStore((state) => state.deleteContact);

  const invoices = useFinanceStore((state) => state.invoices);
  const agreements = useDocumentsStore((state) => state.agreements);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Database Kontak Marketing | Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'marketing.edit');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<'all' | MarketingContactSegment>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | MarketingContactSource>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'wa' | 'email'>('all');
  const [showImporter, setShowImporter] = useState(false);
  const [csvImportText, setCsvImportText] = useState('');

  const metrics = useMemo(() => {
    const waReady = contacts.filter(
      (c) => c.izinWhatsapp && isValidWhatsAppDigits(c.teleponTerstandar)
    ).length;
    const emailReady = contacts.filter(
      (c) => c.izinEmail && isValidEmailAddress(c.email)
    ).length;
    const hotOrActive = contacts.filter(
      (c) => c.segmen === 'Prospek Baru' || c.segmen === 'Klien Aktif'
    ).length;
    return {
      total: contacts.length,
      waReady,
      emailReady,
      hotOrActive,
    };
  }, [contacts]);

  const filteredContacts = useMemo(
    () =>
      filterMarketingContacts(contacts, {
        search: searchQuery,
        segment: segmentFilter,
        source: sourceFilter,
        channel: channelFilter,
      }),
    [contacts, searchQuery, segmentFilter, sourceFilter, channelFilter]
  );

  const handleSyncWorkshopClients = () => {
    if (!canEdit) return;
    const result = syncContactsFromWorkshopRecords(contacts, invoices, agreements);
    if (result.imported.length === 0) {
      setFeedback({
        type: 'ok',
        text: `Semua klien dari Invoice & SPKS (${result.skippedCount} nama/nomor) sudah ada di database marketing.`,
      });
      return;
    }

    importContacts(result.imported);
    recordActivity(
      'Sinkronisasi database kontak dari Invoice & SPKS',
      'Marketing Database',
      `${result.imported.length} kontak baru`
    );
    setFeedback({
      type: 'ok',
      text: `${result.imported.length} kontak klien baru berhasil ditarik dari Invoice & SPKS (${result.skippedCount} duplikat dilewati).`,
    });
  };

  const handleExportCsv = () => {
    const csv = buildMarketingContactsCsv(filteredContacts);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `database-kontak-marketing-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    recordActivity(
      'Mengekspor database kontak marketing CSV',
      'Marketing Database',
      `${filteredContacts.length} kontak`
    );
    setFeedback({
      type: 'ok',
      text: `File CSV berisi ${filteredContacts.length} kontak marketing berhasil diunduh.`,
    });
  };

  const handleCsvFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setCsvImportText(content);
    } catch {
      setFeedback({ type: 'err', text: 'Gagal membaca berkas CSV yang dipilih.' });
    }
    event.target.value = '';
  };

  const handleRunCsvImport = () => {
    if (!canEdit) return;
    const { imported, skippedCount } = parseCsvContactsInput(csvImportText, contacts);
    if (imported.length === 0) {
      setFeedback({
        type: 'err',
        text:
          skippedCount > 0
            ? `Tidak ada kontak baru yang valid untuk diimpor (${skippedCount} baris duplikat atau tidak memiliki WA/Email valid).`
            : 'Masukkan minimal satu baris data CSV dengan format: Nama,WhatsApp,Email,Kota,Segmen.',
      });
      return;
    }

    importContacts(imported);
    recordActivity(
      'Mengimpor database kontak via CSV',
      'Marketing Database',
      `${imported.length} kontak baru`
    );
    setCsvImportText('');
    setShowImporter(false);
    setFeedback({
      type: 'ok',
      text: `${imported.length} kontak berhasil ditambahkan ke database (${skippedCount} baris dilewati).`,
    });
  };

  const handleDelete = (contact: MarketingContact) => {
    if (!canEdit) return;
    deleteContact(contact.id);
    recordActivity('Menghapus kontak marketing', 'Marketing Database', contact.nama);
    setFeedback({
      type: 'ok',
      text: `Kontak "${contact.nama}" telah dihapus dari database marketing.`,
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Database Kontak & Prospek Marketing"
        description="Kelola daftar nomor WhatsApp, alamat email, segmentasi klien, sinkronisasi Invoice/SPKS, dan ekspor-impor CSV."
        actions={
          <>
            {canEdit && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSyncWorkshopClients}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Tarik Klien Invoice/SPKS
              </Button>
            )}
            {canEdit && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowImporter((prev) => !prev)}
              >
                <Upload className="size-3.5" aria-hidden="true" />
                Impor CSV
              </Button>
            )}
            <Button type="button" variant="secondary" size="sm" onClick={handleExportCsv}>
              <Download className="size-3.5" aria-hidden="true" />
              Ekspor CSV
            </Button>
            {canEdit && (
              <Link
                to="/admin/marketing/database/baru"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Tambah Kontak
              </Link>
            )}
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Summary Metrics */}
      <dl className="admin-stat-grid-2x4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Total Kontak Database</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {metrics.total}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Prospek, klien &amp; mitra</dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Siap Broadcast WhatsApp</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--success)] tabular-nums">
            {metrics.waReady}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Nomor aktif &amp; opt-in WA</dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Siap Share Email</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {metrics.emailReady}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Alamat email valid &amp; opt-in</dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Prospek &amp; Klien Aktif</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {metrics.hotOrActive}
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Prioritas tindak lanjut</dd>
        </div>
      </dl>

      {/* Optional Inline CSV Importer */}
      {showImporter && canEdit && (
        <AdminFormSectionCard
          title="Impor Kontak Massal (CSV / Teks Terstruktur)"
          description="Tempel daftar kontak atau unggah file CSV dengan urutan kolom: Nama, WhatsApp, Email, Kota, Segmen."
          headerAction={
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer">
              <Upload className="size-3.5" aria-hidden="true" />
              Pilih File .CSV
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleCsvFileUpload}
                className="sr-only"
              />
            </label>
          }
        >
          <Textarea
            aria-label="Teks CSV kontak untuk diimpor"
            rows={5}
            value={csvImportText}
            onChange={(e) => setCsvImportText(e.target.value)}
            placeholder={
              'Nama,WhatsApp,Email,Kota,Segmen\nRizky Pratama,081288899900,rizky@example.co.id,Purwakarta,Prospek Baru\nStudio Ruang Karya,085611223344,halo@ruangkarya.id,Bandung,Arsitek & Desainer'
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-subtle)]">
              Kontak dengan nomor WhatsApp atau email yang sudah terdaftar akan dilewati otomatis.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowImporter(false);
                  setCsvImportText('');
                }}
              >
                Tutup
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={handleRunCsvImport}>
                <Database className="size-3.5" aria-hidden="true" />
                Proses Impor Kontak
              </Button>
            </div>
          </div>
        </AdminFormSectionCard>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
          <Search
            className="size-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <Input
            aria-label="Cari kontak marketing"
            placeholder="Cari nama, kota, nomor WA, atau email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          aria-label="Filter segmen kontak"
          value={segmentFilter}
          onChange={(e) => setSegmentFilter(e.target.value as 'all' | MarketingContactSegment)}
          className="w-auto"
        >
          <option value="all">Semua Segmen</option>
          {MARKETING_SEGMENTS.map((seg) => (
            <option key={seg} value={seg}>
              {seg}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter kesiapan kanal"
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as 'all' | 'wa' | 'email')}
          className="w-auto"
        >
          <option value="all">Semua Kanal</option>
          <option value="wa">Siap Broadcast WA</option>
          <option value="email">Siap Share Email</option>
        </Select>

        <Select
          aria-label="Filter sumber data"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as 'all' | MarketingContactSource)}
          className="w-auto"
        >
          <option value="all">Semua Sumber</option>
          {MARKETING_SOURCES.map((src) => (
            <option key={src} value={src}>
              {src}
            </option>
          ))}
        </Select>
      </div>

      {/* Contacts Table */}
      <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-[var(--text-muted)]">
              <th className="py-3 px-4 font-semibold">Nama &amp; Instansi</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">WhatsApp &amp; Email</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Kota</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Segmen &amp; Sumber</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Kesiapan Kanal</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Kontak Terakhir</th>
              <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filteredContacts.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[var(--text-muted)]">
                  Tidak ada kontak marketing yang sesuai filter pencarian.
                </td>
              </tr>
            ) : (
              filteredContacts.map((contact) => {
                const waValid = contact.izinWhatsapp && isValidWhatsAppDigits(contact.teleponTerstandar);
                const emailValid = contact.izinEmail && isValidEmailAddress(contact.email);
                const quickWaUrl = waValid
                  ? buildWhatsAppBroadcastUrl(
                      contact,
                      `Halo Bapak/Ibu ${contact.nama}, kami dari Interior & Furniture Shansusdzar Indonesia.`
                    )
                  : '';

                return (
                  <tr key={contact.id} className="hover:bg-[var(--surface-muted)]/30">
                    <td className="py-3 px-4 max-w-xs">
                      <p className="font-semibold text-[var(--text)]">{contact.nama}</p>
                      <p className="text-[var(--text-muted)] truncate">
                        {contact.namaPerusahaan || 'Pribadi'}
                      </p>
                      {contact.catatan && (
                        <p className="text-[11px] text-[var(--text-subtle)] truncate mt-0.5">
                          {contact.catatan}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap space-y-0.5">
                      <p className="font-mono text-[var(--text)]">
                        {contact.telepon || (contact.teleponTerstandar ? `+${contact.teleponTerstandar}` : '-')}
                      </p>
                      <p className="text-[var(--text-muted)]">{contact.email || 'Belum ada email'}</p>
                    </td>
                    <td className="py-3 px-4 text-[var(--text)] whitespace-nowrap">{contact.kota}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-medium text-[var(--text)]">{contact.segmen}</p>
                      <p className="text-[11px] text-[var(--text-subtle)]">{contact.sumber}</p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <p
                          className={
                            waValid ? 'text-[var(--success)] font-medium' : 'text-[var(--text-subtle)]'
                          }
                        >
                          WA: {waValid ? 'Siap' : 'Tidak aktif'}
                        </p>
                        <p
                          className={
                            emailValid
                              ? 'text-[var(--success)] font-medium'
                              : 'text-[var(--text-subtle)]'
                          }
                        >
                          Email: {emailValid ? 'Siap' : 'Tidak aktif'}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                      {contact.terakhirDihubungi
                        ? formatShortDateId(contact.terakhirDihubungi.slice(0, 10))
                        : 'Belum pernah'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {quickWaUrl && (
                          <a
                            href={quickWaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Chat WhatsApp ${contact.nama}`}
                            aria-label={`Chat WhatsApp ${contact.nama}`}
                            className="p-1.5 rounded-[var(--radius-sm)] text-[var(--success)] hover:bg-[var(--success-surface)] inline-flex items-center"
                          >
                            <MessageCircle className="size-3.5" aria-hidden="true" />
                          </a>
                        )}
                        {emailValid && (
                          <a
                            href={`mailto:${contact.email}`}
                            title={`Kirim Email ke ${contact.nama}`}
                            aria-label={`Kirim Email ke ${contact.nama}`}
                            className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] inline-flex items-center"
                          >
                            <Mail className="size-3.5" aria-hidden="true" />
                          </a>
                        )}
                        {canEdit && (
                          <>
                            <Link
                              to={`/admin/marketing/database/${contact.id}/edit`}
                              aria-label={`Edit kontak ${contact.nama}`}
                              className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] inline-flex items-center"
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                            </Link>
                            <button
                              type="button"
                              aria-label={`Hapus kontak ${contact.nama}`}
                              onClick={() => handleDelete(contact)}
                              className="p-1.5 rounded-[var(--radius-sm)] text-[var(--danger)] hover:bg-[var(--danger-surface)] cursor-pointer"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          </>
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
    </div>
  );
}
