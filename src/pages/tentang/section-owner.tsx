import { ImageFallback } from '../../components/ui/image-fallback';
import { useCachedMediaSrc } from '../../lib/media-cache';
import { useSiteContentStore } from '../../store/site-content-store';
import { resolveOwnerPublicProfile } from './utils';

export function SectionOwner() {
  const ownerDraft = useSiteContentStore((state) => state.businessConfig.drafPemilik);
  const ownerBiography = useSiteContentStore((state) => state.tentang.biografiPemilik);
  const profile = resolveOwnerPublicProfile(ownerDraft, ownerBiography);
  const rawPortraitPath = profile.status === 'verified' ? profile.portraitPath : null;
  const cachedPortraitSrc = useCachedMediaSrc(rawPortraitPath) ?? rawPortraitPath ?? undefined;

  return (
    <section aria-label="Profil Pemilik Usaha" className="space-y-6 sm:space-y-8">

      {profile.status === 'verified' ? (
        <figure className="mx-auto w-full max-w-md sm:max-w-lg">
          <img
            src={cachedPortraitSrc}
            alt={profile.portraitAlt}
            loading="lazy"
            className="block w-full h-auto select-none"
          />

          <figcaption className="relative z-10 -mt-4 sm:-mt-6 rounded-[var(--radius-lg)] bg-[var(--accent)] dark:bg-[#494641] px-5 py-4 sm:px-7 sm:py-5 text-center text-[var(--accent-contrast)] dark:text-white shadow-[var(--shadow-md)] space-y-1.5">
            <blockquote className="text-sm sm:text-base font-medium text-[var(--accent-contrast)] dark:text-white leading-relaxed">
              &ldquo;{profile.quote}&rdquo;
            </blockquote>
            <p className="text-xs text-[var(--accent-contrast)]/75 dark:text-white/75">
              {profile.name}
              <span aria-hidden="true"> · </span>
              {profile.role}
            </p>
          </figcaption>
        </figure>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-md lg:max-w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)]">
              <ImageFallback
                src={null}
                alt={profile.portraitAlt}
                aspectRatio="4/3"
                fallbackLabel="Hilman Aziz Napis"
                className="rounded-none border-0"
              />
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="pt-5 border-t lg:pt-0 lg:border-t-0 lg:border-l lg:pl-8 border-[var(--border)] space-y-3 w-full">
              <h3 className="text-sm sm:text-base font-semibold text-[var(--text)]">
                {profile.noticeTitle}
              </h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {profile.noticeDescription}
              </p>
              <p className="text-xs text-[var(--text-subtle)] leading-relaxed pt-1">
                Kutipan resmi, nama pengelola, dan foto potret akan ditampilkan di bagian ini setelah
                pemilik usaha mengonfirmasi materi yang disetujui.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
