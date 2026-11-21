import { useMemo } from 'react';
import { ArrowLeft, FileDown, Pencil } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Button } from '../../../../components/ui/button';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatRupiahSigned, formatShortDateId } from '../../../../lib/finance-utils';
import { downloadAgreementPdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';

const BACK_PATH = '/admin/dokumen/spks';

export default function AdminSpksPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const agreements = useDocumentsStore((state) => state.agreements);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'keuangan.edit');

  const doc = useMemo(
    () => (id ? agreements.find((item) => item.id === id) ?? null : null),
    [id, agreements]
  );

  useDocumentTitle(
    `${doc ? `Pratinjau ${doc.nomorKontrak}` : 'Kontrak Tidak Ditemukan'} | Dokumen Admin ${businessConfig.namaMerekSingkat}`
  );

  if (!doc) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Kontrak SPKS Tidak Ditemukan"
          description="Dokumen perjanjian yang Anda cari tidak tersedia atau telah dihapus."
          actions={
            <Link
              to={BACK_PATH}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Kembali ke Daftar SPKS
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`Pratinjau ${doc.nomorKontrak}`}
        description={`${doc.jenisPerjanjian} · Status: ${doc.status}`}
        actions={
          <>
            <Link
              to={BACK_PATH}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Kembali
            </Link>
            {canEdit && (
              <Link
                to={`/admin/dokumen/spks/${doc.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                Ubah Kontrak
              </Link>
            )}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => downloadAgreementPdf(doc, businessConfig)}
            >
              <FileDown className="size-3.5" aria-hidden="true" />
              Unduh PDF Resmi
            </Button>
          </>
        }
      />

      <article className="max-w-4xl p-6 sm:p-8 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-6 text-xs sm:text-sm text-[var(--text)] leading-relaxed">
        <div className="text-center border-b border-[var(--border)] pb-5 space-y-1">
          <p className="text-lg font-bold uppercase tracking-wide">
            Surat Perjanjian Kerja Sama
          </p>
          <p className="text-xs font-mono text-[var(--text-muted)]">
            Nomor: {doc.nomorKontrak}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {doc.kotaPenandatanganan}, {formatShortDateId(doc.tanggalPenandatanganan)}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs">
          <div className="space-y-1">
            <p className="font-semibold text-[var(--text-muted)]">PIHAK PERTAMA</p>
            <p className="font-semibold text-[var(--text)]">{doc.perusahaanPihakPertama}</p>
            <p>
              {doc.perwakilanPihakPertama} ({doc.jabatanPihakPertama})
            </p>
            <p className="text-[var(--text-muted)]">{doc.alamatPihakPertama}</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-[var(--text-muted)]">PIHAK KEDUA</p>
            <p className="font-semibold text-[var(--text)]">{doc.namaPihakKedua}</p>
            <p>
              {doc.jabatanPihakKedua} · {doc.teleponPihakKedua || '-'}
            </p>
            {doc.nomorIdentitasPihakKedua && (
              <p className="text-[var(--text-muted)]">NIK/NPWP: {doc.nomorIdentitasPihakKedua}</p>
            )}
            <p className="text-[var(--text-muted)]">{doc.alamatPihakKedua}</p>
          </div>
        </div>

        <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-[var(--text)]">{doc.judulProyek}</span>
            <span className="font-bold text-[var(--text)] tabular-nums">
              {formatRupiahSigned(doc.nilaiKontrak)}
            </span>
          </div>
          <p className="text-[var(--text-muted)] tabular-nums">
            Skema Termin: DP {doc.persenDp}% · Progres {doc.persenProgres}% · Pelunasan{' '}
            {doc.persenPelunasan}% · Durasi {doc.durasiKerjaHari} hari kerja · Garansi{' '}
            {doc.masaGaransiBulan} bulan
          </p>
        </div>

        <div className="space-y-4">
          {doc.daftarPasal.map((cl) => (
            <div key={cl.id} className="space-y-1">
              <h2 className="font-semibold text-sm text-[var(--text)]">{cl.judulPasal}</h2>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] whitespace-pre-line">
                {cl.isiPasal}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
          <div>
            <p>Saksi Pihak Pertama: {doc.saksiPihakPertama || '-'}</p>
          </div>
          <div>
            <p>Saksi Pihak Kedua: {doc.saksiPihakKedua || '-'}</p>
          </div>
        </div>
      </article>
    </div>
  );
}
