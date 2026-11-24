import { useState } from 'react';
import { SectionHeading } from '../../components/ui/section-heading';
import { useCachedMediaSrc } from '../../lib/media-cache';
import { useSiteContentStore } from '../../store/site-content-store';
import type { TeamMemberData } from '../../types/cms';

function TeamAvatar({ member }: { member: TeamMemberData }) {
  const cachedSrc = useCachedMediaSrc(member.fotoProfil || null);
  const src = cachedSrc ?? (member.fotoProfil?.trim() || null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  if (showImage && src) {
    return (
      <div className="size-11 sm:size-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] overflow-hidden shrink-0">
        <img
          src={src}
          alt={member.teksAltFoto?.trim() || `Foto ${member.nama}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
          className="size-full object-cover object-top"
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="size-11 sm:size-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-sm font-semibold text-[var(--text)] shrink-0"
    >
      {member.inisial}
    </div>
  );
}

export function SectionTeam() {
  const tentang = useSiteContentStore((state) => state.tentang);
  const ownerName = useSiteContentStore((state) => state.businessConfig.drafPemilik.namaPemilik)
    .trim()
    .toLowerCase();

  const teamMembers = tentang.anggotaTim.filter(
    (member) =>
      member.id !== 'tim-hilman' &&
      (!ownerName || member.nama.trim().toLowerCase() !== ownerName)
  );

  if (teamMembers.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="tentang-tim-heading" className="space-y-5 sm:space-y-8">
      <SectionHeading
        id="tentang-tim-heading"
        align="center"
        eyebrow={tentang.labelTim}
        title={tentang.judulTim}
      />

      <div
        className={
          teamMembers.length <= 3
            ? 'grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-6'
            : 'grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-6'
        }
      >
        {teamMembers.map((member) => (
          <article
            key={member.id}
            className="p-3.5 sm:p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left"
          >
            <div className="flex flex-col items-center sm:flex-row sm:items-center gap-2.5 sm:gap-3.5 min-w-0 w-full">
              <TeamAvatar member={member} />
              <div className="min-w-0 space-y-0.5">
                <h3 className="text-[13px] sm:text-base font-semibold text-[var(--text)] leading-snug">
                  {member.nama}
                </h3>
                <p className="text-[11px] sm:text-xs text-[var(--text-muted)] leading-snug">
                  {member.jabatan}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
