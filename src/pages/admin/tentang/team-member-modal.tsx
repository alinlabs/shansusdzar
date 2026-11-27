import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { ImagePlus, Save, Trash2 } from 'lucide-react';
import { AdminActionButton } from '../../../components/admin/admin-action-buttons';
import { Button } from '../../../components/ui/button';
import { FormField, FormFieldStyleProvider, Input } from '../../../components/ui/form-controls';
import { Modal } from '../../../components/ui/modal';
import { useCachedMediaSrc } from '../../../lib/media-cache';
import type { TeamMemberData } from '../../../types/cms';
import {
  createEmptyTeamMember,
  deriveMemberInitials,
  normalizeTeamMemberPayload,
  readResizedPortraitDataUrl,
  validateTeamMemberDraft,
} from './logic';

interface TeamMemberModalProps {
  isOpen: boolean;
  editingMember: TeamMemberData | null;
  onClose: () => void;
  onSaveMember: (member: TeamMemberData, isEdit: boolean) => void;
}

export function TeamMemberModal({
  isOpen,
  editingMember,
  onClose,
  onSaveMember,
}: TeamMemberModalProps) {
  const isEditMode = Boolean(editingMember);
  const [values, setValues] = useState<TeamMemberData>(() =>
    editingMember ? structuredClone(editingMember) : createEmptyTeamMember()
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [previewFailedSrc, setPreviewFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValues(editingMember ? structuredClone(editingMember) : createEmptyTeamMember());
    setFormError(null);
    setFieldErrors({});
    setPreviewFailedSrc(null);
  }, [isOpen, editingMember]);

  const cachedAvatarSrc = useCachedMediaSrc(values.fotoProfil || null);
  const resolvedPreviewSrc = cachedAvatarSrc ?? (values.fotoProfil?.trim() || null);
  const showPreviewImg = Boolean(resolvedPreviewSrc) && previewFailedSrc !== resolvedPreviewSrc;

  const handleUploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readResizedPortraitDataUrl(file, 520);
      setValues((prev) => ({
        ...prev,
        fotoProfil: dataUrl,
        teksAltFoto: prev.teksAltFoto || (prev.nama ? `Foto ${prev.nama}` : 'Foto anggota tim'),
      }));
      setFormError(null);
    } catch {
      setFormError('Gagal membaca file foto yang dipilih.');
    }
    event.target.value = '';
  };

  const handleNameChange = (nextName: string) => {
    setValues((prev) => {
      const shouldSyncInitials = !prev.inisial || prev.inisial === deriveMemberInitials(prev.nama);
      return {
        ...prev,
        nama: nextName,
        inisial: shouldSyncInitials ? deriveMemberInitials(nextName) : prev.inisial,
      };
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const validation = validateTeamMemberDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = normalizeTeamMemberPayload(values);
    onSaveMember(payload, isEditMode);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit Anggota Tim' : 'Tambah Anggota Tim'}
      description="Atur identitas, jabatan, dan foto profil anggota workshop."
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="team-member-modal-form" variant="primary" size="sm">
            <Save className="size-3.5" aria-hidden="true" />
            <span>Simpan Anggota</span>
          </Button>
        </div>
      }
    >
      <FormFieldStyleProvider labelTone="thin" hideHints>
        <div className="[&_input]:font-medium [&_textarea]:font-medium">
          <form
            id="team-member-modal-form"
            onSubmit={handleSubmit}
            noValidate
            className="space-y-4"
          >
        {formError && (
          <div
            role="alert"
            className="p-3 rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-surface)] text-xs font-medium text-[var(--danger)]"
          >
            {formError}
          </div>
        )}

        <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)]/60 flex items-center gap-3">
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="sm:col-span-2">
            <FormField
              id="team-member-name"
              label="Nama Lengkap"
              required
              error={fieldErrors.nama}
            >
              <Input
                id="team-member-name"
                hasError={Boolean(fieldErrors.nama)}
                placeholder="Contoh: Fajar Maulana"
                value={values.nama}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </FormField>
          </div>

          <FormField id="team-member-initials" label="Inisial">
            <Input
              id="team-member-initials"
              maxLength={3}
              placeholder="FM"
              value={values.inisial}
              onChange={(e) => setValues((p) => ({ ...p, inisial: e.target.value }))}
            />
          </FormField>
        </div>

        <FormField
          id="team-member-role"
          label="Jabatan"
          required
          error={fieldErrors.jabatan}
        >
          <Input
            id="team-member-role"
            hasError={Boolean(fieldErrors.jabatan)}
            placeholder="Contoh: Kepala Produksi"
            value={values.jabatan}
            onChange={(e) => setValues((p) => ({ ...p, jabatan: e.target.value }))}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-[var(--border)]">
          <FormField id="team-member-photo" label="Path / URL Foto Tim">
            <Input
              id="team-member-photo"
              placeholder="/owner.png atau https://..."
              value={values.fotoProfil ?? ''}
              onChange={(e) => setValues((p) => ({ ...p, fotoProfil: e.target.value }))}
            />
          </FormField>

          <FormField id="team-member-alt" label="Keterangan Foto (Alt Text)">
            <Input
              id="team-member-alt"
              placeholder="Foto profil anggota tim"
              value={values.teksAltFoto ?? ''}
              onChange={(e) => setValues((p) => ({ ...p, teksAltFoto: e.target.value }))}
            />
          </FormField>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer">
            <ImagePlus className="size-3.5" aria-hidden="true" />
            <span>Pilih File Foto</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleUploadPhoto}
              className="sr-only"
            />
          </label>
          {values.fotoProfil && (
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
          </form>
        </div>
      </FormFieldStyleProvider>
    </Modal>
  );
}
