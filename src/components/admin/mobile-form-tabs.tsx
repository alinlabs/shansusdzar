import { useCallback, useEffect, useRef, useState } from 'react';
import { List, PanelTop } from 'lucide-react';
import { AdminMobileSubHeader } from '../../pages/admin/admin-shell';
import { AdminActionButton } from './admin-action-buttons';
import {
  DEFAULT_MOBILE_FORM_VIEW_MODE,
  MOBILE_FORM_VIEW_MODE_STORAGE_KEY,
  getMobileFormToggleMeta,
  normalizeMobileFormViewMode,
  type MobileFormViewMode,
} from './mobile-form-tabs-logic';

export type {
  MobileFormTabErrorMatcher,
  MobileFormToggleMeta,
  MobileFormViewMode,
} from './mobile-form-tabs-logic';
export {
  DEFAULT_MOBILE_FORM_VIEW_MODE,
  MOBILE_FORM_VIEW_MODE_STORAGE_KEY,
  doesTabHaveErrors,
  getMobileFormToggleMeta,
  normalizeMobileFormViewMode,
  resolveFirstErrorTabId,
  resolveSafeActiveTabId,
} from './mobile-form-tabs-logic';

export interface MobileFormTabItem {
  id: string;
  label: string;
  hasError?: boolean;
}

function readStoredViewMode(): MobileFormViewMode {
  if (typeof window === 'undefined') return DEFAULT_MOBILE_FORM_VIEW_MODE;
  try {
    return normalizeMobileFormViewMode(
      window.sessionStorage.getItem(MOBILE_FORM_VIEW_MODE_STORAGE_KEY)
    );
  } catch {
    return DEFAULT_MOBILE_FORM_VIEW_MODE;
  }
}

function writeStoredViewMode(mode: MobileFormViewMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(MOBILE_FORM_VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage quota or sandbox restrictions
  }
}

export function useMobileFormViewMode() {
  const [mode, setModeState] = useState<MobileFormViewMode>(() => readStoredViewMode());

  const setMode = useCallback((nextMode: MobileFormViewMode) => {
    setModeState(nextMode);
    writeStoredViewMode(nextMode);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next: MobileFormViewMode = prev === 'tab' ? 'list' : 'tab';
      writeStoredViewMode(next);
      return next;
    });
  }, []);

  return { mode, setMode, toggleMode };
}

export function AdminMobileViewModeToggle({
  mode,
  onToggle,
}: {
  mode: MobileFormViewMode;
  onToggle: () => void;
}) {
  const meta = getMobileFormToggleMeta(mode);
  return (
    <span className="md:hidden inline-flex">
      <AdminActionButton
        variant="default"
        size="sm"
        iconOnly
        icon={
          mode === 'tab' ? (
            <List className="size-4" aria-hidden="true" />
          ) : (
            <PanelTop className="size-4" aria-hidden="true" />
          )
        }
        label={meta.title}
        aria-label={meta.ariaLabel}
        title={meta.title}
        onClick={onToggle}
        data-testid="admin-mobile-view-mode-toggle"
        data-current-mode={mode}
      />
    </span>
  );
}

export function AdminMobileTabBar({
  tabs,
  activeTabId,
  onSelectTab,
  tabIdPrefix = 'admin-form-tab',
  panelIdPrefix = 'admin-form-panel',
}: {
  tabs: readonly MobileFormTabItem[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  tabIdPrefix?: string;
  panelIdPrefix?: string;
}) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const activeButton = tabRefs.current[activeTabId];
    if (activeButton && typeof activeButton.scrollIntoView === 'function') {
      activeButton.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [activeTabId]);

  if (tabs.length <= 1) return null;

  return (
    <AdminMobileSubHeader>
      <div
        role="tablist"
        aria-label="Bagian formulir"
        data-testid="admin-mobile-tablist"
        className="w-full flex items-stretch overflow-x-auto app-scroll-region"
      >
        {tabs.map((tab, index) => {
          const isActive = activeTabId === tab.id;
          const tabDomId = `${tabIdPrefix}-${tab.id}`;
          const panelDomId = `${panelIdPrefix}-${tab.id}`;

          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              id={tabDomId}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelDomId}
              data-testid={`admin-mobile-tab-${tab.id}`}
              data-has-error={tab.hasError ? 'true' : undefined}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelectTab(tab.id)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  const next = tabs[(index + 1) % tabs.length];
                  onSelectTab(next.id);
                  tabRefs.current[next.id]?.focus();
                } else if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  const prev = tabs[(index - 1 + tabs.length) % tabs.length];
                  onSelectTab(prev.id);
                  tabRefs.current[prev.id]?.focus();
                } else if (event.key === 'Home') {
                  event.preventDefault();
                  const first = tabs[0];
                  onSelectTab(first.id);
                  tabRefs.current[first.id]?.focus();
                } else if (event.key === 'End') {
                  event.preventDefault();
                  const last = tabs[tabs.length - 1];
                  onSelectTab(last.id);
                  tabRefs.current[last.id]?.focus();
                }
              }}
              className={[
                'relative flex-1 shrink-0 min-w-max px-3.5 inline-flex items-center justify-center gap-1.5 min-h-11 py-2.5 text-xs whitespace-nowrap transition-colors duration-150 cursor-pointer border-b-2 focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-[-2px]',
                isActive
                  ? 'border-[var(--text)] text-[var(--text)] font-semibold'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)] font-medium',
              ].join(' ')}
            >
              <span>{tab.label}</span>
              {tab.hasError && (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-[var(--danger)] shrink-0"
                />
              )}
            </button>
          );
        })}
      </div>
    </AdminMobileSubHeader>
  );
}
