import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ExternalLink, ImagePlus, Pencil, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
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

  useDocumentTitle(`Tim & Profil Pemilik | Tentang & Situs Admin ${businessConfig.namaMerekSingkat}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEditTentang = hasPermission(currentRole, 'tentang.edit');
  const canEditBisnis = hasPermission(currentRole, 'bisnis.edit');

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [ownerDraft, setOwnerDraft] = useState(() => structuredClone(businessConfig.drafPemilik));
  const [ownerBiography, setOwnerBiography] = useState(tentang.biografiPemilik);
  const [teamEyebrow, setTeamEyebrow] = useState(tentang.labelTim);
  const [teamTitle, setTeamTitle] = useState(tentang.judulTim);
  const [teamDescription, setTeamDescription] = useState(tentang.deskripsiTim);

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
        text: 'Foto pemilik berhasil dimuat ke pratinjau. Klik "Simpan Profil Pemilik" untuk menyimpan perubahan.',
      });
    } catch {
      setFeedback({ type: 'err', text: 'Gagal memproses berkas foto pemilik.' });
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
        biografiPemilik: ownerBiography.trim(),
        labelTim: teamEyebrow.trim() || 'Tim & Workshop',
        judulTim: teamTitle.trim() || 'Orang-Orang di Balik Setiap Pengerjaan',
        deskripsiTim: teamDescription.trim(),
      });
    }

    recordActivity('Memperbarui profil & foto pemilik serta seksi tim', 'Tim & Pemilik', ownerDraft.namaPemilik);
    setFeedback({
      type: 'ok',
      text: 'Profil pemilik, foto potret owner, dan tajuk seksi tim berhasil disimpan.',
    });
  };

  const handleDeleteMember = (member: TeamMemberData) => {
    if (!canEditTentang) return;
    updateTentang({
      ...tentang,
      anggotaTim: tentang.anggotaTim.filter((item) => item.id !== member.id),
    });
    recordActivity('Menghapus anggota tim workshop', 'Tim & Pemilik', member.nama);
    setFeedback({
      type: 'ok',
      text: `Anggota tim "${member.nama}" telah dihapus.`,
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Tim Workshop & Profil Pemilik"
        description="Kelola foto & profil pemilik usaha (owner) serta daftar anggota tim lengkap dengan foto masing-masing."
        actions={
          <>
            <Link
              to="/tentang"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
            >
              Lihat Halaman Tentang
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
            {(canEditTentang || canEditBisnis) && (
              <Button type="submit" form="admin-tim-owner-form" variant="secondary" size="sm">
                <Save className="size-3.5" aria-hidden="true" />
                Simpan Profil Pemilik
              </Button>
            )}
            {canEditTentang && (
              <Link
                to="/admin/tentang/tim/anggota/baru"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 min-h-9 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-medium hover:opacity-90 whitespace-nowrap"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Tambah Anggota Tim
              </Link>
            )}
          </>
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <form id="admin-tim-owner-form" onSubmit={handleSaveOwnerAndHeading} className="space-y-6">
        {/* Owner Profile + Photo */}
        <AdminFormSectionCard
          title="Profil & Foto Pemilik Usaha (Owner)"
          description="Foto dan kutipan pemilik tampil pada bagian profil pimpinan di halaman Tentang Kami."
        >
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
                    Unggah Foto Owner
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
                    Reset Default
                  </Button>
                </div>
              )}
            </div>

            <div className="lg:col-span-8 space-y-4">
              <Checkbox
                id="own-verified"
                label="Tampilkan Profil Pemilik ke Publik (Terverifikasi)"
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
                <FormField
                  id="own-portrait-path"
                  label="Path / URL Gambar Owner"
                  hint="Bisa berupa path (/owner.png), URL gambar, atau unggahan langsung di sebelah kiri."
                >
                  <Input
                    id="own-portrait-path"
                    disabled={!canEditBisnis}
                    value={ownerDraft.jalurFoto}
                    onChange={(e) =>
                      setOwnerDraft((p) => ({ ...p, jalurFoto: e.target.value }))
                    }
                  />
                </FormField>
                <FormField id="own-portrait-alt" label="Keterangan Foto Owner (Alt Text)">
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

              <FormField id="own-quote" label="Kutipan Pemilik">
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

              <FormField id="own-bio" label="Biografi Singkat Pemilik">
                <Textarea
                  id="own-bio"
                  rows={2}
                  disabled={!canEditTentang}
                  value={ownerBiography}
                  onChange={(e) => setOwnerBiography(e.target.value)}
                />
              </FormField>
            </div>
          </div>
        </AdminFormSectionCard>

        {/* Team Section Headings */}
        <AdminFormSectionCard
          title="Tajuk Seksi Tim Workshop"
          description="Judul pengantar untuk daftar anggota tim pada halaman Tentang Kami."
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField id="tim-eyebrow" label="Eyebrow Seksi Tim">
              <Input
                id="tim-eyebrow"
                disabled={!canEditTentang}
                value={teamEyebrow}
                onChange={(e) => setTeamEyebrow(e.target.value)}
              />
            </FormField>
            <FormField id="tim-title" label="Judul Seksi Tim">
              <Input
                id="tim-title"
                disabled={!canEditTentang}
                value={teamTitle}
                onChange={(e) => setTeamTitle(e.target.value)}
              />
            </FormField>
            <FormField id="tim-desc" label="Deskripsi Singkat">
              <Input
                id="tim-desc"
                disabled={!canEditTentang}
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
              />
            </FormField>
          </div>
        </AdminFormSectionCard>
      </form>

      {/* Team Members Directory */}
      <AdminFormSectionCard
        title={`Daftar Anggota Tim & Pengelola (${tentang.anggotaTim.length})`}
        description="Kelola profil dan foto tiap personel studio, perencana, serta tim produksi workshop."
      >
        {tentang.anggotaTim.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)]">
            Belum ada anggota tim yang terdaftar.
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
                    <Link
                      to={`/admin/tentang/tim/anggota/${member.id}/edit`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)]"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Edit &amp; Foto
                    </Link>
                    <button
                      type="button"
                      aria-label={`Hapus anggota ${member.nama}`}
                      onClick={() => handleDeleteMember(member)}
                      className="p-2 rounded-[var(--radius-sm)] border border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger)] cursor-pointer"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
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
