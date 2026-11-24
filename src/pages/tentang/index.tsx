import { useDocumentTitle } from '../../hooks/use-document-title';
import { SectionIntro } from './section-intro';
import { SectionLocation } from './section-location';
import { SectionOwner } from './section-owner';
import { SectionTeam } from './section-team';
import { SectionValues } from './section-values';
import { SectionVisionMission } from './section-vision-mission';

export default function TentangPage() {
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
      <SectionValues />
      <SectionLocation />
    </div>
  );
}
