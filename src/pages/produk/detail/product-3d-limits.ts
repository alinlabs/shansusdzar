import * as THREE from 'three';

export interface Product3dCameraBounds {
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  minAzimuthAngle: number;
  maxAzimuthAngle: number;
  maxTargetRadius: number;
  minTargetY: number;
  maxTargetY: number;
}

export interface ComputeProduct3dBoundsParams {
  defaultPos: THREE.Vector3;
  defaultTarget: THREE.Vector3;
  boundingRadius: number;
  scaledHeight: number;
}

export const PRODUCT_3D_MIN_POLAR_ANGLE = Math.PI * 0.2;
export const PRODUCT_3D_MAX_POLAR_ANGLE = Math.PI * 0.485;
export const PRODUCT_3D_AZIMUTH_HALF_SPAN = Math.PI * 0.4;

const _offsetVec = new THREE.Vector3();
const _spherical = new THREE.Spherical();

export function computeProduct3dCameraBounds({
  defaultPos,
  defaultTarget,
  boundingRadius,
  scaledHeight,
}: ComputeProduct3dBoundsParams): Product3dCameraBounds {
  const safeRadius = Math.max(0.5, boundingRadius);
  const safeHeight = Math.max(0.4, scaledHeight);
  const defaultDistance = Math.max(0.5, defaultPos.distanceTo(defaultTarget));

  const minDistance = Math.min(
    defaultDistance * 0.65,
    Math.max(0.68, safeRadius * 0.56)
  );
  const maxDistance = Math.max(defaultDistance * 1.55, safeRadius * 2.45);

  _offsetVec.subVectors(defaultPos, defaultTarget);
  const initialAzimuth = Math.atan2(_offsetVec.x, _offsetVec.z);

  const minAzimuthAngle = initialAzimuth - PRODUCT_3D_AZIMUTH_HALF_SPAN;
  const maxAzimuthAngle = initialAzimuth + PRODUCT_3D_AZIMUTH_HALF_SPAN;

  const maxTargetRadius = Math.max(0.32, Math.min(0.62, safeRadius * 0.4));
  const minFloorTargetY = Math.max(0.18, safeHeight * 0.14);
  const minTargetY = Math.max(minFloorTargetY, defaultTarget.y - maxTargetRadius * 0.75);
  const maxTargetY = Math.max(minTargetY + 0.12, defaultTarget.y + maxTargetRadius * 0.85);

  return {
    minDistance,
    maxDistance,
    minPolarAngle: PRODUCT_3D_MIN_POLAR_ANGLE,
    maxPolarAngle: PRODUCT_3D_MAX_POLAR_ANGLE,
    minAzimuthAngle,
    maxAzimuthAngle,
    maxTargetRadius,
    minTargetY,
    maxTargetY,
  };
}

export function ensureInitialPoseWithinBounds(
  defaultPos: THREE.Vector3,
  defaultTarget: THREE.Vector3,
  bounds: Product3dCameraBounds
): void {
  _offsetVec.subVectors(defaultPos, defaultTarget);
  _spherical.setFromVector3(_offsetVec);

  _spherical.radius = THREE.MathUtils.clamp(
    _spherical.radius,
    bounds.minDistance,
    bounds.maxDistance
  );
  _spherical.phi = THREE.MathUtils.clamp(
    _spherical.phi,
    bounds.minPolarAngle + 0.02,
    bounds.maxPolarAngle - 0.02
  );

  _offsetVec.setFromSpherical(_spherical);
  defaultPos.copy(defaultTarget).add(_offsetVec);
}

export function clampProduct3dTargetAndCamera(
  camera: THREE.Camera,
  target: THREE.Vector3,
  bounds: Product3dCameraBounds
): void {
  const clampedY = THREE.MathUtils.clamp(target.y, bounds.minTargetY, bounds.maxTargetY);
  if (clampedY !== target.y) {
    const deltaY = clampedY - target.y;
    target.y = clampedY;
    camera.position.y += deltaY;
  }
}
