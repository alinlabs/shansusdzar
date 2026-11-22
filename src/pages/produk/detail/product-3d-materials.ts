import * as THREE from 'three';
import type { ProductColorOption } from '../../../types/product';

export type Material3dRole = 'primary-panel' | 'carcass-body' | 'preserved';
export type GrainPresetBucket = 'duco' | 'hpl-solid' | 'hpl-wood';

export interface MaterialAppearanceOptions {
  color: ProductColorOption;
  finishLabel?: string;
}

interface MaterialBaselineSnapshot {
  material: THREE.MeshStandardMaterial;
  role: Material3dRole;
  originalColor: THREE.Color;
  originalMap: THREE.Texture | null;
  originalRoughness: number;
  originalNormalScale: THREE.Vector2 | null;
}

interface NeutralizedTextureEntry {
  texture: THREE.CanvasTexture;
  meanLinear: number;
}

export interface ModelAppearanceController {
  apply: (options: MaterialAppearanceOptions) => void;
  dispose: () => void;
}

const PRESERVED_NAME_RE =
  /marable|marble|marmer|granit|quartz|stone|batu|counter|tabletop|worktop|backsplash|handle|knob|hinge|engsel|metal|steel|besi|chrome|krom|brass|kuningan|alum|iron|gold|silver|glass|kaca|mirror|cermin|sink|wastafel|faucet|keran|tap|stove|kompor|hood|oven|led|lamp|lampu|appliance/i;

const CARCASS_NAME_RE =
  /color_balack|carcass|korpus|frame|rangka|plinth|kickplate|skirting|back_panel|backing/i;

const PRIMARY_PANEL_NAME_RE =
  /wood_front|front|door|pintu|drawer|laci|panel|facade|cabinet|kabinet|lemari|wood|kayu|hpl|duco|laminate|body|box/i;

const WOOD_TONE_COLOR_RE = /kayu|walnut|oak|teak|jati|sungkai|ash|pine|mahogany|meranti/i;

const NEUTRAL_ANCHOR_LINEAR = 0.82;
const CARCASS_LINEAR_TONE_FACTOR = 0.9;
const MAX_TEXTURE_PROCESS_DIM = 512;

const SRGB_TO_LINEAR_LUT: Float32Array = (() => {
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) {
    const c = i / 255;
    lut[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return lut;
})();

function linearToSrgbByte(linear: number): number {
  const clamped = Math.max(0, Math.min(1, linear));
  const srgb =
    clamped <= 0.0031308
      ? clamped * 12.92
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(srgb * 255)));
}

export function classify3dMaterialRole(params: {
  materialName?: string | null;
  meshName?: string | null;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
  transmission?: number;
}): Material3dRole {
  const matName = (params.materialName ?? '').trim();
  const meshName = (params.meshName ?? '').trim();
  const combined = `${matName} ${meshName}`.trim();

  const metalness = params.metalness ?? 0;
  const opacity = params.opacity ?? 1;
  const transmission = params.transmission ?? 0;

  if (metalness >= 0.45 || transmission > 0.1 || (params.transparent && opacity < 0.92)) {
    return 'preserved';
  }

  if (combined && PRESERVED_NAME_RE.test(combined)) {
    return 'preserved';
  }

  if (combined && CARCASS_NAME_RE.test(combined)) {
    return 'carcass-body';
  }

  if (combined && PRIMARY_PANEL_NAME_RE.test(combined)) {
    return 'primary-panel';
  }

  return 'primary-panel';
}

export function resolveGrainPresetBucket(
  color: Pick<ProductColorOption, 'id' | 'nama' | 'catatanNuansa'>,
  finishLabel?: string
): GrainPresetBucket {
  const finishNorm = (finishLabel ?? '').trim().toLowerCase();
  if (finishNorm.includes('duco')) {
    return 'duco';
  }
  const colorDesc = `${color.id} ${color.nama} ${color.catatanNuansa ?? ''}`;
  if (WOOD_TONE_COLOR_RE.test(colorDesc)) {
    return 'hpl-wood';
  }
  return 'hpl-solid';
}

export function getGrainStrengthForBucket(bucket: GrainPresetBucket): number {
  switch (bucket) {
    case 'duco':
      return 0.08;
    case 'hpl-wood':
      return 0.42;
    case 'hpl-solid':
    default:
      return 0.22;
  }
}

export function computeExactLinearTargetColor(
  hex: string,
  meanTextureLinear = 1,
  toneMultiplier = 1
): THREE.Color {
  const target = new THREE.Color();
  target.setStyle(hex, THREE.SRGBColorSpace);
  const safeMean = Math.max(0.1, meanTextureLinear);
  target.multiplyScalar(toneMultiplier / safeMean);
  return target;
}

function buildNeutralizedTexture(
  sourceTexture: THREE.Texture,
  grainStrength: number,
  maxAnisotropy: number
): NeutralizedTextureEntry | null {
  if (typeof document === 'undefined') return null;

  const img = sourceTexture.image as
    | { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number }
    | undefined;
  const rawW = img?.naturalWidth ?? img?.width ?? 0;
  const rawH = img?.naturalHeight ?? img?.height ?? 0;
  if (!img || rawW <= 0 || rawH <= 0) return null;

  const scale = Math.min(1, MAX_TEXTURE_PROCESS_DIM / Math.max(rawW, rawH));
  const width = Math.max(1, Math.round(rawW * scale));
  const height = Math.max(1, Math.round(rawH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(img as CanvasImageSource, 0, 0, width, height);
  } catch {
    return null;
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let lumSum = 0;
  let visibleCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = SRGB_TO_LINEAR_LUT[data[i]];
    const g = SRGB_TO_LINEAR_LUT[data[i + 1]];
    const b = SRGB_TO_LINEAR_LUT[data[i + 2]];
    lumSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    visibleCount += 1;
  }

  const meanLum = visibleCount > 0 ? Math.max(0.02, lumSum / visibleCount) : 0.5;

  let outLinSum = 0;
  let outCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = SRGB_TO_LINEAR_LUT[data[i]];
    const g = SRGB_TO_LINEAR_LUT[data[i + 1]];
    const b = SRGB_TO_LINEAR_LUT[data[i + 2]];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const rawDetail = Math.max(0.55, Math.min(1.22, lum / meanLum));
    const detail = 1 + (rawDetail - 1) * grainStrength;
    const outLin = Math.max(0, Math.min(1, NEUTRAL_ANCHOR_LINEAR * detail));
    const byte = linearToSrgbByte(outLin);
    data[i] = byte;
    data[i + 1] = byte;
    data[i + 2] = byte;
    outLinSum += SRGB_TO_LINEAR_LUT[byte];
    outCount += 1;
  }

  ctx.putImageData(imageData, 0, 0);

  const actualMeanLinear = outCount > 0 ? Math.max(0.1, outLinSum / outCount) : NEUTRAL_ANCHOR_LINEAR;

  const neutralTex = new THREE.CanvasTexture(canvas);
  neutralTex.colorSpace = THREE.SRGBColorSpace;
  neutralTex.wrapS = sourceTexture.wrapS;
  neutralTex.wrapT = sourceTexture.wrapT;
  neutralTex.repeat.copy(sourceTexture.repeat);
  neutralTex.offset.copy(sourceTexture.offset);
  neutralTex.center.copy(sourceTexture.center);
  neutralTex.rotation = sourceTexture.rotation;
  neutralTex.flipY = sourceTexture.flipY;
  neutralTex.anisotropy = maxAnisotropy;
  neutralTex.needsUpdate = true;

  return { texture: neutralTex, meanLinear: actualMeanLinear };
}

export function createModelAppearanceController(
  root: THREE.Object3D,
  maxAnisotropy: number
): ModelAppearanceController {
  const snapshots: MaterialBaselineSnapshot[] = [];
  const seenMaterials = new Set<THREE.Material>();
  const neutralTextureCache = new Map<string, NeutralizedTextureEntry>();

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];

    for (const mat of materials) {
      if (!mat || seenMaterials.has(mat)) continue;
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;

      seenMaterials.add(mat);

      const physMat = mat as THREE.MeshPhysicalMaterial;
      const role = classify3dMaterialRole({
        materialName: mat.name,
        meshName: mesh.name,
        metalness: mat.metalness,
        transparent: mat.transparent,
        opacity: mat.opacity,
        transmission: typeof physMat.transmission === 'number' ? physMat.transmission : 0,
      });

      if (role === 'preserved') continue;

      snapshots.push({
        material: mat,
        role,
        originalColor: mat.color.clone(),
        originalMap: mat.map ?? null,
        originalRoughness: mat.roughness,
        originalNormalScale: mat.normalScale ? mat.normalScale.clone() : null,
      });
    }
  });

  const getNeutralTextureEntry = (
    sourceTex: THREE.Texture,
    bucket: GrainPresetBucket
  ): NeutralizedTextureEntry | null => {
    const cacheKey = `${sourceTex.uuid}:${bucket}`;
    const existing = neutralTextureCache.get(cacheKey);
    if (existing) return existing;

    const grainStrength = getGrainStrengthForBucket(bucket);
    const created = buildNeutralizedTexture(sourceTex, grainStrength, maxAnisotropy);
    if (!created) return null;

    neutralTextureCache.set(cacheKey, created);
    return created;
  };

  const apply = ({ color, finishLabel }: MaterialAppearanceOptions) => {
    const bucket = resolveGrainPresetBucket(color, finishLabel);
    const isDuco = bucket === 'duco';

    for (const snap of snapshots) {
      const { material, role, originalMap, originalRoughness, originalNormalScale } = snap;
      const toneMultiplier = role === 'carcass-body' ? CARCASS_LINEAR_TONE_FACTOR : 1;

      let meanTexLinear = 1;
      if (originalMap) {
        const neutralEntry = getNeutralTextureEntry(originalMap, bucket);
        if (neutralEntry) {
          if (material.map !== neutralEntry.texture) {
            material.map = neutralEntry.texture;
            material.needsUpdate = true;
          }
          meanTexLinear = neutralEntry.meanLinear;
        }
      }

      const targetColor = computeExactLinearTargetColor(color.hex, meanTexLinear, toneMultiplier);
      material.color.copy(targetColor);

      if (role === 'primary-panel') {
        material.roughness = isDuco
          ? Math.max(0.28, Math.min(0.68, originalRoughness * 0.74))
          : originalRoughness;

        if (originalNormalScale && material.normalScale) {
          const normalFactor = bucket === 'duco' ? 0.25 : bucket === 'hpl-wood' ? 0.85 : 0.48;
          material.normalScale.copy(originalNormalScale).multiplyScalar(normalFactor);
        }
      } else if (role === 'carcass-body') {
        material.roughness = isDuco ? 0.34 : 0.52;
      }
    }
  };

  const dispose = () => {
    for (const snap of snapshots) {
      if (snap.material.map !== snap.originalMap) {
        snap.material.map = snap.originalMap;
      }
    }
    for (const entry of neutralTextureCache.values()) {
      entry.texture.dispose();
    }
    neutralTextureCache.clear();
  };

  return { apply, dispose };
}
