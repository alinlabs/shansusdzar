import { RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { SectionHeading } from '../../components/ui/section-heading';
import { useTheme } from '../../components/layout/theme-provider';
import { useDocumentTitle } from '../../hooks/use-document-title';
import { useSainAiStore } from '../../sain-ai';
import { DEFAULT_THEME } from '../../lib/theme-preference';
import { usePublicPreferencesStore } from '../../store/public-preferences-store';
import { SectionAkun } from './section-akun';
import { SectionBahasa } from './section-bahasa';
import { SectionSainAi } from './section-sain-ai';
import { SectionNavigasi } from './section-navigasi';
import { SectionNotifikasi } from './section-notifikasi';
import { SectionTema } from './section-tema';

export default function PengaturanPage() {
  useDocumentTitle(
    'Pengaturan Umum | Shansus Dzar Indonesia',
    'Kelola preferensi tampilan tema, navigasi, Sain Ai, bahasa, notifikasi, serta data akun pemesanan di perangkat Anda.'
  );

  const { setTheme } = useTheme();
  const resetPublicPreferences = usePublicPreferencesStore(
    (state) => state.resetPublicPreferences
  );
  const resetSainAiPreferences = useSainAiStore(
    (state) => state.resetSainAiPreferences
  );

  const handleResetAll = () => {
    resetPublicPreferences();
    resetSainAiPreferences();
    setTheme(DEFAULT_THEME);
  };

  return (
    <div className="space-y-7 sm:space-y-9 pb-8">
      <SectionHeading
        as="h1"
        eyebrow="Preferensi Aplikasi"
        title="Pengaturan Umum"
        description="Sesuaikan tampilan tema, navigasi, Sain Ai, bahasa, notifikasi, serta data akun yang tersimpan di perangkat Anda."
      />

      <div className="space-y-7 sm:space-y-8">
        <SectionAkun />
        <SectionTema />
        <SectionNavigasi />
        <SectionSainAi />
        <SectionBahasa />
        <SectionNotifikasi />

        <div className="pt-5 border-t border-[var(--border)] flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleResetAll}
            className="w-full sm:w-auto gap-2"
          >
            <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
            <span>Kembalikan ke Bawaan</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
