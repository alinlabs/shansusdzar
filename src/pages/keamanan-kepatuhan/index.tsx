import { useMemo } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import STORAGE_TRANSPARENCY_ITEMS from '../../data/transparansi-penyimpanan.json';
import { LinkButton } from '../../components/ui/button';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle, useJsonLdSchema } from '../../hooks/use-document-title';
import { buildLegalPageJsonLd } from '../../lib/seo-schema';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../store/site-content-store';

export default function KeamananKepatuhanPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);

  const pageTitle = `Keamanan, Penyimpanan Lokal & Kepatuhan | ${businessConfig.namaMerekSingkat}`;
  const pageDescription = `Informasi standar keamanan HTTPS, header proteksi peramban, transparansi penyimpanan lokal tanpa pelacak pihak ketiga, dan verifikasi resmi ${businessConfig.namaMerek}.`;

  useDocumentTitle(pageTitle, pageDescription, { ogType: 'website' });

  const originUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://sdi-furniture.vercel.app';

  const schemaData = useMemo(
    () =>
      buildLegalPageJsonLd({
        path: '/keamanan-kepatuhan',
        name: pageTitle,
        description: pageDescription,
        dateModified: '2026-11-20',
        businessConfig,
        originUrl,
      }),
    [pageTitle, pageDescription, businessConfig, originUrl]
  );

  useJsonLdSchema('legal-security-schema', schemaData);

  return (
    <article className="w-full space-y-10 pb-8">
      <header className="space-y-4 pb-6 border-b border-[var(--border)]">
        <SectionHeading
          as="h1"
          eyebrow="Transparansi Teknis & Regulasi"
          title="Keamanan & Kepatuhan Data"
          description={`Ringkasan perlindungan teknis, kebijakan penyimpanan lokal peramban, dan rincian verifikasi entitas resmi ${businessConfig.namaMerek}.`}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
          <span>Standar Pelaporan: RFC 9116 (security.txt)</span>
          <span aria-hidden="true">·</span>
          <span>Kepatuhan: UU No. 27/2022 PDP &amp; Standar Web Google</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        <section className="pt-5 border-t border-[var(--border)] space-y-2.5">
          <div className="flex items-center gap-2.5">
            <Lock className="size-4 text-[var(--success)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--text)]">
              Enkripsi Transportasi &amp; Header Proteksi
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
            Seluruh lalu lintas situs dilayani melalui HTTPS terenkripsi dengan kebijakan{' '}
            <code>Strict-Transport-Security</code>, <code>X-Content-Type-Options: nosniff</code>,{' '}
            <code>Referrer-Policy</code>, <code>Permissions-Policy</code> (pembatasan akses
            kamera/mikrofon serta geolokasi hanya atas izin langsung pengguna), dan{' '}
            <code>Content-Security-Policy</code> untuk mencegah eksekusi skrip tidak sah.
          </p>
        </section>

        <section className="pt-5 border-t border-[var(--border)] space-y-2.5">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="size-4 text-[var(--success)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--text)]">
              Pemrosesan Lokal &amp; Isolasi Panel Admin
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
            Pembuatan ringkasan pesanan PDF diproses sepenuhnya di peramban pengguna tanpa mengirim
            berkas ke server pihak ketiga. Area pengelolaan internal (<code>/admin</code>) diproteksi
            kontrol akses berbasis peran (RBAC) serta diisolasi dari indeksasi mesin pencari
            melalui <code>robots.txt</code>, <code>meta robots noindex</code>, dan{' '}
            <code>X-Robots-Tag</code>.
          </p>
        </section>
      </div>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            Transparansi Penyimpanan Lokal &amp; Tanpa Cookie Pelacak
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Situs ini tidak menggunakan cookie pelacakan iklan lintas situs. Berikut daftar lengkap
            kunci penyimpanan lokal peramban yang digunakan untuk mendukung fungsi situs:
          </p>
        </div>

        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
          <table className="w-full text-left text-xs border-y border-[var(--border)] border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <th className="py-3 pr-4 font-medium">Kunci Penyimpanan</th>
                <th className="py-3 px-4 font-medium">Kategori</th>
                <th className="py-3 px-4 font-medium">Tujuan Penggunaan</th>
                <th className="py-3 pl-4 font-medium">Masa Simpan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {STORAGE_TRANSPARENCY_ITEMS.map((item) => (
                <tr key={item.namaKunci}>
                  <td className="py-3 pr-4 font-mono text-[11px] font-medium text-[var(--text)] whitespace-nowrap">
                    {item.namaKunci}
                  </td>
                  <td className="py-3 px-4 text-[var(--text)] whitespace-nowrap">
                    {item.kategori}
                  </td>
                  <td className="py-3 px-4 text-[var(--text-muted)] leading-relaxed">
                    {item.tujuan}
                  </td>
                  <td className="py-3 pl-4 text-[var(--text-muted)] whitespace-nowrap">
                    {item.masaSimpan}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pt-6 border-t border-[var(--border)] space-y-4">
        <h2 className="text-base font-semibold text-[var(--text)]">
          Identitas Terverifikasi &amp; Saluran Pelaporan Keamanan
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
          <div className="space-y-0.5">
            <dt className="text-xs text-[var(--text-muted)]">Nama Entitas Resmi</dt>
            <dd className="font-medium text-[var(--text)]">{businessConfig.namaMerek}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-xs text-[var(--text-muted)]">Kontak Resmi &amp; Keamanan</dt>
            <dd className="font-medium text-[var(--text)] tabular-nums">
              {businessConfig.whatsapp.nomorTampil}
            </dd>
          </div>
          <div className="space-y-0.5 sm:col-span-2">
            <dt className="text-xs text-[var(--text-muted)]">Alamat Workshop Fisik</dt>
            <dd className="text-[var(--text)]">{businessConfig.alamat.alamatLengkap}</dd>
          </div>
          <div className="space-y-0.5 sm:col-span-2">
            <dt className="text-xs text-[var(--text-muted)]">Berkas Standar Keamanan &amp; Indeks</dt>
            <dd className="text-[var(--text-muted)] flex flex-wrap gap-x-4 gap-y-1">
              <a
                href="/.well-known/security.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text)] underline"
              >
                /.well-known/security.txt
              </a>
              <a
                href="/robots.txt"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text)] underline"
              >
                /robots.txt
              </a>
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text)] underline"
              >
                /sitemap.xml
              </a>
            </dd>
          </div>
        </dl>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <LinkButton to="/kebijakan-privasi" variant="secondary" size="sm">
            Kelola &amp; Hapus Data Lokal
          </LinkButton>
          <Link to="/syarat-ketentuan" className="text-xs text-[var(--text)] underline">
            Syarat &amp; Ketentuan Layanan
          </Link>
          <a
            href={buildDynamicWhatsAppUrl(
              businessConfig,
              'Halo Tim Shansus Dzar Indonesia, saya ingin melaporkan kendala keamanan atau verifikasi situs.'
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] underline"
          >
            Laporkan Insiden Keamanan
          </a>
        </div>
      </section>
    </article>
  );
}
