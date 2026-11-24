import { useState } from 'react';
import { Download, RotateCcw, Upload, Users } from 'lucide-react';
import { AdminActionButton } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
import { FormField, Textarea } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminAksesCadanganPage() {
  const siteState = useSiteContentStore();
  const shortBrandName = siteState.businessConfig.namaMerekSingkat;

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);
  const resetAccessDefaults = useAdminAuthStore((state) => state.resetAccessDefaults);

  useDocumentTitle(`Cadangan & Reset Situs | Hak Akses Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canManage = hasPermission(currentRole, 'akses.manage');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [importJsonText, setImportJsonText] = useState('');

  const handleExportSiteBundle = () => {
    const payload = {
      schemaVersion: 3,
      updatedAt: siteState.updatedAt,
      businessConfig: siteState.businessConfig,
      beranda: siteState.beranda,
      tentang: siteState.tentang,
      portfolioProjects: siteState.portfolioProjects,
      newsArticles: siteState.newsArticles,
      materials: siteState.materials,
      faqs: siteState.faqs,
      operationalInfo: siteState.operationalInfo,
      catalogOverride: siteState.catalogOverride,
      seoSettings: siteState.seoSettings,
      socialPlans: siteState.socialPlans,
      customPricing: siteState.customPricing,
      paymentScheme: siteState.paymentScheme,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sdi-cms-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBundle = () => {
    if (!canManage || !importJsonText.trim()) return;
    const res = siteState.importSiteBundle(importJsonText);
    setFeedback({ type: res.ok ? 'ok' : 'err', text: res.message });
    if (res.ok) {
      recordActivity('Memulihkan cadangan JSON situs', 'Hak Akses', 'Impor Data Situs');
      setImportJsonText('');
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Cadangan"
        actions={
          <AdminActionButton
            variant="primary"
            icon={<Download className="size-3.5" />}
            label="Unduh JSON"
            onClick={handleExportSiteBundle}
          />
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        <AdminFormSectionCard title="Ekspor & Reset">
          <div className="flex flex-wrap gap-2.5 sm:gap-3">
            <AdminActionButton
              variant="primary"
              icon={<Download className="size-3.5" />}
              label="Unduh Cadangan JSON"
              hideLabelOnMobile={false}
              mobileLabel="Unduh JSON"
              onClick={handleExportSiteBundle}
            />
            {canManage && (
              <>
                <AdminActionButton
                  icon={<RotateCcw className="size-3.5" />}
                  label="Reset Konten Bawaan"
                  hideLabelOnMobile={false}
                  mobileLabel="Reset Konten"
                  onClick={() => {
                    siteState.resetAllSiteContent();
                    recordActivity(
                      'Mereset seluruh konten situs ke bawaan',
                      'Hak Akses',
                      'Factory Reset Konten'
                    );
                    setFeedback({
                      type: 'ok',
                      text: 'Seluruh konten situs dikembalikan ke pengaturan bawaan.',
                    });
                  }}
                />
                <AdminActionButton
                  icon={<Users className="size-3.5" />}
                  label="Reset Peran & Staf"
                  hideLabelOnMobile={false}
                  mobileLabel="Reset Staf"
                  onClick={() => {
                    resetAccessDefaults();
                    setFeedback({
                      type: 'ok',
                      text: 'Daftar staf dan peran RBAC dikembalikan ke bawaan.',
                    });
                  }}
                />
              </>
            )}
          </div>
        </AdminFormSectionCard>

        <AdminFormSectionCard title="Pulihkan JSON">
          <FormField id="backup-json" label="Tempel JSON cadangan">
            <Textarea
              id="backup-json"
              rows={5}
              disabled={!canManage}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder='{"schemaVersion": 3, ...}'
            />
          </FormField>
          {canManage && (
            <AdminActionButton
              icon={<Upload className="size-3.5" />}
              label="Pulihkan Data Situs"
              hideLabelOnMobile={false}
              mobileLabel="Pulihkan"
              disabled={!importJsonText.trim()}
              onClick={handleImportBundle}
            />
          )}
        </AdminFormSectionCard>
      </div>
    </div>
  );
}
