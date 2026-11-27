import { useEffect, useMemo, useRef } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { ImageFallback } from '../../components/ui/image-fallback';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle } from '../../hooks/use-document-title';
import {
  SEARCH_FILTER_OPTIONS,
  extractKeywordSnippet,
  filterSearchDocuments,
  parseSearchFilterKey,
  searchGlobalContent,
  splitHighlightSegments,
  type SearchDocument,
  type SearchFilterKey,
} from '../../lib/global-search';
import { useSiteContentStore } from '../../store/site-content-store';

function HighlightedText({ text, query }: { text: string; query: string }) {
  const segments = splitHighlightSegments(text, query);
  return (
    <>
      {segments.map((segment, index) =>
        segment.highlighted ? (
          <mark
            key={`${index}-${segment.text}`}
            className="bg-[#e4e4e7]/75 dark:bg-[#3f3d39] text-inherit rounded-[2px]"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={`${index}-${segment.text}`}>{segment.text}</span>
        )
      )}
    </>
  );
}

function SearchResultRow({ item, query }: { item: SearchDocument; query: string }) {
  const snippet = useMemo(() => extractKeywordSnippet(item, query, 120), [item, query]);

  return (
    <Link
      to={item.to}
      className="group flex items-center gap-3.5 sm:gap-4 py-3.5 sm:py-4 hover:bg-[var(--surface-muted)]/35 transition-colors duration-150"
    >
      <ImageFallback
        src={item.image ?? null}
        alt={item.title}
        aspectRatio="1/1"
        compact
        fallbackLabel={item.badgeLabel}
        className="size-16 sm:size-20 rounded-[var(--radius-md)] shrink-0"
      />

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[11px] font-medium text-[var(--text-muted)] leading-tight truncate">
          {item.badgeLabel}
        </p>

        <h3 className="text-sm font-semibold text-[var(--text)] leading-snug line-clamp-1">
          {item.title}
        </h3>

        <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed line-clamp-2">
          <HighlightedText text={snippet} query={query} />
        </p>
      </div>

      <span className="hidden sm:inline-flex items-center justify-center size-8 rounded-[var(--radius-md)] text-[var(--text-muted)] group-hover:text-[var(--text)] group-hover:translate-x-0.5 transition-all shrink-0">
        <ArrowRight className="size-4" aria-hidden="true" />
      </span>
    </Link>
  );
}

export default function PencarianPage() {
  useDocumentTitle(
    'Pencarian | Shansus Dzar Indonesia',
    'Cari produk furniture, portofolio proyek, panduan material, artikel berita, dan FAQ Shansus Dzar Indonesia.'
  );

  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const activeFilter = parseSearchFilterKey(searchParams.get('filter'));
  const inputRef = useRef<HTMLInputElement>(null);

  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);
  const portfolioProjects = useSiteContentStore((state) => state.portfolioProjects);
  const newsArticles = useSiteContentStore((state) => state.newsArticles);
  const materials = useSiteContentStore((state) => state.materials);
  const faqs = useSiteContentStore((state) => state.faqs);
  const operationalInfo = useSiteContentStore((state) => state.operationalInfo);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  const activeCatalog = catalogOverride ?? loadedBaseCatalog;

  const searchOutput = useMemo(
    () =>
      searchGlobalContent(
        {
          products: activeCatalog?.daftarProduk ?? [],
          portfolioProjects,
          newsArticles,
          materials,
          faqs,
          operationalInfo,
        },
        query
      ),
    [
      activeCatalog,
      portfolioProjects,
      newsArticles,
      materials,
      faqs,
      operationalInfo,
      query,
    ]
  );

  const syncSearchParams = (nextQuery: string, nextFilter: SearchFilterKey) => {
    const nextParams = new URLSearchParams();
    if (nextQuery.length > 0) {
      nextParams.set('q', nextQuery);
    }
    if (nextFilter !== 'semua') {
      nextParams.set('filter', nextFilter);
    }
    setSearchParams(nextParams, { replace: true, state: location.state });
  };

  const visibleResults = useMemo(
    () => filterSearchDocuments(searchOutput.results, activeFilter),
    [searchOutput.results, activeFilter]
  );

  const hasQuery = searchOutput.normalizedQuery.length > 0;
  const activeFilterOption = SEARCH_FILTER_OPTIONS.find((opt) => opt.id === activeFilter);

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      {/* Input Pencarian & Filter untuk Desktop (Mobile menggunakan searchbar + filter popup di Header) */}
      <section className="hidden md:block space-y-4">
        <SectionHeading
          as="h1"
          eyebrow="Pencarian"
          title="Cari Produk, Portofolio, & Informasi"
        />

        <form
          role="search"
          aria-label="Pencarian produk, portofolio, dan informasi"
          onSubmit={(event) => {
            event.preventDefault();
            inputRef.current?.blur();
          }}
          className="relative"
        >
          <Search
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => syncSearchParams(event.target.value, activeFilter)}
            placeholder="Ketik kata kunci pencarian..."
            aria-label="Kata kunci pencarian"
            autoFocus
            className="w-full h-12 pl-11 pr-11 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] text-base text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none focus:outline-none focus-visible:outline-none focus:border-[var(--border-strong)] focus-visible:border-[var(--border-strong)] transition-colors"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                syncSearchParams('', activeFilter);
                inputRef.current?.focus();
              }}
              aria-label="Hapus kata kunci pencarian"
              className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-8 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </form>

        <div
          className="flex items-center gap-5 border-b border-[var(--border)] overflow-x-auto"
          role="tablist"
          aria-label="Filter kategori pencarian"
        >
          {SEARCH_FILTER_OPTIONS.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => syncSearchParams(query, tab.id)}
                className={[
                  'relative min-h-10 py-2 text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  isActive
                    ? 'text-[var(--text)] font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                {tab.shortLabel}
              </button>
            );
          })}
        </div>
      </section>

      {/* Indikator filter aktif di Mobile saat dipilih dari menu popup */}
      {activeFilter !== 'semua' && (
        <div className="md:hidden flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--border)] text-xs">
          <span className="text-[var(--text-muted)] truncate">
            Filter:{' '}
            <strong className="font-semibold text-[var(--text)]">
              {activeFilterOption?.label ?? activeFilter}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => syncSearchParams(query, 'semua')}
            className="inline-flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text)] font-medium shrink-0 cursor-pointer"
          >
            <span>Reset</span>
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Awal kosong; saat user mengisi kata kunci langsung tampilkan daftar hasil native */}
      {hasQuery && (
        <section aria-live="polite">
          {visibleResults.length > 0 ? (
            <div className="divide-y divide-[var(--border)] border-b border-[var(--border)]">
              {visibleResults.map((item) => (
                <SearchResultRow key={item.id} item={item} query={query} />
              ))}
            </div>
          ) : (
            <div className="py-10 text-center space-y-1.5">
              <p className="text-sm font-semibold text-[var(--text)]">
                Tidak ada hasil untuk &ldquo;{query.trim()}&rdquo;
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Coba kata kunci lain atau ubah filter pencarian.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
