import { useState } from 'react';
import { Modal } from '../../components/ui/modal';
import { SectionHeading } from '../../components/ui/section-heading';
import { useSiteContentStore } from '../../store/site-content-store';
import type { ProcessStepData } from '../../types/cms';
import { MobileCardCarousel } from './mobile-card-carousel';

function ProcessCard({
  step,
  isHiddenClone,
  onSelect,
}: {
  step: ProcessStepData;
  isHiddenClone?: boolean;
  onSelect: (step: ProcessStepData) => void;
}) {
  return (
    <button
      type="button"
      tabIndex={isHiddenClone ? -1 : undefined}
      onClick={() => onSelect(step)}
      className="relative w-full p-5 sm:p-6 border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]/40 rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] flex items-start text-left transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-2"
    >
      <span className="absolute top-5 right-5 sm:top-6 sm:right-6 size-7 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] inline-flex items-center justify-center text-xs font-semibold text-[var(--text)] tabular-nums">
        {step.nomor}
      </span>
      <div className="min-w-0 pr-10 space-y-1.5 text-left">
        <h3 className="text-base font-semibold text-[var(--text)] leading-snug">{step.judul}</h3>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">{step.deskripsi}</p>
      </div>
    </button>
  );
}

export function SectionProses() {
  const beranda = useSiteContentStore((state) => state.beranda);
  const [selectedStep, setSelectedStep] = useState<ProcessStepData | null>(null);

  return (
    <section aria-labelledby="proses-heading" className="space-y-6 sm:space-y-8">
      <SectionHeading
        id="proses-heading"
        align="center"
        eyebrow={beranda.labelProses}
        title={beranda.judulProses}
        description={beranda.deskripsiProses || undefined}
      />

      <MobileCardCarousel
        items={beranda.tahapanProses}
        ariaLabel="Slide alur konsultasi dan kerja"
        tablistLabel="Pilih slide alur konsultasi"
        getItemLabel={(step, idx) => `Tahap ${idx + 1}: ${step.judul}`}
        renderCard={(step, isHiddenClone) => (
          <ProcessCard
            step={step}
            isHiddenClone={isHiddenClone}
            onSelect={setSelectedStep}
          />
        )}
      />

      <ol className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {beranda.tahapanProses.map((step) => (
          <li key={step.id} className="flex">
            <ProcessCard step={step} onSelect={setSelectedStep} />
          </li>
        ))}
      </ol>

      <Modal
        isOpen={Boolean(selectedStep)}
        onClose={() => setSelectedStep(null)}
        title={selectedStep?.judul ?? ''}
        description={selectedStep ? `Tahap ${selectedStep.nomor}` : undefined}
        size="sm"
        headerTone="brand"
        closeLabel={selectedStep ? `Tutup informasi ${selectedStep.judul}` : 'Tutup dialog'}
        headerLeading={
          selectedStep ? (
            <span className="size-10 rounded-[var(--radius-sm)] border border-white/20 bg-white/10 inline-flex items-center justify-center text-sm font-semibold text-white tabular-nums dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--text)]">
              {selectedStep.nomor}
            </span>
          ) : undefined
        }
      >
        {selectedStep && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text)] leading-relaxed">{selectedStep.deskripsi}</p>
            {selectedStep.detail && (
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {selectedStep.detail}
              </p>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
