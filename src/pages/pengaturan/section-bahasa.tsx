import { Check } from 'lucide-react';
import {
  usePublicPreferencesStore,
  type PreferredLanguage,
} from '../../store/public-preferences-store';
import { SettingsSection } from './components';

interface LanguageChoice {
  code: PreferredLanguage;
  name: string;
  nativeName: string;
  description: string;
  available: boolean;
}

const LANGUAGE_CHOICES: LanguageChoice[] = [
  {
    code: 'id',
    name: 'Bahasa Indonesia',
    nativeName: 'Default',
    description: 'Tersedia penuh di seluruh halaman.',
    available: true,
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'Inggris',
    description: 'Terjemahan antarmuka sedang disiapkan.',
    available: false,
  },
];

export function SectionBahasa() {
  const preferredLanguage = usePublicPreferencesStore((state) => state.preferredLanguage);
  const setPreferredLanguage = usePublicPreferencesStore((state) => state.setPreferredLanguage);

  return (
    <SettingsSection
      id="bahasa"
      title="Bahasa"
      badge="Multi-Bahasa"
    >
      <div className="space-y-3">
        <div
          role="radiogroup"
          aria-label="Pilih bahasa tampilan"
          className="divide-y divide-[var(--border)] border-y border-[var(--border)]"
        >
          {LANGUAGE_CHOICES.map((lang) => {
            const isSelected = preferredLanguage === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={!lang.available}
                onClick={() => {
                  if (lang.available) {
                    setPreferredLanguage(lang.code);
                  }
                }}
                className={[
                  'w-full text-left py-3.5 transition-colors duration-150 flex items-start justify-between gap-4',
                  lang.available
                    ? 'cursor-pointer hover:bg-[var(--surface-muted)]/35'
                    : 'opacity-65 cursor-not-allowed',
                ].join(' ')}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm font-semibold text-[var(--text)]">{lang.name}</p>
                    <span className="text-xs text-[var(--text-muted)]">
                      · {lang.nativeName}
                      {!lang.available ? ' · Segera hadir' : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
                    {lang.description}
                  </p>
                </div>

                <span
                  aria-hidden="true"
                  className={[
                    'inline-flex items-center justify-center size-5 rounded-full border shrink-0 mt-0.5',
                    isSelected
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-transparent'
                      : 'border-[var(--border-strong)] bg-transparent',
                  ].join(' ')}
                >
                  {isSelected && <Check className="size-3" />}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Saat ini antarmuka aktif menggunakan Bahasa Indonesia.
        </p>
      </div>
    </SettingsSection>
  );
}
