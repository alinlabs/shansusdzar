import { MessagesSquare } from 'lucide-react';
import { useSainAiStore } from '../../sain-ai';
import { PreferenceSwitchRow, SettingsSection } from './components';

export function SectionSainAi() {
  const isFloatingBubbleEnabled = useSainAiStore(
    (state) => state.isFloatingBubbleEnabled
  );
  const setFloatingBubbleEnabled = useSainAiStore(
    (state) => state.setFloatingBubbleEnabled
  );

  return (
    <SettingsSection
      id="sain-ai"
      icon={MessagesSquare}
      title="Sain Ai (Sahabat Interior)"
      description="Atur visibilitas tombol melayang Sain Ai — Sahabat Interior untuk estimasi, material, dan informasi studio di layar Anda."
    >
      <div className="divide-y divide-[var(--border)]">
        <PreferenceSwitchRow
          id="pref-sain-ai-floating"
          icon={MessagesSquare}
          title="Tampilkan tombol melayang Sain Ai"
          description="Tombol melayang tetap tampil di sudut layar pada desktop maupun seluler. Bila dinonaktifkan, Sain Ai tetap tersedia melalui menu Sidebar dan Informasi."
          statusText={isFloatingBubbleEnabled ? 'Aktif' : 'Nonaktif'}
          checked={isFloatingBubbleEnabled}
          onChange={setFloatingBubbleEnabled}
        />
      </div>
    </SettingsSection>
  );
}
