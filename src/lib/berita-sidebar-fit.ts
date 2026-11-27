export interface FitSidebarItemsInput {
  containerHeight: number;
  fixedBlockHeight: number;
  itemHeights: number[];
  minItems?: number;
}

/**
 * Menghitung jumlah maksimum kartu berita di sidebar kanan desktop yang dapat
 * tampil utuh tanpa terpotong atau memicu overflow vertikal pada viewport saat ini.
 */
export function computeFittingNewsCount({
  containerHeight,
  fixedBlockHeight,
  itemHeights,
  minItems = 1,
}: FitSidebarItemsInput): number {
  const totalItems = itemHeights.length;
  if (totalItems === 0) return 0;
  if (!Number.isFinite(containerHeight) || containerHeight <= 0) {
    return totalItems;
  }

  let usedHeight = Math.max(0, Number.isFinite(fixedBlockHeight) ? fixedBlockHeight : 0);
  let fittedCount = 0;

  for (let index = 0; index < totalItems; index += 1) {
    const rawHeight = itemHeights[index];
    const itemHeight = Number.isFinite(rawHeight) ? Math.max(0, rawHeight) : 0;
    if (usedHeight + itemHeight <= containerHeight + 1) {
      usedHeight += itemHeight;
      fittedCount += 1;
    } else {
      break;
    }
  }

  const clampedMin = Math.max(0, Math.min(minItems, totalItems));
  return Math.max(clampedMin, fittedCount);
}
