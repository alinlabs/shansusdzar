import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { AdminActionButton } from '../../../../components/admin/admin-action-buttons';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import {
  CurrencyInput,
  DimensionInput,
  FormField,
  Input,
  Select,
} from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatRupiahSigned, formatShortDateId } from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  calculatePaymentSchemeBreakdown,
  clonePaymentSchemeStages,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import { downloadQuotationPdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import { buildProjectQuotationDraft } from '../../../../lib/project-workspace';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useProjectsStore } from '../../../../store/projects-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { QuotationDocument } from '../../../../types/documents';
import {
  QUOTATION_STATUSES,
  QUOTATION_UNITS,
  computeQuotationItemSubtotal,
  computeQuotationTotal,
  createEmptyQuotation,
  createEmptyQuotationItem,
  normalizeQuotationPayload,
  validateQuotationDraft,
} from './logic';

export default function AdminPenawaranFormPage() {
  const { id, projectId } = useParams<{ id?: string; projectId?: string }>();
  const navigate = useNavigate();

  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const quotations = useDocumentsStore((state) => state.quotations);
  const upsertQuotation = useDocumentsStore((state) => state.upsertQuotation);
  const projects = useProjectsStore((state) => state.projects);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'proyek');

  const isEditMode = Boolean(id);
  const existingDoc = useMemo(
    () => (id ? quotations.find((doc) => doc.id === id) ?? null : null),
    [id, quotations]
  );

  const resolvedProjectId = projectId ?? existingDoc?.projectId;
  const project = useMemo(
    () => (resolvedProjectId ? projects.find((p) => p.id === resolvedProjectId) ?? null : null),
    [resolvedProjectId, projects]
  );
  const backPath = resolvedProjectId
    ? `/admin/proyek/${resolvedProjectId}?tab=dokumen`
    : '/admin/proyek';

  const [values, setValues] = useState<QuotationDocument>(() => {
    if (existingDoc) return structuredClone(existingDoc);
    if (project) {
      return buildProjectQuotationDraft(
        project,
        quotations.length + 20,
        businessConfig,
        paymentScheme
      );
    }
    return createEmptyQuotation(quotations.length + 20, businessConfig, paymentScheme);
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode && existingDoc ? `Ubah ${existingDoc.nomorPenawaran}` : 'Buat Surat Penawaran'} | Dokumen Admin ${businessConfig.namaMerek}`
  );

  const totalPenawaran = useMemo(
    () => computeQuotationTotal(values.daftarItem),
    [values.daftarItem]
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
    () => calculatePaymentSchemeBreakdown(totalPenawaran, effectiveScheme),
    [totalPenawaran, effectiveScheme]
  );

  const sections = useMemo<AdminFormSectionConfig<QuotationDocument>[]>(
    () => [
      {
        id: 'identitas-penawaran',
        mobileTabLabel: 'Identitas',
        title: 'Identitas Penawaran & Masa Berlaku',
        columns: 3,
        fields: [
          {
            name: 'nomorPenawaran',
            label: 'Nomor Surat Penawaran',
            type: 'text',
            required: true,
          },
          {
            name: 'tanggalPenawaran',
            label: 'Tanggal Penawaran',
            type: 'date',
            required: true,
          },
          {
            name: 'berlakuHingga',
            label: 'Berlaku Hingga',
            type: 'date',
            required: true,
          },
          {
            name: 'status',
            label: 'Status Penawaran',
            type: 'select',
            options: QUOTATION_STATUSES.map((st) => ({ value: st, label: st })),
          },
          {
            name: 'estimasiDurasiHari',
            label: 'Estimasi Pengerjaan (Hari)',
            type: 'number',
            min: 1,
          },
          {
            name: 'disusunOleh',
            label: 'Disusun Oleh',
            type: 'text',
          },
        ],
      },
      {
        id: 'klien-lokasi',
        mobileTabLabel: 'Klien',
        title: 'Calon Klien & Lokasi Proyek',
        columns: 3,
        fields: [
          {
            name: 'namaProyek',
            label: 'Nama Proyek / Pekerjaan',
            type: 'text',
            required: true,
            colSpan: 2,
          },
          {
            name: 'namaKlien',
            label: 'Nama Klien / PT',
            type: 'text',
            required: true,
          },
          {
            name: 'teleponKlien',
            label: 'No. HP / WhatsApp',
            type: 'tel',
          },
          {
            name: 'alamatLokasi',
            label: 'Alamat Lokasi Proyek',
            type: 'text',
            colSpan: 2,
          },
        ],
      },
      {
        id: 'rincian-boq',
        mobileTabLabel: 'Item BOQ',
        title: `Rincian Item BOQ (${values.daftarItem.length})`,
        errorFields: ['daftarItem'],
        headerAction: ({ readOnly, setFieldValue, values: current }) =>
          !readOnly ? (
            <AdminActionButton
              icon={<Plus className="size-3.5" />}
              label="Tambah Item BOQ"
              mobileLabel="Item"
              onClick={() =>
                setFieldValue('daftarItem', [...current.daftarItem, createEmptyQuotationItem()])
              }
            />
          ) : null,
        renderContent: ({ values: current, setFieldValue, readOnly, errors }) => (
          <div className="space-y-3">
            {errors.daftarItem && (
              <p role="alert" className="text-xs font-medium text-[var(--danger)]">
                {errors.daftarItem}
              </p>
            )}
            {current.daftarItem.map((item, idx) => {
              const subtotal = computeQuotationItemSubtotal(item);
              return (
                <div
                  key={item.id}
                  className="p-3.5 sm:p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">
                      Item BOQ #{idx + 1} · Subtotal {formatRupiahSigned(subtotal)}
                    </span>
                    {!readOnly && current.daftarItem.length > 1 && (
                      <AdminActionButton
                        variant="danger"
                        icon={<Trash2 className="size-3.5" />}
                        label={`Hapus Item BOQ #${idx + 1}`}
                        iconOnly
                        onClick={() =>
                          setFieldValue(
                            'daftarItem',
                            current.daftarItem.filter((row) => row.id !== item.id)
                          )
                        }
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-6">
                      <FormField id={`quo-item-${item.id}`} label="Nama Item / Unit Pekerjaan" required>
                        <Input
                          id={`quo-item-${item.id}`}
                          required
                          disabled={readOnly}
                          placeholder="Contoh: Kabinet Dapur Bawah + Top Table Granit"
                          value={item.namaItem}
                          onChange={(e) =>
                            setFieldValue(
                              'daftarItem',
                              current.daftarItem.map((row) =>
                                row.id === item.id ? { ...row, namaItem: e.target.value } : row
                              )
                            )
                          }
                        />
                      </FormField>
                    </div>
                    <div className="sm:col-span-6">
                      <FormField id={`quo-dim-${item.id}`} label="Dimensi (cm)">
                        <DimensionInput
                          id={`quo-dim-${item.id}`}
                          disabled={readOnly}
                          value={item.dimensi}
                          onValueChange={(nextDimensi) =>
                            setFieldValue(
                              'daftarItem',
                              current.daftarItem.map((row) =>
                                row.id === item.id ? { ...row, dimensi: nextDimensi } : row
                              )
                            )
                          }
                        />
                      </FormField>
                    </div>
                  </div>

                  <FormField
                    id={`quo-mat-${item.id}`}
                    label="Jenis Material & Finishing (Multipleks, HPL, Cat Duco, Aksesoris)"
                  >
                    <Input
                      id={`quo-mat-${item.id}`}
                      disabled={readOnly}
                      placeholder="Multipleks Meranti 18 mm + Finishing HPL Taco & Engsel Slow-Motion"
                      value={item.spesifikasiMaterial}
                      onChange={(e) =>
                        setFieldValue(
                          'daftarItem',
                          current.daftarItem.map((row) =>
                            row.id === item.id
                              ? { ...row, spesifikasiMaterial: e.target.value }
                              : row
                          )
                        )
                      }
                    />
                  </FormField>

                  <div className="grid grid-cols-2 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-3">
                      <FormField id={`quo-qty-${item.id}`} label="Jumlah">
                        <Input
                          id={`quo-qty-${item.id}`}
                          type="number"
                          min={1}
                          disabled={readOnly}
                          value={item.jumlah}
                          onChange={(e) =>
                            setFieldValue(
                              'daftarItem',
                              current.daftarItem.map((row) =>
                                row.id === item.id
                                  ? { ...row, jumlah: Number(e.target.value) || 1 }
                                  : row
                              )
                            )
                          }
                        />
                      </FormField>
                    </div>
                    <div className="sm:col-span-3">
                      <FormField id={`quo-unit-${item.id}`} label="Satuan">
                        <Select
                          id={`quo-unit-${item.id}`}
                          disabled={readOnly}
                          value={item.satuan}
                          onChange={(e) =>
                            setFieldValue(
                              'daftarItem',
                              current.daftarItem.map((row) =>
                                row.id === item.id ? { ...row, satuan: e.target.value } : row
                              )
                            )
                          }
                        >
                          {QUOTATION_UNITS.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    </div>
                    <div className="col-span-2 sm:col-span-6">
                      <FormField id={`quo-price-${item.id}`} label="Harga Satuan (IDR)">
                        <CurrencyInput
                          id={`quo-price-${item.id}`}
                          disabled={readOnly}
                          zeroAsEmpty
                          value={item.hargaSatuan}
                          onValueChange={(nextVal) =>
                            setFieldValue(
                              'daftarItem',
                              current.daftarItem.map((row) =>
                                row.id === item.id ? { ...row, hargaSatuan: nextVal } : row
                              )
                            )
                          }
                        />
                      </FormField>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ),
      },
      {
        id: 'skema-termin-syarat',
        mobileTabLabel: 'Termin',
        title: 'Skema Termin & Syarat Penawaran',
        columns: 1,
        headerAction: ({ readOnly, setFieldValue }) =>
          !readOnly ? (
            <AdminActionButton
              icon={<RefreshCw className="size-3.5" />}
              label="Terapkan Skema Resmi"
              onClick={() => {
                setFieldValue('tahapanPembayaran', clonePaymentSchemeStages(paymentScheme));
                setFieldValue('catatanPembayaran', paymentScheme.catatan);
              }}
            />
          ) : null,
        fields: [
          {
            name: 'syaratKetentuan',
            label: 'Syarat & Ketentuan Penawaran',
            type: 'textarea',
            rows: 3,
          },
          {
            name: 'catatanTambahan',
            label: 'Catatan Tambahan Negosiasi / Garansi',
            type: 'textarea',
            rows: 2,
          },
        ],
        renderContent: () => (
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
        ),
      },
    ],
    [values.daftarItem.length, paymentBreakdown, paymentScheme]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validateQuotationDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload: QuotationDocument = {
      ...normalizeQuotationPayload(values),
      projectId: values.projectId ?? resolvedProjectId,
    };
    upsertQuotation(payload);
    recordActivity(
      isEditMode ? 'Memperbarui Surat Penawaran' : 'Membuat Surat Penawaran baru',
      'Dokumen Penawaran',
      payload.nomorPenawaran
    );

    navigate(backPath, {
      state: {
        feedback: {
          type: 'ok',
          text: isEditMode
            ? `Surat Penawaran ${payload.nomorPenawaran} berhasil diperbarui.`
            : `Surat Penawaran ${payload.nomorPenawaran} telah disimpan.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={isEditMode ? 'Edit Surat Penawaran' : 'Buat Surat Penawaran'}
      description={
        project
          ? `Proyek: ${[project.id, project.namaProyek].filter(Boolean).join(' · ')}`
          : undefined
      }
      backTo={backPath}
      backLabel={project ? 'Kembali ke Proyek' : 'Kembali ke Daftar Proyek'}
      submitLabel={isEditMode ? 'Simpan Perubahan Penawaran' : 'Simpan Surat Penawaran'}
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      extraHeaderActions={
        isEditMode && existingDoc ? (
          <AdminActionButton
            icon={<Printer className="size-3.5" />}
            label="Cetak PDF Penawaran"
            onClick={() =>
              downloadQuotationPdf(
                normalizeQuotationPayload(values),
                businessConfig,
                paymentScheme,
                project
              )
            }
          />
        ) : undefined
      }
      notFoundState={
        isEditMode && !existingDoc
          ? {
              title: 'Surat Penawaran Tidak Ditemukan',
              message: 'Data Surat Penawaran yang dicari tidak tersedia atau sudah dihapus.',
            }
          : undefined
      }
      asideTabLabel="Ringkasan"
      aside={
        <AdminFormSectionCard title="Ringkasan Penawaran">
          <dl className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Nomor Penawaran</dt>
              <dd className="font-mono font-semibold text-[var(--text)]">
                {values.nomorPenawaran || '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Status</dt>
              <dd className="font-medium text-[var(--text)]">{values.status}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Berlaku Hingga</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {values.berlakuHingga ? formatShortDateId(values.berlakuHingga) : '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Estimasi Pengerjaan</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {values.estimasiDurasiHari} hari
              </dd>
            </div>
            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Total Estimasi BOQ</dt>
              <dd className="font-semibold text-[var(--text)] tabular-nums">
                {formatRupiahSigned(totalPenawaran)}
              </dd>
            </div>
          </dl>
        </AdminFormSectionCard>
      }
    />
  );
}
