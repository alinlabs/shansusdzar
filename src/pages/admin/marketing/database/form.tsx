import { useMemo, useState, type FormEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { WilayahAddressFields } from '../../../../components/admin/wilayah-address-fields';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { resolveNextClientCode } from '../../../../lib/document-numbering';
import {
  formatDesaKotaLabel,
  formatKabupatenShort,
} from '../../../../lib/wilayah-indonesia';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useMarketingStore } from '../../../../store/marketing-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import {
  MARKETING_SEGMENTS,
  MARKETING_SOURCES,
  buildWhatsAppBroadcastUrl,
  createEmptyContactDraft,
  isValidEmailAddress,
  isValidWhatsAppDigits,
  normalizeContactFromDraft,
  normalizeWhatsAppDigits,
  toContactFormDraft,
  validateContactDraft,
  type MarketingContactFormDraft,
} from './logic';

const BACK_PATH = '/admin/marketing/database';

export default function AdminMarketingDatabaseFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const contacts = useMarketingStore((state) => state.contacts);
  const upsertContact = useMarketingStore((state) => state.upsertContact);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'profil-usaha');

  const isEditMode = Boolean(id);
  const existingContact = useMemo(
    () => (id ? contacts.find((c) => c.id === id) ?? null : null),
    [id, contacts]
  );

  const nextClientCode = useMemo(() => resolveNextClientCode(contacts), [contacts]);
  const [values, setValues] = useState<MarketingContactFormDraft>(() =>
    existingContact
      ? toContactFormDraft(existingContact)
      : createEmptyContactDraft(nextClientCode)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode ? 'Edit Kontak Marketing' : 'Tambah Kontak Marketing'} | Admin ${shortBrandName}`
  );

  const previewDigits = normalizeWhatsAppDigits(values.phone);
  const previewWaReady = values.allowWhatsApp && isValidWhatsAppDigits(previewDigits);
  const previewEmailReady = values.allowEmail && isValidEmailAddress(values.email);

  const sections = useMemo<AdminFormSectionConfig<MarketingContactFormDraft>[]>(
    () => [
      {
        id: 'identitas-kontak',
        title: 'Identitas',
        mobileTabLabel: 'Identitas',
        errorPrefixes: ['alamat.'],
        columns: 2,
        fields: [
          {
            name: 'clientCode',
            label: 'Kode Klien',
            type: 'text',
            placeholder: nextClientCode,
          },
          {
            name: 'name',
            label: 'Nama Lengkap / PIC',
            type: 'text',
            required: true,
            placeholder: 'Contoh: Bapak Rizky Pratama',
          },
          {
            name: 'companyName',
            label: 'Nama Instansi / Hunian / Studio',
            type: 'text',
            placeholder: 'Pribadi / PT / Cluster / Studio Arsitek',
          },
          {
            name: 'tagsText',
            label: 'Tag Minat (pisahkan dengan koma)',
            type: 'text',
            placeholder: 'kitchen-set, wardrobe, kantor',
          },
          {
            name: 'alamat',
            label: 'Alamat Klien (Wilayah Indonesia)',
            type: 'custom',
            colSpan: 'full',
            render: ({ readOnly, errors }) => (
              <WilayahAddressFields
                idPrefix="mkt-alamat"
                value={values.alamat}
                fallbackLocation={values.city}
                disabled={readOnly}
                errors={errors}
                showHints={false}
                onChange={(nextAlamat) => {
                  setValues((prev) => ({
                    ...prev,
                    alamat: nextAlamat,
                    city: formatKabupatenShort(nextAlamat.kabupaten?.name) || prev.city,
                  }));
                }}
              />
            ),
          },
        ],
      },
      {
        id: 'saluran-komunikasi',
        title: 'Kontak & Saluran',
        mobileTabLabel: 'Kontak',
        columns: 2,
        fields: [
          {
            name: 'phone',
            label: 'Nomor WhatsApp',
            type: 'tel',
            placeholder: '+62 812-3456-7890',
          },
          {
            name: 'email',
            label: 'Alamat Email',
            type: 'email',
            placeholder: 'nama@domain.co.id',
          },
          {
            name: 'allowWhatsApp',
            label: 'Aktifkan untuk Broadcast WhatsApp',
            type: 'checkbox',
          },
          {
            name: 'allowEmail',
            label: 'Aktifkan untuk Share Email',
            type: 'checkbox',
          },
        ],
      },
      {
        id: 'segmentasi-catatan',
        title: 'Segmentasi & Catatan',
        mobileTabLabel: 'Segmentasi',
        columns: 2,
        fields: [
          {
            name: 'segment',
            label: 'Segmen Kontak',
            type: 'select',
            required: true,
            options: MARKETING_SEGMENTS.map((seg) => ({ value: seg, label: seg })),
          },
          {
            name: 'source',
            label: 'Sumber Masuk Kontak',
            type: 'select',
            required: true,
            options: MARKETING_SOURCES.map((src) => ({ value: src, label: src })),
          },
          {
            name: 'notes',
            label: 'Catatan Kebutuhan / Riwayat Komunikasi',
            type: 'textarea',
            rows: 4,
            colSpan: 'full',
            placeholder:
              'Catat ukuran panjang × tinggi, minat bahan (Blockboard/Multipleks/PVC Board) & finishing (HPL/Cat Duco)...',
          },
        ],
      },
    ],
    [nextClientCode, values.alamat, values.city]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validateContactDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = normalizeContactFromDraft(values);
    upsertContact(payload);
    recordActivity(
      isEditMode ? 'Memperbarui kontak marketing' : 'Menambahkan kontak marketing baru',
      'Marketing Database',
      `${payload.nama} (${payload.segmen})`
    );

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: isEditMode
            ? `Kontak "${payload.nama}" berhasil diperbarui.`
            : `Kontak "${payload.nama}" berhasil disimpan ke database marketing.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={isEditMode ? 'Edit Kontak' : 'Tambah Kontak'}
      backTo={BACK_PATH}
      backLabel="Kembali ke Database Kontak"
      submitLabel="Simpan Kontak"
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      asideTabLabel="Ringkasan"
      notFoundState={
        isEditMode && !existingContact
          ? {
              title: 'Kontak Tidak Ditemukan',
              message: 'Data kontak marketing yang Anda cari tidak tersedia atau telah dihapus.',
            }
          : undefined
      }
      aside={
        <AdminFormSectionCard title="Ringkasan Kanal">
          <div className="space-y-3 text-xs">
            <div>
              {values.clientCode.trim() && (
                <p className="text-[11px] font-mono text-[var(--text-muted)]">
                  {values.clientCode.trim().toUpperCase()}
                </p>
              )}
              <p className="text-sm font-semibold text-[var(--text)]">
                {values.name.trim() || 'Nama Kontak'}
              </p>
              <p className="text-[var(--text-muted)]">
                {values.companyName.trim() || 'Pribadi'} ·{' '}
                {formatDesaKotaLabel(values.alamat, values.city) || 'Purwakarta'}
              </p>
            </div>

            <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-muted)]">WhatsApp</span>
                <span
                  className={
                    previewWaReady ? 'font-semibold text-[var(--success)]' : 'text-[var(--text-subtle)]'
                  }
                >
                  {previewWaReady ? `+${previewDigits}` : 'Belum siap'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-muted)]">Email</span>
                <span
                  className={
                    previewEmailReady
                      ? 'font-semibold text-[var(--success)] truncate max-w-[170px]'
                      : 'text-[var(--text-subtle)]'
                  }
                >
                  {previewEmailReady ? values.email.trim().toLowerCase() : 'Belum siap'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-muted)]">Segmen</span>
                <span className="font-medium text-[var(--text)]">{values.segment}</span>
              </div>
            </div>

            {previewWaReady && (
              <a
                href={buildWhatsAppBroadcastUrl(
                  { teleponTerstandar: previewDigits, telepon: values.phone },
                  `Halo Bapak/Ibu ${values.name.trim() || 'Klien'}, salam dari Shansusdzar Indonesia.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline"
              >
                Uji Tautan WhatsApp
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </AdminFormSectionCard>
      }
    />
  );
}
