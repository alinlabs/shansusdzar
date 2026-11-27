export type MobileFormViewMode = 'tab' | 'list';

export const DEFAULT_MOBILE_FORM_VIEW_MODE: MobileFormViewMode = 'tab';
export const MOBILE_FORM_VIEW_MODE_STORAGE_KEY = 'admin_form_mobile_view_mode';

export interface MobileFormToggleMeta {
  currentMode: MobileFormViewMode;
  nextMode: MobileFormViewMode;
  iconName: 'list' | 'panel-top';
  ariaLabel: string;
  title: string;
}

export interface MobileFormTabErrorMatcher<TValues = unknown> {
  id: string;
  fields?: readonly string[];
  errorFields?: readonly string[];
  errorPrefixes?: readonly string[];
  hasSectionError?: (errors: Partial<Record<string, string>>, values: TValues) => boolean;
}

export function normalizeMobileFormViewMode(raw: string | null | undefined): MobileFormViewMode {
  return raw === 'list' ? 'list' : DEFAULT_MOBILE_FORM_VIEW_MODE;
}

export function getMobileFormToggleMeta(mode: MobileFormViewMode): MobileFormToggleMeta {
  if (mode === 'tab') {
    return {
      currentMode: 'tab',
      nextMode: 'list',
      iconName: 'list',
      ariaLabel: 'Tampilan list ke bawah',
      title: 'Ubah ke tampilan list',
    };
  }
  return {
    currentMode: 'list',
    nextMode: 'tab',
    iconName: 'panel-top',
    ariaLabel: 'Tampilan tab per bagian',
    title: 'Ubah ke tampilan tab',
  };
}

export function doesTabHaveErrors<TValues>(
  matcher: MobileFormTabErrorMatcher<TValues>,
  errors: Partial<Record<string, string>>,
  values: TValues
): boolean {
  const activeKeys = Object.keys(errors).filter((key) => {
    const msg = errors[key];
    return typeof msg === 'string' && msg.trim().length > 0;
  });

  if (matcher.hasSectionError?.(errors, values)) {
    return true;
  }

  if (activeKeys.length === 0) {
    return false;
  }

  for (const key of activeKeys) {
    if (matcher.fields?.includes(key)) {
      return true;
    }
    if (matcher.errorFields?.includes(key)) {
      return true;
    }
    if (matcher.errorPrefixes?.some((prefix) => key === prefix || key.startsWith(prefix))) {
      return true;
    }
  }

  return false;
}

export function resolveFirstErrorTabId<TValues>(
  tabs: readonly MobileFormTabErrorMatcher<TValues>[],
  activeTabId: string,
  errors: Partial<Record<string, string>>,
  values: TValues
): string | null {
  const activeMatcher = tabs.find((tab) => tab.id === activeTabId);
  if (activeMatcher && doesTabHaveErrors(activeMatcher, errors, values)) {
    return activeTabId;
  }

  for (const tab of tabs) {
    if (doesTabHaveErrors(tab, errors, values)) {
      return tab.id;
    }
  }

  return null;
}

export function resolveSafeActiveTabId(
  tabs: readonly { id: string }[],
  candidateId: string
): string {
  if (tabs.length === 0) return '';
  if (tabs.some((tab) => tab.id === candidateId)) return candidateId;
  return tabs[0].id;
}
