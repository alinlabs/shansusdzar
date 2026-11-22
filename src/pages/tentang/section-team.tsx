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
      <div className="size-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] overflow-hidden shrink-0">
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
      className="size-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-sm font-semibold text-[var(--text)] shrink-0"
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
    <section aria-labelledby="tentang-tim-heading" className="space-y-6 sm:space-y-8">
      <SectionHeading
        id="tentang-tim-heading"
        align="center"
        eyebrow={tentang.labelTim}
        title={tentang.judulTim}
        description={tentang.deskripsiTim}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
        {tentang.anggotaTim.map((member) => (
          <article
            key={member.id}
            className="pt-5 border-t border-[var(--border)] flex flex-col justify-between gap-3.5"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3.5">
                <TeamAvatar member={member} />
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-semibold text-[var(--text)] leading-snug">
                    {member.nama}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">{member.jabatan}</p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
                {member.biodata}
              </p>
            </div>

            <p className="text-xs text-[var(--text-subtle)]">{member.divisi}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
