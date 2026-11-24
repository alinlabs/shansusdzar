import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { ImageFallback } from '../../components/ui/image-fallback';
import { SectionHeading } from '../../components/ui/section-heading';
import { DEFAULT_TENTANG_CONTENT } from '../../lib/cms-defaults';
import { useSiteContentStore } from '../../store/site-content-store';

export function SectionIntro() {
  const tentang = useSiteContentStore((state) => state.tentang);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const workshopPhotoSrc =
    tentang.gambarWorkshop?.trim() ||
    DEFAULT_TENTANG_CONTENT.gambarWorkshop ||
    '/images/atelier-studio-craft.webp';
  const workshopPhotoAlt =
    tentang.teksAltWorkshop?.trim() ||
    DEFAULT_TENTANG_CONTENT.teksAltWorkshop ||
    'Workshop Shansus Dzar Indonesia';
  const hasParagraphs = tentang.daftarParagraf.length > 0;

  return (
    <section aria-labelledby="tentang-intro-heading" className="space-y-6 sm:space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-5 sm:gap-y-6 lg:gap-x-10 lg:gap-y-5 items-start">
        <div className="relative left-1/2 -translate-x-1/2 w-screen -mt-5 sm:-mt-9 min-h-[300px] aspect-[4/3] sm:aspect-[16/9] overflow-hidden bg-[var(--bg)] flex flex-col justify-end lg:static lg:left-auto lg:translate-x-0 lg:w-auto lg:mt-0 lg:min-h-0 lg:aspect-auto lg:overflow-visible lg:bg-transparent lg:block lg:col-span-6 lg:row-start-1">
          <img
            src={workshopPhotoSrc}
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="pointer-events-none absolute inset-0 size-full object-cover lg:hidden"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-px -bottom-px h-[68%] sm:h-[58%] bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/80 to-transparent lg:hidden"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-l from-transparent via-[var(--bg)]/45 to-[var(--bg)]/85 lg:hidden"
          />

          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-4 pt-12 sm:px-6 sm:pb-6 lg:max-w-none lg:px-0 lg:py-0 space-y-2.5 sm:space-y-4">
            <SectionHeading
              as="h1"
              id="tentang-intro-heading"
              align="left"
              eyebrow={tentang.labelAtas}
              title={tentang.judul}
              className="[&_h1]:text-[24px] [&_h1]:sm:text-4xl"
            />

            {tentang.pengantar && (
              <p className="text-[13.5px] sm:text-base font-medium text-[var(--text)] leading-relaxed max-w-xl lg:max-w-none">
                {tentang.pengantar}
                {hasParagraphs && (
                  <button
                    type="button"
                    aria-expanded={isMobileExpanded}
                    aria-controls="tentang-studio-description"
                    aria-label={
                      isMobileExpanded
                        ? 'Sembunyikan deskripsi studio'
                        : 'Tampilkan deskripsi studio'
                    }
                    onClick={() => setIsMobileExpanded((prev) => !prev)}
                    className="md:hidden inline-flex items-center justify-center align-middle ml-1.5 size-6 -my-0.5 rounded-[var(--radius-sm)] text-[var(--text)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-strong)] cursor-pointer"
                  >
                    <ChevronDown
                      className={`size-4 transition-transform duration-200 ${
                        isMobileExpanded ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="hidden lg:block lg:col-span-6 lg:col-start-7 lg:row-start-1 lg:row-span-2 lg:self-center">
          <ImageFallback
            src={workshopPhotoSrc}
            alt={workshopPhotoAlt}
            aspectRatio="auto"
            eager
            fallbackLabel="Workshop Shansus Dzar Indonesia"
            className="lg:aspect-video rounded-[var(--radius-lg)]"
          />
        </div>

        {hasParagraphs && (
          <div
            id="tentang-studio-description"
            className={`${
              isMobileExpanded ? 'block' : 'hidden'
            } md:block lg:col-span-6 lg:row-start-2 text-[13.5px] sm:text-base text-[var(--text-muted)] leading-relaxed text-justify space-y-3 sm:space-y-4`}
          >
            {tentang.daftarParagraf.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        )}
      </div>

      {tentang.sorotanWorkshop.length > 0 && (
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {tentang.sorotanWorkshop.map((item) => (
            <div
              key={item.id}
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-5 shadow-[var(--shadow-sm)] text-center flex flex-col items-center justify-center md:justify-start gap-1 sm:gap-1.5"
            >
              <dt className="text-[11px] sm:text-xs font-medium text-[var(--text-muted)]">
                {item.label}
              </dt>
              <dd className="text-lg sm:text-2xl font-semibold tracking-tight text-[var(--text)] tabular-nums">
                {item.nilai}
              </dd>
              <dd className="hidden md:block text-[11.5px] sm:text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
                {item.detail}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
