import { useMemo, useState } from 'react';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { Button, LinkButton } from '../../components/ui/button';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle, useJsonLdSchema } from '../../hooks/use-document-title';
import { buildLegalPageJsonLd } from '../../lib/seo-schema';
import { getRuntimeSiteOrigin } from '../../lib/site-url';
import { useCartStore } from '../../store/cart-store';
import { clearPersistedOrderForm } from '../../store/order-form-cache';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../store/site-content-store';
import { useUserProfileStore } from '../../store/user-profile-store';

const EFFECTIVE_DATE_LABEL = '20 November 2026';
const EFFECTIVE_DATE_ISO = '2026-11-20';

export default function KebijakanPrivasiPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const clearCart = useCartStore((state) => state.clearCart);
  const [clearFeedback, setClearFeedback] = useState<string | null>(null);

  const pageTitle = `Kebijakan Privasi | ${businessConfig.namaMerek}`;
  const pageDescription = `Kebijakan privasi resmi ${businessConfig.namaMerek} mengenai pemrosesan data pemesanan, lokasi opsional, penyimpanan lokal peramban, dan hak pengguna sesuai UU PDP.`;

  useDocumentTitle(pageTitle, pageDescription, { ogType: 'website' });

  const originUrl = getRuntimeSiteOrigin();

  const schemaData = useMemo(
    () =>
      buildLegalPageJsonLd({
        path: '/kebijakan-privasi',
        name: pageTitle,
        description: pageDescription,
        dateModified: EFFECTIVE_DATE_ISO,
        businessConfig,
        originUrl,
      }),
    [pageTitle, pageDescription, businessConfig, originUrl]
  );

  useJsonLdSchema('legal-privacy-schema', schemaData);

  const handleClearPersonalLocalData = () => {
    useUserProfileStore.getState().clearProfile();
    clearPersistedOrderForm();
    clearCart();
    setClearFeedback(
      'Data akun lokal (nama, telepon, alamat), draf formulir pesanan, titik koordinat lokasi, dan daftar item keranjang pada peramban Anda telah dihapus secara permanen.'
    );
  };

  return (
    <article className="w-full space-y-10 pb-8">
      <header className="space-y-4 pb-6 border-b border-[var(--border)]">
        <SectionHeading
          as="h1"
          eyebrow="Kepatuhan & Privasi Data"
          title="Kebijakan Privasi"
          description={`Berlaku efektif sejak ${EFFECTIVE_DATE_LABEL} untuk seluruh layanan situs web dan konsultasi pemesanan ${businessConfig.namaMerek}.`}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
          <span>Pengendali Data: {businessConfig.namaMerek}</span>
          <span aria-hidden="true">·</span>
          <span>Yurisdiksi: Republik Indonesia (UU No. 27/2022 PDP)</span>
          <span aria-hidden="true">·</span>
          <Link to="/syarat-ketentuan" className="text-[var(--text)] hover:underline">
            Lihat Syarat &amp; Ketentuan
          </Link>
        </div>
      </header>

      <div className="space-y-8 text-sm text-[var(--text)] leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            1. Identitas Pengendali Data Resmi
          </h2>
          <p className="text-[var(--text-muted)]">
            Situs ini dikelola secara resmi oleh{' '}
            <strong className="text-[var(--text)]">{businessConfig.namaMerek}</strong> dengan alamat
            workshop di{' '}
            <strong className="text-[var(--text)]">{businessConfig.alamat.alamatLengkap}</strong>. Kami
            berkomitmen menjaga kerahasiaan, keakuratan, dan keamanan data pribadi pengunjung serta
            calon pemesan sesuai ketentuan perundang-undangan yang berlaku di Indonesia serta
            standar transparansi platform Google.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            2. Data yang Kami Kumpulkan dan Tujuan Penggunaannya
          </h2>
          <p className="text-[var(--text-muted)]">
            Kami menerapkan prinsip minimalisasi data: situs ini dapat dijelajahi tanpa membuat akun
            maupun mengisi identitas apa pun. Kami hanya memproses informasi apabila Anda secara
            sadar mengisikannya pada halaman pemesanan atau konsultasi:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-[var(--text-muted)]">
            <li>
              <strong className="text-[var(--text)]">Identitas Pemesan (Halaman Pesanan):</strong>{' '}
              Nama lengkap, nomor telepon/WhatsApp, alamat pengiriman atau survei, serta catatan
              tambahan desain. Data ini semata-mata digunakan untuk menyusun dokumen ringkasan
              pesanan PDF dan memfasilitasi komunikasi konsultasi melalui WhatsApp resmi workshop.
            </li>
            <li>
              <strong className="text-[var(--text)]">Titik Koordinat Lokasi (Opsional):</strong>{' '}
              Koordinat GPS hanya diakses apabila Anda secara eksplisit menekan tombol{' '}
              <em>Gunakan Lokasi</em> pada formulir pemesanan untuk membantu akurasi estimasi biaya
              kirim dan jadwal survei lapangan. Anda dapat menghapus koordinat tersebut kapan saja
              sebelum mengirim pesanan.
            </li>
            <li>
              <strong className="text-[var(--text)]">Data Konfigurasi &amp; Keranjang:</strong>{' '}
              Daftar unit furniture katalog maupun ukuran ruang kustom yang Anda pilih disimpan
              sementara untuk menyusun rincian estimasi dan dokumen penawaran PDF.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            3. Pembuatan Dokumen PDF Lokal &amp; Ketidakberadaan Penjualan Data
          </h2>
          <p className="text-[var(--text-muted)]">
            Seluruh proses pembuatan ringkasan pesanan PDF dijalankan langsung di peramban perangkat
            Anda (<em>client-side processing</em>). Kami{' '}
            <strong className="text-[var(--text)]">tidak menjual, menyewakan, atau membagikan</strong>{' '}
            data pribadi Anda kepada pialang data, jaringan periklanan pihak ketiga, maupun pihak lain
            di luar kebutuhan langsung pelaksanaan survei, produksi, dan pengiriman pesanan Anda.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            4. Penyimpanan Lokal Peramban &amp; Statistik Kunjungan
          </h2>
          <p className="text-[var(--text-muted)]">
            Situs ini tidak memasang cookie pelacak iklan lintas situs (<em>third-party ad tracking
            cookies</em>). Untuk kenyamanan penggunaan, situs memanfaatkan penyimpanan lokal
            peramban (<code>localStorage</code> dan <code>sessionStorage</code>) guna menyimpan
            pilihan tema tampilan (gelap/terang), draf keranjang pesanan, draf formulir pemesan,
            serta metrik agregat kunjungan halaman internal tanpa menyimpan identitas personal
            pengunjung. Rincian teknis tersedia pada halaman{' '}
            <Link to="/keamanan-kepatuhan" className="text-[var(--text)] underline">
              Keamanan &amp; Kepatuhan Data
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            5. Layanan Pihak Ketiga yang Terhubung
          </h2>
          <p className="text-[var(--text-muted)]">
            Saat Anda menekan tautan menuju WhatsApp (<code>wa.me</code>) untuk mengirim pesanan
            atau Google Maps untuk melihat lokasi workshop kami, Anda akan diarahkan ke layanan
            eksternal yang tunduk pada kebijakan privasi penyedia masing-masing (WhatsApp / Meta dan
            Google LLC). Kami tidak mengirimkan data Anda secara otomatis ke layanan tersebut tanpa
            tindakan klik langsung dari Anda.
          </p>
        </section>

        <section className="space-y-4 pt-6 border-t border-[var(--border)]">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[var(--text)]">
              6. Hak Subjek Data &amp; Penghapusan Data Lokal
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              Sesuai UU Perlindungan Data Pribadi, Anda berhak mengakses, memperbarui, atau
              menghapus data pribadi yang tersimpan di perangkat maupun dalam komunikasi pesanan kami.
            </p>
          </div>

          {clearFeedback && (
            <div
              role="status"
              className="p-3.5 rounded-[var(--radius-md)] border border-[var(--success-border)] bg-[var(--success-surface)] text-xs text-[var(--success)] flex items-start gap-2"
            >
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{clearFeedback}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={handleClearPersonalLocalData}>
              <Trash2 className="size-3.5" aria-hidden="true" />
              Hapus Draf Formulir &amp; Keranjang di Peramban Ini
            </Button>
            <a
              href={buildDynamicWhatsAppUrl(
                businessConfig,
                'Halo Admin Shansusdzar, saya ingin mengajukan permintaan akses atau penghapusan data pribadi saya.'
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[var(--text)] underline"
            >
              Hubungi Pengendali Data via WhatsApp ({businessConfig.whatsapp.nomorTampil})
            </a>
          </div>
        </section>

        <section className="space-y-3 pt-2 border-t border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">7. Kontak Resmi Privasi</h2>
          <p className="text-[var(--text-muted)]">
            Pertanyaan mengenai kebijakan privasi atau permintaan penghapusan data dapat disampaikan
            secara langsung ke workshop {businessConfig.namaMerek}, {businessConfig.alamat.alamatLengkap},
            atau melalui WhatsApp resmi di{' '}
            <strong className="text-[var(--text)]">{businessConfig.whatsapp.nomorTampil}</strong>.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <LinkButton to="/syarat-ketentuan" variant="secondary" size="sm">
              Baca Syarat &amp; Ketentuan
            </LinkButton>
            <LinkButton to="/keamanan-kepatuhan" variant="ghost" size="sm">
              Keamanan &amp; Transparansi Penyimpanan
            </LinkButton>
          </div>
        </section>
      </div>
    </article>
  );
}
