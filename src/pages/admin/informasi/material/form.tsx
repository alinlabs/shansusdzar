import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { ImageFallback } from '../../../../components/ui/image-fallback';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import {
  createEmptyMaterialDraft,
  normalizeMaterialFromDraft,
  toMaterialFormDraft,
  validateMaterialDraft,
  type MaterialFormDraft,
} from './logic';

const BACK_PATH = '/admin/informasi/material';

export default function AdminMaterialFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const materials = useSiteContentStore((state) => state.materials);
  const upsertMaterial = useSiteContentStore((state) => state.upsertMaterial);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'informasi.edit');

  const isEditMode = Boolean(id);
  const existingMaterial = useMemo(
    () => (id ? materials.find((m) => m.id === id) ?? null : null),
    [id, materials]
  );

  const [values, setValues] = useState<MaterialFormDraft>(() =>
    existingMaterial ? toMaterialFormDraft(existingMaterial) : createEmptyMaterialDraft()
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode ? 'Edit Material' : 'Tambah Material'} | Admin ${shortBrandName}`
  );

  const sections = useMemo<AdminFormSectionConfig<MaterialFormDraft>[]>(
    () => [
      {
        id: 'spesifikasi-material',
        title: 'Spesifikasi Material',
        columns: 2,
        fields: [
          {
            name: 'nama',
            label: 'Nama Material',
            type: 'text',
            required: true,
          },
          {
            name: 'kategori',
            label: 'Kategori',
            type: 'select',
            options: [
              { value: 'papan', label: 'Material Utama' },
              { value: 'finishing', label: 'Finishing/Laminasi' },
            ],
          },
          {
            name: 'bestForText',
            label: 'Rekomendasi Ruang (pisahkan koma)',
            type: 'text',
          },
          {
            name: 'gambarReferensi',
            label: 'Path / URL Gambar Referensi',
            type: 'text',
            placeholder: '/sample-produk/gambar/...',
          },
          {
            name: 'ketahananLembap',
            label: 'Tahan Lembap (0–100)',
            type: 'number',
            min: 0,
            max: 100,
          },
          {
            name: 'peringkatKeawetan',
            label: 'Kekuatan Struktur (0–100)',
            type: 'number',
            min: 0,
            max: 100,
          },
          {
            name: 'keterjangkauan',
            label: 'Keterjangkauan (0–100)',
            type: 'number',
            min: 0,
            max: 100,
          },
          {
            name: 'ringkasan',
            label: 'Ringkasan',
            type: 'textarea',
            rows: 3,
            colSpan: 'full',
          },
          {
            name: 'terbuatDari',
            label: 'Komposisi / Terbuat Dari',
            type: 'textarea',
            rows: 3,
            colSpan: 'full',
          },
          {
            name: 'kelebihanText',
            label: 'Kelebihan Utama (1 per baris)',
            type: 'textarea',
            rows: 4,
            colSpan: 'full',
          },
          {
            name: 'tipsPerawatan',
            label: 'Tips Perawatan',
            type: 'textarea',
            rows: 3,
            colSpan: 'full',
          },
        ],
      },
    ],
    []
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validateMaterialDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = normalizeMaterialFromDraft(values);
    upsertMaterial(payload);
    recordActivity('Menyimpan spesifikasi material', 'Material', payload.nama);

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: `Material "${payload.nama}" berhasil disimpan.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={isEditMode ? 'Edit Material' : 'Tambah Material'}
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
        isEditMode && !existingMaterial
          ? {
              title: 'Material Tidak Ditemukan',
              message: 'Data material tidak tersedia atau sudah dihapus.',
            }
          : undefined
      }
      aside={
        <AdminFormSectionCard title="Pratinjau Gambar">
          <div className="rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)] bg-[var(--surface-muted)]">
            <ImageFallback
              src={values.gambarReferensi || undefined}
              alt={values.nama || 'Pratinjau Material'}
              aspectRatio="4/3"
              fallbackLabel={values.nama || 'Material'}
              className="rounded-none border-0"
            />
          </div>
        </AdminFormSectionCard>
      }
    />
  );
}
