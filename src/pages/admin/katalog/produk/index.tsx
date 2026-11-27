import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Download,
  ExternalLink,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { ImageFallback } from '../../../../components/ui/image-fallback';
import { filterAdminCatalogProducts } from '../../../../lib/admin-header-search';
import { getProductCoverImage, serializeProductForJson } from '../../../../lib/product-catalog';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { ProductItem } from '../../../../types/product';
import { AdminPageHeader } from '../../admin-shell';
import { resolveRawProductPrice } from './logic';

export default function AdminKatalogPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);
  const deleteCatalogProduct = useSiteContentStore((state) => state.deleteCatalogProduct);
  const resetCatalogToFileDefault = useSiteContentStore((state) => state.resetCatalogToFileDefault);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Kelola Produk | Admin ${shortBrandName}`);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'produk');
  const canDelete = canEdit;

  const activeCatalog = catalogOverride ?? loadedBaseCatalog;
  const products = activeCatalog?.daftarProduk ?? [];

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [feedback, setFeedback] = useAdminFeedbackState();

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.kategori).filter(Boolean));
    return ['Semua', ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(
    () => filterAdminCatalogProducts(products, searchQuery, categoryFilter),
    [products, categoryFilter, searchQuery]
  );

  const hasCustomFilter = categoryFilter !== 'Semua';
  const hasAnyFilter = searchQuery.trim() !== '' || hasCustomFilter;

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('Semua');
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
        title="Daftar Produk"
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Cari nama produk, kategori, atau slug...',
          ariaLabel: 'Cari produk katalog',
          hasActiveFilter: hasCustomFilter,
          onResetAll: handleResetFilters,
          filterAriaLabel: 'Filter kategori produk',
          filterTitle: 'Filter Kategori',
          renderFilterContent: (closeFilter) => (
            <>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Filter Kategori
                </p>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {categories.map((cat) => {
                    const active = categoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={[
                          'w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-[var(--radius-sm)] text-xs cursor-pointer transition-colors text-left',
                          active
                            ? 'bg-[var(--surface-muted)] text-[var(--text)] font-semibold'
                            : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)]/60',
                        ].join(' ')}
                      >
                        <span className="truncate">{cat}</span>
                        {active && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!hasCustomFilter}
                  onClick={() => setCategoryFilter('Semua')}
                  className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  Reset Kategori
                </button>
                <button
                  type="button"
                  onClick={closeFilter}
                  className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-semibold cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </>
          ),
        }}
        actions={
          <>
            <AdminActionLink
              to="/produk"
              label="Produk Publik"
              icon={<ExternalLink className="size-3.5 text-[var(--text-muted)]" />}
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

      {filteredProducts.length === 0 ? (
        <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-8 text-center space-y-3">
          <p className="text-sm text-[var(--text-muted)]">
            Belum ada produk yang cocok dengan filter pencarian.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {hasAnyFilter && (
              <AdminActionButton
                variant="ghost"
                icon={<RotateCcw className="size-3.5" />}
                label="Reset Filter"
                hideLabelOnMobile={false}
                onClick={handleResetFilters}
              />
            )}
            {canEdit && products.length === 0 && (
              <Link
                to="/admin/produk/baru"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90"
              >
                Buat Produk Pertama
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Mobile separated cards without outer card wrapper */}
          <div className="md:hidden space-y-2.5">
            {filteredProducts.map((product) => {
              const rawPrice = resolveRawProductPrice(product);
              return (
                <div
                  key={product.id}
                  className="p-3.5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex items-center gap-3"
                >
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
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)] truncate">
                        {product.nama}
                      </p>
                      {rawPrice.hasPromo && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-red-600 text-white text-[10px] font-semibold leading-none shrink-0">
                          Promosi
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-medium text-[var(--text-muted)] tabular-nums truncate">
                      {rawPrice.formattedLabel}
                    </p>
                  </div>

                  {(canEdit || canDelete) && (
                    <div className="flex items-center gap-1 shrink-0">
                      {canEdit && (
                        <Link
                          to={`/admin/produk/${product.id}/edit`}
                          aria-label={`Edit ${product.nama}`}
                          className="inline-flex items-center justify-center size-8 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Link>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          aria-label={`Hapus ${product.nama}`}
                          onClick={() => void handleDelete(product)}
                          className="inline-flex items-center justify-center size-8 rounded-[var(--radius-sm)] text-[var(--danger)] hover:opacity-80 transition-opacity cursor-pointer"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-xs text-[var(--text-muted)]">
                    <th className="py-3 px-4 font-medium">Produk</th>
                    <th className="py-3 px-4 font-medium">Ukuran Referensi</th>
                    <th className="py-3 px-4 font-medium">Harga</th>
                    <th className="py-3 px-4 font-medium">Promosi</th>
                    <th className="py-3 px-4 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredProducts.map((product) => {
                    const rawPrice = resolveRawProductPrice(product);
                    return (
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
                                {product.kategori}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-[var(--text-muted)] tabular-nums">
                          {product.referensiUkuran.map((size) => `${size} cm`).join(' · ')}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-[var(--text)] tabular-nums whitespace-nowrap">
                          {rawPrice.formattedLabel}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {rawPrice.promoDisplay ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] bg-red-600 text-white text-[11px] font-semibold leading-none tabular-nums">
                              {rawPrice.promoDisplay}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {canEdit && (
                              <AdminActionLink
                                to={`/admin/produk/${product.id}/edit`}
                                aria-label={`Edit ${product.nama}`}
                                label={`Edit ${product.nama}`}
                                iconOnly
                                icon={<Pencil className="size-3.5" />}
                              />
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
