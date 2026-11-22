import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { Checkbox } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useMarketingStore } from '../../../../store/marketing-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import {
  EMAIL_TEMPLATES,
  MARKETING_SEGMENTS,
  WHATSAPP_TEMPLATES,
  interpolateMarketingTemplate,
} from '../database/logic';
import {
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_STATUSES,
  createEmptyCampaignDraft,
  normalizeCampaignFromDraft,
  resolveCampaignRecipients,
  toCampaignFormDraft,
  validateCampaignDraft,
  type CampaignFormDraft,
} from './logic';

const BACK_PATH = '/admin/marketing/campaign';

export default function AdminMarketingCampaignFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const contacts = useMarketingStore((state) => state.contacts);
  const campaignItems = useMarketingStore((state) => state.campaignItems);
  const upsertCampaignItem = useMarketingStore((state) => state.upsertCampaignItem);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'marketing.edit');

  const isEditMode = Boolean(id);
  const existingCampaign = useMemo(
    () => (id ? campaignItems.find((item) => item.id === id) ?? null : null),
    [id, campaignItems]
  );

  const [values, setValues] = useState<CampaignFormDraft>(() =>
    existingCampaign
      ? toCampaignFormDraft(existingCampaign)
      : createEmptyCampaignDraft(currentUser?.email || 'admin@shansusdzar.id')
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode ? 'Edit Campaign Marketing' : 'Buat Campaign Baru'} | Admin ${shortBrandName}`
  );

  const normalizedPreview = useMemo(() => normalizeCampaignFromDraft(values), [values]);
  const waTargetsCount = useMemo(
    () =>
      values.enableWhatsApp
        ? resolveCampaignRecipients(normalizedPreview, contacts, 'whatsapp').length
        : 0,
    [values.enableWhatsApp, normalizedPreview, contacts]
  );
  const emailTargetsCount = useMemo(
    () =>
      values.enableEmail
        ? resolveCampaignRecipients(normalizedPreview, contacts, 'email').length
        : 0,
    [values.enableEmail, normalizedPreview, contacts]
  );

  const sampleContact = useMemo(() => {
    const firstMatched =
      resolveCampaignRecipients(normalizedPreview, contacts, 'whatsapp')[0] ??
      resolveCampaignRecipients(normalizedPreview, contacts, 'email')[0] ??
      contacts[0];
    return firstMatched ?? null;
  }, [normalizedPreview, contacts]);

  const sections = useMemo<AdminFormSectionConfig<CampaignFormDraft>[]>(
    () => [
      {
        id: 'identitas-campaign',
        title: 'Identitas Campaign & Target Audiens',
        columns: 2,
        fields: [
          {
            name: 'title',
            label: 'Judul Campaign',
            type: 'text',
            required: true,
            colSpan: 'full',
            placeholder: 'Contoh: Penawaran Survei Pengukuran & Katalog Akhir Tahun',
          },
          {
            name: 'objective',
            label: 'Tujuan Campaign',
            type: 'select',
            options: CAMPAIGN_OBJECTIVES.map((obj) => ({ value: obj, label: obj })),
          },
          {
            name: 'status',
            label: 'Status Campaign',
            type: 'select',
            options: CAMPAIGN_STATUSES.map((st) => ({ value: st, label: st })),
          },
          {
            name: 'targetSegments',
            label: 'Segmen Target Database (kosongkan = semua segmen)',
            type: 'custom',
            colSpan: 'full',
            render: ({ values: formValues, setFieldValue, readOnly }) => {
              const activeSegments = Array.isArray(formValues.targetSegments)
                ? formValues.targetSegments
                : [];
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                  {MARKETING_SEGMENTS.map((seg) => {
                    const checked = activeSegments.includes(seg);
                    return (
                      <div
                        key={seg}
                        className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)]"
                      >
                        <Checkbox
                          label={seg}
                          disabled={readOnly}
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...activeSegments, seg]
                              : activeSegments.filter((s) => s !== seg);
                            setFieldValue('targetSegments', next);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            },
          },
          {
            name: 'enableWhatsApp',
            label: 'Aktifkan Tools Broadcast WhatsApp',
            type: 'checkbox',
            checkboxDescription: 'Sertakan naskah dan antrean kirim WhatsApp satu per satu.',
          },
          {
            name: 'enableEmail',
            label: 'Aktifkan Tools Share Email',
            type: 'checkbox',
            checkboxDescription: 'Sertakan pengiriman email personal maupun massal BCC / .EML.',
          },
        ],
      },
      {
        id: 'materi-whatsapp',
        title: 'Naskah Broadcast WhatsApp',
        description: 'Gunakan variabel {nama}, {kota}, {segmen}, atau {perusahaan} agar pesan terasa personal.',
        columns: 2,
        fields: [
          {
            name: 'whatsappTemplateId',
            label: 'Isi Cepat dari Template WA',
            type: 'select',
            colSpan: 'full',
            options: [
              { value: 'custom', label: 'Edit Manual' },
              ...WHATSAPP_TEMPLATES.map((tpl) => ({ value: tpl.id, label: tpl.nama })),
            ],
            onValueChange: (nextVal) => {
              const tpl = WHATSAPP_TEMPLATES.find((t) => t.id === String(nextVal));
              if (tpl) return { whatsappMessage: tpl.isi };
            },
          },
          {
            name: 'whatsappMessage',
            label: 'Isi Pesan WhatsApp',
            type: 'textarea',
            rows: 7,
            colSpan: 'full',
          },
        ],
      },
      {
        id: 'materi-email',
        title: 'Naskah Share & Kampanye Email',
        columns: 2,
        fields: [
          {
            name: 'emailTemplateId',
            label: 'Isi Cepat dari Template Email',
            type: 'select',
            options: [
              { value: 'custom', label: 'Edit Manual' },
              ...EMAIL_TEMPLATES.map((tpl) => ({ value: tpl.id, label: tpl.nama })),
            ],
            onValueChange: (nextVal) => {
              const tpl = EMAIL_TEMPLATES.find((t) => t.id === String(nextVal));
              if (tpl) {
                return {
                  emailSubject: tpl.subjek ?? tpl.nama,
                  emailBody: tpl.isi,
                };
              }
            },
          },
          {
            name: 'replyToEmail',
            label: 'Email Pengirim / Tujuan BCC',
            type: 'email',
            placeholder: 'admin@shansusdzar.id',
          },
          {
            name: 'emailSubject',
            label: 'Subjek Email',
            type: 'text',
            colSpan: 'full',
          },
          {
            name: 'emailBody',
            label: 'Isi Naskah Email',
            type: 'textarea',
            rows: 7,
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

    const validation = validateCampaignDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = normalizeCampaignFromDraft(values);
    upsertCampaignItem(payload);
    recordActivity(
      isEditMode ? 'Memperbarui campaign marketing' : 'Membuat campaign marketing baru',
      'Marketing Campaign',
      payload.judul
    );

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: isEditMode
            ? `Campaign "${payload.judul}" berhasil diperbarui.`
            : `Campaign baru "${payload.judul}" berhasil dibuat.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={
        isEditMode
          ? `Edit Campaign: ${values.title || id}`
          : 'Buat Campaign Marketing Baru'
      }
      description="Atur target segmen database, saluran pengiriman (WhatsApp & Email), serta template pesan terpersonalisasi."
      backTo={BACK_PATH}
      backLabel="Kembali ke Daftar Campaign"
      submitLabel="Simpan Campaign"
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      notFoundState={
        isEditMode && !existingCampaign
          ? {
              title: 'Campaign Tidak Ditemukan',
              message: 'Data campaign yang Anda cari tidak tersedia atau telah dihapus.',
            }
          : undefined
      }
      aside={
        <AdminFormSectionCard
          title="Estimasi Jangkauan & Pratinjau"
          description="Perkiraan kontak dari Database yang memenuhi syarat saluran terpilih."
        >
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-1.5 tabular-nums">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-muted)]">Target WhatsApp</span>
                <span className="font-semibold text-[var(--text)]">{waTargetsCount} kontak</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-muted)]">Target Email</span>
                <span className="font-semibold text-[var(--text)]">{emailTargetsCount} kontak</span>
              </div>
            </div>

            {sampleContact && values.enableWhatsApp && values.whatsappMessage && (
              <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-1">
                <p className="font-semibold text-[var(--text)]">
                  Contoh WA ({sampleContact.nama}):
                </p>
                <p className="text-[var(--text-muted)] whitespace-pre-line line-clamp-5">
                  {interpolateMarketingTemplate(values.whatsappMessage, sampleContact)}
                </p>
              </div>
            )}

            {sampleContact && values.enableEmail && values.emailSubject && (
              <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-1">
                <p className="font-semibold text-[var(--text)]">
                  Contoh Subjek Email:
                </p>
                <p className="text-[var(--text-muted)]">
                  {interpolateMarketingTemplate(values.emailSubject, sampleContact)}
                </p>
              </div>
            )}
          </div>
        </AdminFormSectionCard>
      }
    />
  );
}
