import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Calculator, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { CurrencyInput, FormField, Input, Textarea } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  DEFAULT_PAYMENT_SCHEME,
  calculatePaymentSchemeBreakdown,
  computePaymentSchemeTotalPercent,
} from '../../../../lib/payment-scheme';
import { formatCurrencyIDR } from '../../../../lib/price-format';
import { hasAnyPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type { PaymentSchemeConfig, PaymentSchemeStage } from '../../../../types/cms';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminSkemaPembayaranPage() {
  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerekSingkat);
  const paymentScheme =
    useSiteContentStore((state) => state.paymentScheme) ?? DEFAULT_PAYMENT_SCHEME;
  const updatePaymentScheme = useSiteContentStore((state) => state.updatePaymentScheme);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Skema Pembayaran & Termin | Admin ${shortBrandName}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEdit = hasAnyPermission(currentRole, [
    'katalog.edit',
    'keuangan.edit',
    'tentang.edit',
    'bisnis.edit',
  ]);

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [draft, setDraft] = useState<PaymentSchemeConfig>(() => structuredClone(paymentScheme));
  const [sampleContractTotal, setSampleContractTotal] = useState(10_000_000);

  useEffect(() => {
    setDraft(structuredClone(paymentScheme));
  }, [paymentScheme]);

  const totalPercent = useMemo(
    () => computePaymentSchemeTotalPercent(draft.tahapan),
    [draft.tahapan]
  );
  const isPercentBalanced = Math.abs(totalPercent - 100) < 0.01;

  const previewBreakdown = useMemo(
    () => calculatePaymentSchemeBreakdown(sampleContractTotal, draft),
    [sampleContractTotal, draft]
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
          nama: `Termin ${prev.tahapan.length + 1}`,
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

    if (!draft.judul.trim()) {
      setFeedback({ type: 'err', text: 'Judul skema pembayaran wajib diisi.' });
      return;
    }

    const hasEmptyStage = draft.tahapan.some(
      (s) => !s.nama.trim() || !s.keterangan.trim()
    );
    if (hasEmptyStage) {
      setFeedback({
        type: 'err',
        text: 'Setiap tahapan wajib memiliki nama termin dan keterangan progres.',
      });
      return;
    }

    if (!isPercentBalanced) {
      setFeedback({
        type: 'err',
        text: `Total persentase semua tahapan saat ini ${totalPercent}%. Sesuaikan hingga tepat 100% sebelum menyimpan.`,
      });
      return;
    }

    updatePaymentScheme({
      ...draft,
      judul: draft.judul.trim(),
      catatan: draft.catatan.trim(),
      tahapan: draft.tahapan.map((s, idx) => ({
        ...s,
        urutan: idx + 1,
        nama: s.nama.trim(),
        keterangan: s.keterangan.trim(),
      })),
    });

    recordActivity(
      'Memperbarui skema pembayaran & termin proyek',
      'Skema Pembayaran',
      draft.tahapan.map((s) => `${s.persentase}%`).join(' / ')
    );
    setFeedback({
      type: 'ok',
      text: 'Skema pembayaran berhasil disimpan dan menjadi acuan aktif di Kalkulator Custom, FAQ, Syarat & Ketentuan, SPK/SPKS, BAST, Invoice, serta Keuangan.',
    });
  };

  const handleResetDefault = () => {
    if (!canEdit) return;
    const fresh = structuredClone(DEFAULT_PAYMENT_SCHEME);
    setDraft(fresh);
    updatePaymentScheme(fresh);
    recordActivity(
      'Mengembalikan skema pembayaran ke standar Shansus Dzar Indonesia',
      'Skema Pembayaran',
      '30% / 40% / 20% / 10%'
    );
    setFeedback({
      type: 'ok',
      text: 'Skema pembayaran dikembalikan ke standar 30% DP · 40% Produksi · 20% Pra-Instalasi · 10% BAST.',
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Skema Pembayaran & Termin"
        description="Kelola tahapan DP dan termin pembayaran resmi (skema-pembayaran.json) yang menjadi landasan pada Kalkulator Custom, FAQ, Syarat & Ketentuan, SPK/SPKS, BAST, Invoice, serta mekanisme Keuangan."
        actions={
          canEdit ? (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={handleResetDefault}>
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reset Standar
              </Button>
              <Button type="submit" form="admin-payment-scheme-form" variant="primary" size="sm">
                <Save className="size-3.5" aria-hidden="true" />
                Simpan Skema
              </Button>
            </>
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <form id="admin-payment-scheme-form" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-8 space-y-6">
            <AdminFormSectionCard title="Identitas & Ketentuan Umum Skema">
              <FormField id="scheme-title" label="Judul Skema Pembayaran" required>
                <Input
                  id="scheme-title"
                  disabled={!canEdit}
                  value={draft.judul}
                  onChange={(e) => setDraft((prev) => ({ ...prev, judul: e.target.value }))}
                />
              </FormField>

              <FormField
                id="scheme-note"
                label="Catatan Resmi Pembayaran"
                hint="Ditampilkan sebagai keterangan pendukung di bawah rincian termin."
              >
                <Textarea
                  id="scheme-note"
                  rows={2}
                  disabled={!canEdit}
                  value={draft.catatan}
                  onChange={(e) => setDraft((prev) => ({ ...prev, catatan: e.target.value }))}
                />
              </FormField>
            </AdminFormSectionCard>

            <section className="p-5 sm:p-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
                <div className="space-y-0.5">
                  <h2 className="text-base font-semibold text-[var(--text)]">
                    Tahapan Pembayaran ({draft.tahapan.length} Termin)
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Total persentase seluruh tahapan wajib tepat 100%.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={[
                      'inline-flex items-center px-2.5 py-1 rounded-[var(--radius-sm)] border text-xs font-semibold tabular-nums',
                      isPercentBalanced
                        ? 'border-[var(--success-border)] bg-[var(--success-surface)] text-[var(--success)]'
                        : 'border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger)]',
                    ].join(' ')}
                  >
                    Total: {totalPercent}%
                  </span>
                  {canEdit && (
                    <Button type="button" variant="secondary" size="sm" onClick={handleAddStage}>
                      <Plus className="size-3.5" aria-hidden="true" />
                      Tambah Termin
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {draft.tahapan.map((stage, idx) => (
                  <div
                    key={stage.id}
                    className="p-4 border border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--bg)]/40 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-[var(--text-muted)]">
                        Tahap #{idx + 1}
                      </span>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Pindahkan ${stage.nama} ke atas`}
                            disabled={idx === 0}
                            onClick={() => handleMoveStage(idx, 'up')}
                            className="p-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-35 cursor-pointer"
                          >
                            <ArrowUp className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Pindahkan ${stage.nama} ke bawah`}
                            disabled={idx === draft.tahapan.length - 1}
                            onClick={() => handleMoveStage(idx, 'down')}
                            className="p-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-35 cursor-pointer"
                          >
                            <ArrowDown className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Hapus ${stage.nama}`}
                            disabled={draft.tahapan.length <= 1}
                            onClick={() => handleRemoveStage(idx)}
                            className="p-1.5 rounded-[var(--radius-sm)] border border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger)] disabled:opacity-35 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-8">
                        <FormField id={`stage-name-${stage.id}`} label="Nama Tahapan" required>
                          <Input
                            id={`stage-name-${stage.id}`}
                            disabled={!canEdit}
                            value={stage.nama}
                            onChange={(e) => handleUpdateStage(idx, { nama: e.target.value })}
                          />
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
            </section>
          </div>

          <aside className="xl:col-span-4 xl:sticky xl:top-6 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Calculator className="size-4 text-[var(--text-muted)]" aria-hidden="true" />
              <h2 className="text-base font-semibold text-[var(--text)]">
                Simulasi Pembagian Termin
              </h2>
            </div>

            <FormField
              id="sim-contract-total"
              label="Contoh Nilai Proyek / Estimasi"
              hint="Pratinjau bagaimana total estimasi dibagi ke setiap termin."
            >
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

            {draft.catatan && (
              <p className="pt-3 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] leading-relaxed">
                {draft.catatan}
              </p>
            )}
          </aside>
        </div>
      </form>
    </div>
  );
}
