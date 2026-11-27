import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  FileText,
  ImagePlus,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { FormField, Input, Select, Textarea } from '../../../../components/ui/form-controls';
import { ImageFallback } from '../../../../components/ui/image-fallback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  createDefaultNewsImageFormat,
  createDefaultNewsTextFormat,
  type NewsArticleContentBlock,
  type NewsImageAspectRatio,
  type NewsImageDisplayMode,
  type NewsImageGridCols,
  type NewsTextAlign,
  type NewsTextStyle,
} from '../../../../lib/news-content';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import {
  PRESET_NEWS_CONTENT_IMAGES,
  PRESET_NEWS_COVERS,
  createEmptyImageContentBlock,
  createEmptyNewsDraft,
  createEmptyTextContentBlock,
  getNewsSlug,
  normalizeNewsFromDraft,
  toNewsFormDraft,
  validateNewsDraft,
  type NewsFormDraft,
} from './logic';

const BACK_PATH = '/admin/informasi/berita';

const TEXT_STYLE_LABELS: Record<NewsTextStyle, string> = {
  paragraf: 'Paragraf',
  subjudul: 'Subjudul',
  kutipan: 'Kutipan',
};

const IMAGE_MODE_LABELS: Record<NewsImageDisplayMode, string> = {
  crop: 'Crop',
  full: 'Full',
  fit: 'Fit',
};

export default function AdminBeritaFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const newsArticles = useSiteContentStore((state) => state.newsArticles);
  const upsertNewsArticle = useSiteContentStore((state) => state.upsertNewsArticle);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'berita');

  const isEditMode = Boolean(id);
  const existingArticle = useMemo(
    () => (id ? newsArticles.find((a) => a.id === id) ?? null : null),
    [id, newsArticles]
  );

  const [values, setValues] = useState<NewsFormDraft>(() =>
    existingArticle
      ? toNewsFormDraft(existingArticle)
      : createEmptyNewsDraft(newsArticles)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode ? 'Edit Berita SEO' : 'Tulis Berita SEO Baru'} | Informasi Admin ${shortBrandName}`
  );

  const updateBlockAt = (
    blockIndex: number,
    updater: (block: NewsArticleContentBlock) => NewsArticleContentBlock
  ) => {
    setValues((prev) => ({
      ...prev,
      isi: prev.isi.map((item, idx) => (idx === blockIndex ? updater(item) : item)),
    }));
  };

  const handleChangeBlockJenis = (blockIndex: number, nextJenis: 'teks' | 'gambar') => {
    updateBlockAt(blockIndex, (current) => {
      if (current.jenis === nextJenis) return current;
      if (nextJenis === 'teks' && current.jenis === 'gambar') {
        const seedText =
          current.format.caption?.trim() || current.format.alt?.trim() || '';
        return createEmptyTextContentBlock(seedText);
      }
      return createEmptyImageContentBlock(['/sample-produk/gambar/kitchen-set-detail.webp']);
    });
  };

  const handleMoveBlock = (blockIndex: number, direction: -1 | 1) => {
    setValues((prev) => {
      const targetIndex = blockIndex + direction;
      if (targetIndex < 0 || targetIndex >= prev.isi.length) return prev;
      const next = [...prev.isi];
      const [moved] = next.splice(blockIndex, 1);
      next.splice(targetIndex, 0, moved);
      return { ...prev, isi: next };
    });
  };

  const handleRemoveBlock = (blockIndex: number) => {
    setValues((prev) => {
      if (prev.isi.length <= 1) return prev;
      return {
        ...prev,
        isi: prev.isi.filter((_, idx) => idx !== blockIndex),
      };
    });
  };

  const handleAddBlock = (jenis: 'teks' | 'gambar') => {
    setValues((prev) => ({
      ...prev,
      isi: [
        ...prev.isi,
        jenis === 'teks' ? createEmptyTextContentBlock() : createEmptyImageContentBlock(),
      ],
    }));
  };

  const sections = useMemo<AdminFormSectionConfig<NewsFormDraft>[]>(
    () => [
      {
        id: 'konten-utama',
        title: 'Informasi Artikel',
        mobileTabLabel: 'Artikel',
        columns: 2,
        fields: [
          {
            name: 'judul',
            label: 'Judul',
            type: 'text',
            required: true,
            colSpan: 'full',
          },
          {
            name: 'kategori',
            label: 'Kategori',
            type: 'text',
            required: true,
          },
          {
            name: 'tanggalTerbit',
            label: 'Tanggal Terbit',
            type: 'date',
          },
          {
            name: 'ringkasan',
            label: 'Ringkasan',
            type: 'textarea',
            rows: 2,
            required: true,
            colSpan: 'full',
          },
        ],
      },
      {
        id: 'isi-artikel',
        title: 'Isi Artikel',
        mobileTabLabel: 'Isi',
        errorFields: ['isi'],
        errorPrefixes: ['isi.'],
        renderContent: (ctx) => {
          const blocks = ctx.values.isi;
          return (
            <div className="space-y-4" data-testid="news-blocks-editor">
              {ctx.errors.isi && (
                <p role="alert" className="text-xs font-medium text-[var(--danger)]">{ctx.errors.isi}</p>
              )}

              <div className="space-y-3.5">
                {blocks.map((block, blockIndex) => {
                  const blockError = ctx.errors[`isi.${blockIndex}`];
                  const isFirst = blockIndex === 0;
                  const isLast = blockIndex === blocks.length - 1;

                  return (
                    <div
                      key={blockIndex}
                      data-testid={`news-block-${blockIndex}`}
                      className={[
                        'rounded-[var(--radius-md)] border bg-[var(--bg)] p-3.5 sm:p-4 space-y-3.5',
                        blockError ? 'border-[var(--danger-border)]' : 'border-[var(--border)]',
                      ].join(' ')}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--border)]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[11px] font-semibold text-[var(--text)] tabular-nums">
                            #{blockIndex + 1}
                          </span>
                          <span className="text-xs font-semibold text-[var(--text)] truncate">
                            {block.jenis === 'teks'
                              ? `Teks · ${TEXT_STYLE_LABELS[block.format.gaya]}`
                              : `Gambar · ${IMAGE_MODE_LABELS[block.format.mode]} (${block.isi.length} foto)`}
                          </span>
                        </div>

                        {!ctx.readOnly && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={isFirst}
                              onClick={() => handleMoveBlock(blockIndex, -1)}
                              aria-label={`Naikkan blok ${blockIndex + 1}`}
                              title="Naikkan urutan"
                              className="inline-flex items-center justify-center size-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                            >
                              <ArrowUp className="size-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              disabled={isLast}
                              onClick={() => handleMoveBlock(blockIndex, 1)}
                              aria-label={`Turunkan blok ${blockIndex + 1}`}
                              title="Turunkan urutan"
                              className="inline-flex items-center justify-center size-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                            >
                              <ArrowDown className="size-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              disabled={blocks.length <= 1}
                              onClick={() => handleRemoveBlock(blockIndex)}
                              aria-label={`Hapus blok ${blockIndex + 1}`}
                              title="Hapus blok"
                              className="inline-flex items-center justify-center size-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--danger)] hover:bg-[var(--danger-surface)] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Jenis */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                          id={`block-${blockIndex}-jenis`}
                          label="Jenis Blok"
                          required
                        >
                          <Select
                            id={`block-${blockIndex}-jenis`}
                            disabled={ctx.readOnly}
                            searchable={false}
                            value={block.jenis}
                            onValueChange={(nextJenis) =>
                              handleChangeBlockJenis(blockIndex, nextJenis as 'teks' | 'gambar')
                            }
                            options={[
                              { value: 'teks', label: 'Teks' },
                              { value: 'gambar', label: 'Gambar' },
                            ]}
                          />
                        </FormField>

                        {block.jenis === 'teks' ? (
                          <FormField id={`block-${blockIndex}-gaya`} label="Format Gaya Teks">
                            <Select
                              id={`block-${blockIndex}-gaya`}
                              disabled={ctx.readOnly}
                              searchable={false}
                              value={block.format.gaya}
                              onValueChange={(nextGaya) =>
                                updateBlockAt(blockIndex, (item) =>
                                  item.jenis === 'teks'
                                    ? {
                                        ...item,
                                        format: createDefaultNewsTextFormat({
                                          ...item.format,
                                          gaya: nextGaya as NewsTextStyle,
                                        }),
                                      }
                                    : item
                                )
                              }
                              options={[
                                { value: 'paragraf', label: 'Paragraf Biasa' },
                                { value: 'subjudul', label: 'Subjudul Bagian' },
                                { value: 'kutipan', label: 'Kutipan' },
                              ]}
                            />
                          </FormField>
                        ) : (
                          <FormField id={`block-${blockIndex}-mode`} label="Format Mode Gambar">
                            <Select
                              id={`block-${blockIndex}-mode`}
                              disabled={ctx.readOnly}
                              searchable={false}
                              value={block.format.mode}
                              onValueChange={(nextMode) =>
                                updateBlockAt(blockIndex, (item) =>
                                  item.jenis === 'gambar'
                                    ? {
                                        ...item,
                                        format: createDefaultNewsImageFormat(
                                          {
                                            ...item.format,
                                            mode: nextMode as NewsImageDisplayMode,
                                          },
                                          item.isi.length
                                        ),
                                      }
                                    : item
                                )
                              }
                              options={[
                                { value: 'crop', label: 'Di-crop Rapi (Crop)' },
                                { value: 'full', label: 'Full Kanan–Kiri (Full)' },
                                { value: 'fit', label: 'Sesuai Gambar Asli (Fit)' },
                              ]}
                            />
                          </FormField>
                        )}
                      </div>

                      {/* Isi & Format detail per jenis */}
                      {block.jenis === 'teks' ? (
                        <div className="space-y-3">
                          <FormField
                            id={`block-${blockIndex}-isi-teks`}
                            label="Isi Teks"
                            required
                            error={blockError}
                          >
                            <Textarea
                              id={`block-${blockIndex}-isi-teks`}
                              rows={block.format.gaya === 'subjudul' ? 2 : 4}
                              autoGrowMaxRows={12}
                              disabled={ctx.readOnly}
                              hasError={Boolean(blockError)}
                              placeholder={
                                block.format.gaya === 'subjudul'
                                  ? 'Tulis judul sub-bagian artikel...'
                                  : block.format.gaya === 'kutipan'
                                    ? 'Tulis kutipan penting atau pernyataan tim...'
                                    : 'Tulis isi paragraf artikel...'
                              }
                              value={block.isi}
                              onChange={(e) => {
                                const nextText = e.target.value;
                                updateBlockAt(blockIndex, (item) =>
                                  item.jenis === 'teks' ? { ...item, isi: nextText } : item
                                );
                              }}
                            />
                          </FormField>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField id={`block-${blockIndex}-rata`} label="Format Perataan">
                              <Select
                                id={`block-${blockIndex}-rata`}
                                disabled={ctx.readOnly}
                                searchable={false}
                                value={block.format.rata}
                                onValueChange={(nextRata) =>
                                  updateBlockAt(blockIndex, (item) =>
                                    item.jenis === 'teks'
                                      ? {
                                          ...item,
                                          format: createDefaultNewsTextFormat({
                                            ...item.format,
                                            rata: nextRata as NewsTextAlign,
                                          }),
                                        }
                                      : item
                                  )
                                }
                                options={[
                                  { value: 'justify', label: 'Rata Kanan–Kiri (Justify)' },
                                  { value: 'left', label: 'Rata Kiri (Left)' },
                                ]}
                              />
                            </FormField>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-light tracking-[0.01em] text-[var(--text-muted)]">
                                Isi Gambar (URL / Path) <span className="text-[var(--danger)] font-normal">*</span>
                              </span>
                              {!ctx.readOnly && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateBlockAt(blockIndex, (item) =>
                                      item.jenis === 'gambar'
                                        ? { ...item, isi: [...item.isi, ''] }
                                        : item
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
                                >
                                  <Plus className="size-3.5" aria-hidden="true" />
                                  Tambah Gambar
                                </button>
                              )}
                            </div>

                            {!ctx.readOnly && (
                              <Select
                                aria-label={`Pilih koleksi foto untuk blok gambar ${blockIndex + 1}`}
                                value=""
                                onValueChange={(selectedUrl) => {
                                  if (!selectedUrl) return;
                                  updateBlockAt(blockIndex, (item) => {
                                    if (item.jenis !== 'gambar') return item;
                                    const hasBlankSlot = item.isi.some((u) => u.trim() === '');
                                    const nextUrls = hasBlankSlot
                                      ? item.isi.map((u, idx) =>
                                          idx === item.isi.findIndex((v) => v.trim() === '')
                                            ? selectedUrl
                                            : u
                                        )
                                      : [...item.isi, selectedUrl];
                                    return {
                                      ...item,
                                      isi: nextUrls,
                                    };
                                  });
                                }}
                                options={[
                                  { value: '', label: '+ Sisipkan dari koleksi foto studio...' },
                                  ...PRESET_NEWS_CONTENT_IMAGES.map((img) => ({
                                    value: img.url,
                                    label: img.label,
                                  })),
                                ]}
                              />
                            )}

                            <div className="space-y-2">
                              {block.isi.map((url, imgIdx) => (
                                <div key={imgIdx} className="flex items-center gap-2">
                                  <div className="w-12 aspect-[4/3] shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)]">
                                    <ImageFallback
                                      src={url}
                                      alt={block.format.alt || `Gambar ${imgIdx + 1}`}
                                      aspectRatio="auto"
                                      className="size-full rounded-none border-0"
                                    />
                                  </div>
                                  <Input
                                    id={`block-${blockIndex}-img-${imgIdx}`}
                                    aria-label={`URL gambar ${imgIdx + 1} blok ${blockIndex + 1}`}
                                    type="text"
                                    disabled={ctx.readOnly}
                                    hasError={Boolean(blockError)}
                                    placeholder="/sample-produk/gambar/kitchen-set-detail.webp"
                                    value={url}
                                    onChange={(e) => {
                                      const nextUrl = e.target.value;
                                      updateBlockAt(blockIndex, (item) =>
                                        item.jenis === 'gambar'
                                          ? {
                                              ...item,
                                              isi: item.isi.map((existingUrl, idx) =>
                                                idx === imgIdx ? nextUrl : existingUrl
                                              ),
                                            }
                                          : item
                                      );
                                    }}
                                    className="text-xs font-mono"
                                  />
                                  {!ctx.readOnly && block.isi.length > 1 && (
                                    <button
                                      type="button"
                                      aria-label={`Hapus gambar ${imgIdx + 1} di blok ${blockIndex + 1}`}
                                      onClick={() =>
                                        updateBlockAt(blockIndex, (item) =>
                                          item.jenis === 'gambar'
                                            ? {
                                                ...item,
                                                isi: item.isi.filter((_, idx) => idx !== imgIdx),
                                              }
                                            : item
                                        )
                                      }
                                      className="inline-flex items-center justify-center size-10 shrink-0 rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--danger)] hover:bg-[var(--danger-surface)] cursor-pointer"
                                    >
                                      <Trash2 className="size-4" aria-hidden="true" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>

                            {blockError && (
                              <p role="alert" className="text-xs font-medium text-[var(--danger)]">{blockError}</p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField id={`block-${blockIndex}-grid`} label="Format Grid Kolom">
                              <Select
                                id={`block-${blockIndex}-grid`}
                                disabled={ctx.readOnly}
                                searchable={false}
                                value={block.format.grid}
                                onValueChange={(nextGrid) =>
                                  updateBlockAt(blockIndex, (item) =>
                                    item.jenis === 'gambar'
                                      ? {
                                          ...item,
                                          format: createDefaultNewsImageFormat(
                                            {
                                              ...item.format,
                                              grid: nextGrid as NewsImageGridCols,
                                            },
                                            item.isi.length
                                          ),
                                        }
                                      : item
                                  )
                                }
                                options={[
                                  { value: 'auto', label: 'Otomatis' },
                                  { value: '1', label: '1 Kolom Penuh' },
                                  { value: '2', label: '2 Grid Horizontal' },
                                  { value: '3', label: '3 Grid Desktop (Maks 2 Mobile)' },
                                ]}
                              />
                            </FormField>

                            {block.format.mode !== 'fit' && (
                              <FormField id={`block-${blockIndex}-ratio`} label="Format Rasio Potong">
                                <Select
                                  id={`block-${blockIndex}-ratio`}
                                  disabled={ctx.readOnly}
                                  searchable={false}
                                  value={block.format.ratio ?? '16/9'}
                                  onValueChange={(nextRatio) =>
                                    updateBlockAt(blockIndex, (item) =>
                                      item.jenis === 'gambar'
                                        ? {
                                            ...item,
                                            format: createDefaultNewsImageFormat(
                                              {
                                                ...item.format,
                                                ratio: nextRatio as NewsImageAspectRatio,
                                              },
                                              item.isi.length
                                            ),
                                          }
                                        : item
                                    )
                                  }
                                  options={[
                                    { value: '16/9', label: '16:9 · Landscape Lebar' },
                                    { value: '4/3', label: '4:3 · Standar Editorial' },
                                    { value: '1/1', label: '1:1 · Persegi' },
                                    { value: '4/5', label: '4:5 · Potret Rapi' },
                                    { value: '3/4', label: '3:4 · Potret Tinggi' },
                                    { value: '21/9', label: '21:9 · Sinematik Panorama' },
                                  ]}
                                />
                              </FormField>
                            )}

                            <FormField
                              id={`block-${blockIndex}-caption`}
                              label="Keterangan Gambar (Opsional)"
                            >
                              <Input
                                id={`block-${blockIndex}-caption`}
                                type="text"
                                disabled={ctx.readOnly}
                                placeholder="Contoh: Detail hasil pemasangan kitchen set"
                                value={block.format.caption ?? ''}
                                onChange={(e) => {
                                  const nextCaption = e.target.value;
                                  updateBlockAt(blockIndex, (item) =>
                                    item.jenis === 'gambar'
                                      ? {
                                          ...item,
                                          format: {
                                            ...item.format,
                                            ...(nextCaption ? { caption: nextCaption } : { caption: undefined }),
                                          },
                                        }
                                      : item
                                  );
                                }}
                              />
                            </FormField>

                            <FormField
                              id={`block-${blockIndex}-alt`}
                              label="Teks Alt Gambar (Opsional)"
                            >
                              <Input
                                id={`block-${blockIndex}-alt`}
                                type="text"
                                disabled={ctx.readOnly}
                                placeholder="Deskripsi foto untuk aksesibilitas & SEO"
                                value={block.format.alt ?? ''}
                                onChange={(e) => {
                                  const nextAlt = e.target.value;
                                  updateBlockAt(blockIndex, (item) =>
                                    item.jenis === 'gambar'
                                      ? {
                                          ...item,
                                          format: {
                                            ...item.format,
                                            ...(nextAlt ? { alt: nextAlt } : { alt: undefined }),
                                          },
                                        }
                                      : item
                                  );
                                }}
                              />
                            </FormField>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!ctx.readOnly && (
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAddBlock('teks')}
                    data-testid="add-text-block-btn"
                  >
                    <FileText className="size-3.5" aria-hidden="true" />
                    Tambah Blok Teks
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAddBlock('gambar')}
                    data-testid="add-image-block-btn"
                  >
                    <ImagePlus className="size-3.5" aria-hidden="true" />
                    Tambah Blok Gambar
                  </Button>
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: 'gambar-sampul',
        title: 'Foto Sampul',
        mobileTabLabel: 'Sampul',
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
            placeholder: 'Jelaskan isi foto secara alami dengan kata kunci layanan',
          },
        ],
      },
      {
        id: 'metadata-seo',
        title: 'SEO & Sorotan',
        mobileTabLabel: 'SEO',
        columns: 2,
        fields: [
          {
            name: 'judulSeo',
            label: 'Judul SEO Google',
            type: 'text',
            colSpan: 'full',
            placeholder: 'Kosongkan untuk menggunakan judul utama artikel (maks 60 karakter)',
          },
          {
            name: 'deskripsiSeo',
            label: 'Meta Description Google',
            type: 'textarea',
            rows: 2,
            colSpan: 'full',
            placeholder: 'Ringkasan menarik 120–160 karakter untuk hasil pencarian Google',
          },
          {
            name: 'keywordsText',
            label: 'Kata Kunci Target (pisahkan dengan koma)',
            type: 'text',
            colSpan: 'full',
            placeholder: 'Contoh: kitchen set purwakarta, jasa interior karawang, lemari custom',
          },
          {
            name: 'unggulan',
            label: 'Jadikan Berita Utama (Utama)',
            type: 'checkbox',
            colSpan: 'full',
          },
        ],
      },
    ],
    []
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validateNewsDraft(values, newsArticles);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const normalized = normalizeNewsFromDraft(values, shortBrandName, newsArticles);
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
      title={isEditMode ? 'Edit Berita' : 'Tulis Berita'}
      backTo={BACK_PATH}
      backLabel="Kembali"
      submitLabel="Simpan"
      actionMode="header-icon-mobile-bottom"
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      asideTabLabel="Pratinjau"
      notFoundState={
        isEditMode && !existingArticle
          ? {
              title: 'Artikel Tidak Ditemukan',
              message: 'Artikel tidak tersedia atau sudah dihapus.',
            }
          : undefined
      }
      aside={
        <div className="space-y-4">
          <AdminFormSectionCard title="Pratinjau Google">
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
                  /berita/{getNewsSlug(values)}
                </p>
                <p className="text-sm font-semibold text-[var(--accent)] leading-snug line-clamp-2">
                  {values.judulSeo.trim() || values.judul.trim() || 'Judul Artikel'}
                </p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-3">
                  {values.deskripsiSeo.trim() ||
                    values.ringkasan.trim() ||
                    'Meta description artikel.'}
                </p>
              </div>
            </div>
          </AdminFormSectionCard>

          <AdminFormSectionCard title={`Urutan Blok Konten (${values.isi.length})`}>
            <ol className="space-y-2 text-xs">
              {values.isi.map((block, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2"
                >
                  <span className="font-semibold text-[var(--text-muted)] tabular-nums shrink-0">
                    {idx + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--text)] truncate">
                      {block.jenis === 'teks'
                        ? `Teks · ${TEXT_STYLE_LABELS[block.format.gaya]} (${block.format.rata})`
                        : `Gambar · ${IMAGE_MODE_LABELS[block.format.mode]} · Grid ${block.format.grid}`}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">
                      {block.jenis === 'teks'
                        ? block.isi.trim() || 'Belum ada teks'
                        : `${block.isi.filter((u) => u.trim()).length} gambar`}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </AdminFormSectionCard>
        </div>
      }
    />
  );
}
