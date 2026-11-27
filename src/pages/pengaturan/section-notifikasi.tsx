import { BookOpen, PackageCheck, Sparkles } from 'lucide-react';
import { usePublicPreferencesStore } from '../../store/public-preferences-store';
import { PreferenceSwitchRow, SettingsSection } from './components';

function resolveBrowserNotificationStatus(): string {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'Tidak didukung peramban';
  }
  if (window.Notification.permission === 'granted') {
    return 'Izin aktif';
  }
  if (window.Notification.permission === 'denied') {
    return 'Izin diblokir';
  }
  return 'Menunggu aktivasi';
}

interface SectionNotifikasiProps {
  hideSectionHeader?: boolean;
}

export function SectionNotifikasi({ hideSectionHeader = false }: SectionNotifikasiProps) {
  const notifications = usePublicPreferencesStore((state) => state.notifications);
  const setNotificationPreference = usePublicPreferencesStore(
    (state) => state.setNotificationPreference
  );

  const browserStatus = resolveBrowserNotificationStatus();

  return (
    <SettingsSection
      id="notifikasi"
      title="Notifikasi"
      badge="Segera Hadir"
      hideHeader={hideSectionHeader}
    >
      <div className="space-y-1">
        <div className="pb-3 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-[var(--text)]">Status Perangkat</span>
          <span className="text-[var(--text-muted)]">{browserStatus}</span>
        </div>

        <div className="divide-y divide-[var(--border)]">
          <PreferenceSwitchRow
            id="pref-notif-promo"
            icon={Sparkles}
            title="Katalog & promo baru"
            description="Info produk baru dan penawaran musiman."
            statusText="Terjadwal"
            checked={notifications.promoAndCatalog}
            onChange={(checked) => setNotificationPreference('promoAndCatalog', checked)}
          />

          <PreferenceSwitchRow
            id="pref-notif-order"
            icon={PackageCheck}
            title="Progres pesanan & survei"
            description="Pengingat survei dan status pengerjaan."
            statusText="Terjadwal"
            checked={notifications.orderAndSurveyReminder}
            onChange={(checked) => setNotificationPreference('orderAndSurveyReminder', checked)}
          />

          <PreferenceSwitchRow
            id="pref-notif-articles"
            icon={BookOpen}
            title="Berita & tips interior"
            description="Panduan material dan inspirasi ruang terbaru."
            statusText="Terjadwal"
            checked={notifications.articlesAndTips}
            onChange={(checked) => setNotificationPreference('articlesAndTips', checked)}
          />
        </div>
      </div>
    </SettingsSection>
  );
}
