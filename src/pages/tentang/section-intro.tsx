import { ImageFallback } from '../../components/ui/image-fallback';
import { SectionHeading } from '../../components/ui/section-heading';
import { useSiteContentStore } from '../../store/site-content-store';
import { STUDIO_CRAFT_IMAGE } from './utils';

export function SectionIntro() {
  const tentang = useSiteContentStore((state) => state.tentang);
  const regency = useSiteContentStore((state) => state.businessConfig.alamat.kabupaten);
  const workshopPhotoSrc = tentang.gambarWorkshop?.trim() || STUDIO_CRAFT_IMAGE.sumberGambar;
  const workshopPhotoAlt = tentang.teksAltWorkshop?.trim() || STUDIO_CRAFT_IMAGE.teksAlt;

  return (
    <section aria-labelledby="tentang-intro-heading" className="space-y-8 sm:space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-6 lg:gap-x-10 lg:gap-y-5 items-start">
        <div className="lg:col-span-6 lg:row-start-1 space-y-4">
          <SectionHeading
            as="h1"
            id="tentang-intro-heading"
            align="left"
            eyebrow={tentang.labelAtas}
            title={tentang.judul}
          />

          {tentang.pengantar && (
            <p className="text-sm sm:text-base font-medium text-[var(--text)] leading-relaxed">
              {tentang.pengantar}
            </p>
          )}
        </div>

        <figure className="lg:col-span-6 lg:col-start-7 lg:row-start-1 lg:row-span-2 space-y-2.5">
          <div className="-mx-4 sm:mx-0">
            <ImageFallback
              src={workshopPhotoSrc}
              alt={workshopPhotoAlt}
              aspectRatio="4/3"
              eager
              fallbackLabel="Workshop Shansus Dzar Indonesia"
              className="rounded-none sm:rounded-[var(--radius-lg)]"
            />
          </div>
          <figcaption className="flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
            <span>Workshop Produksi &amp; Pemilihan Material</span>
            <span className="shrink-0 font-medium text-[var(--text)]">{regency}</span>
          </figcaption>
        </figure>

        <div className="lg:col-span-6 lg:row-start-2 space-y-4 text-sm sm:text-base text-[var(--text-muted)] leading-relaxed text-justify">
          {tentang.daftarParagraf.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>

      {tentang.sorotanWorkshop.length > 0 && (
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 py-5 border-y border-[var(--border)] lg:gap-0 lg:divide-x lg:divide-[var(--border)]">
          {tentang.sorotanWorkshop.map((item) => (
            <div key={item.id} className="lg:px-6 lg:first:pl-0 lg:last:pr-0 space-y-1">
              <dt className="text-xs font-medium text-[var(--text-muted)]">{item.label}</dt>
              <dd className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text)] tabular-nums">
                {item.nilai}
              </dd>
              <dd className="text-xs text-[var(--text-muted)] leading-relaxed">{item.detail}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
