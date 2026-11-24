import { useMemo } from 'react';
import { Link } from 'react-router';
import { LinkButton } from '../../components/ui/button';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle, useJsonLdSchema } from '../../hooks/use-document-title';
import { DEFAULT_PAYMENT_SCHEME } from '../../lib/payment-scheme';
import { buildLegalPageJsonLd } from '../../lib/seo-schema';
import { getRuntimeSiteOrigin } from '../../lib/site-url';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../store/site-content-store';

const EFFECTIVE_DATE_LABEL = '20 November 2026';
const EFFECTIVE_DATE_ISO = '2026-11-20';

export default function SyaratKetentuanPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const operationalInfo = useSiteContentStore((state) => state.operationalInfo);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;

  const pageTitle = `Syarat & Ketentuan | ${businessConfig.namaMerekSingkat}`;
  const pageDescription = `Syarat dan ketentuan resmi layanan katalog furniture, pemesanan interior kustom, survei lokasi, pembayaran termin, dan garansi ${businessConfig.namaMerek}.`;

  useDocumentTitle(pageTitle, pageDescription, { ogType: 'website' });

  const originUrl = getRuntimeSiteOrigin();

  const schemaData = useMemo(
    () =>
      buildLegalPageJsonLd({
        path: '/syarat-ketentuan',
        name: pageTitle,
        description: pageDescription,
        dateModified: EFFECTIVE_DATE_ISO,
        businessConfig,
        originUrl,
      }),
    [pageTitle, pageDescription, businessConfig, originUrl]
  );

  useJsonLdSchema('legal-terms-schema', schemaData);

  return (
    <article className="w-full space-y-10 pb-8">
      <header className="space-y-4 pb-6 border-b border-[var(--border)]">
        <SectionHeading
          as="h1"
          eyebrow="Ketentuan Layanan Resmi"
          title="Syarat & Ketentuan"
          description={`Ketentuan penggunaan situs web, pengajuan penawaran, pemesanan produk katalog, dan pengerjaan interior kustom ${businessConfig.namaMerek}.`}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
          <span>Diperbarui: {EFFECTIVE_DATE_LABEL}</span>
          <span aria-hidden="true">·</span>
          <span>Wilayah Layanan: {operationalInfo.areaJangkauanSurvei.join(', ')}</span>
          <span aria-hidden="true">·</span>
          <Link to="/kebijakan-privasi" className="text-[var(--text)] hover:underline">
            Lihat Kebijakan Privasi
          </Link>
        </div>
      </header>

      <div className="space-y-8 text-sm text-[var(--text)] leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            1. Ruang Lingkup &amp; Persetujuan Penggunaan Situs
          </h2>
          <p className="text-[var(--text-muted)]">
            Dengan mengakses situs web resmi{' '}
            <strong className="text-[var(--text)]">{businessConfig.namaMerek}</strong>, Anda setuju
            untuk menggunakan seluruh fitur katalog, kalkulator ukuran custom interior, serta
            formulir ringkasan pesanan PDF secara wajar dan sesuai hukum Republik Indonesia.
            Informasi pada situs disediakan untuk membantu calon klien merencanakan kebutuhan
            furniture dan penataan ruang secara transparan.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            2. Informasi Produk, Harga &amp; Estimasi Interior Kustom
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-[var(--text-muted)]">
            <li>
              <strong className="text-[var(--text)]">Produk Katalog:</strong> Harga referensi pada
              katalog dapat berubah mengikuti penyesuaian ukuran, pilihan material utama, serta
              finishing/laminasi HPL atau Cat Duco yang disepakati bersama sebelum produksi.
            </li>
            <li>
              <strong className="text-[var(--text)]">Estimasi Custom Interior:</strong> Nilai yang
              dihasilkan dari fitur perencanaan custom interior merupakan estimasi awal dan belum
              mengikat secara finansial hingga tim workshop menyelesaikan pengukuran aktual di
              lokasi dan menerbitkan penawaran tertulis resmi.
            </li>
            <li>
              <strong className="text-[var(--text)]">Ketersediaan Material:</strong> Corak maupun
              warna material utama dan lapisan finishing/laminasi (HPL, Cat Duco) dapat memiliki
              perbedaan minor pencahayaan layar dibandingkan sampel fisik yang ditunjukkan saat
              survei.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            3. Alur Pemesanan, Survei Lokasi &amp; Pembayaran Termin
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-[var(--text-muted)]">
            <li>
              <strong className="text-[var(--text)]">Pengajuan Pesanan:</strong> Pengiriman PDF
              ringkasan pesanan melalui WhatsApp tidak otomatis menjadi tagihan atau transaksi
              pembayaran daring. Seluruh kesepakatan teknis dan harga dikonfirmasi langsung oleh
              pengelola resmi kami.
            </li>
            <li>
              <strong className="text-[var(--text)]">Jadwal Survei &amp; Produksi:</strong>{' '}
              {operationalInfo.catatanJadwalSurvei} Estimasi waktu pengerjaan:{' '}
              {operationalInfo.estimasiWaktuProduksi}.
            </li>
            <li>
              <strong className="text-[var(--text)]">Skema Pembayaran:</strong>{' '}
              Pembayaran proyek dilakukan secara bertahap dan hanya sah apabila ditransfer ke rekening resmi yang tercantum pada invoice workshop:
              <ul className="list-disc pl-5 mt-1.5 space-y-1">
                {paymentScheme.tahapan.map((stage) => (
                  <li key={stage.id}>
                    <strong className="text-[var(--text)]">
                      {stage.nama} {stage.persentase}%:
                    </strong>{' '}
                    {stage.keterangan}
                  </li>
                ))}
              </ul>
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            4. Perubahan Desain, Pembatalan &amp; Garansi Pengerjaan
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-[var(--text-muted)]">
            <li>
              <strong className="text-[var(--text)]">Revisi Sebelum Produksi:</strong> Penyesuaian
              ukuran atau tata letak masih dapat dilakukan sebelum gambar kerja disetujui dan
              pemotongan material dimulai.
            </li>
            <li>
              <strong className="text-[var(--text)]">Pembatalan:</strong> Pembatalan pesanan yang
              sudah memasuki tahap pembelian bahan atau pemotongan panel di workshop akan
              diperhitungkan secara proporsional sesuai biaya material yang telah terpakai.
            </li>
            <li>
              <strong className="text-[var(--text)]">Garansi Layanan:</strong>{' '}
              {operationalInfo.ringkasanGaransi} Garansi tidak mencakup kerusakan akibat bencana
              alam, kebocoran bangunan permanen di luar komponen furniture, atau modifikasi pihak
              ketiga tanpa konfirmasi workshop.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            5. Hak Kekayaan Intelektual
          </h2>
          <p className="text-[var(--text-muted)]">
            Seluruh foto dokumentasi proyek, rancangan produk, artikel panduan interior, dan materi
            identitas visual milik {businessConfig.namaMerek} dilindungi hak cipta. Dilarang
            menyalin atau memperbanyak materi dokumentasi portofolio untuk kepentingan komersial
            pihak lain tanpa izin tertulis.
          </p>
        </section>

        <section className="space-y-3 pt-2 border-t border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            6. Penyelesaian Perselisihan &amp; Kontak Resmi
          </h2>
          <p className="text-[var(--text-muted)]">
            Setiap perbedaan penafsiran atas layanan akan diutamakan penyelesaiannya secara
            musyawarah kekeluargaan dan tunduk pada hukum Republik Indonesia. Untuk klarifikasi
            ketentuan, hubungi kami di{' '}
            <strong className="text-[var(--text)]">{businessConfig.whatsapp.nomorTampil}</strong>{' '}
            atau kunjungi {businessConfig.alamat.alamatLengkap}.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <LinkButton to="/kebijakan-privasi" variant="secondary" size="sm">
              Baca Kebijakan Privasi
            </LinkButton>
            <a
              href={buildDynamicWhatsAppUrl(
                businessConfig,
                'Halo Shansus Dzar Indonesia, saya ingin berkonsultasi mengenai ketentuan layanan & survei proyek.'
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3.5 py-2 rounded-[var(--radius-md)] border border-[var(--border)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              Konsultasi Resmi via WhatsApp
            </a>
          </div>
        </section>
      </div>
    </article>
  );
}
