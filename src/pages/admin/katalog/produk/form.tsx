import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { FormField, Input, Textarea } from '../../../../components/ui/form-controls';
import { ImageFallback } from '../../../../components/ui/image-fallback';
import { resolveCatalogStartingPrice } from '../../../../lib/catalog-pricing';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import {
  PRESET_PRODUCT_IMAGES,
  createEmptyProductDraft,
  normalizeProductFromDraft,
  slugifyProduct,
  toProductFormDraft,
  validateProductDraft,
  type ProductFormDraft,
} from './logic';

const BACK_PATH = '/admin/produk';

export default function AdminKatalogFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const customPricing = useSiteContentStore((state) => state.customPricing);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);
  const upsertCatalogProduct = useSiteContentStore((state) => state.upsertCatalogProduct);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'katalog.edit');

  const activeCatalog = catalogOverride ?? loadedBaseCatalog;
  const products = activeCatalog?.daftarProduk ?? [];
  const isEditMode = Boolean(id);

  const existingProduct = useMemo(
    () => (id ? products.find((p) => p.id === id) ?? null : null),
    [id, products]
  );

  const [values, setValues] = useState<ProductFormDraft>(() =>
    existingProduct ? toProductFormDraft(existingProduct) : createEmptyProductDraft(products.length + 1)
  );
  const [initializedId, setInitializedId] = useState<string | null>(() =>
    existingProduct ? existingProduct.id : isEditMode ? null : '__new__'
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    if (isEditMode && existingProduct && initializedId !== existingProduct.id) {
      setValues(toProductFormDraft(existingProduct));
      setInitializedId(existingProduct.id);
    }
  }, [isEditMode, existingProduct, initializedId]);

  useDocumentTitle(
    `${isEditMode ? 'Edit Produk Katalog' : 'Buat Produk Katalog Baru'} | Admin ${shortBrandName}`
  );

  const sections = useMemo<AdminFormSectionConfig<ProductFormDraft>[]>(
    () => [
      {
        id: 'identitas-produk',
        title: 'Identitas & Informasi Utama',
        description: 'Detail dasar produk yang tampil pada daftar katalog dan halaman detail publik.',
        columns: 2,
        fields: [
          {
            name: 'name',
            label: 'Nama Produk',
            type: 'text',
            required: true,
            placeholder: 'Contoh: Kitchen set (kabinet atas & bawah)',
            onValueChange: (nextVal, prev) => {
              const str = String(nextVal ?? '');
              if (
                !prev.slug ||
                prev.slug.startsWith('produk-baru') ||
                prev.slug === slugifyProduct(prev.name)
              ) {
                return { slug: slugifyProduct(str) };
              }
            },
          },
          {
            name: 'slug',
            label: 'Slug URL',
            type: 'text',
            required: true,
            placeholder: 'kitchen-set-kabinet-atas-bawah',
            hint: (v) => `/produk/${v.slug || 'slug-produk'}`,
          },
          {
            name: 'category',
            label: 'Kategori Ruangan',
            type: 'text',
            required: true,
            placeholder: 'Contoh: Dapur & Bar',
          },
          {
            name: 'availability',
            label: 'Ketersediaan',
            type: 'select',
            options: [
              { value: 'konsultasi', label: 'Konsultasi' },
              { value: 'tersedia', label: 'Tersedia' },
              { value: 'pre-order', label: 'Pre-Order' },
              { value: 'terbatas', label: 'Terbatas' },
            ],
          },
          {
            name: 'shortDescription',
            label: 'Deskripsi Singkat',
            type: 'textarea',
            rows: 3,
            required: true,
            colSpan: 'full',
            placeholder: 'Jelaskan karakter desain dan fungsi utama produk...',
          },
        ],
      },
      {
        id: 'harga-status',
        title: 'Skema Harga & Urutan Tampil',
        columns: 3,
        fields: [
          {
            name: 'linkCustomPricing',
            label: 'Ikuti Tarif Custom Umum (/m²)',
            type: 'checkbox',
            colSpan: 'full',
            checkboxDescription:
              'Menghitung harga variasi otomatis dari ukuran per m², tarif desain, material utama, dan finishing/laminasi pada pengaturan Tarif Custom /m².',
          },
          {
            name: 'promoActive',
            label: 'Aktifkan Skema Promo & Harga Coret untuk Produk Ini',
            type: 'checkbox',
            colSpan: 'full',
            checkboxDescription:
              'Menampilkan harga sebelum promo (dicoret) bersama harga saat ini. Untuk produk yang mengikuti tarif /m², skema promo juga mengikuti pengaturan Tarif Custom /m².',
          },
          {
            name: 'priceStatus',
            label: 'Skema Harga Manual',
            type: 'select',
            visibleWhen: (v) => !v.linkCustomPricing,
            options: [
              { value: 'mulai', label: 'Mulai Dari (IDR)' },
              { value: 'tetap', label: 'Harga Tetap (IDR)' },
              { value: 'konsultasi', label: 'Konsultasi Harga' },
            ],
          },
          {
            name: 'price',
            label: 'Harga Tetap Saat Ini (IDR)',
            type: 'currency',
            zeroAsEmpty: true,
            visibleWhen: (v) => !v.linkCustomPricing && v.priceStatus === 'tetap',
          },
          {
            name: 'priceBeforePromo',
            label: 'Harga Tetap Sebelum Promo / Coret (IDR)',
            type: 'currency',
            zeroAsEmpty: true,
            visibleWhen: (v) => !v.linkCustomPricing && v.promoActive && v.priceStatus === 'tetap',
          },
          {
            name: 'priceFrom',
            label: 'Harga Mulai Saat Ini (IDR)',
            type: 'currency',
            zeroAsEmpty: true,
            visibleWhen: (v) => !v.linkCustomPricing && v.priceStatus === 'mulai',
          },
          {
            name: 'priceFromBeforePromo',
            label: 'Harga Mulai Sebelum Promo / Coret (IDR)',
            type: 'currency',
            zeroAsEmpty: true,
            visibleWhen: (v) => !v.linkCustomPricing && v.promoActive && v.priceStatus === 'mulai',
          },
          {
            name: 'sortOrder',
            label: 'Urutan Tampil',
            type: 'number',
            min: 1,
          },
          {
            name: 'featured',
            label: 'Tampilkan sebagai Produk Unggulan',
            type: 'checkbox',
            colSpan: 'full',
            checkboxDescription:
              'Diprioritaskan pada kolase produk pilihan di halaman Beranda.',
          },
        ],
      },
      {
        id: 'dimensi-produk',
        title: 'Dimensi Standar Referensi',
        description: 'Kosongkan angka jika dimensi fleksibel sepenuhnya mengikuti survei lokasi.',
        columns: 3,
        fields: [
          {
            name: 'widthCm',
            label: 'Lebar (cm)',
            type: 'number',
            min: 0,
          },
          {
            name: 'depthCm',
            label: 'Kedalaman (cm)',
            type: 'number',
            min: 0,
          },
          {
            name: 'heightCm',
            label: 'Tinggi (cm)',
            type: 'number',
            min: 0,
          },
          {
            name: 'dimensionPresetsText',
            label: 'Badge Ukuran Referensi (selain Custom)',
            type: 'text',
            colSpan: 'full',
            placeholder: 'Contoh: 2×3 m, 3×4 m (pisahkan dengan koma)',
          },
          {
            name: 'dimensionNote',
            label: 'Catatan Ukuran',
            type: 'text',
            colSpan: 'full',
            placeholder: 'Ukuran dapat disesuaikan dengan dimensi ruangan.',
          },
        ],
      },
      {
        id: 'media-material',
        title: 'Foto Produk & Spesifikasi Material',
        renderContent: (ctx) => (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2.5">
              <FormField
                id="prod-images-text"
                label="Daftar Path / URL Gambar (1 per baris)"
                hint="Pilih cepat dari aset studio di bawah atau tempel path gambar."
              >
                <Textarea
                  id="prod-images-text"
                  rows={4}
                  disabled={ctx.readOnly}
                  value={ctx.values.imagesText}
                  onChange={(e) => ctx.setFieldValue('imagesText', e.target.value)}
                />
              </FormField>
              {!ctx.readOnly && (
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_PRODUCT_IMAGES.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() =>
                        ctx.setFieldValue(
                          'imagesText',
                          ctx.values.imagesText.trim()
                            ? `${ctx.values.imagesText.trim()}\n${preset.url}`
                            : preset.url
                        )
                      }
                      className="px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
                    >
                      + {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <FormField
                id="prod-videos-text"
                label="Daftar URL Video Produk (1 per baris)"
                hint="Mendukung file video (.mp4 / .webm) atau tautan YouTube / Vimeo."
              >
                <Textarea
                  id="prod-videos-text"
                  rows={3}
                  disabled={ctx.readOnly}
                  value={ctx.values.videosText}
                  onChange={(e) => ctx.setFieldValue('videosText', e.target.value)}
                  placeholder="/hero.webm&#10;https://www.youtube.com/watch?v=..."
                />
              </FormField>

              <FormField
                id="prod-materials-text"
                label="Daftar Material Utama (1 per baris)"
                hint="Ditampilkan pada spesifikasi detail produk."
              >
                <Textarea
                  id="prod-materials-text"
                  rows={4}
                  disabled={ctx.readOnly}
                  value={ctx.values.materialsText}
                  onChange={(e) => ctx.setFieldValue('materialsText', e.target.value)}
                />
              </FormField>
            </div>
          </div>
        ),
      },
      {
        id: 'warna-swatches',
        title: `Pilihan Warna & Swatches (${values.colors.length})`,
        headerAction: (ctx) =>
          !ctx.readOnly ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                ctx.setFieldValue('colors', [
                  ...ctx.values.colors,
                  { id: `clr-${Date.now()}`, nama: 'Warna Baru', hex: '#B69674' },
                ])
              }
            >
              + Tambah Warna
            </Button>
          ) : null,
        renderContent: (ctx) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ctx.values.colors.map((clr, idx) => (
              <div
                key={clr.id}
                className="flex items-center gap-2.5 p-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)]/40"
              >
                <input
                  type="color"
                  aria-label={`Pilih warna ${clr.nama}`}
                  disabled={ctx.readOnly}
                  value={clr.hex}
                  onChange={(e) =>
                    ctx.setFieldValue(
                      'colors',
                      ctx.values.colors.map((item, i) =>
                        i === idx ? { ...item, hex: e.target.value } : item
                      )
                    )
                  }
                  className="size-8 shrink-0 rounded cursor-pointer border-0 bg-transparent"
                />
                <Input
                  disabled={ctx.readOnly}
                  value={clr.nama}
                  onChange={(e) =>
                    ctx.setFieldValue(
                      'colors',
                      ctx.values.colors.map((item, i) =>
                        i === idx
                          ? {
                              ...item,
                              nama: e.target.value,
                              id: slugifyProduct(e.target.value) || item.id,
                            }
                          : item
                      )
                    )
                  }
                  placeholder="Nama warna"
                />
                {!ctx.readOnly && (
                  <button
                    type="button"
                    aria-label={`Hapus warna ${clr.nama}`}
                    onClick={() =>
                      ctx.setFieldValue(
                        'colors',
                        ctx.values.colors.filter((_, i) => i !== idx)
                      )
                    }
                    className="p-2 text-[var(--danger)] hover:bg-[var(--danger-surface)] rounded cursor-pointer"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ),
      },
      {
        id: 'opsi-custom',
        title: `Grup Opsi Customisasi (${values.customizableOptions.length})`,
        description: 'Pilihan material utama, finishing/laminasi, atau ukuran yang dapat dipilih klien saat memesan.',
        headerAction: (ctx) =>
          !ctx.readOnly ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                ctx.setFieldValue('customizableOptions', [
                  ...ctx.values.customizableOptions,
                  { id: `opt-${Date.now()}`, label: 'Opsi Baru', daftarNilai: ['Pilihan 1'] },
                ])
              }
            >
              + Grup Opsi
            </Button>
          ) : null,
        renderContent: (ctx) => (
          <div className="space-y-3">
            {ctx.values.customizableOptions.map((opt, idx) => (
              <div
                key={opt.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2.5 p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)]/40 items-center"
              >
                <Input
                  disabled={ctx.readOnly}
                  value={opt.label}
                  onChange={(e) =>
                    ctx.setFieldValue(
                      'customizableOptions',
                      ctx.values.customizableOptions.map((item, i) =>
                        i === idx
                          ? {
                              ...item,
                              label: e.target.value,
                              id: slugifyProduct(e.target.value) || item.id,
                            }
                          : item
                      )
                    )
                  }
                  placeholder="Label grup (mis. Customisasi)"
                />
                <Input
                  disabled={ctx.readOnly}
                  value={opt.daftarNilai.join(', ')}
                  onChange={(e) =>
                    ctx.setFieldValue(
                      'customizableOptions',
                      ctx.values.customizableOptions.map((item, i) =>
                        i === idx
                          ? {
                              ...item,
                              daftarNilai: e.target.value
                                .split(',')
                                .map((v) => v.trim())
                                .filter(Boolean),
                            }
                          : item
                      )
                    )
                  }
                  placeholder="Nilai dipisah koma: MDF, Blockboard, PVC, Multipleks, Particle Board"
                />
                {!ctx.readOnly && (
                  <button
                    type="button"
                    aria-label={`Hapus opsi ${opt.label}`}
                    onClick={() =>
                      ctx.setFieldValue(
                        'customizableOptions',
                        ctx.values.customizableOptions.filter((_, i) => i !== idx)
                      )
                    }
                    className="p-2 text-[var(--danger)] hover:bg-[var(--danger-surface)] rounded cursor-pointer justify-self-end"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ),
      },
    ],
    [values.colors.length, values.customizableOptions.length]
  );

  const previewImage =
    values.imagesText
      .split('\n')
      .map((s) => s.trim())
      .find(Boolean) ?? null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validateProductDraft(values, products);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const finalProduct = normalizeProductFromDraft(values);
    const isUpdate = products.some((p) => p.id === finalProduct.id);
    await upsertCatalogProduct(finalProduct);
    recordActivity(
      isUpdate ? 'Memperbarui produk katalog' : 'Membuat produk katalog baru',
      'Katalog',
      finalProduct.nama
    );

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: `Perubahan pada "${finalProduct.nama}" telah disimpan dan aktif di situs.`,
        },
      },
    });
  };

  const waitingForCatalog = isEditMode && !activeCatalog;

  return (
    <AdminForm
      title={isEditMode ? `Edit Produk: ${values.name || id}` : 'Buat Produk Katalog Baru'}
      description="Formulir penuh pengelolaan detail produk, gambar, skema harga, warna, dan opsi kustom."
      backTo={BACK_PATH}
      backLabel="Kembali ke Katalog"
      submitLabel="Simpan Produk"
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      notFoundState={
        isEditMode && !waitingForCatalog && !existingProduct
          ? {
              title: 'Produk Katalog Tidak Ditemukan',
              message: 'Data produk yang Anda cari tidak tersedia atau telah dihapus dari katalog.',
            }
          : undefined
      }
      aside={
        <AdminFormSectionCard
          title="Pratinjau Kartu Katalog"
          description="Ringkasan tampilan produk pada daftar publik."
        >
          <div className="space-y-3">
            <div className="rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)] bg-[var(--surface-muted)]">
              <ImageFallback
                src={previewImage}
                alt={values.name || 'Pratinjau produk'}
                aspectRatio="4/3"
                fallbackLabel="Gambar"
                className="rounded-none border-0"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--text-muted)]">
                {values.category || 'Kategori'} · #{values.sortOrder}
              </p>
              <p className="text-sm font-semibold text-[var(--text)]">
                {values.name.trim() || 'Nama Produk'}
              </p>
              {(() => {
                const previewPrice = resolveCatalogStartingPrice(
                  normalizeProductFromDraft(values),
                  customPricing
                );
                return (
                  <p className="text-xs font-medium text-[var(--accent)] tabular-nums flex items-baseline gap-1.5 flex-wrap">
                    {previewPrice.promoActive && previewPrice.compareAtFormattedAmount && (
                      <span className="text-[var(--text-muted)] line-through">
                        {previewPrice.compareAtFormattedAmount}
                      </span>
                    )}
                    <span>{previewPrice.label}</span>
                  </p>
                );
              })()}
              <p className="text-xs text-[var(--text-muted)] line-clamp-3">
                {values.shortDescription.trim() || 'Deskripsi singkat produk akan tampil di sini.'}
              </p>
            </div>
            {values.colors.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--border)]">
                {values.colors.map((c) => (
                  <span
                    key={c.id}
                    title={c.nama}
                    className="inline-block size-4 rounded-full border border-[var(--border)]"
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            )}
          </div>
        </AdminFormSectionCard>
      }
    />
  );
}
