import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AdminForm, type AdminFormSectionConfig } from '../../../../components/admin/admin-form';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { FaqItem } from '../../../../types/cms';
import { createEmptyFaq, normalizeFaqPayload, validateFaqDraft } from './logic';

const BACK_PATH = '/admin/informasi/faq';

export default function AdminFaqFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const faqs = useSiteContentStore((state) => state.faqs);
  const upsertFaq = useSiteContentStore((state) => state.upsertFaq);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'faq');

  const isEditMode = Boolean(id);
  const existingFaq = useMemo(
    () => (id ? faqs.find((f) => f.id === id) ?? null : null),
    [id, faqs]
  );

  const [values, setValues] = useState<FaqItem>(() =>
    existingFaq ? structuredClone(existingFaq) : createEmptyFaq(faqs.length + 1)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode ? 'Edit Pertanyaan FAQ' : 'Tambah Pertanyaan FAQ'} | Informasi Admin ${shortBrandName}`
  );

  const sections = useMemo<AdminFormSectionConfig<FaqItem>[]>(
    () => [
      {
        id: 'detail-faq',
        title: 'Detail FAQ',
        columns: 2,
        fields: [
          {
            name: 'kategori',
            label: 'Kategori',
            type: 'text',
            required: true,
          },
          {
            name: 'urutan',
            label: 'Urutan Tampil',
            type: 'number',
            min: 1,
          },
          {
            name: 'pertanyaan',
            label: 'Pertanyaan',
            type: 'text',
            required: true,
            colSpan: 'full',
          },
          {
            name: 'jawaban',
            label: 'Jawaban',
            type: 'textarea',
            rows: 5,
            required: true,
            colSpan: 'full',
          },
          {
            name: 'terbit',
            label: 'Terbitkan ke Halaman Informasi Publik',
            type: 'checkbox',
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

    const validation = validateFaqDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = normalizeFaqPayload(values);
    upsertFaq(payload);
    recordActivity('Menyimpan entri FAQ', 'Informasi', payload.pertanyaan.slice(0, 48));

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: 'Pertanyaan FAQ berhasil disimpan.',
        },
      },
    });
  };

  return (
    <AdminForm
      title={isEditMode ? 'Edit FAQ' : 'Tambah FAQ'}
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
        isEditMode && !existingFaq
          ? {
              title: 'FAQ Tidak Ditemukan',
              message: 'Data FAQ tidak tersedia atau sudah dihapus.',
            }
          : undefined
      }
    />
  );
}
