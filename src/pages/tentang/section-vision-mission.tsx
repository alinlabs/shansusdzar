import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useSiteContentStore } from '../../store/site-content-store';

const VISION_MISSION_TEXT_CLASS =
  'text-[15px] sm:text-lg font-medium text-[var(--text)] leading-relaxed';

export function SectionVisionMission() {
  const tentang = useSiteContentStore((state) => state.tentang);
  const [isMisiVisibleMobile, setIsMisiVisibleMobile] = useState(false);
  const hasMissions = tentang.daftarMisi.length > 0;

  return (
    <section
      aria-label="Visi dan Misi Studio"
      className="space-y-6 sm:space-y-9"
    >
      <div className="space-y-2.5 sm:space-y-3 text-center">
        <p className="text-xs font-medium text-[var(--text-muted)]">Visi Studio</p>
        <p className={VISION_MISSION_TEXT_CLASS}>
          &ldquo;{tentang.pernyataanVisi}&rdquo;
        </p>
      </div>

      {hasMissions && (
        <div className="space-y-2.5 sm:space-y-3">
          <div className="md:hidden text-center">
            <button
              type="button"
              aria-expanded={isMisiVisibleMobile}
              aria-controls="tentang-misi-list"
              onClick={() => setIsMisiVisibleMobile((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-strong)] rounded-[var(--radius-sm)] cursor-pointer ${
                isMisiVisibleMobile ? '' : 'underline underline-offset-4'
              }`}
            >
              <span>
                {isMisiVisibleMobile ? tentang.judulMisi : 'Lihat Misi Perusahaan'}
              </span>
              <ChevronDown
                className={`size-3.5 transition-transform duration-200 ${
                  isMisiVisibleMobile ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          </div>

          <h3 className="hidden md:block text-xs font-medium text-[var(--text-muted)] text-center">
            {tentang.judulMisi}
          </h3>

          <ol
            id="tentang-misi-list"
            className={`${
              isMisiVisibleMobile ? 'grid' : 'hidden'
            } md:grid grid-cols-1 md:grid-cols-2 gap-x-8 lg:gap-x-12 gap-y-4 sm:gap-y-5`}
          >
            {tentang.daftarMisi.map((mission, index) => (
              <li
                key={index}
                className={`flex items-start gap-2.5 sm:gap-3 ${VISION_MISSION_TEXT_CLASS}`}
              >
                <span className="tabular-nums shrink-0">
                  {String(index + 1).padStart(2, '0')}.
                </span>
                <span className="flex-1 min-w-0 text-justify">
                  {mission}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
