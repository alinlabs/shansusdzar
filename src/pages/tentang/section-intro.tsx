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
    <section aria-labelledby="tentang-intro-heading" className="space-y-6 sm:space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-4 sm:gap-y-6 lg:gap-x-10 lg:gap-y-5 items-start">
        <div className="lg:col-span-6 lg:row-start-1 space-y-3 sm:space-y-4">
          <SectionHeading
            as="h1"
            id="tentang-intro-heading"
            align="left"
            eyebrow={tentang.labelAtas}
            title={tentang.judul}
            className="[&_h1]:text-[22px] [&_h1]:sm:text-4xl"
          />

          {tentang.pengantar && (
            <p className="text-[13.5px] sm:text-base font-medium text-[var(--text)] leading-relaxed">
              {tentang.pengantar}
            </p>
          )}
        </div>

        <figure className="lg:col-span-6 lg:col-start-7 lg:row-start-1 lg:row-span-2 space-y-2">
          <div>
            <ImageFallback
              src={workshopPhotoSrc}
              alt={workshopPhotoAlt}
              aspectRatio="auto"
              eager
              fallbackLabel="Workshop Shansus Dzar Indonesia"
              className="aspect-[16/10] sm:aspect-[4/3] rounded-[var(--radius-md)] sm:rounded-[var(--radius-lg)]"
            />
          </div>
          <figcaption className="flex items-center justify-between gap-3 text-[11.5px] sm:text-xs text-[var(--text-muted)]">
            <span>Workshop Produksi &amp; Pemilihan Material</span>
            <span className="shrink-0 font-medium text-[var(--text)]">{regency}</span>
          </figcaption>
        </figure>

        <div className="lg:col-span-6 lg:row-start-2 space-y-3 sm:space-y-4 text-[13.5px] sm:text-base text-[var(--text-muted)] leading-relaxed text-left lg:text-justify">
          {tentang.daftarParagraf.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>

      {tentang.sorotanWorkshop.length > 0 && (
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-4 sm:gap-y-5 py-4 sm:py-5 border-y border-[var(--border)] lg:gap-0 lg:divide-x lg:divide-[var(--border)]">
          {tentang.sorotanWorkshop.map((item) => (
            <div key={item.id} className="lg:px-6 lg:first:pl-0 lg:last:pr-0 space-y-1">
              <dt className="text-[11px] sm:text-xs font-medium text-[var(--text-muted)]">{item.label}</dt>
              <dd className="text-lg sm:text-2xl font-semibold tracking-tight text-[var(--text)] tabular-nums">
                {item.nilai}
              </dd>
              <dd className="text-[11.5px] sm:text-xs text-[var(--text-muted)] leading-relaxed">{item.detail}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
