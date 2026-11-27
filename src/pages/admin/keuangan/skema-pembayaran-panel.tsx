import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { AdminActionButton } from '../../../components/admin/admin-action-buttons';
import type { AdminFeedbackMessage } from '../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../components/admin/admin-form';
import type { MobileFormViewMode } from '../../../components/admin/mobile-form-tabs';
import { Button } from '../../../components/ui/button';
import {
  CurrencyInput,
  FormField,
  FormFieldStyleProvider,
  Input,
  Textarea,
} from '../../../components/ui/form-controls';
import { useIsMobileViewport } from '../../../hooks/use-mobile-viewport';
import { AdminMobileBottomAction, useAdminScrollControl } from '../admin-shell';
import {
  DEFAULT_PAYMENT_SCHEME,
  DEFAULT_PAYMENT_SCHEME_NOTE,
  DEFAULT_PAYMENT_SCHEME_TITLE,
  calculatePaymentSchemeBreakdown,
  computePaymentSchemeTotalPercent,
  formatPaymentStageTerminName,
  stripPaymentStageTerminPrefix,
} from '../../../lib/payment-scheme';
import { formatCurrencyIDR } from '../../../lib/price-format';
import { useAdminAuthStore } from '../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../store/site-content-store';
import type { PaymentSchemeConfig, PaymentSchemeStage } from '../../../types/cms';

export const PAYMENT_SCHEME_FORM_ID = 'admin-payment-scheme-form';

function toAdminDraft(scheme: PaymentSchemeConfig): PaymentSchemeConfig {
  return {
    ...scheme,
    tahapan: [...scheme.tahapan]
      .sort((a, b) => a.urutan - b.urutan)
      .map((stage, idx) => ({
        ...stage,
        urutan: idx + 1,
        nama: stripPaymentStageTerminPrefix(stage.nama),
      })),
  };
}

interface SkemaPembayaranPanelProps {
  canEdit: boolean;
  resetSignal: number;
  mobileViewMode?: MobileFormViewMode;
  onFeedback: (feedback: AdminFeedbackMessage) => void;
}

type SkemaMobileSubTab = 'termin' | 'simulasi';

export function SkemaPembayaranPanel({
  canEdit,
  resetSignal,
  mobileViewMode = 'tab',
  onFeedback,
}: SkemaPembayaranPanelProps) {
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const updatePaymentScheme = useSiteContentStore((state) => state.updatePaymentScheme);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const isMobile = useIsMobileViewport();
  const { scrollMainToTop } = useAdminScrollControl();
  const isMobileTabMode = isMobile && mobileViewMode === 'tab';
  const [activeSubTab, setActiveSubTab] = useState<SkemaMobileSubTab>('termin');

  const [draft, setDraft] = useState<PaymentSchemeConfig>(() => toAdminDraft(paymentScheme));
  const [sampleContractTotal, setSampleContractTotal] = useState(10_000_000);

  useEffect(() => {
    setDraft(toAdminDraft(paymentScheme));
  }, [paymentScheme, resetSignal]);

  const totalPercent = useMemo(
    () => computePaymentSchemeTotalPercent(draft.tahapan),
    [draft.tahapan]
  );
  const isPercentBalanced = Math.abs(totalPercent - 100) < 0.01;

  const formattedDraftForPreview = useMemo<PaymentSchemeConfig>(
    () => ({
      ...draft,
      tahapan: draft.tahapan.map((stage, idx) => ({
        ...stage,
        urutan: idx + 1,
        nama: formatPaymentStageTerminName(stage.nama || `Tahap ${idx + 1}`, idx + 1),
      })),
    }),
    [draft]
  );

  const previewBreakdown = useMemo(
    () => calculatePaymentSchemeBreakdown(sampleContractTotal, formattedDraftForPreview),
    [sampleContractTotal, formattedDraftForPreview]
  );

  const handleMoveStage = (index: number, direction: 'up' | 'down') => {
    if (!canEdit) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= draft.tahapan.length) return;
    setDraft((prev) => {
      const nextStages = [...prev.tahapan];
      const [moved] = nextStages.splice(index, 1);
      nextStages.splice(target, 0, moved);
      return {
        ...prev,
        tahapan: nextStages.map((s, idx) => ({ ...s, urutan: idx + 1 })),
      };
    });
  };

  const handleUpdateStage = (
    index: number,
    patch: Partial<Pick<PaymentSchemeStage, 'nama' | 'persentase' | 'keterangan'>>
  ) => {
    setDraft((prev) => ({
      ...prev,
      tahapan: prev.tahapan.map((stage, idx) =>
        idx === index ? { ...stage, ...patch } : stage
      ),
    }));
  };

  const handleAddStage = () => {
    if (!canEdit) return;
    const remaining = Math.max(0, Math.round((100 - totalPercent) * 100) / 100);
    setDraft((prev) => ({
      ...prev,
      tahapan: [
        ...prev.tahapan,
        {
          id: `termin-${Date.now()}`,
          urutan: prev.tahapan.length + 1,
          nama: '',
          persentase: remaining,
          keterangan: '',
        },
      ],
    }));
  };

  const handleRemoveStage = (index: number) => {
    if (!canEdit || draft.tahapan.length <= 1) return;
    setDraft((prev) => ({
      ...prev,
      tahapan: prev.tahapan
        .filter((_, idx) => idx !== index)
        .map((s, idx) => ({ ...s, urutan: idx + 1 })),
    }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;

    const hasEmptyStage = draft.tahapan.some(
      (s) => !stripPaymentStageTerminPrefix(s.nama) || !s.keterangan.trim()
    );
    if (hasEmptyStage) {
      if (isMobileTabMode && activeSubTab !== 'termin') {
        setActiveSubTab('termin');
        scrollMainToTop();
      }
      onFeedback({
        type: 'err',
        text: 'Setiap tahapan wajib memiliki judul termin dan ketentuan pembayaran.',
      });
      return;
    }

    if (!isPercentBalanced) {
      if (isMobileTabMode && activeSubTab !== 'termin') {
        setActiveSubTab('termin');
        scrollMainToTop();
      }
      onFeedback({
        type: 'err',
        text: `Total persentase semua tahapan saat ini ${totalPercent}%. Sesuaikan hingga tepat 100% sebelum menyimpan.`,
      });
      return;
    }

    updatePaymentScheme({
      judul: DEFAULT_PAYMENT_SCHEME_TITLE,
      catatan: DEFAULT_PAYMENT_SCHEME_NOTE,
      tahapan: draft.tahapan.map((s, idx) => ({
        ...s,
        urutan: idx + 1,
        nama: formatPaymentStageTerminName(s.nama, idx + 1),
        keterangan: s.keterangan.trim(),
      })),
    });

    recordActivity(
      'Memperbarui skema pembayaran & termin proyek',
      'Keuangan',
      draft.tahapan.map((s) => `${s.persentase}%`).join(' / ')
    );
    onFeedback({
      type: 'ok',
      text: 'Skema pembayaran berhasil disimpan dan menjadi acuan aktif di Kalkulator Custom, FAQ, Syarat & Ketentuan, SPK, BAST, Invoice, serta Keuangan.',
    });
  };

  const hasTerminError = !isPercentBalanced;

  return (
    <FormFieldStyleProvider labelTone="thin" hideHints>
      <div className="[&_input]:font-medium [&_textarea]:font-medium">
        <form
          id={PAYMENT_SCHEME_FORM_ID}
          onSubmit={handleSubmit}
          onInvalidCapture={() => {
            if (isMobileTabMode && activeSubTab !== 'termin') {
              setActiveSubTab('termin');
              scrollMainToTop();
            }
          }}
        >
          {isMobileTabMode && (
            <div
              role="tablist"
              aria-label="Bagian skema pembayaran"
              data-testid="admin-mobile-tablist"
              className="md:hidden sticky top-0 z-20 mb-4 -ml-[max(0.875rem,env(safe-area-inset-left))] -mr-[max(0.875rem,env(safe-area-inset-right))] sm:-mx-6 bg-[var(--surface)] border-b border-[var(--border)] grid grid-cols-2"
            >
              {(
                [
                  { id: 'termin', label: 'Termin', hasError: hasTerminError },
                  { id: 'simulasi', label: 'Simulasi', hasError: false },
                ] as const
              ).map((tab) => {
                const isActive = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`skema-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`skema-panel-${tab.id}`}
                    data-testid={`admin-mobile-tab-${tab.id}`}
                    data-has-error={tab.hasError ? 'true' : undefined}
                    onClick={() => {
                      setActiveSubTab(tab.id);
                      scrollMainToTop();
                    }}
                    className={[
                      'relative inline-flex items-center justify-center gap-1.5 min-h-11 py-2.5 px-3 text-xs whitespace-nowrap transition-colors duration-150 cursor-pointer border-b-2 -mb-px focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-[-2px]',
                      isActive
                        ? 'border-[var(--text)] text-[var(--text)] font-semibold'
                        : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)] font-medium',
                    ].join(' ')}
                  >
                    <span>{tab.label}</span>
                    {tab.hasError && (
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-[var(--danger)] shrink-0"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start">
            <div
              id={isMobileTabMode ? 'skema-panel-termin' : undefined}
              role={isMobileTabMode ? 'tabpanel' : undefined}
              aria-labelledby={isMobileTabMode ? 'skema-tab-termin' : undefined}
              className={
                isMobileTabMode && activeSubTab !== 'termin'
                  ? 'hidden'
                  : 'xl:col-span-8 space-y-5 sm:space-y-6'
              }
            >
              <AdminFormSectionCard
                title={`Tahapan Termin (${draft.tahapan.length})`}
                headerAction={
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        'inline-flex items-center px-2.5 py-1 rounded-[var(--radius-sm)] border text-xs font-semibold tabular-nums',
                        isPercentBalanced
                          ? 'bg-white/15 border-white/25 text-white dark:bg-[#21201E]/10 dark:border-[#21201E]/15 dark:text-[#21201E]'
                          : 'border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger)]',
                      ].join(' ')}
                    >
                      Total: {totalPercent}%
                    </span>
                    {canEdit && (
                      <AdminActionButton
                        label="Tambah Termin"
                        icon={<Plus className="size-3.5" />}
                        onClick={handleAddStage}
                      />
                    )}
                  </div>
                }
              >

            <div className="space-y-4">
              {draft.tahapan.map((stage, idx) => (
                <div
                  key={stage.id}
                  className="p-3.5 sm:p-4 border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--bg)]/40 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">
                      Termin {idx + 1}
                    </span>
                    {canEdit && (
                      <div className="flex items-center gap-1.5">
                        <AdminActionButton
                          label={`Pindahkan Termin ${idx + 1} ke atas`}
                          iconOnly
                          disabled={idx === 0}
                          icon={<ArrowUp className="size-3.5" />}
                          onClick={() => handleMoveStage(idx, 'up')}
                        />
                        <AdminActionButton
                          label={`Pindahkan Termin ${idx + 1} ke bawah`}
                          iconOnly
                          disabled={idx === draft.tahapan.length - 1}
                          icon={<ArrowDown className="size-3.5" />}
                          onClick={() => handleMoveStage(idx, 'down')}
                        />
                        <AdminActionButton
                          variant="danger"
                          label={`Hapus Termin ${idx + 1}`}
                          iconOnly
                          disabled={draft.tahapan.length <= 1}
                          icon={<Trash2 className="size-3.5" />}
                          onClick={() => handleRemoveStage(idx)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-8">
                      <FormField id={`stage-name-${stage.id}`} label="Judul Termin" required>
                        <div
                          className={`w-full inline-flex items-stretch h-11 rounded-[var(--radius-md)] border border-[var(--border)] hover:border-[var(--border-strong)] focus-within:border-[var(--border-strong)] bg-[var(--surface)] transition-colors duration-150 ${
                            !canEdit ? 'opacity-55 cursor-not-allowed' : ''
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className="inline-flex items-center justify-center px-3 border-r border-[var(--border)] bg-[var(--surface-muted)]/55 text-xs font-semibold text-[var(--text-muted)] select-none shrink-0 rounded-l-[calc(var(--radius-md)-1px)] whitespace-nowrap"
                          >
                            Termin {idx + 1} :
                          </span>
                          <input
                            id={`stage-name-${stage.id}`}
                            type="text"
                            disabled={!canEdit}
                            value={stage.nama}
                            placeholder="Contoh: Down Payment"
                            onChange={(e) =>
                              handleUpdateStage(idx, { nama: e.target.value })
                            }
                            className="flex-1 min-w-0 w-full h-full bg-transparent px-3.5 py-0 text-base md:text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
                          />
                        </div>
                      </FormField>
                    </div>

                    <div className="sm:col-span-4">
                      <FormField id={`stage-pct-${stage.id}`} label="Persentase (%)" required>
                        <Input
                          id={`stage-pct-${stage.id}`}
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          disabled={!canEdit}
                          value={stage.persentase}
                          onChange={(e) =>
                            handleUpdateStage(idx, {
                              persentase: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                            })
                          }
                        />
                      </FormField>
                    </div>

                    <div className="sm:col-span-12">
                      <FormField
                        id={`stage-desc-${stage.id}`}
                        label="Ketentuan / Waktu Pembayaran"
                        required
                      >
                        <Textarea
                          id={`stage-desc-${stage.id}`}
                          rows={2}
                          disabled={!canEdit}
                          value={stage.keterangan}
                          onChange={(e) =>
                            handleUpdateStage(idx, { keterangan: e.target.value })
                          }
                        />
                      </FormField>
                    </div>
                  </div>
                </div>
              ))}
            </div>
              </AdminFormSectionCard>
            </div>

            <aside
              id={isMobileTabMode ? 'skema-panel-simulasi' : undefined}
              role={isMobileTabMode ? 'tabpanel' : undefined}
              aria-labelledby={isMobileTabMode ? 'skema-tab-simulasi' : undefined}
              className={
                isMobileTabMode && activeSubTab !== 'simulasi'
                  ? 'hidden'
                  : 'xl:col-span-4 xl:sticky xl:top-6'
              }
            >
              <AdminFormSectionCard title="Simulasi Termin">
                <FormField id="sim-contract-total" label="Contoh Nilai Proyek">
                  <CurrencyInput
                    id="sim-contract-total"
                    value={sampleContractTotal}
                    onValueChange={(nextVal) => setSampleContractTotal(nextVal ?? 0)}
                  />
                </FormField>

                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  {previewBreakdown.map((stage) => (
                    <div key={stage.id} className="space-y-0.5 text-xs">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold text-[var(--text)]">
                          {stage.nama} {stage.persentase}%
                        </span>
                        <span className="font-bold text-[var(--text)] tabular-nums shrink-0">
                          {stage.amount !== null ? formatCurrencyIDR(stage.amount) : '—'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                        {stage.keterangan}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="pt-3 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] leading-relaxed">
                  {DEFAULT_PAYMENT_SCHEME_NOTE}
                </p>
              </AdminFormSectionCard>
            </aside>
          </div>
        </form>
      </div>

      {canEdit && (
        <AdminMobileBottomAction>
          <nav aria-label="Aksi simpan seluler">
            <Button
              type="submit"
              form={PAYMENT_SCHEME_FORM_ID}
              variant="primary"
              size="md"
              fullWidth
              data-testid="mobile-bottom-submit-btn"
            >
              Simpan
            </Button>
          </nav>
        </AdminMobileBottomAction>
      )}
    </FormFieldStyleProvider>
  );
}
