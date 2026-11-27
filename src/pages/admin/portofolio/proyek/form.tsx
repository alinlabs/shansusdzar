import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Star, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { DimensionInput } from '../../../../components/ui/dimension-input';
import { FormField, Input, Textarea } from '../../../../components/ui/form-controls';
import { ImageFallback } from '../../../../components/ui/image-fallback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { parseDimensionParts } from '../../../../lib/dimension-format';
import { formatPortfolioDimensionSummary } from '../../../../lib/portfolio-filter';
import { formatCurrencyIDR } from '../../../../lib/price-format';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { PortfolioDimensionItem } from '../../../../types/cms';
import {
  PORTFOLIO_CLIENT_SALUTATIONS,
  PRESET_PORTFOLIO_IMAGES,
  computePortfolioAreaSqm,
  createEmptyPortfolioDraft,
  deriveClientInitials,
  formatPortfolioClientWithSalutation,
  getPortfolioSlug,
  normalizePortfolioFromDraft,
  toPortfolioFormDraft,
  validatePortfolioDraft,
  type PortfolioFormDraft,
} from './logic';

const BACK_PATH = '/admin/portofolio';

function toDimensionText(dim: PortfolioDimensionItem): string {
  return [
    dim.panjang > 0 ? String(dim.panjang) : '',
    dim.lebar > 0 ? String(dim.lebar) : '',
    dim.tinggi > 0 ? String(dim.tinggi) : '',
  ].join(' x ');
}

export default function AdminPortofolioFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const portfolioProjects = useSiteContentStore((state) => state.portfolioProjects);
  const upsertPortfolioProject = useSiteContentStore((state) => state.upsertPortfolioProject);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  const activeProducts = useMemo(
    () => (catalogOverride ?? loadedBaseCatalog)?.daftarProduk ?? [],
    [catalogOverride, loadedBaseCatalog]
  );

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'portofolio');

  const isEditMode = Boolean(id);
  const existingItem = useMemo(
    () => (id ? portfolioProjects.find((p) => p.id === id) ?? null : null),
    [id, portfolioProjects]
  );

  const [values, setValues] = useState<PortfolioFormDraft>(() =>
    existingItem
      ? toPortfolioFormDraft(existingItem)
      : createEmptyPortfolioDraft(portfolioProjects)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode ? 'Edit Portofolio' : 'Tambah Studi Kasus Portofolio'} | Admin ${shortBrandName}`
  );

  const productOptions = useMemo(
    () => [
      { value: '', label: 'Tidak tertaut ke produk katalog' },
      ...activeProducts.map((p) => ({
        value: p.id,
        label: `${p.nama} (${p.id})`,
      })),
    ],
    [activeProducts]
  );

  const sections = useMemo<AdminFormSectionConfig<PortfolioFormDraft>[]>(
    () => [
      {
        id: 'identitas-proyek',
        title: 'Identitas Proyek',
        mobileTabLabel: 'Identitas',
        errorFields: ['dimensi'],
        columns: 2,
        fields: [
          {
            name: 'judul',
            label: 'Judul Proyek',
            type: 'text',
            required: true,
            colSpan: 'full',
            placeholder: 'Contoh: Kitchen Set',
          },
          {
            name: 'produkId',
            label: 'Produk Katalog Terkait',
            type: 'select',
            options: productOptions,
            onValueChange: (nextVal, prev) => {
              const prodId = String(nextVal ?? '').trim();
              if (!prodId) return { produkId: '' };
              const matched = activeProducts.find((p) => p.id === prodId);
              if (!matched) return { produkId: prodId };
              return {
                produkId: prodId,
                ...(!prev.judul.trim() ? { judul: matched.nama } : {}),
              };
            },
          },
          {
            name: 'kategori',
            label: 'Kategori Ruangan',
            type: 'text',
            required: true,
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
            placeholder: 'Kosongkan untuk hitung otomatis',
          },
        ],
        renderContent: (ctx) => {
          const computedSqm = computePortfolioAreaSqm(ctx.values.dimensi);
          return (
            <div className="space-y-2.5 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-light tracking-[0.01em] text-[var(--text-muted)] tabular-nums">
                  Dimensi Proyek (cm · Panjang × Lebar × Tinggi) · {computedSqm} m²
                </p>
                {!ctx.readOnly && (
                  <button
                    type="button"
                    onClick={() =>
                      ctx.setFieldValue('dimensi', [
                        ...ctx.values.dimensi,
                        { panjang: 100, lebar: 60, tinggi: 200 },
                      ])
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    Tambah Unit Dimensi
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {ctx.values.dimensi.map((dim, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <DimensionInput
                      id={`pf-dimensi-${idx}`}
                      disabled={ctx.readOnly}
                      hasError={Boolean(ctx.errors.dimensi)}
                      value={toDimensionText(dim)}
                      onValueChange={(nextStr) => {
                        const [pStr, lStr, tStr] = parseDimensionParts(nextStr);
                        const nextDimensi = ctx.values.dimensi.map((row, rowIdx) =>
                          rowIdx === idx
                            ? {
                                panjang: Number(pStr) || 0,
                                lebar: Number(lStr) || 0,
                                tinggi: Number(tStr) || 0,
                              }
                            : row
                        );
                        ctx.setFieldValue('dimensi', nextDimensi);
                      }}
                    />
                    {!ctx.readOnly && ctx.values.dimensi.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Hapus baris dimensi ${idx + 1}`}
                        onClick={() => {
                          ctx.setFieldValue(
                            'dimensi',
                            ctx.values.dimensi.filter((_, rowIdx) => rowIdx !== idx)
                          );
                        }}
                        className="inline-flex items-center justify-center size-10 shrink-0 rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {ctx.errors.dimensi && (
                <p role="alert" className="text-xs font-medium text-[var(--danger)]">{ctx.errors.dimensi}</p>
              )}
            </div>
          );
        },
      },
      {
        id: 'narasi-studi-kasus',
        title: 'Narasi Proyek',
        mobileTabLabel: 'Narasi',
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
        title: 'Media & Publikasi',
        mobileTabLabel: 'Media',
        errorFields: ['gambarUtama', 'galeriGambar'],
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
            name: 'tampilDiBeranda',
            label: 'Tampilkan di Carousel Beranda',
            type: 'checkbox',
            colSpan: 'full',
          },
        ],
      },
      {
        id: 'ulasan-klien',
        title: 'Ulasan Klien',
        mobileTabLabel: 'Ulasan',
        columns: 2,
        fields: [
          {
            name: 'ulasanAktif',
            label: 'Sertakan Ulasan Klien',
            type: 'checkbox',
            colSpan: 'full',
          },
          {
            name: 'ulasanSapaan',
            label: 'Sapaan Klien',
            type: 'select',
            searchable: false,
            visibleWhen: (v) => v.ulasanAktif,
            options: [
              { value: '', label: 'Tanpa Sapaan' },
              ...PORTFOLIO_CLIENT_SALUTATIONS.map((s) => ({ value: s, label: s })),
            ],
          },
          {
            name: 'ulasanKlien',
            label: 'Nama Klien / Pengulas',
            type: 'text',
            required: true,
            placeholder: 'Contoh: Raka Pratama',
            visibleWhen: (v) => v.ulasanAktif,
          },
          {
            name: 'ulasanPenilaian',
            label: 'Penilaian Bintang (1–5)',
            type: 'select',
            required: true,
            colSpan: 'full',
            searchable: false,
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
    [productOptions, activeProducts]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validatePortfolioDraft(values, portfolioProjects);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const nextProject = normalizePortfolioFromDraft(values);
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

  const previewAreaSqm = computePortfolioAreaSqm(values.dimensi);
  const previewDimensionSummary = formatPortfolioDimensionSummary(values.dimensi);

  return (
    <AdminForm
      title={isEditMode ? 'Edit Portofolio' : 'Tambah Portofolio'}
      backTo={BACK_PATH}
      backLabel="Kembali"
      submitLabel="Simpan"
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      asideTabLabel="Pratinjau"
      notFoundState={
        isEditMode && !existingItem
          ? {
              title: 'Portofolio Tidak Ditemukan',
              message: 'Data portofolio tidak tersedia atau sudah dihapus.',
            }
          : undefined
      }
      aside={
        <>
          <AdminFormSectionCard title="Pratinjau Kartu">
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
                {previewDimensionSummary && (
                  <p className="text-xs text-[var(--text-muted)] tabular-nums">
                    {previewDimensionSummary} cm · {previewAreaSqm} m²
                  </p>
                )}
                {typeof values.referensiHarga === 'number' && values.referensiHarga > 0 && (
                  <p className="text-xs font-semibold text-[var(--text)] tabular-nums">
                    Referensi Harga: {formatCurrencyIDR(values.referensiHarga)}
                  </p>
                )}
                {values.ulasanAktif && values.ulasanKlien.trim() && (
                  <p className="text-xs text-[var(--text-muted)]">
                    Klien:{' '}
                    <span className="font-medium text-[var(--text)]">
                      {formatPortfolioClientWithSalutation({
                        sapaan: values.ulasanSapaan,
                        klien: values.ulasanKlien,
                      })}
                    </span>
                  </p>
                )}
                <p className="text-xs text-[var(--text-muted)] line-clamp-3">
                  {values.deskripsi.trim() || 'Ringkasan proyek akan tampil di sini.'}
                </p>
              </div>
            </div>
          </AdminFormSectionCard>

          {values.ulasanAktif && (
            <AdminFormSectionCard title="Pratinjau Ulasan">
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
                      {deriveClientInitials(values.ulasanKlien)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--text)] truncate">
                        {values.ulasanKlien.trim() || 'Nama Klien'}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">
                        {values.lokasi || values.kategori}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--text-subtle)] truncate">
                    Tautan: /portofolio/{getPortfolioSlug(values)}
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
