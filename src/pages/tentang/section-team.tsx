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
      <div className="size-14 sm:size-12 mx-auto sm:mx-0 -mt-11 sm:mt-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] ring-[3px] ring-[var(--bg)] sm:ring-0 shadow-[var(--shadow-sm)] sm:shadow-none overflow-hidden shrink-0">
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
      className="size-14 sm:size-12 mx-auto sm:mx-0 -mt-11 sm:mt-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] ring-[3px] ring-[var(--bg)] sm:ring-0 shadow-[var(--shadow-sm)] sm:shadow-none flex items-center justify-center text-sm font-semibold text-[var(--text)] shrink-0"
    >
      {member.inisial}
    </div>
  );
}

export function SectionTeam() {
  const tentang = useSiteContentStore((state) => state.tentang);

  if (tentang.anggotaTim.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="tentang-tim-heading" className="space-y-5 sm:space-y-8">
      <SectionHeading
        id="tentang-tim-heading"
        align="center"
        eyebrow={tentang.labelTim}
        title={tentang.judulTim}
        description={tentang.deskripsiTim}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-11 pt-8 sm:pt-0 sm:gap-6">
        {tentang.anggotaTim.map((member) => (
          <article
            key={member.id}
            className="p-3.5 sm:p-0 sm:pt-5 rounded-[var(--radius-md)] sm:rounded-none border border-[var(--border)] sm:border-0 sm:border-t bg-[var(--surface)] sm:bg-transparent flex flex-col items-center sm:items-start text-center sm:text-left"
          >
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3.5">
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
