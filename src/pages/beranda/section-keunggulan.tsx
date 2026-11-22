import { useState, type ComponentType } from 'react';
import { Hammer, Layers, MessageSquare, Ruler } from 'lucide-react';
import { Modal } from '../../components/ui/modal';
import { SectionHeading } from '../../components/ui/section-heading';
import { useSiteContentStore } from '../../store/site-content-store';
import type { ValuePropositionData } from '../../types/cms';

const VALUE_ICONS: Record<string, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  'proporsi-ruang': Ruler,
  'seleksi-material': Layers,
  'komunikasi-langsung': MessageSquare,
  'konstruksi-presisi': Hammer,
};

function ValueCard({
  item,
  onSelect,
}: {
  item: ValuePropositionData;
  onSelect: (item: ValuePropositionData) => void;
}) {
  const Icon = VALUE_ICONS[item.id] ?? Ruler;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group w-full p-5 sm:p-6 border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]/40 rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] flex flex-col items-center justify-center text-center gap-3 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-2"
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

export function SectionKeunggulan() {
  const beranda = useSiteContentStore((state) => state.beranda);
  const [selectedItem, setSelectedItem] = useState<ValuePropositionData | null>(null);
  const SelectedIcon = selectedItem ? (VALUE_ICONS[selectedItem.id] ?? Ruler) : Ruler;

  return (
    <section aria-labelledby="keunggulan-heading" className="space-y-6 sm:space-y-8">
      <SectionHeading
        id="keunggulan-heading"
        align="center"
        eyebrow={beranda.labelKeunggulan}
        title={beranda.judulKeunggulan}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:gap-8">
        {beranda.daftarKeunggulan.map((item) => (
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
            <p className="text-sm text-[var(--text)] leading-relaxed">{selectedItem.deskripsi}</p>
            {selectedItem.detail && (
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {selectedItem.detail}
              </p>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
