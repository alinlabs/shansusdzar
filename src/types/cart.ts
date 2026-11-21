import type { PriceStatus } from './product';

export type DimensionUnit = 'cm' | 'm';

export interface RoomDimensionsInput {
  length: number;
  width: number;
  height: number | null;
  unit: DimensionUnit;
  normalizedLengthCm: number;
  normalizedWidthCm: number;
  normalizedHeightCm: number | null;
}

export interface ProductCartItem {
  kind: 'product';
  lineId: string;
  productId: string;
  slug: string;
  name: string;
  category: string;
  image: string | null;
  selectedColorName: string | null;
  selectedColorHex: string | null;
  selectedOptions: Record<string, string>;
  quantity: number;
  unitPrice: number | null;
  priceStatus: PriceStatus;
}

export type CustomServiceMode = 'design-only' | 'build-only' | 'design-and-build';

export interface CustomCartItem {
  kind: 'custom';
  lineId: string;
  serviceMode?: CustomServiceMode;
  serviceModeLabel?: string;
  projectTypeId: string;
  projectTypeLabel: string;
  itemTypeId: string;
  itemTypeLabel: string;
  dimensions: RoomDimensionsInput;
  materialId: string;
  materialLabel: string;
  finishId?: string;
  finishLabel: string;
  colorId: string;
  colorName: string;
  colorHex: string;
  additionalOptions: string[];
  notes: string;
  quantity: number;
  designAmount?: number | null;
  buildAmount?: number | null;
  estimatedUnitTotal: number | null;
  estimatedDpAmount: number | null;
  estimateStatus: 'configured' | 'contact';
}

export type CartItem = ProductCartItem | CustomCartItem;

export interface CartSummary {
  lineCount: number;
  totalQuantity: number;
  pricedSubtotal: number | null;
  hasUnpricedItems: boolean;
  estimatedDpTotal: number | null;
}

export interface PersistedCartPayload {
  schemaVersion: number;
  items: CartItem[];
}
