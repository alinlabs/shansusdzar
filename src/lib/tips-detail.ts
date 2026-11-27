import type { MaterialSpecItem } from '../types/cms';

export interface ResolvedMaterialDetail {
  item: MaterialSpecItem;
  relatedMaterials: MaterialSpecItem[];
}

export function resolveTipsDetailEntry(
  id: string | undefined,
  materials: readonly MaterialSpecItem[]
): ResolvedMaterialDetail | null {
  const normalizedId = id?.trim();
  if (!normalizedId) return null;

  const matchedMaterial = materials.find((item) => item.id === normalizedId);
  if (!matchedMaterial) return null;

  return {
    item: matchedMaterial,
    relatedMaterials: materials.filter((item) => item.id !== matchedMaterial.id),
  };
}
