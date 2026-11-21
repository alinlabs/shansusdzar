import { Save } from 'lucide-react';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../components/admin/admin-feedback';
import { Button } from '../../../components/ui/button';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import { DEFAULT_SEO_SETTINGS } from '../../../lib/cms-defaults';
import { hasPermission } from '../../../lib/rbac';
import { useAdminAuthStore } from '../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../store/site-content-store';
import { AdminPageHeader } from '../admin-shell';
import { SectionAdminSeo } from './seo-section';

export default function AdminSeoPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const seoSettings = useSiteContentStore((state) => state.seoSettings) ?? DEFAULT_SEO_SETTINGS;
  const updateSeoSettings = useSiteContentStore((state) => state.updateSeoSettings);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Pengatur SEO | SEO Admin ${businessConfig.namaMerekSingkat}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit =
    hasPermission(currentRole, 'tentang.edit') || hasPermission(currentRole, 'bisnis.edit');

  const [feedback, setFeedback] = useAdminFeedbackState();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Pengatur SEO & Schema Global"
        description="Atur meta title, meta description, OpenGraph, pratinjau Google, dan JSON-LD Schema.org."
        actions={
          canEdit ? (
            <Button type="submit" form="admin-seo-form" variant="primary" size="sm">
              <Save className="size-3.5" aria-hidden="true" />
              Simpan SEO
            </Button>
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <SectionAdminSeo
        formId="admin-seo-form"
        seoSettings={seoSettings}
        businessConfig={businessConfig}
        canEdit={canEdit}
        onSaveSeo={(nextSeo) => {
          updateSeoSettings(nextSeo);
          recordActivity('Memperbarui pengaturan SEO & Schema', 'SEO', nextSeo.judulBawaan);
          setFeedback({
            type: 'ok',
            text: 'Pengaturan SEO global, OpenGraph, dan Schema.org berhasil disimpan.',
          });
        }}
      />
    </div>
  );
}
