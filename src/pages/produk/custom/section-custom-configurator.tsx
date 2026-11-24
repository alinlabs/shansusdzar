import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  Headset,
  Info,
  Minus,
  MoveHorizontal,
  MoveVertical,
  Plus,
} from 'lucide-react';
import {
  useAdaptiveNavConfig,
  type AdaptiveNavConfig,
} from '../../../components/layout/adaptive-nav-context';
import { Button, ExternalLinkButton } from '../../../components/ui/button';
import { CartPlusIcon } from '../../../components/ui/cart-plus-icon';
import { ColorOptionPicker } from '../../../components/ui/color-option-picker';
import { resolveProductPromoMarkup } from '../../../lib/catalog-pricing';
import { formatCurrencyIDR } from '../../../lib/price-format';
import { buildWhatsAppUrl } from '../../../lib/business-config';
import { getProductSlug } from '../../../lib/product-catalog';
import {
  INDICATIVE_ESTIMATE_CONFIG,
  INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  UNIFIED_SERVICE_MODE_LABEL,
  calculateCustomEstimate,
} from '../../../lib/custom-pricing';
import { useCartStore } from '../../../store/cart-store';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../../store/site-content-store';
import {
  appendProfileToWhatsAppMessage,
  useUserProfileStore,
} from '../../../store/user-profile-store';
import type { ProductItem } from '../../../types/product';
import {
  CUSTOM_COLOR_SWATCHES,
  type CustomColorSwatch,
  type CustomConfiguratorDraft,
  applyProductSelectionToDraft,
  buildProductFinishOptions,
  buildProductMaterialOptions,
  createDefaultCustomDraft,
  customItemToDraft,
  validateDimensionsInput,
} from './custom-config';
import { CustomLiveSummary } from './components/custom-live-summary';
import { EqualOptionGrid } from './components/equal-option-grid';
import { ProductOptionPicker } from './components/product-option-picker';
import { CustomisasiOptionPicker } from '../detail/customisasi-option-picker';

export function SectionCustomConfigurator() {
  const [searchParams] = useSearchParams();
  const requestedProductSlug = searchParams.get('produk');

  const items = useCartStore((state) => state.items);
  const editingCustomLineId = useCartStore((state) => state.editingCustomLineId);
  const setEditingCustomLineId = useCartStore((state) => state.setEditingCustomLineId);
  const saveCustomItem = useCartStore((state) => state.saveCustomItem);
  const openDrawer = useCartStore((state) => state.openDrawer);

  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const customPricing = useSiteContentStore((state) => state.customPricing);
  const profile = useUserProfileStore((state) => state.profile);
  const syncProfileActivity = useUserProfileStore((state) => state.syncProfileActivity);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  const activeCatalog = catalogOverride ?? loadedBaseCatalog;
  const catalogProducts = useMemo(() => activeCatalog?.daftarProduk ?? [], [activeCatalog]);

  const editingItem = useMemo(() => {
    if (!editingCustomLineId) return null;
    const found = items.find((i) => i.lineId === editingCustomLineId);
    return found && found.kind === 'custom' ? found : null;
  }, [items, editingCustomLineId]);

  const [draft, setDraft] = useState<CustomConfiguratorDraft>(() =>
    createDefaultCustomDraft('design-and-build')
  );

  const [appliedProductSlug, setAppliedProductSlug] = useState<string | null>(null);
  const initializedEditKeyRef = useRef<string | null>(null);
  const initializedDefaultProductRef = useRef(false);
  const lengthInputRef = useRef<HTMLInputElement>(null);
  const widthInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingItem) {
      initializedEditKeyRef.current = null;
      return;
    }
    const nextKey = `${editingItem.lineId}:${catalogProducts.length > 0 ? 'loaded' : 'pending'}`;
    if (initializedEditKeyRef.current === nextKey) return;
    setDraft(customItemToDraft(editingItem, catalogProducts));
    initializedEditKeyRef.current = nextKey;
  }, [editingItem, catalogProducts]);

  useEffect(() => {
    if (editingItem || !requestedProductSlug || catalogProducts.length === 0) return;
    if (appliedProductSlug === requestedProductSlug) return;
    const matched = catalogProducts.find((p) => getProductSlug(p) === requestedProductSlug);
    if (!matched) return;

    setDraft((prev) => applyProductSelectionToDraft(prev, matched));
    setAppliedProductSlug(requestedProductSlug);
  }, [editingItem, requestedProductSlug, catalogProducts, appliedProductSlug]);

  useEffect(() => {
    if (editingItem || requestedProductSlug || catalogProducts.length === 0) return;
    if (draft.selectedProductId || initializedDefaultProductRef.current) return;
    initializedDefaultProductRef.current = true;
    setDraft((prev) => applyProductSelectionToDraft(prev, catalogProducts[0]));
  }, [editingItem, requestedProductSlug, catalogProducts, draft.selectedProductId]);

  const selectedProduct = useMemo<ProductItem | null>(() => {
    if (!draft.selectedProductId) return null;
    return catalogProducts.find((p) => p.id === draft.selectedProductId) ?? null;
  }, [catalogProducts, draft.selectedProductId]);

  const dimensionValidation = useMemo(
    () =>
      validateDimensionsInput({
        lengthInput: draft.lengthInput,
        widthInput: draft.widthInput,
        unit: 'cm',
      }),
    [draft.lengthInput, draft.widthInput]
  );

  const availableMaterials = useMemo(
    () => buildProductMaterialOptions(selectedProduct),
    [selectedProduct]
  );

  const availableFinishes = useMemo(
    () => buildProductFinishOptions(selectedProduct),
    [selectedProduct]
  );

  const availableColors = useMemo<CustomColorSwatch[]>(() => {
    if (selectedProduct?.pilihanWarna && selectedProduct.pilihanWarna.length > 0) {
      return selectedProduct.pilihanWarna;
    }
    return CUSTOM_COLOR_SWATCHES;
  }, [selectedProduct]);

  const productCustomisasiList = useMemo(
    () => selectedProduct?.customisasi ?? [],
    [selectedProduct]
  );

  const selectedMaterial =
    availableMaterials.find((m) => m.id === draft.materialId) ?? availableMaterials[0] ?? null;
  const selectedFinish =
    availableFinishes.find((f) => f.id === draft.finishId) ?? availableFinishes[0] ?? null;
  const selectedColor =
    availableColors.find((c) => c.id === draft.colorId) ?? availableColors[0];

  const activeCustomStyleValue =
    productCustomisasiList.length > 0
      ? (draft.customStyleValue && productCustomisasiList.includes(draft.customStyleValue)
          ? draft.customStyleValue
          : productCustomisasiList[0])
      : null;

  const productIncludedItems = useMemo(
    () => selectedProduct?.include ?? [],
    [selectedProduct]
  );

  const activeDimensions = dimensionValidation.normalized;

  const activePricingConfig = useMemo(
    () => ({
      mataUang: 'IDR' as const,
      persentaseDp: customPricing?.persentaseDp ?? INDICATIVE_ESTIMATE_CONFIG.persentaseDp,
      hargaCustomTerkonfigurasi: selectedProduct?.harga
        ? true
        : (customPricing?.hargaCustomTerkonfigurasi ??
          INDICATIVE_ESTIMATE_CONFIG.hargaCustomTerkonfigurasi),
    }),
    [customPricing, selectedProduct]
  );

  const activeRules = useMemo(
    () => ({
      ...(customPricing?.rules ?? INDICATIVE_WORKSHOP_ESTIMATE_RULES),
      biayaTambahanOpsi: {},
    }),
    [customPricing]
  );

  const estimate = useMemo(() => {
    if (!activeDimensions || !selectedProduct || !selectedMaterial || !selectedFinish) return null;
    return calculateCustomEstimate({
      serviceMode: 'design-and-build',
      product: selectedProduct,
      itemTypeId: selectedProduct.id,
      itemLabel: selectedProduct.nama,
      materialId: selectedMaterial.id,
      finishId: selectedFinish.id,
      dimensions: activeDimensions,
      additionalOptionIds: [],
      quantity: draft.quantity,
      pricingConfig: activePricingConfig,
      rules: activeRules,
    });
  }, [
    selectedProduct,
    activeDimensions,
    selectedMaterial,
    selectedFinish,
    draft.quantity,
    activePricingConfig,
    activeRules,
  ]);

  const handleSelectProduct = (product: ProductItem) => {
    setDraft((prev) => applyProductSelectionToDraft(prev, product));
  };

  const handleReset = () => {
    setEditingCustomLineId(null);
    const baseDraft = createDefaultCustomDraft('design-and-build');
    setDraft(
      catalogProducts.length > 0
        ? applyProductSelectionToDraft(baseDraft, catalogProducts[0])
        : baseDraft
    );
  };

  const handleDecreaseQty = useCallback(() => {
    setDraft((prev) => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }));
  }, []);

  const handleIncreaseQty = useCallback(() => {
    setDraft((prev) => ({ ...prev, quantity: Math.min(20, prev.quantity + 1) }));
  }, []);

  const handleSaveToCart = useCallback(() => {
    if (!selectedProduct || !selectedMaterial || !selectedFinish) return;
    if (!dimensionValidation.normalized || !estimate) {
      if (dimensionValidation.errors.length) {
        lengthInputRef.current?.focus();
      } else {
        widthInputRef.current?.focus();
      }
      return;
    }

    const safeDims = dimensionValidation.normalized;
    const lineId =
      editingItem?.lineId ??
      `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const combinedOptionLabels = [
      ...(activeCustomStyleValue ? [`Model: ${activeCustomStyleValue}`] : []),
      ...productIncludedItems,
    ];

    saveCustomItem({
      lineId,
      serviceMode: 'design-and-build',
      serviceModeLabel: UNIFIED_SERVICE_MODE_LABEL,
      itemTypeId: selectedProduct.id,
      itemTypeLabel: selectedProduct.nama,
      dimensions: safeDims,
      materialId: selectedMaterial.id,
      materialLabel: selectedMaterial.label,
      finishId: selectedFinish.id,
      finishLabel: selectedFinish.label,
      colorId: selectedColor.id,
      colorName: selectedColor.nama,
      colorHex: selectedColor.hex,
      additionalOptions: combinedOptionLabels,
      notes: '',
      quantity: draft.quantity,
      designAmount: estimate.designAmount,
      buildAmount: estimate.buildAmount,
      estimatedUnitTotal: estimate.estimatedUnitTotal,
      estimatedDpAmount: estimate.estimatedDpUnitAmount,
      estimateStatus: estimate.status,
    });

    if (editingItem) {
      setEditingCustomLineId(null);
    }
    openDrawer();
  }, [
    activeCustomStyleValue,
    dimensionValidation.errors.length,
    dimensionValidation.normalized,
    draft.quantity,
    editingItem,
    estimate,
    openDrawer,
    productIncludedItems,
    saveCustomItem,
    selectedColor.hex,
    selectedColor.id,
    selectedColor.nama,
    selectedFinish,
    selectedMaterial,
    selectedProduct,
    setEditingCustomLineId,
  ]);

  const isCatDuco = selectedFinish?.id === 'cat-duco';
  const baseLineTotalFormatted = estimate ? formatCurrencyIDR(estimate.estimatedLineTotal) : null;
  const lineTotalFormatted = baseLineTotalFormatted
    ? isCatDuco
      ? `Mulai ${baseLineTotalFormatted}`
      : baseLineTotalFormatted
    : null;
  const mobilePromoInfo =
    selectedProduct && estimate && estimate.status === 'configured'
      ? resolveProductPromoMarkup(estimate.estimatedUnitTotal, selectedProduct.promo)
      : null;
  const mobileCompareAtTotal =
    mobilePromoInfo?.promoActive && mobilePromoInfo.compareAtPrice !== null
      ? mobilePromoInfo.compareAtPrice * draft.quantity
      : null;
  const baseMobileCompareAtFormatted =
    mobileCompareAtTotal !== null ? formatCurrencyIDR(mobileCompareAtTotal) : null;
  const mobileCompareAtFormatted = baseMobileCompareAtFormatted
    ? isCatDuco
      ? `Mulai ${baseMobileCompareAtFormatted}`
      : baseMobileCompareAtFormatted
    : null;

  const baseWhatsappMessage = selectedProduct
    ? [
        `Halo ${businessConfig.namaMerek},`,
        `Saya ingin konsultasi simulasi Design & Build berikut:`,
        `- Produk: ${selectedProduct.nama} (${selectedProduct.kategori})`,
        activeCustomStyleValue ? `- Customisasi: ${activeCustomStyleValue}` : null,
        activeDimensions && estimate
          ? `- Ukuran (Panjang × Tinggi): ${activeDimensions.length} × ${activeDimensions.width} cm (${estimate.measureQuantity} ${estimate.pricingUnitLabel})`
          : `- Ukuran (Panjang × Tinggi): Belum ditentukan (cm)`,
        selectedMaterial ? `- Material Utama: ${selectedMaterial.label}` : null,
        selectedFinish ? `- Finishing/Laminasi: ${selectedFinish.label}` : null,
        `- Pilihan Warna: ${selectedColor.nama}`,
        productIncludedItems.length > 0
          ? `- Sudah Termasuk (Include): ${productIncludedItems.join(', ')}`
          : null,
        `- Jumlah: ${draft.quantity} unit`,
        lineTotalFormatted ? `- Simulasi Estimasi Awal: ${lineTotalFormatted}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    : `Halo ${businessConfig.namaMerek}, saya ingin konsultasi pembuatan furniture custom.`;

  const whatsappMessage = appendProfileToWhatsAppMessage(baseWhatsappMessage, profile);

  const whatsappConsultationUrl = businessConfig
    ? buildDynamicWhatsAppUrl(businessConfig, whatsappMessage)
    : buildWhatsAppUrl(whatsappMessage);

  const handleConsultationClick = useCallback(() => {
    syncProfileActivity(
      selectedProduct
        ? `Konsultasi custom interior: ${selectedProduct.nama}`
        : 'Konsultasi custom interior',
      ['profil-user', 'konsultasi-wa']
    );
  }, [selectedProduct, syncProfileActivity]);

  const mobileMeasureLabel = estimate
    ? `${estimate.measureQuantity} ${estimate.pricingUnitLabel}`
    : null;
  const mobilePriceLabel = !selectedProduct
    ? 'Memuat...'
    : !estimate
      ? 'Isi ukuran (cm)'
      : estimate.status === 'configured' && lineTotalFormatted
        ? lineTotalFormatted
        : 'Hubungi Kami';

  const adaptiveNavConfig = useMemo<AdaptiveNavConfig>(
    () => ({
      header: {
        hideDesktopNav: true,
        hideDesktopAccountIcons: true,
        hideSearchIcon: true,
        backTo: '/produk',
        backAriaLabel: 'Kembali ke daftar produk',
      },
      bottom: {
        type: 'product-detail',
        estimateLabel: mobileMeasureLabel ? `Estimasi (${mobileMeasureLabel})` : 'Estimasi Harga',
        priceLabel: mobilePriceLabel,
        compareAtPriceLabel: mobilePromoInfo?.promoActive ? mobileCompareAtFormatted : null,
        promoPercentLabel: mobilePromoInfo?.promoActive ? mobilePromoInfo.promoPercentLabel : null,
        quantity: draft.quantity,
        onDecreaseQuantity: handleDecreaseQty,
        onIncreaseQuantity: handleIncreaseQty,
        canDecreaseQuantity: draft.quantity > 1,
        canIncreaseQuantity: draft.quantity < 20,
        consultationHref: whatsappConsultationUrl,
        consultationLabel: 'Konsultasi',
        onConsultationAction: handleConsultationClick,
        primaryLabel: editingItem ? 'Simpan Perubahan ke Keranjang' : 'Tambah ke Keranjang',
        onPrimaryAction: handleSaveToCart,
        dropUpEyebrow: selectedProduct?.kategori,
        dropUpTitle: selectedProduct?.nama ?? 'Rincian Estimasi Custom',
        renderDropUp: () => (
          <CustomLiveSummary
            embedded
            hasSelectedProduct={Boolean(selectedProduct)}
            itemLabel={selectedProduct?.nama ?? 'Memuat produk'}
            itemCategory={selectedProduct?.kategori}
            productPromo={selectedProduct?.promo}
            finishId={selectedFinish?.id}
            quantity={draft.quantity}
            estimate={estimate}
          />
        ),
      },
    }),
    [
      draft.quantity,
      editingItem,
      estimate,
      handleConsultationClick,
      handleDecreaseQty,
      handleIncreaseQty,
      handleSaveToCart,
      mobileCompareAtFormatted,
      mobileMeasureLabel,
      mobilePriceLabel,
      mobilePromoInfo?.promoActive,
      mobilePromoInfo?.promoPercentLabel,
      productIncludedItems,
      selectedFinish?.id,
      selectedProduct,
      whatsappConsultationUrl,
    ]
  );

  useAdaptiveNavConfig(adaptiveNavConfig);

  return (
    <section aria-label="Kalkulator Estimasi Custom Interior" className="space-y-5 sm:space-y-6">
      {editingItem && (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-medium text-[var(--text-muted)]">
            Edit Konfigurasi Custom
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReset}
            className="!min-h-0 h-7 px-2.5 py-0 text-[11px] shrink-0"
          >
            Batal Edit
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Direct Interactive Calculator Controls */}
        <div className="lg:col-span-7 space-y-5">
          {/* Pilih Produk */}
          <div className="space-y-2.5">
            <h2 className="text-xs font-medium text-[var(--text-muted)]">
              Pilih Produk
            </h2>

            <ProductOptionPicker
              products={catalogProducts}
              value={draft.selectedProductId}
              onChange={handleSelectProduct}
              label="Pilih Produk"
            />

            {productIncludedItems.length > 0 && (
              <div
                data-testid="custom-left-included-items"
                className="hidden md:block pt-1 space-y-1.5"
              >
                <p className="text-xs font-medium text-[var(--text-muted)]">
                  Sudah Termasuk (Include)
                </p>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--text-muted)] leading-relaxed">
                  {productIncludedItems.map((itemText) => (
                    <li key={itemText} className="flex items-start gap-1.5">
                      <span aria-hidden="true" className="shrink-0">
                        •
                      </span>
                      <span>{itemText}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Ukuran Bidang (cm) — 2 Kolom Panjang × Tinggi */}
          <div className="space-y-2.5">
            <h2 className="text-xs font-medium text-[var(--text-muted)]">
              Ukuran Bidang (cm)
            </h2>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {/* Kolom 1: Panjang (cm) */}
              <div className="min-w-0">
                <div className="flex items-stretch h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] transition-colors duration-150 hover:border-[var(--border-strong)] focus-within:border-[var(--border-strong)]">
                  <label
                    htmlFor="calc-length"
                    title="Panjang (cm)"
                    className="inline-flex items-center justify-center px-2.5 sm:px-3 border-r border-[var(--border)] bg-[var(--surface-muted)]/55 text-[11px] font-semibold text-[var(--text-muted)] select-none shrink-0 cursor-text rounded-l-[calc(var(--radius-md)-1px)]"
                  >
                    <MoveHorizontal className="size-3.5 sm:hidden" aria-hidden="true" />
                    <span className="hidden sm:inline" aria-hidden="true">
                      Panjang
                    </span>
                    <span className="sr-only">Panjang (cm)</span>
                  </label>
                  <input
                    ref={lengthInputRef}
                    id="calc-length"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    placeholder="0"
                    aria-label="Panjang dalam sentimeter"
                    value={draft.lengthInput}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, lengthInput: e.target.value, unit: 'cm' }))
                    }
                    className="flex-1 w-full min-w-0 bg-transparent px-2.5 sm:px-3 text-right text-base md:text-xs font-medium tabular-nums text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none focus:outline-none focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center justify-center px-2.5 sm:px-3 border-l border-[var(--border)] bg-[var(--surface-muted)]/55 text-[11px] font-semibold text-[var(--text-muted)] select-none shrink-0 rounded-r-[calc(var(--radius-md)-1px)]"
                  >
                    cm
                  </span>
                </div>
              </div>

              {/* Kolom 2: Tinggi (cm) */}
              <div className="min-w-0">
                <div className="flex items-stretch h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] transition-colors duration-150 hover:border-[var(--border-strong)] focus-within:border-[var(--border-strong)]">
                  <label
                    htmlFor="calc-width"
                    title="Tinggi (cm)"
                    className="inline-flex items-center justify-center px-2.5 sm:px-3 border-r border-[var(--border)] bg-[var(--surface-muted)]/55 text-[11px] font-semibold text-[var(--text-muted)] select-none shrink-0 cursor-text rounded-l-[calc(var(--radius-md)-1px)]"
                  >
                    <MoveVertical className="size-3.5 sm:hidden" aria-hidden="true" />
                    <span className="hidden sm:inline" aria-hidden="true">
                      Tinggi
                    </span>
                    <span className="sr-only">Tinggi (cm)</span>
                  </label>
                  <input
                    ref={widthInputRef}
                    id="calc-width"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    placeholder="0"
                    aria-label="Tinggi dalam sentimeter"
                    value={draft.widthInput}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, widthInput: e.target.value, unit: 'cm' }))
                    }
                    className="flex-1 w-full min-w-0 bg-transparent px-2.5 sm:px-3 text-right text-base md:text-xs font-medium tabular-nums text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none focus:outline-none focus-visible:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center justify-center px-2.5 sm:px-3 border-l border-[var(--border)] bg-[var(--surface-muted)]/55 text-[11px] font-semibold text-[var(--text-muted)] select-none shrink-0 rounded-r-[calc(var(--radius-md)-1px)]"
                  >
                    cm
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Material Utama */}
          {availableMaterials.length > 0 && selectedMaterial && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-start gap-1.5">
                <h2 className="text-xs font-medium text-[var(--text-muted)]">
                  Material Utama
                </h2>
                <Link
                  to="/tips-interior?kategori=papan#material-matrix-heading"
                  data-testid="compare-material-btn"
                  aria-label="Bandingkan Material"
                  title="Bandingkan Material"
                  className="inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0"
                >
                  <Info className="size-3.5 shrink-0" aria-hidden="true" />
                </Link>
              </div>
              <EqualOptionGrid
                items={availableMaterials.map((mat) => ({ id: mat.id, label: mat.label }))}
                selectedId={selectedMaterial.id}
                onSelect={(id) => setDraft((prev) => ({ ...prev, materialId: id }))}
                ariaLabel="Material utama"
                testId="custom-material-group"
              />
            </div>
          )}

          {/* Finishing / Laminasi */}
          {availableFinishes.length > 0 && selectedFinish && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-start gap-1.5">
                <h2 className="text-xs font-medium text-[var(--text-muted)]">
                  Finishing / Laminasi
                </h2>
                <Link
                  to="/tips-interior?kategori=finishing#material-matrix-heading"
                  data-testid="compare-finishing-btn"
                  aria-label="Bandingkan Laminasi"
                  title="Bandingkan Laminasi"
                  className="inline-flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0"
                >
                  <Info className="size-3.5 shrink-0" aria-hidden="true" />
                </Link>
              </div>
              <EqualOptionGrid
                items={availableFinishes.map((fin) => ({ id: fin.id, label: fin.label }))}
                selectedId={selectedFinish.id}
                onSelect={(id) => setDraft((prev) => ({ ...prev, finishId: id }))}
                ariaLabel="Finishing/Laminasi"
                testId="custom-finish-group"
              />
            </div>
          )}

          {/* Customisasi & Pilihan Warna — 2 Kolom Sejajar */}
          {(productCustomisasiList.length > 0 || availableColors.length > 0) && (
            <div
              className={
                productCustomisasiList.length > 0 && availableColors.length > 0
                  ? 'grid grid-cols-2 gap-3 sm:gap-4'
                  : 'grid grid-cols-1'
              }
            >
              {productCustomisasiList.length > 0 && (
                <div className="min-w-0 space-y-2.5">
                  <h2 className="text-xs font-medium text-[var(--text-muted)]">
                    Customisasi
                  </h2>
                  <CustomisasiOptionPicker
                    options={productCustomisasiList}
                    value={activeCustomStyleValue}
                    onChange={(val) =>
                      setDraft((prev) => ({ ...prev, customStyleValue: val }))
                    }
                    label="Customisasi"
                    productName={selectedProduct?.nama}
                    className="h-9 text-xs"
                  />
                </div>
              )}

              {availableColors.length > 0 && (
                <div className="min-w-0 space-y-2.5">
                  <h2 className="text-xs font-medium text-[var(--text-muted)]">
                    Pilihan Warna
                  </h2>
                  <ColorOptionPicker
                    colors={availableColors}
                    value={selectedColor.id}
                    onChange={(colorId) => setDraft((prev) => ({ ...prev, colorId }))}
                    label="Pilihan Warna"
                    className="h-9 text-xs"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Live Estimate Card & Direct Actions (Desktop & Tablet) */}
        <div className="hidden md:block lg:col-span-5">
          <CustomLiveSummary
            hasSelectedProduct={Boolean(selectedProduct)}
            itemLabel={selectedProduct?.nama ?? 'Memuat produk'}
            itemCategory={selectedProduct?.kategori}
            productPromo={selectedProduct?.promo}
            finishId={selectedFinish?.id}
            quantity={draft.quantity}
            estimate={estimate}
            actions={
              selectedProduct ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap sm:flex-nowrap items-stretch gap-2.5">
                    <div
                      role="group"
                      aria-label="Jumlah unit"
                      className="w-28 sm:w-32 shrink-0 h-12 inline-flex items-center justify-between border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--surface)]"
                    >
                      <button
                        type="button"
                        aria-label="Kurangi jumlah unit custom"
                        disabled={draft.quantity <= 1}
                        onClick={handleDecreaseQty}
                        className="inline-flex items-center justify-center w-9 sm:w-10 h-full shrink-0 text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-40 rounded-l-[var(--radius-md)] cursor-pointer"
                      >
                        <Minus className="size-4" aria-hidden="true" />
                      </button>
                      <span
                        aria-label={`Jumlah unit: ${draft.quantity}`}
                        className="flex-1 text-center text-sm font-medium tabular-nums text-[var(--text)]"
                      >
                        {draft.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Tambah jumlah unit custom"
                        disabled={draft.quantity >= 20}
                        onClick={handleIncreaseQty}
                        className="inline-flex items-center justify-center w-9 sm:w-10 h-full shrink-0 text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-40 rounded-r-[var(--radius-md)] cursor-pointer"
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </button>
                    </div>

                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={handleSaveToCart}
                      data-testid="custom-desktop-add-to-cart"
                      className="flex-1 min-w-[190px] h-12 px-4 sm:px-5 whitespace-nowrap"
                    >
                      <CartPlusIcon className="size-4 shrink-0" aria-hidden="true" />
                      <span>{editingItem ? 'Simpan Perubahan' : 'Tambah ke Keranjang'}</span>
                    </Button>
                  </div>

                  <ExternalLinkButton
                    href={whatsappConsultationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={handleConsultationClick}
                    aria-label="Konsultasi via WhatsApp"
                    data-testid="custom-desktop-consultation"
                  >
                    <Headset className="size-4 shrink-0" aria-hidden="true" />
                    <span>Konsultasi</span>
                  </ExternalLinkButton>
                </div>
              ) : (
                <ExternalLinkButton
                  href={whatsappConsultationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleConsultationClick}
                  aria-label="Konsultasi via WhatsApp"
                >
                  <Headset className="size-4 shrink-0" aria-hidden="true" />
                  <span>Konsultasi</span>
                </ExternalLinkButton>
              )
            }
          />
        </div>
      </div>
    </section>
  );
}
