import {
  useAdaptiveNavConfig,
  type AdaptiveNavConfig,
} from '../../components/layout/adaptive-nav-context';
import { useDocumentTitle } from '../../hooks/use-document-title';
import { SectionIntro } from './section-intro';
import { SectionLocation } from './section-location';
import { SectionOwner } from './section-owner';
import { SectionTeam } from './section-team';
import { SectionVisionMission } from './section-vision-mission';

const TENTANG_ADAPTIVE_NAV_CONFIG: AdaptiveNavConfig = {
  header: {
    hideSearchIcon: true,
  },
};

export default function TentangPage() {
  useAdaptiveNavConfig(TENTANG_ADAPTIVE_NAV_CONFIG);

  useDocumentTitle(
    'Tentang Kami, Visi Misi & Tim | Shansus Dzar Indonesia',
    'Kenali visi, misi, tim perencana dan pengrajin, pendekatan kerja, serta lokasi workshop Shansus Dzar Indonesia (Interior Design & Building) di Purwakarta.'
  );

  return (
    <div className="space-y-9 sm:space-y-16">
      <SectionIntro />
      <SectionVisionMission />
      <SectionOwner />
      <SectionTeam />
      <SectionLocation />
    </div>
  );
}
