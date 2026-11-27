import { BUSINESS_CONFIG } from '../../lib/business-config';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../store/site-content-store';
import { TENTANG_STATIC_HEADINGS } from './utils';

function resolveSafeSocialUrl(url: string | undefined, fallback: string): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return fallback;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // Fallback to default safe HTTPS URL
  }
  return fallback;
}

function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5z" />
      <path d="M9.5 8.8c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.7c.1.2.1.4-.1.6l-.5.6c-.1.1-.1.3 0 .5.4.8 1.2 1.6 2 2 .2.1.4.1.5 0l.6-.5c.2-.2.4-.2.6-.1l1.7.7c.3.1.4.3.4.5v.5c0 .3 0 .5-.4.7-.5.3-1.5.5-2.6.1-1.3-.4-2.8-1.4-4-2.6-1.2-1.2-2.2-2.7-2.6-4-.4-1.1-.2-2.1.1-2.6z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0" aria-hidden="true">
      <path d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.6V3.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1V10H7.7v3h2.6v8h3.2z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0" aria-hidden="true">
      <path d="M19.3 6.9a4.6 4.6 0 0 1-3.3-1.4 4.6 4.6 0 0 1-1.3-3.1h-3.1v13.1a2.7 2.7 0 0 1-2.7 2.6 2.7 2.7 0 0 1-2.7-2.7 2.7 2.7 0 0 1 2.7-2.7c.3 0 .6 0 .8.1V9.6a5.8 5.8 0 0 0-.8-.1 5.8 5.8 0 0 0-5.8 5.8 5.8 5.8 0 0 0 5.8 5.8 5.8 5.8 0 0 0 5.8-5.8V8.8a7.7 7.7 0 0 0 4.6 1.5V6.9z" />
    </svg>
  );
}

export function SectionLocation() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const operationalInfo = useSiteContentStore((state) => state.operationalInfo);

  const socialItems = [
    {
      label: 'WhatsApp',
      ariaLabel: `WhatsApp resmi ${businessConfig.namaMerek}`,
      href: buildDynamicWhatsAppUrl(businessConfig),
      icon: <WhatsAppIcon />,
    },
    {
      label: 'Instagram',
      ariaLabel: 'Instagram resmi Shansus Dzar Indonesia',
      href: resolveSafeSocialUrl(
        businessConfig.mediaSosial?.urlInstagram,
        BUSINESS_CONFIG.mediaSosial!.urlInstagram
      ),
      icon: <InstagramIcon />,
    },
    {
      label: 'Facebook',
      ariaLabel: 'Facebook resmi Shansus Dzar Indonesia',
      href: resolveSafeSocialUrl(
        businessConfig.mediaSosial?.urlFacebook,
        BUSINESS_CONFIG.mediaSosial!.urlFacebook
      ),
      icon: <FacebookIcon />,
    },
    {
      label: 'TikTok',
      ariaLabel: 'TikTok resmi Shansus Dzar Indonesia',
      href: resolveSafeSocialUrl(
        businessConfig.mediaSosial?.urlTiktok,
        BUSINESS_CONFIG.mediaSosial!.urlTiktok
      ),
      icon: <TikTokIcon />,
    },
  ];

  return (
    <section aria-labelledby="tentang-location-heading" className="space-y-2 md:space-y-8">
      <div className="flex flex-col gap-3 items-center text-center mx-auto max-w-2xl">
        <div>
          <p className="text-xs font-medium tracking-wide text-[var(--text-muted)] leading-tight mb-0.5">
            {TENTANG_STATIC_HEADINGS.locationEyebrow}
          </p>
          <h2
            id="tentang-location-heading"
            className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text)] leading-snug"
          >
            <span className="md:hidden">{businessConfig.namaMerek}</span>
            <span className="hidden md:inline">{TENTANG_STATIC_HEADINGS.locationTitle}</span>
          </h2>
        </div>
      </div>

      {/* Mobile: langsung teks rata tengah tanpa card pembungkus + 4 card sosial media */}
      <div className="md:hidden text-center flex flex-col items-center space-y-2">
        <p className="text-[13.5px] text-[var(--text-muted)] leading-relaxed">
          {operationalInfo.jamOperasional}
        </p>
        <p className="text-[13.5px] text-[var(--text-muted)] leading-relaxed max-w-md">
          {businessConfig.alamat.alamatLengkap}
        </p>
        <nav
          aria-label="Kontak WhatsApp dan media sosial resmi Shansus Dzar Indonesia"
          className="w-full max-w-sm grid grid-cols-2 gap-2.5 pt-2.5"
        >
          {socialItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={item.ariaLabel}
              className="inline-flex items-center justify-center gap-2 min-h-10 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text)] shadow-[var(--shadow-sm)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] transition-colors min-w-0"
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </a>
          ))}
        </nav>
      </div>

      {/* Desktop: 3 kartu lokasi, kontak, dan cakupan survei */}
      <div className="hidden md:grid md:grid-cols-3 gap-4 sm:gap-5">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-[var(--shadow-sm)] space-y-2">
          <p className="text-xs font-medium text-[var(--text-muted)]">Alamat Workshop</p>
          <p className="text-[13.5px] sm:text-sm text-[var(--text)] leading-relaxed">
            {businessConfig.alamat.alamatLengkap}
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-[var(--shadow-sm)] space-y-4 text-xs sm:text-sm">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[var(--text-muted)]">Kontak WhatsApp</p>
            <p className="font-medium text-[var(--text)] tabular-nums">
              {businessConfig.whatsapp.nomorTampil}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-[var(--text-muted)]">Jam Layanan</p>
            <p className="font-medium text-[var(--text)] leading-snug">
              {operationalInfo.jamOperasional}
            </p>
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-[var(--shadow-sm)] space-y-2">
          <p className="text-xs font-medium text-[var(--text-muted)]">
            Cakupan Survei &amp; Pemasangan
          </p>
          {operationalInfo.areaJangkauanSurvei.length > 0 && (
            <p className="text-[13.5px] sm:text-sm text-[var(--text)] leading-relaxed">
              {operationalInfo.areaJangkauanSurvei.join(' · ')}
            </p>
          )}
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            {operationalInfo.catatanJadwalSurvei}
          </p>
        </div>
      </div>
    </section>
  );
}
