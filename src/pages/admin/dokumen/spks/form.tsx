import { useMemo, useState, type FormEvent } from 'react';
import { Eye, FileDown, Plus, RefreshCw } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { Input, Textarea } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatRupiahSigned } from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  calculatePaymentSchemeBreakdown,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import { downloadAgreementPdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { CooperationAgreementDocument } from '../../../../types/documents';
import {
  AGREEMENT_STATUSES,
  AGREEMENT_TYPES,
  applyPaymentSchemeToAgreement,
  computeTerminTotalPercent,
  createEmptyAgreement,
  createEmptyAgreementClause,
  normalizeAgreementPayload,
  validateAgreementDraft,
} from './logic';

const BACK_PATH = '/admin/dokumen/spks';

export default function AdminSpksFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const agreements = useDocumentsStore((state) => state.agreements);
  const upsertAgreement = useDocumentsStore((state) => state.upsertAgreement);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'keuangan.edit');

  const isEditMode = Boolean(id);
  const existingDoc = useMemo(
    () => (id ? agreements.find((doc) => doc.id === id) ?? null : null),
    [id, agreements]
  );

  const [values, setValues] = useState<CooperationAgreementDocument>(() =>
    existingDoc
      ? structuredClone(existingDoc)
      : createEmptyAgreement(agreements.length + 9, businessConfig, paymentScheme)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode && existingDoc ? `Ubah ${existingDoc.nomorKontrak}` : 'Buat SPKS Baru'} | Dokumen Admin ${businessConfig.namaMerekSingkat}`
  );

  const effectiveScheme = useMemo(
    () =>
      resolveEffectivePaymentScheme(
        values.tahapanPembayaran,
        paymentScheme,
        values.catatanPembayaran
      ),
    [values.tahapanPembayaran, values.catatanPembayaran, paymentScheme]
  );

  const paymentBreakdown = useMemo(
    () => calculatePaymentSchemeBreakdown(values.nilaiKontrak || 0, effectiveScheme),
    [values.nilaiKontrak, effectiveScheme]
  );

  const terminTotal = computeTerminTotalPercent(values);

  const sections = useMemo<AdminFormSectionConfig<CooperationAgreementDocument>[]>(
    () => [
      {
        id: 'identitas-kontrak',
        title: 'Identitas & Status Kontrak',
        columns: 3,
        fields: [
          {
            name: 'nomorKontrak',
            label: 'Nomor Kontrak',
            type: 'text',
            required: true,
          },
          {
            name: 'jenisPerjanjian',
            label: 'Jenis Perjanjian',
            type: 'select',
            options: AGREEMENT_TYPES.map((t) => ({ value: t, label: t })),
          },
          {
            name: 'status',
            label: 'Status Kontrak',
            type: 'select',
            options: AGREEMENT_STATUSES.map((st) => ({ value: st, label: st })),
          },
          {
            name: 'kotaPenandatanganan',
            label: 'Kota Penandatanganan',
            type: 'text',
          },
          {
            name: 'tanggalPenandatanganan',
            label: 'Tanggal Kontrak',
            type: 'date',
            required: true,
          },
        ],
      },
      {
        id: 'pihak-pertama',
        title: 'PIHAK PERTAMA (Penyedia / Workshop)',
        columns: 3,
        fields: [
          {
            name: 'perusahaanPihakPertama',
            label: 'Nama Perusahaan / Studio',
            type: 'text',
          },
          {
            name: 'perwakilanPihakPertama',
            label: 'Perwakilan',
            type: 'text',
          },
          {
            name: 'jabatanPihakPertama',
            label: 'Jabatan',
            type: 'text',
          },
          {
            name: 'alamatPihakPertama',
            label: 'Alamat Workshop',
            type: 'textarea',
            rows: 2,
            colSpan: 'full',
          },
        ],
      },
      {
        id: 'pihak-kedua',
        title: 'PIHAK KEDUA (Klien / Mitra Kerja Sama)',
        columns: 2,
        fields: [
          {
            name: 'namaPihakKedua',
            label: 'Nama Lengkap / Mitra',
            type: 'text',
            required: true,
          },
          {
            name: 'nomorIdentitasPihakKedua',
            label: 'NIK / NPWP',
            type: 'text',
          },
          {
            name: 'jabatanPihakKedua',
            label: 'Kedudukan / Peran',
            type: 'text',
          },
          {
            name: 'teleponPihakKedua',
            label: 'No. HP / WhatsApp',
            type: 'tel',
          },
          {
            name: 'alamatPihakKedua',
            label: 'Alamat Pihak Kedua',
            type: 'textarea',
            rows: 2,
            colSpan: 'full',
          },
        ],
      },
      {
        id: 'objek-termin',
        title: 'Objek Kerja Sama, Nilai Kontrak & Landasan Skema Pembayaran',
        description:
          'Skema termin resmi menjadi dasar nilai pembayaran di Pasal 2 kontrak serta acuan SPK, Invoice, dan BAST.',
        columns: 3,
        headerAction: ({ readOnly, setValues: updateValues }) =>
          !readOnly ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => updateValues((prev) => applyPaymentSchemeToAgreement(prev, paymentScheme))}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Sinkronkan Skema Resmi
            </Button>
          ) : null,
        fields: [
          {
            name: 'judulProyek',
            label: 'Judul Objek Kerja Sama / Proyek',
            type: 'text',
            required: true,
            colSpan: 2,
          },
          {
            name: 'lokasiProyek',
            label: 'Lokasi Pekerjaan',
            type: 'text',
          },
          {
            name: 'nilaiKontrak',
            label: 'Nilai Kontrak (IDR)',
            type: 'currency',
            required: true,
            zeroAsEmpty: true,
          },
          {
            name: 'durasiKerjaHari',
            label: 'Durasi Pengerjaan (Hari Kerja)',
            type: 'number',
            min: 1,
          },
          {
            name: 'masaGaransiBulan',
            label: 'Masa Garansi (Bulan)',
            type: 'number',
            min: 0,
          },
          {
            name: 'persenDp',
            label: 'Ringkasan Termin 1 : Down Payment (%)',
            type: 'number',
            min: 0,
            max: 100,
          },
          {
            name: 'persenProgres',
            label: 'Ringkasan Termin 2 & 3 (Produksi + Pra-Instalasi) (%)',
            type: 'number',
            min: 0,
            max: 100,
          },
          {
            name: 'persenPelunasan',
            label: 'Ringkasan Termin 4 : Serah Terima (%)',
            type: 'number',
            min: 0,
            max: 100,
          },
        ],
        renderContent: ({ values: current }) => {
          const total = computeTerminTotalPercent(current);
          return (
            <div className="space-y-3 pt-1">
              {total !== 100 && (
                <p className="text-xs text-[var(--danger)] font-medium">
                  Perhatian: Total persentase termin saat ini {total}% (sebaiknya tepat 100%).
                </p>
              )}
              <div className="border border-[var(--border)] rounded-[var(--radius-md)] divide-y divide-[var(--border)] bg-[var(--bg)]">
                {paymentBreakdown.map((stage) => (
                  <div
                    key={stage.id}
                    className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text)]">
                        {stage.nama} {stage.persentase}%
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">{stage.keterangan}</p>
                    </div>
                    <span className="font-semibold text-[var(--text)] tabular-nums shrink-0">
                      {stage.amount !== null ? formatRupiahSigned(stage.amount) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        },
      },
      {
        id: 'pasal-perjanjian',
        title: `Pasal-Pasal Perjanjian (${values.daftarPasal.length})`,
        description: 'Atur pasal kesepakatan hukum, ruang lingkup, pembayaran, dan pemeliharaan.',
        headerAction: ({ readOnly, setFieldValue, values: current }) =>
          !readOnly ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setFieldValue('daftarPasal', [
                  ...current.daftarPasal,
                  createEmptyAgreementClause(current.daftarPasal.length + 1),
                ])
              }
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Tambah Pasal
            </Button>
          ) : null,
        renderContent: ({ values: current, setFieldValue, readOnly }) => (
          <div className="space-y-3">
            {current.daftarPasal.map((clause) => (
              <div
                key={clause.id}
                className="p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <Input
                    aria-label="Judul pasal"
                    disabled={readOnly}
                    value={clause.judulPasal}
                    onChange={(e) =>
                      setFieldValue(
                        'daftarPasal',
                        current.daftarPasal.map((c) =>
                          c.id === clause.id ? { ...c, judulPasal: e.target.value } : c
                        )
                      )
                    }
                    className="font-semibold"
                  />
                  {!readOnly && current.daftarPasal.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setFieldValue(
                          'daftarPasal',
                          current.daftarPasal.filter((c) => c.id !== clause.id)
                        )
                      }
                      className="text-xs text-[var(--danger)] hover:underline shrink-0 cursor-pointer px-2"
                    >
                      Hapus
                    </button>
                  )}
                </div>
                <Textarea
                  aria-label={`Isi ${clause.judulPasal}`}
                  rows={3}
                  disabled={readOnly}
                  value={clause.isiPasal}
                  onChange={(e) =>
                    setFieldValue(
                      'daftarPasal',
                      current.daftarPasal.map((c) =>
                        c.id === clause.id ? { ...c, isiPasal: e.target.value } : c
                      )
                    )
                  }
                />
              </div>
            ))}
          </div>
        ),
      },
      {
        id: 'saksi',
        title: 'Saksi Penandatanganan',
        columns: 2,
        fields: [
          {
            name: 'saksiPihakPertama',
            label: 'Saksi Pihak Pertama',
            type: 'text',
          },
          {
            name: 'saksiPihakKedua',
            label: 'Saksi Pihak Kedua',
            type: 'text',
          },
        ],
      },
    ],
    [values.daftarPasal.length, paymentBreakdown, paymentScheme]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validateAgreementDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = normalizeAgreementPayload(values);
    upsertAgreement(payload);
    recordActivity(
      isEditMode
        ? 'Memperbarui Surat Perjanjian Kerja Sama'
        : 'Membuat Surat Perjanjian Kerja Sama baru',
      'Dokumen SPKS',
      payload.nomorKontrak
    );

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: isEditMode
            ? `Perubahan kontrak ${payload.nomorKontrak} berhasil disimpan.`
            : `Perjanjian Kerja Sama ${payload.nomorKontrak} telah diterbitkan.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={
        isEditMode && existingDoc
          ? `Edit ${existingDoc.nomorKontrak}`
          : 'Buat Surat Perjanjian Kerja Sama (SPKS)'
      }
      description="Lengkapi data kedua belah pihak, nominal kontrak, tahapan skema pembayaran, serta pasal-pasal kesepakatan."
      backTo={BACK_PATH}
      backLabel="Kembali ke Daftar SPKS"
      submitLabel={isEditMode ? 'Simpan Perubahan SPKS' : 'Simpan SPKS'}
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      extraHeaderActions={
        isEditMode && existingDoc ? (
          <>
            <Link
              to={`/admin/dokumen/spks/${existingDoc.id}/pratinjau`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
            >
              <Eye className="size-3.5" aria-hidden="true" />
              Pratinjau
            </Link>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                downloadAgreementPdf(
                  normalizeAgreementPayload(values),
                  businessConfig,
                  paymentScheme
                )
              }
            >
              <FileDown className="size-3.5" aria-hidden="true" />
              Unduh PDF SPKS
            </Button>
          </>
        ) : undefined
      }
      notFoundState={
        isEditMode && !existingDoc
          ? {
              title: 'Kontrak SPKS Tidak Ditemukan',
              message: 'Data Surat Perjanjian Kerja Sama yang dicari tidak tersedia atau dihapus.',
            }
          : undefined
      }
      aside={
        <AdminFormSectionCard
          title="Ringkasan Nilai & Termin"
          description="Simulasi pembagian nominal pembayaran berdasarkan skema termin kontrak."
        >
          <dl className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Nilai Kontrak</dt>
              <dd className="text-sm font-semibold text-[var(--text)] tabular-nums">
                {formatRupiahSigned(values.nilaiKontrak || 0)}
              </dd>
            </div>
            {paymentBreakdown.map((stage) => (
              <div key={stage.id} className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-muted)] truncate">
                  {stage.nama} {stage.persentase}%
                </dt>
                <dd className="font-medium text-[var(--text)] tabular-nums shrink-0">
                  {stage.amount !== null ? formatRupiahSigned(stage.amount) : '—'}
                </dd>
              </div>
            ))}
            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Total Persentase Termin</dt>
              <dd
                className={
                  terminTotal === 100
                    ? 'font-semibold text-[var(--success)] tabular-nums'
                    : 'font-semibold text-[var(--danger)] tabular-nums'
                }
              >
                {terminTotal}%
              </dd>
            </div>
          </dl>
        </AdminFormSectionCard>
      }
    />
  );
}
