import { useMemo, useState } from 'react';
import {
  ChevronDown,
  MessageCircle,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import {
  useAdaptiveNavConfig,
  type AdaptiveNavConfig,
} from '../../components/layout/adaptive-nav-context';
import { ExternalLinkButton, LinkButton } from '../../components/ui/button';
import { Input } from '../../components/ui/form-controls';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle, useJsonLdSchema } from '../../hooks/use-document-title';
import {
  ALL_FAQ_CATEGORIES,
  extractFaqCategories,
  filterFaqItems,
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
    `Tanya Kita (FAQ) | ${businessConfig.namaMerekSingkat}`,
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
  const [openFaqId, setOpenFaqId] = useState<string | null>(faqs[0]?.id ?? null);

  const faqCategories = useMemo(() => extractFaqCategories(faqs), [faqs]);
  const filteredFaqs = useMemo(
    () => filterFaqItems(faqs, faqCategory, faqSearch),
    [faqs, faqCategory, faqSearch]
  );

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
    [whatsappAskUrl]
  );

  useAdaptiveNavConfig(adaptiveNavConfig);

  return (
    <div className="space-y-6 sm:space-y-10">
      <SectionHeading
        as="h1"
        eyebrow="Tanya Kita"
        title="Tanya Kita — Tanya Jawab Seputar Layanan"
        description="Temukan jawaban seputar jam operasional, area jangkauan survei, estimasi durasi produksi workshop, sistem pembayaran termin, hingga garansi pemasangan."
        className="[&_h1]:text-[22px] [&_h1]:sm:text-4xl [&_p:last-child]:text-[13.5px] [&_p:last-child]:sm:text-base"
      />

      <section aria-label="Daftar tanya jawab" className="space-y-4 sm:space-y-5">
        <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filter kategori pertanyaan"
            className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-4 sm:gap-5 border-b border-[var(--border)] overflow-x-auto md:flex-1"
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
                      ? 'text-[var(--text)] font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[var(--accent)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                  ].join(' ')}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72 shrink-0">
            <label htmlFor="faq-search" className="sr-only">
              Cari pertanyaan Tanya Kita
            </label>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <Input
              id="faq-search"
              type="text"
              enterKeyHint="search"
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              placeholder="Cari pertanyaan..."
              className="pl-10 pr-10 text-base md:text-sm"
            />
            {faqSearch.trim().length > 0 && (
              <button
                type="button"
                aria-label="Hapus kata kunci pertanyaan"
                onClick={() => setFaqSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-8 rounded-[calc(var(--radius-md)-2px)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {filteredFaqs.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 text-center space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Pertanyaan tidak ditemukan. Reset filter atau hubungi tim kami langsung via WhatsApp
              untuk penjelasan lebih lanjut.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setFaqCategory(ALL_FAQ_CATEGORIES);
                  setFaqSearch('');
                }}
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
            workshop {businessConfig.namaMerekSingkat}.
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
    </div>
  );
}
