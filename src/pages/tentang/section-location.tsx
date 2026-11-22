import { Check, MapPin, MessageCircle } from 'lucide-react';
import { ExternalLinkButton, LinkButton } from '../../components/ui/button';
import { SectionHeading } from '../../components/ui/section-heading';
import { buildDynamicMapsUrl, buildDynamicWhatsAppUrl, useSiteContentStore } from '../../store/site-content-store';

export function SectionLocation() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const tentang = useSiteContentStore((state) => state.tentang);
  const operationalInfo = useSiteContentStore((state) => state.operationalInfo);

  const whatsappUrl = buildDynamicWhatsAppUrl(
    businessConfig,
    `Halo ${businessConfig.namaMerek}, saya ingin konsultasi jadwal survei atau kunjungan workshop di Purwakarta.`
  );
  const mapsUrl = buildDynamicMapsUrl(businessConfig);

  return (
    <section aria-labelledby="tentang-location-heading" className="space-y-6 sm:space-y-8">
      <SectionHeading
        id="tentang-location-heading"
        align="center"
        eyebrow={tentang.labelLokasi}
        title={tentang.judulLokasi}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-10 items-start pt-5 border-t border-[var(--border)]">
        <div className="lg:col-span-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[var(--text-muted)]">Alamat Workshop</p>
              <p className="text-sm sm:text-base text-[var(--text)] leading-relaxed">
                {businessConfig.alamat.alamatLengkap}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[var(--border)] text-xs sm:text-sm">
              <div className="space-y-1">
                <p className="text-xs text-[var(--text-muted)]">Kontak WhatsApp</p>
                <p className="font-medium text-[var(--text)] tabular-nums">
                  {businessConfig.whatsapp.nomorTampil}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[var(--text-muted)]">Jam Layanan Workshop</p>
                <p className="font-medium text-[var(--text)]">{operationalInfo.jamOperasional}</p>
              </div>
            </div>

            {operationalInfo.areaJangkauanSurvei.length > 0 && (
              <div className="pt-4 border-t border-[var(--border)] space-y-1.5">
                <p className="text-xs text-[var(--text-muted)]">Cakupan Survei &amp; Pemasangan</p>
                <p className="text-xs sm:text-sm text-[var(--text)] leading-relaxed">
                  {operationalInfo.areaJangkauanSurvei.join(' · ')}
                </p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {operationalInfo.catatanJadwalSurvei}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            <ExternalLinkButton href={whatsappUrl} variant="primary" size="sm">
              <MessageCircle className="size-4" aria-hidden="true" />
              Konsultasi WhatsApp
            </ExternalLinkButton>
            <ExternalLinkButton href={mapsUrl} variant="secondary" size="sm">
              <MapPin className="size-4" aria-hidden="true" />
              Buka Google Maps
            </ExternalLinkButton>
          </div>
        </div>

        <div className="lg:col-span-6 pt-6 border-t lg:pt-0 lg:border-t-0 lg:border-l lg:pl-10 border-[var(--border)] space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--text-muted)]">Standar Pelayanan</p>
              <h3 className="text-base font-semibold text-[var(--text)]">
                Komitmen Kerja &amp; Garansi Studio
              </h3>
            </div>

            <ul className="space-y-3">
              {tentang.komitmenLayanan.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 text-sm text-[var(--text-muted)] leading-relaxed"
                >
                  <Check
                    className="size-4 text-[var(--text)] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="pt-4 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <p className="text-[var(--text-muted)]">Estimasi Produksi</p>
                <p className="font-medium text-[var(--text)]">{operationalInfo.estimasiWaktuProduksi}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[var(--text-muted)]">Garansi &amp; Purna Jual</p>
                <p className="font-medium text-[var(--text)]">{operationalInfo.ringkasanGaransi}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            <LinkButton to="/produk" variant="secondary" size="sm">
              Jelajahi Produk
            </LinkButton>
            <LinkButton to="/produk/custom" variant="secondary" size="sm">
              Hitung Estimasi Custom
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}
