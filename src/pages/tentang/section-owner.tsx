import { ImageFallback } from '../../components/ui/image-fallback';
import { useCachedMediaSrc } from '../../lib/media-cache';
import { useSiteContentStore } from '../../store/site-content-store';
import { resolveOwnerPublicProfile } from './utils';

function formatShortOwnerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name.trim();
  const initials = parts
    .slice(1)
    .map((part) => part.charAt(0).toUpperCase())
    .join('.');
  return `${parts[0]} ${initials}`;
}

function formatShortOwnerRole(role: string): string {
  const trimmed = role.trim();
  if (/^Owner\s+SDI\b/i.test(trimmed)) return 'Owner SDI';
  return trimmed;
}

function formatShortOwnerQuote(quote: string): string {
  const trimmed = quote.trim();
  if (
    trimmed ===
    'Ketelitian pengerjaan dan kejujuran material untuk ruang yang nyaman serta bertahan lama.'
  ) {
    return 'Ketelitian & kejujuran material untuk ruang tahan lama.';
  }
  return trimmed;
}

export function SectionOwner() {
  const ownerDraft = useSiteContentStore((state) => state.businessConfig.drafPemilik);
  const profile = resolveOwnerPublicProfile(ownerDraft);
  const rawPortraitPath = profile.status === 'verified' ? profile.portraitPath : null;
  const cachedPortraitSrc = useCachedMediaSrc(rawPortraitPath) ?? rawPortraitPath ?? undefined;

  return (
    <section aria-label="Profil Pemilik Usaha" className="space-y-6 sm:space-y-8">
      {profile.status === 'verified' ? (
        <figure className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-[var(--shadow-sm)] flex flex-row items-center gap-3.5 sm:gap-5">
          {cachedPortraitSrc && (
            <div className="size-14 sm:size-16 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] overflow-hidden shrink-0">
              <img
                src={cachedPortraitSrc}
                alt={profile.portraitAlt}
                loading="lazy"
                decoding="async"
                className="size-full object-cover object-top select-none"
              />
            </div>
          )}

          <figcaption className="min-w-0 space-y-1 sm:space-y-1.5">
            <p className="text-xs text-[var(--text-muted)] truncate">
              <span className="sm:hidden">
                <span className="font-semibold text-[var(--text)]">
                  {formatShortOwnerName(profile.name)}
                </span>
                <span aria-hidden="true"> · </span>
                <span>{formatShortOwnerRole(profile.role)}</span>
              </span>
              <span className="hidden sm:inline">
                <span className="font-semibold text-[var(--text)]">{profile.name}</span>
                <span aria-hidden="true"> · </span>
                <span>{profile.role}</span>
              </span>
            </p>
            <blockquote className="text-[13px] sm:text-base font-medium text-[var(--text)] leading-snug sm:leading-relaxed">
              <span className="sm:hidden line-clamp-2">
                &ldquo;{formatShortOwnerQuote(profile.quote)}&rdquo;
              </span>
              <span className="hidden sm:inline">&ldquo;{profile.quote}&rdquo;</span>
            </blockquote>
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
            <div className="space-y-3 w-full">
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
