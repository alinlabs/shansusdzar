import { useState } from 'react';
import { ExternalLink, RotateCcw, Save } from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { Button } from '../../../../components/ui/button';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { DEFAULT_CUSTOM_PRICING_CONFIG } from '../../../../lib/cms-defaults';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';
import { SectionAdminCustomPricing } from './pricing-section';

export default function AdminKatalogCustomPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const customPricing =
    useSiteContentStore((state) => state.customPricing) ?? DEFAULT_CUSTOM_PRICING_CONFIG;
  const updateCustomPricing = useSiteContentStore((state) => state.updateCustomPricing);

  const roles = useAdminAuthStore((state) => state.roles);
  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Set Harga Produk Custom Interior | Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'katalog.edit');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [customResetVersion, setCustomResetVersion] = useState(0);

  const handleResetCustomPricing = () => {
    if (!canEdit) return;
    updateCustomPricing(structuredClone(DEFAULT_CUSTOM_PRICING_CONFIG));
    setCustomResetVersion((v) => v + 1);
    recordActivity(
      'Mengembalikan tarif custom interior ke standar workshop',
      'Katalog Custom',
      'Reset Tarif'
    );
    setFeedback({
      type: 'ok',
      text: 'Tarif custom interior dikembalikan ke standar awal workshop.',
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Produk Custom Interior & Set Harga"
        description="Atur tarif jasa desain per m², material utama per m², finishing/laminasi per m², dan biaya opsi kelengkapan agar sinkron di /produk dan /produk/custom."
        actions={
          <>
            <Link
              to="/admin/produk"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
            >
              Kelola Daftar Produk
            </Link>
            <Link
              to="/produk/custom"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
            >
              <ExternalLink className="size-3.5 text-[var(--text-muted)]" aria-hidden="true" />
              Kalkulator Publik
            </Link>
            {canEdit && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleResetCustomPricing}
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Reset Tarif Awal
                </Button>
                <Button
                  type="submit"
                  form="custom-interior-pricing-form"
                  variant="primary"
                  size="sm"
                >
                  <Save className="size-3.5" aria-hidden="true" />
                  Simpan Harga
                </Button>
              </>
            )}
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <SectionAdminCustomPricing
        key={customResetVersion}
        formId="custom-interior-pricing-form"
        pricing={customPricing}
        canEdit={canEdit}
        onSavePricing={(next) => {
          updateCustomPricing(next);
          recordActivity(
            'Memperbarui tarif harga custom interior',
            'Katalog Custom',
            `DP ${next.persentaseDp}%`
          );
          setFeedback({
            type: 'ok',
            text: 'Pengaturan harga & tarif custom interior berhasil disimpan dan langsung aktif di kalkulator publik.',
          });
        }}
      />
    </div>
  );
}
