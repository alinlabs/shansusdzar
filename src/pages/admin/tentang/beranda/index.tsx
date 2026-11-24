import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { FormField, Input, Textarea } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminBerandaPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const beranda = useSiteContentStore((state) => state.beranda);
  const updateBeranda = useSiteContentStore((state) => state.updateBeranda);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Beranda | Tentang & Situs Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEditTentang = hasPermission(currentRole, 'tentang.edit');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [berandaDraft, setBerandaDraft] = useState(() => structuredClone(beranda));

  const handleSaveBeranda = (event: FormEvent) => {
    event.preventDefault();
    if (!canEditTentang) return;
    updateBeranda(berandaDraft);
    recordActivity('Memperbarui konten halaman Beranda', 'Beranda', berandaDraft.judulHero);
    setFeedback({
      type: 'ok',
      text: 'Seluruh konten Beranda (Hero, Keunggulan, Proses) berhasil disimpan.',
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Editor Halaman Beranda"
        description="Sesuaikan teks hero, judul seksi, dan alur kerja 4 tahap."
        actions={
          canEditTentang ? (
            <Button type="submit" form="admin-beranda-form" variant="primary" size="sm">
              <Save className="size-3.5" aria-hidden="true" />
              Simpan Beranda
            </Button>
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <form id="admin-beranda-form" onSubmit={handleSaveBeranda} className="space-y-6 max-w-5xl">
        <AdminFormSectionCard title="Hero Utama">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField id="h-eyebrow" label="Eyebrow Hero">
              <Input
                id="h-eyebrow"
                disabled={!canEditTentang}
                value={berandaDraft.labelHero}
                onChange={(e) => setBerandaDraft((p) => ({ ...p, labelHero: e.target.value }))}
              />
            </FormField>
            <FormField id="h-title1" label="Judul Baris 1">
              <Input
                id="h-title1"
                disabled={!canEditTentang}
                value={berandaDraft.judulHero}
                onChange={(e) => setBerandaDraft((p) => ({ ...p, judulHero: e.target.value }))}
              />
            </FormField>
            <FormField id="h-title2" label="Judul Baris 2">
              <Input
                id="h-title2"
                disabled={!canEditTentang}
                value={berandaDraft.judulHeroBarisDua}
                onChange={(e) =>
                  setBerandaDraft((p) => ({ ...p, judulHeroBarisDua: e.target.value }))
                }
              />
            </FormField>
            <FormField id="h-desc1" label="Subjudul Baris 1">
              <Input
                id="h-desc1"
                disabled={!canEditTentang}
                value={berandaDraft.deskripsiHero}
                onChange={(e) =>
                  setBerandaDraft((p) => ({ ...p, deskripsiHero: e.target.value }))
                }
              />
            </FormField>
            <FormField id="h-desc2" label="Subjudul Baris 2">
              <Input
                id="h-desc2"
                disabled={!canEditTentang}
                value={berandaDraft.deskripsiHeroBarisDua}
                onChange={(e) =>
                  setBerandaDraft((p) => ({
                    ...p,
                    deskripsiHeroBarisDua: e.target.value,
                  }))
                }
              />
            </FormField>
          </div>
        </AdminFormSectionCard>

        <AdminFormSectionCard title="Judul Seksi & Tahapan Alur Kerja">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="sec-pf-title" label="Judul Seksi Portofolio">
              <Input
                id="sec-pf-title"
                disabled={!canEditTentang}
                value={berandaDraft.judulPortofolio}
                onChange={(e) =>
                  setBerandaDraft((p) => ({ ...p, judulPortofolio: e.target.value }))
                }
              />
            </FormField>
            <FormField id="sec-feat-title" label="Judul Seksi Produk Unggulan">
              <Input
                id="sec-feat-title"
                disabled={!canEditTentang}
                value={berandaDraft.judulUnggulan}
                onChange={(e) =>
                  setBerandaDraft((p) => ({ ...p, judulUnggulan: e.target.value }))
                }
              />
            </FormField>
            <FormField id="sec-val-title" label="Judul Seksi Keunggulan">
              <Input
                id="sec-val-title"
                disabled={!canEditTentang}
                value={berandaDraft.judulKeunggulan}
                onChange={(e) => setBerandaDraft((p) => ({ ...p, judulKeunggulan: e.target.value }))}
              />
            </FormField>
            <FormField id="sec-proc-title" label="Judul Seksi Alur Kerja">
              <Input
                id="sec-proc-title"
                disabled={!canEditTentang}
                value={berandaDraft.judulProses}
                onChange={(e) => setBerandaDraft((p) => ({ ...p, judulProses: e.target.value }))}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--border)]">
            {berandaDraft.tahapanProses.map((step, idx) => (
              <div
                key={step.id}
                className="p-4 border border-[var(--border)] rounded-[var(--radius-md)] space-y-2"
              >
                <p className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                  Tahap {step.nomor}
                </p>
                <Input
                  disabled={!canEditTentang}
                  value={step.judul}
                  onChange={(e) =>
                    setBerandaDraft((p) => ({
                      ...p,
                      tahapanProses: p.tahapanProses.map((item, i) =>
                        i === idx ? { ...item, judul: e.target.value } : item
                      ),
                    }))
                  }
                />
                <Textarea
                  rows={2}
                  disabled={!canEditTentang}
                  value={step.deskripsi}
                  onChange={(e) =>
                    setBerandaDraft((p) => ({
                      ...p,
                      tahapanProses: p.tahapanProses.map((item, i) =>
                        i === idx ? { ...item, deskripsi: e.target.value } : item
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </AdminFormSectionCard>
      </form>
    </div>
  );
}
