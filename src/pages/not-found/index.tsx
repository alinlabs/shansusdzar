import { LinkButton } from '../../components/ui/button';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle } from '../../hooks/use-document-title';

export default function NotFoundPage() {
  useDocumentTitle('Halaman Tidak Ditemukan | Shansus Dzar Indonesia');

  return (
    <section aria-labelledby="notfound-heading" className="space-y-6 py-8">
      <SectionHeading
        as="h1"
        id="notfound-heading"
        title="Halaman tidak ditemukan"
        description="Tautan yang Anda tuju tidak tersedia atau telah dipindahkan."
      />
      <div>
        <LinkButton to="/" variant="primary">
          Kembali ke Beranda
        </LinkButton>
      </div>
    </section>
  );
}
