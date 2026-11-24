import { useMemo, useState, type FormEvent } from 'react';
import { ImagePlus, Search } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { Input, Select, Textarea } from '../../../../components/ui/form-controls';
import { ImageFallback } from '../../../../components/ui/image-fallback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  buildNewsImageTagsMarkup,
  type NewsImageAspectRatio,
  type NewsImageDisplayMode,
  type NewsImageGridCols,
} from '../../../../lib/news-content';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import {
  PRESET_NEWS_COVERS,
  createEmptyNewsDraft,
  normalizeNewsFromDraft,
  slugifyNewsTitle,
  toNewsFormDraft,
  validateNewsDraft,
  type NewsFormDraft,
} from './logic';

const BACK_PATH = '/admin/informasi/berita';

export default function AdminBeritaFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const newsArticles = useSiteContentStore((state) => state.newsArticles);
  const upsertNewsArticle = useSiteContentStore((state) => state.upsertNewsArticle);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'informasi.edit');

  const isEditMode = Boolean(id);
  const existingArticle = useMemo(
    () => (id ? newsArticles.find((a) => a.id === id) ?? null : null),
    [id, newsArticles]
  );

  const [values, setValues] = useState<NewsFormDraft>(() =>
    existingArticle
      ? toNewsFormDraft(existingArticle)
      : createEmptyNewsDraft(currentUser?.nama)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  // Customizer Sisipkan Blok Gambar Konten
  const [imgUrlsInput, setImgUrlsInput] = useState('/sample-produk/gambar/kitchen-set-detail.webp');
  const [imgMode, setImgMode] = useState<NewsImageDisplayMode>('crop');
  const [imgRatio, setImgRatio] = useState<NewsImageAspectRatio>('16/9');
  const [imgGrid, setImgGrid] = useState<NewsImageGridCols>('auto');
  const [imgCaption, setImgCaption] = useState('');
  const [insertFeedback, setInsertFeedback] = useState<string | null>(null);

  useDocumentTitle(
    `${isEditMode ? 'Edit Berita SEO' : 'Tulis Berita SEO Baru'} | Informasi Admin ${shortBrandName}`
  );

  const handleInsertImageBlock = () => {
    const parsedUrls = imgUrlsInput
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    const markup = buildNewsImageTagsMarkup({
      urls: parsedUrls,
      mode: imgMode,
      ratio: imgMode === 'fit' ? undefined : imgRatio,
      grid: imgGrid,
      caption: imgCaption,
    });

    if (!markup) {
      setInsertFeedback('Masukkan minimal 1 URL atau path gambar yang valid.');
      return;
    }

    setValues((prev) => ({
      ...prev,
      bodyText: prev.bodyText.trim() ? `${prev.bodyText.trimEnd()}\n\n${markup}` : markup,
    }));
    setInsertFeedback('Blok gambar berhasil disisipkan ke akhir Isi Artikel.');
    setImgCaption('');
  };

  const sections = useMemo<AdminFormSectionConfig<NewsFormDraft>[]>(
    () => [
      {
        id: 'konten-utama',
        title: 'Judul, Kategori & Isi Artikel',
        columns: 2,
        fields: [
          {
            name: 'judul',
            label: 'Judul Berita / Artikel',
            type: 'text',
            required: true,
            colSpan: 'full',
            onValueChange: (nextVal, prev) => {
              const str = String(nextVal ?? '');
              const shouldAutoSlug = !prev.slug || prev.slug === slugifyNewsTitle(prev.judul);
              if (shouldAutoSlug) {
                return { slug: slugifyNewsTitle(str) };
              }
            },
          },
          {
            name: 'slug',
            label: 'Slug URL (otomatis untuk Google)',
            type: 'text',
            hint: (v) => `/berita/${v.slug || 'slug-artikel'}`,
          },
          {
            name: 'kategori',
            label: 'Kategori Berita',
            type: 'text',
            required: true,
          },
          {
            name: 'namaPenulis',
            label: 'Penulis (Opsional — hanya untuk Tips)',
            type: 'text',
            placeholder: 'Kosongkan untuk berita resmi Shansus Dzar',
          },
          {
            name: 'tanggalTerbit',
            label: 'Tanggal Terbit',
            type: 'date',
          },
          {
            name: 'ringkasan',
            label: 'Ringkasan Pembuka (Excerpt)',
            type: 'textarea',
            rows: 2,
            required: true,
            colSpan: 'full',
          },
          {
            name: 'bodyText',
            label: 'Isi Artikel Lengkap',
            type: 'textarea',
            rows: 8,
            required: true,
            colSpan: 'full',
            hint: 'Pisahkan antar paragraf dengan baris kosong. Tag gambar mendukung mode="crop|full|fit", ratio="16/9|4/3|1/1|4/5|3/4|21/9", grid="1|2|3" (3 grid desktop, maks 2 grid mobile), serta caption="...". Gunakan panel Sisipkan Blok Gambar di sebelah kanan.',
          },
        ],
      },
      {
        id: 'gambar-sampul',
        title: 'Foto Sampul & Alt Image SEO',
        columns: 2,
        fields: [
          {
            name: 'coverPreset',
            label: 'Pilih Foto Sampul',
            type: 'select',
            options: [
              { value: '', label: 'URL Kustom / Manual' },
              ...PRESET_NEWS_COVERS.map((img) => ({ value: img.url, label: img.label })),
            ],
            onValueChange: (nextVal) => {
              const val = String(nextVal ?? '');
              if (val) return { gambarSampul: val };
            },
          },
          {
            name: 'gambarSampul',
            label: 'Path / URL Gambar Sampul',
            type: 'text',
            onValueChange: (nextVal) => ({
              coverPreset: PRESET_NEWS_COVERS.some((img) => img.url === String(nextVal ?? ''))
                ? String(nextVal)
                : '',
            }),
          },
          {
            name: 'teksAltSampul',
            label: 'Teks Alt Gambar (SEO Google Image)',
            type: 'text',
            colSpan: 'full',
            hint: 'Jelaskan isi foto secara alami dengan kata kunci layanan.',
          },
        ],
      },
      {
        id: 'metadata-seo',
        title: 'Metadata SEO Google & Publikasi',
        description:
          'Optimalkan judul, deskripsi meta, dan kata kunci target agar artikel mudah ditemukan di mesin pencari Google.',
        columns: 2,
        fields: [
          {
            name: 'judulSeo',
            label: 'Judul SEO Google',
            type: 'text',
            colSpan: 'full',
            placeholder: 'Kosongkan untuk menggunakan judul utama artikel',
            hint: (v) => `${v.judulSeo.length}/60 karakter ideal`,
          },
          {
            name: 'deskripsiSeo',
            label: 'Meta Description Google',
            type: 'textarea',
            rows: 2,
            colSpan: 'full',
            placeholder: 'Ringkasan menarik 120–160 karakter untuk hasil pencarian Google',
            hint: (v) => `${v.deskripsiSeo.length}/160 karakter ideal`,
          },
          {
            name: 'keywordsText',
            label: 'Kata Kunci Target (pisahkan dengan koma)',
            type: 'text',
            colSpan: 'full',
            hint: 'Contoh: kitchen set purwakarta, jasa interior karawang, lemari custom',
          },
          {
            name: 'terbit',
            label: 'Terbitkan ke Halaman Informasi Publik',
            type: 'checkbox',
          },
          {
            name: 'unggulan',
            label: 'Jadikan Berita Utama (Featured)',
            type: 'checkbox',
          },
        ],
      },
    ],
    []
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validateNewsDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const normalized = normalizeNewsFromDraft(values, shortBrandName);
    upsertNewsArticle(normalized);
    recordActivity(
      isEditMode ? 'Memperbarui berita SEO' : 'Menerbitkan berita SEO baru',
      'Berita & Informasi',
      normalized.judul
    );

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: `Artikel "${normalized.judul}" berhasil disimpan.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={isEditMode ? `Edit Berita: ${values.judul || id}` : 'Tulis Berita & Artikel SEO Baru'}
      description="Optimalkan judul, ringkasan, URL slug, dan kata kunci agar artikel mudah ditemukan di mesin pencari."
      backTo={BACK_PATH}
      backLabel="Kembali ke Daftar Berita"
      submitLabel="Simpan Berita"
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      notFoundState={
        isEditMode && !existingArticle
          ? {
              title: 'Artikel Berita Tidak Ditemukan',
              message: 'Artikel yang Anda cari tidak tersedia atau telah dihapus.',
            }
          : undefined
      }
      aside={
        <div className="space-y-4">
          <AdminFormSectionCard
            title="Pratinjau Hasil Google"
            description="Simulasi tampilan artikel pada hasil pencarian."
          >
            <div className="space-y-3">
              <div className="rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)] bg-[var(--surface-muted)]">
                <ImageFallback
                  src={values.gambarSampul}
                  alt={values.teksAltSampul || values.judul}
                  aspectRatio="16/9"
                  className="rounded-none border-0"
                />
              </div>
              <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-1">
                <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 truncate">
                  <Search className="size-3 shrink-0" aria-hidden="true" />
                  /berita/{values.slug || slugifyNewsTitle(values.judul) || 'slug-artikel'}
                </p>
                <p className="text-sm font-semibold text-[var(--accent)] leading-snug line-clamp-2">
                  {values.judulSeo.trim() || values.judul.trim() || 'Judul Artikel SEO'}
                </p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-3">
                  {values.deskripsiSeo.trim() ||
                    values.ringkasan.trim() ||
                    'Meta description artikel akan muncul di sini.'}
                </p>
              </div>
            </div>
          </AdminFormSectionCard>

          <AdminFormSectionCard
            title="Sisipkan Blok Gambar Konten"
            description="Atur tampilan gambar penuh, natural, atau ter-crop dan grid 1–3 kolom untuk disisipkan ke Isi Artikel."
          >
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="builder-preset" className="block text-xs font-medium text-[var(--text)]">
                  Tambah dari Koleksi Foto
                </label>
                <Select
                  id="builder-preset"
                  value=""
                  disabled={!canEdit}
                  onValueChange={(nextUrl) => {
                    if (!nextUrl) return;
                    setImgUrlsInput((prev) =>
                      prev.trim() ? `${prev.trimEnd()}\n${nextUrl}` : nextUrl
                    );
                    setInsertFeedback(null);
                  }}
                  options={[
                    { value: '', label: '+ Pilih foto studio/proyek...' },
                    ...PRESET_NEWS_COVERS.map((img) => ({ value: img.url, label: img.label })),
                  ]}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="builder-urls" className="block text-xs font-medium text-[var(--text)]">
                  Daftar Path / URL Gambar (1 baris = 1 gambar)
                </label>
                <Textarea
                  id="builder-urls"
                  rows={3}
                  disabled={!canEdit}
                  value={imgUrlsInput}
                  onChange={(e) => {
                    setImgUrlsInput(e.target.value);
                    setInsertFeedback(null);
                  }}
                  placeholder="/sample-produk/gambar/kitchen-set-detail.webp"
                  className="text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label htmlFor="builder-mode" className="block text-xs font-medium text-[var(--text)]">
                    Mode Gambar
                  </label>
                  <Select
                    id="builder-mode"
                    value={imgMode}
                    disabled={!canEdit}
                    onValueChange={(val) => setImgMode(val as NewsImageDisplayMode)}
                    options={[
                      { value: 'crop', label: 'Di-crop Rapi' },
                      { value: 'full', label: 'Full Kanan–Kiri' },
                      { value: 'fit', label: 'Sesuai Gambar Asli' },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="builder-grid" className="block text-xs font-medium text-[var(--text)]">
                    Grid Kolom
                  </label>
                  <Select
                    id="builder-grid"
                    value={imgGrid}
                    disabled={!canEdit}
                    onValueChange={(val) => setImgGrid(val as NewsImageGridCols)}
                    options={[
                      { value: 'auto', label: 'Otomatis' },
                      { value: '1', label: '1 Kolom Penuh' },
                      { value: '2', label: '2 Grid Horizontal' },
                      { value: '3', label: '3 Grid Desktop (Maks 2 Mobile)' },
                    ]}
                  />
                </div>
              </div>

              {imgMode !== 'fit' && (
                <div className="space-y-1">
                  <label htmlFor="builder-ratio" className="block text-xs font-medium text-[var(--text)]">
                    Rasio Potong (Crop Ratio)
                  </label>
                  <Select
                    id="builder-ratio"
                    value={imgRatio}
                    disabled={!canEdit}
                    onValueChange={(val) => setImgRatio(val as NewsImageAspectRatio)}
                    options={[
                      { value: '16/9', label: '16:9 · Landscape Lebar' },
                      { value: '4/3', label: '4:3 · Standar Editorial' },
                      { value: '1/1', label: '1:1 · Persegi' },
                      { value: '4/5', label: '4:5 · Potret Rapi' },
                      { value: '3/4', label: '3:4 · Potret Tinggi' },
                      { value: '21/9', label: '21:9 · Sinematik Panorama' },
                    ]}
                  />
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="builder-caption" className="block text-xs font-medium text-[var(--text)]">
                  Keterangan / Sumber Gambar (Opsional)
                </label>
                <Input
                  id="builder-caption"
                  type="text"
                  disabled={!canEdit}
                  value={imgCaption}
                  onChange={(e) => setImgCaption(e.target.value)}
                  placeholder="Contoh: Dokumentasi 1 · Detail sambungan HPL"
                  className="text-xs"
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                fullWidth
                disabled={!canEdit}
                onClick={handleInsertImageBlock}
              >
                <ImagePlus className="size-3.5" aria-hidden="true" />
                Sisipkan ke Isi Artikel
              </Button>

              {insertFeedback && (
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  {insertFeedback}
                </p>
              )}
            </div>
          </AdminFormSectionCard>
        </div>
      }
    />
  );
}
