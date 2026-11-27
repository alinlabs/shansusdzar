import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import {
  useAdaptiveNavConfig,
  type AdaptiveNavConfig,
} from '../../components/layout/adaptive-nav-context';
import { SectionHeading } from '../../components/ui/section-heading';
import { useTheme } from '../../components/layout/theme-provider';
import { useDocumentTitle } from '../../hooks/use-document-title';
import { useIsMobileViewport } from '../../hooks/use-mobile-viewport';
import {
  MOBILE_SETTINGS_TABS,
  resolveMobileSettingsTabFromLocation,
  type MobileSettingsTab,
} from '../../lib/settings-tabs';
import { useSainAiStore } from '../../sain-ai';
import { DEFAULT_THEME } from '../../lib/theme-preference';
import { usePublicPreferencesStore } from '../../store/public-preferences-store';
import { SectionAkun } from './section-akun';
import { SectionBahasa } from './section-bahasa';
import { SectionSainAi } from './section-sain-ai';
import { SectionNavigasi } from './section-navigasi';
import { SectionNotifikasi } from './section-notifikasi';
import { SectionPenyimpanan } from './section-penyimpanan';
import { SectionTema } from './section-tema';

const PENGATURAN_ADAPTIVE_NAV_CONFIG: AdaptiveNavConfig = {
  header: {
    hideSearchIcon: true,
  },
};

export default function PengaturanPage() {
  useAdaptiveNavConfig(PENGATURAN_ADAPTIVE_NAV_CONFIG);

  useDocumentTitle(
    'Pengaturan | Shansus Dzar Indonesia',
    'Kelola akun, tema, navigasi, Sain Ai, bahasa, notifikasi, dan penyimpanan perangkat.'
  );

  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobileViewport();
  const { setTheme } = useTheme();
  const resetPublicPreferences = usePublicPreferencesStore(
    (state) => state.resetPublicPreferences
  );
  const resetSainAiPreferences = useSainAiStore(
    (state) => state.resetSainAiPreferences
  );

  const intent = searchParams.get('intent');
  const [activeMobileTab, setActiveMobileTab] = useState<MobileSettingsTab>(() =>
    resolveMobileSettingsTabFromLocation({
      hash: location.hash,
      intent,
    })
  );
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  useEffect(() => {
    if (location.hash || intent) {
      setActiveMobileTab(
        resolveMobileSettingsTabFromLocation({
          hash: location.hash,
          intent,
        })
      );
    }
  }, [location.hash, intent]);

  const handleResetAll = () => {
    resetPublicPreferences();
    resetSainAiPreferences();
    setTheme(DEFAULT_THEME);
    setResetNotice('Preferensi dikembalikan ke bawaan.');
  };

  return isMobile ? (
    <>
      <h1 className="sr-only">Pengaturan</h1>
      <div className="-mt-5 sm:-mt-9 pb-8 space-y-5">
        <div
          role="tablist"
          aria-label="Kategori pengaturan"
          data-testid="pengaturan-mobile-tablist"
          className="sticky top-0 z-20 grid grid-cols-4 border-b border-[var(--border)] bg-[var(--surface)] -mx-4 px-4 sm:-mx-6 sm:px-6"
        >
          {MOBILE_SETTINGS_TABS.map((tab, index) => {
            const isActive = activeMobileTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`pengaturan-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`pengaturan-panel-${tab.id}`}
                data-testid={`pengaturan-tab-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveMobileTab(tab.id)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    const nextTab = MOBILE_SETTINGS_TABS[(index + 1) % MOBILE_SETTINGS_TABS.length];
                    setActiveMobileTab(nextTab.id);
                    document.getElementById(`pengaturan-tab-${nextTab.id}`)?.focus();
                  } else if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    const prevTab =
                      MOBILE_SETTINGS_TABS[
                        (index - 1 + MOBILE_SETTINGS_TABS.length) % MOBILE_SETTINGS_TABS.length
                      ];
                    setActiveMobileTab(prevTab.id);
                    document.getElementById(`pengaturan-tab-${prevTab.id}`)?.focus();
                  }
                }}
                className={[
                  'min-h-11 py-2.5 px-1 text-center text-xs font-medium whitespace-nowrap transition-colors duration-150 cursor-pointer border-b-2 -mb-px focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-[-2px]',
                  isActive
                    ? 'border-[var(--text)] text-[var(--text)] font-semibold'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          id={`pengaturan-panel-${activeMobileTab}`}
          role="tabpanel"
          aria-labelledby={`pengaturan-tab-${activeMobileTab}`}
          data-testid={`pengaturan-panel-${activeMobileTab}`}
        >
          {activeMobileTab === 'akun' && <SectionAkun hideSectionHeader />}

          {activeMobileTab === 'tampilan' && (
            <div className="space-y-7">
              <SectionTema />
              <SectionNavigasi />
              <SectionSainAi />
              <SectionBahasa />
            </div>
          )}

          {activeMobileTab === 'notifikasi' && <SectionNotifikasi hideSectionHeader />}

          {activeMobileTab === 'penyimpanan' && (
            <SectionPenyimpanan
              onResetAll={handleResetAll}
              resetNotice={resetNotice}
              hideSectionHeader
            />
          )}
        </div>
      </div>
    </>
  ) : (
    <div className="space-y-9 pb-8">
      <SectionHeading
        as="h1"
        eyebrow="Preferensi"
        title="Pengaturan"
      />

      <div className="space-y-8">
        <SectionAkun />
        <SectionTema />
        <SectionNavigasi />
        <SectionSainAi />
        <SectionBahasa />
        <SectionNotifikasi />
        <SectionPenyimpanan onResetAll={handleResetAll} resetNotice={resetNotice} />
      </div>
    </div>
  );
}
