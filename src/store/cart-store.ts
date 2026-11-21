import { create } from 'zustand';
import { getCustomServiceModeLabel } from '../lib/custom-pricing';
import { useAnalyticsStore } from './analytics-store';
import type {
  CartItem,
  CartSummary,
  CustomCartItem,
  CustomServiceMode,
  PersistedCartPayload,
  ProductCartItem,
} from '../types/cart';

export const CART_STORAGE_KEY = 'shansusdzar-cart-v1';
export const CART_SCHEMA_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePositiveQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.min(99, Math.floor(quantity)));
}

export function buildProductLineKey(item: Pick<ProductCartItem, 'productId' | 'selectedColorName' | 'selectedOptions'>): string {
  const optionPairs = Object.entries(item.selectedOptions)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('|');
  return `product::${item.productId}::${item.selectedColorName ?? ''}::${optionPairs}`;
}

export function sanitizeCartItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const valid: CartItem[] = [];

  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const kind = entry.kind;
    const lineId = typeof entry.lineId === 'string' && entry.lineId.trim() ? entry.lineId.trim() : null;
    const quantity =
      typeof entry.quantity === 'number' ? normalizePositiveQuantity(entry.quantity) : 1;

    if (!lineId) continue;

    if (kind === 'product') {
      if (
        typeof entry.productId === 'string' &&
        typeof entry.name === 'string' &&
        typeof entry.slug === 'string' &&
        typeof entry.category === 'string'
      ) {
        const unitPrice =
          typeof entry.unitPrice === 'number' && Number.isFinite(entry.unitPrice) && entry.unitPrice > 0
            ? entry.unitPrice
            : null;
        const normalizedRawStatus =
          entry.priceStatus === 'tetap' || entry.priceStatus === 'fixed'
            ? 'tetap'
            : entry.priceStatus === 'mulai' || entry.priceStatus === 'from'
              ? 'mulai'
              : 'konsultasi';
        const priceStatus =
          normalizedRawStatus === 'tetap' || normalizedRawStatus === 'mulai'
            ? unitPrice !== null
              ? normalizedRawStatus
              : 'konsultasi'
            : 'konsultasi';

        const selectedOptions: Record<string, string> = {};
        if (isRecord(entry.selectedOptions)) {
          for (const [k, v] of Object.entries(entry.selectedOptions)) {
            if (typeof v === 'string' && v.trim()) {
              selectedOptions[k] = v.trim();
            }
          }
        }

        valid.push({
          kind: 'product',
          lineId,
          productId: entry.productId,
          slug: entry.slug,
          name: entry.name,
          category: entry.category,
          image: typeof entry.image === 'string' && entry.image.trim() ? entry.image : null,
          selectedColorName:
            typeof entry.selectedColorName === 'string' ? entry.selectedColorName : null,
          selectedColorHex:
            typeof entry.selectedColorHex === 'string' ? entry.selectedColorHex : null,
          selectedOptions,
          quantity,
          unitPrice,
          priceStatus,
        });
      }
    } else if (kind === 'custom') {
      if (
        typeof entry.projectTypeLabel === 'string' &&
        typeof entry.itemTypeLabel === 'string' &&
        typeof entry.materialLabel === 'string' &&
        typeof entry.colorName === 'string' &&
        isRecord(entry.dimensions) &&
        typeof entry.dimensions.length === 'number' &&
        typeof entry.dimensions.width === 'number'
      ) {
        const estimatedUnitTotal =
          typeof entry.estimatedUnitTotal === 'number' &&
          Number.isFinite(entry.estimatedUnitTotal) &&
          entry.estimatedUnitTotal > 0
            ? entry.estimatedUnitTotal
            : null;

        const estimatedDpAmount =
          typeof entry.estimatedDpAmount === 'number' &&
          Number.isFinite(entry.estimatedDpAmount) &&
          entry.estimatedDpAmount > 0
            ? entry.estimatedDpAmount
            : null;

        const rawServiceMode = entry.serviceMode;
        const serviceMode: CustomServiceMode =
          rawServiceMode === 'design-only' ||
          rawServiceMode === 'build-only' ||
          rawServiceMode === 'design-and-build'
            ? rawServiceMode
            : 'build-only';
        const serviceModeLabel =
          typeof entry.serviceModeLabel === 'string' && entry.serviceModeLabel.trim()
            ? entry.serviceModeLabel.trim()
            : getCustomServiceModeLabel(serviceMode);
        const designAmount =
          typeof entry.designAmount === 'number' &&
          Number.isFinite(entry.designAmount) &&
          entry.designAmount > 0
            ? entry.designAmount
            : null;
        const buildAmount =
          typeof entry.buildAmount === 'number' &&
          Number.isFinite(entry.buildAmount) &&
          entry.buildAmount > 0
            ? entry.buildAmount
            : null;

        valid.push({
          kind: 'custom',
          lineId,
          serviceMode,
          serviceModeLabel,
          projectTypeId: typeof entry.projectTypeId === 'string' ? entry.projectTypeId : 'custom',
          projectTypeLabel: entry.projectTypeLabel,
          itemTypeId: typeof entry.itemTypeId === 'string' ? entry.itemTypeId : 'custom-item',
          itemTypeLabel: entry.itemTypeLabel,
          dimensions: {
            length: entry.dimensions.length,
            width: entry.dimensions.width,
            height:
              typeof entry.dimensions.height === 'number' ? entry.dimensions.height : null,
            unit: entry.dimensions.unit === 'm' ? 'm' : 'cm',
            normalizedLengthCm:
              typeof entry.dimensions.normalizedLengthCm === 'number'
                ? entry.dimensions.normalizedLengthCm
                : entry.dimensions.length,
            normalizedWidthCm:
              typeof entry.dimensions.normalizedWidthCm === 'number'
                ? entry.dimensions.normalizedWidthCm
                : entry.dimensions.width,
            normalizedHeightCm:
              typeof entry.dimensions.normalizedHeightCm === 'number'
                ? entry.dimensions.normalizedHeightCm
                : null,
          },
          materialId: typeof entry.materialId === 'string' ? entry.materialId : '',
          materialLabel: entry.materialLabel,
          ...(typeof entry.finishId === 'string' && entry.finishId.trim()
            ? { finishId: entry.finishId.trim() }
            : {}),
          finishLabel: typeof entry.finishLabel === 'string' ? entry.finishLabel : '',
          colorId: typeof entry.colorId === 'string' ? entry.colorId : '',
          colorName: entry.colorName,
          colorHex: typeof entry.colorHex === 'string' ? entry.colorHex : '#999697',
          additionalOptions: Array.isArray(entry.additionalOptions)
            ? entry.additionalOptions.filter((v): v is string => typeof v === 'string')
            : [],
          notes: typeof entry.notes === 'string' ? entry.notes : '',
          quantity,
          designAmount,
          buildAmount,
          estimatedUnitTotal,
          estimatedDpAmount,
          estimateStatus:
            entry.estimateStatus === 'configured' && estimatedUnitTotal !== null
              ? 'configured'
              : 'contact',
        });
      }
    }
  }

  return valid;
}

export function loadPersistedCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== CART_SCHEMA_VERSION) {
      return [];
    }
    return sanitizeCartItems(parsed.items);
  } catch {
    return [];
  }
}

export function savePersistedCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedCartPayload = {
      schemaVersion: CART_SCHEMA_VERSION,
      items,
    };
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private mode failures
  }
}

export function upsertProductCartItem(
  items: CartItem[],
  incoming: Omit<ProductCartItem, 'kind' | 'lineId'>
): CartItem[] {
  const lineId = buildProductLineKey(incoming);
  const qty = normalizePositiveQuantity(incoming.quantity);
  const existingIndex = items.findIndex((item) => item.lineId === lineId);

  if (existingIndex >= 0) {
    return items.map((item, idx) =>
      idx === existingIndex
        ? { ...item, quantity: normalizePositiveQuantity(item.quantity + qty) }
        : item
    );
  }

  const nextItem: ProductCartItem = {
    ...incoming,
    kind: 'product',
    lineId,
    quantity: qty,
  };
  return [...items, nextItem];
}

export function upsertCustomCartItem(
  items: CartItem[],
  incoming: Omit<CustomCartItem, 'kind'>
): CartItem[] {
  const qty = normalizePositiveQuantity(incoming.quantity);
  const nextItem: CustomCartItem = {
    ...incoming,
    kind: 'custom',
    quantity: qty,
  };

  const existingIndex = items.findIndex((item) => item.lineId === incoming.lineId);
  if (existingIndex >= 0) {
    return items.map((item, idx) => (idx === existingIndex ? nextItem : item));
  }
  return [...items, nextItem];
}

export function setCartItemQuantity(
  items: CartItem[],
  lineId: string,
  nextQuantity: number
): CartItem[] {
  if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
    return items.filter((item) => item.lineId !== lineId);
  }
  const normalized = normalizePositiveQuantity(nextQuantity);
  return items.map((item) => (item.lineId === lineId ? { ...item, quantity: normalized } : item));
}

export function removeCartItem(items: CartItem[], lineId: string): CartItem[] {
  return items.filter((item) => item.lineId !== lineId);
}

export function calculateCartSummary(items: CartItem[]): CartSummary {
  let totalQuantity = 0;
  let subtotal = 0;
  let pricedCount = 0;
  let hasUnpricedItems = false;
  let dpTotal = 0;
  let hasDp = false;

  for (const item of items) {
    totalQuantity += item.quantity;
    if (item.kind === 'product') {
      if (item.unitPrice !== null && item.unitPrice > 0) {
        subtotal += item.unitPrice * item.quantity;
        pricedCount += 1;
      } else {
        hasUnpricedItems = true;
      }
    } else {
      if (item.estimatedUnitTotal !== null && item.estimatedUnitTotal > 0) {
        subtotal += item.estimatedUnitTotal * item.quantity;
        pricedCount += 1;
        if (item.estimatedDpAmount !== null && item.estimatedDpAmount > 0) {
          dpTotal += item.estimatedDpAmount * item.quantity;
          hasDp = true;
        }
      } else {
        hasUnpricedItems = true;
      }
    }
  }

  return {
    lineCount: items.length,
    totalQuantity,
    pricedSubtotal: pricedCount > 0 ? subtotal : null,
    hasUnpricedItems,
    estimatedDpTotal: hasDp ? dpTotal : null,
  };
}

interface CartStoreState {
  items: CartItem[];
  isDrawerOpen: boolean;
  editingCustomLineId: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  addProductItem: (item: Omit<ProductCartItem, 'kind' | 'lineId'>) => void;
  saveCustomItem: (item: Omit<CustomCartItem, 'kind'>) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
  setEditingCustomLineId: (lineId: string | null) => void;
}

export const useCartStore = create<CartStoreState>((set) => ({
  items: loadPersistedCart(),
  isDrawerOpen: false,
  editingCustomLineId: null,
  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
  addProductItem: (incoming) => {
    useAnalyticsStore.getState().recordCatalogAction();
    set((state) => {
      const next = upsertProductCartItem(state.items, incoming);
      savePersistedCart(next);
      return { items: next };
    });
  },
  saveCustomItem: (incoming) => {
    useAnalyticsStore.getState().recordCustomConfiguration();
    set((state) => {
      const next = upsertCustomCartItem(state.items, incoming);
      savePersistedCart(next);
      return { items: next, editingCustomLineId: null };
    });
  },
  updateQuantity: (lineId, quantity) =>
    set((state) => {
      const next = setCartItemQuantity(state.items, lineId, quantity);
      savePersistedCart(next);
      return { items: next };
    }),
  removeItem: (lineId) =>
    set((state) => {
      const next = removeCartItem(state.items, lineId);
      savePersistedCart(next);
      return { items: next };
    }),
  clearCart: () =>
    set(() => {
      savePersistedCart([]);
      return { items: [], editingCustomLineId: null };
    }),
  setEditingCustomLineId: (lineId) => set({ editingCustomLineId: lineId }),
}));
