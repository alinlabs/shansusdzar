import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, ExternalLink, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Button } from '../../../../components/ui/button';
import { Input, Select } from '../../../../components/ui/form-controls';
import { ImageFallback } from '../../../../components/ui/image-fallback';
import { resolveCatalogStartingPrice } from '../../../../lib/catalog-pricing';
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
  const updateCatalogMeta = useSiteContentStore((state) => state.updateCatalogMeta);
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
      return `${p.nama} ${p.kategori} ${p.deskripsiSingkat} ${p.slug}`.toLowerCase().includes(q);
    });
  }, [products, categoryFilter, searchQuery]);

  const handleDuplicate = async (product: ProductItem) => {
    if (!canEdit) return;
    const copy: ProductItem = {
      ...structuredClone(product),
      id: `prod-${Date.now()}`,
      slug: `${product.slug}-salinan-${Math.floor(Math.random() * 900 + 100)}`,
      nama: `${product.nama} (Salinan)`,
      urutan: products.length + 1,
    };
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
    const blob = new Blob([JSON.stringify(activeCatalog, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'produk.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Pembuat & Editor Produk"
        description="Perubahan produk dan harga di sini tersinkronisasi langsung dengan /produk, /produk/custom, dan Beranda."
        actions={
          <>
            <Link
              to="/produk"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
            >
              <ExternalLink className="size-3.5 text-[var(--text-muted)]" aria-hidden="true" />
              Produk Publik
            </Link>
            <Link
              to="/admin/produk/custom"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
            >
              Tarif Desain &amp; Custom /m²
            </Link>
            <Button type="button" variant="secondary" size="sm" onClick={handleExportCatalogJson}>
              <Download className="size-3.5" aria-hidden="true" />
              Unduh produk.json
            </Button>
            {canEdit && catalogOverride && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await resetCatalogToFileDefault();
                  recordActivity('Mengembalikan katalog ke bawaan file', 'Katalog', 'produk.json');
                  setFeedback({ type: 'ok', text: 'Katalog dikembalikan ke data bawaan produk.json.' });
                }}
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reset Bawaan
              </Button>
            )}
            {canEdit && (
              <Link
                to="/admin/produk/baru"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Tambah Produk
              </Link>
            )}
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {activeCatalog && (
        <div className="p-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-md)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-semibold text-[var(--text)]">
              Catatan Katalog ({products.length} Unit)
            </p>
            <p className="text-xs text-[var(--text-muted)] truncate">{activeCatalog.catatan}</p>
          </div>
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={async () => {
                await updateCatalogMeta({
                  catatan: activeCatalog.catatan,
                  katalogContoh: !activeCatalog.katalogContoh,
                });
                recordActivity('Mengubah status penanda demo katalog', 'Katalog', 'Metadata Katalog');
              }}
            >
              {activeCatalog.katalogContoh ? 'Mode: Referensi Demo' : 'Mode: Katalog Resmi'}
            </Button>
          )}
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs text-[var(--text-muted)]">
                  <th className="py-3 px-4 font-medium">Produk</th>
                  <th className="py-3 px-4 font-medium">Kategori</th>
                  <th className="py-3 px-4 font-medium">Harga</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Urutan</th>
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
                            src={product.daftarGambar[0]}
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
                            /{product.slug}
                            {product.unggulan ? ' · Unggulan' : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--text-muted)] whitespace-nowrap">
                      {product.kategori}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-[var(--text)] tabular-nums whitespace-nowrap">
                      {(() => {
                        const resolved = resolveCatalogStartingPrice(product, customPricing);
                        return (
                          <div className="flex flex-col">
                            <span>{resolved.label}</span>
                            {resolved.promoActive && resolved.compareAtFormattedAmount && (
                              <span className="text-[11px] font-normal text-[var(--text-muted)] line-through">
                                {resolved.compareAtFormattedAmount}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--text-muted)] capitalize whitespace-nowrap">
                      {product.ketersediaan}
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--text-muted)] tabular-nums">
                      #{product.urutan}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEdit && (
                          <>
                            <Link
                              to={`/admin/produk/${product.id}/edit`}
                              aria-label={`Edit ${product.nama}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                              Edit
                            </Link>
                            <button
                              type="button"
                              aria-label={`Duplikasi ${product.nama}`}
                              onClick={() => void handleDuplicate(product)}
                              className="inline-flex items-center justify-center size-8 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
                            >
                              <Copy className="size-3.5" aria-hidden="true" />
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            aria-label={`Hapus ${product.nama}`}
                            onClick={() => void handleDelete(product)}
                            className="inline-flex items-center justify-center size-8 rounded-[var(--radius-sm)] border border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger)] hover:opacity-85 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
