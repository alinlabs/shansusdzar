import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ExternalLink, ImagePlus, Pencil, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { Checkbox, FormField, Input, Textarea } from '../../../../components/ui/form-controls';
import { ImageFallback } from '../../../../components/ui/image-fallback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { useCachedMediaSrc } from '../../../../lib/media-cache';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { TeamMemberData } from '../../../../types/cms';
import { AdminPageHeader } from '../../admin-shell';
import { readResizedPortraitDataUrl } from './logic';

function TeamMemberAvatarPreview({ member }: { member: TeamMemberData }) {
  const cached = useCachedMediaSrc(member.fotoProfil || null);
  const src = cached ?? (member.fotoProfil?.trim() || null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasPhoto = Boolean(src) && failedSrc !== src;

  if (hasPhoto && src) {
    return (
      <div className="size-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] overflow-hidden shrink-0">
        <img
          src={src}
          alt={member.teksAltFoto || `Foto ${member.nama}`}
          onError={() => setFailedSrc(src)}
          className="size-full object-cover object-top"
        />
      </div>
    );
  }

  return (
    <div className="size-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-sm font-semibold text-[var(--text)] shrink-0">
      {member.inisial}
    </div>
  );
}

export default function AdminTimPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const tentang = useSiteContentStore((state) => state.tentang);
  const updateBusinessConfig = useSiteContentStore((state) => state.updateBusinessConfig);
  const updateTentang = useSiteContentStore((state) => state.updateTentang);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Tim & Pemilik | Admin ${businessConfig.namaMerekSingkat}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEditTentang = hasPermission(currentRole, 'tentang.edit');
  const canEditBisnis = hasPermission(currentRole, 'bisnis.edit');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [ownerDraft, setOwnerDraft] = useState(() => structuredClone(businessConfig.drafPemilik));
  const [teamEyebrow, setTeamEyebrow] = useState(tentang.labelTim);
  const [teamTitle, setTeamTitle] = useState(tentang.judulTim);

  const ownerPreviewSrc = useCachedMediaSrc(ownerDraft.jalurFoto) ?? ownerDraft.jalurFoto;

  const handleUploadOwnerPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !canEditBisnis) return;
    try {
      const dataUrl = await readResizedPortraitDataUrl(file, 760);
      setOwnerDraft((prev) => ({
        ...prev,
        jalurFoto: dataUrl,
        teksAltFoto: prev.teksAltFoto || `Foto profil ${prev.namaPemilik}`,
      }));
      setFeedback({
        type: 'ok',
        text: 'Foto dimuat ke pratinjau. Klik Simpan Perubahan untuk menyimpan.',
      });
    } catch {
      setFeedback({ type: 'err', text: 'Gagal memproses foto pemilik.' });
    }
    event.target.value = '';
  };

  const handleSaveOwnerAndHeading = (event: FormEvent) => {
    event.preventDefault();
    if (!canEditTentang && !canEditBisnis) return;

    if (canEditBisnis) {
      updateBusinessConfig({
        ...businessConfig,
        drafPemilik: {
          ...ownerDraft,
          jalurFoto: ownerDraft.jalurFoto.trim() || '/owner.png',
          teksAltFoto: ownerDraft.teksAltFoto.trim(),
        },
      });
    }

    if (canEditTentang) {
      updateTentang({
        ...tentang,
        labelTim: teamEyebrow.trim() || 'Tim & Workshop',
        judulTim: teamTitle.trim() || 'Orang-Orang di Balik Setiap Pengerjaan',
      });
    }

    recordActivity('Memperbarui profil pemilik & tajuk tim', 'Tim & Pemilik', ownerDraft.namaPemilik);
    setFeedback({
      type: 'ok',
      text: 'Profil pemilik dan tajuk tim berhasil disimpan.',
    });
  };

  const handleDeleteMember = (member: TeamMemberData) => {
    if (!canEditTentang) return;
    updateTentang({
      ...tentang,
      anggotaTim: tentang.anggotaTim.filter((item) => item.id !== member.id),
    });
    recordActivity('Menghapus anggota tim', 'Tim & Pemilik', member.nama);
    setFeedback({
      type: 'ok',
      text: `Anggota tim "${member.nama}" dihapus.`,
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Tim & Pemilik"
        actions={
          <>
            <AdminActionLink
              to="/tentang"
              label="Lihat Web"
              icon={<ExternalLink className="size-3.5 text-[var(--text-muted)]" />}
            />
            {(canEditTentang || canEditBisnis) && (
              <AdminActionButton
                type="submit"
                form="admin-tim-owner-form"
                label="Simpan Perubahan"
                mobileLabel="Simpan"
                icon={<Save className="size-3.5" />}
              />
            )}
            {canEditTentang && (
              <AdminActionLink
                to="/admin/tentang/tim/anggota/baru"
                variant="primary"
                label="Tambah Anggota"
                icon={<Plus className="size-3.5" />}
              />
            )}
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <form id="admin-tim-owner-form" onSubmit={handleSaveOwnerAndHeading} className="space-y-6">
        <AdminFormSectionCard title="Profil Pemilik">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 space-y-3">
              <div className="rounded-[var(--radius-lg)] overflow-hidden border border-[var(--border)] bg-[var(--surface-muted)]">
                <ImageFallback
                  src={ownerDraft.jalurFoto ? ownerPreviewSrc : null}
                  alt={ownerDraft.teksAltFoto || ownerDraft.namaPemilik}
                  aspectRatio="4/3"
                  fallbackLabel={ownerDraft.namaPemilik || 'Foto Owner'}
                  className="rounded-none border-0"
                />
              </div>

              {canEditBisnis && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer">
                    <ImagePlus className="size-3.5" aria-hidden="true" />
                    Unggah Foto
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadOwnerPhoto}
                      className="sr-only"
                    />
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setOwnerDraft((p) => ({
                        ...p,
                        jalurFoto: '/owner.png',
                      }))
                    }
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    Reset
                  </Button>
                </div>
              )}
            </div>

            <div className="lg:col-span-8 space-y-4">
              <Checkbox
                id="own-verified"
                label="Tampilkan ke Publik"
                disabled={!canEditBisnis}
                checked={ownerDraft.terverifikasi}
                onChange={(e) =>
                  setOwnerDraft((p) => ({ ...p, terverifikasi: e.target.checked }))
                }
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField id="own-name" label="Nama Pemilik">
                  <Input
                    id="own-name"
                    disabled={!canEditBisnis}
                    value={ownerDraft.namaPemilik}
                    onChange={(e) =>
                      setOwnerDraft((p) => ({ ...p, namaPemilik: e.target.value }))
                    }
                  />
                </FormField>
                <FormField id="own-role" label="Jabatan">
                  <Input
                    id="own-role"
                    disabled={!canEditBisnis}
                    value={ownerDraft.jabatanPemilik}
                    onChange={(e) =>
                      setOwnerDraft((p) => ({ ...p, jabatanPemilik: e.target.value }))
                    }
                  />
                </FormField>
                <FormField id="own-portrait-path" label="Path / URL Foto">
                  <Input
                    id="own-portrait-path"
                    disabled={!canEditBisnis}
                    value={ownerDraft.jalurFoto}
                    onChange={(e) =>
                      setOwnerDraft((p) => ({ ...p, jalurFoto: e.target.value }))
                    }
                  />
                </FormField>
                <FormField id="own-portrait-alt" label="Alt Foto">
                  <Input
                    id="own-portrait-alt"
                    disabled={!canEditBisnis}
                    value={ownerDraft.teksAltFoto}
                    onChange={(e) =>
                      setOwnerDraft((p) => ({ ...p, teksAltFoto: e.target.value }))
                    }
                  />
                </FormField>
              </div>

              <FormField id="own-quote" label="Kutipan">
                <Textarea
                  id="own-quote"
                  rows={2}
                  disabled={!canEditBisnis}
                  value={ownerDraft.kutipanPemilik}
                  onChange={(e) =>
                    setOwnerDraft((p) => ({ ...p, kutipanPemilik: e.target.value }))
                  }
                />
              </FormField>
            </div>
          </div>
        </AdminFormSectionCard>

        <AdminFormSectionCard title="Tajuk Seksi Tim">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="tim-eyebrow" label="Eyebrow">
              <Input
                id="tim-eyebrow"
                disabled={!canEditTentang}
                value={teamEyebrow}
                onChange={(e) => setTeamEyebrow(e.target.value)}
              />
            </FormField>
            <FormField id="tim-title" label="Judul">
              <Input
                id="tim-title"
                disabled={!canEditTentang}
                value={teamTitle}
                onChange={(e) => setTeamTitle(e.target.value)}
              />
            </FormField>
          </div>
        </AdminFormSectionCard>
      </form>

      <AdminFormSectionCard title={`Daftar Anggota (${tentang.anggotaTim.length})`}>
        {tentang.anggotaTim.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)]">
            Belum ada anggota tim terdaftar.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tentang.anggotaTim.map((member) => (
              <article
                key={member.id}
                className="p-4 border border-[var(--border)] bg-[var(--bg)] rounded-[var(--radius-md)] flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <TeamMemberAvatarPreview member={member} />
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--text)] truncate">
                        {member.nama}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {member.jabatan}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-medium text-[var(--text-subtle)] shrink-0">
                    {member.fotoProfil ? 'Ada Foto' : 'Inisial'}
                  </span>
                </div>

                {canEditTentang && (
                  <div className="pt-2.5 border-t border-[var(--border)] flex items-center justify-end gap-1.5">
                    <AdminActionLink
                      to={`/admin/tentang/tim/anggota/${member.id}/edit`}
                      aria-label={`Edit anggota ${member.nama}`}
                      label="Edit"
                      icon={<Pencil className="size-3.5" />}
                    />
                    <AdminActionButton
                      variant="danger"
                      iconOnly
                      label={`Hapus anggota ${member.nama}`}
                      icon={<Trash2 className="size-3.5" />}
                      onClick={() => handleDeleteMember(member)}
                    />
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </AdminFormSectionCard>
    </div>
  );
}
