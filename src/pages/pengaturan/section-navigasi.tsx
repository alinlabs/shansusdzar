import {
  ArrowUpToLine,
  Download,
  LayoutPanelTop,
  PanelBottom,
  ScrollText,
  Tag,
} from 'lucide-react';
import { useLocation } from 'react-router';
import { Button } from '../../components/ui/button';
import { useAppInstall } from '../../hooks/use-app-install';
import { useIsMobileViewport } from '../../hooks/use-mobile-viewport';
import { shouldShowManualInstallAction } from '../../lib/app-install';
import { usePublicPreferencesStore } from '../../store/public-preferences-store';
import { PreferenceSwitchRow, SettingsSection } from './components';

export function SectionNavigasi() {
  const location = useLocation();
  const navigation = usePublicPreferencesStore((state) => state.navigation);
  const setNavigationPreference = usePublicPreferencesStore(
    (state) => state.setNavigationPreference
  );
  const isMobile = useIsMobileViewport();
  const activeShowFooter = isMobile ? navigation.showFooterMobile : navigation.showFooter;
  const { appConfig, isStandalone, isInstalled, triggerInstall } = useAppInstall(location.pathname);
  const canShowInstallButton = shouldShowManualInstallAction({
    isStandalone,
    isInstalled,
    isAdminRoute: location.pathname.startsWith('/admin'),
  });

  return (
    <SettingsSection
      id="navigasi"
      title="Navigasi"
    >
      {/* Khusus mobile: kontrol bottom navigasi tidak ditampilkan pada layar desktop */}
      <div className="md:hidden divide-y divide-[var(--border)] border-b border-[var(--border)]">
        <PreferenceSwitchRow
          id="pref-nav-bottom-bar"
          icon={PanelBottom}
          title="Navigasi bawah"
          description="Bilah menu cepat di bagian bawah layar."
          checked={navigation.showBottomNav}
          onChange={(checked) => setNavigationPreference('showBottomNav', checked)}
        />

        {navigation.showBottomNav && (
          <PreferenceSwitchRow
            id="pref-nav-bottom-labels"
            icon={Tag}
            title="Label navigasi bawah"
            description="Teks nama menu di bawah setiap ikon."
            checked={navigation.showBottomNavLabels}
            onChange={(checked) => setNavigationPreference('showBottomNavLabels', checked)}
          />
        )}
      </div>

      <div className="divide-y divide-[var(--border)]">
        <PreferenceSwitchRow
          id="pref-nav-footer"
          icon={LayoutPanelTop}
          title="Footer halaman"
          description="Info perusahaan dan kontak di bagian bawah."
          checked={activeShowFooter}
          onChange={(checked) =>
            setNavigationPreference(isMobile ? 'showFooterMobile' : 'showFooter', checked)
          }
        />

        <PreferenceSwitchRow
          id="pref-nav-auto-top"
          icon={ArrowUpToLine}
          title="Gulir otomatis ke atas"
          description="Mulai dari atas saat membuka halaman baru."
          checked={navigation.autoScrollToTop}
          onChange={(checked) => setNavigationPreference('autoScrollToTop', checked)}
        />

        <PreferenceSwitchRow
          id="pref-nav-scrollbar"
          icon={ScrollText}
          title="Indikator gulir"
          description="Garis penanda posisi gulir di tepi layar."
          checked={navigation.showFloatingScrollbar}
          onChange={(checked) => setNavigationPreference('showFloatingScrollbar', checked)}
        />

        {canShowInstallButton && (
          <PreferenceSwitchRow
            id="pref-nav-install-banner"
            icon={Download}
            title="Banner install aplikasi"
            description="Ajakan pasang aplikasi bila belum terpasang."
            checked={navigation.showInstallBanner}
            onChange={(checked) => setNavigationPreference('showInstallBanner', checked)}
          />
        )}

        {/* Khusus desktop: tombol install manual tersedia kapan saja di Pengaturan meski banner pernah ditutup */}
        {canShowInstallButton && (
          <div
            data-testid="settings-install-app-row"
            className="hidden md:flex items-center justify-between gap-4 py-3.5 min-h-[56px]"
          >
            <div className="flex items-start gap-3 min-w-0">
              <Download
                className="size-4 text-[var(--text-muted)] shrink-0 mt-1"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text)] leading-snug">
                  Install {appConfig.appName}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)] leading-relaxed">
                  Pasang pintasan ke perangkat untuk akses cepat halaman publik.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="settings-install-app-button"
              onClick={() => void triggerInstall()}
              className="gap-1.5 shrink-0"
            >
              <Download className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Install {appConfig.appName}</span>
            </Button>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
