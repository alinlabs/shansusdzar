import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  Copy,
  Download,
  ExternalLink,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Input, Select } from '../../../../components/ui/form-controls';
import { ImageFallback } from '../../../../components/ui/image-fallback';
import { resolveCatalogStartingPrice } from '../../../../lib/catalog-pricing';
import { getProductCoverImage, getProductSlug, serializeProductForJson } from '../../../../lib/product-catalog';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { ProductItem } from '../../../../types/product';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminKatalogPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const customPricing = useSiteContentStore((state) => state.customPricing);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);
  const upsertCatalogProduct = useSiteContentStore((state) => state.upsertCatalogProduct);
  const deleteCatalogProduct = useSiteContentStore((state) => state.deleteCatalogProduct);
  const resetCatalogToFileDefault = useSiteContentStore((state) => state.resetCatalogToFileDefault);

  const roles = useAdminAuthStore((state) => state.roles);
  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Kelola Produk | Admin ${shortBrandName}`);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'katalog.edit');
  const canDelete = hasPermission(currentRole, 'katalog.delete');

  const activeCatalog = catalogOverride ?? loadedBaseCatalog;
  const products = activeCatalog?.daftarProduk ?? [];

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [feedback, setFeedback] = useAdminFeedbackState();

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.kategori).filter(Boolean));
    return ['Semua', ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'Semua' && p.kategori !== categoryFilter) return false;
      if (!q) return true;
      return `${p.nama} ${p.kategori} ${p.deskripsiSingkat} ${getProductSlug(p)}`
        .toLowerCase()
        .includes(q);
    });
  }, [products, categoryFilter, searchQuery]);

  const handleDuplicate = async (product: ProductItem) => {
    if (!canEdit) return;
    const copy: ProductItem = {
      ...structuredClone(product),
      id: `prod-${Date.now()}`,
      nama: `${product.nama} (Salinan)`,
    };
    delete copy.slug;
    await upsertCatalogProduct(copy);
    recordActivity('Menduplikasi produk katalog', 'Katalog', copy.nama);
    setFeedback({ type: 'ok', text: `Produk "${copy.nama}" ditambahkan ke katalog.` });
  };

  const handleDelete = async (product: ProductItem) => {
    if (!canDelete) return;
    await deleteCatalogProduct(product.id);
    recordActivity('Menghapus produk katalog', 'Katalog', product.nama);
    setFeedback({ type: 'ok', text: `Produk "${product.nama}" dihapus dari katalog.` });
  };

  const handleExportCatalogJson = () => {
    if (!activeCatalog) return;
    const serialized = activeCatalog.daftarProduk.map(serializeProductForJson);
    const blob = new Blob([JSON.stringify(serialized, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'produk.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Produk"
        actions={
          <>
            <AdminActionLink
              to="/produk"
              label="Produk Publik"
              icon={<ExternalLink className="size-3.5 text-[var(--text-muted)]" />}
            />
            <AdminActionLink
              to="/admin/produk/custom"
              label="Tarif Custom /m²"
              icon={<Calculator className="size-3.5 text-[var(--text-muted)]" />}
            />
            <AdminActionButton
              label="Unduh produk.json"
              icon={<Download className="size-3.5" />}
              onClick={handleExportCatalogJson}
            />
            {canEdit && catalogOverride && (
              <AdminActionButton
                label="Reset Bawaan"
                icon={<RotateCcw className="size-3.5" />}
                onClick={async () => {
                  await resetCatalogToFileDefault();
                  recordActivity('Mengembalikan katalog ke bawaan file', 'Katalog', 'produk.json');
                  setFeedback({ type: 'ok', text: 'Katalog dikembalikan ke data bawaan produk.json.' });
                }}
              />
            )}
            {canEdit && (
              <AdminActionLink
                to="/admin/produk/baru"
                variant="primary"
                label="Tambah Produk"
                icon={<Plus className="size-3.5" />}
              />
            )}
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {activeCatalog && (
        <div className="p-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-md)]">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-semibold text-[var(--text)]">
              Catatan Katalog ({products.length} Unit)
            </p>
            <p className="text-xs text-[var(--text-muted)]">{activeCatalog.catatan}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <label htmlFor="admin-catalog-search" className="sr-only">
            Cari produk katalog
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <Input
            id="admin-catalog-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama produk, kategori, atau slug..."
            className="pl-9"
          />
        </div>
        <div className="w-full sm:w-52">
          <label htmlFor="admin-catalog-cat" className="sr-only">
            Filter kategori
          </label>
          <Select
            id="admin-catalog-cat"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Belum ada produk yang cocok dengan filter pencarian.
            </p>
            {canEdit && (
              <Link
                to="/admin/produk/baru"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90"
              >
                Buat Produk Pertama
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Mobile minimalist list */}
            <div className="md:hidden divide-y divide-[var(--border)]">
              {filteredProducts.map((product) => {
                const starting = resolveCatalogStartingPrice(product, customPricing);
                return (
                  <div key={product.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start gap-3">
                      <div className="size-12 rounded-[var(--radius-sm)] overflow-hidden border border-[var(--border)] bg-[var(--surface-muted)] shrink-0">
                        <ImageFallback
                          src={getProductCoverImage(product)}
                          alt={product.nama}
                          aspectRatio="1/1"
                          compact
                          fallbackLabel="Gambar"
                          className="rounded-none border-0"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-sm font-semibold text-[var(--text)] truncate">
                          {product.nama}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">
                          {product.kategori} · /{getProductSlug(product)}
                        </p>
                        <p className="text-xs font-semibold text-[var(--text)] tabular-nums pt-0.5">
                          {starting.label}
                          <span className="font-normal text-[var(--text-muted)]">
                            /{starting.pricingUnitLabel}
                          </span>
                          {starting.promoActive && starting.discountPercentLabel && (
                            <span className="ml-1.5 text-[11px] font-medium text-[var(--danger)]">
                              · Hemat {starting.discountPercentLabel}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-[var(--text-subtle)] tabular-nums truncate">
                        {product.referensiUkuran.map((size) => `${size} cm`).join(' · ')}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {canEdit && (
                          <>
                            <AdminActionLink
                              to={`/admin/produk/${product.id}/edit`}
                              label={`Edit ${product.nama}`}
                              iconOnly
                              icon={<Pencil className="size-3.5" />}
                            />
                            <AdminActionButton
                              label={`Duplikasi ${product.nama}`}
                              iconOnly
                              icon={<Copy className="size-3.5" />}
                              onClick={() => void handleDuplicate(product)}
                            />
                          </>
                        )}
                        {canDelete && (
                          <AdminActionButton
                            variant="danger"
                            label={`Hapus ${product.nama}`}
                            iconOnly
                            icon={<Trash2 className="size-3.5" />}
                            onClick={() => void handleDelete(product)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs text-[var(--text-muted)]">
                    <th className="py-3 px-4 font-medium">Produk</th>
                    <th className="py-3 px-4 font-medium">Kategori</th>
                    <th className="py-3 px-4 font-medium">Ukuran Referensi</th>
                    <th className="py-3 px-4 font-medium">Harga Mulai</th>
                    <th className="py-3 px-4 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-[var(--surface-elevated)]">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 min-w-[220px]">
                          <div className="size-12 rounded-[var(--radius-sm)] overflow-hidden border border-[var(--border)] bg-[var(--surface-muted)] shrink-0">
                            <ImageFallback
                              src={getProductCoverImage(product)}
                              alt={product.nama}
                              aspectRatio="1/1"
                              compact
                              fallbackLabel="Gambar"
                              className="rounded-none border-0"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--text)] truncate">{product.nama}</p>
                            <p className="text-xs text-[var(--text-muted)] truncate">
                              /{getProductSlug(product)}
                              {product.promo !== undefined && String(product.promo).trim()
                                ? ` · Promo ${String(product.promo).trim()}`
                                : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--text-muted)] whitespace-nowrap">
                        {product.kategori}
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--text-muted)] tabular-nums">
                        {product.referensiUkuran.map((size) => `${size} cm`).join(' · ')}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-[var(--text)] tabular-nums whitespace-nowrap">
                        {(() => {
                          const starting = resolveCatalogStartingPrice(product, customPricing);
                          return (
                            <div className="space-y-0.5">
                              {starting.promoActive && starting.compareAtFormattedAmount && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-normal text-[var(--text-subtle)] line-through">
                                    {starting.compareAtFormattedAmount}
                                  </span>
                                  {starting.discountPercentLabel && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-sm)] border border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger)] text-[10px] font-semibold leading-tight">
                                      Hemat {starting.discountPercentLabel}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div>
                                {starting.label}
                                <span className="font-normal text-[var(--text-muted)]">
                                  /{starting.pricingUnitLabel}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit && (
                            <>
                              <AdminActionLink
                                to={`/admin/produk/${product.id}/edit`}
                                aria-label={`Edit ${product.nama}`}
                                label="Edit"
                                icon={<Pencil className="size-3.5" />}
                              />
                              <AdminActionButton
                                label={`Duplikasi ${product.nama}`}
                                iconOnly
                                icon={<Copy className="size-3.5" />}
                                onClick={() => void handleDuplicate(product)}
                              />
                            </>
                          )}
                          {canDelete && (
                            <AdminActionButton
                              variant="danger"
                              label={`Hapus ${product.nama}`}
                              iconOnly
                              icon={<Trash2 className="size-3.5" />}
                              onClick={() => void handleDelete(product)}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
