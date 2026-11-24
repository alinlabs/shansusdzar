import { Check, MapPin, MessageCircle } from 'lucide-react';
import { Button, ExternalLinkButton, LinkButton } from '../../components/ui/button';
import { SectionHeading } from '../../components/ui/section-heading';
import { buildDynamicMapsUrl, useSiteContentStore } from '../../store/site-content-store';
import { useUserProfileStore } from '../../store/user-profile-store';

export function SectionLocation() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const tentang = useSiteContentStore((state) => state.tentang);
  const operationalInfo = useSiteContentStore((state) => state.operationalInfo);
  const requestSurvey = useUserProfileStore((state) => state.requestSurvey);

  const mapsUrl = buildDynamicMapsUrl(businessConfig);

  const handleRequestSurvey = () => {
    requestSurvey({
      surveyContextLabel:
        'Saya ingin menjadwalkan survei lokasi atau konsultasi kunjungan workshop.',
      surveyActivityNote: 'Mengajukan request survei dari halaman Tentang',
    });
  };

  return (
    <section aria-labelledby="tentang-location-heading" className="space-y-5 sm:space-y-8">
      <SectionHeading
        id="tentang-location-heading"
        align="center"
        eyebrow={tentang.labelLokasi}
        title={tentang.judulLokasi}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 lg:gap-10 items-start pt-4 sm:pt-5 border-t border-[var(--border)]">
        <div className="lg:col-span-6 space-y-4 sm:space-y-5 flex flex-col justify-between">
          <div className="space-y-3.5 sm:space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[var(--text-muted)]">Alamat Workshop</p>
              <p className="text-[13.5px] sm:text-base text-[var(--text)] leading-relaxed">
                {businessConfig.alamat.alamatLengkap}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-3.5 sm:pt-4 border-t border-[var(--border)] text-xs sm:text-sm">
              <div className="space-y-1">
                <p className="text-[11.5px] sm:text-xs text-[var(--text-muted)]">Kontak WhatsApp</p>
                <p className="font-medium text-[var(--text)] tabular-nums">
                  {businessConfig.whatsapp.nomorTampil}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11.5px] sm:text-xs text-[var(--text-muted)]">Jam Layanan</p>
                <p className="font-medium text-[var(--text)] leading-snug">{operationalInfo.jamOperasional}</p>
              </div>
            </div>

            {operationalInfo.areaJangkauanSurvei.length > 0 && (
              <div className="pt-3.5 sm:pt-4 border-t border-[var(--border)] space-y-1.5">
                <p className="text-[11.5px] sm:text-xs text-[var(--text-muted)]">Cakupan Survei &amp; Pemasangan</p>
                <p className="text-xs sm:text-sm text-[var(--text)] leading-relaxed">
                  {operationalInfo.areaJangkauanSurvei.join(' · ')}
                </p>
                <p className="text-[11.5px] sm:text-xs text-[var(--text-muted)] leading-relaxed">
                  {operationalInfo.catatanJadwalSurvei}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-2.5 pt-1 sm:pt-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleRequestSurvey}
              className="w-full sm:w-auto px-2.5 sm:px-4 whitespace-normal sm:whitespace-nowrap text-center"
            >
              <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>Minta Survei</span>
            </Button>
            <ExternalLinkButton
              href={mapsUrl}
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto px-2.5 sm:px-4 whitespace-normal sm:whitespace-nowrap text-center"
            >
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              <span>Buka Maps</span>
            </ExternalLinkButton>
          </div>
        </div>

        <div className="lg:col-span-6 pt-5 border-t lg:pt-0 lg:border-t-0 lg:border-l lg:pl-10 border-[var(--border)] space-y-4 sm:space-y-5 flex flex-col justify-between">
          <div className="space-y-3.5 sm:space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--text-muted)]">Standar Pelayanan</p>
              <h3 className="text-[15px] sm:text-base font-semibold text-[var(--text)]">
                Komitmen Kerja &amp; Garansi Studio
              </h3>
            </div>

            <ul className="space-y-2.5 sm:space-y-3">
              {tentang.komitmenLayanan.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 text-[13.5px] sm:text-sm text-[var(--text-muted)] leading-relaxed"
                >
                  <Check
                    className="size-4 text-[var(--text)] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="pt-3.5 sm:pt-4 border-t border-[var(--border)] grid grid-cols-2 gap-3 sm:gap-4 text-xs">
              <div className="space-y-1">
                <p className="text-[11.5px] sm:text-xs text-[var(--text-muted)]">Estimasi Produksi</p>
                <p className="font-medium text-[var(--text)] leading-snug">{operationalInfo.estimasiWaktuProduksi}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11.5px] sm:text-xs text-[var(--text-muted)]">Garansi &amp; Purna Jual</p>
                <p className="font-medium text-[var(--text)] leading-snug">{operationalInfo.ringkasanGaransi}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-2.5 pt-1 sm:pt-2">
            <LinkButton
              to="/produk"
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto px-2.5 sm:px-4 whitespace-normal sm:whitespace-nowrap text-center"
            >
              Jelajahi Produk
            </LinkButton>
            <LinkButton
              to="/produk/custom"
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto px-2.5 sm:px-4 whitespace-normal sm:whitespace-nowrap text-center"
            >
              Estimasi Custom
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}
