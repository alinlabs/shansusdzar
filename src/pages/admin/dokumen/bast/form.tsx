import { useMemo, useState, type FormEvent } from 'react';
import { Eye, FileDown, Plus } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { FormField, Input, Select } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { formatShortDateId } from '../../../../lib/finance-utils';
import { downloadHandoverPdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../../store/documents-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type {
  HandoverCertificateDocument,
  HandoverItemCondition,
} from '../../../../types/documents';
import {
  HANDOVER_ITEM_CONDITIONS,
  HANDOVER_STATUSES,
  HANDOVER_TYPES,
  buildHandoverPrefillFromAgreement,
  buildHandoverPrefillFromSpk,
  computeHandoverStats,
  createEmptyHandover,
  createEmptyHandoverItem,
  duplicateHandoverDraft,
  normalizeHandoverPayload,
  validateHandoverDraft,
} from './logic';

const BACK_PATH = '/admin/dokumen/bast';

export default function AdminBastFormPage() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const handoverCertificates = useDocumentsStore((state) => state.handoverCertificates);
  const workOrders = useDocumentsStore((state) => state.workOrders);
  const agreements = useDocumentsStore((state) => state.agreements);
  const upsertHandoverCertificate = useDocumentsStore((state) => state.upsertHandoverCertificate);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'keuangan.edit');

  const isEditMode = Boolean(id);
  const duplicateId = searchParams.get('duplicate');
  const existingDoc = useMemo(
    () => (id ? handoverCertificates.find((doc) => doc.id === id) ?? null : null),
    [id, handoverCertificates]
  );

  const [values, setValues] = useState<HandoverCertificateDocument>(() => {
    if (existingDoc) return structuredClone(existingDoc);
    if (duplicateId) {
      const source = handoverCertificates.find((doc) => doc.id === duplicateId);
      if (source) return duplicateHandoverDraft(source, handoverCertificates.length + 6);
    }
    return createEmptyHandover(handoverCertificates.length + 6, businessConfig);
  });

  const [selectedSpkId, setSelectedSpkId] = useState('');
  const [selectedSpksId, setSelectedSpksId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode && existingDoc ? `Ubah ${existingDoc.nomorBast}` : 'Buat BAST Baru'} | Dokumen Admin ${businessConfig.namaMerekSingkat}`
  );

  const stats = useMemo(() => computeHandoverStats(values.daftarItem), [values.daftarItem]);

  const handleApplySpkPrefill = (spkId: string) => {
    setSelectedSpkId(spkId);
    const spk = workOrders.find((item) => item.id === spkId);
    if (!spk) return;
    setValues((prev) => buildHandoverPrefillFromSpk(spk, prev));
  };

  const handleApplySpksPrefill = (spksId: string) => {
    setSelectedSpksId(spksId);
    const spks = agreements.find((item) => item.id === spksId);
    if (!spks) return;
    setValues((prev) => buildHandoverPrefillFromAgreement(spks, prev));
  };

  const sections = useMemo<AdminFormSectionConfig<HandoverCertificateDocument>[]>(
    () => [
      {
        id: 'identitas-bast',
        title: 'Identitas & Referensi BAST',
        description:
          'Nomor dokumen resmi, jenis serah terima, tanggal lokasi, serta rujukan SPK/kontrak bila tersedia.',
        columns: 3,
        fields: [
          {
            name: 'nomorBast',
            label: 'Nomor BAST',
            type: 'text',
            required: true,
          },
          {
            name: 'jenisSerahTerima',
            label: 'Jenis Serah Terima',
            type: 'select',
            options: HANDOVER_TYPES.map((t) => ({ value: t, label: t })),
          },
          {
            name: 'status',
            label: 'Status Dokumen',
            type: 'select',
            options: HANDOVER_STATUSES.map((st) => ({ value: st, label: st })),
          },
          {
            name: 'kotaSerahTerima',
            label: 'Kota Serah Terima',
            type: 'text',
          },
          {
            name: 'tanggalSerahTerima',
            label: 'Tanggal Serah Terima',
            type: 'date',
            required: true,
          },
          {
            name: 'persentaseSelesai',
            label: 'Progres Pekerjaan (%)',
            type: 'number',
            min: 0,
            max: 100,
          },
          {
            name: 'nomorSpkReferensi',
            label: 'Referensi Nomor SPK',
            type: 'text',
            placeholder: 'Opsional, mis. SPK-SDI-2026-014',
          },
          {
            name: 'nomorSpksReferensi',
            label: 'Referensi Nomor SPKS',
            type: 'text',
            placeholder: 'Opsional, mis. SPKS-SDI-2026-008',
          },
        ],
        renderContent: ({ readOnly }) => {
          if (readOnly || (workOrders.length === 0 && agreements.length === 0)) return null;
          return (
            <div className="pt-3 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 gap-3">
              {workOrders.length > 0 && (
                <FormField
                  id="prefill-from-spk"
                  label="Salin Cepat dari SPK Workshop"
                  hint="Mengisi nama proyek, klien, lokasi, serta daftar unit dari SPK."
                >
                  <Select
                    id="prefill-from-spk"
                    value={selectedSpkId}
                    onChange={(e) => handleApplySpkPrefill(e.target.value)}
                  >
                    <option value="">— Pilih SPK untuk salin data —</option>
                    {workOrders.map((spk) => (
                      <option key={spk.id} value={spk.id}>
                        {spk.nomorSpk} · {spk.namaProyek}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}

              {agreements.length > 0 && (
                <FormField
                  id="prefill-from-spks"
                  label="Salin Cepat dari Kontrak SPKS"
                  hint="Mengisi nomor kontrak, kontak klien, dan durasi garansi."
                >
                  <Select
                    id="prefill-from-spks"
                    value={selectedSpksId}
                    onChange={(e) => handleApplySpksPrefill(e.target.value)}
                  >
                    <option value="">— Pilih SPKS untuk salin data —</option>
                    {agreements.map((spks) => (
                      <option key={spks.id} value={spks.id}>
                        {spks.nomorKontrak} · {spks.namaPihakKedua}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
            </div>
          );
        },
      },
      {
        id: 'pihak-pertama',
        title: 'PIHAK PERTAMA (Yang Menyerahkan / Workshop)',
        columns: 3,
        fields: [
          {
            name: 'perusahaanPihakPertama',
            label: 'Nama Perusahaan / Studio',
            type: 'text',
          },
          {
            name: 'perwakilanPihakPertama',
            label: 'Perwakilan Workshop',
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
        title: 'PIHAK KEDUA (Yang Menerima / Klien)',
        columns: 3,
        fields: [
          {
            name: 'namaPihakKedua',
            label: 'Nama Penerima / Klien',
            type: 'text',
            required: true,
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
            label: 'Alamat Klien',
            type: 'textarea',
            rows: 2,
            colSpan: 'full',
          },
        ],
      },
      {
        id: 'proyek-garansi',
        title: 'Informasi Proyek & Masa Garansi Pemeliharaan',
        columns: 3,
        fields: [
          {
            name: 'namaProyek',
            label: 'Nama Proyek / Pekerjaan',
            type: 'text',
            required: true,
            colSpan: 2,
            placeholder: 'Contoh: Kitchen Set L-Shape HPL Matte & Pantry',
          },
          {
            name: 'masaGaransiBulan',
            label: 'Masa Garansi (Bulan)',
            type: 'number',
            min: 0,
          },
          {
            name: 'lokasiPemasangan',
            label: 'Lokasi Pemasangan',
            type: 'text',
            colSpan: 2,
          },
          {
            name: 'tanggalMulaiGaransi',
            label: 'Mulai Berlaku Garansi',
            type: 'date',
          },
        ],
      },
      {
        id: 'checklist-serah-terima',
        title: `Daftar Unit & Checklist Pemeriksaan (${values.daftarItem.length})`,
        description:
          'Verifikasi setiap unit terpasang beserta kondisi fungsi engsel, rel, finishing, dan catatan lapangan.',
        headerAction: ({ readOnly, setFieldValue, values: current }) =>
          !readOnly ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setFieldValue('daftarItem', [...current.daftarItem, createEmptyHandoverItem()])
              }
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Tambah Unit
            </Button>
          ) : null,
        renderContent: ({ values: current, setFieldValue, readOnly, errors }) => (
          <div className="space-y-3">
            {errors.daftarItem && (
              <p role="alert" className="text-xs font-medium text-[var(--danger)]">
                {errors.daftarItem}
              </p>
            )}
            {current.daftarItem.map((item, idx) => (
              <div
                key={item.id}
                className="p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    Unit #{idx + 1}
                  </span>
                  {!readOnly && current.daftarItem.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setFieldValue(
                          'daftarItem',
                          current.daftarItem.filter((row) => row.id !== item.id)
                        )
                      }
                      className="text-xs text-[var(--danger)] hover:underline cursor-pointer"
                    >
                      Hapus Unit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-5">
                    <FormField id={`bast-unit-${item.id}`} label="Nama Unit / Bagian" required>
                      <Input
                        id={`bast-unit-${item.id}`}
                        required
                        disabled={readOnly}
                        placeholder="Contoh: Kabinet Dapur Bawah"
                        value={item.namaUnit}
                        onChange={(e) =>
                          setFieldValue(
                            'daftarItem',
                            current.daftarItem.map((row) =>
                              row.id === item.id ? { ...row, namaUnit: e.target.value } : row
                            )
                          )
                        }
                      />
                    </FormField>
                  </div>

                  <div className="sm:col-span-4">
                    <FormField id={`bast-dim-${item.id}`} label="Dimensi">
                      <Input
                        id={`bast-dim-${item.id}`}
                        disabled={readOnly}
                        placeholder="320 × 60 × 85 cm"
                        value={item.dimensi}
                        onChange={(e) =>
                          setFieldValue(
                            'daftarItem',
                            current.daftarItem.map((row) =>
                              row.id === item.id ? { ...row, dimensi: e.target.value } : row
                            )
                          )
                        }
                      />
                    </FormField>
                  </div>

                  <div className="sm:col-span-3">
                    <FormField id={`bast-qty-${item.id}`} label="Jumlah">
                      <Input
                        id={`bast-qty-${item.id}`}
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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4">
                    <FormField id={`bast-cond-${item.id}`} label="Hasil Pemeriksaan">
                      <Select
                        id={`bast-cond-${item.id}`}
                        disabled={readOnly}
                        value={item.kondisi}
                        onChange={(e) =>
                          setFieldValue(
                            'daftarItem',
                            current.daftarItem.map((row) =>
                              row.id === item.id
                                ? {
                                    ...row,
                                    kondisi: e.target.value as HandoverItemCondition,
                                  }
                                : row
                            )
                          )
                        }
                      >
                        {HANDOVER_ITEM_CONDITIONS.map((cond) => (
                          <option key={cond} value={cond}>
                            {cond}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>

                  <div className="sm:col-span-8">
                    <FormField id={`bast-note-${item.id}`} label="Catatan Lapangan">
                      <Input
                        id={`bast-note-${item.id}`}
                        disabled={readOnly}
                        placeholder="Engsel rata, laci halus, sealant rapi"
                        value={item.catatan}
                        onChange={(e) =>
                          setFieldValue(
                            'daftarItem',
                            current.daftarItem.map((row) =>
                              row.id === item.id ? { ...row, catatan: e.target.value } : row
                            )
                          )
                        }
                      />
                    </FormField>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: 'pernyataan-saksi',
        title: 'Pernyataan Berita Acara, Tindak Lanjut & Saksi',
        columns: 2,
        fields: [
          {
            name: 'teksPernyataan',
            label: 'Naskah Pernyataan Serah Terima',
            type: 'textarea',
            rows: 3,
            colSpan: 'full',
          },
          {
            name: 'catatanTindakLanjut',
            label: 'Catatan Tindak Lanjut / Retensi',
            type: 'textarea',
            rows: 2,
            colSpan: 'full',
          },
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
    [values.daftarItem.length, workOrders, agreements, selectedSpkId, selectedSpksId]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validateHandoverDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = normalizeHandoverPayload(values);
    upsertHandoverCertificate(payload);
    recordActivity(
      isEditMode
        ? 'Memperbarui Berita Acara Serah Terima'
        : 'Membuat Berita Acara Serah Terima baru',
      'Dokumen BAST',
      payload.nomorBast
    );

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: isEditMode
            ? `Perubahan BAST ${payload.nomorBast} berhasil disimpan.`
            : `Berita Acara Serah Terima ${payload.nomorBast} telah diterbitkan.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={
        isEditMode && existingDoc
          ? `Ubah ${existingDoc.nomorBast}`
          : 'Buat Berita Acara Serah Terima (BAST)'
      }
      description="Susun dokumen resmi serah terima pekerjaan beserta checklist unit terpasang, kondisi QC akhir, dan masa garansi."
      backTo={BACK_PATH}
      backLabel="Kembali ke Daftar BAST"
      submitLabel={isEditMode ? 'Simpan Perubahan BAST' : 'Simpan BAST'}
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
              to={`/admin/dokumen/bast/${existingDoc.id}/pratinjau`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
            >
              <Eye className="size-3.5" aria-hidden="true" />
              Pratinjau
            </Link>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => downloadHandoverPdf(normalizeHandoverPayload(values), businessConfig)}
            >
              <FileDown className="size-3.5" aria-hidden="true" />
              Unduh PDF BAST
            </Button>
          </>
        ) : undefined
      }
      notFoundState={
        isEditMode && !existingDoc
          ? {
              title: 'Dokumen BAST Tidak Ditemukan',
              message:
                'Data Berita Acara Serah Terima yang dicari tidak tersedia atau sudah dihapus.',
            }
          : undefined
      }
      aside={
        <AdminFormSectionCard
          title="Ringkasan Serah Terima"
          description="Pratinjau parameter BAST sebelum disimpan atau diekspor PDF."
        >
          <dl className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Nomor BAST</dt>
              <dd className="font-mono font-semibold text-[var(--text)]">
                {values.nomorBast || '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Status &amp; Progres</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {values.status} · {values.persentaseSelesai}%
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Tanggal Serah Terima</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {values.tanggalSerahTerima ? formatShortDateId(values.tanggalSerahTerima) : '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Jumlah Item / Unit</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {stats.totalRows} baris · {stats.totalUnits} unit
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Lolos Baik &amp; Sesuai</dt>
              <dd className="font-semibold text-[var(--success)] tabular-nums">
                {stats.passedRows} dari {stats.totalRows} item
              </dd>
            </div>
            {stats.minorAdjustmentRows + stats.pendingRows > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[var(--text-muted)]">Perlu Penyetelan / Tertunda</dt>
                <dd className="font-semibold text-[var(--danger)] tabular-nums">
                  {stats.minorAdjustmentRows + stats.pendingRows} item
                </dd>
              </div>
            )}
            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Masa Garansi</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {values.masaGaransiBulan} bulan
              </dd>
            </div>
          </dl>
        </AdminFormSectionCard>
      }
    />
  );
}
