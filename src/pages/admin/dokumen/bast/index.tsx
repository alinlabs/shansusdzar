import { useMemo, useState } from 'react';
import { Copy, Eye, FileDown, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Button } from '../../../../components/ui/button';
import { Input, Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatShortDateId } from '../../../../lib/finance-utils';
import { downloadHandoverPdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { HandoverCertificateDocument, HandoverStatus } from '../../../../types/documents';
import { AdminPageHeader } from '../../admin-shell';
import { HANDOVER_STATUSES, computeHandoverStats, filterHandovers } from './logic';

export default function AdminBastPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const handoverCertificates = useDocumentsStore((state) => state.handoverCertificates);
  const upsertHandoverCertificate = useDocumentsStore((state) => state.upsertHandoverCertificate);
  const deleteHandoverCertificate = useDocumentsStore((state) => state.deleteHandoverCertificate);
  const resetDocumentsDefaults = useDocumentsStore((state) => state.resetDocumentsDefaults);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(
    `Berita Acara Serah Terima (BAST) | Dokumen Admin ${businessConfig.namaMerekSingkat}`
  );

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'keuangan.edit');
  const canDelete = hasPermission(currentRole, 'keuangan.delete');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | HandoverStatus>('all');

  const filteredDocs = useMemo(
    () => filterHandovers(handoverCertificates, searchQuery, statusFilter),
    [handoverCertificates, searchQuery, statusFilter]
  );

  const completedCount = useMemo(
    () =>
      handoverCertificates.filter(
        (doc) => doc.status === 'Ditandatangani Klien' || doc.status === 'Selesai & Garansi Aktif'
      ).length,
    [handoverCertificates]
  );

  const awaitingSignCount = useMemo(
    () =>
      handoverCertificates.filter(
        (doc) => doc.status === 'Draf' || doc.status === 'Menunggu Tanda Tangan'
      ).length,
    [handoverCertificates]
  );

  const handleStatusChange = (doc: HandoverCertificateDocument, nextStatus: HandoverStatus) => {
    if (!canEdit) return;
    upsertHandoverCertificate({ ...doc, status: nextStatus });
    recordActivity(
      'Mengubah status BAST serah terima',
      'Dokumen BAST',
      `${doc.nomorBast}: ${nextStatus}`
    );
    setFeedback({
      type: 'ok',
      text: `Status ${doc.nomorBast} diperbarui menjadi "${nextStatus}".`,
    });
  };

  const handleDelete = (doc: HandoverCertificateDocument) => {
    if (!canDelete) return;
    deleteHandoverCertificate(doc.id);
    recordActivity('Menghapus Berita Acara Serah Terima', 'Dokumen BAST', doc.nomorBast);
    setFeedback({
      type: 'ok',
      text: `Dokumen ${doc.nomorBast} telah dihapus.`,
    });
  };

  const handleResetDefaults = () => {
    if (!canEdit) return;
    resetDocumentsDefaults();
    recordActivity(
      'Mengembalikan data contoh dokumen SPK, SPKS & BAST',
      'Dokumen BAST',
      'Reset Default'
    );
    setFeedback({
      type: 'ok',
      text: 'Data contoh SPK, SPKS, dan BAST dikembalikan ke bawaan workshop.',
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Berita Acara Serah Terima (BAST)"
        description="Catat pemeriksaan fisik akhir di lokasi klien, kondisi unit terpasang, masa garansi resmi, dan ekspor PDF serah terima."
        actions={
          canEdit ? (
            <>
              <Button variant="secondary" size="sm" onClick={handleResetDefaults}>
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reset Contoh Dokumen
              </Button>
              <Link
                to="/admin/dokumen/bast/baru"
                className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
              >
                <Plus className="size-4" aria-hidden="true" />
                Buat BAST Baru
              </Link>
            </>
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* BAST Summary Strip */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Total Dokumen BAST</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {handoverCertificates.length} Dokumen
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">
            Arsip berita acara serah terima
          </dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Menunggu Penandatanganan</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {awaitingSignCount} Dokumen
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">
            Draf atau menunggu tanda tangan klien
          </dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Selesai &amp; Garansi Aktif</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--success)] tabular-nums">
            {completedCount} Proyek
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">
            Sudah diterima &amp; ditandatangani
          </dd>
        </div>
      </dl>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
          <Search
            className="size-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <Input
            aria-label="Cari nomor BAST, proyek, atau klien"
            placeholder="Cari nomor BAST, proyek, klien, atau SPK..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          aria-label="Filter status BAST"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | HandoverStatus)}
          className="w-auto"
        >
          <option value="all">Semua Status BAST</option>
          {HANDOVER_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </Select>
      </div>

      {filteredDocs.length === 0 ? (
        <div className="p-8 text-center border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-2">
          <p className="text-sm font-medium text-[var(--text)]">
            Belum ada Berita Acara Serah Terima yang sesuai filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredDocs.map((doc) => {
            const stats = computeHandoverStats(doc.daftarItem);
            return (
              <article
                key={doc.id}
                className="p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                        {doc.nomorBast} · {doc.jenisSerahTerima}
                      </p>
                      <h2 className="text-base font-semibold text-[var(--text)] leading-snug">
                        {doc.namaProyek}
                      </h2>
                      <p className="text-xs text-[var(--text-muted)]">
                        Penerima:{' '}
                        <strong className="text-[var(--text)]">{doc.namaPihakKedua}</strong> ·{' '}
                        {doc.kotaSerahTerima}, {formatShortDateId(doc.tanggalSerahTerima)}
                      </p>
                    </div>

                    {canEdit ? (
                      <Select
                        aria-label={`Status BAST ${doc.nomorBast}`}
                        value={doc.status}
                        onChange={(e) =>
                          handleStatusChange(doc, e.target.value as HandoverStatus)
                        }
                        className="w-full sm:w-auto min-h-8 text-xs py-1 px-2.5 shrink-0"
                      >
                        {HANDOVER_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="text-xs font-semibold text-[var(--text)] shrink-0">
                        {doc.status}
                      </span>
                    )}
                  </div>

                  <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[var(--text-muted)] tabular-nums">
                      <span>
                        Penyelesaian:{' '}
                        <strong className="text-[var(--text)]">{doc.persentaseSelesai}%</strong> ·{' '}
                        Garansi {doc.masaGaransiBulan} bln
                      </span>
                      <span>
                        {stats.passedRows}/{stats.totalRows} item baik · {stats.totalUnits} unit
                      </span>
                    </div>

                    {(doc.nomorSpkReferensi || doc.nomorSpksReferensi) && (
                      <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                        Referensi:{' '}
                        {[doc.nomorSpkReferensi, doc.nomorSpksReferensi]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}

                    <ul className="space-y-1 pt-1.5 border-t border-[var(--border)]">
                      {doc.daftarItem.map((item) => (
                        <li
                          key={item.id}
                          className="text-xs text-[var(--text-muted)] flex items-center justify-between gap-2"
                        >
                          <span className="truncate text-[var(--text)] font-medium">
                            {item.namaUnit}
                            {item.dimensi ? ` (${item.dimensi})` : ''}
                          </span>
                          <span
                            className={[
                              'shrink-0 text-[11px] font-medium',
                              item.kondisi === 'Baik & Sesuai'
                                ? 'text-[var(--success)]'
                                : 'text-[var(--danger)]',
                            ].join(' ')}
                          >
                            {item.kondisi}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {doc.catatanTindakLanjut && (
                    <p className="text-xs text-[var(--text-subtle)] leading-relaxed line-clamp-2">
                      {doc.catatanTindakLanjut}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/admin/dokumen/bast/${doc.id}/pratinjau`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
                    >
                      <Eye className="size-3.5" aria-hidden="true" />
                      Pratinjau
                    </Link>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => downloadHandoverPdf(doc, businessConfig)}
                    >
                      <FileDown className="size-3.5" aria-hidden="true" />
                      Unduh PDF BAST
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <>
                        <Link
                          to={`/admin/dokumen/bast/baru?duplicate=${encodeURIComponent(doc.id)}`}
                          title="Duplikat BAST"
                          aria-label={`Duplikat ${doc.nomorBast}`}
                          className="p-2 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] inline-flex items-center"
                        >
                          <Copy className="size-3.5" aria-hidden="true" />
                        </Link>
                        <Link
                          to={`/admin/dokumen/bast/${doc.id}/edit`}
                          aria-label={`Ubah ${doc.nomorBast}`}
                          className="p-2 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] inline-flex items-center"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </Link>
                      </>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        aria-label={`Hapus ${doc.nomorBast}`}
                        onClick={() => handleDelete(doc)}
                        className="p-2 rounded-[var(--radius-md)] text-[var(--danger)] hover:bg-[var(--danger-surface)] cursor-pointer"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
