import { useState } from 'react';
import { ExternalLink, LayoutGrid, RotateCcw, Save, Wallet } from 'lucide-react';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
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
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Custom Interior"
        actions={
          <>
            <AdminActionLink
              to="/admin/produk"
              label="Kelola Daftar Produk"
              icon={<LayoutGrid className="size-3.5 text-[var(--text-muted)]" />}
            />
            <AdminActionLink
              to="/admin/produk/skema-pembayaran"
              label="Skema Pembayaran"
              icon={<Wallet className="size-3.5 text-[var(--text-muted)]" />}
            />
            <AdminActionLink
              to="/produk/custom"
              label="Kalkulator Publik"
              icon={<ExternalLink className="size-3.5 text-[var(--text-muted)]" />}
            />
            {canEdit && (
              <>
                <AdminActionButton
                  label="Reset Tarif Awal"
                  icon={<RotateCcw className="size-3.5" />}
                  onClick={handleResetCustomPricing}
                />
                <AdminActionButton
                  type="submit"
                  form="custom-interior-pricing-form"
                  variant="primary"
                  label="Simpan Harga"
                  mobileLabel="Simpan"
                  icon={<Save className="size-3.5" />}
                />
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
