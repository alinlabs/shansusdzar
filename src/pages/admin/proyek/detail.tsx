import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Printer,
  Send,
  Share2,
  Trash2,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  AdminActionButton,
  AdminActionLink,
} from '../../../components/admin/admin-action-buttons';
import { LinkButton } from '../../../components/ui/button';
import {
  PopupMenu,
  Select,
  type PopupMenuItem,
} from '../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import { formatTerminDocumentNumber } from '../../../lib/document-numbering';
import {
  computeInvoiceProgress,
  formatRupiahSigned,
  formatShortDateId,
} from '../../../lib/finance-utils';
import {
  downloadProjectCsv,
  downloadProjectDocs,
  openProjectSummaryPdf,
} from '../../../lib/project-export';
import { evaluateInvoicePaymentSchedule, resolveEffectivePaymentScheme } from '../../../lib/payment-scheme';
import {
  downloadAgreementPdf,
  downloadDeliveryOrderPdf,
  downloadHandoverPdf,
  downloadProjectInvoicePdf,
  downloadQuotationPdf,
  downloadTerminInvoicePdf,
} from '../../../lib/pdf/build-workshop-documents-pdf';
import {
  buildAutoProjectDocuments,
  buildDocumentSendText,
  buildDocumentWhatsAppHref,
  formatTerminSummaryLine,
} from '../../../lib/project-documents-auto';
import {
  DEFAULT_CATALOG_PRODUCTS,
  computeProjectProductSubtotal,
  resolveProjectProductName,
} from '../../../lib/project-products';
import {
  PROJECT_STATUSES,
  buildProjectJournalEntries,
  buildProjectWorkspaceData,
  formatClientNameWithCode,
  formatProjectHeaderClientMeta,
} from '../../../lib/project-workspace';
import { canEditPage } from '../../../lib/rbac';
import { useAdminAuthStore } from '../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../store/documents-store';
import { useFinanceStore } from '../../../store/finance-store';
import { useProjectsStore } from '../../../store/projects-store';
import { useSiteContentStore } from '../../../store/site-content-store';
import type {
  FinanceTransaction,
  WorkshopProjectStatus,
} from '../../../types/finance';
import { computeQuotationTotal } from '../dokumen/penawaran/logic';
import { computeDeliveryOrderStats } from '../dokumen/surat-jalan/logic';
import { AdminMobileBottomAction, AdminPageHeader } from '../admin-shell';

const TERMIN_DOC_GUIDES = [
  {
    title: 'Surat Tagihan Termin 1',
    timing: 'Diterbitkan setelah Surat Penawaran disetujui dan SPK ditandatangani.',
    purpose: 'Mengamankan komitmen klien serta membiayai material utama dan gambar kerja (shop drawing).',
  },
  {
    title: 'Surat Tagihan Termin 2',
    timing: 'Diterbitkan saat progres workshop mencapai ±50%–70% rangka dan komponen.',
    purpose: 'Menjaga arus kas operasional produksi dan membiayai tahap finishing di workshop.',
  },
  {
    title: 'Surat Tagihan Termin 3',
    timing: 'Diterbitkan sesaat sebelum pengiriman barang / penerbitan Surat Jalan.',
    purpose: 'Memastikan pelunasan pra-pasang sebelum furnitur terpasang permanen & biaya mobilisasi.',
  },
  {
    title: 'Surat Tagihan Termin 4',
    timing: 'Diterbitkan setelah instalasi & masa revisi selesai bersamaan dengan BAST.',
    purpose: 'Menutup keseluruhan nilai kontrak dan menjadi penyelesaian teknis serta administratif proyek.',
  },
] as const;

type WorkspaceTab = 'produk' | 'dokumen' | 'keuangan';

export default function AdminProyekDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileTerminOpen, setMobileTerminOpen] = useState(false);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(true);

  useEffect(() => {
    setMobileTerminOpen(false);
    setMobileSummaryOpen(true);
  }, [projectId]);

  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const paymentScheme = useSiteContentStore((state) => state.paymentScheme);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const catalogProducts = useMemo(() => {
    if (catalogOverride) return catalogOverride.daftarProduk;
    return loadedBaseCatalog?.daftarProduk ?? DEFAULT_CATALOG_PRODUCTS;
  }, [catalogOverride, loadedBaseCatalog]);

  const projects = useProjectsStore((state) => state.projects);
  const upsertProject = useProjectsStore((state) => state.upsertProject);

  const quotations = useDocumentsStore((state) => state.quotations);
  const agreements = useDocumentsStore((state) => state.agreements);
  const workOrders = useDocumentsStore((state) => state.workOrders);
  const deliveryOrders = useDocumentsStore((state) => state.deliveryOrders);
  const handoverCertificates = useDocumentsStore((state) => state.handoverCertificates);
  const upsertQuotation = useDocumentsStore((state) => state.upsertQuotation);
  const upsertAgreement = useDocumentsStore((state) => state.upsertAgreement);
  const upsertDeliveryOrder = useDocumentsStore((state) => state.upsertDeliveryOrder);
  const upsertHandoverCertificate = useDocumentsStore((state) => state.upsertHandoverCertificate);

  const invoices = useFinanceStore((state) => state.invoices);
  const transactions = useFinanceStore((state) => state.transactions);
  const deleteTransaction = useFinanceStore((state) => state.deleteTransaction);
  const upsertProjectInvoice = useFinanceStore((state) => state.upsertProjectInvoice);
  const setInvoiceTerminStageStatus = useFinanceStore(
    (state) => state.setInvoiceTerminStageStatus
  );

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'proyek');
  const canDelete = canEdit;

  const project = useMemo(
    () => (projectId ? projects.find((p) => p.id === projectId) ?? null : null),
    [projectId, projects]
  );

  const workspace = useMemo(
    () =>
      project
        ? buildProjectWorkspaceData(project, {
            quotations,
            agreements,
            workOrders,
            deliveryOrders,
            handoverCertificates,
            invoices,
            transactions,
            paymentScheme,
          })
        : null,
    [
      project,
      quotations,
      agreements,
      workOrders,
      deliveryOrders,
      handoverCertificates,
      invoices,
      transactions,
      paymentScheme,
    ]
  );

  const journalEntries = useMemo(
    () => (workspace ? buildProjectJournalEntries(workspace.transactions) : []),
    [workspace]
  );

  const ensuredProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!project || !workspace) return;
    if (ensuredProjectIdRef.current === project.id) return;
    ensuredProjectIdRef.current = project.id;

    const missingAny =
      workspace.quotations.length === 0 ||
      workspace.agreements.length === 0 ||
      workspace.deliveryOrders.length === 0 ||
      workspace.handoverCertificates.length === 0 ||
      workspace.invoices.length === 0;

    if (!missingAny) return;

    const bundle = buildAutoProjectDocuments(
      project,
      businessConfig,
      paymentScheme,
      workspace.invoices[0]
    );
    if (workspace.quotations.length === 0) upsertQuotation(bundle.quotation);
    if (workspace.agreements.length === 0) upsertAgreement(bundle.agreement);
    if (workspace.deliveryOrders.length === 0) upsertDeliveryOrder(bundle.deliveryOrder);
    if (workspace.handoverCertificates.length === 0) {
      upsertHandoverCertificate(bundle.handoverCertificate);
    }
    if (workspace.invoices.length === 0) upsertProjectInvoice(bundle.invoice);
  }, [
    project,
    workspace,
    businessConfig,
    paymentScheme,
    upsertQuotation,
    upsertAgreement,
    upsertDeliveryOrder,
    upsertHandoverCertificate,
    upsertProjectInvoice,
  ]);

  const rawTab = searchParams.get('tab');
  const activeTab: WorkspaceTab =
    rawTab === 'keuangan' ? 'keuangan' : rawTab === 'dokumen' ? 'dokumen' : 'produk';

  const projectDisplayCode = project
    ? [project.id, project.namaProyek].filter(Boolean).join(' · ')
    : 'Proyek Tidak Ditemukan';

  useDocumentTitle(`${projectDisplayCode} | Admin ${businessConfig.namaMerek}`);

  const switchTab = (tab: WorkspaceTab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
      },
      { replace: true }
    );
  };

  if (!project || !workspace) {
    return (
      <div className="space-y-5">
        <AdminPageHeader
          title="Proyek Tidak Ditemukan"
          backTo="/admin/proyek"
          backLabel="Kembali ke Daftar Proyek"
        />
        <div className="p-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-2">
          <p className="text-sm font-semibold text-[var(--text)]">Data proyek tidak tersedia</p>
          <p className="text-xs text-[var(--text-muted)]">
            Proyek yang Anda pilih tidak ditemukan atau telah dihapus.
          </p>
        </div>
      </div>
    );
  }

  const { summary, paymentSchedule, primaryInvoice } = workspace;

  const handleProjectStatusChange = (nextStatus: WorkshopProjectStatus) => {
    if (!canEdit) return;
    upsertProject({ ...project, status: nextStatus });
    recordActivity(
      'Mengubah status proyek',
      'Proyek',
      `${projectDisplayCode}: ${nextStatus}`
    );
  };

  const handleExportProjectDocs = () => {
    downloadProjectDocs(workspace, businessConfig);
    recordActivity('Mengekspor laporan proyek Docs', 'Proyek', projectDisplayCode);
  };

  const handleExportProjectCsv = () => {
    downloadProjectCsv(workspace);
    recordActivity('Mengekspor data proyek CSV', 'Proyek', projectDisplayCode);
  };

  const handleExportProjectPdf = () => {
    openProjectSummaryPdf(workspace, businessConfig);
    recordActivity('Membuka pratinjau cetak PDF proyek', 'Proyek', projectDisplayCode);
  };

  const handleDeleteTransaction = (tx: FinanceTransaction) => {
    if (!canDelete) return;
    deleteTransaction(tx.id);
    recordActivity('Menghapus transaksi proyek', 'Proyek', tx.judul);
  };

  const handlePayTerminStage = (
    stageIdx: number,
    stageName: string,
    remainingAmount: number
  ) => {
    if (!canEdit || !primaryInvoice || remainingAmount <= 0) return;
    setInvoiceTerminStageStatus(primaryInvoice.id, stageIdx, 'Lunas', paymentScheme);
    recordActivity(
      'Mencatat pembayaran termin proyek',
      'Proyek',
      `${primaryInvoice.nomorInvoice} · ${stageName}`
    );
  };

  const handleCopyShareMessage = (message: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(message).catch(() => {});
    }
  };

  const renderDocumentShareMenu = (params: {
    kind: 'penawaran' | 'spks' | 'spk' | 'surat-jalan' | 'bast' | 'invoice' | 'termin';
    docNumber: string;
    detailLine?: string;
    onPrintPdf: () => void;
  }) => {
    const { kind, docNumber, detailLine, onPrintPdf } = params;
    const message = buildDocumentSendText(kind, {
      project,
      businessConfig,
      docNumber,
      detailLine,
    });
    const waHref = buildDocumentWhatsAppHref(project.teleponKlien, message);

    const menuItems: PopupMenuItem[] = [
      {
        id: `${docNumber}-print`,
        label: 'Cetak PDF',
        description: 'Buka dokumen PDF siap cetak di tab baru',
        icon: <Printer className="size-3.5" />,
        onSelect: onPrintPdf,
      },
      {
        id: `${docNumber}-whatsapp`,
        label: 'Kirim WhatsApp',
        description: waHref
          ? 'Buka WhatsApp dengan pesan siap kirim'
          : 'Salin teks pesan (nomor WA belum diisi)',
        icon: <Send className="size-3.5" />,
        ...(waHref ? { href: waHref, target: '_blank', rel: 'noopener noreferrer' } : {}),
        onSelect: () => {
          if (!waHref) {
            handleCopyShareMessage(message);
          }
        },
      },
      {
        id: `${docNumber}-copy-text`,
        label: 'Salin Teks Pesan',
        description: 'Salin ringkasan dokumen ke clipboard',
        icon: <Copy className="size-3.5" />,
        onSelect: () => handleCopyShareMessage(message),
      },
    ];

    return (
      <PopupMenu
        label={`Bagikan atau cetak ${docNumber}`}
        headerTitle={docNumber}
        align="end"
        minWidth={230}
        items={menuItems}
        trigger={({ toggle, triggerProps }) => (
          <AdminActionButton
            icon={<Share2 className="size-3.5" />}
            label={`Bagikan atau cetak ${docNumber}`}
            iconOnly
            onClick={toggle}
            {...triggerProps}
          />
        )}
      />
    );
  };

  const headerClientTitle = formatClientNameWithCode(
    project.namaKlien,
    project.id
  );
  const headerClientSubtitle = formatProjectHeaderClientMeta(project);

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title={headerClientTitle}
        subtitle={headerClientSubtitle}
        description={headerClientSubtitle}
        backTo="/admin/proyek"
        backLabel="Kembali ke Daftar Proyek"
        actions={
          <>
            <div className="hidden sm:flex items-center">
              {canEdit ? (
                <Select
                  aria-label="Status proyek"
                  value={project.status}
                  onChange={(e) => handleProjectStatusChange(e.target.value as WorkshopProjectStatus)}
                  className="w-auto h-8 text-xs px-2.5 gap-2"
                >
                  {PROJECT_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      Tahap: {st}
                    </option>
                  ))}
                </Select>
              ) : (
                <span className="inline-flex items-center h-8 px-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)]">
                  Tahap: {project.status}
                </span>
              )}
            </div>
            <PopupMenu
              label="Unduh atau cetak ringkasan proyek"
              headerTitle="Ekspor Proyek"
              align="end"
              minWidth={220}
              items={[
                {
                  id: 'export-docs',
                  label: 'Docs',
                  description: 'Unduh laporan proyek format dokumen (.doc)',
                  icon: <FileText className="size-3.5" />,
                  onSelect: handleExportProjectDocs,
                },
                {
                  id: 'export-csv',
                  label: 'CSV',
                  description: 'Unduh rekap & transaksi proyek (.csv)',
                  icon: <FileSpreadsheet className="size-3.5" />,
                  onSelect: handleExportProjectCsv,
                },
                {
                  id: 'export-pdf',
                  label: 'PDF',
                  description: 'Buka pratinjau cetak PDF di tab baru',
                  icon: <Printer className="size-3.5" />,
                  onSelect: handleExportProjectPdf,
                },
              ]}
              trigger={({ toggle, triggerProps }) => (
                <AdminActionButton
                  icon={<Download className="size-3.5" />}
                  label="Unduh ringkasan proyek"
                  iconOnly
                  onClick={toggle}
                  {...triggerProps}
                />
              )}
            />
            {canEdit && (
              <AdminActionLink
                to={`/admin/proyek/${project.id}/edit`}
                icon={<Pencil className="size-3.5" />}
                label="Edit Proyek"
                iconOnly
              />
            )}
          </>
        }
      />

      {/* Project Header Card */}
      <section className="p-4 sm:p-5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-col gap-3.5">
        {/* Project Name centered above status select (mobile) and schedule cards */}
        <h2 className="text-base sm:text-lg font-bold tracking-tight text-[var(--text)] text-center leading-snug">
          {project.namaProyek}
        </h2>

        <div
          id="project-summary-metrics"
          className={
            mobileSummaryOpen
              ? 'flex flex-col gap-3.5'
              : 'hidden sm:flex sm:flex-col sm:gap-3.5'
          }
        >
          <div className="sm:hidden">
            {canEdit ? (
              <Select
                aria-label="Status proyek"
                value={project.status}
                onChange={(e) => handleProjectStatusChange(e.target.value as WorkshopProjectStatus)}
                className="w-full text-xs px-3"
              >
                {PROJECT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    Tahap: {st}
                  </option>
                ))}
              </Select>
            ) : (
              <span className="text-xs font-semibold text-[var(--text)]">
                Tahap: {project.status}
              </span>
            )}
          </div>

          {/* 2 Side-by-Side Schedule Cards (Tanggal Mulai & Target Selesai) */}
          <dl className="grid grid-cols-2 gap-2.5 tabular-nums text-center">
            <div className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] min-w-0">
              <dt className="text-[11px] text-[var(--text-muted)] truncate">
                Tanggal Mulai
              </dt>
              <dd className="mt-0.5 text-xs font-semibold text-[var(--text)] truncate">
                {formatShortDateId(project.tanggalMulai)}
              </dd>
            </div>
            <div className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] min-w-0">
              <dt className="text-[11px] text-[var(--text-muted)] truncate">
                Target Selesai
              </dt>
              <dd className="mt-0.5 text-xs font-semibold text-[var(--text)] truncate">
                {formatShortDateId(project.tanggalTargetSelesai)}
              </dd>
            </div>
          </dl>

          {/* 4 Financial KPI Grid */}
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-center">
            <div className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] min-w-0">
              <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
                Nilai Kontrak
              </dt>
              <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--text)] tabular-nums truncate">
                {formatRupiahSigned(summary.contractValue)}
              </dd>
            </div>
            <div className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] min-w-0">
              <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
                Pemasukan Proyek ({summary.progressPercent}%)
              </dt>
              <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--success)] tabular-nums truncate">
                {formatRupiahSigned(summary.paidAmount)}
              </dd>
            </div>
            <div className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] min-w-0">
              <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
                Belanja &amp; Biaya
              </dt>
              <dd className="mt-0.5 text-sm sm:text-base font-semibold text-[var(--danger)] tabular-nums truncate">
                {formatRupiahSigned(summary.expenseTotal)}
              </dd>
            </div>
            <div className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] min-w-0">
              <dt className="text-[11px] font-medium text-[var(--text-muted)] truncate">
                Margin Proyek
              </dt>
              <dd
                className={[
                  'mt-0.5 text-sm sm:text-base font-semibold tabular-nums truncate',
                  summary.netMargin >= 0 ? 'text-[var(--text)]' : 'text-[var(--danger)]',
                ].join(' ')}
              >
                {formatRupiahSigned(summary.netMargin)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="sm:hidden flex justify-center">
          <button
            type="button"
            aria-expanded={mobileSummaryOpen}
            aria-controls="project-summary-metrics"
            onClick={() => setMobileSummaryOpen((prev) => !prev)}
            data-testid="mobile-summary-toggle-btn"
            className="inline-flex items-center justify-center gap-1.5 py-1 px-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] bg-transparent border-0 transition-colors cursor-pointer"
          >
            <span>{mobileSummaryOpen ? 'Tutup Ringkasan' : 'Lihat Ringkasan'}</span>
            {mobileSummaryOpen ? (
              <ChevronUp className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
            )}
          </button>
        </div>
      </section>

      {/* Workspace Feature Tabs: Produk, Dokumen & Keuangan */}
      <div
        role="tablist"
        aria-label="Fitur proyek"
        className="w-full grid grid-cols-3 border-b border-[var(--border)]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'produk'}
          onClick={() => switchTab('produk')}
          className={[
            'w-full py-3 px-4 -mb-px border-b-2 text-center text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap',
            activeTab === 'produk'
              ? 'border-[var(--accent)] text-[var(--text)] font-semibold'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] font-medium',
          ].join(' ')}
        >
          Produk ({project.daftarProduk?.length ?? 0})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'dokumen'}
          onClick={() => switchTab('dokumen')}
          className={[
            'w-full py-3 px-4 -mb-px border-b-2 text-center text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap',
            activeTab === 'dokumen'
              ? 'border-[var(--accent)] text-[var(--text)] font-semibold'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] font-medium',
          ].join(' ')}
        >
          Dokumen ({summary.documentCount})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'keuangan'}
          onClick={() => switchTab('keuangan')}
          className={[
            'w-full py-3 px-4 -mb-px border-b-2 text-center text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap',
            activeTab === 'keuangan'
              ? 'border-[var(--accent)] text-[var(--text)] font-semibold'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] font-medium',
          ].join(' ')}
        >
          Keuangan ({summary.financeCount})
        </button>
      </div>

      {/* TAB 1: PRODUK PROYEK */}
      {activeTab === 'produk' && (
        <div role="tabpanel" aria-label="Produk proyek">
          {!project.daftarProduk || project.daftarProduk.length === 0 ? (
            <p className="p-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] text-xs text-[var(--text-muted)]">
              Belum ada rincian produk pada proyek ini.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {project.daftarProduk.map((item, idx) => {
                const productName =
                  resolveProjectProductName(item, catalogProducts) || 'Item Produk';
                const rowSubtotal = computeProjectProductSubtotal(item);
                const paidAddons = (item.tambahan ?? []).filter((a) => (a.biaya || 0) > 0);
                const metaLine = [
                  item.dimensi ? `${item.dimensi} cm` : '',
                  `${item.jumlah} ${item.satuan?.trim() || 'Unit'}`,
                  item.kodeWarna?.trim() ? `Kode Warna ${item.kodeWarna.trim()}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <article
                    key={`prod-${idx}`}
                    className="p-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-bold text-[var(--text)]">{productName}</p>
                          {metaLine && (
                            <p className="text-xs text-[var(--text-muted)] tabular-nums">
                              {metaLine}
                            </p>
                          )}
                        </div>
                        <p className="shrink-0 text-sm font-bold text-[var(--text)] tabular-nums">
                          {formatRupiahSigned(rowSubtotal)}
                        </p>
                      </div>

                      {item.spesifikasiMaterial && (
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                          {item.spesifikasiMaterial}
                        </p>
                      )}
                    </div>

                    {paidAddons.length > 0 && (
                      <div className="pt-2.5 border-t border-[var(--border)] text-xs text-[var(--text-muted)] tabular-nums">
                        Tambahan berbayar:{' '}
                        {paidAddons
                          .map((a) => `${a.jenis} (${formatRupiahSigned(a.biaya)})`)
                          .join(', ')}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DOKUMEN PROYEK */}
      {activeTab === 'dokumen' && (
        <div role="tabpanel" aria-label="Dokumen proyek" className="space-y-6">
          {/* 1. DOKUMEN ADMINISTRASI PROYEK */}
          <section className="space-y-3.5" aria-labelledby="doc-group-administrasi">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3
                id="doc-group-administrasi"
                className="text-sm font-semibold text-[var(--text)]"
              >
                Dokumen Administrasi Proyek
              </h3>
              {canEdit &&
                (workspace.quotations.length === 0 ||
                  workspace.deliveryOrders.length === 0 ||
                  workspace.handoverCertificates.length === 0) && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {workspace.quotations.length === 0 && (
                      <AdminActionLink
                        to={`/admin/proyek/${project.id}/dokumen/penawaran/baru`}
                        icon={<Plus className="size-3.5" />}
                        label="Buat Penawaran"
                        mobileLabel="Penawaran"
                        hideLabelOnMobile={false}
                      />
                    )}
                    {workspace.deliveryOrders.length === 0 && (
                      <AdminActionLink
                        to={`/admin/proyek/${project.id}/dokumen/surat-jalan/baru`}
                        icon={<Plus className="size-3.5" />}
                        label="Buat Surat Jalan"
                        mobileLabel="Surat Jalan"
                        hideLabelOnMobile={false}
                      />
                    )}
                    {workspace.handoverCertificates.length === 0 && (
                      <AdminActionLink
                        to={`/admin/proyek/${project.id}/dokumen/bast/baru`}
                        icon={<Plus className="size-3.5" />}
                        label="Buat BAST"
                        mobileLabel="BAST"
                        hideLabelOnMobile={false}
                      />
                    )}
                  </div>
                )}
            </div>

            {workspace.quotations.length === 0 &&
            workspace.agreements.length === 0 &&
            workspace.deliveryOrders.length === 0 &&
            workspace.handoverCertificates.length === 0 ? (
              <p className="p-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] text-xs text-[var(--text-muted)]">
                Belum ada dokumen administrasi (Surat Penawaran, SPK, Surat Jalan, atau BAST) untuk proyek ini.
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {workspace.quotations.map((doc) => {
                  const totalBoq = computeQuotationTotal(doc.daftarItem);
                  return (
                    <article
                      key={doc.id}
                      className="p-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-[175px] flex-1 space-y-0.5">
                        <p className="text-sm font-bold text-[var(--text)]">Surat Penawaran</p>
                        <p className="text-xs text-[var(--text-muted)] tabular-nums">
                          {formatShortDateId(doc.tanggalPenawaran || doc.berlakuHingga)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {renderDocumentShareMenu({
                          kind: 'penawaran',
                          docNumber: doc.nomorPenawaran,
                          detailLine: `Estimasi ${formatRupiahSigned(totalBoq)}, berlaku s.d. ${formatShortDateId(doc.berlakuHingga)}`,
                          onPrintPdf: () =>
                            downloadQuotationPdf(
                              doc,
                              businessConfig,
                              paymentScheme,
                              workspace.project
                            ),
                        })}
                      </div>
                    </article>
                  );
                })}

                {workspace.agreements.map((doc) => (
                  <article
                    key={doc.id}
                    className="p-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-[175px] flex-1 space-y-0.5">
                      <p className="text-sm font-bold text-[var(--text)]">
                        Surat Perjanjian Kerja
                      </p>
                      <p className="text-xs text-[var(--text-muted)] tabular-nums">
                        {formatShortDateId(doc.tanggalPenandatanganan)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {renderDocumentShareMenu({
                        kind: 'spks',
                        docNumber: doc.nomorKontrak,
                        detailLine: `Nilai kontrak ${formatRupiahSigned(doc.nilaiKontrak)}, durasi ${doc.durasiKerjaHari} hari kerja, garansi ${doc.masaGaransiBulan} bulan`,
                        onPrintPdf: () =>
                          downloadAgreementPdf(doc, businessConfig, paymentScheme, workspace.project),
                      })}
                    </div>
                  </article>
                ))}

                {workspace.deliveryOrders.map((doc) => {
                  const sjStats = computeDeliveryOrderStats(doc.daftarItem);
                  return (
                    <article
                      key={doc.id}
                      className="p-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-[175px] flex-1 space-y-0.5">
                        <p className="text-sm font-bold text-[var(--text)]">Surat Jalan</p>
                        <p className="text-xs text-[var(--text-muted)] tabular-nums">
                          {formatShortDateId(doc.tanggalKirim)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {renderDocumentShareMenu({
                          kind: 'surat-jalan',
                          docNumber: doc.nomorSuratJalan,
                          detailLine: `${sjStats.totalUnits} unit, jadwal kirim ${formatShortDateId(doc.tanggalKirim)}`,
                          onPrintPdf: () =>
                            downloadDeliveryOrderPdf(doc, businessConfig, workspace.project),
                        })}
                      </div>
                    </article>
                  );
                })}

                {workspace.handoverCertificates.map((doc) => (
                  <article
                    key={doc.id}
                    className="p-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-[175px] flex-1 space-y-0.5">
                      <p className="text-sm font-bold text-[var(--text)]">
                        Berita Acara Serah Terima
                      </p>
                      <p className="text-xs text-[var(--text-muted)] tabular-nums">
                        {formatShortDateId(doc.tanggalSerahTerima)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {renderDocumentShareMenu({
                        kind: 'bast',
                        docNumber: doc.nomorBast,
                        detailLine: `Progres ${doc.persentaseSelesai}%, garansi pemeliharaan ${doc.masaGaransiBulan} bulan`,
                        onPrintPdf: () =>
                          downloadHandoverPdf(
                            doc,
                            businessConfig,
                            paymentScheme,
                            workspace.invoices[0] ?? null,
                            workspace.project
                          ),
                      })}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* 2. DOKUMEN KEUANGAN PROYEK */}
          <section className="space-y-3.5" aria-labelledby="doc-group-keuangan">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3
                id="doc-group-keuangan"
                className="text-sm font-semibold text-[var(--text)]"
              >
                Dokumen Keuangan Proyek
              </h3>
              {canEdit && workspace.invoices.length === 0 && (
                <div className="shrink-0">
                  <AdminActionLink
                    to={`/admin/proyek/${project.id}/dokumen/invoice/baru`}
                    icon={<Plus className="size-3.5" />}
                    label="Buat Invoice Induk"
                    mobileLabel="Invoice"
                    hideLabelOnMobile={false}
                  />
                </div>
              )}
            </div>

            {workspace.invoices.length === 0 ? (
              <div className="p-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Belum ada Invoice induk untuk menerbitkan Surat Tagihan Termin 1–4 pada proyek ini.
                </p>
                {canEdit && (
                  <AdminActionLink
                    to={`/admin/proyek/${project.id}/dokumen/invoice/baru`}
                    variant="primary"
                    icon={<Plus className="size-3.5" />}
                    label="Buat Invoice Sekarang"
                    hideLabelOnMobile={false}
                  />
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {workspace.invoices.map((inv) => {
                  const effectiveInvScheme = resolveEffectivePaymentScheme(
                    inv.skemaPembayaran,
                    paymentScheme
                  );
                  const invSchedule = evaluateInvoicePaymentSchedule(
                    inv.nilaiTotalKontrak,
                    inv.riwayatPembayaran,
                    effectiveInvScheme
                  );
                  const linkedRefs = {
                    quotationNumber: workspace.quotations[0]?.nomorPenawaran,
                    deliveryOrderNumber: workspace.deliveryOrders[0]?.nomorSuratJalan,
                    handoverNumber:
                      inv.nomorBastReferensi || workspace.handoverCertificates[0]?.nomorBast,
                  };

                  const invProgress = computeInvoiceProgress(inv);
                  const isMasterPaid =
                    inv.status === 'Lunas' ||
                    (inv.nilaiTotalKontrak > 0 && invProgress.paidAmount >= inv.nilaiTotalKontrak);
                  const isMasterPartial = !isMasterPaid && invProgress.paidAmount > 0;
                  const masterStatusLabel = isMasterPaid
                    ? 'Lunas'
                    : isMasterPartial
                      ? `Berjalan (${invProgress.progressPercent}%)`
                      : 'Belum Dibayarkan';

                  const masterBadgeClass =
                    'inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] bg-emerald-600 text-white font-semibold tabular-nums';
                  const masterMutedTextClass =
                    'font-normal text-[var(--text-muted)] tabular-nums';

                  return (
                    <div key={inv.id} className="space-y-3.5">
                      {/* Compact Master Invoice Summary Bar */}
                      <div className="px-4 py-3 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-0.5">
                          {!isMasterPaid && (
                            <p className={`sm:hidden text-[11px] ${masterMutedTextClass}`}>
                              {masterStatusLabel}
                            </p>
                          )}
                          <p className="text-sm font-bold text-[var(--text)]">Invoice Induk</p>
                          <p className="text-xs text-[var(--text-muted)] tabular-nums">
                            {formatShortDateId(inv.tanggalJatuhTempo)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isMasterPaid ? (
                            <span className={`${masterBadgeClass} text-[11px] sm:text-xs`}>
                              {masterStatusLabel}
                            </span>
                          ) : (
                            <span className={`hidden sm:inline text-xs px-1 ${masterMutedTextClass}`}>
                              {masterStatusLabel}
                            </span>
                          )}
                          {renderDocumentShareMenu({
                            kind: 'invoice',
                            docNumber: inv.nomorInvoice,
                            detailLine: `Nilai kontrak ${formatRupiahSigned(inv.nilaiTotalKontrak)}, terbayar ${invProgress.progressPercent}% (${formatRupiahSigned(invProgress.paidAmount)}), jatuh tempo ${formatShortDateId(inv.tanggalJatuhTempo)}`,
                            onPrintPdf: () =>
                              downloadProjectInvoicePdf(
                                inv,
                                businessConfig,
                                paymentScheme,
                                workspace.project
                              ),
                          })}
                        </div>
                      </div>

                      {/* 4 Separate Termin Cards */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                        {invSchedule.stages.map((stage, stageIdx) => {
                          const guide = TERMIN_DOC_GUIDES[stageIdx];
                          const terminDocNumber = formatTerminDocumentNumber(
                            inv.nomorInvoice,
                            stageIdx
                          );
                          const title =
                            guide?.title ??
                            `Surat Tagihan ${stage.nama.replace(/\s*\([^)]*\)/g, '').trim()}`;
                          const terminSummaryLine = formatTerminSummaryLine(
                            inv,
                            stageIdx,
                            effectiveInvScheme
                          );
                          const matchedPayment = inv.riwayatPembayaran.find((p) =>
                            p.label.toLowerCase().includes(`termin ${stageIdx + 1}`)
                          );
                          const terminDate =
                            matchedPayment?.tanggal ||
                            inv.tanggalTermin?.[stageIdx] ||
                            inv.tanggalJatuhTempo;
                          const isTerminPaid = stage.status === 'Lunas';
                          const terminStatusLabel =
                            stage.status === 'Belum Dibayar'
                              ? 'Belum Dibayarkan'
                              : stage.status === 'Sebagian'
                                ? `Sebagian (${stage.progressPercent}%)`
                                : stage.status;

                          return (
                            <article
                              key={stage.id}
                              className="p-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                {!isTerminPaid && (
                                  <p className={`sm:hidden text-[11px] ${masterMutedTextClass}`}>
                                    {terminStatusLabel}
                                  </p>
                                )}
                                <p className="text-sm font-bold text-[var(--text)]">{title}</p>
                                <p className="text-xs text-[var(--text-muted)] tabular-nums">
                                  {formatShortDateId(terminDate)}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {isTerminPaid ? (
                                  <span className={`${masterBadgeClass} text-[11px] sm:text-xs`}>
                                    {terminStatusLabel}
                                  </span>
                                ) : (
                                  <span
                                    className={`hidden sm:inline text-xs px-1 ${masterMutedTextClass}`}
                                  >
                                    {terminStatusLabel}
                                  </span>
                                )}
                                {renderDocumentShareMenu({
                                  kind: 'termin',
                                  docNumber: terminDocNumber,
                                  detailLine: terminSummaryLine,
                                  onPrintPdf: () =>
                                    downloadTerminInvoicePdf(
                                      inv,
                                      stageIdx,
                                      businessConfig,
                                      paymentScheme,
                                      linkedRefs
                                    ),
                                })}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: KEUANGAN PROYEK */}
      {activeTab === 'keuangan' && (
        <div role="tabpanel" aria-label="Keuangan proyek" className="space-y-5">
          {/* Termin Schedule Progress Cards (Unwrapped section, individual card per termin) */}
          <section
            className={mobileTerminOpen ? 'space-y-3' : 'sm:space-y-3'}
            aria-labelledby="termin-progress-heading"
          >
            <div className="flex items-center justify-between gap-2">
              <h3
                id="termin-progress-heading"
                className="text-sm font-semibold text-[var(--text)]"
              >
                Transaksi Cepat
              </h3>
              <span className="hidden sm:inline text-xs text-[var(--text-muted)] tabular-nums">
                Sisa tagihan: {formatRupiahSigned(summary.remainingBill)}
              </span>
              <button
                type="button"
                aria-expanded={mobileTerminOpen}
                aria-controls="termin-progress-cards"
                aria-label={
                  mobileTerminOpen
                    ? 'Sembunyikan transaksi cepat'
                    : 'Tampilkan transaksi cepat'
                }
                onClick={() => setMobileTerminOpen((prev) => !prev)}
                className="sm:hidden inline-flex items-center justify-center size-8 -mr-1.5 bg-transparent border-0 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer shrink-0"
              >
                <ChevronDown
                  className={[
                    'size-4 transition-transform duration-150 ease-[var(--ease-studio)]',
                    mobileTerminOpen ? 'rotate-180 text-[var(--text)]' : '',
                  ].join(' ')}
                  aria-hidden="true"
                />
              </button>
            </div>

            <div
              id="termin-progress-cards"
              className={[
                mobileTerminOpen ? 'grid grid-cols-1' : 'hidden sm:grid',
                'sm:grid-cols-2 lg:grid-cols-4 gap-3',
              ].join(' ')}
            >
              {paymentSchedule.stages.map((st, stageIdx) => {
                const isPaid = st.remainingAmount <= 0 || st.status === 'Lunas';

                return (
                  <article
                    key={st.id}
                    className="p-3.5 sm:p-4 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] flex flex-col justify-between gap-3 text-xs tabular-nums min-w-0"
                  >
                    <div className="space-y-1">
                      <p className="text-[11px] font-light text-[var(--text-muted)] leading-tight truncate">
                        {st.nama}
                      </p>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm sm:text-base font-bold text-[var(--text)] leading-tight">
                          {formatRupiahSigned(st.targetAmount)}
                        </p>
                        <span className="text-sm sm:text-base font-bold text-[var(--text)] leading-tight shrink-0">
                          {st.persentase}%
                        </span>
                      </div>
                      {st.status === 'Sebagian' && (
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Terbayar {st.progressPercent}% · Sisa{' '}
                          {formatRupiahSigned(st.remainingAmount)}
                        </p>
                      )}
                    </div>

                    {isPaid ? (
                      <button
                        type="button"
                        disabled
                        className="w-full min-h-9 sm:h-8 px-3 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-transparent bg-emerald-600 text-xs font-semibold text-white cursor-not-allowed"
                      >
                        Lunas
                      </button>
                    ) : canEdit && primaryInvoice ? (
                      <button
                        type="button"
                        onClick={() =>
                          handlePayTerminStage(stageIdx, st.nama, st.remainingAmount)
                        }
                        className="w-full min-h-9 sm:h-8 px-3 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-transparent bg-red-600 hover:bg-red-700 active:bg-red-800 text-xs font-semibold text-white transition-colors cursor-pointer"
                      >
                        Bayar
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-full min-h-9 sm:h-8 px-3 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text-muted)] cursor-not-allowed opacity-70"
                      >
                        Belum Dibayar
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          {/* Transaksi Proyek (1 Tabel Gabungan Pemasukan & Pengeluaran Urut Tanggal Terbaru) */}
          <section aria-labelledby="project-transactions-heading" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h3
                  id="project-transactions-heading"
                  className="text-sm font-semibold text-[var(--text)]"
                >
                  Transaksi Proyek ({journalEntries.length})
                </h3>
                <p className="hidden md:block text-[11px] text-[var(--text-muted)]">
                  Daftar pemasukan dan pengeluaran proyek berdasarkan tanggal terbaru.
                </p>
              </div>
              {canEdit && (
                <div className="hidden md:block shrink-0">
                  <AdminActionLink
                    to={`/admin/proyek/${project.id}/keuangan/transaksi/baru`}
                    variant="primary"
                    icon={<Plus className="size-3.5" />}
                    label="Buat Transaksi"
                    hideLabelOnMobile={false}
                  />
                </div>
              )}
            </div>

            {journalEntries.length === 0 ? (
              <div className="border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
                <p className="p-4 sm:px-5 text-xs text-[var(--text-muted)]">
                  Belum ada catatan pemasukan atau pengeluaran pada proyek ini.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Transaction Cards (Clickable to edit, inline category+nominal, unboxed delete outside right) */}
                <div className="md:hidden space-y-3" data-testid="mobile-transaction-cards">
                  {journalEntries.map(({ transaction: tx }) => {
                    const isIncome = tx.jenis === 'pemasukan';
                    const editPath = `/admin/proyek/${project.id}/keuangan/transaksi/${tx.id}/edit`;

                    return (
                      <div key={tx.id} className="flex items-center gap-2">
                        <article
                          className={[
                            'group relative min-w-0 flex-1 p-3.5 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-0.5 transition-colors',
                            canEdit
                              ? 'hover:border-[var(--border-strong)] hover:bg-[var(--surface-elevated)] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-[var(--focus)]'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-light text-[var(--text-muted)] tabular-nums leading-tight">
                              {formatShortDateId(tx.tanggal)}
                            </span>
                            <span className="text-[11px] font-light text-[var(--text-muted)] leading-tight shrink-0">
                              {tx.metodePembayaran}
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between gap-2">
                            {canEdit ? (
                              <Link
                                to={editPath}
                                aria-label={`Ubah transaksi ${tx.kategori} ${formatShortDateId(tx.tanggal)}`}
                                className="min-w-0 flex-1 text-sm font-bold text-[var(--text)] leading-tight truncate focus-visible:outline-none after:absolute after:inset-0"
                              >
                                {tx.kategori}
                              </Link>
                            ) : (
                              <p className="min-w-0 flex-1 text-sm font-bold text-[var(--text)] leading-tight truncate">
                                {tx.kategori}
                              </p>
                            )}
                            <p
                              className={[
                                'shrink-0 text-right text-sm font-bold tabular-nums leading-tight',
                                isIncome ? 'text-[var(--success)]' : 'text-[var(--danger)]',
                              ].join(' ')}
                            >
                              {formatRupiahSigned(Math.abs(tx.nominal))}
                            </p>
                          </div>
                        </article>

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTransaction(tx)}
                            aria-label={`Hapus transaksi ${tx.judul}`}
                            title={`Hapus transaksi ${tx.judul}`}
                            className="shrink-0 inline-flex items-center justify-center size-8 -mr-1 border-0 bg-transparent text-[var(--danger)] hover:opacity-75 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] rounded-[var(--radius-sm)]"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Unified Transactions Table */}
                <div className="hidden md:block border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 text-[var(--text-muted)]">
                          <th
                            scope="col"
                            aria-label="Jenis transaksi"
                            className="py-2.5 pl-4 pr-1 w-10"
                          />
                          <th className="py-2.5 px-3 font-medium whitespace-nowrap">Tanggal</th>
                          <th className="py-2.5 px-3 font-medium">Uraian &amp; Pihak Terkait</th>
                          <th className="py-2.5 px-3 font-medium whitespace-nowrap">
                            Kategori &amp; Metode
                          </th>
                          <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                            Nominal
                          </th>
                          {(canEdit || canDelete) && (
                            <th className="py-2.5 px-4 font-medium text-right whitespace-nowrap">
                              Aksi
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {journalEntries.map(({ transaction: tx }) => {
                          const isIncome = tx.jenis === 'pemasukan';
                          const editPath = `/admin/proyek/${project.id}/keuangan/transaksi/${tx.id}/edit`;

                          return (
                            <tr
                              key={tx.id}
                              className="hover:bg-[var(--surface-elevated)] align-middle"
                            >
                              <td className="py-3 pl-4 pr-1 whitespace-nowrap">
                                <span
                                  title={isIncome ? 'Pemasukan' : 'Pengeluaran'}
                                  aria-label={isIncome ? 'Pemasukan' : 'Pengeluaran'}
                                  className={[
                                    'size-7 rounded-[var(--radius-sm)] border inline-flex items-center justify-center',
                                    isIncome
                                      ? 'border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]'
                                      : 'border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]',
                                  ].join(' ')}
                                >
                                  {isIncome ? (
                                    <ArrowDownLeft className="size-3.5" aria-hidden="true" />
                                  ) : (
                                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                                  )}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                                {formatShortDateId(tx.tanggal)}
                              </td>
                              <td className="py-3 px-3 min-w-[200px]">
                                <p className="font-semibold text-[var(--text)] leading-snug">
                                  {tx.judul}
                                </p>
                                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                  {tx.pihakTerkait}
                                </p>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <p className="font-medium text-[var(--text)]">{tx.kategori}</p>
                                <p className="text-[11px] text-[var(--text-muted)]">
                                  {tx.metodePembayaran}
                                </p>
                              </td>
                              <td className="py-3 px-3 text-right whitespace-nowrap tabular-nums">
                                <span
                                  className={
                                    isIncome
                                      ? 'font-semibold text-[var(--success)]'
                                      : 'font-semibold text-[var(--danger)]'
                                  }
                                >
                                  {isIncome ? '+' : '-'}
                                  {formatRupiahSigned(tx.nominal)}
                                </span>
                              </td>
                              {(canEdit || canDelete) && (
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center justify-end gap-1.5">
                                    {canEdit && (
                                      <AdminActionLink
                                        to={editPath}
                                        icon={<Pencil className="size-3.5" />}
                                        label={`Ubah transaksi ${tx.judul}`}
                                        iconOnly
                                      />
                                    )}
                                    {canDelete && (
                                      <AdminActionButton
                                        variant="danger"
                                        icon={<Trash2 className="size-3.5" />}
                                        label={`Hapus transaksi ${tx.judul}`}
                                        iconOnly
                                        onClick={() => handleDeleteTransaction(tx)}
                                      />
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>

          {canEdit && (
            <AdminMobileBottomAction>
              <nav aria-label="Aksi transaksi proyek seluler">
                <LinkButton
                  to={`/admin/proyek/${project.id}/keuangan/transaksi/baru`}
                  variant="primary"
                  size="md"
                  fullWidth
                  data-testid="mobile-create-transaction-btn"
                >
                  Buat Transaksi
                </LinkButton>
              </nav>
            </AdminMobileBottomAction>
          )}
        </div>
      )}
    </div>
  );
}
