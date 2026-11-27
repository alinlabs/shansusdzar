import { useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  LayoutGrid,
  SlidersHorizontal,
} from 'lucide-react';
import { Link, useParams } from 'react-router';
import {
  useAdaptiveNavConfig,
  type AdaptiveNavConfig,
} from '../../components/layout/adaptive-nav-context';
import { RatingMeter } from '../../components/tips/rating-meter';
import { LinkButton } from '../../components/ui/button';
import { ImageFallback } from '../../components/ui/image-fallback';
import { useDocumentTitle } from '../../hooks/use-document-title';
import { resolveTipsDetailEntry } from '../../lib/tips-detail';
import { useSiteContentStore } from '../../store/site-content-store';
import type { MaterialSpecItem } from '../../types/cms';

function MaterialDetailContent({
  material,
  relatedMaterials,
}: {
  material: MaterialSpecItem;
  relatedMaterials: MaterialSpecItem[];
}) {
  const categoryLabel = material.kategori === 'papan' ? 'Material Utama' : 'Finishing/Laminasi';

  return (
    <div className="space-y-6 sm:space-y-10">
      {/* Zone 1: Visual-First di Mobile (Judul -> Foto & CTA -> Keunggulan & Skor) | 8/4 Split di Desktop */}
      <section
        aria-labelledby="tips-detail-heading"
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start lg:items-stretch"
      >
        <div className="lg:col-span-8 lg:col-start-1 lg:row-start-1 space-y-2">
          <p className="text-xs font-medium text-[var(--text-muted)]">{categoryLabel}</p>

          <h1
            id="tips-detail-heading"
            className="text-[22px] sm:text-4xl font-semibold tracking-tight text-[var(--text)] leading-tight text-balance"
          >
            {material.nama}
          </h1>

          <p className="text-[13.5px] sm:text-[15px] text-[var(--text-muted)] leading-relaxed">
            {material.ringkasan}
          </p>
        </div>

        <div className="lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:row-span-2 flex flex-col gap-3">
          <div
            data-testid="tips-hero-image-frame"
            className="relative aspect-[16/10] sm:aspect-[4/3] lg:aspect-square w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)]"
          >
            <ImageFallback
              src={material.gambarReferensi}
              alt={`Contoh aplikasi ${material.nama}`}
              aspectRatio="auto"
              eager
              fallbackLabel={material.nama}
              className="rounded-none border-0 size-full"
              imgClassName="size-full object-cover"
            />
          </div>

          <div
            data-testid="tips-detail-desktop-cta"
            className="hidden md:grid grid-cols-2 gap-2.5"
          >
            <LinkButton
              to="/produk/custom"
              variant="primary"
              size="md"
              fullWidth
              className="!min-h-10 !h-10 !text-xs"
            >
              <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Customisasi</span>
            </LinkButton>
            <LinkButton
              to="/produk"
              variant="secondary"
              size="md"
              fullWidth
              className="!min-h-10 !h-10 !text-xs"
            >
              <LayoutGrid className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Lihat Katalog</span>
            </LinkButton>
          </div>
        </div>

        <div className="lg:col-span-8 lg:col-start-1 lg:row-start-2 flex flex-col justify-between gap-5">
          {material.kelebihan && material.kelebihan.length > 0 && (
            <div data-testid="tips-detail-highlights" className="space-y-2">
              <h2 className="text-sm font-semibold text-[var(--text)]">Keunggulan Utama</h2>
              <ol className="space-y-1.5 sm:space-y-2">
                {material.kelebihan.map((poin, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className="text-xs font-semibold tabular-nums text-[var(--text-subtle)] pt-0.5 shrink-0"
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <p className="text-[13px] sm:text-sm text-[var(--text-muted)] leading-snug sm:leading-relaxed">
                      {poin}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 3-Metric Research Score Strip — 3 kolom sejajar di mobile dan desktop */}
          <div
            data-testid="tips-detail-metrics"
            className="grid grid-cols-3 gap-3 sm:gap-4 pt-4 border-t border-[var(--border)]"
          >
            <RatingMeter
              value={material.ketahananLembap}
              label="Ketahanan Lembap"
              mobileLabel="Lembap"
              prominent
            />
            <RatingMeter
              value={material.peringkatKeawetan}
              label="Kekuatan Struktur"
              mobileLabel="Struktur"
              prominent
            />
            <RatingMeter
              value={material.keterjangkauan}
              label="Keterjangkauan"
              mobileLabel="Ekonomis"
              prominent
            />
          </div>
        </div>
      </section>

      {/* Zone 2: 3-Column Bento — Anatomi | Ideal untuk Produk & Ruang | Panduan Rawat */}
      <section
        aria-label="Komposisi bahan, produk ideal, dan rekomendasi perawatan"
        className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-6 items-stretch"
      >
        <div className="lg:col-span-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 flex flex-col justify-start gap-2 sm:gap-2.5">
          <div className="space-y-0.5">
            <p className="text-[11.5px] sm:text-xs font-medium text-[var(--text-muted)]">
              Anatomi &amp; Komposisi Bahan
            </p>
            <h2 className="text-base sm:text-lg font-semibold text-[var(--text)]">
              Terbuat dari Apa?
            </h2>
          </div>
          <p className="text-[13.5px] sm:text-sm text-[var(--text-muted)] leading-relaxed">
            {material.terbuatDari || material.ringkasan}
          </p>
        </div>

        <div
          data-testid="tips-ideal-card"
          className="lg:col-span-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 flex flex-col justify-start gap-2 sm:gap-2.5"
        >
          <div className="space-y-0.5">
            <p className="text-[11.5px] sm:text-xs font-medium text-[var(--text-muted)]">
              Aplikasi &amp; Ruang
            </p>
            <h2 className="text-base sm:text-lg font-semibold text-[var(--text)]">
              Ideal untuk Produk &amp; Ruang
            </h2>
          </div>
          <ul className="space-y-1.5 sm:space-y-2">
            {material.cocokUntuk.slice(0, 5).map((area) => (
              <li
                key={area}
                className="flex items-center justify-between gap-3 text-[13.5px] sm:text-sm text-[var(--text-muted)] leading-relaxed"
              >
                <span>{area}</span>
                <Check className="size-4 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>

        <aside
          data-testid="tips-care-card"
          className="lg:col-span-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)]/55 p-4 sm:p-6 flex flex-col justify-start gap-2 sm:gap-2.5"
        >
          <div className="space-y-0.5">
            <p className="text-[11.5px] sm:text-xs font-medium text-[var(--text-muted)]">
              Panduan Rawat
            </p>
            <h2 className="text-base sm:text-lg font-semibold text-[var(--text)]">
              Rekomendasi Perawatan
            </h2>
          </div>
          <p className="text-[13.5px] sm:text-sm text-[var(--text-muted)] leading-relaxed">
            {material.tipsPerawatan}
          </p>
        </aside>
      </section>

      {/* Zone 3: Quick Switcher Bahan & Finishing Lainnya */}
      {relatedMaterials.length > 0 && (
        <section
          aria-labelledby="other-materials-heading"
          className="pt-5 sm:pt-6 border-t border-[var(--border)] space-y-3.5 sm:space-y-4"
        >
          <h2 id="other-materials-heading" className="text-base font-semibold text-[var(--text)]">
            Eksplorasi Bahan &amp; Finishing Lainnya
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {relatedMaterials.map((other) => (
              <Link
                key={other.id}
                to={`/tips-interior/${other.id}`}
                className="group rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-4 flex flex-col justify-between gap-2.5 sm:gap-3 card-hover-surface focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-[11px] text-[var(--text-muted)] truncate">
                      {other.kategori === 'papan' ? 'Material' : 'Finishing'}
                    </p>
                    <span className="block text-[13.5px] sm:text-sm font-semibold text-[var(--text)] group-hover:underline truncate">
                      {other.nama}
                    </span>
                  </div>
                  <ArrowUpRight
                    className="size-3.5 shrink-0 mt-0.5 text-[var(--text-muted)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--text)]"
                    aria-hidden="true"
                  />
                </div>
                <div className="flex items-baseline justify-between gap-2 text-xs text-[var(--text-muted)] tabular-nums">
                  <span>Struktur</span>
                  <span className="font-semibold text-[var(--text)]">
                    {other.peringkatKeawetan}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function TipsInteriorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const materials = useSiteContentStore((state) => state.materials);

  const resolved = useMemo(
    () => resolveTipsDetailEntry(id, materials),
    [id, materials]
  );

  const pageTitle = resolved
    ? `${resolved.item.nama} — Spesifikasi Bahan | ${businessConfig.namaMerek}`
    : `Tips Interior Tidak Ditemukan | ${businessConfig.namaMerek}`;

  const pageDescription = resolved
    ? resolved.item.ringkasan
    : 'Informasi spesifikasi material atau finishing yang Anda cari tidak tersedia.';

  useDocumentTitle(pageTitle, pageDescription);

  const adaptiveNavConfig = useMemo<AdaptiveNavConfig>(
    () => ({
      header: {
        hideDesktopNav: true,
        hideDesktopAccountIcons: true,
        hideSearchIcon: true,
        hideCartIcon: true,
        backTo: '/tips-interior',
        backAriaLabel: 'Kembali ke Tips Bahan & Interior',
        ...(resolved
          ? {
              mobileEyebrow:
                resolved.item.kategori === 'papan' ? 'Material Utama' : 'Finishing/Laminasi',
              mobileTitle: resolved.item.nama,
            }
          : {}),
      },
      bottom: resolved
        ? {
            type: 'custom',
            render: () => (
              <div data-testid="bottom-nav-tips-detail" className="py-2.5 grid grid-cols-2 gap-2.5">
                <LinkButton
                  to="/produk/custom"
                  variant="primary"
                  size="md"
                  fullWidth
                  data-testid="mobile-bottom-tips-custom"
                  className="!min-h-11 !h-11 !text-xs"
                >
                  <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">Customisasi</span>
                </LinkButton>
                <LinkButton
                  to="/produk"
                  variant="secondary"
                  size="md"
                  fullWidth
                  data-testid="mobile-bottom-tips-catalog"
                  className="!min-h-11 !h-11 !text-xs"
                >
                  <LayoutGrid className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">Lihat Katalog</span>
                </LinkButton>
              </div>
            ),
          }
        : null,
    }),
    [resolved]
  );

  useAdaptiveNavConfig(adaptiveNavConfig);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
      const scrollContainer = document.getElementById('app-scroll-container');
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    }
  }, [id]);

  if (!resolved) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-5">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Material &amp; Finishing
        </p>
        <h1 className="text-xl sm:text-3xl font-semibold text-[var(--text)]">
          Spesifikasi Bahan Tidak Ditemukan
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
          Data material atau finishing yang Anda cari tidak tersedia atau telah berubah.
        </p>
        <div className="pt-2">
          <LinkButton to="/tips-interior" variant="primary" size="md">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Kembali ke Tips Interior
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <MaterialDetailContent
        material={resolved.item}
        relatedMaterials={resolved.relatedMaterials}
      />
    </div>
  );
}
