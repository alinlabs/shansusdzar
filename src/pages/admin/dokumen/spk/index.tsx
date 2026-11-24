import { useMemo, useState } from 'react';
import { Copy, FileDown, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Button } from '../../../../components/ui/button';
import { Input, Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatRupiahSigned, formatShortDateId } from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import { downloadWorkOrderPdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { WorkOrderDocument, WorkOrderStatus } from '../../../../types/documents';
import { AdminPageHeader } from '../../admin-shell';
import { WORK_ORDER_STATUSES, filterWorkOrders } from './logic';

export default function AdminSpkPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const workOrders = useDocumentsStore((state) => state.workOrders);
  const upsertWorkOrder = useDocumentsStore((state) => state.upsertWorkOrder);
  const deleteWorkOrder = useDocumentsStore((state) => state.deleteWorkOrder);
  const resetDocumentsDefaults = useDocumentsStore((state) => state.resetDocumentsDefaults);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Surat Perintah Kerja (SPK) | Dokumen Admin ${businessConfig.namaMerekSingkat}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'keuangan.edit');
  const canDelete = hasPermission(currentRole, 'keuangan.delete');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WorkOrderStatus>('all');

  const filteredDocs = useMemo(
    () => filterWorkOrders(workOrders, searchQuery, statusFilter),
    [workOrders, searchQuery, statusFilter]
  );

  const activeSpkCount = useMemo(
    () => workOrders.filter((w) => w.status !== 'Selesai QC').length,
    [workOrders]
  );
  const completedSpkCount = workOrders.length - activeSpkCount;

  const handleStatusChange = (doc: WorkOrderDocument, nextStatus: WorkOrderStatus) => {
    if (!canEdit) return;
    upsertWorkOrder({ ...doc, status: nextStatus });
    recordActivity('Mengubah status SPK', 'Dokumen SPK', `${doc.nomorSpk}: ${nextStatus}`);
    setFeedback({
      type: 'ok',
      text: `Status ${doc.nomorSpk} diperbarui menjadi "${nextStatus}".`,
    });
  };

  const handleDelete = (doc: WorkOrderDocument) => {
    if (!canDelete) return;
    deleteWorkOrder(doc.id);
    recordActivity('Menghapus Surat Perintah Kerja', 'Dokumen SPK', doc.nomorSpk);
    setFeedback({
      type: 'ok',
      text: `Dokumen ${doc.nomorSpk} telah dihapus.`,
    });
  };

  const handleResetDefaults = () => {
    if (!canEdit) return;
    resetDocumentsDefaults();
    recordActivity('Mengembalikan data contoh dokumen SPK & SPKS', 'Dokumen SPK', 'Reset Default');
    setFeedback({
      type: 'ok',
      text: 'Data contoh SPK dan SPKS dikembalikan ke bawaan workshop.',
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Surat Perintah Kerja (SPK) Produksi & Instalasi"
        description="Buat instruksi kerja workshop lengkap dengan detail unit, dimensi, material, checklist QC, dan ekspor PDF resmi."
        actions={
          canEdit ? (
            <>
              <Button variant="secondary" size="sm" onClick={handleResetDefaults}>
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reset Contoh Dokumen
              </Button>
              <Link
                to="/admin/dokumen/spk/baru"
                className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
              >
                <Plus className="size-4" aria-hidden="true" />
                Buat SPK Baru
              </Link>
            </>
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* SPK Summary Strip */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Total Dokumen SPK</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {workOrders.length} Dokumen
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Siap produksi &amp; arsip</dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">SPK Produksi Aktif</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--text)] tabular-nums">
            {activeSpkCount} Aktif
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">
            Draf, workshop &amp; instalasi lapangan
          </dd>
        </div>
        <div className="p-4 sm:p-5">
          <dt className="text-xs text-[var(--text-muted)]">Selesai QC</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--success)] tabular-nums">
            {completedSpkCount} Proyek
          </dd>
          <dd className="mt-0.5 text-xs text-[var(--text-subtle)]">Lolos kontrol kualitas</dd>
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
            aria-label="Cari nomor SPK atau proyek"
            placeholder="Cari nomor SPK, klien, atau mandor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          aria-label="Filter status SPK"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | WorkOrderStatus)}
          className="w-auto"
        >
          <option value="all">Semua Status SPK</option>
          {WORK_ORDER_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </Select>
      </div>

      {filteredDocs.length === 0 ? (
        <div className="p-8 text-center border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-2">
          <p className="text-sm font-medium text-[var(--text)]">
            Tidak ada dokumen SPK yang sesuai filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredDocs.map((doc) => (
            <article
              key={doc.id}
              className="p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                      {doc.nomorSpk} · Prioritas {doc.prioritas}
                    </p>
                    <h2 className="text-base font-semibold text-[var(--text)] leading-snug">
                      {doc.namaProyek}
                    </h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      Klien: {doc.namaKlien} · Target {formatShortDateId(doc.tanggalTargetSelesai)}
                    </p>
                  </div>

                  {canEdit ? (
                    <Select
                      aria-label={`Status SPK ${doc.nomorSpk}`}
                      value={doc.status}
                      onChange={(e) =>
                        handleStatusChange(doc, e.target.value as WorkOrderStatus)
                      }
                      className="w-auto min-h-8 text-xs py-1 px-2.5 shrink-0"
                    >
                      {WORK_ORDER_STATUSES.map((st) => (
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

                <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-2">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-[var(--text-muted)]">
                    <span>
                      Kepala Produksi:{' '}
                      <strong className="text-[var(--text)]">{doc.koordinatorProduksi}</strong>
                    </span>
                    <span>
                      QC: <strong className="text-[var(--text)]">{doc.pemeriksaQc}</strong>
                    </span>
                  </div>
                  <ul className="space-y-1 pt-1 border-t border-[var(--border)]">
                    {doc.daftarItem.map((item) => (
                      <li
                        key={item.id}
                        className="text-xs text-[var(--text-muted)] flex justify-between gap-2"
                      >
                        <span className="truncate text-[var(--text)] font-medium">
                          {item.namaUnit} ({item.dimensi})
                        </span>
                        <span className="shrink-0 tabular-nums">{item.jumlah} unit</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {(doc.nomorInvoiceReferensi || doc.nomorSpksReferensi || (doc.nilaiKontrakReferensi ?? 0) > 0) && (
                  <div className="px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)]/40 text-[11px] text-[var(--text-muted)] flex flex-wrap items-center justify-between gap-2 tabular-nums">
                    <span>
                      Acuan:{' '}
                      <strong className="text-[var(--text)]">
                        {doc.nomorInvoiceReferensi || doc.nomorSpksReferensi}
                      </strong>
                      {(doc.nilaiKontrakReferensi ?? 0) > 0
                        ? ` · ${formatRupiahSigned(doc.nilaiKontrakReferensi ?? 0)}`
                        : ''}
                    </span>
                    <span>
                      Skema:{' '}
                      {resolveEffectivePaymentScheme(doc.tahapanPembayaran, paymentScheme)
                        .tahapan.map((st) => `${st.persentase}%`)
                        .join(' · ')}
                    </span>
                  </div>
                )}

                {doc.catatanTeknis && (
                  <p className="text-xs text-[var(--text-subtle)] leading-relaxed line-clamp-2">
                    {doc.catatanTeknis}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => downloadWorkOrderPdf(doc, businessConfig, paymentScheme)}
                >
                  <FileDown className="size-3.5" aria-hidden="true" />
                  Unduh PDF SPK
                </Button>

                <div className="flex items-center gap-1">
                  {canEdit && (
                    <>
                      <Link
                        to={`/admin/dokumen/spk/baru?duplicate=${encodeURIComponent(doc.id)}`}
                        title="Duplikat SPK"
                        aria-label={`Duplikat ${doc.nomorSpk}`}
                        className="p-2 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] inline-flex items-center"
                      >
                        <Copy className="size-3.5" aria-hidden="true" />
                      </Link>
                      <Link
                        to={`/admin/dokumen/spk/${doc.id}/edit`}
                        aria-label={`Ubah ${doc.nomorSpk}`}
                        className="p-2 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] inline-flex items-center"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </Link>
                    </>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      aria-label={`Hapus ${doc.nomorSpk}`}
                      onClick={() => handleDelete(doc)}
                      className="p-2 rounded-[var(--radius-md)] text-[var(--danger)] hover:bg-[var(--danger-surface)] cursor-pointer"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
