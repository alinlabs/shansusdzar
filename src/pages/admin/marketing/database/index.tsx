import { useMemo, useState, type ChangeEvent } from 'react';
import {
  Database,
  Download,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AdminActionButton,
  AdminActionLink,
  AdminExternalActionLink,
} from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { FormField, FormFieldStyleProvider, Select, Textarea } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatShortDateId } from '../../../../lib/finance-utils';
import { canEditPage } from '../../../../lib/rbac';
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
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const contacts = useMarketingStore((state) => state.contacts);
  const importContacts = useMarketingStore((state) => state.importContacts);
  const deleteContact = useMarketingStore((state) => state.deleteContact);

  const invoices = useFinanceStore((state) => state.invoices);
  const agreements = useDocumentsStore((state) => state.agreements);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Database Kontak Marketing | Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'profil-usaha');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<'all' | MarketingContactSegment>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | MarketingContactSource>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'wa' | 'email'>('all');
  const [isSearchActive, setIsSearchActive] = useState(false);
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

  const hasCustomFilter =
    segmentFilter !== 'all' || channelFilter !== 'all' || sourceFilter !== 'all';
  const hasAnyFilter = searchQuery.trim() !== '' || hasCustomFilter;

  const handleResetFilters = () => {
    setSearchQuery('');
    setSegmentFilter('all');
    setChannelFilter('all');
    setSourceFilter('all');
  };

  const handleSyncWorkshopClients = () => {
    if (!canEdit) return;
    const result = syncContactsFromWorkshopRecords(contacts, invoices, agreements);
    if (result.imported.length === 0) {
      setFeedback({
        type: 'ok',
        text: `Semua klien dari Invoice & SPK (${result.skippedCount} nama/nomor) sudah ada di database marketing.`,
      });
      return;
    }

    importContacts(result.imported);
    recordActivity(
      'Sinkronisasi database kontak dari Invoice & SPK',
      'Marketing Database',
      `${result.imported.length} kontak baru`
    );
    setFeedback({
      type: 'ok',
      text: `${result.imported.length} kontak klien baru berhasil ditarik dari Invoice & SPK (${result.skippedCount} duplikat dilewati).`,
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
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Database Kontak"
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Cari kode klien, nama, kota, WA, atau email...',
          ariaLabel: 'Cari kontak marketing',
          onActiveChange: setIsSearchActive,
          hasActiveFilter: hasCustomFilter,
          onResetAll: handleResetFilters,
          filterAriaLabel: 'Filter database kontak',
          filterTitle: 'Filter Database Kontak',
          renderFilterContent: (closeFilter) => (
            <>
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Filter Kontak
                </p>
                <div className="space-y-2">
                  <Select
                    aria-label="Filter segmen kontak"
                    value={segmentFilter}
                    onChange={(e) => setSegmentFilter(e.target.value as 'all' | MarketingContactSegment)}
                    className="px-2.5 text-xs"
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
                    className="px-2.5 text-xs"
                  >
                    <option value="all">Semua Kanal</option>
                    <option value="wa">Siap Broadcast WA</option>
                    <option value="email">Siap Share Email</option>
                  </Select>

                  <Select
                    aria-label="Filter sumber data"
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value as 'all' | MarketingContactSource)}
                    className="px-2.5 text-xs"
                  >
                    <option value="all">Semua Sumber</option>
                    {MARKETING_SOURCES.map((src) => (
                      <option key={src} value={src}>
                        {src}
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
                    setSegmentFilter('all');
                    setChannelFilter('all');
                    setSourceFilter('all');
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
            {canEdit && (
              <AdminActionButton
                label="Tarik Klien Invoice/SPK"
                icon={<RefreshCw className="size-3.5" />}
                onClick={handleSyncWorkshopClients}
              />
            )}
            {canEdit && (
              <AdminActionButton
                label="Impor CSV"
                icon={<Upload className="size-3.5" />}
                onClick={() => setShowImporter((prev) => !prev)}
              />
            )}
            <AdminActionButton
              label="Ekspor CSV"
              icon={<Download className="size-3.5" />}
              onClick={handleExportCsv}
            />
            {canEdit && (
              <AdminActionLink
                to="/admin/marketing/database/baru"
                variant="primary"
                label="Tambah Kontak"
                icon={<Plus className="size-3.5" />}
              />
            )}
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {!isSearchActive && (
        <>
          {/* Summary Metrics */}
          <dl className="admin-stat-grid-2x4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
            <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
              <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
                Total Kontak
              </dt>
              <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
                {metrics.total}
              </dd>
            </div>
            <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
              <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
                Siap WhatsApp
              </dt>
              <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--success)] tabular-nums truncate">
                {metrics.waReady}
              </dd>
            </div>
            <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
              <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
                Siap Email
              </dt>
              <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
                {metrics.emailReady}
              </dd>
            </div>
            <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
              <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
                Prospek Aktif
              </dt>
              <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
                {metrics.hotOrActive}
              </dd>
            </div>
          </dl>

          {/* Optional Inline CSV Importer */}
          {showImporter && canEdit && (
            <AdminFormSectionCard
              title="Impor CSV"
              headerAction={
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border border-white/25 bg-white/15 text-xs font-medium text-white hover:bg-white/25 dark:border-[#21201E]/20 dark:bg-[#21201E]/10 dark:text-[#21201E] dark:hover:bg-[#21201E]/20 cursor-pointer transition-colors">
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
              <FormFieldStyleProvider labelTone="thin" hideHints>
                <div className="[&_input]:font-medium [&_textarea]:font-medium space-y-4">
                  <FormField
                    id="csv-import-textarea"
                    label="Data CSV Kontak (Nama, WhatsApp, Email, Kota, Segmen)"
                  >
                    <Textarea
                      id="csv-import-textarea"
                      rows={5}
                      value={csvImportText}
                      onChange={(e) => setCsvImportText(e.target.value)}
                      placeholder={
                        'Nama,WhatsApp,Email,Kota,Segmen\nRizky Pratama,081288899900,rizky@example.co.id,Purwakarta,Prospek Baru\nStudio Ruang Karya,085611223344,halo@ruangkarya.id,Bandung,Arsitek & Desainer'
                      }
                    />
                  </FormField>
                  <div className="flex flex-wrap items-center justify-end gap-2">
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
              </FormFieldStyleProvider>
            </AdminFormSectionCard>
          )}
        </>
      )}

      {/* Contacts List & Table */}
      <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
        {filteredContacts.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-3">
            <p className="text-xs text-[var(--text-muted)]">
              Tidak ada kontak marketing yang sesuai filter pencarian.
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
          <>
            {/* Mobile minimalist list */}
            <div className="md:hidden divide-y divide-[var(--border)]">
              {filteredContacts.map((contact) => {
                const waValid =
                  contact.izinWhatsapp && isValidWhatsAppDigits(contact.teleponTerstandar);
                const emailValid = contact.izinEmail && isValidEmailAddress(contact.email);
                const quickWaUrl = waValid
                  ? buildWhatsAppBroadcastUrl(
                      contact,
                      `Halo Bapak/Ibu ${contact.nama}, kami dari Interior & Furniture Shansusdzar Indonesia.`
                    )
                  : '';

                return (
                  <div key={contact.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        {contact.kodeKlien && (
                          <p className="text-[11px] font-mono font-medium text-[var(--text-muted)]">
                            {contact.kodeKlien}
                          </p>
                        )}
                        <p className="text-sm font-semibold text-[var(--text)] truncate">
                          {contact.nama}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">
                          {contact.namaPerusahaan || 'Pribadi'} · {contact.kota} · {contact.segmen}
                        </p>
                      </div>
                      <span className="text-[11px] text-[var(--text-subtle)] tabular-nums shrink-0">
                        {contact.terakhirDihubungi
                          ? formatShortDateId(contact.terakhirDihubungi.slice(0, 10))
                          : 'Baru'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="min-w-0 text-[11px] text-[var(--text-muted)] space-y-0.5">
                        <p className="font-mono text-[var(--text)] truncate">
                          {contact.telepon ||
                            (contact.teleponTerstandar ? `+${contact.teleponTerstandar}` : '-')}
                        </p>
                        {contact.email && (
                          <p className="truncate text-[var(--text-subtle)]">{contact.email}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {quickWaUrl && (
                          <AdminExternalActionLink
                            href={quickWaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="success"
                            iconOnly
                            label={`Chat WhatsApp ${contact.nama}`}
                            icon={<MessageCircle className="size-3.5" />}
                          />
                        )}
                        {emailValid && (
                          <AdminExternalActionLink
                            href={`mailto:${contact.email}`}
                            iconOnly
                            label={`Kirim Email ke ${contact.nama}`}
                            icon={<Mail className="size-3.5" />}
                          />
                        )}
                        {canEdit && (
                          <>
                            <AdminActionLink
                              to={`/admin/marketing/database/${contact.id}/edit`}
                              iconOnly
                              label={`Edit kontak ${contact.nama}`}
                              icon={<Pencil className="size-3.5" />}
                            />
                            <AdminActionButton
                              variant="danger"
                              iconOnly
                              label={`Hapus kontak ${contact.nama}`}
                              icon={<Trash2 className="size-3.5" />}
                              onClick={() => handleDelete(contact)}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
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
                  {filteredContacts.map((contact) => {
                    const waValid =
                      contact.izinWhatsapp && isValidWhatsAppDigits(contact.teleponTerstandar);
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
                          <div className="flex items-center gap-2 min-w-0">
                            {contact.kodeKlien && (
                              <span className="font-mono text-[11px] font-semibold text-[var(--text-muted)] shrink-0">
                                {contact.kodeKlien}
                              </span>
                            )}
                            <p className="font-semibold text-[var(--text)] truncate">{contact.nama}</p>
                          </div>
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
                            {contact.telepon ||
                              (contact.teleponTerstandar ? `+${contact.teleponTerstandar}` : '-')}
                          </p>
                          <p className="text-[var(--text-muted)]">
                            {contact.email || 'Belum ada email'}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-[var(--text)] whitespace-nowrap">
                          {contact.kota}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <p className="font-medium text-[var(--text)]">{contact.segmen}</p>
                          <p className="text-[11px] text-[var(--text-subtle)]">{contact.sumber}</p>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <p
                              className={
                                waValid
                                  ? 'text-[var(--success)] font-medium'
                                  : 'text-[var(--text-subtle)]'
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
                              <AdminExternalActionLink
                                href={quickWaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="success"
                                iconOnly
                                label={`Chat WhatsApp ${contact.nama}`}
                                icon={<MessageCircle className="size-3.5" />}
                              />
                            )}
                            {emailValid && (
                              <AdminExternalActionLink
                                href={`mailto:${contact.email}`}
                                iconOnly
                                label={`Kirim Email ke ${contact.nama}`}
                                icon={<Mail className="size-3.5" />}
                              />
                            )}
                            {canEdit && (
                              <>
                                <AdminActionLink
                                  to={`/admin/marketing/database/${contact.id}/edit`}
                                  iconOnly
                                  label={`Edit kontak ${contact.nama}`}
                                  icon={<Pencil className="size-3.5" />}
                                />
                                <AdminActionButton
                                  variant="danger"
                                  iconOnly
                                  label={`Hapus kontak ${contact.nama}`}
                                  icon={<Trash2 className="size-3.5" />}
                                  onClick={() => handleDelete(contact)}
                                />
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
