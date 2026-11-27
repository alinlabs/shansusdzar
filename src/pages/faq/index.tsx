import { useCallback, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  MessageCircle,
  RotateCcw,
} from 'lucide-react';
import {
  useAdaptiveNavConfig,
  type AdaptiveNavConfig,
} from '../../components/layout/adaptive-nav-context';
import { ExternalLinkButton, LinkButton } from '../../components/ui/button';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle, useJsonLdSchema } from '../../hooks/use-document-title';
import {
  ALL_FAQ_CATEGORIES,
  FAQ_SORT_OPTIONS,
  extractFaqCategories,
  filterFaqItems,
  sortFaqItems,
  type FaqSortMode,
} from '../../lib/informasi-filter';
import { DEFAULT_PAYMENT_SCHEME } from '../../lib/payment-scheme';
import { getRuntimeSiteOrigin } from '../../lib/site-url';
import { buildFaqPageJsonLd } from '../../lib/seo-schema';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../store/site-content-store';

export default function FaqPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const faqs = useSiteContentStore((state) => state.faqs);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;

  useDocumentTitle(
    `Tanya Kita (FAQ) | ${businessConfig.namaMerek}`,
    'Tanya Kita: pertanyaan yang sering diajukan seputar jam layanan, area survei interior, estimasi pengerjaan workshop, pilihan material, pembayaran termin, serta garansi Shansus Dzar Indonesia.',
    {
      keywords: [
        'tanya kita shansus dzar indonesia',
        'faq shansusdzar indonesia',
        'jadwal survei interior purwakarta',
        'estimasi produksi kitchen set',
        'garansi furniture custom',
      ],
    }
  );

  const originUrl = getRuntimeSiteOrigin();

  const faqSchema = useMemo(
    () => buildFaqPageJsonLd(faqs, originUrl, paymentScheme),
    [faqs, originUrl, paymentScheme]
  );
  useJsonLdSchema('shansusdzar-faq-schema', faqSchema);
  const orderedStages = useMemo(
    () => [...paymentScheme.tahapan].sort((a, b) => a.urutan - b.urutan),
    [paymentScheme.tahapan]
  );

  const [faqCategory, setFaqCategory] = useState(ALL_FAQ_CATEGORIES);
  const [faqSearch, setFaqSearch] = useState('');
  const [sortBy, setSortBy] = useState<FaqSortMode>('default');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  const faqCategories = useMemo(() => extractFaqCategories(faqs), [faqs]);
  const filteredFaqs = useMemo(
    () => sortFaqItems(filterFaqItems(faqs, faqCategory, faqSearch), sortBy),
    [faqs, faqCategory, faqSearch, sortBy]
  );

  const hasPopupFilterActive =
    faqCategory !== ALL_FAQ_CATEGORIES || sortBy !== 'default';

  const resetPopupFilters = useCallback(() => {
    setFaqCategory(ALL_FAQ_CATEGORIES);
    setSortBy('default');
  }, []);

  const resetFilters = useCallback(() => {
    setFaqSearch('');
    resetPopupFilters();
  }, [resetPopupFilters]);

  const whatsappAskUrl = useMemo(
    () =>
      buildDynamicWhatsAppUrl(
        businessConfig,
        `Halo ${businessConfig.namaMerek}, saya ingin bertanya mengenai layanan survei dan pembuatan furniture custom.`
      ),
    [businessConfig]
  );

  const adaptiveNavConfig = useMemo<AdaptiveNavConfig>(
    () => ({
      header: {
        hideDesktopNav: true,
        hideDesktopAccountIcons: true,
        hideCartIcon: true,
        backTo: '/',
        backAriaLabel: 'Kembali ke Beranda',
        mobileEyebrow: 'Informasi',
        mobileTitle: 'Tanya Kita (FAQ)',
        search: {
          value: faqSearch,
          onChange: setFaqSearch,
          placeholder: 'Cari pertanyaan...',
          ariaLabel: 'Cari pertanyaan Tanya Kita',
          onActiveChange: setIsSearchActive,
          hasActiveFilter: hasPopupFilterActive,
          onResetAll: resetFilters,
          filterAriaLabel: 'Filter dan urutkan pertanyaan FAQ',
          filterTitle: 'Urutkan & Filter',
          renderFilterContent: (closeFilter) => (
            <>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Urutkan
                </p>
                <div role="radiogroup" aria-label="Urutkan pertanyaan FAQ" className="space-y-1">
                  {FAQ_SORT_OPTIONS.map((opt) => {
                    const isSelected = sortBy === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSortBy(opt.value)}
                        className={[
                          'w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-[var(--radius-sm)] text-xs transition-colors cursor-pointer text-left',
                          isSelected
                            ? 'bg-[var(--surface-muted)] text-[var(--text)] font-semibold'
                            : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/60 hover:text-[var(--text)]',
                        ].join(' ')}
                      >
                        <span>{opt.label}</span>
                        {isSelected && (
                          <Check className="size-3.5 text-[var(--text)] shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {faqCategories.length > 1 && (
                <div className="space-y-2 pt-3 border-t border-[var(--border)]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Kategori
                  </p>
                  <div
                    role="group"
                    aria-label="Filter kategori pertanyaan FAQ"
                    className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto"
                  >
                    {faqCategories.map((cat) => {
                      const isActive = faqCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setFaqCategory(cat)}
                          className={[
                            'min-h-8 px-3 py-1.5 rounded-[var(--radius-md)] border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer',
                            isActive
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]'
                              : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]',
                          ].join(' ')}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!hasPopupFilterActive}
                  onClick={resetPopupFilters}
                  className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  Reset Filter
                </button>
                <button
                  type="button"
                  onClick={closeFilter}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-semibold cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </>
          ),
        },
      },
      bottom: {
        type: 'custom',
        render: () => (
          <div data-testid="bottom-nav-faq" className="py-2.5">
            <ExternalLinkButton
              href={whatsappAskUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="primary"
              size="md"
              fullWidth
              data-testid="mobile-bottom-faq-ask"
              className="!min-h-11 !h-11 !text-xs"
            >
              <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>Tanyakan Langsung</span>
            </ExternalLinkButton>
          </div>
        ),
      },
    }),
    [
      whatsappAskUrl,
      faqSearch,
      sortBy,
      faqCategory,
      hasPopupFilterActive,
      faqCategories,
      resetPopupFilters,
      resetFilters,
    ]
  );

  useAdaptiveNavConfig(adaptiveNavConfig);

  return (
    <div className={isSearchActive ? undefined : 'space-y-6 sm:space-y-9'}>
      {!isSearchActive && (
        <div data-testid="faq-header-row">
          <SectionHeading
            as="h1"
            align="left"
            eyebrow="Tanya Kita"
            title="Tanya Jawab Seputar Layanan"
            className="min-w-0"
          />
        </div>
      )}

      <section
        aria-label="Daftar tanya jawab"
        className={isSearchActive ? undefined : 'space-y-4 sm:space-y-5'}
      >
        {!isSearchActive && (
          <div
            role="tablist"
            aria-label="Filter kategori pertanyaan"
            data-testid="faq-category-tablist"
            className={[
              '-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-5 sm:gap-7 border-b border-[var(--border)] overflow-x-auto app-scroll-region',
              faqCategories.length >= 4 ? 'lg:justify-between' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {faqCategories.map((cat) => {
              const active = faqCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFaqCategory(cat)}
                  className={[
                    'relative min-h-11 py-2.5 text-[13px] sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                    active
                      ? 'text-[var(--text)] font-semibold after:absolute after:inset-x-0 after:-bottom-0 after:h-[2px] after:bg-[var(--accent)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                  ].join(' ')}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}

        {filteredFaqs.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 text-center space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Pertanyaan tidak ditemukan. Reset filter atau hubungi tim kami langsung via WhatsApp
              untuk penjelasan lebih lanjut.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 min-h-10 px-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reset Filter Pertanyaan
              </button>
              <ExternalLinkButton
                href={buildDynamicWhatsAppUrl(
                  businessConfig,
                  `Halo ${businessConfig.namaMerek}, saya memiliki pertanyaan mengenai pemesanan furniture custom.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                variant="primary"
                size="sm"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                Tanya via WhatsApp
              </ExternalLinkButton>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            {filteredFaqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={[
                    'rounded-[var(--radius-lg)] border bg-[var(--surface)] overflow-hidden transition-colors',
                    isOpen ? 'border-[var(--border-strong)]' : 'border-[var(--border)]',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="w-full min-h-12 px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between gap-3 sm:gap-4 text-left hover:bg-[var(--surface-muted)]/35 transition-colors cursor-pointer"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-[11.5px] sm:text-xs text-[var(--text-muted)]">
                        {faq.kategori}
                      </p>
                      <p className="text-[13.5px] sm:text-base font-medium text-[var(--text)] leading-snug">
                        {faq.pertanyaan}
                      </p>
                    </div>
                    <ChevronDown
                      className={[
                        'size-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200',
                        isOpen ? 'rotate-180' : '',
                      ].join(' ')}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5 border-t border-[var(--border)]/70 text-[13.5px] sm:text-sm text-[var(--text-muted)] leading-relaxed space-y-3">
                      <p className="max-w-3xl">{faq.jawaban}</p>
                      {faq.id === 'faq-pembayaran' && orderedStages.length > 0 && (
                        <div className="p-3.5 sm:p-4 border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--bg)]/50 space-y-2.5 max-w-3xl">
                          <p className="text-xs font-semibold text-[var(--text)]">
                            Rincian Tahapan Skema Pembayaran Aktif ({paymentScheme.judul})
                          </p>
                          <div className="divide-y divide-[var(--border)]">
                            {orderedStages.map((stage) => (
                              <div
                                key={stage.id}
                                className="py-2 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 text-xs"
                              >
                                <span className="font-semibold text-[var(--text)]">
                                  {stage.nama} {stage.persentase}%
                                </span>
                                <span className="text-[var(--text-muted)] sm:text-right">
                                  {stage.keterangan}
                                </span>
                              </div>
                            ))}
                          </div>
                          {paymentScheme.catatan && (
                            <p className="pt-2 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)]">
                              {paymentScheme.catatan}
                            </p>
                          )}
                          <div className="pt-1">
                            <LinkButton to="/syarat-ketentuan" variant="secondary" size="sm">
                              Syarat &amp; Ketentuan
                            </LinkButton>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {!isSearchActive && (
        <section
          aria-label="Konsultasi langsung"
          className="hidden md:flex rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 flex-row items-center justify-between gap-4"
        >
          <div className="space-y-1 max-w-lg">
            <h2 className="text-base font-semibold text-[var(--text)]">
              Masih Ada Pertanyaan Khusus Seputar Ruangan Anda?
            </h2>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              Tanyakan langsung kondisi lokasi, estimasi jadwal, atau kebutuhan survei kepada tim
              workshop {businessConfig.namaMerek}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <ExternalLinkButton
              href={whatsappAskUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="primary"
              size="sm"
            >
              <MessageCircle className="size-3.5" aria-hidden="true" />
              Tanyakan Langsung
            </ExternalLinkButton>
          </div>
        </section>
      )}
    </div>
  );
}
