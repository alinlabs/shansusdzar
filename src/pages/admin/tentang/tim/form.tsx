import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { AdminActionButton } from '../../../../components/admin/admin-action-buttons';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { useCachedMediaSrc } from '../../../../lib/media-cache';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { TeamMemberData } from '../../../../types/cms';
import {
  createEmptyTeamMember,
  deriveMemberInitials,
  normalizeTeamMemberPayload,
  readResizedPortraitDataUrl,
  validateTeamMemberDraft,
} from './logic';

const BACK_PATH = '/admin/tentang/tim';

export default function AdminTimMemberFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const tentang = useSiteContentStore((state) => state.tentang);
  const updateTentang = useSiteContentStore((state) => state.updateTentang);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'tentang.edit');

  const isEditMode = Boolean(id);
  const existingMember = useMemo(
    () => (id ? tentang.anggotaTim.find((m) => m.id === id) ?? null : null),
    [id, tentang.anggotaTim]
  );

  const [values, setValues] = useState<TeamMemberData>(() =>
    existingMember ? structuredClone(existingMember) : createEmptyTeamMember()
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [previewFailedSrc, setPreviewFailedSrc] = useState<string | null>(null);

  useDocumentTitle(
    `${isEditMode ? 'Edit Anggota Tim' : 'Tambah Anggota Tim'} | Admin ${shortBrandName}`
  );

  const cachedAvatarSrc = useCachedMediaSrc(values.fotoProfil || null);
  const resolvedPreviewSrc = cachedAvatarSrc ?? (values.fotoProfil?.trim() || null);
  const showPreviewImg = Boolean(resolvedPreviewSrc) && previewFailedSrc !== resolvedPreviewSrc;

  const handleUploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !canEdit) return;
    try {
      const dataUrl = await readResizedPortraitDataUrl(file, 520);
      setValues((prev) => ({
        ...prev,
        fotoProfil: dataUrl,
        teksAltFoto: prev.teksAltFoto || (prev.nama ? `Foto ${prev.nama}` : 'Foto anggota tim'),
      }));
    } catch {
      setFormError('Gagal membaca file foto yang dipilih.');
    }
    event.target.value = '';
  };

  const sections = useMemo<AdminFormSectionConfig<TeamMemberData>[]>(
    () => [
      {
        id: 'identitas-anggota',
        title: 'Identitas',
        columns: 2,
        fields: [
          {
            name: 'nama',
            label: 'Nama Lengkap',
            type: 'text',
            required: true,
            placeholder: 'Contoh: Fajar Maulana',
            onValueChange: (nextVal, prev) => {
              const str = String(nextVal ?? '');
              if (!prev.inisial || prev.inisial === deriveMemberInitials(prev.nama)) {
                return { inisial: deriveMemberInitials(str) };
              }
            },
          },
          {
            name: 'inisial',
            label: 'Inisial',
            type: 'text',
            maxLength: 3,
            placeholder: 'FM',
          },
          {
            name: 'jabatan',
            label: 'Jabatan',
            type: 'text',
            required: true,
            placeholder: 'Contoh: Kepala Produksi',
          },
        ],
      },
      {
        id: 'foto-anggota',
        title: 'Foto Profil',
        columns: 2,
        fields: [
          {
            name: 'fotoProfil',
            label: 'Path / URL Foto Tim',
            type: 'text',
            placeholder: '/owner.png atau https://...',
          },
          {
            name: 'teksAltFoto',
            label: 'Keterangan Foto (Alt Text)',
            type: 'text',
            placeholder: 'Foto profil anggota tim workshop',
          },
          {
            name: 'id',
            label: 'Unggah Foto dari Perangkat',
            type: 'custom',
            colSpan: 'full',
            render: ({ readOnly }) => (
              <div className="flex flex-wrap items-center gap-2">
                {!readOnly && (
                  <label className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer">
                    <ImagePlus className="size-3.5" aria-hidden="true" />
                    Pilih File Foto
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadPhoto}
                      className="sr-only"
                    />
                  </label>
                )}
                {!readOnly && values.fotoProfil && (
                  <AdminActionButton
                    variant="danger"
                    icon={<Trash2 className="size-3.5" />}
                    label="Hapus Foto"
                    onClick={() =>
                      setValues((prev) => ({
                        ...prev,
                        fotoProfil: '',
                        teksAltFoto: '',
                      }))
                    }
                  />
                )}
              </div>
            ),
          },
        ],
      },
    ],
    [values.fotoProfil]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validateTeamMemberDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = normalizeTeamMemberPayload(values);
    const exists = tentang.anggotaTim.some((item) => item.id === payload.id);
    const nextMembers = exists
      ? tentang.anggotaTim.map((item) => (item.id === payload.id ? payload : item))
      : [...tentang.anggotaTim, payload];

    updateTentang({
      ...tentang,
      anggotaTim: nextMembers,
    });

    recordActivity(
      isEditMode ? 'Memperbarui profil & foto anggota tim' : 'Menambahkan anggota tim baru',
      'Tim & Pemilik',
      payload.nama
    );

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: isEditMode
            ? `Data tim "${payload.nama}" berhasil diperbarui.`
            : `Anggota tim "${payload.nama}" berhasil ditambahkan.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={isEditMode ? 'Edit Anggota' : 'Tambah Anggota'}
      backTo={BACK_PATH}
      backLabel="Kembali"
      submitLabel="Simpan"
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      notFoundState={
        isEditMode && !existingMember
          ? {
              title: 'Anggota Tidak Ditemukan',
              message: 'Data anggota tidak tersedia atau sudah dihapus.',
            }
          : undefined
      }
      aside={
        <AdminFormSectionCard title="Pratinjau Kartu">
          <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-3">
            <div className="flex items-center gap-3">
              {showPreviewImg && resolvedPreviewSrc ? (
                <div className="size-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] overflow-hidden shrink-0">
                  <img
                    src={resolvedPreviewSrc}
                    alt={values.teksAltFoto || values.nama}
                    onError={() => setPreviewFailedSrc(resolvedPreviewSrc)}
                    className="size-full object-cover object-top"
                  />
                </div>
              ) : (
                <div className="size-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-sm font-semibold text-[var(--text)] shrink-0">
                  {values.inisial.trim() || deriveMemberInitials(values.nama)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text)] truncate">
                  {values.nama.trim() || 'Nama Anggota Tim'}
                </p>
                <p className="text-xs text-[var(--text-muted)] truncate">
                  {values.jabatan.trim() || 'Jabatan'}
                </p>
              </div>
            </div>
          </div>
        </AdminFormSectionCard>
      }
    />
  );
}
