export interface FloatingPoint {
  x: number;
  y: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface PanelSize {
  width: number;
  height: number;
}

export const FLOATING_CHAT_EDGE_MARGIN_PX = 16;

/**
 * Menghitung posisi awal panel floating chat desktop (kanan-bawah viewport dengan jarak aman).
 */
export function getDefaultFloatingChatPosition(
  viewport: ViewportSize,
  panel: PanelSize,
  margin = FLOATING_CHAT_EDGE_MARGIN_PX
): FloatingPoint {
  const maxX = Math.max(margin, viewport.width - panel.width - margin);
  const maxY = Math.max(margin, viewport.height - panel.height - margin);
  return {
    x: maxX,
    y: maxY,
  };
}

/**
 * Mengunci koordinat panel chat desktop agar tetap berada di dalam area layar meski digeser
 * atau saat ukuran jendela peramban berubah.
 */
export function clampFloatingChatPosition(
  point: FloatingPoint,
  viewport: ViewportSize,
  panel: PanelSize,
  margin = FLOATING_CHAT_EDGE_MARGIN_PX
): FloatingPoint {
  const maxX = Math.max(margin, viewport.width - panel.width - margin);
  const maxY = Math.max(margin, viewport.height - panel.height - margin);
  return {
    x: Math.min(Math.max(margin, Math.round(point.x)), maxX),
    y: Math.min(Math.max(margin, Math.round(point.y)), maxY),
  };
}
