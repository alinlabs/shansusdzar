import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { Checkbox, FormField, Input, Textarea } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminOperasionalPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const operationalInfo = useSiteContentStore((state) => state.operationalInfo);
  const policies = useSiteContentStore((state) => state.policies);
  const updateOperationalInfo = useSiteContentStore((state) => state.updateOperationalInfo);
  const deletePolicy = useSiteContentStore((state) => state.deletePolicy);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Operasional & Kebijakan | Tentang & Situs Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit =
    hasPermission(currentRole, 'tentang.edit') || hasPermission(currentRole, 'informasi.edit');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [opDraft, setOpDraft] = useState(() => structuredClone(operationalInfo));
  const [areasText, setAreasText] = useState(() => operationalInfo.areaJangkauanSurvei.join(', '));

  const handleSaveOperational = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    const areas = areasText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    updateOperationalInfo({
      ...opDraft,
      areaJangkauanSurvei: areas,
    });
    recordActivity('Memperbarui informasi operasional', 'Tentang & Operasional', 'Jam & Area Layanan');
    setFeedback({
      type: 'ok',
      text: 'Informasi operasional dan pengumuman berhasil disimpan.',
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Operasional & Kebijakan Layanan"
        description="Atur jadwal jam kerja, area cakupan survei, banner pengumuman, dan kebijakan layanan workshop."
        actions={
          canEdit ? (
            <Button type="submit" form="admin-operasional-form" variant="primary" size="sm">
              <Save className="size-3.5" aria-hidden="true" />
              Simpan Operasional
            </Button>
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="space-y-8">
        <form id="admin-operasional-form" onSubmit={handleSaveOperational}>
          <AdminFormSectionCard title="Jadwal Operasional & Pengumuman Layanan">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="op-hours" label="Jam Operasional">
                <Input
                  id="op-hours"
                  disabled={!canEdit}
                  value={opDraft.jamOperasional}
                  onChange={(e) => setOpDraft((p) => ({ ...p, jamOperasional: e.target.value }))}
                />
              </FormField>
              <FormField id="op-survey" label="Catatan Jadwal Survei">
                <Input
                  id="op-survey"
                  disabled={!canEdit}
                  value={opDraft.catatanJadwalSurvei}
                  onChange={(e) =>
                    setOpDraft((p) => ({ ...p, catatanJadwalSurvei: e.target.value }))
                  }
                />
              </FormField>
              <FormField id="op-lead" label="Estimasi Waktu Produksi">
                <Input
                  id="op-lead"
                  disabled={!canEdit}
                  value={opDraft.estimasiWaktuProduksi}
                  onChange={(e) => setOpDraft((p) => ({ ...p, estimasiWaktuProduksi: e.target.value }))}
                />
              </FormField>
              <FormField id="op-warranty" label="Ringkasan Garansi">
                <Input
                  id="op-warranty"
                  disabled={!canEdit}
                  value={opDraft.ringkasanGaransi}
                  onChange={(e) => setOpDraft((p) => ({ ...p, ringkasanGaransi: e.target.value }))}
                />
              </FormField>
            </div>

            <FormField id="op-payment" label="Skema Pembayaran">
              <Input
                id="op-payment"
                disabled={!canEdit}
                value={opDraft.ringkasanTerminPembayaran}
                onChange={(e) =>
                  setOpDraft((p) => ({ ...p, ringkasanTerminPembayaran: e.target.value }))
                }
              />
            </FormField>

            <FormField
              id="op-areas"
              label="Area Cakupan Survei (pisahkan dengan koma)"
              hint="Contoh: Kabupaten Purwakarta, Karawang, Subang, Bandung Raya"
            >
              <Input
                id="op-areas"
                disabled={!canEdit}
                value={areasText}
                onChange={(e) => setAreasText(e.target.value)}
              />
            </FormField>

            <div className="pt-2 border-t border-[var(--border)] space-y-3">
              <Checkbox
                label="Aktifkan Banner Pengumuman di Halaman Informasi"
                disabled={!canEdit}
                checked={opDraft.pengumumanAktif}
                onChange={(e) =>
                  setOpDraft((p) => ({ ...p, pengumumanAktif: e.target.checked }))
                }
              />
              <FormField id="op-banner" label="Teks Pengumuman">
                <Textarea
                  id="op-banner"
                  rows={2}
                  disabled={!canEdit}
                  value={opDraft.teksPengumuman}
                  onChange={(e) =>
                    setOpDraft((p) => ({ ...p, teksPengumuman: e.target.value }))
                  }
                />
              </FormField>
            </div>
          </AdminFormSectionCard>
        </form>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--text)]">
              Kebijakan Layanan &amp; Standar Workshop ({policies.length})
            </h2>
            {canEdit && (
              <Link
                to="/admin/tentang/operasional/kebijakan/baru"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Tambah Kebijakan
              </Link>
            )}
          </div>

          <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] divide-y divide-[var(--border)]">
            {policies.map((pol) => (
              <div key={pol.id} className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">{pol.judul}</p>
                  <p className="text-xs text-[var(--text-muted)]">{pol.ringkasan}</p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link
                      to={`/admin/tentang/operasional/kebijakan/${pol.id}/edit`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Edit
                    </Link>
                    <button
                      type="button"
                      aria-label={`Hapus kebijakan ${pol.judul}`}
                      onClick={() => {
                        deletePolicy(pol.id);
                        recordActivity('Menghapus kebijakan layanan', 'Tentang & Operasional', pol.judul);
                        setFeedback({
                          type: 'ok',
                          text: `Kebijakan "${pol.judul}" telah dihapus.`,
                        });
                      }}
                      className="p-1.5 rounded-[var(--radius-sm)] border border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger)] cursor-pointer"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
