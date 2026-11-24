import { useMemo, useState } from 'react';
import { ArrowUpRight, RotateCcw, Search, X } from 'lucide-react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { RatingMeter } from '../../components/tips/rating-meter';
import { Input } from '../../components/ui/form-controls';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle, useJsonLdSchema } from '../../hooks/use-document-title';
import { filterMaterialSpecs } from '../../lib/informasi-filter';
import { buildTipsInteriorJsonLd } from '../../lib/seo-schema';
import { getRuntimeSiteOrigin } from '../../lib/site-url';
import { useSiteContentStore } from '../../store/site-content-store';

export default function TipsInteriorPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const materials = useSiteContentStore((state) => state.materials);

  useDocumentTitle(
    `Tips Material & Finishing Interior | ${businessConfig.namaMerekSingkat}`,
    'Informasi spesifikasi material utama ketebalan 18 mm (Blockboard, Multipleks, PVC Board) dan finishing/laminasi (HPL, Cat Duco) untuk interior custom.',
    {
      keywords: [
        'bahan interior furniture custom',
        'perbedaan blockboard multipleks pvc board 18 mm',
        'finishing hpl cat duco terbuat dari apa',
      ],
    }
  );

  const originUrl = getRuntimeSiteOrigin();

  const tipsSchema = useMemo(
    () => buildTipsInteriorJsonLd(materials, businessConfig, originUrl),
    [materials, businessConfig, originUrl]
  );
  useJsonLdSchema('shansusdzar-tips-interior-schema', tipsSchema);

  const [searchParams] = useSearchParams();
  const requestedMaterialId = searchParams.get('material');

  const [materialSearch, setMaterialSearch] = useState('');

  const filteredMaterials = useMemo(
    () => filterMaterialSpecs(materials, 'all', materialSearch),
    [materials, materialSearch]
  );

  const hasActiveFilter = materialSearch.trim().length > 0;

  if (requestedMaterialId) {
    return (
      <Navigate
        to={`/tips-interior/${encodeURIComponent(requestedMaterialId)}`}
        replace
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-10">
      {/* SECTION 1: MATERIAL UTAMA & FINISHING (NAVIGATES TO DEDICATED DETAIL PAGE) */}
      <section
        id="material-matrix-heading"
        aria-label="Tips Bahan dan Informasi Material Interior"
        className="space-y-4 sm:space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3.5 sm:gap-4">
          <SectionHeading
            as="h1"
            eyebrow="Material & Finishing"
            title="Tips Bahan & Informasi Interior"
            className="min-w-0 [&_h1]:text-[22px] [&_h1]:sm:text-3xl [&_h1]:lg:text-4xl"
          />

          <div className="relative w-full md:w-80 shrink-0">
            <label htmlFor="material-search" className="sr-only">
              Cari spesifikasi bahan interior
            </label>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <Input
              id="material-search"
              type="text"
              enterKeyHint="search"
              value={materialSearch}
              onChange={(e) => setMaterialSearch(e.target.value)}
              placeholder="Cari Blockboard, PVC, HPL..."
              className="pl-10 pr-10 text-sm outline-none focus:outline-none focus-visible:outline-none focus:border-[var(--border-strong)] focus-visible:border-[var(--border-strong)]"
            />
            {materialSearch.trim().length > 0 && (
              <button
                type="button"
                aria-label="Hapus kata kunci pencarian bahan"
                onClick={() => setMaterialSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-8 rounded-[calc(var(--radius-md)-2px)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {hasActiveFilter && (
          <div className="flex items-center justify-end text-xs text-[var(--text-muted)]">
            <button
              type="button"
              onClick={() => setMaterialSearch('')}
              className="inline-flex items-center gap-1.5 font-medium text-[var(--text)] hover:underline cursor-pointer"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset Filter
            </button>
          </div>
        )}

        {filteredMaterials.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 text-center space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Tidak ada spesifikasi bahan yang cocok dengan kata kunci tersebut.
            </p>
            <button
              type="button"
              onClick={() => setMaterialSearch('')}
              className="inline-flex items-center gap-1.5 min-h-10 px-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset Pencarian Bahan
            </button>
          </div>
        ) : (
          <div
            data-testid="tips-materials-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6"
          >
            {filteredMaterials.map((item) => {
              const typeSummary =
                item.kategori === 'papan' ? 'Material Utama · 18 mm' : 'Finishing & Laminasi';

              return (
                <article
                  key={item.id}
                  id={item.id}
                  data-testid={`material-card-${item.id}`}
                  className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] card-hover-surface overflow-hidden"
                >
                  <Link
                    to={`/tips-interior/${item.id}`}
                    aria-label={`Lihat detail bahan ${item.nama}`}
                    className="group w-full h-full p-4 sm:p-5 text-left flex flex-col justify-between gap-3.5 sm:gap-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus)]"
                  >
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-[11.5px] font-medium text-[var(--text-muted)]">
                            {typeSummary}
                          </p>
                          <h2 className="text-base sm:text-[17px] font-semibold text-[var(--text)] leading-snug group-hover:underline">
                            {item.nama}
                          </h2>
                        </div>
                        <ArrowUpRight
                          className="size-4 shrink-0 mt-1 text-[var(--text-muted)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--text)]"
                          aria-hidden="true"
                        />
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-1 gap-2.5 sm:gap-2.5 pt-1 sm:pt-0">
                        <RatingMeter
                          value={item.ketahananLembap}
                          label="Ketahanan Lembap"
                          mobileLabel="Lembap"
                          compact
                        />
                        <RatingMeter
                          value={item.peringkatKeawetan}
                          label="Kekuatan Struktur"
                          mobileLabel="Struktur"
                          compact
                        />
                        <RatingMeter
                          value={item.keterjangkauan}
                          label="Keterjangkauan"
                          mobileLabel="Ekonomis"
                          compact
                        />
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[var(--border)]/70 space-y-0.5">
                      <p className="text-[11.5px] font-medium text-[var(--text)]">Cocok untuk:</p>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-1 sm:line-clamp-2">
                        {item.cocokUntuk.join(' · ')}
                      </p>
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
