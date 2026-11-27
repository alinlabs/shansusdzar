import { Check, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeMode } from '../../components/layout/theme-provider';
import { SettingsSection } from './components';

interface ThemeChoice {
  id: ThemeMode;
  label: string;
  icon: typeof Sun;
  previewBg: string;
  previewSurface: string;
  previewBorder: string;
  previewText: string;
}

const THEME_CHOICES: ThemeChoice[] = [
  {
    id: 'light',
    label: 'Mode Terang',
    icon: Sun,
    previewBg: '#fafafa',
    previewSurface: '#ffffff',
    previewBorder: '#e4e4e7',
    previewText: '#18181b',
  },
  {
    id: 'dark',
    label: 'Mode Gelap',
    icon: Moon,
    previewBg: '#171716',
    previewSurface: '#21201e',
    previewBorder: '#363430',
    previewText: '#f2f0ec',
  },
];

export function SectionTema() {
  const { theme, setTheme } = useTheme();

  return (
    <SettingsSection
      id="tema"
      title="Tema"
    >
      <div
        role="radiogroup"
        aria-label="Pilih tema tampilan"
        className="grid grid-cols-2 gap-3.5 sm:gap-5"
      >
        {THEME_CHOICES.map((option) => {
          const Icon = option.icon;
          const isSelected = theme === option.id;

          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setTheme(option.id)}
              className="group text-left cursor-pointer space-y-2.5 rounded-[var(--radius-md)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-4"
            >
              {/* Mini pratinjau palet tema */}
              <div
                aria-hidden="true"
                style={{
                  backgroundColor: option.previewBg,
                  borderColor: option.previewBorder,
                }}
                className={[
                  'h-20 sm:h-24 rounded-[var(--radius-md)] border p-2.5 flex flex-col justify-between transition-all duration-150',
                  isSelected ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]' : 'opacity-85 group-hover:opacity-100',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    style={{
                      backgroundColor: option.previewSurface,
                      borderColor: option.previewBorder,
                    }}
                    className="h-3 w-14 sm:w-16 rounded-[var(--radius-sm)] border"
                  />
                  <span
                    style={{ backgroundColor: option.previewText }}
                    className="size-2.5 rounded-full opacity-75"
                  />
                </div>
                <div
                  style={{
                    backgroundColor: option.previewSurface,
                    borderColor: option.previewBorder,
                  }}
                  className="h-8 rounded-[var(--radius-sm)] border px-2 flex items-center gap-1.5"
                >
                  <span
                    style={{ backgroundColor: option.previewText }}
                    className="h-1.5 w-10 rounded-full opacity-80"
                  />
                  <span
                    style={{ backgroundColor: option.previewText }}
                    className="h-1.5 w-6 rounded-full opacity-35"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon
                    className="size-4 shrink-0 text-[var(--text)]"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-semibold text-[var(--text)] leading-tight truncate">
                    {option.label}
                  </p>
                </div>

                <span
                  aria-hidden="true"
                  className={[
                    'inline-flex items-center justify-center size-5 rounded-full border shrink-0 transition-colors',
                    isSelected
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-transparent'
                      : 'border-[var(--border-strong)] bg-transparent',
                  ].join(' ')}
                >
                  {isSelected && <Check className="size-3" />}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </SettingsSection>
  );
}
