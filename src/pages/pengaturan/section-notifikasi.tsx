import { Bell, BookOpen, PackageCheck, Sparkles } from 'lucide-react';
import { usePublicPreferencesStore } from '../../store/public-preferences-store';
import { PreferenceSwitchRow, SettingsSection } from './components';

function resolveBrowserNotificationStatus(): string {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'Peramban tidak mendukung notifikasi web';
  }
  if (window.Notification.permission === 'granted') {
    return 'Izin notifikasi peramban aktif';
  }
  if (window.Notification.permission === 'denied') {
    return 'Izin notifikasi peramban diblokir';
  }
  return 'Menunggu aktivasi layanan notifikasi';
}

export function SectionNotifikasi() {
  const notifications = usePublicPreferencesStore((state) => state.notifications);
  const setNotificationPreference = usePublicPreferencesStore(
    (state) => state.setNotificationPreference
  );

  const browserStatus = resolveBrowserNotificationStatus();

  return (
    <SettingsSection
      id="notifikasi"
      icon={Bell}
      title="Pengaturan Notifikasi"
      badge="Segera Hadir"
      description="Simpan preferensi kanal pemberitahuan Anda terlebih dahulu. Pengiriman notifikasi otomatis akan aktif saat layanan pemberitahuan diluncurkan."
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
            title="Katalog terbaru & penawaran studio"
            description="Pemberitahuan saat ada produk furniture baru, koleksi edisi khusus, atau penawaran musiman."
            statusText="Terjadwal rilis"
            checked={notifications.promoAndCatalog}
            onChange={(checked) => setNotificationPreference('promoAndCatalog', checked)}
          />

          <PreferenceSwitchRow
            id="pref-notif-order"
            icon={PackageCheck}
            title="Progres pesanan & jadwal survei"
            description="Pengingat jadwal kunjungan survei lapangan dan pembaruan status pengerjaan proyek."
            statusText="Terjadwal rilis"
            checked={notifications.orderAndSurveyReminder}
            onChange={(checked) => setNotificationPreference('orderAndSurveyReminder', checked)}
          />

          <PreferenceSwitchRow
            id="pref-notif-articles"
            icon={BookOpen}
            title="Artikel berita & tips interior"
            description="Ringkasan publikasi panduan material, perawatan kabinet, dan inspirasi tata ruang terbaru."
            statusText="Terjadwal rilis"
            checked={notifications.articlesAndTips}
            onChange={(checked) => setNotificationPreference('articlesAndTips', checked)}
          />
        </div>
      </div>
    </SettingsSection>
  );
}
