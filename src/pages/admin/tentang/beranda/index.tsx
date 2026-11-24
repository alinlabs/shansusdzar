import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { AdminActionButton } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
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

  useDocumentTitle(`Beranda | Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEditTentang = hasPermission(currentRole, 'tentang.edit');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [berandaDraft, setBerandaDraft] = useState(() => structuredClone(beranda));

  const handleSaveBeranda = (event: FormEvent) => {
    event.preventDefault();
    if (!canEditTentang) return;
    updateBeranda(berandaDraft);
    recordActivity('Memperbarui konten Beranda', 'Beranda', berandaDraft.judulHero);
    setFeedback({
      type: 'ok',
      text: 'Konten Beranda berhasil disimpan.',
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Beranda"
        actions={
          canEditTentang ? (
            <AdminActionButton
              type="submit"
              form="admin-beranda-form"
              variant="primary"
              icon={<Save className="size-3.5" />}
              label="Simpan Perubahan"
              mobileLabel="Simpan"
            />
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <form id="admin-beranda-form" onSubmit={handleSaveBeranda} className="space-y-5 sm:space-y-6 max-w-6xl">
        <AdminFormSectionCard title="Hero Utama">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField id="h-eyebrow" label="Eyebrow">
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

        <AdminFormSectionCard title="Judul Seksi">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="sec-pf-eyebrow" label="Eyebrow Portofolio">
              <Input
                id="sec-pf-eyebrow"
                disabled={!canEditTentang}
                value={berandaDraft.labelPortofolio}
                onChange={(e) =>
                  setBerandaDraft((p) => ({ ...p, labelPortofolio: e.target.value }))
                }
              />
            </FormField>
            <FormField id="sec-pf-title" label="Judul Portofolio">
              <Input
                id="sec-pf-title"
                disabled={!canEditTentang}
                value={berandaDraft.judulPortofolio}
                onChange={(e) =>
                  setBerandaDraft((p) => ({ ...p, judulPortofolio: e.target.value }))
                }
              />
            </FormField>

            <FormField id="sec-feat-eyebrow" label="Eyebrow Koleksi">
              <Input
                id="sec-feat-eyebrow"
                disabled={!canEditTentang}
                value={berandaDraft.labelUnggulan}
                onChange={(e) =>
                  setBerandaDraft((p) => ({ ...p, labelUnggulan: e.target.value }))
                }
              />
            </FormField>
            <FormField id="sec-feat-title" label="Judul Koleksi">
              <Input
                id="sec-feat-title"
                disabled={!canEditTentang}
                value={berandaDraft.judulUnggulan}
                onChange={(e) =>
                  setBerandaDraft((p) => ({ ...p, judulUnggulan: e.target.value }))
                }
              />
            </FormField>

            <FormField id="sec-val-eyebrow" label="Eyebrow Keunggulan">
              <Input
                id="sec-val-eyebrow"
                disabled={!canEditTentang}
                value={berandaDraft.labelKeunggulan}
                onChange={(e) =>
                  setBerandaDraft((p) => ({ ...p, labelKeunggulan: e.target.value }))
                }
              />
            </FormField>
            <FormField id="sec-val-title" label="Judul Keunggulan">
              <Input
                id="sec-val-title"
                disabled={!canEditTentang}
                value={berandaDraft.judulKeunggulan}
                onChange={(e) => setBerandaDraft((p) => ({ ...p, judulKeunggulan: e.target.value }))}
              />
            </FormField>

            <FormField id="sec-proc-eyebrow" label="Eyebrow Alur Kerja">
              <Input
                id="sec-proc-eyebrow"
                disabled={!canEditTentang}
                value={berandaDraft.labelProses}
                onChange={(e) => setBerandaDraft((p) => ({ ...p, labelProses: e.target.value }))}
              />
            </FormField>
            <FormField id="sec-proc-title" label="Judul Alur Kerja">
              <Input
                id="sec-proc-title"
                disabled={!canEditTentang}
                value={berandaDraft.judulProses}
                onChange={(e) => setBerandaDraft((p) => ({ ...p, judulProses: e.target.value }))}
              />
            </FormField>
          </div>

          <FormField id="sec-proc-desc" label="Deskripsi Alur Kerja">
            <Textarea
              id="sec-proc-desc"
              rows={2}
              disabled={!canEditTentang}
              value={berandaDraft.deskripsiProses}
              onChange={(e) => setBerandaDraft((p) => ({ ...p, deskripsiProses: e.target.value }))}
            />
          </FormField>
        </AdminFormSectionCard>

        <AdminFormSectionCard title="Keunggulan Kerja">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {berandaDraft.daftarKeunggulan.map((item, idx) => (
              <div
                key={item.id}
                className="p-3.5 sm:p-4 border border-[var(--border)] rounded-[var(--radius-md)] space-y-2.5"
              >
                <p className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                  Poin {item.nomor}
                </p>
                <FormField id={`keunggulan-title-${item.id}`} label="Judul">
                  <Input
                    id={`keunggulan-title-${item.id}`}
                    disabled={!canEditTentang}
                    value={item.judul}
                    onChange={(e) =>
                      setBerandaDraft((p) => ({
                        ...p,
                        daftarKeunggulan: p.daftarKeunggulan.map((row, i) =>
                          i === idx ? { ...row, judul: e.target.value } : row
                        ),
                      }))
                    }
                  />
                </FormField>
                <FormField id={`keunggulan-desc-${item.id}`} label="Ringkasan">
                  <Textarea
                    id={`keunggulan-desc-${item.id}`}
                    rows={2}
                    disabled={!canEditTentang}
                    value={item.deskripsi}
                    onChange={(e) =>
                      setBerandaDraft((p) => ({
                        ...p,
                        daftarKeunggulan: p.daftarKeunggulan.map((row, i) =>
                          i === idx ? { ...row, deskripsi: e.target.value } : row
                        ),
                      }))
                    }
                  />
                </FormField>
                <FormField id={`keunggulan-detail-${item.id}`} label="Detail Modal">
                  <Textarea
                    id={`keunggulan-detail-${item.id}`}
                    rows={2}
                    disabled={!canEditTentang}
                    value={item.detail ?? ''}
                    onChange={(e) =>
                      setBerandaDraft((p) => ({
                        ...p,
                        daftarKeunggulan: p.daftarKeunggulan.map((row, i) =>
                          i === idx ? { ...row, detail: e.target.value } : row
                        ),
                      }))
                    }
                  />
                </FormField>
              </div>
            ))}
          </div>
        </AdminFormSectionCard>

        <AdminFormSectionCard title="Alur Kerja">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {berandaDraft.tahapanProses.map((step, idx) => (
              <div
                key={step.id}
                className="p-3.5 sm:p-4 border border-[var(--border)] rounded-[var(--radius-md)] space-y-2.5"
              >
                <p className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                  Tahap {step.nomor}
                </p>
                <FormField id={`proses-title-${step.id}`} label="Judul">
                  <Input
                    id={`proses-title-${step.id}`}
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
                </FormField>
                <FormField id={`proses-desc-${step.id}`} label="Ringkasan">
                  <Textarea
                    id={`proses-desc-${step.id}`}
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
                </FormField>
                <FormField id={`proses-detail-${step.id}`} label="Detail Modal">
                  <Textarea
                    id={`proses-detail-${step.id}`}
                    rows={3}
                    disabled={!canEditTentang}
                    value={step.detail ?? ''}
                    onChange={(e) =>
                      setBerandaDraft((p) => ({
                        ...p,
                        tahapanProses: p.tahapanProses.map((item, i) =>
                          i === idx ? { ...item, detail: e.target.value } : item
                        ),
                      }))
                    }
                  />
                </FormField>
              </div>
            ))}
          </div>
        </AdminFormSectionCard>
      </form>
    </div>
  );
}
