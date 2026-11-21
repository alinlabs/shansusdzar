import { useState, type ComponentType } from 'react';
import { Hammer, Layers, MessageSquare, Ruler } from 'lucide-react';
import { Modal } from '../../components/ui/modal';
import { SectionHeading } from '../../components/ui/section-heading';
import { useSiteContentStore } from '../../store/site-content-store';
import type { WorkingPrincipleData } from '../../types/cms';

const VALUE_ICONS: Record<string, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  'proporsi-ruang': Ruler,
  'material-jujur': Layers,
  'estimasi-terukur': MessageSquare,
  'pendampingan-langsung': Hammer,
};

function ValueCard({
  item,
  onSelect,
}: {
  item: WorkingPrincipleData;
  onSelect: (item: WorkingPrincipleData) => void;
}) {
  const Icon = VALUE_ICONS[item.id] ?? Ruler;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group w-full py-5 px-2 sm:px-4 border-t border-[var(--border)] hover:bg-[var(--surface-muted)]/60 rounded-[var(--radius-sm)] flex flex-col items-center justify-center text-center gap-3 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-2"
    >
      <div className="size-10 sm:size-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-[var(--text)] group-hover:border-[var(--border-strong)] transition-colors">
        <Icon className="size-5" aria-hidden={true} />
      </div>
      <h3 className="text-sm sm:text-base font-semibold text-[var(--text)] leading-snug">
        {item.judul}
      </h3>
    </button>
  );
}

export function SectionValues() {
  const beranda = useSiteContentStore((state) => state.beranda);
  const workingPrinciples = useSiteContentStore((state) => state.tentang.prinsipKerja);
  const [selectedItem, setSelectedItem] = useState<WorkingPrincipleData | null>(null);
  const SelectedIcon = selectedItem ? (VALUE_ICONS[selectedItem.id] ?? Ruler) : Ruler;

  return (
    <section
      aria-labelledby="tentang-values-heading"
      className="space-y-6 sm:space-y-8"
    >
      <SectionHeading
        id="tentang-values-heading"
        align="center"
        eyebrow={beranda.labelKeunggulan}
        title={beranda.judulKeunggulan}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:gap-8">
        {workingPrinciples.map((item) => (
          <ValueCard key={item.id} item={item} onSelect={setSelectedItem} />
        ))}
      </div>

      <Modal
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.judul ?? ''}
        description="Pendekatan Kerja"
        size="sm"
        headerTone="brand"
        closeLabel={selectedItem ? `Tutup informasi ${selectedItem.judul}` : 'Tutup dialog'}
        headerLeading={
          selectedItem ? (
            <div className="size-10 rounded-[var(--radius-sm)] border border-white/20 bg-white/10 flex items-center justify-center text-white dark:border-[var(--border)] dark:bg-[var(--surface-muted)] dark:text-[var(--text)]">
              <SelectedIcon className="size-5" aria-hidden={true} />
            </div>
          ) : undefined
        }
      >
        {selectedItem && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
              Prinsip {selectedItem.nomor}
            </p>
            <p className="text-sm text-[var(--text)] leading-relaxed">{selectedItem.deskripsi}</p>
          </div>
        )}
      </Modal>
    </section>
  );
}
