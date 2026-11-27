import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronDown, Minus, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { AdminActionButton } from '../../../components/admin/admin-action-buttons';
import {
  AdminForm,
  AdminFormSectionCard,
  type AdminFormSectionConfig,
} from '../../../components/admin/admin-form';
import { WilayahAddressFields } from '../../../components/admin/wilayah-address-fields';
import {
  CurrencyInput,
  DatePicker,
  DimensionInput,
  FormField,
  FormFieldStyleProvider,
  Input,
  PopupMenu,
  Select,
  Textarea,
  type PopupMenuItem,
} from '../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import {
  CLIENT_ENTITY_TYPE_OPTIONS,
  getClientNameFieldLabel,
  normalizeClientEntityType,
} from '../../../lib/agreement-identity';
import {
  formatClientCode,
  parseClientSequence,
  resolveNextClientCode,
  resolveProjectIdFromClientCode,
} from '../../../lib/document-numbering';
import { formatRupiahSigned } from '../../../lib/finance-utils';
import {
  buildAutoProjectDocuments,
  computeProjectProductsTotal,
  computeWarrantyEndDateIso,
  createEmptyProjectProductItem,
  resolveProjectDocumentDates,
  resolveProjectTechnicalDetails,
} from '../../../lib/project-documents-auto';
import {
  DEFAULT_CATALOG_PRODUCTS,
  applyCatalogProductSelection,
  buildProjectProductSpecification,
  calculateProjectProductAutoPrice,
  computeProjectProductSubtotal,
  findCatalogProduct,
  getProjectProductOptionSets,
  recalculateProjectProductItem,
  resolveProjectProductName,
} from '../../../lib/project-products';
import {
  PROJECT_STATUSES,
  buildProjectWorkspaceData,
  createEmptyWorkshopProject,
  normalizeWorkshopProjectPayload,
  validateWorkshopProjectDraft,
} from '../../../lib/project-workspace';
import { resolveProjectFormBackPath } from '../../../lib/admin-routing';
import {
  formatFullWilayahAddress,
  formatKabupatenShort,
} from '../../../lib/wilayah-indonesia';
import { canEditPage } from '../../../lib/rbac';
import { useAdminAuthStore } from '../../../store/admin-auth-store';
import { useDocumentsStore } from '../../../store/documents-store';
import { useFinanceStore } from '../../../store/finance-store';
import { useMarketingStore } from '../../../store/marketing-store';
import { useProjectsStore } from '../../../store/projects-store';
import { useSiteContentStore } from '../../../store/site-content-store';
import type { CustomInteriorPricingConfig } from '../../../types/cms';
import type {
  ProjectDocumentDates,
  ProjectProductAddonItem,
  ProjectProductItem,
  ProjectTechnicalDetails,
  WorkshopProject,
} from '../../../types/finance';
import type { ProductItem } from '../../../types/product';
import { isValidWhatsAppDigits, normalizeWhatsAppDigits } from '../marketing/database/logic';

const POPUP_TRIGGER_CLASS =
  'w-full min-w-0 h-11 px-3.5 py-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:border-[var(--border-strong)] text-left text-sm text-[var(--text)] flex items-center justify-between gap-2.5 transition-colors duration-150 disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer';

function hydrateEditableProject(
  existing: WorkshopProject | null,
  nextSeq: number,
  companyCity: string,
  nextClientCode: string,
  catalogProducts: ReadonlyArray<ProductItem>,
  siteCustomPricing?: CustomInteriorPricingConfig | null
): WorkshopProject {
  if (!existing) {
    return createEmptyWorkshopProject(nextSeq, nextClientCode);
  }
  const cloned = structuredClone(existing);
  const rawProducts =
    cloned.daftarProduk && cloned.daftarProduk.length > 0
      ? cloned.daftarProduk
      : [createEmptyProjectProductItem(1)];

  const hydratedProducts: ProjectProductItem[] = rawProducts.map((item) => {
    const matched = findCatalogProduct(item.id, catalogProducts);
    const resolvedProductId = matched?.id ?? item.id ?? '';
    const autoInfo = matched
      ? calculateProjectProductAutoPrice({
          productId: matched.id,
          dimensi: item.dimensi,
          material: item.material,
          finishing: item.finishing,
          siteCustomPricing,
          products: catalogProducts,
        })
      : null;

    const savedPrice = Math.max(0, Math.round(Number(item.hargaSatuan) || 0));
    const inferredHargaManual =
      item.hargaManual ??
      Boolean(
        matched &&
          autoInfo &&
          autoInfo.unitPrice > 0 &&
          savedPrice > 0 &&
          savedPrice !== autoInfo.unitPrice
      );

    const cleanTambahan: ProjectProductAddonItem[] = Array.isArray(item.tambahan)
      ? item.tambahan.map((addon) => ({
          jenis: String(addon?.jenis ?? ''),
          biaya: Math.max(0, Math.round(Number(addon?.biaya) || 0)),
        }))
      : [];

    const normalizedItemForSpec = {
      ...item,
      tambahan: cleanTambahan,
    };
    const generatedSpec = buildProjectProductSpecification(normalizedItemForSpec);
    const savedSpec = String(item.spesifikasiMaterial ?? '').trim();
    const inferredSpecManual =
      item.spesifikasiManual ??
      Boolean(savedSpec && generatedSpec && savedSpec !== generatedSpec);

    const { satuan: _legacySatuan, ...restItem } = item;
    void _legacySatuan;

    return {
      ...restItem,
      id: resolvedProductId,
      dimensi: item.dimensi ?? '',
      customisasi: item.customisasi ?? '',
      material: item.material ?? '',
      finishing: item.finishing ?? '',
      kodeWarna: item.kodeWarna ?? '',
      tambahan: cleanTambahan,
      spesifikasiMaterial: savedSpec || generatedSpec,
      spesifikasiManual: inferredSpecManual,
      jumlah: Math.max(1, Math.round(Number(item.jumlah) || 1)),
      hargaSatuan: savedPrice,
      hargaManual: inferredHargaManual,
    };
  });

  const resolvedDates = resolveProjectDocumentDates(cloned);
  const resolvedTech = resolveProjectTechnicalDetails(cloned, companyCity);
  const productsTotal = computeProjectProductsTotal(hydratedProducts);

  const resolvedClientEntityType = normalizeClientEntityType(
    cloned.jenisKlien,
    cloned.namaKlien
  );

  return {
    ...cloned,
    jenisKlien: resolvedClientEntityType,
    penanggungJawabKlien:
      resolvedClientEntityType === 'pribadi' ? '' : cloned.penanggungJawabKlien ?? '',
    jabatanKlien:
      resolvedClientEntityType === 'pribadi' ? '' : cloned.jabatanKlien ?? '',
    daftarProduk: hydratedProducts,
    tanggalDokumen: resolvedDates,
    detailTeknis: resolvedTech,
    nilaiKontrak: productsTotal > 0 ? productsTotal : cloned.nilaiKontrak,
  };
}

export default function AdminProyekFormPage() {
  const { projectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();

  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const paymentScheme = useSiteContentStore((state) => state.paymentScheme);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const siteCustomPricing = useSiteContentStore((state) => state.customPricing);

  const catalogProducts = useMemo(() => {
    if (catalogOverride) return catalogOverride.daftarProduk;
    return loadedBaseCatalog?.daftarProduk ?? DEFAULT_CATALOG_PRODUCTS;
  }, [catalogOverride, loadedBaseCatalog]);

  const shortBrandName = businessConfig.namaMerek;
  const companyCity =
    businessConfig.alamat.kabupaten.replace(/^Kabupaten\s+/i, '').trim() || 'Purwakarta';

  const projects = useProjectsStore((state) => state.projects);
  const upsertProject = useProjectsStore((state) => state.upsertProject);

  const contacts = useMarketingStore((state) => state.contacts);
  const upsertContact = useMarketingStore((state) => state.upsertContact);

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
  const upsertProjectInvoice = useFinanceStore((state) => state.upsertProjectInvoice);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEdit = canEditPage(currentUser, 'proyek');

  const isEditMode = Boolean(projectId);
  const existingProject = useMemo(
    () => (projectId ? projects.find((item) => item.id === projectId) ?? null : null),
    [projectId, projects]
  );

  const nextClientCode = useMemo(
    () => resolveNextClientCode(contacts, projects),
    [contacts, projects]
  );

  const targetFormKey = isEditMode
    ? existingProject
      ? `edit:${existingProject.id}`
      : `missing:${projectId}`
    : 'new';

  const [values, setValues] = useState<WorkshopProject>(() =>
    hydrateEditableProject(
      existingProject,
      projects.length + 1,
      companyCity,
      nextClientCode,
      catalogProducts,
      siteCustomPricing
    )
  );
  const [selectedClientCode, setSelectedClientCode] = useState<string>(
    () => existingProject?.id || nextClientCode
  );
  const [initializedFormKey, setInitializedFormKey] = useState<string>(targetFormKey);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    if (initializedFormKey === targetFormKey) return;
    setValues(
      hydrateEditableProject(
        existingProject,
        projects.length + 1,
        companyCity,
        nextClientCode,
        catalogProducts,
        siteCustomPricing
      )
    );
    setSelectedClientCode(existingProject?.id || nextClientCode);
    setFormError(null);
    setFieldErrors({});
    setInitializedFormKey(targetFormKey);
  }, [
    initializedFormKey,
    targetFormKey,
    existingProject,
    projects.length,
    companyCity,
    nextClientCode,
    catalogProducts,
    siteCustomPricing,
  ]);

  const { backTo, backLabel } = resolveProjectFormBackPath({
    isEditMode,
    projectId,
    existingProjectId: existingProject?.id,
  });

  useDocumentTitle(
    `${isEditMode && existingProject ? `Edit ${existingProject.namaProyek}` : 'Buat Proyek Baru'} | Admin ${shortBrandName}`
  );

  const productItems = values.daftarProduk ?? [];
  const docDates = resolveProjectDocumentDates(values);
  const techDetails = resolveProjectTechnicalDetails(values, companyCity);
  const computedContractTotal = computeProjectProductsTotal(productItems);
  const clientEntityType = normalizeClientEntityType(values.jenisKlien);
  const isOrganizationClient = clientEntityType !== 'pribadi';

  const matchedExistingContact = useMemo(() => {
    const normalizedCode = selectedClientCode.trim().toUpperCase();
    if (!normalizedCode) return null;
    return (
      contacts.find((c) => (c.kodeKlien ?? '').trim().toUpperCase() === normalizedCode) ?? null
    );
  }, [contacts, selectedClientCode]);

  const updateProductItems = (nextItems: ProjectProductItem[]) => {
    const nextTotal = computeProjectProductsTotal(nextItems);
    setValues((prev) => ({
      ...prev,
      daftarProduk: nextItems,
      nilaiKontrak: nextItems.length > 0 ? nextTotal : prev.nilaiKontrak,
    }));
  };

  const patchProductItem = (
    itemIndex: number,
    updater: (row: ProjectProductItem) => ProjectProductItem
  ) => {
    updateProductItems(
      productItems.map((row, rowIdx) => (rowIdx === itemIndex ? updater(row) : row))
    );
  };

  const updateDocDateField = <K extends keyof ProjectDocumentDates>(
    field: K,
    nextIso: string
  ) => {
    setValues((prev) => ({
      ...prev,
      tanggalDokumen: {
        ...resolveProjectDocumentDates(prev),
        [field]: nextIso,
      },
    }));
  };

  const updateTechField = <K extends keyof ProjectTechnicalDetails>(
    field: K,
    nextVal: ProjectTechnicalDetails[K]
  ) => {
    setValues((prev) => {
      const prevTech = resolveProjectTechnicalDetails(prev, companyCity);
      const nextTech: ProjectTechnicalDetails = {
        ...prevTech,
        [field]: nextVal,
      };
      if (field === 'masaGaransiBulan') {
        nextTech.tanggalGaransiBerakhir = computeWarrantyEndDateIso(
          prev.tanggalTargetSelesai,
          Number(nextVal) || 0
        );
      }
      return {
        ...prev,
        detailTeknis: nextTech,
      };
    });
  };

  const sections = useMemo<AdminFormSectionConfig<WorkshopProject>[]>(
    () => [
      {
        id: 'identitas-klien-proyek',
        title: 'Identitas Klien Proyek',
        mobileTabLabel: 'Klien',
        headerVariant: 'accent',
        errorPrefixes: ['alamat.'],
        columns: 2,
        fields: [
          {
            name: 'namaProyek',
            label: 'Nama Proyek Pengerjaan',
            type: 'text',
            required: true,
            placeholder: 'Contoh: Kitchen Set HPL & Kabinet Pantry Minimalis',
          },
          {
            name: 'status',
            label: 'Tahap Pengerjaan',
            type: 'select',
            required: true,
            options: PROJECT_STATUSES.map((st) => ({ value: st, label: st })),
          },
          {
            name: 'jenisKlien',
            label: 'Kategori Klien',
            type: 'custom',
            colSpan: 'full',
            render: ({ id, error, readOnly }) => (
              <FormField id={id} label="Kategori Klien" required error={error}>
                <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-3 gap-2.5">
                  {CLIENT_ENTITY_TYPE_OPTIONS.map((opt) => {
                    const selected = clientEntityType === opt.value;
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
                            jenisKlien: opt.value,
                            penanggungJawabKlien:
                              opt.value === 'pribadi' ? '' : prev.penanggungJawabKlien ?? '',
                            jabatanKlien:
                              opt.value === 'pribadi' ? '' : prev.jabatanKlien ?? '',
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
            name: 'namaKlien',
            label: getClientNameFieldLabel(clientEntityType),
            type: 'text',
            required: true,
            placeholder:
              clientEntityType === 'perusahaan'
                ? 'Contoh: PT Sinar Cipta Karawang'
                : clientEntityType === 'instansi'
                  ? 'Contoh: Dinas PUPR Kabupaten Purwakarta'
                  : 'Contoh: Bapak Hendra Wijaya',
          },
          {
            name: 'penanggungJawabKlien',
            label: 'Penanggung Jawab',
            type: 'text',
            required: true,
            visibleWhen: () => isOrganizationClient,
            placeholder: 'Contoh: Bapak Andi Wijaya',
          },
          {
            name: 'jabatanKlien',
            label: 'Jabatan',
            type: 'text',
            visibleWhen: () => isOrganizationClient,
            placeholder:
              clientEntityType === 'instansi'
                ? 'Contoh: Kepala Bagian Umum / PPK'
                : 'Contoh: Direktur / Manager Operasional',
          },
          {
            name: 'teleponKlien',
            label: 'Telepon / WhatsApp',
            type: 'tel',
            placeholder: '0812-xxxx-xxxx',
          },
          {
            name: 'alamat',
            label: 'Alamat Klien (Wilayah Indonesia)',
            type: 'custom',
            colSpan: 'full',
            render: ({ readOnly, errors }) => (
              <WilayahAddressFields
                idPrefix="prj-alamat"
                value={values.alamat}
                fallbackLocation={formatFullWilayahAddress(values.alamat, companyCity)}
                disabled={readOnly}
                required
                showHints={false}
                errors={errors}
                onChange={(nextAlamat) => {
                  setValues((prev) => ({
                    ...prev,
                    alamat: nextAlamat,
                  }));
                }}
              />
            ),
          },
        ],
        renderContent: ({ readOnly }) =>
          !isEditMode && !readOnly && contacts.length > 0 ? (
            <div className="pt-3 border-t border-[var(--border)]">
              <FormField
                id="prj-pick-client"
                label="Pilih Klien Terdaftar (Opsional)"
              >
                <Select
                  id="prj-pick-client"
                  value={matchedExistingContact?.id ?? '__new__'}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    if (selectedId === '__new__') {
                      setSelectedClientCode(nextClientCode);
                      return;
                    }
                    const picked = contacts.find((c) => c.id === selectedId);
                    if (!picked) return;
                    const orgCandidate =
                      picked.namaPerusahaan &&
                      picked.namaPerusahaan.trim().toLowerCase() !== 'pribadi'
                        ? picked.namaPerusahaan.trim()
                        : '';
                    const inferredType = normalizeClientEntityType(
                      undefined,
                      orgCandidate || picked.nama
                    );
                    const pickedAlamat = picked.alamat
                      ? structuredClone(picked.alamat)
                      : undefined;
                    setSelectedClientCode(picked.kodeKlien?.trim() || nextClientCode);
                    setValues((prev) => ({
                      ...prev,
                      jenisKlien: inferredType,
                      namaKlien:
                        inferredType === 'pribadi' ? picked.nama : orgCandidate || picked.nama,
                      penanggungJawabKlien:
                        inferredType === 'pribadi'
                          ? ''
                          : orgCandidate && picked.nama !== orgCandidate
                            ? picked.nama
                            : prev.penanggungJawabKlien ?? '',
                      teleponKlien: picked.telepon || prev.teleponKlien,
                      alamat: pickedAlamat ?? prev.alamat,
                    }));
                  }}
                >
                  <option value="__new__">Klien Baru (Otomatis {nextClientCode})</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {[c.kodeKlien, c.nama, c.kota].filter(Boolean).join(' · ')}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          ) : null,
      },
      {
        id: 'rincian-produk',
        title: 'Rincian Detail Produk',
        mobileTabLabel: 'Produk',
        errorFields: ['daftarProduk'],
        errorPrefixes: ['daftarProduk.', 'produk.'],
        unwrapped: true,
        headerAction: ({ readOnly }) =>
          !readOnly ? (
            <AdminActionButton
              icon={<Plus className="size-3.5" />}
              label="Tambah Produk"
              mobileLabel="Produk"
              hideLabelOnMobile={false}
              onClick={() =>
                updateProductItems([
                  ...productItems,
                  createEmptyProjectProductItem(productItems.length + 1),
                ])
              }
            />
          ) : null,
        renderContent: ({ readOnly, errors }) => (
          <div className="space-y-4">
            {errors.daftarProduk && (
              <p role="alert" className="text-xs font-medium text-[var(--danger)]">
                {errors.daftarProduk}
              </p>
            )}

            {productItems.map((item, idx) => {
              const matchedCatalog = findCatalogProduct(item.id, catalogProducts);
              const resolvedName = resolveProjectProductName(item, catalogProducts);
              const optionSets = getProjectProductOptionSets(matchedCatalog);
              const autoPriceInfo = calculateProjectProductAutoPrice({
                productId: item.id,
                dimensi: item.dimensi,
                material: item.material,
                finishing: item.finishing,
                siteCustomPricing,
                products: catalogProducts,
              });
              const subtotal = computeProjectProductSubtotal(item);
              const tambahanList = item.tambahan ?? [];

              const productMenuItems: PopupMenuItem[] = catalogProducts.map((prod) => ({
                id: `pick-prod-${idx}-${prod.id}`,
                label: prod.nama,
                description: `${prod.kategori} · ${prod.meterLari ? 'Per Meter Lari (m)' : 'Per Luas (m²)'}`,
                selected: item.id === prod.id,
                onSelect: () => {
                  patchProductItem(idx, (row) =>
                    applyCatalogProductSelection(row, prod.id, {
                      products: catalogProducts,
                      siteCustomPricing,
                    })
                  );
                },
              }));

              const customisasiMenuItems: PopupMenuItem[] =
                optionSets.customisasiOptions.length > 0
                  ? optionSets.customisasiOptions.map((opt) => ({
                      id: `pick-cust-${idx}-${opt}`,
                      label: opt,
                      selected: item.customisasi === opt,
                      onSelect: () => {
                        patchProductItem(idx, (row) =>
                          recalculateProjectProductItem(
                            { ...row, customisasi: opt },
                            { products: catalogProducts, siteCustomPricing }
                          )
                        );
                      },
                    }))
                  : [
                      {
                        id: `pick-cust-empty-${idx}`,
                        label: 'Pilih produk katalog terlebih dahulu',
                        disabled: true,
                        onSelect: () => {},
                      },
                    ];

              const materialMenuItems: PopupMenuItem[] = optionSets.materialOptions.map((opt) => ({
                id: `pick-mat-${idx}-${opt}`,
                label: opt,
                selected: item.material === opt,
                onSelect: () => {
                  patchProductItem(idx, (row) =>
                    recalculateProjectProductItem(
                      { ...row, material: opt },
                      { products: catalogProducts, siteCustomPricing }
                    )
                  );
                },
              }));

              const finishingMenuItems: PopupMenuItem[] = optionSets.finishingOptions.map(
                (opt) => ({
                  id: `pick-fin-${idx}-${opt}`,
                  label: opt,
                  selected: item.finishing === opt,
                  onSelect: () => {
                    patchProductItem(idx, (row) =>
                      recalculateProjectProductItem(
                        { ...row, finishing: opt },
                        { products: catalogProducts, siteCustomPricing }
                      )
                    );
                  },
                })
              );

              return (
                <AdminFormSectionCard
                  key={`prod-row-${idx}`}
                  headerVariant="accent"
                  title={`Produk #${idx + 1}${resolvedName ? ` · ${resolvedName}` : ''}`}
                  headerAction={
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-[var(--radius-md)] bg-white/15 border border-white/25 text-xs font-semibold text-white dark:bg-[#21201E]/10 dark:border-[#21201E]/15 dark:text-[#21201E] tabular-nums">
                        Subtotal {formatRupiahSigned(subtotal)}
                      </span>
                      {!readOnly && productItems.length > 1 && (
                        <AdminActionButton
                          variant="danger"
                          icon={<Trash2 className="size-3.5" />}
                          label={`Hapus Produk #${idx + 1}`}
                          iconOnly
                          onClick={() =>
                            updateProductItems(productItems.filter((_, rowIdx) => rowIdx !== idx))
                          }
                        />
                      )}
                    </div>
                  }
                >
                  <div className="space-y-3.5">
                    {/* Baris 1: Produk Katalog, Dimensi, Jumlah (Unit) di kanan Dimensi */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                      <div className="sm:col-span-12 lg:col-span-4">
                        <FormField
                          id={`prj-prod-code-${idx}`}
                          label="Produk Katalog"
                          required
                        >
                          <PopupMenu
                            label={`Pilih Produk #${idx + 1}`}
                            headerTitle="Pilih Produk Katalog"
                            align="start"
                            minWidth={280}
                            preferredMaxHeight={320}
                            className="w-full"
                            items={productMenuItems}
                            trigger={({ toggle, triggerProps }) => (
                              <button
                                id={`prj-prod-code-${idx}`}
                                type="button"
                                disabled={readOnly}
                                onClick={toggle}
                                className={POPUP_TRIGGER_CLASS}
                                {...triggerProps}
                              >
                                <span
                                  className={
                                    resolvedName
                                      ? 'truncate font-medium text-[var(--text)]'
                                      : 'truncate text-[var(--text-subtle)]'
                                  }
                                >
                                  {resolvedName || 'Pilih produk katalog...'}
                                </span>
                                <ChevronDown
                                  className="size-4 shrink-0 text-[var(--text-muted)]"
                                  aria-hidden="true"
                                />
                              </button>
                            )}
                          />
                        </FormField>
                      </div>

                      <div className="sm:col-span-8 lg:col-span-5">
                        <FormField
                          id={`prj-prod-dim-${idx}`}
                          label="Dimensi P x L x T (cm)"
                        >
                          <DimensionInput
                            id={`prj-prod-dim-${idx}`}
                            disabled={readOnly}
                            value={item.dimensi}
                            onValueChange={(nextDimensi) =>
                              patchProductItem(idx, (row) =>
                                recalculateProjectProductItem(
                                  { ...row, dimensi: nextDimensi },
                                  { products: catalogProducts, siteCustomPricing }
                                )
                              )
                            }
                          />
                        </FormField>
                      </div>

                      <div className="sm:col-span-4 lg:col-span-3">
                        <FormField id={`prj-prod-qty-${idx}`} label="Jumlah (Unit)">
                          <div
                            className={`inline-flex items-stretch w-full h-11 rounded-[var(--radius-md)] border border-[var(--border)] hover:border-[var(--border-strong)] focus-within:border-[var(--border-strong)] bg-[var(--surface)] transition-colors duration-150 ${
                              readOnly ? 'opacity-55 cursor-not-allowed' : ''
                            }`}
                          >
                            <button
                              type="button"
                              disabled={readOnly || item.jumlah <= 1}
                              aria-label={`Kurangi jumlah unit produk #${idx + 1}`}
                              onClick={() => {
                                const nextQty = Math.max(1, (Number(item.jumlah) || 1) - 1);
                                patchProductItem(idx, (row) => ({ ...row, jumlah: nextQty }));
                              }}
                              className="inline-flex items-center justify-center w-10 shrink-0 border-r border-[var(--border)] bg-[var(--surface-muted)]/55 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer rounded-l-[calc(var(--radius-md)-1px)]"
                            >
                              <Minus className="size-4" aria-hidden="true" />
                            </button>
                            <input
                              id={`prj-prod-qty-${idx}`}
                              type="number"
                              min={1}
                              inputMode="numeric"
                              disabled={readOnly}
                              value={item.jumlah}
                              onChange={(e) => {
                                const qty = Math.max(1, Math.round(Number(e.target.value) || 1));
                                patchProductItem(idx, (row) => ({ ...row, jumlah: qty }));
                              }}
                              className="flex-1 min-w-0 w-full h-full bg-transparent px-2 py-0 text-center text-base md:text-sm font-medium text-[var(--text)] tabular-nums outline-none focus:outline-none focus-visible:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:cursor-not-allowed"
                            />
                            <button
                              type="button"
                              disabled={readOnly}
                              aria-label={`Tambah jumlah unit produk #${idx + 1}`}
                              onClick={() => {
                                const nextQty = Math.max(1, (Number(item.jumlah) || 1) + 1);
                                patchProductItem(idx, (row) => ({ ...row, jumlah: nextQty }));
                              }}
                              className="inline-flex items-center justify-center w-10 shrink-0 border-l border-[var(--border)] bg-[var(--surface-muted)]/55 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer rounded-r-[calc(var(--radius-md)-1px)]"
                            >
                              <Plus className="size-4" aria-hidden="true" />
                            </button>
                          </div>
                        </FormField>
                      </div>
                    </div>

                    {/* Baris 2: Customisasi, Material, Finishing, Kode Warna, Harga Satuan sejajar */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
                      <div className="lg:col-span-3">
                        <FormField id={`prj-prod-cust-${idx}`} label="Customisasi">
                          <PopupMenu
                            label={`Pilih Customisasi Produk #${idx + 1}`}
                            headerTitle="Opsi Customisasi"
                            align="start"
                            minWidth={240}
                            className="w-full"
                            items={customisasiMenuItems}
                            trigger={({ toggle, triggerProps }) => (
                              <button
                                id={`prj-prod-cust-${idx}`}
                                type="button"
                                disabled={readOnly}
                                onClick={toggle}
                                className={POPUP_TRIGGER_CLASS}
                                {...triggerProps}
                              >
                                <span
                                  className={
                                    item.customisasi
                                      ? 'truncate font-medium text-[var(--text)]'
                                      : 'truncate text-[var(--text-subtle)]'
                                  }
                                >
                                  {item.customisasi || 'Pilih customisasi...'}
                                </span>
                                <ChevronDown
                                  className="size-4 shrink-0 text-[var(--text-muted)]"
                                  aria-hidden="true"
                                />
                              </button>
                            )}
                          />
                        </FormField>
                      </div>

                      <div className="lg:col-span-2">
                        <FormField id={`prj-prod-mat-${idx}`} label="Material Utama">
                          <PopupMenu
                            label={`Pilih Material Produk #${idx + 1}`}
                            headerTitle="Material Utama"
                            align="start"
                            minWidth={220}
                            className="w-full"
                            items={materialMenuItems}
                            trigger={({ toggle, triggerProps }) => (
                              <button
                                id={`prj-prod-mat-${idx}`}
                                type="button"
                                disabled={readOnly}
                                onClick={toggle}
                                className={POPUP_TRIGGER_CLASS}
                                {...triggerProps}
                              >
                                <span
                                  className={
                                    item.material
                                      ? 'truncate font-medium text-[var(--text)]'
                                      : 'truncate text-[var(--text-subtle)]'
                                  }
                                >
                                  {item.material || 'Pilih material...'}
                                </span>
                                <ChevronDown
                                  className="size-4 shrink-0 text-[var(--text-muted)]"
                                  aria-hidden="true"
                                />
                              </button>
                            )}
                          />
                        </FormField>
                      </div>

                      <div className="lg:col-span-2">
                        <FormField id={`prj-prod-fin-${idx}`} label="Finishing">
                          <PopupMenu
                            label={`Pilih Finishing Produk #${idx + 1}`}
                            headerTitle="Jenis Finishing"
                            align="start"
                            minWidth={220}
                            className="w-full"
                            items={finishingMenuItems}
                            trigger={({ toggle, triggerProps }) => (
                              <button
                                id={`prj-prod-fin-${idx}`}
                                type="button"
                                disabled={readOnly}
                                onClick={toggle}
                                className={POPUP_TRIGGER_CLASS}
                                {...triggerProps}
                              >
                                <span
                                  className={
                                    item.finishing
                                      ? 'truncate font-medium text-[var(--text)]'
                                      : 'truncate text-[var(--text-subtle)]'
                                  }
                                >
                                  {item.finishing || 'Pilih finishing...'}
                                </span>
                                <ChevronDown
                                  className="size-4 shrink-0 text-[var(--text-muted)]"
                                  aria-hidden="true"
                                />
                              </button>
                            )}
                          />
                        </FormField>
                      </div>

                      <div className="lg:col-span-2">
                        <FormField id={`prj-prod-color-${idx}`} label="Kode Warna">
                          <Input
                            id={`prj-prod-color-${idx}`}
                            type="text"
                            disabled={readOnly}
                            placeholder="Contoh: TH 015 AA"
                            value={item.kodeWarna ?? ''}
                            onChange={(e) => {
                              const nextColor = e.target.value;
                              patchProductItem(idx, (row) =>
                                recalculateProjectProductItem(
                                  { ...row, kodeWarna: nextColor },
                                  { products: catalogProducts, siteCustomPricing }
                                )
                              );
                            }}
                          />
                        </FormField>
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3">
                        <FormField
                          id={`prj-prod-price-${idx}`}
                          label="Harga Satuan (IDR)"
                          labelAction={
                            !readOnly && item.hargaManual && autoPriceInfo.unitPrice > 0 ? (
                              <button
                                type="button"
                                aria-label={`Reset harga otomatis (${formatRupiahSigned(autoPriceInfo.unitPrice)})`}
                                title={`Reset Otomatis (${formatRupiahSigned(autoPriceInfo.unitPrice)})`}
                                onClick={() =>
                                  patchProductItem(idx, (row) =>
                                    recalculateProjectProductItem(
                                      { ...row, hargaManual: false },
                                      { products: catalogProducts, siteCustomPricing }
                                    )
                                  )
                                }
                                className="inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                              >
                                <RotateCcw className="size-3.5" aria-hidden="true" />
                              </button>
                            ) : undefined
                          }
                        >
                          <CurrencyInput
                            id={`prj-prod-price-${idx}`}
                            disabled={readOnly}
                            zeroAsEmpty
                            value={item.hargaSatuan}
                            onValueChange={(nextPrice) => {
                              const resolvedPrice = Math.max(0, nextPrice ?? 0);
                              patchProductItem(idx, (row) => ({
                                ...row,
                                hargaSatuan: resolvedPrice,
                                hargaManual: true,
                              }));
                            }}
                          />
                        </FormField>
                      </div>
                    </div>

                    {/* Tambahan & Include Produk (hanya kolom tanpa judul baris #1 dst) */}
                    <div className="pt-2.5 border-t border-[var(--border)] space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-light tracking-[0.01em] text-[var(--text-muted)]">
                          Tambahan &amp; Include Produk ({tambahanList.length})
                        </p>
                        {!readOnly && (
                          <AdminActionButton
                            icon={<Plus className="size-3.5" />}
                            label="Tambah Tambahan"
                            mobileLabel="Tambahan"
                            hideLabelOnMobile={false}
                            onClick={() => {
                              const newAddon: ProjectProductAddonItem = {
                                jenis: '',
                                biaya: 0,
                              };
                              patchProductItem(idx, (row) =>
                                recalculateProjectProductItem(
                                  {
                                    ...row,
                                    tambahan: [...(row.tambahan ?? []), newAddon],
                                  },
                                  { products: catalogProducts, siteCustomPricing }
                                )
                              );
                            }}
                          />
                        )}
                      </div>

                      {tambahanList.length > 0 && (
                        <div className="space-y-2">
                          {tambahanList.map((addon, addonIdx) => (
                            <div
                              key={`addon-${idx}-${addonIdx}`}
                              className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                            >
                              <div className="sm:col-span-7">
                                <Input
                                  id={`prj-addon-jenis-${idx}-${addonIdx}`}
                                  aria-label={`Jenis tambahan atau include ke-${addonIdx + 1}`}
                                  disabled={readOnly}
                                  placeholder="Contoh: Lampu LED Strip / Rak Tarik Bumbu"
                                  value={addon.jenis}
                                  onChange={(e) => {
                                    const nextJenis = e.target.value;
                                    patchProductItem(idx, (row) =>
                                      recalculateProjectProductItem(
                                        {
                                          ...row,
                                          tambahan: (row.tambahan ?? []).map((a, aIdx) =>
                                            aIdx === addonIdx ? { ...a, jenis: nextJenis } : a
                                          ),
                                        },
                                        { products: catalogProducts, siteCustomPricing }
                                      )
                                    );
                                  }}
                                />
                              </div>

                              <div className="sm:col-span-4">
                                <CurrencyInput
                                  id={`prj-addon-biaya-${idx}-${addonIdx}`}
                                  aria-label={`Biaya tambahan ke-${addonIdx + 1} (IDR)`}
                                  disabled={readOnly}
                                  value={addon.biaya}
                                  onValueChange={(nextBiaya) => {
                                    const cleanBiaya = Math.max(0, nextBiaya ?? 0);
                                    patchProductItem(idx, (row) =>
                                      recalculateProjectProductItem(
                                        {
                                          ...row,
                                          tambahan: (row.tambahan ?? []).map((a, aIdx) =>
                                            aIdx === addonIdx ? { ...a, biaya: cleanBiaya } : a
                                          ),
                                        },
                                        { products: catalogProducts, siteCustomPricing }
                                      )
                                    );
                                  }}
                                />
                              </div>

                              {!readOnly && (
                                <div className="sm:col-span-1 flex justify-end">
                                  <AdminActionButton
                                    variant="danger"
                                    icon={<Trash2 className="size-3.5" />}
                                    label={`Hapus Tambahan ${addonIdx + 1} Produk #${idx + 1}`}
                                    iconOnly
                                    onClick={() =>
                                      patchProductItem(idx, (row) =>
                                        recalculateProjectProductItem(
                                          {
                                            ...row,
                                            tambahan: (row.tambahan ?? []).filter(
                                              (_, aIdx) => aIdx !== addonIdx
                                            ),
                                          },
                                          { products: catalogProducts, siteCustomPricing }
                                        )
                                      )
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Spesifikasi Material & Finishing (Otomatis + Bisa Diedit Manual) */}
                    <div>
                      <FormField
                        id={`prj-prod-spec-${idx}`}
                        label="Spesifikasi Material & Finishing"
                        labelAction={
                          !readOnly && item.spesifikasiManual ? (
                            <button
                              type="button"
                              aria-label="Gunakan spesifikasi otomatis"
                              title="Gunakan Spesifikasi Otomatis"
                              onClick={() =>
                                patchProductItem(idx, (row) =>
                                  recalculateProjectProductItem(
                                    { ...row, spesifikasiManual: false },
                                    { products: catalogProducts, siteCustomPricing }
                                  )
                                )
                              }
                              className="inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                            >
                              <RotateCcw className="size-3.5" aria-hidden="true" />
                            </button>
                          ) : undefined
                        }
                      >
                        <Textarea
                          id={`prj-prod-spec-${idx}`}
                          rows={2}
                          disabled={readOnly}
                          placeholder="Otomatis mengikuti pilihan customisasi, material, finishing, kode warna & tambahan..."
                          value={item.spesifikasiMaterial}
                          onChange={(e) =>
                            patchProductItem(idx, (row) => ({
                              ...row,
                              spesifikasiMaterial: e.target.value,
                              spesifikasiManual: true,
                            }))
                          }
                        />
                      </FormField>
                    </div>
                  </div>
                </AdminFormSectionCard>
              );
            })}

            <div className="px-4 py-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-[var(--text-muted)]">
                Total Kontrak Terhitung ({productItems.length} item produk)
              </span>
              <span className="text-sm font-bold text-[var(--text)] tabular-nums">
                {formatRupiahSigned(computedContractTotal)}
              </span>
            </div>
          </div>
        ),
      },
      {
        id: 'jadwal-dan-tanggal-surat',
        title: 'Jadwal Proyek & Tanggal Surat',
        mobileTabLabel: 'Jadwal',
        errorPrefixes: ['tanggalDokumen.'],
        headerVariant: 'accent',
        columns: 2,
        fields: [
          {
            name: 'tanggalMulai',
            label: 'Tanggal Mulai Proyek',
            type: 'date',
            required: true,
          },
          {
            name: 'tanggalTargetSelesai',
            label: 'Target Selesai Proyek',
            type: 'date',
            required: true,
            onValueChange: (nextValue, prev) => {
              const prevTech = resolveProjectTechnicalDetails(prev, companyCity);
              return {
                detailTeknis: {
                  ...prevTech,
                  tanggalGaransiBerakhir: computeWarrantyEndDateIso(
                    String(nextValue ?? ''),
                    prevTech.masaGaransiBulan
                  ),
                },
              };
            },
          },
        ],
        renderContent: ({ readOnly, errors }) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              id="doc-date-penawaran"
              label="Tanggal Surat Penawaran"
              required
              error={errors['tanggalDokumen.tanggalPenawaran']}
            >
              <DatePicker
                id="doc-date-penawaran"
                disabled={readOnly}
                required
                value={docDates.tanggalPenawaran}
                onValueChange={(nextIso) => updateDocDateField('tanggalPenawaran', nextIso)}
              />
            </FormField>

            <FormField
              id="doc-date-berlaku-hingga"
              label="Berlaku Hingga Penawaran"
              required
              error={errors['tanggalDokumen.berlakuHingga']}
            >
              <DatePicker
                id="doc-date-berlaku-hingga"
                disabled={readOnly}
                required
                value={docDates.berlakuHingga}
                onValueChange={(nextIso) => updateDocDateField('berlakuHingga', nextIso)}
              />
            </FormField>

            <FormField
              id="doc-date-spk"
              label="Tanggal Terbit SPK"
              required
              error={errors['tanggalDokumen.tanggalSpk']}
            >
              <DatePicker
                id="doc-date-spk"
                disabled={readOnly}
                required
                value={docDates.tanggalSpk}
                onValueChange={(nextIso) => updateDocDateField('tanggalSpk', nextIso)}
              />
            </FormField>

            <FormField
              id="doc-date-sj"
              label="Tanggal Kirim Surat Jalan"
              required
              error={errors['tanggalDokumen.tanggalKirim']}
            >
              <DatePicker
                id="doc-date-sj"
                disabled={readOnly}
                required
                value={docDates.tanggalKirim}
                onValueChange={(nextIso) => updateDocDateField('tanggalKirim', nextIso)}
              />
            </FormField>

            <FormField
              id="doc-date-bast"
              label="Tanggal Serah Terima (BAST)"
              required
              error={errors['tanggalDokumen.tanggalBast']}
            >
              <DatePicker
                id="doc-date-bast"
                disabled={readOnly}
                required
                value={docDates.tanggalBast}
                onValueChange={(nextIso) => updateDocDateField('tanggalBast', nextIso)}
              />
            </FormField>

            <FormField
              id="doc-date-invoice"
              label="Jatuh Tempo Invoice Induk"
              required
              error={errors['tanggalDokumen.tanggalJatuhTempo']}
            >
              <DatePicker
                id="doc-date-invoice"
                disabled={readOnly}
                required
                value={docDates.tanggalJatuhTempo}
                onValueChange={(nextIso) => updateDocDateField('tanggalJatuhTempo', nextIso)}
              />
            </FormField>

            <FormField id="doc-date-t1" label="Tanggal Termin 1 (DP 30%)">
              <DatePicker
                id="doc-date-t1"
                disabled={readOnly}
                value={docDates.tanggalTermin1 ?? docDates.tanggalPenawaran}
                onValueChange={(nextIso) => updateDocDateField('tanggalTermin1', nextIso)}
              />
            </FormField>

            <FormField id="doc-date-t2" label="Tanggal Termin 2 (Progress 40%)">
              <DatePicker
                id="doc-date-t2"
                disabled={readOnly}
                value={docDates.tanggalTermin2 ?? docDates.tanggalSpk}
                onValueChange={(nextIso) => updateDocDateField('tanggalTermin2', nextIso)}
              />
            </FormField>

            <FormField id="doc-date-t3" label="Tanggal Termin 3 (Pra-Instalasi 20%)">
              <DatePicker
                id="doc-date-t3"
                disabled={readOnly}
                value={docDates.tanggalTermin3 ?? docDates.tanggalKirim}
                onValueChange={(nextIso) => updateDocDateField('tanggalTermin3', nextIso)}
              />
            </FormField>

            <FormField id="doc-date-t4" label="Tanggal Termin 4 (Serah Terima 10%)">
              <DatePicker
                id="doc-date-t4"
                disabled={readOnly}
                value={docDates.tanggalTermin4 ?? values.tanggalTargetSelesai}
                onValueChange={(nextIso) => updateDocDateField('tanggalTermin4', nextIso)}
              />
            </FormField>
          </div>
        ),
      },
      {
        id: 'pengiriman-garansi',
        title: 'Pengiriman, Instalasi & Garansi',
        mobileTabLabel: 'Pengiriman',
        errorPrefixes: ['detailTeknis.'],
        headerVariant: 'accent',
        renderContent: ({ readOnly }) => {
          const warrantyBaseDate = values.tanggalTargetSelesai || docDates.tanggalKirim;
          const warrantyEndDateValue = computeWarrantyEndDateIso(
            warrantyBaseDate,
            techDetails.masaGaransiBulan
          );

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-start">
              <div className="sm:col-span-2 lg:col-span-5">
                <FormField id="tech-penanggung-jawab" label="Penanggung Jawab Pengiriman & Instalasi">
                  <Input
                    id="tech-penanggung-jawab"
                    disabled={readOnly}
                    placeholder="Nama penanggung jawab pengiriman & instalasi (untuk Surat Jalan)"
                    value={techDetails.penanggungJawabPengirimanInstalasi ?? ''}
                    onChange={(e) =>
                      updateTechField('penanggungJawabPengirimanInstalasi', e.target.value)
                    }
                  />
                </FormField>
              </div>

              <div className="lg:col-span-3">
                <FormField id="tech-garansi" label="Masa Garansi (Bulan)">
                  <Input
                    id="tech-garansi"
                    type="number"
                    min={0}
                    disabled={readOnly}
                    value={techDetails.masaGaransiBulan}
                    onChange={(e) =>
                      updateTechField('masaGaransiBulan', Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </FormField>
              </div>

              <div className="lg:col-span-4">
                <FormField
                  id="tech-garansi-berakhir"
                  label="Garansi Berlaku Hingga"
                >
                  <DatePicker
                    id="tech-garansi-berakhir"
                    disabled
                    value={warrantyEndDateValue}
                  />
                </FormField>
              </div>
            </div>
          );
        },
      },
    ],
    [
      isEditMode,
      clientEntityType,
      isOrganizationClient,
      values.alamat,
      values.tanggalTargetSelesai,
      productItems,
      docDates,
      techDetails,
      computedContractTotal,
      contacts,
      nextClientCode,
      selectedClientCode,
      matchedExistingContact?.id,
      catalogProducts,
      siteCustomPricing,
      companyCity,
    ]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const validation = validateWorkshopProjectDraft(values, {
      requireStructuredAddress: true,
    });
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const lockedExistingCode = isEditMode
      ? existingProject?.id || values.id
      : null;
    const rawClientCode =
      lockedExistingCode ??
      (!matchedExistingContact ? nextClientCode : selectedClientCode);
    const parsedSeq = parseClientSequence(rawClientCode);
    const resolvedClientCode = parsedSeq
      ? formatClientCode(parsedSeq)
      : rawClientCode?.trim() || nextClientCode;

    const resolvedProjectId =
      isEditMode && existingProject
        ? existingProject.id
        : resolveProjectIdFromClientCode(resolvedClientCode, projects);

    const payload = normalizeWorkshopProjectPayload({
      ...values,
      id: resolvedProjectId,
    });
    upsertProject(payload);

    const hasExistingContact = contacts.some(
      (c) => (c.kodeKlien ?? '').trim().toUpperCase() === resolvedClientCode.toUpperCase()
    );
    if (!hasExistingContact && payload.namaKlien.trim()) {
      const normalizedDigits = normalizeWhatsAppDigits(payload.teleponKlien);
      upsertContact({
        id: `mkt-prj-${payload.id}`,
        kodeKlien: resolvedClientCode,
        nama:
          payload.jenisKlien === 'pribadi'
            ? payload.namaKlien
            : payload.penanggungJawabKlien || payload.namaKlien,
        namaPerusahaan: payload.jenisKlien === 'pribadi' ? 'Pribadi' : payload.namaKlien,
        telepon: payload.teleponKlien,
        teleponTerstandar: normalizedDigits,
        email: '',
        kota:
          formatKabupatenShort(payload.alamat?.kabupaten?.name) ||
          formatFullWilayahAddress(payload.alamat, companyCity) ||
          companyCity,
        ...(payload.alamat ? { alamat: payload.alamat } : {}),
        segmen: payload.status === 'Selesai' ? 'Klien Selesai' : 'Klien Aktif',
        sumber: 'Invoice / SPK',
        labelTag: ['proyek'],
        izinWhatsapp: isValidWhatsAppDigits(normalizedDigits),
        izinEmail: false,
        catatan: `Proyek ${resolvedClientCode} — ${payload.namaProyek}`,
        terakhirDihubungi: null,
        dibuatPada: payload.dibuatPada || new Date().toISOString(),
      });
    }

    const existingWorkspace = isEditMode
      ? buildProjectWorkspaceData(payload, {
          quotations,
          agreements,
          workOrders,
          deliveryOrders,
          handoverCertificates,
          invoices,
          transactions,
          paymentScheme,
        })
      : null;

    const bundle = buildAutoProjectDocuments(payload, businessConfig, paymentScheme, {
      quotation: existingWorkspace?.quotations[0],
      agreement: existingWorkspace?.agreements[0],
      deliveryOrder: existingWorkspace?.deliveryOrders[0],
      handoverCertificate: existingWorkspace?.handoverCertificates[0],
      invoice: existingWorkspace?.invoices[0],
    });

    upsertQuotation(bundle.quotation);
    upsertAgreement(bundle.agreement);
    upsertDeliveryOrder(bundle.deliveryOrder);
    upsertHandoverCertificate(bundle.handoverCertificate);
    upsertProjectInvoice(bundle.invoice);

    recordActivity(
      isEditMode
        ? 'Memperbarui proyek & menyinkronkan seluruh dokumen'
        : 'Membuat proyek & 8 dokumen otomatis',
      'Proyek',
      `${resolvedClientCode} · ${payload.namaProyek}`
    );

    navigate(`/admin/proyek/${payload.id}`);
  };

  return (
    <FormFieldStyleProvider labelTone="thin" hideHints>
      <div className="[&_input]:font-medium [&_textarea]:font-medium">
        <AdminForm
          title={isEditMode ? 'Edit Proyek & Sinkronisasi Dokumen' : 'Buat Proyek'}
          backTo={backTo}
          backLabel={backLabel}
          submitLabel={isEditMode ? 'Simpan & Sinkronkan Dokumen' : 'Buat & Buka Proyek'}
          actionMode="header-icon-mobile-bottom"
          values={values}
          onChange={setValues}
          sections={sections}
          onSubmit={handleSubmit}
          formError={formError}
          fieldErrors={fieldErrors}
          readOnly={!canEdit}
          notFoundState={
            isEditMode && !existingProject
              ? {
                  title: 'Proyek Tidak Ditemukan',
                  message: 'Data proyek yang Anda cari tidak tersedia atau telah dihapus.',
                }
              : undefined
          }
        />
      </div>
    </FormFieldStyleProvider>
  );
}
