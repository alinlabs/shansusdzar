import { useMemo, useState } from 'react';
import { Copy, Eye, Pencil, Plus, Printer, RotateCcw, Search, Trash2 } from 'lucide-react';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Input, Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatDocumentDimensionDisplay } from '../../../../lib/dimension-format';
import { formatRupiahSigned, formatShortDateId } from '../../../../lib/finance-utils';
import { DEFAULT_PAYMENT_SCHEME } from '../../../../lib/payment-scheme';
import { downloadHandoverPdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useFinanceStore } from '../../../../store/finance-store';
import { useProjectsStore } from '../../../../store/projects-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { HandoverCertificateDocument, HandoverStatus } from '../../../../types/documents';
import { AdminPageHeader } from '../../admin-shell';
import {
  HANDOVER_STATUSES,
  computeHandoverStats,
  filterHandovers,
  resolveBastPaymentRecordSummary,
} from './logic';

export default function AdminBastPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const handoverCertificates = useDocumentsStore((state) => state.handoverCertificates);
  const invoices = useFinanceStore((state) => state.invoices);
  const projects = useProjectsStore((state) => state.projects);
  const upsertHandoverCertificate = useDocumentsStore((state) => state.upsertHandoverCertificate);
  const deleteHandoverCertificate = useDocumentsStore((state) => state.deleteHandoverCertificate);
  const resetDocumentsDefaults = useDocumentsStore((state) => state.resetDocumentsDefaults);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(
    `Berita Acara Serah Terima (BAST) | Dokumen Admin ${businessConfig.namaMerek}`
  );

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'proyek');
  const canDelete = canEdit;

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
      'Mengembalikan data contoh dokumen SPK & BAST',
      'Dokumen BAST',
      'Reset Default'
    );
    setFeedback({
      type: 'ok',
      text: 'Data contoh SPK dan BAST dikembalikan ke bawaan workshop.',
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="BAST"
        actions={
          canEdit ? (
            <>
              <AdminActionButton
                icon={<RotateCcw className="size-3.5" />}
                label="Reset Contoh Dokumen"
                onClick={handleResetDefaults}
              />
              <AdminActionLink
                to="/admin/dokumen/bast/baru"
                variant="primary"
                icon={<Plus className="size-3.5" />}
                label="Buat BAST Baru"
              />
            </>
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* BAST Summary Strip */}
      <dl className="admin-stat-grid-2x3 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Total BAST
          </dt>
          <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
            {handoverCertificates.length} Dokumen
          </dd>
        </div>
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Menunggu TTD
          </dt>
          <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
            {awaitingSignCount} Dokumen
          </dd>
        </div>
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0 flex items-center justify-between gap-2 sm:block">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Selesai &amp; Garansi
          </dt>
          <dd className="sm:mt-0.5 text-sm sm:text-base font-semibold text-[var(--success)] tabular-nums shrink-0">
            {completedCount} Proyek
          </dd>
        </div>
      </dl>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative flex-1 sm:max-w-xs">
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
          className="w-full sm:w-auto"
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
            const linkedProject =
              projects.find((p) => p.id === doc.projectId) ?? null;
            const linkedInvoice =
              invoices.find(
                (inv) =>
                  (doc.projectId && inv.projectId === doc.projectId) ||
                  (doc.nomorInvoiceReferensi &&
                    inv.nomorInvoice.toLowerCase() === doc.nomorInvoiceReferensi.toLowerCase())
              ) ?? null;
            const paymentSummary = resolveBastPaymentRecordSummary(
              doc,
              linkedInvoice,
              paymentScheme,
              linkedProject
            );
            return (
              <article
                key={doc.id}
                className="p-4 sm:p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-col justify-between gap-4"
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

                    {(doc.nomorSpkReferensi || doc.nomorSpksReferensi || doc.nomorInvoiceReferensi) && (
                      <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                        Referensi:{' '}
                        {[
                          doc.nomorSpksReferensi || doc.nomorSpkReferensi,
                          doc.nomorInvoiceReferensi,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}

                    <div className="pt-1.5 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-[11px] tabular-nums">
                      <span className="text-[var(--text-muted)]">
                        Record Pembayaran:{' '}
                        <strong className="text-[var(--text)]">
                          {paymentSummary.contractValue > 0
                            ? formatRupiahSigned(paymentSummary.totalPaid)
                            : 'Nilai kontrak tercatat'}
                        </strong>
                      </span>
                      <span className="font-semibold text-[var(--success)]">
                        Lunas (Pasca Termin 4)
                      </span>
                    </div>

                    <ul className="space-y-1 pt-1.5 border-t border-[var(--border)]">
                      {doc.daftarItem.map((item) => (
                        <li
                          key={item.id}
                          className="text-xs text-[var(--text-muted)] flex items-center justify-between gap-2"
                        >
                          <span className="truncate text-[var(--text)] font-medium">
                            {item.namaUnit}
                            {formatDocumentDimensionDisplay(item.dimensi)
                              ? ` (${formatDocumentDimensionDisplay(item.dimensi)})`
                              : ''}
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

                <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <AdminActionLink
                      to={`/admin/dokumen/bast/${doc.id}/pratinjau`}
                      icon={<Eye className="size-3.5" />}
                      label="Pratinjau"
                    />
                    <AdminActionButton
                      icon={<Printer className="size-3.5" />}
                      label="Cetak PDF BAST"
                      onClick={() =>
                        downloadHandoverPdf(
                          doc,
                          businessConfig,
                          paymentScheme,
                          linkedInvoice,
                          linkedProject
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {canEdit && (
                      <>
                        <AdminActionLink
                          to={`/admin/dokumen/bast/baru?duplicate=${encodeURIComponent(doc.id)}`}
                          icon={<Copy className="size-3.5" />}
                          label={`Duplikat ${doc.nomorBast}`}
                          iconOnly
                        />
                        <AdminActionLink
                          to={`/admin/dokumen/bast/${doc.id}/edit`}
                          icon={<Pencil className="size-3.5" />}
                          label={`Ubah ${doc.nomorBast}`}
                          iconOnly
                        />
                      </>
                    )}
                    {canDelete && (
                      <AdminActionButton
                        variant="danger"
                        icon={<Trash2 className="size-3.5" />}
                        label={`Hapus ${doc.nomorBast}`}
                        iconOnly
                        onClick={() => handleDelete(doc)}
                      />
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
