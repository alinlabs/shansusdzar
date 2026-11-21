import { useState } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
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
      policies: siteState.policies,
      operationalInfo: siteState.operationalInfo,
      catalogOverride: siteState.catalogOverride,
      seoSettings: siteState.seoSettings,
      socialPlans: siteState.socialPlans,
      customPricing: siteState.customPricing,
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
    <div className="space-y-6">
      <AdminPageHeader
        title="Cadangan & Reset Situs"
        description="Ekspor cadangan konfigurasi JSON seluruh website, pulihkan dari cadangan, atau reset ke bawaan awal."
        actions={
          <Button type="button" variant="primary" size="sm" onClick={handleExportSiteBundle}>
            <Download className="size-3.5" aria-hidden="true" />
            Unduh Cadangan JSON
          </Button>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AdminFormSectionCard title="Ekspor & Reset Data Konten Situs">
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Unduh seluruh konfigurasi bisnis, konten Beranda, Tentang, Portofolio, Informasi, dan
            override Katalog dalam satu berkas JSON sebagai cadangan.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="primary" size="sm" onClick={handleExportSiteBundle}>
              <Download className="size-4" aria-hidden="true" />
              Unduh Cadangan JSON
            </Button>
            {canManage && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
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
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Reset Konten Bawaan
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    resetAccessDefaults();
                    setFeedback({
                      type: 'ok',
                      text: 'Daftar staf dan peran RBAC dikembalikan ke bawaan.',
                    });
                  }}
                >
                  Reset Peran &amp; Staf
                </Button>
              </>
            )}
          </div>
        </AdminFormSectionCard>

        <AdminFormSectionCard title="Pulihkan dari Cadangan JSON">
          <FormField id="backup-json" label="Tempel isi berkas JSON cadangan">
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
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!importJsonText.trim()}
              onClick={handleImportBundle}
            >
              <Upload className="size-4" aria-hidden="true" />
              Pulihkan Data Situs
            </Button>
          )}
        </AdminFormSectionCard>
      </div>
    </div>
  );
}
