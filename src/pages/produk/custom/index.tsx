import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { SectionHeading } from '../../../components/ui/section-heading';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import { SectionCustomConfigurator } from './section-custom-configurator';

export default function CustomInteriorPage() {
  useDocumentTitle(
    'Hitung Estimasi Custom Interior | Shansus Dzar Indonesia',
    'Hitung estimasi furniture dan interior custom per meter persegi: pilih jasa Desain Saja, Build Saja, atau paket Desain + Build lengkap dengan material utama dan finishing/laminasi.'
  );

  return (
    <div className="space-y-8 sm:space-y-10">
      <div className="space-y-4">
        <div className="flex items-center justify-center sm:justify-start">
          <Link
            to="/produk"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Kembali ke Produk Furniture
          </Link>
        </div>

        <SectionHeading
          as="h1"
          align="center"
          eyebrow="Custom Interior"
          title="Hitung Estimasi Sendiri"
          description="Pilih layanan desain saja, build saja, atau keduanya, ukur panjang × lebar bidang, lalu lihat estimasi biaya per meter persegi secara real-time."
        />
      </div>

      <SectionCustomConfigurator />
    </div>
  );
}
