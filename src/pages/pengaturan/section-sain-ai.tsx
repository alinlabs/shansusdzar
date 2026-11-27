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
      title="Sain Ai"
    >
      <div className="divide-y divide-[var(--border)]">
        <PreferenceSwitchRow
          id="pref-sain-ai-floating"
          icon={MessagesSquare}
          title="Tombol melayang Sain Ai"
          description="Tampilkan chat di sudut layar. Tetap ada di menu jika nonaktif."
          statusText={isFloatingBubbleEnabled ? 'Aktif' : 'Nonaktif'}
          checked={isFloatingBubbleEnabled}
          onChange={setFloatingBubbleEnabled}
        />
      </div>
    </SettingsSection>
  );
}
