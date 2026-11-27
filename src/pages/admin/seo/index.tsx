import { Save } from 'lucide-react';
import { AdminActionButton } from '../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../components/admin/admin-feedback';
import {
  AdminMobileViewModeToggle,
  useMobileFormViewMode,
} from '../../../components/admin/mobile-form-tabs';
import { Button } from '../../../components/ui/button';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import { DEFAULT_SEO_SETTINGS } from '../../../lib/cms-defaults';
import { canEditPage } from '../../../lib/rbac';
import { useAdminAuthStore } from '../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../store/site-content-store';
import { AdminMobileBottomAction, AdminPageHeader } from '../admin-shell';
import { SectionAdminSeo } from './seo-section';

export default function AdminSeoPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const seoSettings = useSiteContentStore((state) => state.seoSettings) ?? DEFAULT_SEO_SETTINGS;
  const updateSeoSettings = useSiteContentStore((state) => state.updateSeoSettings);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Pengatur SEO | SEO Admin ${businessConfig.namaMerek}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'profil-usaha');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const { mode: viewMode, toggleMode: toggleViewMode } = useMobileFormViewMode();

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="SEO Global"
        actions={
          <>
            {canEdit && (
              <span className="hidden md:inline-flex">
                <AdminActionButton
                  type="submit"
                  form="admin-seo-form"
                  variant="primary"
                  size="sm"
                  iconOnly
                  icon={<Save className="size-4" />}
                  label="Simpan Perubahan"
                  data-testid="desktop-header-submit-btn"
                />
              </span>
            )}
            <AdminMobileViewModeToggle mode={viewMode} onToggle={toggleViewMode} />
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <SectionAdminSeo
        formId="admin-seo-form"
        seoSettings={seoSettings}
        businessConfig={businessConfig}
        canEdit={canEdit}
        mobileViewMode={viewMode}
        onSaveSeo={(nextSeo) => {
          updateSeoSettings(nextSeo);
          recordActivity('Memperbarui pengaturan SEO & Schema', 'SEO', nextSeo.judulBawaan);
          setFeedback({
            type: 'ok',
            text: 'Pengaturan SEO global, OpenGraph, dan Schema.org berhasil disimpan.',
          });
        }}
      />

      {canEdit && (
        <AdminMobileBottomAction>
          <nav aria-label="Aksi simpan seluler">
            <Button
              type="submit"
              form="admin-seo-form"
              variant="primary"
              size="md"
              fullWidth
              data-testid="mobile-bottom-submit-btn"
            >
              Simpan
            </Button>
          </nav>
        </AdminMobileBottomAction>
      )}
    </div>
  );
}
