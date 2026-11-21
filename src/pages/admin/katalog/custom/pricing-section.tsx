import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Calculator } from 'lucide-react';
import { Checkbox, CurrencyInput, FormField, Input, Select } from '../../../../components/ui/form-controls';
import { formatCurrencyIDR } from '../../../../lib/price-format';
import {
  CUSTOM_SERVICE_MODES,
  calculateCustomEstimate,
  type CustomServiceMode,
} from '../../../../lib/custom-pricing';
import type { CustomInteriorPricingConfig } from '../../../../types/cms';
import {
  CUSTOM_ADDITIONAL_OPTIONS,
  CUSTOM_FINISHES,
  CUSTOM_ITEM_TYPES,
  CUSTOM_MATERIALS,
} from '../../../produk/custom/custom-config';

interface SectionAdminCustomPricingProps {
  formId?: string;
  pricing: CustomInteriorPricingConfig;
  canEdit: boolean;
  onSavePricing: (next: CustomInteriorPricingConfig) => void;
}

export function SectionAdminCustomPricing({
  formId = 'custom-interior-pricing-form',
  pricing,
  canEdit,
  onSavePricing,
}: SectionAdminCustomPricingProps) {
  const [draft, setDraft] = useState<CustomInteriorPricingConfig>(() => structuredClone(pricing));

  useEffect(() => {
    setDraft(structuredClone(pricing));
  }, [pricing]);

  const [simServiceMode, setSimServiceMode] = useState<CustomServiceMode>('design-and-build');
  const [simItemId, setSimItemId] = useState(CUSTOM_ITEM_TYPES[0].id);
  const [simMaterialId, setSimMaterialId] = useState(
    CUSTOM_MATERIALS[3]?.id ?? CUSTOM_MATERIALS[0].id
  );
  const [simFinishId, setSimFinishId] = useState(
    CUSTOM_FINISHES[2]?.id ?? CUSTOM_FINISHES[0].id
  );
  const [simLengthCm, setSimLengthCm] = useState(300);
  const [simWidthCm, setSimWidthCm] = useState(250);
  const [simSelectedOptionIds, setSimSelectedOptionIds] = useState<string[]>(['soft-close']);

  const promoActive = Boolean(draft.rules.promoAktif);

  const simEstimate = useMemo(() => {
    const safeLength = Math.max(30, Number.isFinite(simLengthCm) ? simLengthCm : 300);
    const safeWidth = Math.max(30, Number.isFinite(simWidthCm) ? simWidthCm : 250);
    return calculateCustomEstimate({
      serviceMode: simServiceMode,
      itemTypeId: simItemId,
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
      additionalOptionIds: simSelectedOptionIds,
      quantity: 1,
      pricingConfig: {
        mataUang: 'IDR',
        persentaseDp: draft.persentaseDp,
        hargaCustomTerkonfigurasi: draft.hargaCustomTerkonfigurasi,
      },
      rules: draft.rules,
    });
  }, [
    simServiceMode,
    simItemId,
    simMaterialId,
    simFinishId,
    simLengthCm,
    simWidthCm,
    simSelectedOptionIds,
    draft,
  ]);

  const simBeforePromoTotal = useMemo(() => {
    if (!promoActive || simEstimate.status !== 'configured') return null;
    const safeLength = Math.max(30, Number.isFinite(simLengthCm) ? simLengthCm : 300);
    const safeWidth = Math.max(30, Number.isFinite(simWidthCm) ? simWidthCm : 250);
    const beforeRules = {
      ...draft.rules,
      hargaDesainPerMeterPersegi:
        draft.rules.hargaDesainSebelumPromoPerMeterPersegi ??
        draft.rules.hargaDesainPerMeterPersegi,
      hargaBahanPerMeterPersegi: {
        ...draft.rules.hargaBahanPerMeterPersegi,
        ...(draft.rules.hargaBahanSebelumPromoPerMeterPersegi ?? {}),
      },
      hargaFinishingPerMeterPersegi: {
        ...draft.rules.hargaFinishingPerMeterPersegi,
        ...(draft.rules.hargaFinishingSebelumPromoPerMeterPersegi ?? {}),
      },
    };
    const beforeEst = calculateCustomEstimate({
      serviceMode: simServiceMode,
      itemTypeId: simItemId,
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
      additionalOptionIds: simSelectedOptionIds,
      quantity: 1,
      pricingConfig: {
        mataUang: 'IDR',
        persentaseDp: draft.persentaseDp,
        hargaCustomTerkonfigurasi: draft.hargaCustomTerkonfigurasi,
      },
      rules: beforeRules,
    });
    if (
      beforeEst.status === 'configured' &&
      beforeEst.estimatedLineTotal !== null &&
      simEstimate.estimatedLineTotal !== null &&
      beforeEst.estimatedLineTotal > simEstimate.estimatedLineTotal
    ) {
      return beforeEst.estimatedLineTotal;
    }
    return null;
  }, [
    promoActive,
    simEstimate.status,
    simEstimate.estimatedLineTotal,
    simServiceMode,
    simItemId,
    simMaterialId,
    simFinishId,
    simLengthCm,
    simWidthCm,
    simSelectedOptionIds,
    draft,
  ]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    onSavePricing(structuredClone(draft));
  };

  const designRate = draft.rules.hargaDesainPerMeterPersegi ?? 0;
  const designBeforeRate = draft.rules.hargaDesainSebelumPromoPerMeterPersegi ?? designRate;
  const formattedDesignRate = formatCurrencyIDR(designRate);

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-6">
          <section className="p-5 sm:p-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-4">
            <h2 className="text-base font-semibold text-[var(--text)]">
              1. Status Kalkulator, Skema Promo &amp; Ketentuan Uang Muka (DP)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="space-y-3">
                <Checkbox
                  label="Aktifkan Tampilan Estimasi Harga Otomatis"
                  description="Jika dinonaktifkan, kalkulator menampilkan ajakan konsultasi harga tanpa angka."
                  disabled={!canEdit}
                  checked={draft.hargaCustomTerkonfigurasi}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      hargaCustomTerkonfigurasi: e.target.checked,
                    }))
                  }
                />

                <Checkbox
                  label="Aktifkan Skema Promo & Harga Coret (/m²)"
                  description="Menampilkan harga meteran sebelum promo (dicoret) di samping harga meteran saat ini pada katalog."
                  disabled={!canEdit}
                  checked={promoActive}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      rules: {
                        ...prev.rules,
                        promoAktif: e.target.checked,
                      },
                    }))
                  }
                />
              </div>

              <FormField
                id="custom-dp-pct"
                label="Persentase Uang Muka / DP Awal (%)"
                hint="Digunakan untuk simulasi DP di ringkasan estimasi klien."
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

          <section className="p-5 sm:p-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-4">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold text-[var(--text)]">
                2. Harga Jasa Desain per Meter Persegi (IDR / m²)
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Berlaku saat klien memilih layanan Desain Saja maupun paket Desain + Build.
              </p>
            </div>

            <div className="border border-[var(--border)] rounded-[var(--radius-md)] p-4 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    Tarif Jasa Desain 3D &amp; Gambar Kerja
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Dikalikan luas panjang × lebar. Isi 0 jika harga desain menunggu konsultasi langsung.
                  </p>
                </div>
                <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                  {formattedDesignRate ? `${formattedDesignRate}/m²` : 'Konsultasi'}
                </span>
              </div>

              <div className={promoActive ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'w-full sm:w-52'}>
                {promoActive && (
                  <div className="space-y-1">
                    <span className="block text-[11px] font-medium text-[var(--text-muted)]">
                      Sebelum Promo / m² (Harga Coret)
                    </span>
                    <CurrencyInput
                      disabled={!canEdit}
                      aria-label="Harga jasa desain sebelum promo per m²"
                      value={designBeforeRate}
                      onValueChange={(nextVal) => {
                        setDraft((prev) => ({
                          ...prev,
                          rules: {
                            ...prev.rules,
                            hargaDesainSebelumPromoPerMeterPersegi: nextVal > 0 ? nextVal : null,
                          },
                        }));
                      }}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <span className="block text-[11px] font-medium text-[var(--text-muted)]">
                    {promoActive ? 'Harga Saat Ini / m²' : 'Tarif Saat Ini / m²'}
                  </span>
                  <CurrencyInput
                    disabled={!canEdit}
                    aria-label="Harga jasa desain per m²"
                    value={designRate}
                    onValueChange={(nextVal) => {
                      setDraft((prev) => ({
                        ...prev,
                        rules: {
                          ...prev.rules,
                          hargaDesainPerMeterPersegi: nextVal > 0 ? nextVal : null,
                        },
                      }));
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="p-5 sm:p-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-4">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold text-[var(--text)]">
                3. Harga Material Utama per Meter Persegi (IDR / m²)
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Dikalikan luas panjang × lebar untuk layanan Build Saja dan Desain + Build.
              </p>
            </div>

            <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius-md)]">
              {CUSTOM_MATERIALS.map((mat) => {
                const rawVal = draft.rules.hargaBahanPerMeterPersegi[mat.id] ?? 0;
                const rawBeforeVal =
                  draft.rules.hargaBahanSebelumPromoPerMeterPersegi?.[mat.id] ?? rawVal;
                const formatted = formatCurrencyIDR(rawVal);
                return (
                  <div key={mat.id} className="p-4 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text)]">{mat.label}</p>
                        <p className="text-xs text-[var(--text-muted)]">{mat.deskripsi}</p>
                      </div>
                      <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                        {formatted ? `${formatted}/m²` : 'Rp 0/m²'}
                      </span>
                    </div>

                    <div
                      className={
                        promoActive ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'w-full sm:w-52'
                      }
                    >
                      {promoActive && (
                        <div className="space-y-1">
                          <span className="block text-[11px] font-medium text-[var(--text-muted)]">
                            Sebelum Promo / m² (Harga Coret)
                          </span>
                          <CurrencyInput
                            disabled={!canEdit}
                            aria-label={`Harga bahan sebelum promo per m² untuk ${mat.label}`}
                            value={rawBeforeVal}
                            onValueChange={(nextVal) => {
                              setDraft((prev) => ({
                                ...prev,
                                rules: {
                                  ...prev.rules,
                                  hargaBahanSebelumPromoPerMeterPersegi: {
                                    ...(prev.rules.hargaBahanSebelumPromoPerMeterPersegi ?? {}),
                                    [mat.id]: nextVal > 0 ? nextVal : null,
                                  },
                                },
                              }));
                            }}
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <span className="block text-[11px] font-medium text-[var(--text-muted)]">
                          {promoActive ? 'Harga Saat Ini / m²' : 'Tarif Saat Ini / m²'}
                        </span>
                        <CurrencyInput
                          disabled={!canEdit}
                          aria-label={`Harga bahan per m² untuk ${mat.label}`}
                          value={rawVal}
                          onValueChange={(nextVal) => {
                            setDraft((prev) => ({
                              ...prev,
                              rules: {
                                ...prev.rules,
                                hargaBahanPerMeterPersegi: {
                                  ...prev.rules.hargaBahanPerMeterPersegi,
                                  [mat.id]: nextVal,
                                },
                              },
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="p-5 sm:p-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-4">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold text-[var(--text)]">
                4. Harga Finishing/Laminasi per Meter Persegi (IDR / m²)
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Dikalikan luas panjang × lebar lalu digabungkan dengan biaya material utama pada layanan Build.
              </p>
            </div>

            <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius-md)]">
              {CUSTOM_FINISHES.map((fin) => {
                const rawVal = draft.rules.hargaFinishingPerMeterPersegi[fin.id] ?? 0;
                const rawBeforeVal =
                  draft.rules.hargaFinishingSebelumPromoPerMeterPersegi?.[fin.id] ?? rawVal;
                const formatted = formatCurrencyIDR(rawVal);
                return (
                  <div key={fin.id} className="p-4 flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text)]">{fin.label}</p>
                        <p className="text-xs text-[var(--text-muted)]">{fin.deskripsi}</p>
                      </div>
                      <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                        {formatted ? `${formatted}/m²` : 'Rp 0/m²'}
                      </span>
                    </div>

                    <div
                      className={
                        promoActive ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'w-full sm:w-52'
                      }
                    >
                      {promoActive && (
                        <div className="space-y-1">
                          <span className="block text-[11px] font-medium text-[var(--text-muted)]">
                            Sebelum Promo / m² (Harga Coret)
                          </span>
                          <CurrencyInput
                            disabled={!canEdit}
                            aria-label={`Harga finishing/laminasi sebelum promo per m² untuk ${fin.label}`}
                            value={rawBeforeVal}
                            onValueChange={(nextVal) => {
                              setDraft((prev) => ({
                                ...prev,
                                rules: {
                                  ...prev.rules,
                                  hargaFinishingSebelumPromoPerMeterPersegi: {
                                    ...(prev.rules.hargaFinishingSebelumPromoPerMeterPersegi ?? {}),
                                    [fin.id]: nextVal > 0 ? nextVal : null,
                                  },
                                },
                              }));
                            }}
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <span className="block text-[11px] font-medium text-[var(--text-muted)]">
                          {promoActive ? 'Harga Saat Ini / m²' : 'Tarif Saat Ini / m²'}
                        </span>
                        <CurrencyInput
                          disabled={!canEdit}
                          aria-label={`Harga finishing/laminasi per m² untuk ${fin.label}`}
                          value={rawVal}
                          onValueChange={(nextVal) => {
                            setDraft((prev) => ({
                              ...prev,
                              rules: {
                                ...prev.rules,
                                hargaFinishingPerMeterPersegi: {
                                  ...prev.rules.hargaFinishingPerMeterPersegi,
                                  [fin.id]: nextVal,
                                },
                              },
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="p-5 sm:p-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-4">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold text-[var(--text)]">
                5. Biaya Tetap Opsi Kelengkapan &amp; Aksesori (IDR)
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Isi 0 jika opsi kelengkapan diberikan gratis sebagai bagian dari layanan workshop.
              </p>
            </div>

            <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-[var(--radius-md)]">
              {CUSTOM_ADDITIONAL_OPTIONS.map((opt) => {
                const fee = draft.rules.biayaTambahanOpsi[opt.id] ?? 0;
                const formatted = formatCurrencyIDR(fee);
                return (
                  <div
                    key={opt.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)]">{opt.label}</p>
                      <p className="text-xs text-[var(--text-muted)]">{opt.deskripsi}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-44 sm:w-48">
                        <CurrencyInput
                          disabled={!canEdit}
                          aria-label={`Biaya tambahan untuk ${opt.label}`}
                          value={fee}
                          onValueChange={(nextFee) => {
                            setDraft((prev) => ({
                              ...prev,
                              rules: {
                                ...prev.rules,
                                biayaTambahanOpsi: {
                                  ...prev.rules.biayaTambahanOpsi,
                                  [opt.id]: nextFee,
                                },
                              },
                            }));
                          }}
                        />
                      </div>
                      <span className="w-28 text-right text-xs font-medium text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                        {fee > 0 && formatted ? `+ ${formatted}` : 'Gratis'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="xl:col-span-4 xl:sticky xl:top-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Calculator className="size-4 text-[var(--text-muted)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--text)]">
              Pratinjau Uji Hitung Harga
            </h2>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Uji skema Desain Saja, Build Saja, maupun Desain + Build beserta status promo sebelum disimpan.
          </p>

          <div className="space-y-3">
            <FormField id="sim-service" label="Jenis Layanan">
              <Select
                id="sim-service"
                value={simServiceMode}
                onChange={(e) => setSimServiceMode(e.target.value as CustomServiceMode)}
              >
                {CUSTOM_SERVICE_MODES.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField id="sim-item" label="Jenis Furniture (Referensi)">
              <Select
                id="sim-item"
                value={simItemId}
                onChange={(e) => setSimItemId(e.target.value)}
              >
                {CUSTOM_ITEM_TYPES.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.label}
                  </option>
                ))}
              </Select>
            </FormField>

            {simServiceMode !== 'design-only' && (
              <>
                <FormField id="sim-mat" label="Material Utama">
                  <Select
                    id="sim-mat"
                    value={simMaterialId}
                    onChange={(e) => setSimMaterialId(e.target.value)}
                  >
                    {CUSTOM_MATERIALS.map((m) => (
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
                    {CUSTOM_FINISHES.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField id="sim-len" label="Panjang (cm)">
                <Input
                  id="sim-len"
                  type="number"
                  min={30}
                  step={10}
                  value={simLengthCm}
                  onChange={(e) => setSimLengthCm(Number(e.target.value) || 100)}
                />
              </FormField>
              <FormField id="sim-wid" label="Lebar (cm)">
                <Input
                  id="sim-wid"
                  type="number"
                  min={30}
                  step={10}
                  value={simWidthCm}
                  onChange={(e) => setSimWidthCm(Number(e.target.value) || 100)}
                />
              </FormField>
            </div>

            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-medium text-[var(--text-muted)]">Simulasi Kelengkapan</p>
              <div className="space-y-1.5">
                {CUSTOM_ADDITIONAL_OPTIONS.map((opt) => {
                  const isBuildOnlyOpt = opt.id !== 'survei-lokasi';
                  const disabledByMode = simServiceMode === 'design-only' && isBuildOnlyOpt;
                  return (
                    <label
                      key={opt.id}
                      className={[
                        'flex items-center gap-2 text-xs cursor-pointer',
                        disabledByMode ? 'text-[var(--text-muted)] opacity-60' : 'text-[var(--text)]',
                      ].join(' ')}
                    >
                      <input
                        type="checkbox"
                        disabled={disabledByMode}
                        checked={!disabledByMode && simSelectedOptionIds.includes(opt.id)}
                        onChange={(e) =>
                          setSimSelectedOptionIds((prev) =>
                            e.target.checked ? [...prev, opt.id] : prev.filter((x) => x !== opt.id)
                          )
                        }
                        className="rounded border-[var(--border)] accent-[var(--accent)]"
                      />
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <dl className="pt-4 border-t border-[var(--border)] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-[var(--text-muted)]">Luas Hitung (P × L)</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">
                {simEstimate.areaSquareMeters} m²
              </dd>
            </div>

            {simServiceMode !== 'build-only' && (
              <div className="flex items-center justify-between">
                <dt className="text-[var(--text-muted)]">Biaya Jasa Desain</dt>
                <dd className="font-medium text-[var(--text)] tabular-nums">
                  {formatCurrencyIDR(simEstimate.designAmount) ?? 'Konsultasi'}
                </dd>
              </div>
            )}

            {simServiceMode !== 'design-only' && (
              <>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-muted)]">Biaya Material Utama</dt>
                  <dd className="font-medium text-[var(--text)] tabular-nums">
                    {formatCurrencyIDR(simEstimate.materialAmount) ?? 'Konsultasi'}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-muted)]">Biaya Finishing/Laminasi</dt>
                  <dd className="font-medium text-[var(--text)] tabular-nums">
                    {formatCurrencyIDR(simEstimate.finishingAmount) ?? 'Konsultasi'}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--text-muted)]">Subtotal Build (Material + Finishing/Laminasi)</dt>
                  <dd className="font-medium text-[var(--text)] tabular-nums">
                    {formatCurrencyIDR(simEstimate.buildAmount) ?? 'Konsultasi'}
                  </dd>
                </div>
              </>
            )}

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
                {simBeforePromoTotal !== null && (
                  <span className="block text-xs text-[var(--text-muted)] line-through">
                    {formatCurrencyIDR(simBeforePromoTotal)}
                  </span>
                )}
                <span className="text-base font-bold text-[var(--text)]">
                  {formatCurrencyIDR(simEstimate.estimatedLineTotal) ?? 'Konsultasi Harga'}
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
