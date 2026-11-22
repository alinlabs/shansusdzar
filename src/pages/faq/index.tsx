import { useMemo, useState } from 'react';
import { ChevronDown, Clock, MapPin, MessageCircle, Search, ShieldCheck } from 'lucide-react';
import { ExternalLinkButton, LinkButton } from '../../components/ui/button';
import { Input } from '../../components/ui/form-controls';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle, useJsonLdSchema } from '../../hooks/use-document-title';
import {
  ALL_FAQ_CATEGORIES,
  extractFaqCategories,
  filterFaqItems,
} from '../../lib/informasi-filter';
import {
  DEFAULT_PAYMENT_SCHEME,
  formatPaymentSchemeSummary,
} from '../../lib/payment-scheme';
import { buildFaqPageJsonLd } from '../../lib/seo-schema';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../store/site-content-store';

export default function FaqPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const faqs = useSiteContentStore((state) => state.faqs);
  const operationalInfo = useSiteContentStore((state) => state.operationalInfo);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const paymentSummaryText =
    formatPaymentSchemeSummary(paymentScheme) || operationalInfo.ringkasanTerminPembayaran;

  useDocumentTitle(
    `FAQ & Informasi Layanan | ${businessConfig.namaMerekSingkat}`,
    'Pertanyaan yang sering diajukan seputar jadwal survei interior, estimasi pengerjaan workshop, pilihan material, pembayaran, serta garansi Shansusdzar Indonesia.',
    {
      keywords: [
        'faq shansusdzar indonesia',
        'jadwal survei interior purwakarta',
        'estimasi produksi kitchen set',
        'garansi furniture custom',
      ],
    }
  );

  const originUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://sdi-furniture.vercel.app';

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

  return (
    <div className="space-y-8 sm:space-y-10">
      <div className="space-y-6">
        <SectionHeading
          as="h1"
          eyebrow="Pusat Tanya Jawab"
          title="Pertanyaan yang Sering Diajukan (FAQ)"
          description="Cari jawaban seputar alur survei lapangan, estimasi durasi produksi, rekomendasi bahan tahan lembap, sistem pembayaran, hingga garansi pemasangan."
        />

        <dl
          aria-label="Ringkasan operasional workshop"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-0 py-5 border-y border-[var(--border)] lg:divide-x lg:divide-[var(--border)]"
        >
          <div className="lg:pr-6 space-y-1">
            <dt className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Clock className="size-3.5" aria-hidden="true" />
              Jam Operasional Workshop
            </dt>
            <dd className="text-sm font-semibold text-[var(--text)]">
              {operationalInfo.jamOperasional}
            </dd>
            <dd className="text-xs text-[var(--text-muted)]">
              {operationalInfo.catatanJadwalSurvei}
            </dd>
          </div>

          <div className="lg:px-6 space-y-1">
            <dt className="text-xs text-[var(--text-muted)]">Estimasi Waktu Produksi</dt>
            <dd className="text-sm font-semibold text-[var(--text)]">
              {operationalInfo.estimasiWaktuProduksi}
            </dd>
          </div>

          <div className="lg:px-6 space-y-1">
            <dt className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Garansi &amp; Pembayaran
            </dt>
            <dd className="text-sm font-semibold text-[var(--text)]">
              {operationalInfo.ringkasanGaransi}
            </dd>
            <dd className="text-xs text-[var(--text-muted)]">
              {paymentSummaryText}
            </dd>
          </div>

          <div className="lg:pl-6 space-y-1">
            <dt className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <MapPin className="size-3.5" aria-hidden="true" />
              Area Survei &amp; Pasang
            </dt>
            <dd className="text-sm font-medium text-[var(--text)] leading-relaxed">
              {operationalInfo.areaJangkauanSurvei.join(' · ')}
            </dd>
          </div>
        </dl>
      </div>

      <section
        aria-label="Skema pembayaran dan termin resmi"
        className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[var(--border)]">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[var(--text-muted)]">
              Landasan Kontrak (SPK / SPKS), BAST &amp; Pembayaran
            </p>
            <h2 className="text-base sm:text-lg font-semibold text-[var(--text)]">
              {paymentScheme.judul}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <LinkButton to="/produk/custom" variant="secondary" size="sm">
              Simulasi Custom Order
            </LinkButton>
            <LinkButton to="/syarat-ketentuan" variant="secondary" size="sm">
              Syarat &amp; Ketentuan
            </LinkButton>
          </div>
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {orderedStages.map((stage) => (
            <li
              key={stage.id}
              className="p-4 border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--bg)]/40 flex flex-col justify-between gap-2"
            >
              <div className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--text)]">{stage.nama}</p>
                  <span className="text-base font-semibold text-[var(--text)] tabular-nums shrink-0">
                    {stage.persentase}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {stage.keterangan}
              </p>
            </li>
          ))}
        </ol>

        {paymentScheme.catatan && (
          <p className="text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border)] leading-relaxed">
            {paymentScheme.catatan}
          </p>
        )}
      </section>

      <section aria-label="Daftar tanya jawab" className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filter kategori pertanyaan"
            className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-5 border-b border-[var(--border)] overflow-x-auto md:flex-1"
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
                    'relative min-h-11 py-2.5 text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer',
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
              Cari pertanyaan FAQ
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <Input
              id="faq-search"
              type="text"
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              placeholder="Cari pertanyaan..."
              className="pl-9"
            />
          </div>
        </div>

        {filteredFaqs.length === 0 ? (
          <div className="py-10 border-t border-[var(--border)] text-center space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Pertanyaan tidak ditemukan. Hubungi tim kami langsung via WhatsApp untuk penjelasan
              lebih lanjut.
            </p>
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
        ) : (
          <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {filteredFaqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div key={faq.id}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="w-full py-4 flex items-center justify-between gap-4 text-left hover:bg-[var(--surface-muted)]/30 transition-colors cursor-pointer"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">{faq.kategori}</p>
                      <p className="text-sm sm:text-base font-medium text-[var(--text)]">
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
                    <div className="pb-5 pt-0.5 text-sm text-[var(--text-muted)] leading-relaxed max-w-3xl space-y-3">
                      <p>{faq.jawaban}</p>
                      {faq.id === 'faq-pembayaran' && orderedStages.length > 0 && (
                        <div className="p-4 border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--surface)] space-y-2.5">
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
        className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="space-y-1 max-w-lg">
          <h2 className="text-base font-semibold text-[var(--text)]">
            Masih Ada Pertanyaan Khusus Seputar Ruangan Anda?
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Konsultasikan kondisi lokasi, denah awal, atau jadwalkan survei bersama tim workshop{' '}
            {businessConfig.namaMerekSingkat}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <LinkButton to="/tips-interior" variant="secondary" size="sm">
            Pelajari Material
          </LinkButton>
          <ExternalLinkButton
            href={buildDynamicWhatsAppUrl(
              businessConfig,
              `Halo ${businessConfig.namaMerek}, saya ingin bertanya mengenai layanan survei dan pembuatan furniture custom.`
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
  );
}
