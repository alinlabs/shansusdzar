import { useMemo } from 'react';
import { ArrowLeft, FileDown, Pencil } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Button } from '../../../../components/ui/button';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatRupiahSigned, formatShortDateId } from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  calculatePaymentSchemeBreakdown,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import { downloadHandoverPdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';
import { resolveBastFinalStageSummary } from './logic';

const BACK_PATH = '/admin/dokumen/bast';

export default function AdminBastPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const handoverCertificates = useDocumentsStore((state) => state.handoverCertificates);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'keuangan.edit');

  const doc = useMemo(
    () => (id ? handoverCertificates.find((item) => item.id === id) ?? null : null),
    [id, handoverCertificates]
  );

  const finalSummary = useMemo(
    () => (doc ? resolveBastFinalStageSummary(doc, paymentScheme) : null),
    [doc, paymentScheme]
  );

  const paymentBreakdown = useMemo(() => {
    if (!doc) return [];
    const effective = resolveEffectivePaymentScheme(
      doc.tahapanPembayaran,
      paymentScheme,
      doc.catatanPembayaran
    );
    return calculatePaymentSchemeBreakdown(doc.nilaiKontrakReferensi || 0, effective);
  }, [doc, paymentScheme]);

  useDocumentTitle(
    `${doc ? `Pratinjau ${doc.nomorBast}` : 'BAST Tidak Ditemukan'} | Dokumen Admin ${businessConfig.namaMerekSingkat}`
  );

  if (!doc) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Dokumen BAST Tidak Ditemukan"
          description="Berita Acara Serah Terima yang Anda cari tidak tersedia atau telah dihapus."
          actions={
            <Link
              to={BACK_PATH}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Kembali ke Daftar BAST
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`Pratinjau ${doc.nomorBast}`}
        description={`${doc.jenisSerahTerima} · Status: ${doc.status}`}
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
                to={`/admin/dokumen/bast/${doc.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                Ubah BAST
              </Link>
            )}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => downloadHandoverPdf(doc, businessConfig, paymentScheme)}
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
            Berita Acara Serah Terima Pekerjaan
          </p>
          <p className="text-xs font-mono text-[var(--text-muted)]">Nomor: {doc.nomorBast}</p>
          <p className="text-xs text-[var(--text-muted)]">
            {doc.kotaSerahTerima}, {formatShortDateId(doc.tanggalSerahTerima)}
            {(doc.nomorSpkReferensi || doc.nomorSpksReferensi || doc.nomorInvoiceReferensi) &&
              ` · Ref: ${[doc.nomorSpkReferensi, doc.nomorSpksReferensi, doc.nomorInvoiceReferensi]
                .filter(Boolean)
                .join(' / ')}`}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs">
          <div className="space-y-1">
            <p className="font-semibold text-[var(--text-muted)]">
              PIHAK PERTAMA (YANG MENYERAHKAN)
            </p>
            <p className="font-semibold text-[var(--text)]">{doc.perusahaanPihakPertama}</p>
            <p>
              {doc.perwakilanPihakPertama} ({doc.jabatanPihakPertama})
            </p>
            <p className="text-[var(--text-muted)]">{doc.alamatPihakPertama}</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-[var(--text-muted)]">
              PIHAK KEDUA (YANG MENERIMA)
            </p>
            <p className="font-semibold text-[var(--text)]">{doc.namaPihakKedua}</p>
            <p>
              {doc.jabatanPihakKedua} · {doc.teleponPihakKedua || '-'}
            </p>
            <p className="text-[var(--text-muted)]">{doc.alamatPihakKedua}</p>
          </div>
        </div>

        <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-[var(--text)]">{doc.namaProyek}</span>
            <span className="font-bold text-[var(--text)] tabular-nums">
              Penyelesaian {doc.persentaseSelesai}%
            </span>
          </div>
          <p className="text-[var(--text-muted)] tabular-nums">
            Lokasi: {doc.lokasiPemasangan || '-'} · Masa Garansi: {doc.masaGaransiBulan} bulan
            (mulai {formatShortDateId(doc.tanggalMulaiGaransi)})
          </p>
        </div>

        {finalSummary && (
          <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[var(--text)]">
                Landasan Skema Pembayaran &amp; {finalSummary.stageName} {finalSummary.stagePercent}%
              </span>
              <span className="font-semibold text-[var(--text)] tabular-nums">
                {finalSummary.finalStageAmount !== null
                  ? formatRupiahSigned(finalSummary.finalStageAmount)
                  : 'Nilai kontrak belum dicantumkan'}{' '}
                · {finalSummary.statusTerminAkhir}
              </span>
            </div>
            <p className="text-[var(--text-muted)]">{finalSummary.stageDescription}</p>
            <div className="pt-2 border-t border-[var(--border)] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] tabular-nums">
              {paymentBreakdown.map((st) => (
                <div key={st.id}>
                  <p className="text-[var(--text-muted)] truncate">
                    {st.nama} {st.persentase}%
                  </p>
                  <p className="font-semibold text-[var(--text)]">
                    {st.amount !== null ? formatRupiahSigned(st.amount) : '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto border border-[var(--border)] rounded-[var(--radius-md)]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)]">
                <th className="py-2.5 px-3 font-semibold">No</th>
                <th className="py-2.5 px-3 font-semibold">Unit &amp; Dimensi</th>
                <th className="py-2.5 px-3 font-semibold text-right">Jumlah</th>
                <th className="py-2.5 px-3 font-semibold">Kondisi</th>
                <th className="py-2.5 px-3 font-semibold">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {doc.daftarItem.map((item, idx) => (
                <tr key={item.id}>
                  <td className="py-2.5 px-3 tabular-nums text-[var(--text-muted)]">{idx + 1}</td>
                  <td className="py-2.5 px-3">
                    <p className="font-medium text-[var(--text)]">{item.namaUnit}</p>
                    {item.dimensi && (
                      <p className="text-[11px] text-[var(--text-muted)]">{item.dimensi}</p>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                    {item.jumlah} unit
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span
                      className={
                        item.kondisi === 'Baik & Sesuai'
                          ? 'font-semibold text-[var(--success)]'
                          : 'font-semibold text-[var(--danger)]'
                      }
                    >
                      {item.kondisi}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[var(--text-muted)]">{item.catatan || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {doc.teksPernyataan && (
          <div className="space-y-1">
            <h2 className="font-semibold text-sm text-[var(--text)]">Pernyataan Serah Terima</h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] whitespace-pre-line">
              {doc.teksPernyataan}
            </p>
          </div>
        )}

        {doc.catatanTindakLanjut && (
          <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-1 text-xs">
            <p className="font-semibold text-[var(--text)]">
              Catatan Tindak Lanjut / Masa Pemeliharaan
            </p>
            <p className="text-[var(--text-muted)] whitespace-pre-line">{doc.catatanTindakLanjut}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
          <div className="space-y-8">
            <p>Yang Menyerahkan (PIHAK PERTAMA),</p>
            <div className="space-y-0.5">
              <p className="font-semibold text-[var(--text)]">{doc.perwakilanPihakPertama}</p>
              <p>Saksi: {doc.saksiPihakPertama || '-'}</p>
            </div>
          </div>
          <div className="space-y-8">
            <p>Yang Menerima (PIHAK KEDUA),</p>
            <div className="space-y-0.5">
              <p className="font-semibold text-[var(--text)]">{doc.namaPihakKedua}</p>
              <p>Saksi: {doc.saksiPihakKedua || '-'}</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
