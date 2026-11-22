import { useMemo, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { ImageFallback } from '../../../../components/ui/image-fallback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
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

  useDocumentTitle(
    `${isEditMode ? 'Edit Berita SEO' : 'Tulis Berita SEO Baru'} | Informasi Admin ${shortBrandName}`
  );

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
            label: 'Penulis',
            type: 'text',
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
            label: 'Isi Artikel Lengkap (pisahkan antar paragraf dengan baris kosong)',
            type: 'textarea',
            rows: 8,
            required: true,
            colSpan: 'full',
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
        </div>
      }
    />
  );
}
