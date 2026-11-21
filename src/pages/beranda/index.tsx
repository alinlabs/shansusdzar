import { ArrowRight, Headset } from 'lucide-react';
import { ExternalLinkButton, LinkButton } from '../../components/ui/button';
import { useDocumentTitle } from '../../hooks/use-document-title';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../store/site-content-store';
import { SectionHero } from './section-hero';
import { SectionKeunggulan } from './section-keunggulan';
import { SectionLokasi } from './section-lokasi';
import { SectionPortofolio } from './section-portofolio';
import { SectionProdukUnggulan } from './section-produk-unggulan';
import { SectionProses } from './section-proses';
import { SectionTestimoni } from './section-testimoni';

export default function BerandaPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const surveyWhatsappUrl = buildDynamicWhatsAppUrl(
    businessConfig,
    `Halo ${businessConfig.namaMerek}, saya ingin bertanya apakah bisa dilakukan survei pengukuran hari ini?`
  );

  useDocumentTitle(
    businessConfig.namaMerek,
    businessConfig.drafSlogan
  );

  return (
    <div className="space-y-10 sm:space-y-14">
      <div>
        <SectionHero />
        <div
          aria-label="Aksi cepat beranda"
          className="relative z-20 -mt-9 sm:-mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:hidden"
        >
          <LinkButton
            to="/produk"
            variant="primary"
            size="md"
            fullWidth
            className="px-3 sm:px-5 sm:min-h-12"
          >
            Lihat Produk
            <ArrowRight className="size-4" aria-hidden="true" />
          </LinkButton>
          <ExternalLinkButton
            href={surveyWhatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="md"
            fullWidth
            className="px-3 sm:px-5 sm:min-h-12"
          >
            <Headset className="size-4" aria-hidden="true" />
            Minta Survei
          </ExternalLinkButton>
        </div>
      </div>
      <SectionPortofolio />
      <SectionProdukUnggulan />
      <SectionKeunggulan />
      <SectionProses />
      <SectionTestimoni />
      <SectionLokasi />
    </div>
  );
}
