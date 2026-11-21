import { useEffect, useMemo } from 'react';
import { ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ExternalLinkButton, LinkButton } from '../../components/ui/button';
import { ImageFallback } from '../../components/ui/image-fallback';
import { useDocumentTitle, useJsonLdSchema } from '../../hooks/use-document-title';
import { buildArticleJsonLd } from '../../lib/seo-schema';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../store/site-content-store';

function formatIndonesianDate(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

export default function BeritaDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const newsArticles = useSiteContentStore((state) => state.newsArticles);

  const article = useMemo(
    () => newsArticles.find((item) => item.slug === slug && item.terbit) ?? null,
    [newsArticles, slug]
  );

  const relatedArticles = useMemo(() => {
    if (!article) return [];
    return newsArticles
      .filter((item) => item.terbit && item.id !== article.id)
      .slice(0, 3);
  }, [article, newsArticles]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [article?.id]);

  const originUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://sdi-furniture.vercel.app';

  useDocumentTitle(
    article
      ? article.judulSeo.trim() || `${article.judul} | ${businessConfig.namaMerekSingkat}`
      : `Berita Tidak Ditemukan | ${businessConfig.namaMerekSingkat}`,
    article
      ? article.deskripsiSeo.trim() || article.ringkasan
      : 'Artikel berita yang Anda cari belum tersedia atau telah diarsipkan.',
    article
      ? {
          ogType: 'article',
          ogImage: article.gambarSampul,
          keywords: article.kataKunciSeo,
        }
      : undefined
  );

  const articleSchema = useMemo(
    () => (article ? buildArticleJsonLd(article, businessConfig, originUrl) : null),
    [article, businessConfig, originUrl]
  );

  useJsonLdSchema('shansusdzar-article-schema', articleSchema);

  if (!article) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-5">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Berita &amp; Artikel
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text)]">
          Artikel Tidak Ditemukan
        </h1>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          Berita atau panduan yang Anda cari mungkin telah diperbarui alamatnya atau belum
          diterbitkan.
        </p>
        <div className="pt-2">
          <LinkButton to="/berita" variant="primary" size="md">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Kembali ke Berita &amp; Artikel
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 sm:space-y-12">
      <div className="w-full space-y-6">
        <nav aria-label="Breadcrumb berita" className="text-xs text-[var(--text-muted)]">
          <Link
            to="/berita"
            className="inline-flex items-center gap-1.5 min-h-9 hover:text-[var(--text)] transition-colors"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Kembali ke Berita &amp; Artikel
          </Link>
        </nav>

        <article className="space-y-6">
          <header className="space-y-3.5">
            <p className="text-xs text-[var(--text-muted)] tabular-nums">
              {article.kategori} ·{' '}
              <time dateTime={article.tanggalTerbit}>
                {formatIndonesianDate(article.tanggalTerbit)}
              </time>{' '}
              · {article.menitBaca} menit baca · {article.namaPenulis}
            </p>
            <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-[var(--text)] leading-tight">
              {article.judul}
            </h1>
            <p className="text-base sm:text-lg text-[var(--text-muted)] leading-relaxed">
              {article.ringkasan}
            </p>
          </header>

          <div className="-mx-4 sm:mx-0 overflow-hidden sm:rounded-[var(--radius-lg)]">
            <ImageFallback
              src={article.gambarSampul}
              alt={article.teksAltSampul || article.judul}
              aspectRatio="16/9"
              eager
              fallbackLabel="Foto Artikel"
              className="rounded-none border-0"
            />
          </div>

          <div className="space-y-5 pt-2 text-[var(--text)] leading-relaxed text-base max-w-[75ch]">
            {article.paragrafKonten.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          {article.kataKunciSeo.length > 0 && (
            <footer className="pt-6 border-t border-[var(--border)] space-y-1.5">
              <p className="text-xs font-medium text-[var(--text-muted)]">Topik Terkait</p>
              <p className="text-xs text-[var(--text-subtle)] leading-relaxed">
                {article.kataKunciSeo.join(' · ')}
              </p>
            </footer>
          )}
        </article>

        <section
          aria-label="Konsultasi kebutuhan interior"
          className="pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="space-y-1 max-w-md">
            <h2 className="text-base font-semibold text-[var(--text)]">
              Ingin Konsultasi Rancangan Ruang Anda?
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
              Diskusikan ukuran ruangan dan pilihan material bersama tim workshop{' '}
              {businessConfig.namaMerekSingkat}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <LinkButton to="/produk/custom" variant="secondary" size="sm">
              Rancang Custom
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </LinkButton>
            <ExternalLinkButton
              href={buildDynamicWhatsAppUrl(
                businessConfig,
                `Halo ${businessConfig.namaMerek}, saya baru membaca artikel "${article.judul}" dan ingin berkonsultasi.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              variant="primary"
              size="sm"
            >
              <MessageCircle className="size-3.5" aria-hidden="true" />
              WhatsApp Studio
            </ExternalLinkButton>
          </div>
        </section>
      </div>

      {relatedArticles.length > 0 && (
        <section
          aria-labelledby="related-news-heading"
          className="space-y-5 pt-6 border-t border-[var(--border)]"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="related-news-heading" className="text-lg font-semibold text-[var(--text)]">
              Berita &amp; Artikel Lainnya
            </h2>
            <Link
              to="/berita"
              className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
            >
              Lihat Semua
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedArticles.map((item) => (
              <Link
                key={item.id}
                to={`/berita/${item.slug}`}
                className="group flex flex-col gap-2.5"
              >
                <ImageFallback
                  src={item.gambarSampul}
                  alt={item.teksAltSampul || item.judul}
                  aspectRatio="16/9"
                  className="rounded-[var(--radius-md)]"
                />
                <div className="space-y-1">
                  <p className="text-xs text-[var(--text-muted)] tabular-nums">
                    {item.kategori} · {formatIndonesianDate(item.tanggalTerbit)}
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
