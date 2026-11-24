import { useMemo, useState } from 'react';
import { Eye, FileDown, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Input, Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatRupiahSigned, formatShortDateId } from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import { downloadAgreementPdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type {
  CooperationAgreementDocument,
  CooperationAgreementStatus,
} from '../../../../types/documents';
import { AdminPageHeader } from '../../admin-shell';
import { AGREEMENT_STATUSES, filterAgreements } from './logic';

export default function AdminSpksPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const agreements = useDocumentsStore((state) => state.agreements);
  const upsertAgreement = useDocumentsStore((state) => state.upsertAgreement);
  const deleteAgreement = useDocumentsStore((state) => state.deleteAgreement);
  const resetDocumentsDefaults = useDocumentsStore((state) => state.resetDocumentsDefaults);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(
    `Surat Perjanjian Kerja Sama (SPKS) | Dokumen Admin ${businessConfig.namaMerekSingkat}`
  );

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'keuangan.edit');
  const canDelete = hasPermission(currentRole, 'keuangan.delete');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CooperationAgreementStatus>('all');

  const filteredDocs = useMemo(
    () => filterAgreements(agreements, searchQuery, statusFilter),
    [agreements, searchQuery, statusFilter]
  );

  const signedCount = useMemo(
    () => agreements.filter((a) => a.status !== 'Draf').length,
    [agreements]
  );
  const totalContractValue = useMemo(
    () => agreements.reduce((sum, a) => sum + (a.nilaiKontrak || 0), 0),
    [agreements]
  );

  const handleStatusChange = (
    doc: CooperationAgreementDocument,
    nextStatus: CooperationAgreementStatus
  ) => {
    if (!canEdit) return;
    upsertAgreement({ ...doc, status: nextStatus });
    recordActivity(
      'Mengubah status kontrak SPKS',
      'Dokumen SPKS',
      `${doc.nomorKontrak}: ${nextStatus}`
    );
    setFeedback({
      type: 'ok',
      text: `Status kontrak ${doc.nomorKontrak} diperbarui menjadi "${nextStatus}".`,
    });
  };

  const handleDelete = (doc: CooperationAgreementDocument) => {
    if (!canDelete) return;
    deleteAgreement(doc.id);
    recordActivity('Menghapus Surat Perjanjian Kerja Sama', 'Dokumen SPKS', doc.nomorKontrak);
    setFeedback({
      type: 'ok',
      text: `Dokumen kontrak ${doc.nomorKontrak} telah dihapus.`,
    });
  };

  const handleResetDefaults = () => {
    if (!canEdit) return;
    resetDocumentsDefaults();
    recordActivity('Mengembalikan data contoh dokumen SPK & SPKS', 'Dokumen SPKS', 'Reset Default');
    setFeedback({
      type: 'ok',
      text: 'Data contoh SPK dan SPKS dikembalikan ke bawaan workshop.',
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="SPKS"
        actions={
          canEdit ? (
            <>
              <AdminActionButton
                icon={<RotateCcw className="size-3.5" />}
                label="Reset Contoh Dokumen"
                onClick={handleResetDefaults}
              />
              <AdminActionLink
                to="/admin/dokumen/spks/baru"
                variant="primary"
                icon={<Plus className="size-3.5" />}
                label="Buat SPKS Baru"
              />
            </>
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* SPKS Summary Strip */}
      <dl className="admin-stat-grid-2x3 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Total Kontrak
          </dt>
          <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
            {agreements.length} Kontrak
          </dd>
        </div>
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Ditinjau / Aktif
          </dt>
          <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--success)] tabular-nums truncate">
            {signedCount} Kontrak
          </dd>
        </div>
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 min-w-0 flex items-center justify-between gap-2 sm:block">
          <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
            Nilai Kontrak
          </dt>
          <dd className="sm:mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums shrink-0">
            {formatRupiahSigned(totalContractValue)}
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
            aria-label="Cari nomor kontrak atau pihak kedua"
            placeholder="Cari nomor kontrak, proyek, atau klien..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          aria-label="Filter status SPKS"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | CooperationAgreementStatus)}
          className="w-full sm:w-auto"
        >
          <option value="all">Semua Status Kontrak</option>
          {AGREEMENT_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </Select>
      </div>

      {filteredDocs.length === 0 ? (
        <div className="p-8 text-center border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-2">
          <p className="text-sm font-medium text-[var(--text)]">
            Belum ada dokumen Perjanjian Kerja Sama yang cocok.
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
                      {doc.nomorKontrak} · {doc.jenisPerjanjian}
                    </p>
                    <h2 className="text-base font-semibold text-[var(--text)] leading-snug">
                      {doc.judulProyek}
                    </h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      Pihak Kedua:{' '}
                      <strong className="text-[var(--text)]">{doc.namaPihakKedua}</strong> ·{' '}
                      {formatShortDateId(doc.tanggalPenandatanganan)}
                    </p>
                  </div>

                  {canEdit ? (
                    <Select
                      aria-label={`Status kontrak ${doc.nomorKontrak}`}
                      value={doc.status}
                      onChange={(e) =>
                        handleStatusChange(doc, e.target.value as CooperationAgreementStatus)
                      }
                      className="w-full sm:w-auto min-h-8 text-xs py-1 px-2.5 shrink-0"
                    >
                      {AGREEMENT_STATUSES.map((st) => (
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
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">Nilai Kesepakatan Kontrak</span>
                    <span className="text-sm font-semibold text-[var(--text)] tabular-nums">
                      {formatRupiahSigned(doc.nilaiKontrak)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[var(--text-muted)] tabular-nums pt-1 border-t border-[var(--border)]">
                    <span>
                      Termin:{' '}
                      {resolveEffectivePaymentScheme(doc.tahapanPembayaran, paymentScheme)
                        .tahapan.map((st) => `${st.nama.split(' ')[0]} ${st.persentase}%`)
                        .join(' · ')}
                    </span>
                    <span>
                      {doc.durasiKerjaHari} hr kerja · Garansi {doc.masaGaransiBulan} bln
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <AdminActionLink
                    to={`/admin/dokumen/spks/${doc.id}/pratinjau`}
                    icon={<Eye className="size-3.5" />}
                    label="Pratinjau"
                  />
                  <AdminActionButton
                    icon={<FileDown className="size-3.5" />}
                    label="Unduh PDF SPKS"
                    onClick={() => downloadAgreementPdf(doc, businessConfig, paymentScheme)}
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  {canEdit && (
                    <AdminActionLink
                      to={`/admin/dokumen/spks/${doc.id}/edit`}
                      icon={<Pencil className="size-3.5" />}
                      label={`Ubah kontrak ${doc.nomorKontrak}`}
                      iconOnly
                    />
                  )}
                  {canDelete && (
                    <AdminActionButton
                      variant="danger"
                      icon={<Trash2 className="size-3.5" />}
                      label={`Hapus kontrak ${doc.nomorKontrak}`}
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
