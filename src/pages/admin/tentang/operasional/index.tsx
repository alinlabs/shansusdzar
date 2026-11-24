import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { Link } from 'react-router';
import { AdminActionButton } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
import { FormField, Input } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminOperasionalPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const operationalInfo = useSiteContentStore((state) => state.operationalInfo);
  const updateOperationalInfo = useSiteContentStore((state) => state.updateOperationalInfo);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Operasional | Admin ${shortBrandName}`);

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
    recordActivity('Memperbarui informasi operasional', 'Operasional', 'Jam & Area Layanan');
    setFeedback({
      type: 'ok',
      text: 'Informasi operasional berhasil disimpan.',
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Operasional"
        actions={
          canEdit ? (
            <AdminActionButton
              type="submit"
              form="admin-operasional-form"
              variant="primary"
              icon={<Save className="size-3.5" />}
              label="Simpan Perubahan"
              mobileLabel="Simpan"
            />
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <form id="admin-operasional-form" onSubmit={handleSaveOperational} className="max-w-6xl">
        <AdminFormSectionCard title="Jadwal & Ketentuan Layanan">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="op-hours" label="Jam Operasional">
              <Input
                id="op-hours"
                disabled={!canEdit}
                value={opDraft.jamOperasional}
                onChange={(e) => setOpDraft((p) => ({ ...p, jamOperasional: e.target.value }))}
              />
            </FormField>
            <FormField id="op-survey" label="Jadwal Survei">
              <Input
                id="op-survey"
                disabled={!canEdit}
                value={opDraft.catatanJadwalSurvei}
                onChange={(e) =>
                  setOpDraft((p) => ({ ...p, catatanJadwalSurvei: e.target.value }))
                }
              />
            </FormField>
            <FormField id="op-lead" label="Estimasi Produksi">
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

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="op-payment" className="text-xs font-medium text-[var(--text)]">
                Ringkasan Pembayaran
              </label>
              <Link
                to="/admin/produk/skema-pembayaran"
                className="text-xs font-medium text-[var(--text)] underline underline-offset-4 hover:text-[var(--text-muted)]"
              >
                Atur Skema Pembayaran →
              </Link>
            </div>
            <Input
              id="op-payment"
              disabled={!canEdit}
              value={opDraft.ringkasanTerminPembayaran}
              onChange={(e) =>
                setOpDraft((p) => ({ ...p, ringkasanTerminPembayaran: e.target.value }))
              }
            />
          </div>

          <FormField id="op-areas" label="Area Survei (pisahkan koma)">
            <Input
              id="op-areas"
              disabled={!canEdit}
              value={areasText}
              onChange={(e) => setAreasText(e.target.value)}
            />
          </FormField>
        </AdminFormSectionCard>
      </form>
    </div>
  );
}
