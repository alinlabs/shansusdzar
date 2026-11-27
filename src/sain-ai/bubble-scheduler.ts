export const SAIN_AI_INITIAL_PEEK_MS = 1200;
export const SAIN_AI_REAPPEAR_INTERVAL_MS = 7000;
export const SAIN_AI_VISIBLE_DURATION_MS = 4200;

export interface BubbleScheduleState {
  isVisible: boolean;
  cycleCount: number;
}

export interface BubbleScheduleConfig {
  initialPeekMs: number;
  reappearIntervalMs: number;
  visibleDurationMs: number;
}

export const DEFAULT_BUBBLE_SCHEDULE_CONFIG: BubbleScheduleConfig = {
  initialPeekMs: SAIN_AI_INITIAL_PEEK_MS,
  reappearIntervalMs: SAIN_AI_REAPPEAR_INTERVAL_MS,
  visibleDurationMs: SAIN_AI_VISIBLE_DURATION_MS,
};

/**
 * Menentukan visibilitas awal tombol melayang:
 * - Selama aktif di pengaturan dan chat tertutup, langsung tampil permanen di desktop maupun seluler.
 */
export function resolveInitialBubbleVisibility(params: {
  isOpen: boolean;
  isMobileViewport: boolean;
  isBubbleEnabled?: boolean;
}): boolean {
  const enabled = params.isBubbleEnabled ?? true;
  if (!enabled || params.isOpen) {
    return false;
  }
  return true;
}

/**
 * Menghitung jeda berikutnya untuk floating trigger Sain Ai:
 * - Saat dinonaktifkan di pengaturan atau chat terbuka: tidak menjadwalkan timer.
 * - Di desktop maupun seluler: tombol melayang tetap tampil permanen (tidak pernah auto-hide).
 */
export function resolveNextBubbleTimer(params: {
  isOpen: boolean;
  isVisible: boolean;
  isPausedByPointerOrFocus: boolean;
  cycleCount: number;
  isMobileViewport: boolean;
  isBubbleEnabled?: boolean;
  config?: BubbleScheduleConfig;
}): { action: 'show' | 'hide' | 'none'; delayMs: number | null } {
  const enabled = params.isBubbleEnabled ?? true;

  if (!enabled || params.isOpen) {
    return { action: 'none', delayMs: null };
  }

  if (!params.isVisible) {
    return { action: 'show', delayMs: 0 };
  }

  return { action: 'none', delayMs: null };
}

export const SAIN_AI_TEXT_EXPANDED_MS = 7000;
export const SAIN_AI_TEXT_COLLAPSED_MS = 15000;

/**
 * Mengatur siklus teks "Yuk Tanya Sain Ai" pada floating trigger di tepi kanan:
 * - Awal tampil 7 detik, lalu meluncur ke kanan & menghilang (menyisakan maskot saja) selama 15 detik,
 *   kemudian muncul lagi dari kanan ke posisi semula.
 */
export function resolveNextBubbleTextTimer(params: {
  isOpen: boolean;
  isBubbleEnabled?: boolean;
  isTextExpanded: boolean;
  isPausedByPointerOrFocus?: boolean;
  expandedDurationMs?: number;
  collapsedDurationMs?: number;
}): { nextExpanded: boolean; delayMs: number | null } {
  const enabled = params.isBubbleEnabled ?? true;
  if (!enabled || params.isOpen) {
    return { nextExpanded: true, delayMs: null };
  }

  if (params.isPausedByPointerOrFocus && params.isTextExpanded) {
    return { nextExpanded: true, delayMs: null };
  }

  const expandedMs = params.expandedDurationMs ?? SAIN_AI_TEXT_EXPANDED_MS;
  const collapsedMs = params.collapsedDurationMs ?? SAIN_AI_TEXT_COLLAPSED_MS;

  if (params.isTextExpanded) {
    return { nextExpanded: false, delayMs: expandedMs };
  }
  return { nextExpanded: true, delayMs: collapsedMs };
}

