import { SectionHeading } from '../../components/ui/section-heading';
import { useCachedMediaSrc } from '../../lib/media-cache';
import { buildDynamicMapsUrl, useSiteContentStore } from '../../store/site-content-store';

export function SectionLokasi() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const mapsSearchUrl = buildDynamicMapsUrl(businessConfig);
  const whiteLogoSrc = useCachedMediaSrc('/logo-white.webp') ?? '/logo-white.webp';

  return (
    <section aria-labelledby="beranda-lokasi-heading" className="space-y-6 sm:space-y-8">
      <SectionHeading
        id="beranda-lokasi-heading"
        align="center"
        eyebrow="Lokasi Kami"
        title="Temukan Workshop Kami"
      />

      <a
        href={mapsSearchUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Buka lokasi ${businessConfig.namaMerek} di Google Maps`}
        className="group block overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] hover:border-[var(--border-strong)] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-2"
      >
        <div className="relative h-56 sm:h-72 overflow-hidden bg-[var(--surface-muted)] border-b border-[var(--border)]">
          <svg
            aria-hidden="true"
            viewBox="0 0 800 360"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 size-full text-[var(--border-strong)] opacity-60 transition-transform duration-500 ease-[var(--ease-studio)] group-hover:scale-[1.02]"
          >
            <defs>
              <pattern
                id="studio-map-grid"
                width="48"
                height="48"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 48 0 L 0 0 0 48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.6"
                  opacity="0.35"
                />
              </pattern>
            </defs>

            <rect width="800" height="360" fill="url(#studio-map-grid)" />

            {/* Stylized road & block lines */}
            <path
              d="M -20 265 Q 190 230 390 190 T 820 115"
              fill="none"
              stroke="var(--surface)"
              strokeWidth="18"
              strokeLinecap="round"
            />
            <path
              d="M -20 265 Q 190 230 390 190 T 820 115"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="6 6"
              opacity="0.5"
            />

            <path
              d="M 180 -10 C 215 95, 290 165, 415 370"
              fill="none"
              stroke="var(--surface)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M 540 -10 C 515 110, 470 210, 435 370"
              fill="none"
              stroke="var(--surface)"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 60 95 L 335 150 L 740 245"
              fill="none"
              stroke="var(--surface)"
              strokeWidth="9"
              strokeLinecap="round"
            />

            {/* Subtle land parcel blocks */}
            <rect
              x="295"
              y="108"
              width="72"
              height="44"
              rx="4"
              fill="var(--surface)"
              opacity="0.55"
            />
            <rect
              x="442"
              y="138"
              width="86"
              height="52"
              rx="4"
              fill="var(--surface)"
              opacity="0.55"
            />
            <rect
              x="332"
              y="222"
              width="64"
              height="48"
              rx="4"
              fill="var(--surface)"
              opacity="0.45"
            />
          </svg>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent dark:from-black/25"
          />

          <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-13 h-16 shrink-0 drop-shadow-[0_8px_16px_rgba(15,15,18,0.22)] transition-transform duration-300 ease-[var(--ease-studio)] group-hover:-translate-y-0.5">
                <svg
                  viewBox="0 0 56 68"
                  className="size-full overflow-visible"
                  aria-hidden="true"
                >
                  <path
                    d="M 28 63 C 20 53 6 39 6 25 A 22 22 0 1 1 50 25 C 50 39 36 53 28 63 Z"
                    fill="#27272a"
                    stroke="var(--surface)"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                </svg>
                <img
                  src={whiteLogoSrc}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-[36.8%] -translate-x-1/2 -translate-y-1/2 size-6 object-contain"
                />
              </div>

              <div className="px-3.5 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-sm shadow-[var(--shadow-sm)]">
                <p className="text-xs sm:text-sm font-semibold text-[var(--text)] leading-tight">
                  {businessConfig.namaMerekSingkat}
                </p>
                <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mt-0.5">
                  {businessConfig.alamat.desa}, {businessConfig.alamat.kabupaten}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 text-center min-w-0">
          <p className="text-xs sm:text-sm font-medium text-[var(--text)] leading-relaxed max-w-xl mx-auto">
            {businessConfig.alamat.alamatLengkap}
          </p>
        </div>
      </a>
    </section>
  );
}
