import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../../components/admin/admin-form';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  EXPENSE_CATEGORIES,
  FINANCE_PAYMENT_METHODS,
  formatRupiahSigned,
  formatShortDateId,
} from '../../../../lib/finance-utils';
import { buildProjectPurchaseDraft } from '../../../../lib/project-workspace';
import { canEditPage } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useFinanceStore } from '../../../../store/finance-store';
import { useProjectsStore } from '../../../../store/projects-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { FinanceTransaction } from '../../../../types/finance';
import {
  createEmptyPurchase,
  normalizePurchasePayload,
  validatePurchaseDraft,
} from './logic';

export default function AdminPembelianFormPage() {
  const { id, projectId } = useParams<{ id?: string; projectId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const transactions = useFinanceStore((state) => state.transactions);
  const invoices = useFinanceStore((state) => state.invoices);
  const upsertTransaction = useFinanceStore((state) => state.upsertTransaction);
  const projects = useProjectsStore((state) => state.projects);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, projectId ? 'proyek' : 'keuangan');

  const existingTx = useMemo(
    () => (id ? transactions.find((t) => t.id === id && t.jenis === 'pengeluaran') ?? null : null),
    [id, transactions]
  );

  const isEditMode = Boolean(id);
  const initialProjectRef = searchParams.get('projectRef') ?? '';
  const resolvedProjectId = projectId ?? existingTx?.projectId;
  const project = useMemo(
    () => (resolvedProjectId ? projects.find((p) => p.id === resolvedProjectId) ?? null : null),
    [resolvedProjectId, projects]
  );
  const backPath = resolvedProjectId
    ? `/admin/proyek/${resolvedProjectId}?tab=keuangan`
    : '/admin/keuangan';

  const [values, setValues] = useState<FinanceTransaction>(() => {
    if (existingTx) return structuredClone(existingTx);
    if (project) {
      const projectInvoices = invoices.filter((inv) => inv.projectId === project.id);
      return buildProjectPurchaseDraft(project, { invoices: projectInvoices });
    }
    return createEmptyPurchase(initialProjectRef);
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode ? 'Ubah Catatan Pembelian' : 'Catat Pembelian Baru'} | Keuangan Admin ${shortBrandName}`
  );

  const sections = useMemo<AdminFormSectionConfig<FinanceTransaction>[]>(
    () => [
      {
        id: 'detail-belanja',
        title: 'Supplier & Proyek',
        mobileTabLabel: 'Supplier',
        columns: 2,
        fields: [
          {
            name: 'tanggal',
            label: 'Tanggal Pembelian',
            type: 'date',
            required: true,
          },
          {
            name: 'kategori',
            label: 'Kategori Pengeluaran',
            type: 'select',
            required: true,
            options: EXPENSE_CATEGORIES.map((cat) => ({ value: cat, label: cat })),
          },
          {
            name: 'judul',
            label: 'Item Pembelian / Pekerjaan',
            type: 'text',
            required: true,
            colSpan: 'full',
            placeholder: 'Contoh: 12 Lembar Multipleks + HPL',
          },
          {
            name: 'pihakTerkait',
            label: 'Nama Supplier / Toko / Vendor',
            type: 'text',
            required: true,
            placeholder: 'Contoh: TB Sumber Makmur Purwakarta',
          },
          {
            name: 'referensiProyek',
            label: 'Tautkan ke Proyek (Opsional)',
            type: 'select',
            options: [
              { value: '', label: 'Operasional Umum Workshop' },
              ...invoices.map((inv) => ({
                value: inv.nomorInvoice,
                label: `${inv.nomorInvoice} — ${inv.namaProyek}`,
              })),
            ],
          },
        ],
      },
      {
        id: 'pembayaran',
        title: 'Pembayaran',
        mobileTabLabel: 'Pembayaran',
        columns: 3,
        fields: [
          {
            name: 'nominal',
            label: 'Total Nominal (IDR)',
            type: 'currency',
            required: true,
            zeroAsEmpty: true,
            placeholder: '0',
          },
          {
            name: 'metodePembayaran',
            label: 'Metode Bayar',
            type: 'select',
            options: FINANCE_PAYMENT_METHODS.map((m) => ({ value: m, label: m })),
          },
          {
            name: 'status',
            label: 'Status Pembayaran',
            type: 'select',
            options: [
              { value: 'Selesai', label: 'Lunas / Selesai' },
              { value: 'Tertunda', label: 'Tempo / Tertunda' },
            ],
          },
          {
            name: 'catatan',
            label: 'Catatan Nota / No. Faktur Supplier',
            type: 'textarea',
            rows: 3,
            colSpan: 'full',
            placeholder: 'Nomor nota, rincian kuantitas lembar/unit, atau jadwal jatuh tempo tempo...',
          },
        ],
      },
    ],
    [invoices]
  );

  const selectedInvoice = useMemo(
    () => invoices.find((inv) => inv.nomorInvoice === values.referensiProyek) ?? null,
    [invoices, values.referensiProyek]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validatePurchaseDraft(values);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const matchedInvoice = invoices.find((inv) => inv.nomorInvoice === values.referensiProyek);
    const payload: FinanceTransaction = {
      ...normalizePurchasePayload(values),
      projectId: values.projectId ?? resolvedProjectId ?? matchedInvoice?.projectId,
    };
    upsertTransaction(payload);
    recordActivity(
      isEditMode ? 'Memperbarui catatan pembelian' : 'Mencatat pembelian workshop baru',
      'Pembelian',
      payload.judul
    );

    navigate(backPath, {
      state: {
        feedback: {
          type: 'ok',
          text: isEditMode
            ? `Perubahan pembelian "${payload.judul}" berhasil disimpan.`
            : `Pembelian baru "${payload.judul}" telah disimpan.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={isEditMode ? 'Edit Pembelian' : 'Catat Pembelian'}
      description={
        project
          ? `Proyek: ${[project.id, project.namaProyek].filter(Boolean).join(' · ')}`
          : undefined
      }
      backTo={backPath}
      backLabel={project ? 'Kembali ke Proyek' : 'Kembali ke Keuangan'}
      submitLabel={isEditMode ? 'Simpan Perubahan' : 'Simpan Pembelian'}
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={!canEdit}
      asideTabLabel="Ringkasan"
      notFoundState={
        isEditMode && !existingTx
          ? {
              title: 'Catatan Pembelian Tidak Ditemukan',
              message:
                'Data pembelian yang Anda cari tidak tersedia atau telah dihapus dari buku kas.',
            }
          : undefined
      }
      aside={
        <AdminFormSectionCard title="Ringkasan">
          <dl className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Tanggal</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {values.tanggal ? formatShortDateId(values.tanggal) : '-'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Kategori</dt>
              <dd className="font-medium text-[var(--text)]">{values.kategori}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Status</dt>
              <dd
                className={
                  values.status === 'Selesai'
                    ? 'font-semibold text-[var(--success)]'
                    : 'font-semibold text-[var(--danger)]'
                }
              >
                {values.status === 'Selesai' ? 'Lunas / Selesai' : 'Tempo / Tertunda'}
              </dd>
            </div>
            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-3">
              <dt className="text-[var(--text-muted)]">Nominal Pengeluaran</dt>
              <dd className="text-base font-semibold text-[var(--danger)] tabular-nums">
                -{formatRupiahSigned(values.nominal || 0)}
              </dd>
            </div>
          </dl>

          {selectedInvoice ? (
            <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-1 text-xs">
              <p className="font-semibold text-[var(--text)]">Proyek Tertaut</p>
              <p className="text-[var(--text-muted)]">
                {selectedInvoice.nomorInvoice} · {selectedInvoice.namaProyek}
              </p>
              <p className="text-[var(--text-subtle)]">Klien: {selectedInvoice.namaKlien}</p>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-subtle)]">
              Dialokasikan ke biaya operasional umum workshop (tanpa proyek spesifik).
            </p>
          )}
        </AdminFormSectionCard>
      }
    />
  );
}
