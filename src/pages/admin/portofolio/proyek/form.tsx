import { useMemo, useState, type FormEvent } from 'react';
import { Star } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { FormField, Input, Textarea } from '../../../../components/ui/form-controls';
import { ImageFallback } from '../../../../components/ui/image-fallback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatCurrencyIDR } from '../../../../lib/price-format';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import {
  PRESET_PORTFOLIO_IMAGES,
  createEmptyPortfolioDraft,
  deriveClientInitials,
  normalizePortfolioFromDraft,
  slugifyPortfolioTitle,
  toPortfolioFormDraft,
  validatePortfolioDraft,
  type PortfolioFormDraft,
} from './logic';

const BACK_PATH = '/admin/portofolio';

export default function AdminPortofolioFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const portfolioProjects = useSiteContentStore((state) => state.portfolioProjects);
  const upsertPortfolioProject = useSiteContentStore((state) => state.upsertPortfolioProject);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'portofolio.edit');

  const isEditMode = Boolean(id);
  const existingItem = useMemo(
    () => (id ? portfolioProjects.find((p) => p.id === id) ?? null : null),
    [id, portfolioProjects]
  );

  const [values, setValues] = useState<PortfolioFormDraft>(() =>
    existingItem
      ? toPortfolioFormDraft(existingItem)
      : createEmptyPortfolioDraft(portfolioProjects.length + 1)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode ? 'Edit Portofolio' : 'Tambah Studi Kasus Portofolio'} | Admin ${shortBrandName}`
  );

  const sections = useMemo<AdminFormSectionConfig<PortfolioFormDraft>[]>(
    () => [
      {
        id: 'identitas-proyek',
        title: 'Identitas & Konteks Studi Kasus',
        columns: 2,
        fields: [
          {
            name: 'judul',
            label: 'Judul Proyek',
            type: 'text',
            required: true,
            placeholder: 'Contoh: Kitchen Set Japandi Puri Nirwana',
            onValueChange: (nextVal, prev) => {
              const str = String(nextVal ?? '');
              const isNewOrAutoSlug =
                prev.slug.startsWith('proyek-baru-') ||
                prev.slug === slugifyPortfolioTitle(prev.judul);
              if (isNewOrAutoSlug) {
                return { slug: slugifyPortfolioTitle(str) };
              }
            },
          },
          {
            name: 'slug',
            label: 'Slug URL (/portofolio/...)',
            type: 'text',
            required: true,
            hint: (v) => `/portofolio/${v.slug || 'slug-proyek'}`,
          },
          {
            name: 'kategori',
            label: 'Kategori Ruangan',
            type: 'text',
            required: true,
          },
          {
            name: 'namaKlien',
            label: 'Klien / Konteks',
            type: 'text',
          },
          {
            name: 'lokasi',
            label: 'Kota / Lokasi',
            type: 'text',
          },
          {
            name: 'cakupan',
            label: 'Cakupan Pekerjaan',
            type: 'text',
          },
          {
            name: 'tahun',
            label: 'Tahun Pengerjaan',
            type: 'text',
          },
          {
            name: 'luasMeterPersegi',
            label: 'Luas Bidang (m²)',
            type: 'number',
            min: 1,
          },
          {
            name: 'ringkasanDimensi',
            label: 'Ringkasan Dimensi',
            type: 'text',
          },
          {
            name: 'durasi',
            label: 'Durasi Pengerjaan',
            type: 'text',
          },
          {
            name: 'catatanMaterial',
            label: 'Ringkasan Material',
            type: 'text',
          },
          {
            name: 'catatanFinishing',
            label: 'Ringkasan Finishing/Laminasi',
            type: 'text',
          },
          {
            name: 'referensiHarga',
            label: 'Referensi Harga Proyek (IDR)',
            type: 'currency',
            zeroAsEmpty: true,
            colSpan: 'full',
            hint: 'Gambaran estimasi biaya pengerjaan bagi calon pelanggan. Kosongkan untuk menghitung otomatis dari produk katalog.',
          },
        ],
      },
      {
        id: 'narasi-studi-kasus',
        title: 'Narasi, Tantangan & Solusi Eksekusi',
        columns: 2,
        fields: [
          {
            name: 'deskripsi',
            label: 'Ringkasan Proyek',
            type: 'textarea',
            rows: 3,
            required: true,
            colSpan: 'full',
          },
          {
            name: 'tantangan',
            label: 'Tantangan Ruang',
            type: 'textarea',
            rows: 4,
          },
          {
            name: 'solusi',
            label: 'Solusi & Eksekusi',
            type: 'textarea',
            rows: 4,
          },
          {
            name: 'materialsText',
            label: 'Rincian Material Terpakai (1 per baris)',
            type: 'textarea',
            rows: 3,
            colSpan: 'full',
          },
        ],
      },
      {
        id: 'media-visibilitas',
        title: 'Dokumentasi Foto & Status Terbit',
        renderContent: (ctx) => (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FormField id="pf-cover-url" label="Gambar Utama (Cover)">
                  <Input
                    id="pf-cover-url"
                    disabled={ctx.readOnly}
                    value={ctx.values.gambarUtama}
                    onChange={(e) => ctx.setFieldValue('gambarUtama', e.target.value)}
                  />
                </FormField>
                {!ctx.readOnly && (
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_PORTFOLIO_IMAGES.map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => ctx.setFieldValue('gambarUtama', preset.url)}
                        className="px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <FormField id="pf-gallery-urls" label="Galeri Foto (1 URL per baris)">
                <Textarea
                  id="pf-gallery-urls"
                  rows={4}
                  disabled={ctx.readOnly}
                  value={ctx.values.galleryText}
                  onChange={(e) => ctx.setFieldValue('galleryText', e.target.value)}
                />
              </FormField>
            </div>
          </div>
        ),
        fields: [
          {
            name: 'teksAlt',
            label: 'Teks Alt Dokumentasi Foto (SEO)',
            type: 'text',
            colSpan: 'full',
          },
          {
            name: 'terbit',
            label: 'Terbitkan ke Halaman Portofolio Publik',
            type: 'checkbox',
          },
          {
            name: 'tampilDiBeranda',
            label: 'Tampilkan di Carousel Beranda',
            type: 'checkbox',
          },
        ],
      },
      {
        id: 'ulasan-klien',
        title: 'Ulasan & Testimoni Klien',
        description:
          'Setiap ulasan klien melekat langsung pada studi kasus proyek ini sehingga pengunjung dapat menelusuri hasil pengerjaan aslinya.',
        columns: 2,
        fields: [
          {
            name: 'ulasanAktif',
            label: 'Tampilkan Ulasan Klien untuk Proyek Ini',
            checkboxDescription:
              'Aktifkan untuk menayangkan testimoni ini di carousel Ulasan Klien Beranda dan halaman detail proyek.',
            type: 'checkbox',
            colSpan: 'full',
            onValueChange: (nextVal, prev) => {
              if (Boolean(nextVal) && !prev.ulasanNamaPengulas.trim() && prev.namaKlien.trim()) {
                return {
                  ulasanNamaPengulas: prev.namaKlien.trim(),
                  ulasanInisial:
                    prev.ulasanInisial.trim() || deriveClientInitials(prev.namaKlien),
                };
              }
            },
          },
          {
            name: 'ulasanNamaPengulas',
            label: 'Nama Pengulas / Klien',
            type: 'text',
            required: true,
            placeholder: 'Contoh: Raka Pratama',
            visibleWhen: (v) => v.ulasanAktif,
            onValueChange: (nextVal, prev) => {
              const str = String(nextVal ?? '');
              if (
                !prev.ulasanInisial ||
                prev.ulasanInisial === deriveClientInitials(prev.ulasanNamaPengulas)
              ) {
                return { ulasanInisial: deriveClientInitials(str) };
              }
            },
          },
          {
            name: 'ulasanInisial',
            label: 'Inisial Avatar (2–3 huruf)',
            type: 'text',
            maxLength: 3,
            placeholder: 'RP',
            visibleWhen: (v) => v.ulasanAktif,
          },
          {
            name: 'ulasanPenilaian',
            label: 'Penilaian Bintang (1–5)',
            type: 'select',
            required: true,
            colSpan: 'full',
            visibleWhen: (v) => v.ulasanAktif,
            options: [
              { value: '5', label: '5 Bintang — Sangat Puas' },
              { value: '4', label: '4 Bintang — Puas' },
              { value: '3', label: '3 Bintang — Cukup' },
              { value: '2', label: '2 Bintang — Kurang' },
              { value: '1', label: '1 Bintang — Buruk' },
            ],
            onValueChange: (nextVal) => ({
              ulasanPenilaian: Number(nextVal) || 5,
            }),
          },
          {
            name: 'ulasanKomentar',
            label: 'Kutipan Ulasan / Testimoni Klien',
            type: 'textarea',
            rows: 4,
            required: true,
            colSpan: 'full',
            visibleWhen: (v) => v.ulasanAktif,
            placeholder:
              'Tuliskan pengalaman nyata klien selama proses konsultasi, pengerjaan, hingga pemasangan proyek ini...',
          },
        ],
      },
    ],
    []
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validatePortfolioDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const nextProject = normalizePortfolioFromDraft(values, portfolioProjects);
    const isUpdate = portfolioProjects.some((p) => p.id === nextProject.id);
    upsertPortfolioProject(nextProject);
    recordActivity(
      isUpdate ? 'Memperbarui proyek portofolio' : 'Menambahkan proyek portofolio',
      'Portofolio',
      nextProject.judul
    );

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: `Portofolio "${nextProject.judul}" berhasil disimpan.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={isEditMode ? `Edit Portofolio: ${values.judul || id}` : 'Tambah Studi Kasus Portofolio'}
      description="Formulir penuh pengelolaan detail studi kasus, tantangan ruang, solusi, serta galeri foto."
      backTo={BACK_PATH}
      backLabel="Kembali ke Portofolio"
      submitLabel="Simpan Portofolio"
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      notFoundState={
        isEditMode && !existingItem
          ? {
              title: 'Portofolio Tidak Ditemukan',
              message: 'Data studi kasus portofolio yang Anda cari tidak tersedia atau telah dihapus.',
            }
          : undefined
      }
      aside={
        <>
          <AdminFormSectionCard
            title="Pratinjau Kartu Portofolio"
            description="Tampilan ringkas pada halaman Portofolio publik."
          >
            <div className="space-y-3">
              <div className="rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)] bg-[var(--surface-muted)]">
                <ImageFallback
                  src={values.gambarUtama}
                  alt={values.teksAlt || values.judul}
                  aspectRatio="4/3"
                  fallbackLabel={values.kategori}
                  className="rounded-none border-0"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[var(--text-muted)]">
                  {values.kategori} · {values.lokasi} · {values.tahun}
                </p>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {values.judul.trim() || 'Judul Proyek Portofolio'}
                </p>
                {typeof values.referensiHarga === 'number' && values.referensiHarga > 0 && (
                  <p className="text-xs font-semibold text-[var(--text)] tabular-nums">
                    Referensi Harga: {formatCurrencyIDR(values.referensiHarga)}
                  </p>
                )}
                <p className="text-xs text-[var(--text-muted)] line-clamp-3">
                  {values.deskripsi.trim() || 'Ringkasan proyek akan tampil di sini.'}
                </p>
              </div>
            </div>
          </AdminFormSectionCard>

          {values.ulasanAktif && (
            <AdminFormSectionCard
              title="Pratinjau Kartu Ulasan Terhubung"
              description="Pengunjung yang mengklik ulasan di Beranda akan diarahkan ke studi kasus ini."
            >
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text)] tabular-nums">
                    <Star className="size-3.5 fill-current text-[#b8862d] dark:text-[#d6a954]" aria-hidden="true" />
                    {(values.ulasanPenilaian || 5).toFixed(1)}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  &ldquo;{values.ulasanKomentar.trim() || 'Isi testimoni klien akan tampil di sini.'}&rdquo;
                </p>
                <div className="pt-2 border-t border-[var(--border)] space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-xs font-semibold text-[var(--text)] shrink-0">
                      {values.ulasanInisial.trim() ||
                        deriveClientInitials(values.ulasanNamaPengulas)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text)] truncate">
                        {values.ulasanNamaPengulas.trim() || 'Nama Pengulas'}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">
                        {values.lokasi || values.kategori}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--text-subtle)] truncate">
                    Tautan: /portofolio/{values.slug || 'slug-proyek'}
                  </p>
                </div>
              </div>
            </AdminFormSectionCard>
          )}
        </>
      }
    />
  );
}
