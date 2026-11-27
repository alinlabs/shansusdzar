import { useMemo, useState } from 'react';
import { Copy, Pencil, Plus, Printer, RotateCcw, Search, Trash2 } from 'lucide-react';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Input, Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatDocumentDimensionDisplay } from '../../../../lib/dimension-format';
import { formatRupiahSigned, formatShortDateId } from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import { downloadWorkOrderPdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import { canEditPage } from '../../../../lib/rbac';
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
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Surat Perintah Kerja (SPK) | Dokumen Admin ${businessConfig.namaMerek}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'proyek');
  const canDelete = canEdit;

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WorkOrderStatus>('all');

  const filteredDocs = useMemo(
    () => filterWorkOrders(workOrders, searchQuery, statusFilter),
    [workOrders, searchQuery, statusFilter]
  );

  const activeSpkCount = useMemo(
    () => workOrders.filter((w) => w.status !== 'Selesai Produksi').length,
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
    recordActivity('Mengembalikan data contoh dokumen SPK', 'Dokumen SPK', 'Reset Default');
    setFeedback({
      type: 'ok',
      text: 'Data contoh SPK dikembalikan ke bawaan workshop.',
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="SPK"
        actions={
          canEdit ? (
            <>
              <AdminActionButton
                icon={<RotateCcw className="size-3.5" />}
                label="Reset Contoh Dokumen"
                onClick={handleResetDefaults}
              />
              <AdminActionLink
                to="/admin/dokumen/spk/baru"
                variant="primary"
                icon={<Plus className="size-3.5" />}
                label="Buat SPK Baru"
              />
            </>
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* SPK Summary Strip */}
      <dl className="admin-stat-grid-2x3 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">Total SPK</dt>
          <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
            {workOrders.length} Dokumen
          </dd>
        </div>
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Produksi Aktif
          </dt>
          <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
            {activeSpkCount} Aktif
          </dd>
        </div>
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0 flex items-center justify-between gap-2 sm:block">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Selesai Produksi
          </dt>
          <dd className="sm:mt-0.5 text-sm sm:text-base font-semibold text-[var(--success)] tabular-nums shrink-0">
            {completedSpkCount} Proyek
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
            aria-label="Cari nomor SPK atau proyek"
            placeholder="Cari nomor SPK, proyek, atau klien..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          aria-label="Filter status SPK"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | WorkOrderStatus)}
          className="w-full sm:w-auto"
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
              className="p-4 sm:p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 sm:gap-3">
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
                      className="w-full sm:w-auto min-h-8 text-xs py-1 px-2.5 shrink-0"
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
                  <ul className="space-y-1">
                    {doc.daftarItem.map((item) => (
                      <li
                        key={item.id}
                        className="text-xs text-[var(--text-muted)] flex justify-between gap-2"
                      >
                        <span className="truncate text-[var(--text)] font-medium">
                          {item.namaUnit}
                          {formatDocumentDimensionDisplay(item.dimensi)
                            ? ` (${formatDocumentDimensionDisplay(item.dimensi)})`
                            : ''}
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

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <AdminActionButton
                  icon={<Printer className="size-3.5" />}
                  label="Cetak PDF SPK"
                  onClick={() => downloadWorkOrderPdf(doc, businessConfig, paymentScheme)}
                />

                <div className="flex items-center gap-1.5">
                  {canEdit && (
                    <>
                      <AdminActionLink
                        to={`/admin/dokumen/spk/baru?duplicate=${encodeURIComponent(doc.id)}`}
                        icon={<Copy className="size-3.5" />}
                        label={`Duplikat ${doc.nomorSpk}`}
                        iconOnly
                      />
                      <AdminActionLink
                        to={`/admin/dokumen/spk/${doc.id}/edit`}
                        icon={<Pencil className="size-3.5" />}
                        label={`Ubah ${doc.nomorSpk}`}
                        iconOnly
                      />
                    </>
                  )}
                  {canDelete && (
                    <AdminActionButton
                      variant="danger"
                      icon={<Trash2 className="size-3.5" />}
                      label={`Hapus ${doc.nomorSpk}`}
                      iconOnly
                      onClick={() => handleDelete(doc)}
                    />
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
