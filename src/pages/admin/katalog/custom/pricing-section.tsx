import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Calculator } from 'lucide-react';
import { Checkbox, CurrencyInput, FormField, Input, Select } from '../../../../components/ui/form-controls';
import { formatCurrencyIDR } from '../../../../lib/price-format';
import {
  DEFAULT_CUSTOM_PRICING_RULES,
  PRODUCT_PRICING_CATEGORIES,
  UNIFIED_SERVICE_MODE_LABEL,
  calculateCustomEstimate,
  formatPricingUnitLabel,
  type ProductGroupPricingRule,
  type ProductPricingCategoryKey,
} from '../../../../lib/custom-pricing';
import type { CustomInteriorPricingConfig } from '../../../../types/cms';
import { useSiteContentStore } from '../../../../store/site-content-store';
import {
  CUSTOM_FINISHES,
  CUSTOM_MATERIALS,
  buildCustomFinishesFromSpecs,
  buildCustomMaterialsFromSpecs,
} from '../../../produk/custom/custom-config';

interface SectionAdminCustomPricingProps {
  formId?: string;
  pricing: CustomInteriorPricingConfig;
  canEdit: boolean;
  onSavePricing: (next: CustomInteriorPricingConfig) => void;
}

function getCategoryRuleFromDraft(
  draft: CustomInteriorPricingConfig,
  catId: ProductPricingCategoryKey,
  catLabel: string,
  catUnit: 'm' | 'm2'
): ProductGroupPricingRule {
  const existing = draft.rules.tarifPerKategori?.[catId];
  if (existing) return existing;
  const fallback = DEFAULT_CUSTOM_PRICING_RULES.tarifPerKategori?.[catId];
  if (fallback) return structuredClone(fallback);
  return {
    id: catId,
    label: catLabel,
    satuan: 'm2',
    hplPerSatuan: { blockboard: 1800000, multipleks: 2500000, pvc: 3500000 },
    ducoPerSatuan: { blockboard: 4500000, multipleks: 4500000, pvc: 4500000 },
  };
}

export function SectionAdminCustomPricing({
  formId = 'custom-interior-pricing-form',
  pricing,
  canEdit,
  onSavePricing,
}: SectionAdminCustomPricingProps) {
  const materialsSpecs = useSiteContentStore((state) => state.materials);
  const storeMaterials = useMemo(() => {
    const built = buildCustomMaterialsFromSpecs(materialsSpecs);
    return built.length > 0 ? built : CUSTOM_MATERIALS;
  }, [materialsSpecs]);
  const storeFinishes = useMemo(() => {
    const built = buildCustomFinishesFromSpecs(materialsSpecs);
    return built.length > 0 ? built : CUSTOM_FINISHES;
  }, [materialsSpecs]);

  const [draft, setDraft] = useState<CustomInteriorPricingConfig>(() => structuredClone(pricing));

  useEffect(() => {
    setDraft(structuredClone(pricing));
  }, [pricing]);

  const [simCategoryId, setSimCategoryId] = useState<ProductPricingCategoryKey>('kitchen-set');
  const [simMaterialId, setSimMaterialId] = useState(
    storeMaterials.find((m) => m.id === 'blockboard')?.id ?? storeMaterials[0].id
  );
  const [simFinishId, setSimFinishId] = useState(storeFinishes[0].id);
  const [simLengthCm, setSimLengthCm] = useState(200);
  const [simWidthCm, setSimWidthCm] = useState(220);

  const simCategoryMeta =
    PRODUCT_PRICING_CATEGORIES.find((c) => c.id === simCategoryId) ??
    PRODUCT_PRICING_CATEGORIES[0];

  const simEstimate = useMemo(() => {
    const safeLength = Math.max(1, Number.isFinite(simLengthCm) ? simLengthCm : 200);
    const safeWidth = Math.max(1, Number.isFinite(simWidthCm) ? simWidthCm : 220);
    return calculateCustomEstimate({
      serviceMode: 'design-and-build',
      itemTypeId: simCategoryId,
      itemLabel: simCategoryMeta.label,
      materialId: simMaterialId,
      finishId: simFinishId,
      dimensions: {
        length: safeLength,
        width: safeWidth,
        height: null,
        unit: 'cm',
        normalizedLengthCm: safeLength,
        normalizedWidthCm: safeWidth,
        normalizedHeightCm: null,
      },
      additionalOptionIds: [],
      quantity: 1,
      pricingConfig: {
        mataUang: 'IDR',
        persentaseDp: draft.persentaseDp,
        hargaCustomTerkonfigurasi: draft.hargaCustomTerkonfigurasi,
      },
      rules: {
        ...draft.rules,
        biayaTambahanOpsi: {},
      },
    });
  }, [
    simCategoryId,
    simCategoryMeta.label,
    simMaterialId,
    simFinishId,
    simLengthCm,
    simWidthCm,
    draft,
  ]);

  const updateCategoryRule = (
    catId: ProductPricingCategoryKey,
    catLabel: string,
    catUnit: 'm' | 'm2',
    updater: (rule: ProductGroupPricingRule) => ProductGroupPricingRule
  ) => {
    setDraft((prev) => {
      const current = getCategoryRuleFromDraft(prev, catId, catLabel, catUnit);
      const updated = updater(structuredClone(current));
      return {
        ...prev,
        rules: {
          ...prev.rules,
          tarifPerKategori: {
            ...(prev.rules.tarifPerKategori ?? {}),
            [catId]: updated,
          },
        },
      };
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    onSavePricing(structuredClone(draft));
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start">
        <div className="xl:col-span-8 space-y-5 sm:space-y-6">
          <section className="p-4 sm:p-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-4">
            <h2 className="text-sm sm:text-base font-semibold text-[var(--text)]">
              Status &amp; Uang Muka (DP)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="space-y-3">
                <Checkbox
                  label="Tampilkan Estimasi Harga Otomatis"
                  disabled={!canEdit}
                  checked={draft.hargaCustomTerkonfigurasi}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      hargaCustomTerkonfigurasi: e.target.checked,
                    }))
                  }
                />
              </div>

              <FormField
                id="custom-dp-pct"
                label="Persentase DP (%)"
              >
                <Input
                  id="custom-dp-pct"
                  type="number"
                  min={5}
                  max={100}
                  step={5}
                  disabled={!canEdit}
                  value={draft.persentaseDp}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      persentaseDp: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                    }))
                  }
                />
              </FormField>
            </div>
          </section>

          <section className="p-4 sm:p-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-4">
            <h2 className="text-sm sm:text-base font-semibold text-[var(--text)]">
              Matriks Tarif per Kategori
            </h2>

            <div className="space-y-4">
              {PRODUCT_PRICING_CATEGORIES.map((cat) => {
                const rule = getCategoryRuleFromDraft(draft, cat.id, cat.label, cat.satuan);
                const unitLabel = formatPricingUnitLabel(rule.satuan);
                const ducoValues = storeMaterials
                  .map((m) => rule.ducoPerSatuan?.[m.id] ?? 0)
                  .filter((v) => v > 0);
                const ducoMinVal = ducoValues.length > 0 ? Math.min(...ducoValues) : 4500000;

                return (
                  <div
                    key={cat.id}
                    className="border border-[var(--border)] rounded-[var(--radius-md)] p-4 space-y-4 bg-[var(--bg)]/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--text)]">{cat.label}</h3>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Satuan hitung: per {rule.satuan === 'm2' ? 'meter persegi (/m²)' : 'meter lari (/m)'} · Gratis Desain 3D
                        </p>
                      </div>
                      <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                        Duco mulai {formatCurrencyIDR(ducoMinVal)}/{unitLabel}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Finishing HPL
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {storeMaterials.map((mat) => {
                          const val = rule.hplPerSatuan?.[mat.id] ?? 0;
                          return (
                            <div key={`hpl-${mat.id}`} className="space-y-2">
                              <p className="text-xs font-medium text-[var(--text)]">
                                {mat.label} 18 mm (HPL) / {unitLabel}
                              </p>
                              <CurrencyInput
                                disabled={!canEdit}
                                aria-label={`Tarif ${cat.label} ${mat.label} HPL per ${unitLabel}`}
                                value={val}
                                onValueChange={(nextVal) =>
                                  updateCategoryRule(cat.id, cat.label, cat.satuan, (prevRule) => ({
                                    ...prevRule,
                                    hplPerSatuan: {
                                      ...prevRule.hplPerSatuan,
                                      [mat.id]: nextVal,
                                    },
                                  }))
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-[var(--border)]/60">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Finishing Cat Duco
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {storeMaterials.map((mat) => {
                          const val = rule.ducoPerSatuan?.[mat.id] ?? 0;
                          return (
                            <div key={`duco-${mat.id}`} className="space-y-2">
                              <p className="text-xs font-medium text-[var(--text)]">
                                {mat.label} 18 mm (Cat Duco) / {unitLabel}
                              </p>
                              <CurrencyInput
                                disabled={!canEdit}
                                aria-label={`Tarif ${cat.label} ${mat.label} Cat Duco per ${unitLabel}`}
                                value={val}
                                onValueChange={(nextVal) =>
                                  updateCategoryRule(cat.id, cat.label, cat.satuan, (prevRule) => ({
                                    ...prevRule,
                                    ducoPerSatuan: {
                                      ...prevRule.ducoPerSatuan,
                                      [mat.id]: nextVal,
                                    },
                                  }))
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="p-4 sm:p-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-1.5">
            <h2 className="text-sm sm:text-base font-semibold text-[var(--text)]">
              Kelengkapan &amp; Material
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Kelengkapan produk diatur di menu Produk. Penjelasan material diatur di menu Material.
            </p>
          </section>
        </div>

        <aside className="xl:col-span-4 xl:sticky xl:top-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Calculator className="size-4 text-[var(--text-muted)]" aria-hidden="true" />
            <h2 className="text-sm sm:text-base font-semibold text-[var(--text)]">
              Simulasi Harga
            </h2>
          </div>

          <div className="space-y-3">
            <FormField id="sim-category" label="Kategori Tarif">
              <Select
                id="sim-category"
                value={simCategoryId}
                onChange={(e) => setSimCategoryId(e.target.value as ProductPricingCategoryKey)}
              >
                {PRODUCT_PRICING_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label} (/{formatPricingUnitLabel(cat.satuan)})
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField id="sim-mat" label="Material Utama (18 mm)">
              <Select
                id="sim-mat"
                value={simMaterialId}
                onChange={(e) => setSimMaterialId(e.target.value)}
              >
                {storeMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField id="sim-fin" label="Finishing/Laminasi">
              <Select
                id="sim-fin"
                value={simFinishId}
                onChange={(e) => setSimFinishId(e.target.value)}
              >
                {storeFinishes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField id="sim-len" label="Panjang (cm)">
                <Input
                  id="sim-len"
                  type="number"
                  min={1}
                  step={10}
                  value={simLengthCm}
                  onChange={(e) => setSimLengthCm(Number(e.target.value) || 100)}
                />
              </FormField>
              <FormField id="sim-wid" label="Tinggi (cm)">
                <Input
                  id="sim-wid"
                  type="number"
                  min={1}
                  step={10}
                  value={simWidthCm}
                  onChange={(e) => setSimWidthCm(Number(e.target.value) || 220)}
                />
              </FormField>
            </div>
          </div>

          <dl className="pt-4 border-t border-[var(--border)] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-[var(--text-muted)]">
                {simEstimate.pricingUnit === 'm2' ? 'Luas Hitung (P × T)' : 'Panjang Hitung'}
              </dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {simEstimate.measureQuantity} {simEstimate.pricingUnitLabel}
              </dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-[var(--text-muted)]">Jasa Desain 3D</dt>
              <dd className="font-medium text-[var(--success)]">Gratis (Termasuk)</dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-[var(--text-muted)]">
                Tarif / {simEstimate.pricingUnitLabel}
              </dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {formatCurrencyIDR(simEstimate.unitRate) ?? 'Konsultasi'}
              </dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-[var(--text-muted)]">Subtotal Build</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {formatCurrencyIDR(simEstimate.buildAmount) ?? 'Konsultasi'}
              </dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-[var(--text-muted)]">Opsi Kelengkapan</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {simEstimate.status === 'configured'
                  ? formatCurrencyIDR(simEstimate.optionsAmount ?? 0) ?? 'Rp 0'
                  : '-'}
              </dd>
            </div>
            <div className="pt-2 border-t border-[var(--border)] flex items-baseline justify-between gap-2">
              <dt className="font-semibold text-[var(--text)]">Total Estimasi</dt>
              <dd className="text-right tabular-nums">
                <span className="text-base font-bold text-[var(--text)]">
                  {simFinishId === 'cat-duco' && simEstimate.estimatedLineTotal
                    ? `Mulai ${formatCurrencyIDR(simEstimate.estimatedLineTotal)}`
                    : formatCurrencyIDR(simEstimate.estimatedLineTotal) ?? 'Konsultasi Harga'}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--text-muted)]">
                Perkiraan DP ({simEstimate.dpPercentage ?? draft.persentaseDp}%)
              </dt>
              <dd className="font-semibold text-[var(--success)] tabular-nums">
                {formatCurrencyIDR(simEstimate.estimatedDpLineTotal) ?? '-'}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </form>
  );
}
