import { useMemo, useState, type FormEvent } from 'react';
import { Eye, Plus, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { AdminActionButton, AdminActionLink } from '../../../../components/admin/admin-action-buttons';
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
  Textarea,
} from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  CLIENT_ENTITY_TYPE_OPTIONS,
  getClientNameFieldLabel,
  normalizeClientEntityType,
} from '../../../../lib/agreement-identity';
import { formatRupiahSigned } from '../../../../lib/finance-utils';
import {
  DEFAULT_PAYMENT_SCHEME,
  calculatePaymentSchemeBreakdown,
  resolveEffectivePaymentScheme,
} from '../../../../lib/payment-scheme';
import { downloadAgreementPdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import { buildAgreementProductItemsFromProject } from '../../../../lib/project-documents-auto';
import { buildProjectSpksDraft } from '../../../../lib/project-workspace';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useProjectsStore } from '../../../../store/projects-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type {
  CooperationAgreementDocument,
  CooperationAgreementProductItem,
} from '../../../../types/documents';
import {
  AGREEMENT_STATUSES,
  AGREEMENT_TYPES,
  applyPaymentSchemeToAgreement,
  computeAgreementProductsTotal,
  computeTerminTotalPercent,
  createEmptyAgreement,
  createEmptyAgreementClause,
  createEmptyAgreementProductItem,
  normalizeAgreementPayload,
  validateAgreementDraft,
} from './logic';

export default function AdminSpksFormPage() {
  const { id, projectId } = useParams<{ id?: string; projectId?: string }>();
  const navigate = useNavigate();

  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const agreements = useDocumentsStore((state) => state.agreements);
  const upsertAgreement = useDocumentsStore((state) => state.upsertAgreement);
  const projects = useProjectsStore((state) => state.projects);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'proyek');

  const isEditMode = Boolean(id);
  const existingDoc = useMemo(
    () => (id ? agreements.find((doc) => doc.id === id) ?? null : null),
    [id, agreements]
  );

  const resolvedProjectId = projectId ?? existingDoc?.projectId;
  const project = useMemo(
    () => (resolvedProjectId ? projects.find((p) => p.id === resolvedProjectId) ?? null : null),
    [resolvedProjectId, projects]
  );
  const backPath = resolvedProjectId
    ? `/admin/proyek/${resolvedProjectId}?tab=dokumen`
    : '/admin/proyek';

  const [values, setValues] = useState<CooperationAgreementDocument>(() => {
    if (existingDoc) return structuredClone(existingDoc);
    if (project) {
      return buildProjectSpksDraft(project, agreements.length + 9, businessConfig, paymentScheme);
    }
    return createEmptyAgreement(agreements.length + 9, businessConfig, paymentScheme);
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode && existingDoc ? `Ubah ${existingDoc.nomorKontrak}` : 'Buat SPK Baru'} | Dokumen Admin ${businessConfig.namaMerek}`
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
  const resolvedProductList = useMemo(
    () =>
      values.daftarProduk && values.daftarProduk.length > 0
        ? values.daftarProduk
        : project
          ? buildAgreementProductItemsFromProject(project)
          : [],
    [values.daftarProduk, project]
  );
  const productsTotal = useMemo(
    () => computeAgreementProductsTotal(resolvedProductList),
    [resolvedProductList]
  );
  const secondPartyEntityType = normalizeClientEntityType(
    values.jenisPihakKedua,
    values.namaPerusahaanPihakKedua || values.namaPihakKedua
  );
  const isOrganizationSecondParty = secondPartyEntityType !== 'pribadi';

  const sections = useMemo<AdminFormSectionConfig<CooperationAgreementDocument>[]>(
    () => [
      {
        id: 'identitas-kontrak',
        mobileTabLabel: 'Kontrak',
        title: 'Identitas Kontrak',
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
        mobileTabLabel: 'Pihak 1',
        title: 'Pihak Pertama',
        columns: 2,
        fields: [
          {
            name: 'perusahaanPihakPertama',
            label: 'Nama Perusahaan',
            type: 'text',
            colSpan: 'full',
          },
          {
            name: 'perwakilanPihakPertama',
            label: 'Penanggung Jawab',
            type: 'text',
          },
          {
            name: 'jabatanPihakPertama',
            label: 'Jabatan',
            type: 'text',
          },
          {
            name: 'teleponPihakPertama',
            label: 'Telepon / WhatsApp',
            type: 'tel',
            colSpan: 'full',
          },
          {
            name: 'alamatPihakPertama',
            label: 'Alamat Domisili',
            type: 'textarea',
            rows: 2,
            colSpan: 'full',
          },
        ],
      },
      {
        id: 'pihak-kedua',
        mobileTabLabel: 'Pihak 2',
        title: 'Pihak Kedua',
        columns: 2,
        fields: [
          {
            name: 'jenisPihakKedua',
            label: 'Kategori Klien',
            type: 'custom',
            colSpan: 'full',
            render: ({ id, error, readOnly }) => (
              <FormField id={id} label="Kategori Klien" required error={error}>
                <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-3 gap-2.5">
                  {CLIENT_ENTITY_TYPE_OPTIONS.map((opt) => {
                    const selected = secondPartyEntityType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={readOnly}
                        onClick={() =>
                          setValues((prev) => ({
                            ...prev,
                            jenisPihakKedua: opt.value,
                            namaPerusahaanPihakKedua:
                              opt.value === 'pribadi'
                                ? ''
                                : prev.namaPerusahaanPihakKedua || prev.namaPihakKedua,
                            penanggungJawabPihakKedua:
                              opt.value === 'pribadi' ? '' : prev.penanggungJawabPihakKedua ?? '',
                            jabatanPihakKedua:
                              opt.value === 'pribadi'
                                ? 'Pemberi Tugas / Klien'
                                : !prev.jabatanPihakKedua ||
                                    /^(pemberi tugas \/ klien|pemilik \/ pemberi tugas)$/i.test(
                                      prev.jabatanPihakKedua.trim()
                                    )
                                  ? 'Penanggung Jawab'
                                  : prev.jabatanPihakKedua,
                          }))
                        }
                        className={[
                          'h-11 px-3 rounded-[var(--radius-md)] border text-xs sm:text-sm font-medium transition-colors cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed',
                          selected
                            ? 'border-[#312F2E] bg-[#312F2E] text-white font-semibold'
                            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </FormField>
            ),
          },
          {
            name: 'namaPihakKedua',
            label: getClientNameFieldLabel(secondPartyEntityType),
            type: 'text',
            required: true,
            onValueChange: (nextVal) =>
              isOrganizationSecondParty
                ? { namaPerusahaanPihakKedua: String(nextVal ?? '') }
                : undefined,
          },
          {
            name: 'penanggungJawabPihakKedua',
            label: 'Penanggung Jawab',
            type: 'text',
            required: true,
            visibleWhen: () => isOrganizationSecondParty,
          },
          {
            name: 'jabatanPihakKedua',
            label: 'Jabatan',
            type: 'text',
            visibleWhen: () => isOrganizationSecondParty,
          },
          {
            name: 'teleponPihakKedua',
            label: 'Telepon / WhatsApp',
            type: 'tel',
          },
          {
            name: 'alamatPihakKedua',
            label: 'Alamat Domisili',
            type: 'textarea',
            rows: 2,
            colSpan: 'full',
          },
        ],
      },
      {
        id: 'objek-termin',
        mobileTabLabel: 'Objek & Termin',
        title: 'Objek & Termin',
        columns: 3,
        headerAction: ({ readOnly, setValues: updateValues }) =>
          !readOnly ? (
            <AdminActionButton
              icon={<RefreshCw className="size-3.5" />}
              label="Sinkronkan Skema Resmi"
              onClick={() => updateValues((prev) => applyPaymentSchemeToAgreement(prev, paymentScheme))}
            />
          ) : null,
        fields: [
          {
            name: 'judulProyek',
            label: 'Jenis / Judul Pekerjaan',
            type: 'text',
            required: true,
            colSpan: 2,
          },
          {
            name: 'lokasiProyek',
            label: 'Lokasi Proyek',
            type: 'text',
          },
          {
            name: 'nomorPenawaranReferensi',
            label: 'Referensi Penawaran',
            type: 'text',
            placeholder: 'QUO/SDI-K/001/XI/2026',
          },
          {
            name: 'tanggalMulaiKerja',
            label: 'Tanggal Mulai Pelaksanaan',
            type: 'date',
          },
          {
            name: 'tanggalSelesaiKerja',
            label: 'Target Tanggal Selesai',
            type: 'date',
          },
          {
            name: 'lampiranAcuan',
            label: 'Lampiran Acuan (RAB / Shop Drawing / Penawaran)',
            type: 'textarea',
            rows: 2,
            colSpan: 'full',
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
        id: 'rincian-produk',
        mobileTabLabel: 'Produk',
        title: `Rincian Detail Produk, Spesifikasi & Kode Warna (${resolvedProductList.length})`,
        errorFields: ['daftarProduk'],
        headerAction: ({ readOnly, setFieldValue, values: current }) =>
          !readOnly ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {project && (
                <AdminActionButton
                  icon={<RefreshCw className="size-3.5" />}
                  label="Sinkronkan dari Proyek"
                  mobileLabel="Proyek"
                  onClick={() =>
                    setFieldValue('daftarProduk', buildAgreementProductItemsFromProject(project))
                  }
                />
              )}
              <AdminActionButton
                icon={<Plus className="size-3.5" />}
                label="Tambah Produk"
                mobileLabel="Produk"
                onClick={() => {
                  const baseList =
                    current.daftarProduk && current.daftarProduk.length > 0
                      ? current.daftarProduk
                      : resolvedProductList;
                  setFieldValue('daftarProduk', [...baseList, createEmptyAgreementProductItem()]);
                }}
              />
            </div>
          ) : null,
        renderContent: ({ values: current, setFieldValue, readOnly }) => {
          const items =
            current.daftarProduk && current.daftarProduk.length > 0
              ? current.daftarProduk
              : resolvedProductList;

          const updateProductRow = (
            rowId: string,
            updater: (row: CooperationAgreementProductItem) => CooperationAgreementProductItem
          ) => {
            setFieldValue(
              'daftarProduk',
              items.map((row) => {
                if (row.id !== rowId) return row;
                const next = updater(row);
                const qty = Math.max(1, Math.round(Number(next.jumlah) || 1));
                const unitPrice = Math.max(0, Math.round(Number(next.hargaSatuan) || 0));
                return {
                  ...next,
                  subtotal: qty * unitPrice,
                };
              })
            );
          };

          if (items.length === 0) {
            return (
              <p className="text-xs text-[var(--text-muted)]">
                Belum ada rincian produk pada SPK ini. Klik &ldquo;Tambah Produk&rdquo; untuk
                mencantumkan detail unit, spesifikasi, material, finishing, dan kode warna acuan.
              </p>
            );
          }

          return (
            <div className="space-y-3">
              {items.map((item, idx) => {
                const qty = Math.max(1, Math.round(Number(item.jumlah) || 1));
                const unitPrice = Math.max(0, Math.round(Number(item.hargaSatuan) || 0));
                const lineSubtotal =
                  typeof item.subtotal === 'number' && item.subtotal > 0
                    ? item.subtotal
                    : qty * unitPrice;

                return (
                  <div
                    key={item.id}
                    className="p-3.5 sm:p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--text-muted)] tabular-nums">
                        Produk #{idx + 1} · Subtotal {formatRupiahSigned(lineSubtotal)}
                      </span>
                      {!readOnly && (
                        <AdminActionButton
                          variant="danger"
                          icon={<Trash2 className="size-3.5" />}
                          label={`Hapus Produk #${idx + 1}`}
                          iconOnly
                          onClick={() =>
                            setFieldValue(
                              'daftarProduk',
                              items.filter((row) => row.id !== item.id)
                            )
                          }
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-5">
                        <FormField id={`spks-prd-name-${item.id}`} label="Nama Produk / Unit" required>
                          <Input
                            id={`spks-prd-name-${item.id}`}
                            disabled={readOnly}
                            placeholder="Contoh: Kitchen Set Atas & Bawah"
                            value={item.namaProduk}
                            onChange={(e) =>
                              updateProductRow(item.id, (row) => ({
                                ...row,
                                namaProduk: e.target.value,
                              }))
                            }
                          />
                        </FormField>
                      </div>
                      <div className="sm:col-span-4">
                        <FormField id={`spks-prd-dim-${item.id}`} label="Dimensi (P × L × T cm)">
                          <DimensionInput
                            id={`spks-prd-dim-${item.id}`}
                            disabled={readOnly}
                            value={item.dimensi}
                            onValueChange={(nextDimensi) =>
                              updateProductRow(item.id, (row) => ({
                                ...row,
                                dimensi: nextDimensi,
                              }))
                            }
                          />
                        </FormField>
                      </div>
                      <div className="sm:col-span-1">
                        <FormField id={`spks-prd-qty-${item.id}`} label="Qty">
                          <Input
                            id={`spks-prd-qty-${item.id}`}
                            type="number"
                            min={1}
                            disabled={readOnly}
                            value={item.jumlah}
                            onChange={(e) =>
                              updateProductRow(item.id, (row) => ({
                                ...row,
                                jumlah: Math.max(1, Math.round(Number(e.target.value) || 1)),
                              }))
                            }
                          />
                        </FormField>
                      </div>
                      <div className="sm:col-span-2">
                        <FormField id={`spks-prd-unit-${item.id}`} label="Satuan">
                          <Input
                            id={`spks-prd-unit-${item.id}`}
                            disabled={readOnly}
                            placeholder="Unit"
                            value={item.satuan}
                            onChange={(e) =>
                              updateProductRow(item.id, (row) => ({
                                ...row,
                                satuan: e.target.value,
                              }))
                            }
                          />
                        </FormField>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-3">
                        <FormField id={`spks-prd-custom-${item.id}`} label="Model / Customisasi">
                          <Input
                            id={`spks-prd-custom-${item.id}`}
                            disabled={readOnly}
                            placeholder="Letter L Standar"
                            value={item.customisasi ?? ''}
                            onChange={(e) =>
                              updateProductRow(item.id, (row) => ({
                                ...row,
                                customisasi: e.target.value,
                              }))
                            }
                          />
                        </FormField>
                      </div>
                      <div className="sm:col-span-3">
                        <FormField id={`spks-prd-mat-${item.id}`} label="Material Utama">
                          <Input
                            id={`spks-prd-mat-${item.id}`}
                            disabled={readOnly}
                            placeholder="Multipleks 18 MM"
                            value={item.material ?? ''}
                            onChange={(e) =>
                              updateProductRow(item.id, (row) => ({
                                ...row,
                                material: e.target.value,
                              }))
                            }
                          />
                        </FormField>
                      </div>
                      <div className="sm:col-span-2">
                        <FormField id={`spks-prd-fin-${item.id}`} label="Finishing">
                          <Input
                            id={`spks-prd-fin-${item.id}`}
                            disabled={readOnly}
                            placeholder="HPL / Cat Duco"
                            value={item.finishing ?? ''}
                            onChange={(e) =>
                              updateProductRow(item.id, (row) => ({
                                ...row,
                                finishing: e.target.value,
                              }))
                            }
                          />
                        </FormField>
                      </div>
                      <div className="sm:col-span-2">
                        <FormField id={`spks-prd-color-${item.id}`} label="Kode Warna">
                          <Input
                            id={`spks-prd-color-${item.id}`}
                            disabled={readOnly}
                            placeholder="TH 015 AA"
                            value={item.kodeWarna ?? ''}
                            onChange={(e) =>
                              updateProductRow(item.id, (row) => ({
                                ...row,
                                kodeWarna: e.target.value,
                              }))
                            }
                          />
                        </FormField>
                      </div>
                      <div className="sm:col-span-2">
                        <FormField id={`spks-prd-price-${item.id}`} label="Harga Satuan">
                          <CurrencyInput
                            id={`spks-prd-price-${item.id}`}
                            disabled={readOnly}
                            value={item.hargaSatuan}
                            onValueChange={(nextPrice) =>
                              updateProductRow(item.id, (row) => ({
                                ...row,
                                hargaSatuan: Math.max(0, Math.round(nextPrice || 0)),
                              }))
                            }
                          />
                        </FormField>
                      </div>
                    </div>

                    <FormField
                      id={`spks-prd-spec-${item.id}`}
                      label="Spesifikasi Material, Hardware & Keterangan Teknis"
                    >
                      <Textarea
                        id={`spks-prd-spec-${item.id}`}
                        rows={2}
                        disabled={readOnly}
                        placeholder="Detail ketebalan bahan, engsel slow-motion, rel laci, edgings, dan aksesoris tambahan..."
                        value={item.spesifikasiMaterial}
                        onChange={(e) =>
                          updateProductRow(item.id, (row) => ({
                            ...row,
                            spesifikasiMaterial: e.target.value,
                          }))
                        }
                      />
                    </FormField>
                  </div>
                );
              })}
            </div>
          );
        },
      },
      {
        id: 'pasal-perjanjian',
        mobileTabLabel: 'Pasal',
        title: `Pasal (${values.daftarPasal.length})`,
        errorFields: ['daftarPasal'],
        headerAction: ({ readOnly, setFieldValue, values: current }) =>
          !readOnly ? (
            <AdminActionButton
              icon={<Plus className="size-3.5" />}
              label="Tambah Pasal"
              mobileLabel="Pasal"
              onClick={() =>
                setFieldValue('daftarPasal', [
                  ...current.daftarPasal,
                  createEmptyAgreementClause(current.daftarPasal.length + 1),
                ])
              }
            />
          ) : null,
        renderContent: ({ values: current, setFieldValue, readOnly }) => (
          <div className="space-y-3">
            {current.daftarPasal.map((clause) => (
              <div
                key={clause.id}
                className="p-3.5 sm:p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-2.5"
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
                    <AdminActionButton
                      variant="danger"
                      icon={<Trash2 className="size-3.5" />}
                      label={`Hapus ${clause.judulPasal}`}
                      iconOnly
                      onClick={() =>
                        setFieldValue(
                          'daftarPasal',
                          current.daftarPasal.filter((c) => c.id !== clause.id)
                        )
                      }
                    />
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
        mobileTabLabel: 'Saksi',
        title: 'Saksi',
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
    [
      secondPartyEntityType,
      isOrganizationSecondParty,
      values.daftarPasal.length,
      paymentBreakdown,
      paymentScheme,
      project,
      resolvedProductList,
    ]
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

    const payload: CooperationAgreementDocument = {
      ...normalizeAgreementPayload(values),
      projectId: values.projectId ?? resolvedProjectId,
    };
    upsertAgreement(payload);
    recordActivity(
      isEditMode
        ? 'Memperbarui Surat Perjanjian Kerja (SPK)'
        : 'Membuat Surat Perjanjian Kerja (SPK) baru',
      'Dokumen SPK',
      payload.nomorKontrak
    );

    navigate(backPath, {
      state: {
        feedback: {
          type: 'ok',
          text: isEditMode
            ? `Perubahan kontrak SPK ${payload.nomorKontrak} berhasil disimpan.`
            : `Surat Perjanjian Kerja ${payload.nomorKontrak} telah diterbitkan.`,
        },
      },
    });
  };

  const previewPath =
    existingDoc && resolvedProjectId
      ? `/admin/proyek/${resolvedProjectId}/dokumen/spks/${existingDoc.id}/pratinjau`
      : existingDoc
        ? `/admin/dokumen/spks/${existingDoc.id}/pratinjau`
        : '';

  return (
    <AdminForm
      title={isEditMode ? 'Edit Surat Perjanjian Kerja (SPK)' : 'Buat Surat Perjanjian Kerja (SPK)'}
      description={
        project
          ? `Proyek: ${[project.id, project.namaProyek].filter(Boolean).join(' · ')}`
          : undefined
      }
      backTo={backPath}
      backLabel={project ? 'Kembali ke Proyek' : 'Kembali ke Daftar Proyek'}
      submitLabel={isEditMode ? 'Simpan Perubahan SPK' : 'Simpan SPK'}
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
            <AdminActionLink
              to={previewPath}
              icon={<Eye className="size-3.5" />}
              label="Pratinjau"
            />
            <AdminActionButton
              icon={<Printer className="size-3.5" />}
              label="Cetak PDF SPK"
              onClick={() =>
                downloadAgreementPdf(
                  normalizeAgreementPayload(values),
                  businessConfig,
                  paymentScheme,
                  project
                )
              }
            />
          </>
        ) : undefined
      }
      notFoundState={
        isEditMode && !existingDoc
          ? {
              title: 'Dokumen SPK Tidak Ditemukan',
              message: 'Data Surat Perjanjian Kerja yang dicari tidak tersedia atau dihapus.',
            }
          : undefined
      }
      asideTabLabel="Ringkasan"
      aside={
        <AdminFormSectionCard title="Ringkasan Kontrak">
          <dl className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Nilai Kontrak</dt>
              <dd className="text-sm font-semibold text-[var(--text)] tabular-nums">
                {formatRupiahSigned(values.nilaiKontrak || 0)}
              </dd>
            </div>
            {resolvedProductList.length > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-muted)]">
                  Rincian Produk ({resolvedProductList.length} item)
                </dt>
                <dd className="font-medium text-[var(--text)] tabular-nums">
                  {formatRupiahSigned(productsTotal)}
                </dd>
              </div>
            )}
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
