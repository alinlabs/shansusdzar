import { ArrowRight, Headset } from 'lucide-react';
import { Button, LinkButton } from '../../components/ui/button';
import { useDocumentTitle } from '../../hooks/use-document-title';
import { prefetchRoute } from '../../lib/route-prefetch';
import { useSiteContentStore } from '../../store/site-content-store';
import { useUserProfileStore } from '../../store/user-profile-store';
import { SectionHero } from './section-hero';
import { SectionKeunggulan } from './section-keunggulan';
import { SectionLokasi } from './section-lokasi';
import { SectionPortofolio } from './section-portofolio';
import { SectionProdukUnggulan } from './section-produk-unggulan';
import { SectionProses } from './section-proses';
import { SectionTestimoni } from './section-testimoni';

export default function BerandaPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const requestSurvey = useUserProfileStore((state) => state.requestSurvey);

  useDocumentTitle(
    businessConfig.namaMerek,
    businessConfig.drafSlogan
  );

  const handleMobileRequestSurvey = () => {
    requestSurvey({
      surveyActivityNote: 'Mengajukan request survei lokasi dari Beranda',
    });
  };

  return (
    <div className="space-y-10 sm:space-y-14">
      <div>
        <SectionHero />
        <div
          aria-label="Aksi cepat beranda"
          className="relative z-20 -mt-9 sm:-mt-12 grid grid-cols-2 gap-2.5 sm:gap-4 lg:hidden"
        >
          <LinkButton
            to="/produk"
            variant="primary"
            size="md"
            fullWidth
            onMouseEnter={() => prefetchRoute('/produk')}
            onFocus={() => prefetchRoute('/produk')}
            className="gap-1.5 sm:gap-2 px-2.5 sm:px-5 text-[13px] sm:text-sm sm:min-h-12"
          >
            <span>Lihat Produk</span>
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </LinkButton>
          <Button
            type="button"
            variant="secondary"
            size="md"
            fullWidth
            onClick={handleMobileRequestSurvey}
            data-testid="mobile-minta-survei-btn"
            className="gap-1.5 sm:gap-2 px-2.5 sm:px-5 text-[13px] sm:text-sm sm:min-h-12"
          >
            <Headset className="size-4 shrink-0" aria-hidden="true" />
            <span>Minta Survei</span>
          </Button>
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
