import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  clampProduct3dTargetAndCamera,
  computeProduct3dCameraBounds,
  ensureInitialPoseWithinBounds,
  PRODUCT_3D_AZIMUTH_HALF_SPAN,
  PRODUCT_3D_MAX_POLAR_ANGLE,
  PRODUCT_3D_MIN_POLAR_ANGLE,
} from './product-3d-limits';

test('computeProduct3dCameraBounds creates symmetric azimuth bounds and sensible zoom/polar/pan limits', () => {
  const defaultTarget = new THREE.Vector3(0, 0.72, 0);
  const defaultPos = new THREE.Vector3(1.5, 1.05, 1.5);
  const bounds = computeProduct3dCameraBounds({
    defaultPos,
    defaultTarget,
    boundingRadius: 1.4,
    scaledHeight: 1.5,
  });

  const defaultDist = defaultPos.distanceTo(defaultTarget);
  assert.ok(bounds.minDistance > 0.6 && bounds.minDistance < defaultDist);
  assert.ok(bounds.maxDistance > defaultDist && bounds.maxDistance < 5.0);

  assert.equal(bounds.minPolarAngle, PRODUCT_3D_MIN_POLAR_ANGLE);
  assert.equal(bounds.maxPolarAngle, PRODUCT_3D_MAX_POLAR_ANGLE);
  assert.ok(bounds.maxPolarAngle < Math.PI / 2, 'camera stays strictly above floor horizon');

  const initialAzimuth = Math.atan2(
    defaultPos.x - defaultTarget.x,
    defaultPos.z - defaultTarget.z
  );
  assert.ok(Math.abs(bounds.minAzimuthAngle - (initialAzimuth - PRODUCT_3D_AZIMUTH_HALF_SPAN)) < 1e-6);
  assert.ok(Math.abs(bounds.maxAzimuthAngle - (initialAzimuth + PRODUCT_3D_AZIMUTH_HALF_SPAN)) < 1e-6);
  assert.ok(bounds.maxAzimuthAngle - bounds.minAzimuthAngle < Math.PI, 'blocks spinning behind back');

  assert.ok(bounds.minTargetY >= 0.18);
  assert.ok(bounds.maxTargetY > bounds.minTargetY);
  assert.ok(bounds.maxTargetRadius > 0.3 && bounds.maxTargetRadius <= 0.62);
});

test('computeProduct3dCameraBounds keeps azimuth limits inside OrbitControls [-2PI, 2PI] range even near +-PI', () => {
  const defaultTarget = new THREE.Vector3(0, 0.7, 0);
  const rearCornerPos = new THREE.Vector3(-0.3, 1.0, -2.0);
  const bounds = computeProduct3dCameraBounds({
    defaultPos: rearCornerPos,
    defaultTarget,
    boundingRadius: 1.35,
    scaledHeight: 1.4,
  });

  assert.ok(bounds.minAzimuthAngle >= -Math.PI * 2);
  assert.ok(bounds.maxAzimuthAngle <= Math.PI * 2);
  assert.ok(bounds.maxAzimuthAngle - bounds.minAzimuthAngle < Math.PI * 2);
});

test('ensureInitialPoseWithinBounds keeps initial pose safely inside polar and distance bounds', () => {
  const defaultTarget = new THREE.Vector3(0, 0.8, 0);
  const tooLowPos = new THREE.Vector3(0, 0.78, 2.0);
  const bounds = computeProduct3dCameraBounds({
    defaultPos: tooLowPos,
    defaultTarget,
    boundingRadius: 1.3,
    scaledHeight: 1.5,
  });

  ensureInitialPoseWithinBounds(tooLowPos, defaultTarget, bounds);

  const offset = new THREE.Vector3().subVectors(tooLowPos, defaultTarget);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  assert.ok(spherical.phi >= bounds.minPolarAngle);
  assert.ok(spherical.phi <= bounds.maxPolarAngle);
  assert.ok(spherical.radius >= bounds.minDistance);
  assert.ok(spherical.radius <= bounds.maxDistance);
});

test('clampProduct3dTargetAndCamera silently clamps target Y and shifts camera Y to preserve offset', () => {
  const defaultTarget = new THREE.Vector3(0, 0.7, 0);
  const defaultPos = new THREE.Vector3(0.5, 1.0, 2.0);
  const bounds = computeProduct3dCameraBounds({
    defaultPos,
    defaultTarget,
    boundingRadius: 1.3,
    scaledHeight: 1.5,
  });

  const camera = new THREE.PerspectiveCamera();
  const target = new THREE.Vector3(0, 0.02, 0);
  camera.position.set(0.5, 0.32, 2.0);
  const initialDy = camera.position.y - target.y;

  clampProduct3dTargetAndCamera(camera, target, bounds);

  assert.equal(target.y, bounds.minTargetY);
  assert.ok(Math.abs(camera.position.y - target.y - initialDy) < 1e-6);
});
