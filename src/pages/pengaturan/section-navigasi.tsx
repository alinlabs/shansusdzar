import {
  ArrowUpToLine,
  Compass,
  Download,
  LayoutPanelTop,
  PanelBottom,
  ScrollText,
  Tag,
} from 'lucide-react';
import { useIsMobileViewport } from '../../hooks/use-mobile-viewport';
import { usePublicPreferencesStore } from '../../store/public-preferences-store';
import { PreferenceSwitchRow, SettingsSection } from './components';

export function SectionNavigasi() {
  const navigation = usePublicPreferencesStore((state) => state.navigation);
  const setNavigationPreference = usePublicPreferencesStore(
    (state) => state.setNavigationPreference
  );
  const isMobile = useIsMobileViewport();
  const activeShowFooter = isMobile ? navigation.showFooterMobile : navigation.showFooter;

  return (
    <SettingsSection
      id="navigasi"
      icon={Compass}
      title="Pengaturan Navigasi"
      description="Atur tampilan navigasi, footer, perilaku perpindahan halaman, indikator gulir, dan pengingat pintasan aplikasi."
    >
      {/* Khusus mobile: kontrol bottom navigasi tidak ditampilkan pada layar desktop */}
      <div className="md:hidden divide-y divide-[var(--border)] border-b border-[var(--border)]">
        <PreferenceSwitchRow
          id="pref-nav-bottom-bar"
          icon={PanelBottom}
          title="Tampilkan navigasi bawah"
          description="Menampilkan bilah menu cepat di bagian bawah layar saat mengakses lewat seluler."
          checked={navigation.showBottomNav}
          onChange={(checked) => setNavigationPreference('showBottomNav', checked)}
        />

        {navigation.showBottomNav && (
          <PreferenceSwitchRow
            id="pref-nav-bottom-labels"
            icon={Tag}
            title="Tampilkan label teks pada navigasi bawah"
            description="Menampilkan nama menu di bawah setiap ikon pada bilah navigasi bawah."
            checked={navigation.showBottomNavLabels}
            onChange={(checked) => setNavigationPreference('showBottomNavLabels', checked)}
          />
        )}
      </div>

      <div className="divide-y divide-[var(--border)]">
        <PreferenceSwitchRow
          id="pref-nav-footer"
          icon={LayoutPanelTop}
          title="Tampilkan footer halaman"
          description="Menampilkan bagian informasi perusahaan, tautan legal, dan kontak di bagian paling bawah setiap halaman."
          checked={activeShowFooter}
          onChange={(checked) =>
            setNavigationPreference(isMobile ? 'showFooterMobile' : 'showFooter', checked)
          }
        />

        <PreferenceSwitchRow
          id="pref-nav-auto-top"
          icon={ArrowUpToLine}
          title="Gulir otomatis ke atas saat pindah halaman"
          description="Mengembalikan posisi layar ke bagian paling atas setiap kali Anda membuka halaman baru."
          checked={navigation.autoScrollToTop}
          onChange={(checked) => setNavigationPreference('autoScrollToTop', checked)}
        />

        <PreferenceSwitchRow
          id="pref-nav-scrollbar"
          icon={ScrollText}
          title="Tampilkan indikator gulir tipis"
          description="Menampilkan garis penanda posisi gulir di tepi layar saat halaman sedang digulir atau diarahkan."
          checked={navigation.showFloatingScrollbar}
          onChange={(checked) => setNavigationPreference('showFloatingScrollbar', checked)}
        />

        <PreferenceSwitchRow
          id="pref-nav-install-banner"
          icon={Download}
          title="Izinkan banner ajakan install aplikasi"
          description="Menampilkan bilah singkat pemasangan aplikasi bila perangkat belum memasang pintasan web."
          checked={navigation.showInstallBanner}
          onChange={(checked) => setNavigationPreference('showInstallBanner', checked)}
        />
      </div>
    </SettingsSection>
  );
}
