import { useMemo, useState, type FormEvent } from 'react';
import { FileDown, Plus, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { CurrencyInput, Input } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { computeInvoiceProgress, formatRupiahSigned } from '../../../../lib/finance-utils';
import { downloadProjectInvoicePdf } from '../../../../lib/pdf/build-workshop-documents-pdf';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useFinanceStore } from '../../../../store/finance-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { ProjectInvoice } from '../../../../types/finance';
import {
  createEmptyInvoice,
  createEmptyInvoiceLineItem,
  normalizeInvoicePayload,
  validateInvoiceDraft,
} from './logic';

const BACK_PATH = '/admin/dokumen/invoice';

export default function AdminInvoiceFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const invoices = useFinanceStore((state) => state.invoices);
  const upsertProjectInvoice = useFinanceStore((state) => state.upsertProjectInvoice);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasPermission(currentRole, 'keuangan.edit');

  const isEditMode = Boolean(id);
  const existingInvoice = useMemo(
    () => (id ? invoices.find((inv) => inv.id === id) ?? null : null),
    [id, invoices]
  );

  const [values, setValues] = useState<ProjectInvoice>(() =>
    existingInvoice ? structuredClone(existingInvoice) : createEmptyInvoice(invoices.length + 45)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode && existingInvoice ? `Ubah ${existingInvoice.nomorInvoice}` : 'Buat Tagihan Proyek'} | Dokumen Admin ${businessConfig.namaMerekSingkat}`
  );

  const lineItems = values.rincianItem ?? [];
  const lineItemsTotal = lineItems.reduce(
    (sum, item) => sum + Math.max(1, item.jumlah || 1) * Math.max(0, item.hargaSatuan || 0),
    0
  );

  const sections = useMemo<AdminFormSectionConfig<ProjectInvoice>[]>(
    () => [
      {
        id: 'identitas-invoice',
        title: 'Identitas Tagihan & Proyek',
        description:
          'Tetapkan nomor invoice, nama proyek, klien, dan total nilai kontrak untuk memantau DP serta pelunasan.',
        columns: 2,
        fields: [
          {
            name: 'nomorInvoice',
            label: 'Nomor Invoice',
            type: 'text',
            required: true,
          },
          {
            name: 'tanggalJatuhTempo',
            label: 'Target Jatuh Tempo',
            type: 'date',
            required: true,
          },
          {
            name: 'namaProyek',
            label: 'Nama Proyek',
            type: 'text',
            required: true,
            colSpan: 'full',
            placeholder: 'Contoh: Kitchen Set HPL Matte & Pantry Area',
          },
          {
            name: 'namaKlien',
            label: 'Nama Klien',
            type: 'text',
            required: true,
          },
          {
            name: 'lokasi',
            label: 'Lokasi Pemasangan',
            type: 'text',
            placeholder: 'Purwakarta / Karawang / Bandung',
          },
          {
            name: 'nilaiTotalKontrak',
            label: 'Nilai Kontrak (IDR)',
            type: 'currency',
            required: true,
            zeroAsEmpty: true,
          },
        ],
      },
      {
        id: 'rincian-item',
        title: `Rincian Item Invoice (${lineItems.length})`,
        description: 'Opsional untuk ditampilkan dalam rincian tabel PDF Invoice resmi.',
        headerAction: ({ readOnly, setFieldValue, values: current }) =>
          !readOnly ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setFieldValue('rincianItem', [
                  ...(current.rincianItem ?? []),
                  createEmptyInvoiceLineItem(),
                ])
              }
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Tambah Item
            </Button>
          ) : null,
        renderContent: ({ values: current, setFieldValue, readOnly }) => {
          const items = current.rincianItem ?? [];
          if (items.length === 0) {
            return (
              <p className="text-xs text-[var(--text-muted)]">
                Belum ada rincian item tambahan. Klik &ldquo;Tambah Item&rdquo; jika ingin
                mencantumkan uraian harga satuan di PDF Invoice.
              </p>
            );
          }

          return (
            <div className="space-y-2.5">
              {items.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 sm:col-span-6">
                    <Input
                      aria-label={`Deskripsi item ${idx + 1}`}
                      disabled={readOnly}
                      placeholder="Deskripsi pekerjaan/unit"
                      value={item.deskripsi}
                      onChange={(e) =>
                        setFieldValue(
                          'rincianItem',
                          items.map((row) =>
                            row.id === item.id ? { ...row, deskripsi: e.target.value } : row
                          )
                        )
                      }
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      aria-label={`Jumlah item ${idx + 1}`}
                      type="number"
                      min={1}
                      disabled={readOnly}
                      value={item.jumlah}
                      onChange={(e) =>
                        setFieldValue(
                          'rincianItem',
                          items.map((row) =>
                            row.id === item.id
                              ? { ...row, jumlah: Number(e.target.value) || 1 }
                              : row
                          )
                        )
                      }
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <CurrencyInput
                      aria-label={`Harga satuan item ${idx + 1}`}
                      disabled={readOnly}
                      zeroAsEmpty
                      placeholder="0"
                      value={item.hargaSatuan}
                      onValueChange={(nextPrice) =>
                        setFieldValue(
                          'rincianItem',
                          items.map((row) =>
                            row.id === item.id
                              ? { ...row, hargaSatuan: nextPrice }
                              : row
                          )
                        )
                      }
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    {!readOnly && (
                      <button
                        type="button"
                        aria-label={`Hapus item ${idx + 1}`}
                        onClick={() =>
                          setFieldValue(
                            'rincianItem',
                            items.filter((r) => r.id !== item.id)
                          )
                        }
                        className="p-2 text-[var(--danger)] hover:bg-[var(--danger-surface)] rounded-[var(--radius-sm)] cursor-pointer"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {lineItemsTotal > 0 && !readOnly && (
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-[var(--text-muted)] tabular-nums">
                    Total dari rincian item: <strong className="text-[var(--text)]">{formatRupiahSigned(lineItemsTotal)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFieldValue('nilaiTotalKontrak', lineItemsTotal)}
                    className="text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    Gunakan sebagai Nilai Kontrak
                  </button>
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: 'catatan-rekening',
        title: 'Informasi Rekening & Catatan Kontrak',
        columns: 1,
        fields: [
          {
            name: 'catatanRekening',
            label: 'Catatan Rekening Bank Transfer (Opsional)',
            type: 'text',
            placeholder: 'Contoh: BCA 1234567890 a.n. Hilman Aziz Napis',
          },
          {
            name: 'catatan',
            label: 'Catatan Kontrak',
            type: 'textarea',
            rows: 3,
          },
        ],
      },
    ],
    [lineItems.length, lineItemsTotal]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validateInvoiceDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = normalizeInvoicePayload(values);
    upsertProjectInvoice(payload);
    recordActivity(
      isEditMode ? 'Memperbarui invoice proyek' : 'Membuat invoice proyek baru',
      'Dokumen Invoice',
      payload.nomorInvoice
    );

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: `Invoice proyek ${payload.nomorInvoice} (${payload.namaProyek}) disimpan.`,
        },
      },
    });
  };

  const progress = computeInvoiceProgress(values);

  return (
    <AdminForm
      title={
        isEditMode && existingInvoice
          ? `Ubah Tagihan ${existingInvoice.nomorInvoice}`
          : 'Buat Tagihan Proyek Baru'
      }
      description="Tetapkan nilai kontrak proyek kustom untuk memantau progres DP dan pelunasan."
      backTo={BACK_PATH}
      backLabel="Kembali ke Daftar Invoice"
      submitLabel={isEditMode ? 'Simpan Perubahan Tagihan' : 'Simpan Tagihan'}
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      extraHeaderActions={
        isEditMode && existingInvoice ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => downloadProjectInvoicePdf(normalizeInvoicePayload(values), businessConfig)}
          >
            <FileDown className="size-3.5" aria-hidden="true" />
            Unduh PDF Invoice
          </Button>
        ) : undefined
      }
      notFoundState={
        isEditMode && !existingInvoice
          ? {
              title: 'Invoice Proyek Tidak Ditemukan',
              message: 'Data tagihan proyek yang dicari tidak tersedia atau telah dihapus.',
            }
          : undefined
      }
      aside={
        <AdminFormSectionCard
          title="Ringkasan Tagihan Proyek"
          description="Status kontrak dan akumulasi pembayaran yang tercatat."
        >
          <dl className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Nomor Invoice</dt>
              <dd className="font-mono font-semibold text-[var(--text)]">
                {values.nomorInvoice || '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Nilai Kontrak</dt>
              <dd className="font-semibold text-[var(--text)] tabular-nums">
                {formatRupiahSigned(values.nilaiTotalKontrak || 0)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Sudah Terbayar</dt>
              <dd className="font-medium text-[var(--success)] tabular-nums">
                {formatRupiahSigned(progress.paidAmount)} ({progress.progressPercent}%)
              </dd>
            </div>
            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Sisa Tagihan</dt>
              <dd className="font-semibold text-[var(--danger)] tabular-nums">
                {formatRupiahSigned(progress.remainingAmount)}
              </dd>
            </div>
          </dl>
        </AdminFormSectionCard>
      }
    />
  );
}
