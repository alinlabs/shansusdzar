import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface AdaptiveHeaderSearchConfig {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  onActiveChange?: (isActive: boolean) => void;
  hasActiveFilter?: boolean;
  onResetAll?: () => void;
  filterAriaLabel?: string;
  filterTitle?: string;
  renderFilterContent?: (closeFilter: () => void) => ReactNode;
}

export interface AdaptiveHeaderSearchRedirectConfig {
  listRoute: string;
  ariaLabel?: string;
}

export interface AdaptiveHeaderConfig {
  hideDesktopNav?: boolean;
  hideDesktopAccountIcons?: boolean;
  hideSearchIcon?: boolean;
  hideCartIcon?: boolean;
  desktopSidebarSplit?: boolean;
  backTo?: string;
  backAriaLabel?: string;
  mobileEyebrow?: string;
  mobileTitle?: string;
  search?: AdaptiveHeaderSearchConfig;
  searchRedirect?: AdaptiveHeaderSearchRedirectConfig;
}

export interface AdaptiveBottomProductActionConfig {
  type: 'product-detail';
  estimateLabel?: string;
  priceLabel: string;
  compareAtPriceLabel?: string | null;
  promoPercentLabel?: string | null;
  quantity: number;
  onDecreaseQuantity: () => void;
  onIncreaseQuantity: () => void;
  canDecreaseQuantity?: boolean;
  canIncreaseQuantity?: boolean;
  consultationHref: string;
  consultationLabel?: string;
  onConsultationAction?: () => void;
  primaryLabel?: string;
  onPrimaryAction: () => void;
  dropUpEyebrow?: string;
  dropUpTitle?: string;
  dropUpSubtitle?: string;
  renderDropUp?: () => ReactNode;
}

export interface AdaptiveBottomCustomActionConfig {
  type: 'custom';
  render: () => ReactNode;
}

export type AdaptiveBottomConfig =
  | AdaptiveBottomProductActionConfig
  | AdaptiveBottomCustomActionConfig;

export interface AdaptiveNavConfig {
  header?: AdaptiveHeaderConfig | null;
  bottom?: AdaptiveBottomConfig | null;
  desktopRightSidebar?: ReactNode | null;
}

interface AdaptiveNavContextValue {
  adaptiveNav: AdaptiveNavConfig | null;
  setAdaptiveNav: (next: AdaptiveNavConfig | null) => void;
}

const AdaptiveNavContext = createContext<AdaptiveNavContextValue | null>(null);

export function AdaptiveNavProvider({ children }: { children: ReactNode }) {
  const [adaptiveNav, setAdaptiveNav] = useState<AdaptiveNavConfig | null>(null);

  return (
    <AdaptiveNavContext.Provider value={{ adaptiveNav, setAdaptiveNav }}>
      {children}
    </AdaptiveNavContext.Provider>
  );
}

export function useAdaptiveNav() {
  const ctx = useContext(AdaptiveNavContext);
  if (!ctx) {
    throw new Error('useAdaptiveNav must be used inside AdaptiveNavProvider');
  }
  return ctx;
}

/**
 * Mendaftarkan konfigurasi adaptif untuk header dan/atau bottom navigation seluler
 * selama halaman aktif, lalu membersihkannya otomatis saat berpindah rute.
 */
export function useAdaptiveNavConfig(config: AdaptiveNavConfig | null) {
  const { setAdaptiveNav } = useAdaptiveNav();

  useEffect(() => {
    setAdaptiveNav(config);
  }, [config, setAdaptiveNav]);

  useEffect(() => {
    return () => {
      setAdaptiveNav(null);
    };
  }, [setAdaptiveNav]);
}
