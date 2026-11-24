import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AdminForm, type AdminFormSectionConfig } from '../../../../components/admin/admin-form';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { ServicePolicyItem } from '../../../../types/cms';
import { createEmptyPolicy, normalizePolicyPayload, validatePolicyDraft } from './logic';

const BACK_PATH = '/admin/tentang/operasional';

export default function AdminKebijakanFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const policies = useSiteContentStore((state) => state.policies);
  const upsertPolicy = useSiteContentStore((state) => state.upsertPolicy);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit =
    hasPermission(currentRole, 'tentang.edit') || hasPermission(currentRole, 'informasi.edit');

  const isEditMode = Boolean(id);
  const existingPolicy = useMemo(
    () => (id ? policies.find((p) => p.id === id) ?? null : null),
    [id, policies]
  );

  const [values, setValues] = useState<ServicePolicyItem>(() =>
    existingPolicy ? structuredClone(existingPolicy) : createEmptyPolicy()
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode ? 'Edit Kebijakan Layanan' : 'Tambah Kebijakan Layanan'} | Tentang & Situs Admin ${shortBrandName}`
  );

  const sections = useMemo<AdminFormSectionConfig<ServicePolicyItem>[]>(
    () => [
      {
        id: 'kebijakan-layanan',
        title: 'Detail Kebijakan Layanan Workshop',
        columns: 1,
        fields: [
          {
            name: 'judul',
            label: 'Judul Kebijakan',
            type: 'text',
            required: true,
            placeholder: 'Contoh: Garansi Engsel & Rel 1 Tahun',
          },
          {
            name: 'ringkasan',
            label: 'Ringkasan Singkat',
            type: 'textarea',
            rows: 2,
          },
          {
            name: 'rincian',
            label: 'Penjelasan Detail & Ketentuan',
            type: 'textarea',
            rows: 5,
          },
        ],
      },
    ],
    []
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validatePolicyDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = normalizePolicyPayload(values);
    upsertPolicy(payload);
    recordActivity('Menyimpan kebijakan layanan', 'Tentang & Operasional', payload.judul);

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: `Kebijakan "${payload.judul}" berhasil disimpan.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={isEditMode ? `Edit Kebijakan: ${values.judul || id}` : 'Tambah Kebijakan Layanan'}
      description="Formulir pengelolaan standar kebijakan layanan, garansi, atau prosedur survei workshop."
      backTo={BACK_PATH}
      backLabel="Kembali ke Operasional"
      submitLabel="Simpan Kebijakan"
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      notFoundState={
        isEditMode && !existingPolicy
          ? {
              title: 'Kebijakan Layanan Tidak Ditemukan',
              message: 'Data kebijakan yang Anda cari tidak tersedia atau telah dihapus.',
            }
          : undefined
      }
    />
  );
}
