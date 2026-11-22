import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, RotateCcw, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { LinkButton } from '../../components/ui/button';
import { Input } from '../../components/ui/form-controls';
import { ImageFallback } from '../../components/ui/image-fallback';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle, useJsonLdSchema } from '../../hooks/use-document-title';
import {
  ALL_NEWS_CATEGORIES,
  extractNewsCategories,
  filterMaterialSpecs,
  filterNewsArticles,
} from '../../lib/informasi-filter';
import { buildTipsInteriorJsonLd } from '../../lib/seo-schema';
import { useSiteContentStore } from '../../store/site-content-store';
import type { MaterialCategory, MaterialSpecItem } from '../../types/cms';

const MATERIAL_CATEGORY_TABS: { value: MaterialCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua Material' },
  { value: 'papan', label: 'Material Utama' },
  { value: 'finishing', label: 'Finishing/Laminasi' },
];

function formatArticleDate(isoDate: string): string {
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

function RatingMeter({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(1, Math.min(5, Math.round(value)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-muted)]">{label}</span>
        <span className="font-medium text-[var(--text)] tabular-nums">{clamped}/5</span>
      </div>
      <div className="grid grid-cols-5 gap-1" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((step) => (
          <span
            key={step}
            className={[
              'h-1.5 rounded-full',
              step <= clamped ? 'bg-[var(--accent)]' : 'bg-[var(--surface-muted)]',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  );
}

export default function TipsInteriorPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const newsArticles = useSiteContentStore((state) => state.newsArticles);
  const materials = useSiteContentStore((state) => state.materials);
  const policies = useSiteContentStore((state) => state.policies);

  const [articleCategory, setArticleCategory] = useState(ALL_NEWS_CATEGORIES);
  const [articleSearch, setArticleSearch] = useState('');

  const articleCategories = useMemo(
    () => extractNewsCategories(newsArticles),
    [newsArticles]
  );
  const publishedArticles = useMemo(
    () => filterNewsArticles(newsArticles, ALL_NEWS_CATEGORIES, ''),
    [newsArticles]
  );
  const filteredArticles = useMemo(
    () => filterNewsArticles(newsArticles, articleCategory, articleSearch),
    [newsArticles, articleCategory, articleSearch]
  );

  useDocumentTitle(
    `Tips Interior, Berita & Panduan Material | ${businessConfig.namaMerekSingkat}`,
    'Berita terbaru workshop, panduan penataan ruangan, perbandingan material utama berketebalan seragam 18 mm (Blockboard, Multipleks, PVC Board), finishing (HPL, Cat Duco), dan standar layanan.',
    {
      keywords: [
        'berita interior purwakarta',
        'tips interior minimalis',
        'panduan material kitchen set 18mm',
        'perbandingan blockboard multipleks pvc board 18 mm',
        'finishing/laminasi hpl cat duco',
      ],
    }
  );

  const originUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://sdi-furniture.vercel.app';

  const tipsSchema = useMemo(
    () => buildTipsInteriorJsonLd(publishedArticles, businessConfig, originUrl),
    [publishedArticles, businessConfig, originUrl]
  );
  useJsonLdSchema('shansusdzar-tips-interior-schema', tipsSchema);

  const [searchParams] = useSearchParams();
  const requestedKategori = searchParams.get('kategori');
  const initialMaterialCategory: MaterialCategory | 'all' =
    requestedKategori === 'papan' || requestedKategori === 'finishing'
      ? requestedKategori
      : 'all';

  const [materialCategory, setMaterialCategory] = useState<MaterialCategory | 'all'>(
    initialMaterialCategory
  );
  const [materialSearch, setMaterialSearch] = useState('');
  const [comparedIds, setComparedIds] = useState<string[]>(() =>
    materials.slice(0, 2).map((m) => m.id)
  );

  useEffect(() => {
    if (requestedKategori === 'papan' || requestedKategori === 'finishing') {
      setMaterialCategory(requestedKategori);
    }
  }, [requestedKategori]);

  const filteredMaterials = useMemo(
    () => filterMaterialSpecs(materials, materialCategory, materialSearch),
    [materials, materialCategory, materialSearch]
  );

  const comparedMaterials = useMemo(
    () =>
      comparedIds
        .map((id) => materials.find((m) => m.id === id))
        .filter((m): m is MaterialSpecItem => Boolean(m)),
    [comparedIds, materials]
  );

  const toggleCompareMaterial = (id: string) => {
    setComparedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  return (
    <div className="space-y-10 sm:space-y-14">
      <div className="space-y-4">
        <SectionHeading
          as="h1"
          eyebrow="Tips, Berita & Ensiklopedia Teknis"
          title="Tips Interior, Berita & Panduan Material"
          description="Berita terbaru workshop, panduan menata ruang fungsional, serta acuan pemilihan material utama berketebalan seragam 18 mm (Blockboard, Multipleks, PVC Board) dan finishing (HPL, Cat Duco)."
        />
      </div>

      <section aria-labelledby="tips-guides-heading" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <SectionHeading
            id="tips-guides-heading"
            eyebrow="Berita & Panduan Ruang"
            title="Berita Workshop & Artikel Tips Interior"
            description="Publikasi kabar workshop, informasi jadwal survei lapangan, serta panduan praktis sebelum menentukan ukuran dan finishing/laminasi ruangan."
          />
          <Link
            to="/berita"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[var(--text)] hover:underline whitespace-nowrap shrink-0"
          >
            Semua Berita &amp; Artikel
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filter kategori berita dan tips"
            className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-5 border-b border-[var(--border)] overflow-x-auto md:flex-1"
          >
            {articleCategories.map((cat) => {
              const active = articleCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setArticleCategory(cat)}
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
            <label htmlFor="tips-news-search" className="sr-only">
              Cari berita dan tips interior
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <Input
              id="tips-news-search"
              type="text"
              value={articleSearch}
              onChange={(e) => setArticleSearch(e.target.value)}
              placeholder="Cari berita atau tips..."
              className="pl-9"
            />
          </div>
        </div>

        {filteredArticles.length === 0 ? (
          <div className="py-10 border-t border-[var(--border)] text-center space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              {publishedArticles.length === 0
                ? 'Belum ada berita atau artikel yang diterbitkan saat ini.'
                : 'Tidak ada berita atau tips yang cocok dengan filter atau kata kunci tersebut.'}
            </p>
            {publishedArticles.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setArticleCategory(ALL_NEWS_CATEGORIES);
                  setArticleSearch('');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text)] hover:underline cursor-pointer"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reset Filter Berita &amp; Tips
              </button>
            ) : (
              <LinkButton to="/berita" variant="secondary" size="sm">
                Buka Halaman Berita
              </LinkButton>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
            {filteredArticles.map((article) => (
              <article
                key={article.id}
                className="group flex flex-col justify-between gap-3.5 pb-6 border-b border-[var(--border)] md:border-b-0 md:pb-0"
              >
                <div className="space-y-3">
                  <Link
                    to={`/berita/${article.slug}`}
                    className="-mx-4 sm:mx-0 block overflow-hidden image-clip-frame sm:rounded-[var(--radius-md)]"
                  >
                    <ImageFallback
                      src={article.gambarSampul}
                      alt={article.teksAltSampul || article.judul}
                      aspectRatio="16/9"
                      fallbackLabel={article.kategori}
                      className="rounded-none border-0"
                      imgClassName="image-hover-zoom"
                    />
                  </Link>
                  <p className="text-xs text-[var(--text-muted)] tabular-nums">
                    {article.unggulan ? 'Berita Utama · ' : ''}
                    {article.kategori} ·{' '}
                    <time dateTime={article.tanggalTerbit}>
                      {formatArticleDate(article.tanggalTerbit)}
                    </time>{' '}
                    · {article.menitBaca} menit
                  </p>
                  <h2 className="text-base font-semibold text-[var(--text)] leading-snug">
                    <Link to={`/berita/${article.slug}`} className="hover:underline">
                      {article.judul}
                    </Link>
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed line-clamp-3">
                    {article.ringkasan}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-[var(--border)] flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--text-subtle)] truncate">
                    {article.namaPenulis}
                  </span>
                  <Link
                    to={`/berita/${article.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text)] hover:underline whitespace-nowrap shrink-0"
                  >
                    Baca Selengkapnya
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        aria-labelledby="material-matrix-heading"
        className="pt-8 border-t border-[var(--border)] space-y-6"
      >
        <SectionHeading
          id="material-matrix-heading"
          eyebrow="Ensiklopedia Teknis"
          title="Perbandingan Material Utama (18 mm) & Finishing/Laminasi"
          description="Seluruh material utama yang digunakan di Shansus Dzar Indonesia — baik Blockboard, Multipleks, maupun PVC Board — memiliki ketebalan yang sama yaitu 18 mm. Bandingkan karakter tiap bahan untuk menentukan spesifikasi ruang yang paling tepat."
        />

        <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs sm:text-sm text-[var(--text)] leading-relaxed">
          <span className="font-semibold">Standar Ketebalan 18 mm:</span>{' '}
          <span className="text-[var(--text-muted)]">
            Semua varian papan utama (<strong className="font-medium text-[var(--text)]">Blockboard</strong>,{' '}
            <strong className="font-medium text-[var(--text)]">Multipleks</strong>, dan{' '}
            <strong className="font-medium text-[var(--text)]">PVC Board</strong>) diproduksi menggunakan ketebalan seragam{' '}
            <strong className="font-medium text-[var(--text)]">18 mm</strong> untuk memastikan konstruksi kabinet tetap kokoh, rata, dan presisi.
          </span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filter kategori material"
            className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-5 border-b border-[var(--border)] overflow-x-auto md:flex-1"
          >
            {MATERIAL_CATEGORY_TABS.map((tab) => {
              const active = materialCategory === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMaterialCategory(tab.value)}
                  className={[
                    'relative min-h-11 py-2.5 text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                    active
                      ? 'text-[var(--text)] font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-[var(--accent)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72 shrink-0">
            <label htmlFor="material-search" className="sr-only">
              Cari spesifikasi material
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)]"
              aria-hidden="true"
            />
            <Input
              id="material-search"
              type="text"
              value={materialSearch}
              onChange={(e) => setMaterialSearch(e.target.value)}
              placeholder="Cari Blockboard, PVC Board, HPL..."
              className="pl-9"
            />
          </div>
        </div>

        {filteredMaterials.length === 0 ? (
          <div className="py-10 border-t border-[var(--border)] text-center space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Tidak ada spesifikasi material yang cocok dengan kata kunci tersebut.
            </p>
            <button
              type="button"
              onClick={() => {
                setMaterialCategory('all');
                setMaterialSearch('');
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text)] hover:underline cursor-pointer"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset Pencarian Material
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
            {filteredMaterials.map((item) => {
              const isCompared = comparedIds.includes(item.id);
              return (
                <article
                  key={item.id}
                  className="pt-5 border-t border-[var(--border)] flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs text-[var(--text-muted)]">
                        {item.kategori === 'papan'
                          ? 'Material Utama · Ketebalan 18 mm'
                          : 'Finishing/Laminasi'}{' '}
                        · Kelas {item.tingkatHarga}
                      </p>
                      <h3 className="text-base font-semibold text-[var(--text)] leading-snug">
                        {item.nama}
                      </h3>
                    </div>

                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                      {item.ringkasan}
                    </p>

                    <div className="space-y-2.5 pt-1">
                      <RatingMeter value={item.ketahananLembap} label="Ketahanan Lembap" />
                      <RatingMeter value={item.peringkatKeawetan} label="Kekuatan Struktur" />
                    </div>

                    <div className="space-y-1 pt-1">
                      <p className="text-xs font-medium text-[var(--text)]">Cocok untuk:</p>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        {item.cocokUntuk.join(' · ')}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--border)]/70 flex items-center justify-between gap-3">
                    <p className="text-xs text-[var(--text-subtle)] line-clamp-2">
                      Perawatan: {item.tipsPerawatan}
                    </p>
                    <button
                      type="button"
                      aria-pressed={isCompared}
                      onClick={() => toggleCompareMaterial(item.id)}
                      className={[
                        'min-h-9 px-3 py-1.5 rounded-[var(--radius-sm)] border text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer',
                        isCompared
                          ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-transparent'
                          : 'bg-transparent text-[var(--text)] border-[var(--border-strong)] hover:bg-[var(--surface-muted)]',
                      ].join(' ')}
                    >
                      {isCompared ? 'Dibandingkan' : 'Bandingkan'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {comparedMaterials.length > 0 && (
          <div className="pt-6 border-t border-[var(--border)] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">
                  Tabel Perbandingan Pilihan ({comparedMaterials.length}/3)
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Bandingkan langsung karakter material sebelum menentukan spesifikasi di perencana
                  kustom.
                </p>
              </div>
              <LinkButton to="/produk/custom" variant="secondary" size="sm">
                Buka Custom Interior
              </LinkButton>
            </div>
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
              <table className="w-full text-left text-sm border-y border-[var(--border)] border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)]">
                    <th className="py-3 pr-4 font-medium">Material</th>
                    <th className="py-3 px-4 font-medium">Ketebalan</th>
                    <th className="py-3 px-4 font-medium">Kelas Biaya</th>
                    <th className="py-3 px-4 font-medium">Tahan Lembap</th>
                    <th className="py-3 px-4 font-medium">Daya Tahan</th>
                    <th className="py-3 pl-4 font-medium">Rekomendasi Ruang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {comparedMaterials.map((mat) => (
                    <tr key={mat.id}>
                      <td className="py-3 pr-4 font-medium text-[var(--text)]">{mat.nama}</td>
                      <td className="py-3 px-4 text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                        {mat.kategori === 'papan' ? '18 mm' : 'Pelapis'}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-muted)]">{mat.tingkatHarga}</td>
                      <td className="py-3 px-4 tabular-nums text-[var(--text)]">
                        {mat.ketahananLembap}/5
                      </td>
                      <td className="py-3 px-4 tabular-nums text-[var(--text)]">
                        {mat.peringkatKeawetan}/5
                      </td>
                      <td className="py-3 pl-4 text-xs text-[var(--text-muted)]">
                        {mat.cocokUntuk.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section
        aria-labelledby="policy-heading"
        className="pt-8 border-t border-[var(--border)] space-y-6"
      >
        <SectionHeading
          id="policy-heading"
          eyebrow="Standar Layanan"
          title="Kebijakan Survei, Kualitas & Garansi"
          description="Komitmen pengerjaan mulai dari validasi ukuran lapangan hingga penyetelan purna jual."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
          {policies.map((policy, idx) => (
            <article
              key={policy.id}
              className="pt-5 border-t border-[var(--border)] space-y-2"
            >
              <p className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                0{idx + 1}. Standar Workshop
              </p>
              <h3 className="text-base font-semibold text-[var(--text)] leading-snug">
                {policy.judul}
              </h3>
              <p className="text-sm text-[var(--text)] leading-relaxed">{policy.ringkasan}</p>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed pt-1">
                {policy.rincian}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
