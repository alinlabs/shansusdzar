import { ArrowRight, Briefcase, Compass, HelpCircle, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router';
import type { NewsArticleItem } from '../../types/cms';
import { ImageFallback } from '../ui/image-fallback';

interface QuickPageLink {
  to: string;
  label: string;
  description: string;
  icon: typeof HelpCircle;
}

const QUICK_PAGE_LINKS: QuickPageLink[] = [
  {
    to: '/faq',
    label: 'Tanya Kita',
    description: 'Estimasi biaya, garansi & alur survei',
    icon: HelpCircle,
  },
  {
    to: '/tips-interior',
    label: 'Tips & Bahan',
    description: 'Panduan papan 18 mm, HPL & Cat Duco',
    icon: Compass,
  },
  {
    to: '/portofolio',
    label: 'Portofolio',
    description: 'Galeri proyek hunian & kantor selesai',
    icon: Briefcase,
  },
  {
    to: '/produk',
    label: 'Produk',
    description: 'Katalog unit siap pesan & custom',
    icon: LayoutGrid,
  },
];

function formatShortIndonesianDate(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

interface BeritaRelatedSidebarProps {
  articleId: string;
  relatedArticles: NewsArticleItem[];
  variant: 'desktop' | 'mobile';
}

export function BeritaRelatedSidebar({
  relatedArticles,
  variant,
}: BeritaRelatedSidebarProps) {
  const isDesktop = variant === 'desktop';
  const headingId = isDesktop ? 'related-news-heading' : 'related-news-heading-mobile';
  const displayedArticles = isDesktop
    ? relatedArticles.slice(0, 5)
    : relatedArticles.slice(0, 3);

  const quickNavElement = (
    <nav
      aria-label="Akses cepat halaman studio"
      className={
        isDesktop
          ? 'space-y-1.5 [@media(min-height:800px)]:space-y-2 shrink-0'
          : 'space-y-2 shrink-0'
      }
    >
      <p className="text-xs font-semibold text-[var(--text)] leading-tight">
        Kunjungi Halaman Lain
      </p>
      <div
        className={
          isDesktop
            ? 'flex flex-col gap-1 [@media(min-height:800px)]:gap-1.5'
            : 'flex flex-col gap-1.5'
        }
      >
        {QUICK_PAGE_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={
                isDesktop
                  ? 'group flex items-center gap-3 px-3 py-1.5 [@media(min-height:800px)]:py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-transparent hover:bg-[var(--surface-muted)]/60 hover:border-[var(--border-strong)] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--focus)]'
                  : 'group flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)]/60 hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--focus)]'
              }
            >
              <Icon
                className={
                  isDesktop
                    ? 'size-4 [@media(min-height:800px)]:size-[18px] shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text)] transition-colors'
                    : 'size-[18px] shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text)] transition-colors'
                }
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span
                  className={
                    isDesktop
                      ? 'block text-[12px] [@media(min-height:800px)]:text-[12.5px] font-semibold text-[var(--text)] leading-tight truncate'
                      : 'block text-[12.5px] font-semibold text-[var(--text)] leading-tight truncate'
                  }
                >
                  {item.label}
                </span>
                <span
                  className={
                    isDesktop
                      ? 'block mt-0.5 text-[10.5px] [@media(min-height:800px)]:text-[11px] text-[var(--text-muted)] leading-snug truncate'
                      : 'block mt-0.5 text-[11px] text-[var(--text-muted)] leading-snug truncate'
                  }
                >
                  {item.description}
                </span>
              </span>
              <ArrowRight
                className="size-3.5 shrink-0 text-[var(--text-subtle)] group-hover:text-[var(--text)] group-hover:translate-x-0.5 transition-all"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );

  if (isDesktop) {
    return (
      <div
        data-testid="berita-sidebar-sticky"
        data-visible-news-count={displayedArticles.length}
        data-total-news-count={relatedArticles.length}
        className="flex-1 min-h-0 flex flex-col"
      >
        <div
          data-testid="berita-sidebar-header"
          className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)]"
        >
          <div className="h-16 px-6 xl:px-7 flex flex-col justify-center">
            <p className="text-[11px] font-medium text-[var(--text-muted)] leading-tight">
              Bacaan Berikutnya
            </p>
            <h2
              id={headingId}
              className="text-[15px] [@media(min-height:800px)]:text-base font-semibold text-[var(--text)] leading-tight mt-0.5"
            >
              Referensi Berita Lain
            </h2>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col px-6 xl:px-7 pt-2.5 pb-4 [@media(min-height:800px)]:pt-4 [@media(min-height:800px)]:pb-7 gap-2 [@media(min-height:800px)]:gap-4">
          {displayedArticles.length > 0 && (
            <section className="flex-1 min-h-0 flex flex-col">
              <ul className="flex-1 min-h-0 flex flex-col divide-y divide-[var(--border)]">
                {displayedArticles.map((item) => (
                  <li
                    key={item.id}
                    className="flex-1 min-h-0 flex items-center py-1 [@media(min-height:800px)]:py-1.5 first:pt-0 last:pb-0"
                  >
                    <Link
                      to={`/berita/${item.slug}`}
                      className="group flex-1 min-w-0 flex items-center gap-3 rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
                    >
                      <div className="w-16 [@media(min-height:800px)]:w-[5.25rem] aspect-[4/3] shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)]">
                        <ImageFallback
                          src={item.gambarSampul}
                          alt={item.teksAltSampul || item.judul}
                          aspectRatio="4/3"
                          className="rounded-none border-0 h-full w-full"
                          imgClassName="image-hover-zoom"
                        />
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] [@media(min-height:800px)]:text-[11px] text-[var(--text-muted)] tabular-nums leading-tight">
                          <span>{item.kategori}</span>
                          <span aria-hidden="true" className="text-[var(--text-subtle)]">
                            ·
                          </span>
                          <time dateTime={item.tanggalTerbit} className="whitespace-nowrap">
                            {formatShortIndonesianDate(item.tanggalTerbit)}
                          </time>
                        </p>
                        <h3 className="text-[12px] [@media(min-height:800px)]:text-[13px] font-semibold text-[var(--text)] leading-[1.32] line-clamp-2">
                          {item.judul}
                        </h3>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {quickNavElement}
        </div>
      </div>
    );
  }

  return (
    <div
      data-visible-news-count={displayedArticles.length}
      data-total-news-count={relatedArticles.length}
      className="space-y-5"
    >
      {displayedArticles.length > 0 && (
        <section className="space-y-2.5 shrink-0">
          <div className="space-y-0.5">
            <p className="text-[11px] font-medium text-[var(--text-muted)] leading-tight">
              Bacaan Berikutnya
            </p>
            <h2
              id={headingId}
              className="text-base font-semibold text-[var(--text)] leading-tight"
            >
              Referensi Berita Lain
            </h2>
          </div>

          <ul className="divide-y divide-[var(--border)]">
            {displayedArticles.map((item) => (
              <li key={item.id} className="first:pt-0 last:pb-0 py-2">
                <Link
                  to={`/berita/${item.slug}`}
                  className="group flex items-center gap-3 rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
                >
                  <div className="w-[4.5rem] aspect-[4/3] shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)]">
                    <ImageFallback
                      src={item.gambarSampul}
                      alt={item.teksAltSampul || item.judul}
                      aspectRatio="4/3"
                      className="rounded-none border-0 h-full w-full"
                      imgClassName="image-hover-zoom"
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[var(--text-muted)] tabular-nums leading-tight">
                      <span>{item.kategori}</span>
                      <span aria-hidden="true" className="text-[var(--text-subtle)]">
                        ·
                      </span>
                      <time dateTime={item.tanggalTerbit} className="whitespace-nowrap">
                        {formatShortIndonesianDate(item.tanggalTerbit)}
                      </time>
                    </p>
                    <h3 className="text-[13px] font-semibold text-[var(--text)] leading-[1.32] line-clamp-2">
                      {item.judul}
                    </h3>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {quickNavElement}
    </div>
  );
}
