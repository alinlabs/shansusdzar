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
import { getProductCoverImage } from '../../../../lib/product-catalog';
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

function resolveDraftTariffUnitLabel(draft: ProductFormDraft): 'm²' | 'm' {
  return draft.meterLari ? 'm' : 'm²';
}

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
        title: 'Identitas & Daftar Referensi Ukuran',
        description:
          'Detail dasar produk. Referensi ukuran otomatis menggunakan satuan cm — pisahkan beberapa ukuran dengan koma (contoh: 200x60, 250x60, 300x60). Pembeli tetap dapat memasukkan ukuran custom.',
        columns: 2,
        fields: [
          {
            name: 'name',
            label: 'Nama Produk',
            type: 'text',
            required: true,
            colSpan: 'full',
            placeholder: 'Contoh: Kitchen set (kabinet atas & bawah)',
            hint: (v) => `Slug URL otomatis: /produk/${slugifyProduct(v.name) || 'nama-produk'}`,
          },
          {
            name: 'category',
            label: 'Kategori Ruangan',
            type: 'text',
            required: true,
            placeholder: 'Contoh: Dapur & Bar',
          },
          {
            name: 'referensiUkuranText',
            label: 'Referensi Ukuran Panjang × Tinggi (cm, pisahkan koma)',
            type: 'text',
            required: true,
            placeholder: '200x220, 250x220, 300x240',
            hint: 'Format Panjang×Tinggi tanpa spasi/kata cm (contoh: 200x220, 250x220, 300x240).',
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
        title: 'Matriks Harga Material & Finishing (HPL & Cat Duco)',
        description:
          'Aktifkan "Hitung per Meter Lari (/m)" untuk unit horizontal bertinggi baku (mis. meja, nakas, credenza, divan). Jika nonaktif, kalkulator di halaman detail produk & custom otomatis menghitung luas Panjang × Tinggi (/m²).',
        columns: 3,
        fields: [
          {
            name: 'meterLari',
            label: 'Hitung per Meter Lari (/m)',
            type: 'checkbox',
            colSpan: 'full',
            checkboxDescription:
              'Jika dicentang, harga dihitung dari Panjang (m). Jika tidak dicentang, harga dihitung dari luas Panjang × Tinggi (m²).',
          },
          {
            name: 'rateHplBlockboard',
            label: 'HPL · Blockboard 18 mm',
            hint: (v) =>
              `Tarif per ${resolveDraftTariffUnitLabel(v)} (IDR · isi 0 jika tidak tersedia)`,
            type: 'currency',
            zeroAsEmpty: true,
          },
          {
            name: 'rateHplMultipleks',
            label: 'HPL · Multipleks 18 mm',
            hint: (v) =>
              `Tarif per ${resolveDraftTariffUnitLabel(v)} (IDR · isi 0 jika tidak tersedia)`,
            type: 'currency',
            zeroAsEmpty: true,
          },
          {
            name: 'rateHplPvc',
            label: 'HPL · PVC Board 18 mm',
            hint: (v) =>
              `Tarif per ${resolveDraftTariffUnitLabel(v)} (IDR · isi 0 jika tidak tersedia)`,
            type: 'currency',
            zeroAsEmpty: true,
          },
          {
            name: 'rateDucoBlockboard',
            label: 'Cat Duco · Blockboard 18 mm',
            hint: (v) =>
              `Tarif mulai per ${resolveDraftTariffUnitLabel(v)} (IDR · isi 0 jika tidak tersedia)`,
            type: 'currency',
            zeroAsEmpty: true,
          },
          {
            name: 'rateDucoMultipleks',
            label: 'Cat Duco · Multipleks 18 mm',
            hint: (v) =>
              `Tarif mulai per ${resolveDraftTariffUnitLabel(v)} (IDR · isi 0 jika tidak tersedia)`,
            type: 'currency',
            zeroAsEmpty: true,
          },
          {
            name: 'rateDucoPvc',
            label: 'Cat Duco · PVC Board 18 mm',
            hint: (v) =>
              `Tarif mulai per ${resolveDraftTariffUnitLabel(v)} (IDR · isi 0 jika tidak tersedia)`,
            type: 'currency',
            zeroAsEmpty: true,
          },
          {
            name: 'promo',
            label: 'Promo Markup Harga Coret (Opsional)',
            type: 'text',
            colSpan: 'full',
            placeholder: 'Contoh: 10% atau 250000',
            hint: 'Harga asli tetap tidak diturunkan. Isi persentase (mis. 10%) atau nominal tanpa % (mis. 250000) untuk menaikkan angka harga coret dan menampilkan persentase hemat otomatis.',
          },
        ],
      },
      {
        id: 'media-produk',
        title: 'Gambar Sampul & Daftar Media',
        description:
          'Gambar sampul ditampilkan khusus di halaman Beranda dan grid Katalog. Daftar media (gambar maupun video) ditampilkan pada galeri halaman detail produk sesuai urutan baris.',
        renderContent: (ctx) => (
          <div className="space-y-5">
            <div className="space-y-2.5">
              <FormField
                id="prod-cover-image"
                label="Gambar Sampul (Beranda & Grid Katalog)"
                hint="Path/URL gambar khusus yang tampil di halaman Beranda dan kartu Katalog."
              >
                <Input
                  id="prod-cover-image"
                  disabled={ctx.readOnly}
                  value={ctx.values.gambarSampul}
                  onChange={(e) => ctx.setFieldValue('gambarSampul', e.target.value)}
                  placeholder="/produk/gambar/kabinet-dapur-modular.webp"
                />
              </FormField>
              {!ctx.readOnly && (
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_PRODUCT_IMAGES.map((preset) => (
                    <button
                      key={`cover-${preset.url}`}
                      type="button"
                      onClick={() => ctx.setFieldValue('gambarSampul', preset.url)}
                      className="px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
                    >
                      Pilih {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <FormField
              id="prod-model-3d"
              label="Model 3D (.glb) — Opsional"
              hint="Path atau tautan CDN file 3D berformat .glb. Jika diisi, pratinjau 3D interaktif otomatis tampil di slide terakhir halaman detail produk."
            >
              <Input
                id="prod-model-3d"
                disabled={ctx.readOnly}
                value={ctx.values.model3d}
                onChange={(e) => ctx.setFieldValue('model3d', e.target.value)}
                placeholder="https://cdn.example.com/models/produk.glb"
              />
            </FormField>

            <div className="space-y-2.5">
              <FormField
                id="prod-media-text"
                label="Daftar Media — Gambar & Video (1 per baris, sesuai urutan)"
                hint="Campurkan path/URL gambar (.webp/.png/.jpg) dan video (.mp4/.webm atau tautan YouTube/Vimeo) sesuai urutan tampil di detail produk."
              >
                <Textarea
                  id="prod-media-text"
                  rows={5}
                  disabled={ctx.readOnly}
                  value={ctx.values.mediaText}
                  onChange={(e) => ctx.setFieldValue('mediaText', e.target.value)}
                  placeholder="/produk/gambar/kabinet-dapur-modular.webp&#10;/hero.webm&#10;https://www.youtube.com/watch?v=..."
                />
              </FormField>
              {!ctx.readOnly && (
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_PRODUCT_IMAGES.map((preset) => (
                    <button
                      key={`media-${preset.url}`}
                      type="button"
                      onClick={() =>
                        ctx.setFieldValue(
                          'mediaText',
                          ctx.values.mediaText.trim()
                            ? `${ctx.values.mediaText.trim()}\n${preset.url}`
                            : preset.url
                        )
                      }
                      className="px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
                    >
                      + {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      ctx.setFieldValue(
                        'mediaText',
                        ctx.values.mediaText.trim()
                          ? `${ctx.values.mediaText.trim()}\n/hero.webm`
                          : '/hero.webm'
                      )
                    }
                    className="px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
                  >
                    + Video Workshop (/hero.webm)
                  </button>
                </div>
              )}
            </div>
          </div>
        ),
      },
      {
        id: 'customisasi-produk',
        title: `Customisasi Model / Bentuk (${values.customisasiItems.length})`,
        description:
          'Daftar pilihan customisasi layout atau bentuk produk (mis. Lurus (Straight), Sudut (L-Shape), U-Shape). Material dan finishing otomatis mengikuti tarif satuan di atas.',
        headerAction: (ctx) =>
          !ctx.readOnly ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                ctx.setFieldValue('customisasiItems', [
                  ...ctx.values.customisasiItems,
                  'Customisasi Baru',
                ])
              }
            >
              + Tambah Customisasi
            </Button>
          ) : null,
        renderContent: (ctx) => (
          <div className="space-y-2.5">
            {ctx.values.customisasiItems.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                Belum ada opsi customisasi bentuk atau model untuk produk ini.
              </p>
            ) : (
              ctx.values.customisasiItems.map((item, idx) => (
                <div
                  key={`customisasi-${idx}`}
                  className="grid grid-cols-[1fr_auto] gap-2.5 items-center"
                >
                  <Input
                    disabled={ctx.readOnly}
                    value={item}
                    onChange={(e) =>
                      ctx.setFieldValue(
                        'customisasiItems',
                        ctx.values.customisasiItems.map((curr, i) =>
                          i === idx ? e.target.value : curr
                        )
                      )
                    }
                    placeholder="Contoh: Lurus (Straight)"
                  />
                  {!ctx.readOnly && (
                    <button
                      type="button"
                      aria-label={`Hapus customisasi ${item}`}
                      onClick={() =>
                        ctx.setFieldValue(
                          'customisasiItems',
                          ctx.values.customisasiItems.filter((_, i) => i !== idx)
                        )
                      }
                      className="p-2 text-[var(--danger)] hover:bg-[var(--danger-surface)] rounded cursor-pointer"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        ),
      },
      {
        id: 'include-produk',
        title: `Kelengkapan Include — Gratis (${values.includeItems.length})`,
        description:
          'Daftar kelengkapan atau fitur bawaan produk ini yang otomatis termasuk gratis saat pemesanan di katalog maupun kalkulator Custom Interior.',
        headerAction: (ctx) =>
          !ctx.readOnly ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                ctx.setFieldValue('includeItems', [
                  ...ctx.values.includeItems,
                  'Kelengkapan Gratis Baru',
                ])
              }
            >
              + Tambah Include
            </Button>
          ) : null,
        renderContent: (ctx) => (
          <div className="space-y-2.5">
            {ctx.values.includeItems.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                Belum ada daftar kelengkapan include untuk produk ini.
              </p>
            ) : (
              ctx.values.includeItems.map((item, idx) => (
                <div
                  key={`include-${idx}`}
                  className="grid grid-cols-[1fr_auto] gap-2.5 items-center"
                >
                  <Input
                    disabled={ctx.readOnly}
                    value={item}
                    onChange={(e) =>
                      ctx.setFieldValue(
                        'includeItems',
                        ctx.values.includeItems.map((curr, i) =>
                          i === idx ? e.target.value : curr
                        )
                      )
                    }
                    placeholder="Contoh: Engsel & rel laci soft-close"
                  />
                  {!ctx.readOnly && (
                    <button
                      type="button"
                      aria-label={`Hapus include ${item}`}
                      onClick={() =>
                        ctx.setFieldValue(
                          'includeItems',
                          ctx.values.includeItems.filter((_, i) => i !== idx)
                        )
                      }
                      className="p-2 text-[var(--danger)] hover:bg-[var(--danger-surface)] rounded cursor-pointer"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        ),
      },
    ],
    [values.customisasiItems.length, values.includeItems.length]
  );

  const previewProductDraft = normalizeProductFromDraft(values);
  const previewImage = getProductCoverImage(previewProductDraft);

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
      description="Formulir pengelolaan produk, daftar referensi ukuran (cm), tarif satuan material & finishing, customisasi, dan include gratis."
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
      aside={(() => {
        const previewPrice = resolveCatalogStartingPrice(
          normalizeProductFromDraft(values),
          customPricing
        );
        return (
          <AdminFormSectionCard
            title="Pratinjau Kartu Katalog"
            description="Ringkasan tampilan produk pada daftar publik."
          >
            <div className="space-y-3">
              <div className="relative rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)] bg-[var(--surface-muted)]">
                <ImageFallback
                  src={previewImage}
                  alt={values.name || 'Pratinjau produk'}
                  aspectRatio="4/3"
                  fallbackLabel="Gambar"
                  className="rounded-none border-0"
                />
                {previewPrice.promoActive && previewPrice.discountPercentLabel && (
                  <span className="pointer-events-none absolute top-2.5 left-2.5 inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--danger-border)] bg-[var(--danger)] text-white text-[10px] font-semibold leading-tight tabular-nums">
                    Hemat {previewPrice.discountPercentLabel}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[var(--text-muted)]">
                  {values.category || 'Kategori'} · {values.referensiUkuranText || '200x220'} cm
                </p>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {values.name.trim() || 'Nama Produk'}
                </p>
                <div className="flex flex-wrap items-baseline gap-2 tabular-nums">
                  <p className="text-xs font-medium text-[var(--accent)]">
                    {previewPrice.label}
                  </p>
                  {previewPrice.promoActive && previewPrice.compareAtFormattedAmount && (
                    <p className="text-[11px] text-[var(--text-subtle)] line-through">
                      {previewPrice.compareAtFormattedAmount}
                    </p>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] line-clamp-3">
                  {values.shortDescription.trim() || 'Deskripsi singkat produk akan tampil di sini.'}
                </p>
              </div>
            </div>
          </AdminFormSectionCard>
        );
      })()}
    />
  );
}
