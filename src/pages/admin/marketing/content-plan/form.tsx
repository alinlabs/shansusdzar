import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { SocialMediaPlanItem } from '../../../../types/cms';
import {
  SOCIAL_FORMATS,
  SOCIAL_PILLARS,
  SOCIAL_PLATFORMS,
  SOCIAL_STATUSES,
  createEmptySocialPlan,
  normalizeSocialPlanPayload,
  validateSocialPlanDraft,
} from './logic';

const BACK_PATH = '/admin/marketing/content-plan';

export default function AdminSosmedFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const socialPlans = useSiteContentStore((state) => state.socialPlans) ?? [];
  const upsertSocialPlan = useSiteContentStore((state) => state.upsertSocialPlan);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'profil-usaha');

  const isEditMode = Boolean(id);
  const existingPlan = useMemo(
    () => (id ? socialPlans.find((p) => p.id === id) ?? null : null),
    [id, socialPlans]
  );

  const [values, setValues] = useState<SocialMediaPlanItem>(() =>
    existingPlan ? structuredClone(existingPlan) : createEmptySocialPlan()
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode ? 'Edit Content Plan Sosmed' : 'Tambah Content Plan Sosmed'} | Marketing Admin ${shortBrandName}`
  );

  const sections = useMemo<AdminFormSectionConfig<SocialMediaPlanItem>[]>(
    () => [
      {
        id: 'konsep-jadwal',
        title: 'Konsep & Jadwal',
        mobileTabLabel: 'Konsep',
        columns: 3,
        fields: [
          {
            name: 'judul',
            label: 'Judul Kampanye / Topik Konten',
            type: 'text',
            required: true,
            colSpan: 'full',
            placeholder: 'Contoh: Showcase Kitchen Set HPL Purwakarta',
          },
          {
            name: 'platform',
            label: 'Platform',
            type: 'select',
            required: true,
            options: SOCIAL_PLATFORMS.map((p) => ({ value: p, label: p })),
          },
          {
            name: 'format',
            label: 'Format Konten',
            type: 'select',
            required: true,
            options: SOCIAL_FORMATS.map((f) => ({ value: f, label: f })),
          },
          {
            name: 'pilar',
            label: 'Pilar Konten',
            type: 'select',
            required: true,
            options: SOCIAL_PILLARS.map((pl) => ({ value: pl, label: pl })),
          },
          {
            name: 'tanggalTerjadwal',
            label: 'Tanggal Tayang',
            type: 'date',
            required: true,
          },
          {
            name: 'jamTerjadwal',
            label: 'Jam Tayang',
            type: 'time',
          },
          {
            name: 'status',
            label: 'Status Workflow',
            type: 'select',
            options: SOCIAL_STATUSES.map((st) => ({ value: st, label: st })),
          },
        ],
      },
      {
        id: 'naskah-caption',
        title: 'Hook & Caption',
        mobileTabLabel: 'Caption',
        columns: 3,
        fields: [
          {
            name: 'kalimatPembuka',
            label: 'Hook Pembuka (3 Detik Pertama / Judul Slide 1)',
            type: 'text',
            colSpan: 'full',
            placeholder: 'Kalimat pemikat perhatian audiens...',
          },
          {
            name: 'takaranKonten',
            label: 'Naskah Caption',
            type: 'textarea',
            rows: 5,
            colSpan: 'full',
          },
          {
            name: 'tagar',
            label: 'Hashtags',
            type: 'text',
          },
          {
            name: 'targetAksi',
            label: 'Tautan CTA',
            type: 'text',
            placeholder: '/produk/custom',
          },
          {
            name: 'namaPenanggungJawab',
            label: 'Penanggung Jawab (PIC)',
            type: 'text',
          },
          {
            name: 'catatan',
            label: 'Catatan Arahan Produksi / Shot List',
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

    const validation = validateSocialPlanDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = normalizeSocialPlanPayload(values);
    upsertSocialPlan(payload);
    recordActivity(
      isEditMode
        ? 'Memperbarui jadwal konten sosial media'
        : 'Menambahkan jadwal konten sosial media',
      'Sosmed Planning',
      `${payload.platform}: ${payload.judul}`
    );

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: isEditMode
            ? `Rencana konten "${payload.judul}" berhasil diperbarui.`
            : `Rencana konten "${payload.judul}" ditambahkan ke kalender editorial.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={isEditMode ? 'Edit Konten' : 'Tambah Konten'}
      backTo={BACK_PATH}
      backLabel="Kembali ke Content Plan"
      submitLabel="Simpan Content Plan"
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      asideTabLabel="Pratinjau"
      notFoundState={
        isEditMode && !existingPlan
          ? {
              title: 'Rencana Konten Tidak Ditemukan',
              message: 'Data rencana konten yang Anda cari tidak tersedia atau telah dihapus.',
            }
          : undefined
      }
      aside={
        <AdminFormSectionCard title="Pratinjau">
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text)]">{values.platform}</span>
              <span>·</span>
              <span>{values.format}</span>
              <span>·</span>
              <span className="tabular-nums">
                {values.tanggalTerjadwal} {values.jamTerjadwal}
              </span>
            </div>
            <p className="text-sm font-semibold text-[var(--text)]">
              {values.judul.trim() || 'Judul Kampanye Konten'}
            </p>
            <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-2">
              <p className="font-medium text-[var(--text)]">
                Hook: <span className="font-normal text-[var(--text-muted)]">{values.kalimatPembuka || '-'}</span>
              </p>
              <p className="text-[var(--text-muted)] whitespace-pre-line">
                {values.takaranKonten || 'Naskah caption akan tampil di sini.'}
              </p>
              {values.tagar && (
                <p className="text-[11px] text-[var(--text-subtle)]">{values.tagar}</p>
              )}
            </div>
            <p className="text-[var(--text-muted)]">
              PIC: <strong className="text-[var(--text)]">{values.namaPenanggungJawab || '-'}</strong> · Status:{' '}
              <strong className="text-[var(--text)]">{values.status}</strong>
            </p>
          </div>
        </AdminFormSectionCard>
      }
    />
  );
}
