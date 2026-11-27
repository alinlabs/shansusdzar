import { useMemo, useState } from 'react';
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { filterAdminMaterials } from '../../../../lib/admin-header-search';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { MaterialCategory } from '../../../../types/cms';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminMaterialPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const materials = useSiteContentStore((state) => state.materials);
  const deleteMaterial = useSiteContentStore((state) => state.deleteMaterial);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Matriks Material | Informasi Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'material');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | MaterialCategory>('all');

  const filteredMaterials = useMemo(
    () =>
      filterAdminMaterials(materials, {
        search: searchQuery,
        category: categoryFilter,
      }),
    [materials, searchQuery, categoryFilter]
  );

  const hasCustomFilter = categoryFilter !== 'all';
  const hasAnyFilter = searchQuery.trim() !== '' || hasCustomFilter;

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Material"
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Cari nama material, jenis papan, finishing, atau aplikasi...',
          ariaLabel: 'Cari spesifikasi material',
          hasActiveFilter: hasCustomFilter,
          onResetAll: handleResetFilters,
          filterAriaLabel: 'Filter kategori material',
          filterTitle: 'Filter Kategori Material',
          renderFilterContent: (closeFilter) => (
            <>
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Kategori Material
                </p>
                <Select
                  aria-label="Filter kategori material"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as 'all' | MaterialCategory)}
                  className="px-2.5 text-xs"
                >
                  <option value="all">Semua Kategori</option>
                  <option value="papan">Material Utama</option>
                  <option value="finishing">Finishing / Laminasi</option>
                </Select>
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={!hasCustomFilter}
                  onClick={() => setCategoryFilter('all')}
                  className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                  Reset Setelan
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
          canEdit ? (
            <AdminActionLink
              to="/admin/informasi/material/baru"
              variant="primary"
              label="Tambah Material"
              icon={<Plus className="size-3.5" />}
            />
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y divide-[var(--border)]">
        {filteredMaterials.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-xs text-[var(--text-muted)]">
              {materials.length === 0
                ? 'Belum ada data spesifikasi material terdaftar.'
                : 'Tidak ada spesifikasi material yang cocok dengan pencarian.'}
            </p>
            {hasAnyFilter && (
              <AdminActionButton
                variant="ghost"
                icon={<RotateCcw className="size-3.5" />}
                label="Reset Filter"
                hideLabelOnMobile={false}
                onClick={handleResetFilters}
              />
            )}
          </div>
        ) : (
          filteredMaterials.map((mat) => (
            <div
              key={mat.id}
              className="p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
            >
              <div className="space-y-1 min-w-0">
                <p className="text-[11px] sm:text-xs text-[var(--text-muted)]">
                  {mat.kategori === 'papan' ? 'Material Utama' : 'Finishing/Laminasi'} · Lembap{' '}
                  {mat.ketahananLembap} · Struktur {mat.peringkatKeawetan} · Keterjangkauan{' '}
                  {mat.keterjangkauan}
                </p>
                <p className="text-sm font-semibold text-[var(--text)]">{mat.nama}</p>
                <p className="text-xs text-[var(--text-muted)]">{mat.ringkasan}</p>
              </div>
              {canEdit && (
                <div className="flex items-center justify-end gap-1.5 shrink-0">
                  <AdminActionLink
                    to={`/admin/informasi/material/${mat.id}/edit`}
                    aria-label={`Edit material ${mat.nama}`}
                    label="Edit"
                    icon={<Pencil className="size-3.5" />}
                  />
                  <AdminActionButton
                    variant="danger"
                    iconOnly
                    label={`Hapus material ${mat.nama}`}
                    icon={<Trash2 className="size-3.5" />}
                    onClick={() => {
                      deleteMaterial(mat.id);
                      recordActivity('Menghapus spesifikasi material', 'Informasi', mat.nama);
                      setFeedback({
                        type: 'ok',
                        text: `Material "${mat.nama}" telah dihapus.`,
                      });
                    }}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
