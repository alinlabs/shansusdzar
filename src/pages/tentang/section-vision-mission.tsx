import { SectionHeading } from '../../components/ui/section-heading';
import { useSiteContentStore } from '../../store/site-content-store';

export function SectionVisionMission() {
  const tentang = useSiteContentStore((state) => state.tentang);

  return (
    <section aria-labelledby="tentang-visi-misi-heading" className="space-y-6 sm:space-y-8">
      <SectionHeading
        id="tentang-visi-misi-heading"
        align="center"
        eyebrow={tentang.labelVisi}
        title={tentang.judulVisi}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-10 items-start pt-5 border-t border-[var(--border)]">
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-[var(--text-muted)]">Visi Studio</p>
            <p className="text-base sm:text-lg font-medium text-[var(--text)] leading-relaxed">
              &ldquo;{tentang.pernyataanVisi}&rdquo;
            </p>
          </div>

          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Kombinasi ketelitian konstruksi workshop Purwakarta dan konsultasi langsung bersama
            klien.
          </p>
        </div>

        <div className="lg:col-span-7 pt-6 border-t lg:pt-0 lg:border-t-0 lg:border-l lg:pl-10 border-[var(--border)] space-y-4">
          <h3 className="text-base font-semibold text-[var(--text)]">{tentang.judulMisi}</h3>
          <ol className="divide-y divide-[var(--border)]">
            {tentang.daftarMisi.map((mission, index) => (
              <li
                key={index}
                className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-4 text-sm text-[var(--text-muted)] leading-relaxed"
              >
                <span className="text-xs font-semibold text-[var(--text)] tabular-nums pt-0.5 shrink-0">
                  {String(index + 1).padStart(2, '0')}.
                </span>
                <span>{mission}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
