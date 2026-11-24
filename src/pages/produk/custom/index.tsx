import { SectionHeading } from '../../../components/ui/section-heading';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import { SectionCustomConfigurator } from './section-custom-configurator';

export default function CustomInteriorPage() {
  useDocumentTitle(
    'Hitung Estimasi Design & Build Custom | Shansus Dzar Indonesia',
    'Hitung estimasi furniture dan interior custom: pilih produk dari katalog, tentukan ukuran (cm), material, finishing, dan warna pilihan Anda.'
  );

  return (
    <div className="space-y-8 sm:space-y-10">
      <SectionHeading
        as="h1"
        align="center"
        eyebrow="Design & Build Custom"
        title="Hitung Estimasi Sendiri"
      />

      <SectionCustomConfigurator />
    </div>
  );
}
