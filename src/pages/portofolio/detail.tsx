import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, MessageCircle, Star } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ExternalLinkButton, LinkButton } from '../../components/ui/button';
import { ImageFallback } from '../../components/ui/image-fallback';
import { useDocumentTitle, useJsonLdSchema } from '../../hooks/use-document-title';
import { deriveClientInitials, hasVisiblePortfolioReview } from '../../lib/portfolio-filter';
import { buildPortfolioProjectJsonLd } from '../../lib/seo-schema';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../store/site-content-store';

export default function PortofolioDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const portfolioProjects = useSiteContentStore((state) => state.portfolioProjects);

  const project = useMemo(
    () => portfolioProjects.find((item) => item.slug === slug && item.terbit) ?? null,
    [portfolioProjects, slug]
  );

  const relatedProjects = useMemo(() => {
    if (!project) return [];
    const sameCategory = portfolioProjects.filter(
      (item) => item.terbit && item.id !== project.id && item.kategori === project.kategori
    );
    const others = portfolioProjects.filter(
      (item) => item.terbit && item.id !== project.id && item.kategori !== project.kategori
    );
    return [...sameCategory, ...others].slice(0, 3);
  }, [portfolioProjects, project]);

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    setActiveImageIndex(0);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [project?.id]);

  const originUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://sdi-furniture.vercel.app';

  useDocumentTitle(
    project
      ? `${project.judul} · Portofolio | ${businessConfig.namaMerekSingkat}`
      : `Portofolio Tidak Ditemukan | ${businessConfig.namaMerekSingkat}`,
    project
      ? project.deskripsi
      : 'Dokumentasi studi kasus portofolio yang Anda cari belum tersedia atau telah diarsipkan.',
    project
      ? {
          ogType: 'article',
          ogImage: project.gambarUtama,
          keywords: [project.kategori, project.lokasi, project.cakupan, ...project.materialDigunakan],
        }
      : undefined
  );

  const projectSchema = useMemo(
    () => (project ? buildPortfolioProjectJsonLd(project, businessConfig, originUrl) : null),
    [project, businessConfig, originUrl]
  );

  useJsonLdSchema('shansusdzar-portfolio-project-schema', projectSchema);

  if (!project) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-5">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Portofolio Proyek
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text)]">
          Studi Kasus Portofolio Tidak Ditemukan
        </h1>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          Dokumentasi proyek yang Anda cari mungkin telah diperbarui alamatnya atau sedang
          diarsipkan oleh tim workshop.
        </p>
        <div className="pt-2">
          <LinkButton to="/portofolio" variant="primary" size="md">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Kembali ke Semua Portofolio
          </LinkButton>
        </div>
      </div>
    );
  }

  const gallery =
    project.galeriGambar.length > 0 ? project.galeriGambar : [project.gambarUtama];
  const activeSrc = gallery[activeImageIndex] ?? project.gambarUtama;
  const whatsappUrl = buildDynamicWhatsAppUrl(
    businessConfig,
    `Halo ${businessConfig.namaMerek}, saya tertarik berkonsultasi mengenai konsep proyek "${project.judul}" (${project.kategori}).`
  );

  return (
    <div className="space-y-10 sm:space-y-12">
      <div className="w-full space-y-7 sm:space-y-8">
        <nav aria-label="Breadcrumb portofolio" className="text-xs text-[var(--text-muted)]">
          <Link
            to="/portofolio"
            className="inline-flex items-center gap-1.5 min-h-9 hover:text-[var(--text)] transition-colors"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Kembali ke Semua Portofolio
          </Link>
        </nav>

        <article className="space-y-8 sm:space-y-10">
          <header className="space-y-3.5 max-w-3xl">
            <p className="text-xs text-[var(--text-muted)] tabular-nums">
              {project.kategori} · {project.lokasi} · {project.tahun} · {project.durasi}
            </p>
            <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-[var(--text)] leading-tight">
              {project.judul}
            </h1>
            <p className="text-base sm:text-lg text-[var(--text-muted)] leading-relaxed">
              {project.deskripsi}
            </p>
          </header>

          <div className="space-y-3">
            <div className="-mx-4 sm:mx-0 overflow-hidden sm:rounded-[var(--radius-lg)] bg-[var(--surface-muted)]">
              <ImageFallback
                src={activeSrc}
                alt={project.teksAlt || project.judul}
                aspectRatio="16/9"
                eager
                fallbackLabel={project.judul}
                className="rounded-none border-0"
              />
            </div>

            {gallery.length > 1 && (
              <div
                role="group"
                aria-label="Galeri foto proyek"
                className="flex flex-wrap items-center gap-2.5"
              >
                {gallery.map((imgSrc, idx) => {
                  const isSelected = idx === activeImageIndex;
                  return (
                    <button
                      key={`${imgSrc}-${idx}`}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      aria-label={`Lihat foto ${idx + 1} dari ${gallery.length}`}
                      aria-pressed={isSelected}
                      className={[
                        'relative w-24 aspect-[4/3] overflow-hidden rounded-[var(--radius-sm)] border transition-colors cursor-pointer',
                        isSelected
                          ? 'border-[var(--accent)] ring-2 ring-[var(--focus)]'
                          : 'border-[var(--border)] opacity-75 hover:opacity-100',
                      ].join(' ')}
                    >
                      <ImageFallback
                        src={imgSrc}
                        alt=""
                        aspectRatio="auto"
                        fallbackLabel={`${idx + 1}`}
                        className="size-full rounded-none border-0"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <dl
            aria-label="Spesifikasi teknis proyek"
            className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5 py-5 sm:py-6 border-y border-[var(--border)] text-sm"
          >
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Klien / Konteks</dt>
              <dd className="font-medium text-[var(--text)] mt-1">{project.namaKlien}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Lokasi Proyek</dt>
              <dd className="font-medium text-[var(--text)] mt-1">{project.lokasi}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Cakupan Kerja</dt>
              <dd className="font-medium text-[var(--text)] mt-1">{project.cakupan}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Dimensi Referensi</dt>
              <dd className="font-medium text-[var(--text)] mt-1 tabular-nums">
                {project.ringkasanDimensi}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Luas Pengerjaan</dt>
              <dd className="font-medium text-[var(--text)] mt-1 tabular-nums">
                {project.luasMeterPersegi} m²
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Durasi Pengerjaan</dt>
              <dd className="font-medium text-[var(--text)] mt-1 tabular-nums">
                {project.durasi}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Material Utama</dt>
              <dd className="font-medium text-[var(--text)] mt-1">{project.catatanMaterial}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-muted)]">Finishing/Laminasi</dt>
              <dd className="font-medium text-[var(--text)] mt-1">{project.catatanFinishing}</dd>
            </div>
          </dl>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
            <section className="space-y-2 pb-6 border-b border-[var(--border)] md:border-b-0 md:pb-0">
              <h2 className="text-base font-semibold text-[var(--text)]">Tantangan Ruang</h2>
              <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed">
                {project.tantangan}
              </p>
            </section>
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-[var(--text)]">Solusi &amp; Eksekusi</h2>
              <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed">
                {project.solusi}
              </p>
            </section>
          </div>

          {project.materialDigunakan.length > 0 && (
            <section className="pt-6 border-t border-[var(--border)] space-y-3">
              <h2 className="text-base font-semibold text-[var(--text)]">Spesifikasi Material</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-[var(--text-muted)] list-disc pl-5">
                {project.materialDigunakan.map((mat) => (
                  <li key={mat}>{mat}</li>
                ))}
              </ul>
            </section>
          )}

          {hasVisiblePortfolioReview(project) && project.ulasan && (
            <section
              id="ulasan-klien"
              aria-labelledby="project-review-heading"
              className="pt-6 border-t border-[var(--border)] space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Ulasan Klien Terverifikasi
                  </p>
                  <h2 id="project-review-heading" className="text-base font-semibold text-[var(--text)]">
                    Testimoni Pengerjaan Proyek Ini
                  </h2>
                </div>

                <div
                  className="inline-flex items-center gap-2"
                  aria-label={`Penilaian ${project.ulasan.penilaian} dari 5 bintang`}
                >
                  <div className="inline-flex items-center gap-1 text-[#b8862d] dark:text-[#d6a954]">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={
                          star <= (project.ulasan?.penilaian ?? 5)
                            ? 'size-4 fill-current'
                            : 'size-4 text-[var(--border-strong)]'
                        }
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-[var(--text)] tabular-nums">
                    {(project.ulasan.penilaian || 5).toFixed(1)} / 5.0
                  </span>
                </div>
              </div>

              <blockquote className="text-sm sm:text-base text-[var(--text)] leading-relaxed max-w-3xl">
                &ldquo;{project.ulasan.komentar}&rdquo;
              </blockquote>

              <div className="flex items-center gap-3 pt-1">
                <div
                  className="size-9 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-xs font-semibold text-[var(--text)] shrink-0"
                  aria-hidden="true"
                >
                  {project.ulasan.inisial.trim() ||
                    deriveClientInitials(project.ulasan.namaPengulas)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] truncate">
                    {project.ulasan.namaPengulas}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    {project.namaKlien} · {project.lokasi} · {project.tahun}
                  </p>
                </div>
              </div>
            </section>
          )}
        </article>

        <section
          aria-label="Konsultasi konsep proyek"
          className="pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="space-y-1 max-w-lg">
            <h2 className="text-base font-semibold text-[var(--text)]">
              Tertarik Konsep Penataan Ruang Serupa?
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
              Sesuaikan ukuran, tata letak, dan pilihan material dengan kondisi ruangan Anda bersama
              tim workshop {businessConfig.namaMerekSingkat}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <LinkButton to="/produk/custom" variant="secondary" size="md">
              Rancang di Custom Interior
              <ArrowRight className="size-4" aria-hidden="true" />
            </LinkButton>
            <ExternalLinkButton
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="primary"
              size="md"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              Konsultasikan Konsep Serupa
            </ExternalLinkButton>
          </div>
        </section>
      </div>

      {relatedProjects.length > 0 && (
        <section
          aria-labelledby="related-portfolio-heading"
          className="w-full space-y-5 pt-6 border-t border-[var(--border)]"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="related-portfolio-heading" className="text-lg font-semibold text-[var(--text)]">
              Portofolio Proyek Lainnya
            </h2>
            <Link
              to="/portofolio"
              className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
            >
              Semua Portofolio
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedProjects.map((item) => (
              <Link
                key={item.id}
                to={`/portofolio/${item.slug}`}
                className="group flex flex-col gap-2.5"
              >
                <ImageFallback
                  src={item.gambarUtama}
                  alt={item.teksAlt || item.judul}
                  aspectRatio="4/3"
                  fallbackLabel={item.kategori}
                  className="rounded-[var(--radius-md)]"
                  imgClassName="transition-transform duration-500 ease-[var(--ease-studio)] group-hover:scale-[1.03]"
                />
                <div className="space-y-1">
                  <p className="text-xs text-[var(--text-muted)] tabular-nums">
                    {item.kategori} · {item.lokasi} · {item.tahun}
                  </p>
                  <h3 className="text-sm font-semibold text-[var(--text)] leading-snug group-hover:underline">
                    {item.judul}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
