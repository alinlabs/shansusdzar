import { useEffect, useMemo, useState } from 'react';
import { Check, Minus, Plus, RotateCcw, ShoppingBag } from 'lucide-react';
import { useSearchParams } from 'react-router';
import customConfiguratorData from '../../../data/konfigurasi-custom-interior.json';
import { Button, ExternalLinkButton } from '../../../components/ui/button';
import { resolveCatalogStartingPrice } from '../../../lib/catalog-pricing';
import { formatCurrencyIDR } from '../../../lib/price-format';
import { buildWhatsAppUrl } from '../../../lib/business-config';
import {
  CUSTOM_SERVICE_MODES,
  DESIGN_COMPATIBLE_OPTION_IDS,
  INDICATIVE_ESTIMATE_CONFIG,
  INDICATIVE_WORKSHOP_ESTIMATE_RULES,
  calculateCustomEstimate,
  getCustomServiceModeLabel,
  getCustomStartingRates,
} from '../../../lib/custom-pricing';
import { useCartStore } from '../../../store/cart-store';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../../store/site-content-store';
import type { DimensionUnit, RoomDimensionsInput } from '../../../types/cart';
import {
  CUSTOM_ADDITIONAL_OPTIONS,
  CUSTOM_COLOR_SWATCHES,
  CUSTOM_FINISHES,
  CUSTOM_ITEM_TYPES,
  CUSTOM_MATERIALS,
  CUSTOM_PROJECT_TYPES,
  type CustomConfiguratorDraft,
  type CustomSelectableItem,
  convertUnitValue,
  createDefaultCustomDraft,
  customItemToDraft,
  formatConvertedDimensionDisplay,
  mapCatalogCategoryToProjectTypeId,
  mapCatalogProductsToSelectableItems,
  parseCustomServiceModeParam,
  validateDimensionsInput,
} from './custom-config';
import { CustomLiveSummary } from './components/custom-live-summary';
import { CustomSchematicPreview } from './components/custom-schematic-preview';

const DIMENSION_PRESETS = customConfiguratorData.presetDimensi;

const FALLBACK_DIMENSIONS: RoomDimensionsInput = {
  length: 300,
  width: 250,
  height: null,
  unit: 'cm',
  normalizedLengthCm: 300,
  normalizedWidthCm: 250,
  normalizedHeightCm: null,
};

export function SectionCustomConfigurator() {
  const [searchParams] = useSearchParams();
  const requestedProductSlug = searchParams.get('produk');
  const requestedServiceMode = parseCustomServiceModeParam(searchParams.get('layanan'));

  const items = useCartStore((state) => state.items);
  const editingCustomLineId = useCartStore((state) => state.editingCustomLineId);
  const setEditingCustomLineId = useCartStore((state) => state.setEditingCustomLineId);
  const saveCustomItem = useCartStore((state) => state.saveCustomItem);
  const openDrawer = useCartStore((state) => state.openDrawer);

  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const customPricing = useSiteContentStore((state) => state.customPricing);
  const catalogOverride = useSiteContentStore((state) => state.catalogOverride);
  const loadedBaseCatalog = useSiteContentStore((state) => state.loadedBaseCatalog);
  const ensureBaseCatalogLoaded = useSiteContentStore((state) => state.ensureBaseCatalogLoaded);

  useEffect(() => {
    void ensureBaseCatalogLoaded();
  }, [ensureBaseCatalogLoaded]);

  const activeCatalog = catalogOverride ?? loadedBaseCatalog;

  const selectableItems = useMemo<CustomSelectableItem[]>(() => {
    const products = activeCatalog?.daftarProduk ?? [];
    if (products.length === 0) return CUSTOM_ITEM_TYPES;
    return mapCatalogProductsToSelectableItems(products, (product) => {
      return resolveCatalogStartingPrice(product, customPricing).label;
    });
  }, [activeCatalog, customPricing]);

  const itemCategories = useMemo(() => {
    const unique = new Set<string>();
    for (const item of selectableItems) {
      if (item.kategori) {
        unique.add(item.kategori);
      }
    }
    return ['Semua', ...Array.from(unique)];
  }, [selectableItems]);

  const [selectedItemCategory, setSelectedItemCategory] = useState<string>('Semua');

  const editingItem = useMemo(() => {
    if (!editingCustomLineId) return null;
    const found = items.find((i) => i.lineId === editingCustomLineId);
    return found && found.kind === 'custom' ? found : null;
  }, [items, editingCustomLineId]);

  const [draft, setDraft] = useState<CustomConfiguratorDraft>(() =>
    createDefaultCustomDraft(requestedServiceMode ?? 'design-and-build')
  );
  const [appliedProductSlug, setAppliedProductSlug] = useState<string | null>(null);

  useEffect(() => {
    if (editingItem) {
      setDraft(customItemToDraft(editingItem));
      return;
    }
    if (requestedServiceMode) {
      setDraft((prev) => ({ ...prev, serviceMode: requestedServiceMode }));
    }
  }, [editingItem, requestedServiceMode]);

  useEffect(() => {
    if (editingItem || !requestedProductSlug || !activeCatalog) return;
    if (appliedProductSlug === requestedProductSlug) return;
    const matched = activeCatalog.daftarProduk.find((p) => p.slug === requestedProductSlug);
    if (!matched) return;

    const mappedProjectTypeId = mapCatalogCategoryToProjectTypeId(matched.kategori);
    const matchedColor =
      matched.pilihanWarna.length > 0
        ? CUSTOM_COLOR_SWATCHES.find(
            (sw) => sw.id === matched.pilihanWarna[0].id || sw.nama === matched.pilihanWarna[0].nama
          )
        : null;

    setDraft((prev) => ({
      ...prev,
      itemTypeId: matched.id,
      projectTypeId: mappedProjectTypeId,
      colorId: matchedColor?.id ?? prev.colorId,
      ...(requestedServiceMode ? { serviceMode: requestedServiceMode } : {}),
    }));
    setSelectedItemCategory('Semua');
    setAppliedProductSlug(requestedProductSlug);
  }, [editingItem, requestedProductSlug, requestedServiceMode, activeCatalog, appliedProductSlug]);

  const dimensionValidation = useMemo(
    () =>
      validateDimensionsInput({
        lengthInput: draft.lengthInput,
        widthInput: draft.widthInput,
        unit: draft.unit,
      }),
    [draft.lengthInput, draft.widthInput, draft.unit]
  );

  const selectedProject =
    CUSTOM_PROJECT_TYPES.find((p) => p.id === draft.projectTypeId) ?? CUSTOM_PROJECT_TYPES[0];
  const selectedItem =
    selectableItems.find((i) => i.id === draft.itemTypeId) ?? selectableItems[0];
  const selectedMaterial =
    CUSTOM_MATERIALS.find((m) => m.id === draft.materialId) ?? CUSTOM_MATERIALS[0];
  const selectedFinish =
    CUSTOM_FINISHES.find((f) => f.id === draft.finishId) ?? CUSTOM_FINISHES[0];
  const selectedColor =
    CUSTOM_COLOR_SWATCHES.find((c) => c.id === draft.colorId) ?? CUSTOM_COLOR_SWATCHES[0];

  const isDesignOnly = draft.serviceMode === 'design-only';
  const activeOptionIds = useMemo(
    () =>
      isDesignOnly
        ? draft.additionalOptionIds.filter((id) => DESIGN_COMPATIBLE_OPTION_IDS.has(id))
        : draft.additionalOptionIds,
    [draft.additionalOptionIds, isDesignOnly]
  );

  const selectedOptionObjects = CUSTOM_ADDITIONAL_OPTIONS.filter((opt) =>
    activeOptionIds.includes(opt.id)
  );
  const selectedOptionLabels = selectedOptionObjects.map((o) => o.label);

  const activeDimensions = dimensionValidation.normalized ?? FALLBACK_DIMENSIONS;

  const activePricingConfig = useMemo(
    () => ({
      mataUang: 'IDR' as const,
      persentaseDp: customPricing?.persentaseDp ?? INDICATIVE_ESTIMATE_CONFIG.persentaseDp,
      hargaCustomTerkonfigurasi:
        customPricing?.hargaCustomTerkonfigurasi ??
        INDICATIVE_ESTIMATE_CONFIG.hargaCustomTerkonfigurasi,
    }),
    [customPricing]
  );

  const activeRules = customPricing?.rules ?? INDICATIVE_WORKSHOP_ESTIMATE_RULES;

  const startingRates = useMemo(
    () => getCustomStartingRates(activePricingConfig, activeRules),
    [activePricingConfig, activeRules]
  );

  const estimate = useMemo(() => {
    return calculateCustomEstimate({
      serviceMode: draft.serviceMode,
      itemTypeId: selectedItem.id,
      materialId: selectedMaterial.id,
      finishId: selectedFinish.id,
      dimensions: activeDimensions,
      additionalOptionIds: activeOptionIds,
      quantity: draft.quantity,
      pricingConfig: activePricingConfig,
      rules: activeRules,
    });
  }, [
    draft.serviceMode,
    activeDimensions,
    selectedItem.id,
    selectedMaterial.id,
    selectedFinish.id,
    activeOptionIds,
    draft.quantity,
    activePricingConfig,
    activeRules,
  ]);

  const filteredSelectableItems = useMemo(() => {
    if (selectedItemCategory === 'Semua') return selectableItems;
    return selectableItems.filter((item) => item.kategori === selectedItemCategory);
  }, [selectableItems, selectedItemCategory]);

  const handleUnitChange = (nextUnit: DimensionUnit) => {
    if (nextUnit === draft.unit) return;
    const prevUnit = draft.unit;

    const convertField = (raw: string) => {
      const parsed = Number(raw.replace(',', '.'));
      if (!raw.trim() || !Number.isFinite(parsed) || parsed <= 0) return raw;
      return String(convertUnitValue(parsed, prevUnit, nextUnit));
    };

    setDraft((prev) => ({
      ...prev,
      unit: nextUnit,
      lengthInput: convertField(prev.lengthInput),
      widthInput: convertField(prev.widthInput),
    }));
  };

  const applyDimensionPreset = (lengthCm: number, widthCm: number) => {
    setDraft((prev) => ({
      ...prev,
      lengthInput: String(prev.unit === 'm' ? convertUnitValue(lengthCm, 'cm', 'm') : lengthCm),
      widthInput: String(prev.unit === 'm' ? convertUnitValue(widthCm, 'cm', 'm') : widthCm),
    }));
  };

  const stepDimensionField = (
    field: 'lengthInput' | 'widthInput',
    delta: number,
    minVal: number,
    maxVal: number
  ) => {
    setDraft((prev) => {
      const currentRaw = Number(prev[field].replace(',', '.'));
      const fallback = prev.unit === 'm' ? 2.5 : 250;
      const base = Number.isFinite(currentRaw) && currentRaw > 0 ? currentRaw : fallback;
      const next = Math.max(minVal, Math.min(maxVal, Math.round((base + delta) * 100) / 100));
      return {
        ...prev,
        [field]: String(next),
      };
    });
  };

  const toggleAdditionalOption = (id: string) => {
    setDraft((prev) => {
      const exists = prev.additionalOptionIds.includes(id);
      return {
        ...prev,
        additionalOptionIds: exists
          ? prev.additionalOptionIds.filter((item) => item !== id)
          : [...prev.additionalOptionIds, id],
      };
    });
  };

  const handleReset = () => {
    setEditingCustomLineId(null);
    setSelectedItemCategory('Semua');
    setDraft(createDefaultCustomDraft(requestedServiceMode ?? 'design-and-build'));
  };

  const handleSaveToCart = () => {
    const safeDims = dimensionValidation.normalized ?? FALLBACK_DIMENSIONS;
    const lineId =
      editingItem?.lineId ??
      `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    saveCustomItem({
      lineId,
      serviceMode: draft.serviceMode,
      serviceModeLabel: getCustomServiceModeLabel(draft.serviceMode),
      projectTypeId: selectedProject.id,
      projectTypeLabel: selectedProject.label,
      itemTypeId: selectedItem.id,
      itemTypeLabel: selectedItem.label,
      dimensions: safeDims,
      materialId: selectedMaterial.id,
      materialLabel: selectedMaterial.label,
      finishId: selectedFinish.id,
      finishLabel: selectedFinish.label,
      colorId: selectedColor.id,
      colorName: selectedColor.nama,
      colorHex: selectedColor.hex,
      additionalOptions: selectedOptionLabels,
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
  };

  const isMeter = draft.unit === 'm';
  const dimStep = isMeter ? 0.1 : 10;
  const horizontalMin = isMeter ? 0.3 : 30;
  const horizontalSliderMax = isMeter ? 10 : 1000;

  const parseNumeric = (raw: string, fallback: number) => {
    const val = Number(raw.replace(',', '.'));
    return Number.isFinite(val) && val > 0 ? val : fallback;
  };

  const lengthVal = parseNumeric(draft.lengthInput, isMeter ? 3 : 300);
  const widthVal = parseNumeric(draft.widthInput, isMeter ? 2.5 : 250);

  const dimText = `${activeDimensions.length} × ${activeDimensions.width} ${activeDimensions.unit}`;
  const serviceModeLabel = getCustomServiceModeLabel(draft.serviceMode);
  const lineTotalFormatted = formatCurrencyIDR(estimate.estimatedLineTotal);

  const selectedMaterialRate = activePricingConfig.hargaCustomTerkonfigurasi
    ? activeRules.hargaBahanPerMeterPersegi[selectedMaterial.id] ?? null
    : null;
  const selectedFinishRate = activePricingConfig.hargaCustomTerkonfigurasi
    ? activeRules.hargaFinishingPerMeterPersegi[selectedFinish.id] ?? null
    : null;
  const currentBuildPerSqm =
    typeof selectedMaterialRate === 'number' &&
    selectedMaterialRate > 0 &&
    typeof selectedFinishRate === 'number' &&
    selectedFinishRate > 0
      ? selectedMaterialRate + selectedFinishRate
      : startingRates.minBuildPerSqm;

  const getModeRateHint = (modeId: (typeof CUSTOM_SERVICE_MODES)[number]['id']): string => {
    if (!activePricingConfig.hargaCustomTerkonfigurasi) return 'Konsultasi';
    if (modeId === 'design-only') {
      const formatted = formatCurrencyIDR(startingRates.designPerSqm);
      return formatted ? `${formatted}/m²` : 'Konsultasi';
    }
    if (modeId === 'build-only') {
      const formatted = formatCurrencyIDR(currentBuildPerSqm);
      return formatted ? `${formatted}/m²` : 'Konsultasi';
    }
    const combined =
      startingRates.designPerSqm !== null && currentBuildPerSqm !== null
        ? startingRates.designPerSqm + currentBuildPerSqm
        : null;
    const formatted = formatCurrencyIDR(combined);
    return formatted ? `${formatted}/m²` : 'Konsultasi';
  };

  const whatsappMessage = [
    `Halo ${businessConfig.namaMerek},`,
    `Saya telah menghitung simulasi custom interior berikut:`,
    `- Layanan: ${serviceModeLabel}`,
    `- Item: ${selectedItem.label}`,
    `- Ruangan: ${selectedProject.label}`,
    `- Ukuran (Panjang × Lebar): ${dimText} (${estimate.areaSquareMeters} m²)`,
    `- ${isDesignOnly ? 'Ref. Material Utama' : 'Material Utama'}: ${selectedMaterial.label}`,
    `- ${isDesignOnly ? 'Ref. Finishing/Laminasi' : 'Finishing/Laminasi'}: ${selectedFinish.label}`,
    `- Palet Warna: ${selectedColor.nama}`,
    selectedOptionLabels.length > 0 ? `- Opsi: ${selectedOptionLabels.join(', ')}` : null,
    `- Jumlah: ${draft.quantity} unit`,
    lineTotalFormatted ? `- Simulasi Estimasi Awal: ${lineTotalFormatted}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const whatsappConsultationUrl = businessConfig
    ? buildDynamicWhatsAppUrl(businessConfig, whatsappMessage)
    : buildWhatsAppUrl(whatsappMessage);

  return (
    <section aria-label="Kalkulator Estimasi Custom Interior" className="space-y-5 sm:space-y-6">
      {editingItem && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[var(--border)]">
          <div className="space-y-0.5">
            <h2 className="text-base sm:text-lg font-semibold text-[var(--text)]">
              Edit Konfigurasi Custom
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              Sesuaikan layanan, ukuran panjang × lebar, material utama, atau finishing/laminasi; hasil estimasi terhitung otomatis.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReset}
            className="self-start shrink-0"
          >
            Batal Edit
          </Button>
        </div>
      )}

      {/* Mobile Instant Estimate Strip */}
      <div className="lg:hidden py-3.5 border-y border-[var(--border)] flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs text-[var(--text-muted)]">
            {serviceModeLabel} · <span className="tabular-nums">{estimate.areaSquareMeters} m²</span>
          </p>
          <p className="text-xl font-semibold text-[var(--text)] tabular-nums truncate">
            {lineTotalFormatted ?? 'Hubungi Kami'}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleSaveToCart} className="shrink-0">
          <ShoppingBag className="size-4" aria-hidden="true" />
          {editingItem ? 'Simpan' : 'Keranjang'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Direct Interactive Calculator Controls */}
        <div className="lg:col-span-7 space-y-7">
          {/* 1. Pilih Jenis Layanan: Desain Saja / Build Saja / Desain + Build */}
          <div className="space-y-4">
            <div className="space-y-0.5">
              <h2 className="text-base sm:text-lg font-semibold text-[var(--text)]">
                1. Pilih Layanan (Desain / Build / Keduanya)
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-muted)]">
                Anda bisa memesan jasa desain 3D saja terlebih dahulu, produksi (build) saja, atau paket lengkap keduanya.
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label="Jenis layanan custom interior"
              className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
            >
              {CUSTOM_SERVICE_MODES.map((mode) => {
                const isSelected = draft.serviceMode === mode.id;
                const rateHint = getModeRateHint(mode.id);
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setDraft((prev) => ({ ...prev, serviceMode: mode.id }))}
                    className={[
                      'text-left p-3.5 rounded-[var(--radius-md)] border transition-colors cursor-pointer space-y-1.5 flex flex-col justify-between',
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--surface-muted)]'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]',
                    ].join(' ')}
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-[var(--text)]">
                          {mode.label}
                        </span>
                      </div>
                      <span className="block text-xs text-[var(--text-muted)] leading-snug">
                        {mode.deskripsi}
                      </span>
                    </div>
                    <span className="block pt-1 text-xs font-semibold text-[var(--text)] tabular-nums">
                      {rateHint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Ukuran Panjang × Lebar */}
          <div className="pt-6 border-t border-[var(--border)] space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="text-base sm:text-lg font-semibold text-[var(--text)]">
                  2. Ukuran Bidang (Panjang × Lebar)
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-muted)]">
                  Masukkan panjang dan lebar bidang untuk menghitung luas meter persegi (m²).
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div
                  role="group"
                  aria-label="Satuan ukuran"
                  className="inline-flex p-1 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-md)]"
                >
                  {(['cm', 'm'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      aria-pressed={draft.unit === u}
                      onClick={() => handleUnitChange(u)}
                      className={[
                        'min-h-8 px-3 text-xs font-medium rounded-[calc(var(--radius-md)-2px)] transition-colors cursor-pointer whitespace-nowrap',
                        draft.unit === u
                          ? 'bg-[var(--surface-muted)] text-[var(--text)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text)]',
                      ].join(' ')}
                    >
                      {u}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  title="Kembalikan hitungan standar"
                  aria-label="Reset hitungan ke standar"
                  className="inline-flex items-center justify-center min-h-10 min-w-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors cursor-pointer"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Preset ukuran cepat">
              {DIMENSION_PRESETS.map((preset) => {
                const isActive =
                  Math.round(activeDimensions.normalizedLengthCm) === preset.panjangCm &&
                  Math.round(activeDimensions.normalizedWidthCm) === preset.lebarCm;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => applyDimensionPreset(preset.panjangCm, preset.lebarCm)}
                    className={[
                      'min-h-9 px-3 text-xs font-medium rounded-[var(--radius-md)] border transition-colors cursor-pointer whitespace-nowrap',
                      isActive
                        ? 'border-[var(--accent)] bg-[var(--surface-muted)] text-[var(--text)]'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)]',
                    ].join(' ')}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Sliders + Steppers: Panjang & Lebar Only */}
            <div className="space-y-5">
              {/* Panjang */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="calc-length"
                    className="text-xs sm:text-sm font-medium text-[var(--text)]"
                  >
                    Panjang ({draft.unit})
                  </label>
                  <div className="inline-flex items-center border border-[var(--border)] rounded-[var(--radius-sm)] bg-[var(--surface)]">
                    <button
                      type="button"
                      aria-label="Kurangi panjang"
                      onClick={() =>
                        stepDimensionField(
                          'lengthInput',
                          -dimStep,
                          horizontalMin,
                          isMeter ? 30 : 3000
                        )
                      }
                      className="inline-flex items-center justify-center min-h-9 min-w-9 text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
                    >
                      <Minus className="size-3.5" aria-hidden="true" />
                    </button>
                    <input
                      id="calc-length"
                      type="number"
                      inputMode="decimal"
                      step={isMeter ? '0.05' : '1'}
                      min={horizontalMin}
                      max={isMeter ? 30 : 3000}
                      value={draft.lengthInput}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, lengthInput: e.target.value }))
                      }
                      className="w-16 text-center text-sm font-semibold text-[var(--text)] bg-transparent outline-none focus:outline-none focus-visible:outline-none tabular-nums"
                    />
                    <button
                      type="button"
                      aria-label="Tambah panjang"
                      onClick={() =>
                        stepDimensionField(
                          'lengthInput',
                          dimStep,
                          horizontalMin,
                          isMeter ? 30 : 3000
                        )
                      }
                      className="inline-flex items-center justify-center min-h-9 min-w-9 text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  aria-label="Geser panjang"
                  min={horizontalMin}
                  max={horizontalSliderMax}
                  step={dimStep}
                  value={Math.min(horizontalSliderMax, Math.max(horizontalMin, lengthVal))}
                  onChange={(e) => setDraft((prev) => ({ ...prev, lengthInput: e.target.value }))}
                  className="w-full h-2 rounded-full bg-[var(--surface-muted)] accent-[var(--accent)] cursor-pointer"
                />
                {dimensionValidation.errors.length && (
                  <p className="text-xs text-[var(--danger)]">{dimensionValidation.errors.length}</p>
                )}
              </div>

              {/* Lebar */}
              <div className="pt-4 border-t border-[var(--border)] space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="calc-width"
                    className="text-xs sm:text-sm font-medium text-[var(--text)]"
                  >
                    Lebar ({draft.unit})
                  </label>
                  <div className="inline-flex items-center border border-[var(--border)] rounded-[var(--radius-sm)] bg-[var(--surface)]">
                    <button
                      type="button"
                      aria-label="Kurangi lebar"
                      onClick={() =>
                        stepDimensionField(
                          'widthInput',
                          -dimStep,
                          horizontalMin,
                          isMeter ? 30 : 3000
                        )
                      }
                      className="inline-flex items-center justify-center min-h-9 min-w-9 text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
                    >
                      <Minus className="size-3.5" aria-hidden="true" />
                    </button>
                    <input
                      id="calc-width"
                      type="number"
                      inputMode="decimal"
                      step={isMeter ? '0.05' : '1'}
                      min={horizontalMin}
                      max={isMeter ? 30 : 3000}
                      value={draft.widthInput}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, widthInput: e.target.value }))
                      }
                      className="w-16 text-center text-sm font-semibold text-[var(--text)] bg-transparent outline-none focus:outline-none focus-visible:outline-none tabular-nums"
                    />
                    <button
                      type="button"
                      aria-label="Tambah lebar"
                      onClick={() =>
                        stepDimensionField(
                          'widthInput',
                          dimStep,
                          horizontalMin,
                          isMeter ? 30 : 3000
                        )
                      }
                      className="inline-flex items-center justify-center min-h-9 min-w-9 text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  aria-label="Geser lebar"
                  min={horizontalMin}
                  max={horizontalSliderMax}
                  step={dimStep}
                  value={Math.min(horizontalSliderMax, Math.max(horizontalMin, widthVal))}
                  onChange={(e) => setDraft((prev) => ({ ...prev, widthInput: e.target.value }))}
                  className="w-full h-2 rounded-full bg-[var(--surface-muted)] accent-[var(--accent)] cursor-pointer"
                />
                {dimensionValidation.errors.width && (
                  <p className="text-xs text-[var(--danger)]">{dimensionValidation.errors.width}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)] tabular-nums pt-1">
              <span>{formatConvertedDimensionDisplay(activeDimensions)}</span>
              <span className="font-medium text-[var(--text)]">
                Luas hitung (P × L): {estimate.areaSquareMeters} m²
              </span>
            </div>
          </div>

          {/* 3. Material Utama, Finishing/Laminasi & Warna */}
          <div className="pt-6 border-t border-[var(--border)] space-y-5">
            <div className="space-y-3">
              <div className="space-y-0.5">
                <h2 className="text-base sm:text-lg font-semibold text-[var(--text)]">
                  3. {isDesignOnly ? 'Referensi Material Utama, Finishing/Laminasi & Warna Desain' : 'Material Utama, Finishing/Laminasi & Warna'}
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-muted)]">
                  {isDesignOnly
                    ? 'Mode Desain Saja aktif: pilihan material utama, finishing/laminasi, dan warna di bawah digunakan sebagai referensi visual 3D tanpa biaya produksi.'
                    : 'Luas bidang dikalikan harga per meter persegi material utama dan finishing/laminasi, lalu digabungkan.'}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs sm:text-sm font-medium text-[var(--text)]">
                  {isDesignOnly ? 'Referensi Material Utama' : 'Pilih Material Utama'}
                </p>
                <div
                  role="radiogroup"
                  aria-label="Material utama"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                >
                  {CUSTOM_MATERIALS.map((mat) => {
                    const isSelected = mat.id === draft.materialId;
                    const rate =
                      !isDesignOnly && activePricingConfig.hargaCustomTerkonfigurasi
                        ? activeRules.hargaBahanPerMeterPersegi[mat.id]
                        : null;
                    const rateLabel = formatCurrencyIDR(rate);
                    return (
                      <button
                        key={mat.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setDraft((prev) => ({ ...prev, materialId: mat.id }))}
                        className={[
                          'text-left p-3.5 rounded-[var(--radius-md)] border transition-colors cursor-pointer space-y-1',
                          isSelected
                            ? 'border-[var(--accent)] bg-[var(--surface-muted)]'
                            : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]',
                        ].join(' ')}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-[var(--text)]">{mat.label}</span>
                          {isDesignOnly ? (
                            <span className="text-[11px] font-medium text-[var(--text-muted)] shrink-0">
                              Referensi
                            </span>
                          ) : (
                            rateLabel && (
                              <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums shrink-0">
                                {rateLabel}/m²
                              </span>
                            )
                          )}
                        </div>
                        <span className="block text-xs text-[var(--text-muted)] leading-snug">
                          {mat.deskripsi}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--border)] space-y-2.5">
              <p className="text-xs sm:text-sm font-medium text-[var(--text)]">
                {isDesignOnly ? 'Referensi Finishing/Laminasi' : 'Pilih Finishing/Laminasi'}
              </p>
              <div
                role="radiogroup"
                aria-label="Finishing/Laminasi"
                className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
              >
                {CUSTOM_FINISHES.map((fin) => {
                  const isSelected = fin.id === draft.finishId;
                  const rate =
                    !isDesignOnly && activePricingConfig.hargaCustomTerkonfigurasi
                      ? activeRules.hargaFinishingPerMeterPersegi[fin.id]
                      : null;
                  const rateLabel = formatCurrencyIDR(rate);
                  return (
                    <button
                      key={fin.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setDraft((prev) => ({ ...prev, finishId: fin.id }))}
                      className={[
                        'text-left p-3.5 rounded-[var(--radius-md)] border transition-colors cursor-pointer space-y-1',
                        isSelected
                          ? 'border-[var(--accent)] bg-[var(--surface-muted)] text-[var(--text)]'
                          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)]',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-[var(--text)]">
                          {fin.label}
                        </span>
                        {isDesignOnly ? (
                          <span className="text-[11px] font-medium text-[var(--text-muted)] shrink-0">
                            Referensi
                          </span>
                        ) : (
                          rateLabel && (
                            <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums shrink-0">
                              {rateLabel}/m²
                            </span>
                          )
                        )}
                      </div>
                      <span className="block text-xs text-[var(--text-muted)] leading-snug">
                        {fin.deskripsi}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--border)] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs sm:text-sm font-medium text-[var(--text)]">Palet Warna</p>
                <span className="text-xs text-[var(--text-muted)]">{selectedColor.nama}</span>
              </div>
              <div
                role="radiogroup"
                aria-label="Palet warna"
                className="grid grid-cols-2 sm:grid-cols-4 gap-2"
              >
                {CUSTOM_COLOR_SWATCHES.map((swatch) => {
                  const isSelected = swatch.id === draft.colorId;
                  return (
                    <button
                      key={swatch.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${swatch.nama}, ${swatch.catatanNuansa}`}
                      onClick={() => setDraft((prev) => ({ ...prev, colorId: swatch.id }))}
                      className={[
                        'flex items-center gap-2.5 p-2.5 rounded-[var(--radius-md)] border text-left transition-colors cursor-pointer',
                        isSelected
                          ? 'border-[var(--accent)] bg-[var(--surface-muted)]'
                          : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]',
                      ].join(' ')}
                    >
                      <span
                        className="size-6 rounded-[var(--radius-sm)] border border-[var(--border-strong)] shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: swatch.hex }}
                        aria-hidden="true"
                      >
                        {isSelected && (
                          <Check
                            className={[
                              'size-3.5',
                              ['gading-hangat', 'gandum-alami', 'kayu-muda'].includes(swatch.id)
                                ? 'text-[#18181b]'
                                : 'text-white',
                            ].join(' ')}
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <span className="text-xs font-medium text-[var(--text)] truncate">
                        {swatch.nama}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. Daftar Produk / Jenis Furniture & Area Ruangan */}
          <div className="pt-6 border-t border-[var(--border)] space-y-5">
            <div className="space-y-3">
              <div className="space-y-0.5">
                <h2 className="text-base sm:text-lg font-semibold text-[var(--text)]">
                  4. Unit Produk / Jenis Furniture &amp; Area Ruangan
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-muted)]">
                  Daftar unit tersinkronisasi langsung dengan daftar produk aktif. Pilih unit atau paket penataan ruang.
                </p>
              </div>

              {itemCategories.length > 2 && (
                <div
                  role="group"
                  aria-label="Filter kategori unit produk"
                  className="flex items-center gap-4 overflow-x-auto border-b border-[var(--border)] pb-0 -mx-4 px-4 sm:mx-0 sm:px-0"
                >
                  {itemCategories.map((cat) => {
                    const isCatActive = selectedItemCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        aria-pressed={isCatActive}
                        onClick={() => setSelectedItemCategory(cat)}
                        className={[
                          'relative min-h-10 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 -mb-px',
                          isCatActive
                            ? 'border-[var(--accent)] text-[var(--text)]'
                            : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]',
                        ].join(' ')}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              )}

              <div
                role="radiogroup"
                aria-label="Jenis item custom"
                className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto overflow-x-hidden pr-0.5"
              >
                {filteredSelectableItems.map((option) => {
                  const isSelected = option.id === draft.itemTypeId;
                  const metaLine = option.kategori
                    ? option.hargaProdukLabel
                      ? `${option.kategori} · ${option.hargaProdukLabel}`
                      : option.kategori
                    : null;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          itemTypeId: option.id,
                          ...(option.kategori
                            ? { projectTypeId: mapCatalogCategoryToProjectTypeId(option.kategori) }
                            : {}),
                        }))
                      }
                      className={[
                        'text-left p-3.5 rounded-[var(--radius-md)] border transition-colors cursor-pointer space-y-1',
                        isSelected
                          ? 'border-[var(--accent)] bg-[var(--surface-muted)]'
                          : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]',
                      ].join(' ')}
                    >
                      <span className="block text-sm font-semibold text-[var(--text)]">
                        {option.label}
                      </span>
                      {metaLine && (
                        <span className="block text-[11px] font-medium text-[var(--text-muted)] tabular-nums">
                          {metaLine}
                        </span>
                      )}
                      <span className="block text-xs text-[var(--text-muted)] leading-snug line-clamp-2">
                        {option.deskripsi}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--border)] space-y-2.5">
              <p className="text-xs sm:text-sm font-medium text-[var(--text)]">Area Ruangan</p>
              <div role="radiogroup" aria-label="Jenis ruangan" className="flex flex-wrap gap-2">
                {CUSTOM_PROJECT_TYPES.map((room) => {
                  const isSelected = room.id === draft.projectTypeId;
                  return (
                    <button
                      key={room.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setDraft((prev) => ({ ...prev, projectTypeId: room.id }))}
                      className={[
                        'min-h-9 px-3.5 text-xs font-medium rounded-[var(--radius-md)] border transition-colors cursor-pointer whitespace-nowrap',
                        isSelected
                          ? 'border-[var(--accent)] bg-[var(--surface-muted)] text-[var(--text)]'
                          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)]',
                      ].join(' ')}
                    >
                      {room.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 5. Kelengkapan & Jumlah Unit */}
          <div className="pt-6 border-t border-[var(--border)] space-y-5">
            <div className="space-y-3">
              <div className="space-y-0.5">
                <h2 className="text-base sm:text-lg font-semibold text-[var(--text)]">
                  5. Kelengkapan &amp; Jumlah Unit
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-muted)]">
                  Tambahkan kelengkapan opsional sesuai kebutuhan penggunaan.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CUSTOM_ADDITIONAL_OPTIONS.map((opt) => {
                  const isBuildOnlyOpt = !DESIGN_COMPATIBLE_OPTION_IDS.has(opt.id);
                  const disabledByMode = isDesignOnly && isBuildOnlyOpt;
                  const isChecked = !disabledByMode && draft.additionalOptionIds.includes(opt.id);
                  const fee = activePricingConfig.hargaCustomTerkonfigurasi
                    ? activeRules.biayaTambahanOpsi[opt.id]
                    : null;
                  const feeLabel = disabledByMode
                    ? 'Khusus mode Build'
                    : !activePricingConfig.hargaCustomTerkonfigurasi
                      ? 'Konsultasi'
                      : typeof fee === 'number' && fee > 0
                        ? `+ ${formatCurrencyIDR(fee)}`
                        : 'Gratis';
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="checkbox"
                      aria-checked={isChecked}
                      disabled={disabledByMode}
                      onClick={() => toggleAdditionalOption(opt.id)}
                      className={[
                        'text-left p-3.5 rounded-[var(--radius-md)] border transition-colors flex items-start gap-3',
                        disabledByMode
                          ? 'border-[var(--border)] bg-[var(--surface)] opacity-55 cursor-not-allowed'
                          : isChecked
                            ? 'border-[var(--accent)] bg-[var(--surface-muted)] cursor-pointer'
                            : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] cursor-pointer',
                      ].join(' ')}
                    >
                      <span
                        aria-hidden="true"
                        className={[
                          'mt-0.5 size-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors',
                          isChecked
                            ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-fg)]'
                            : 'border-[var(--border-strong)] bg-[var(--surface)]',
                        ].join(' ')}
                      >
                        {isChecked && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs sm:text-sm font-semibold text-[var(--text)]">
                            {opt.label}
                          </span>
                        </span>
                        <span className="block text-xs font-medium text-[var(--text-muted)] tabular-nums">
                          {feeLabel}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--text)]">Jumlah Unit / Set</p>
                <p className="text-xs text-[var(--text-muted)]">Kalikan estimasi jika butuh beberapa set.</p>
              </div>
              <div className="inline-flex items-center border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--surface)]">
                <button
                  type="button"
                  aria-label="Kurangi jumlah unit custom"
                  disabled={draft.quantity <= 1}
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))
                  }
                  className="inline-flex items-center justify-center min-h-10 min-w-10 text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-40 rounded-l-[var(--radius-md)] cursor-pointer"
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <span className="px-4 text-sm font-semibold tabular-nums text-[var(--text)]">
                  {draft.quantity}
                </span>
                <button
                  type="button"
                  aria-label="Tambah jumlah unit custom"
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, quantity: Math.min(20, prev.quantity + 1) }))
                  }
                  className="inline-flex items-center justify-center min-h-10 min-w-10 text-[var(--text)] hover:bg-[var(--surface-muted)] rounded-r-[var(--radius-md)] cursor-pointer"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Right Panel: Live Estimate Result, Visual Schematic & Direct Actions */}
        <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-5">
          <CustomLiveSummary
            projectLabel={selectedProject.label}
            itemLabel={selectedItem.label}
            dimensions={activeDimensions}
            materialLabel={selectedMaterial.label}
            finishLabel={selectedFinish.label}
            colorName={selectedColor.nama}
            colorHex={selectedColor.hex}
            optionLabels={selectedOptionLabels}
            quantity={draft.quantity}
            estimate={estimate}
            actions={
              <div className="flex flex-col gap-2.5">
                <Button variant="primary" size="lg" onClick={handleSaveToCart} className="w-full">
                  <ShoppingBag className="size-4" aria-hidden="true" />
                  {editingItem ? 'Simpan Perubahan ke Keranjang' : 'Tambah ke Keranjang'}
                </Button>
                <ExternalLinkButton
                  href={whatsappConsultationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  size="lg"
                  className="w-full"
                >
                  Konsultasikan via WhatsApp
                </ExternalLinkButton>
              </div>
            }
          />

          <CustomSchematicPreview
            dimensions={activeDimensions}
            itemLabel={selectedItem.label}
            colorName={selectedColor.nama}
            colorHex={selectedColor.hex}
          />
        </div>
      </div>
    </section>
  );
}
