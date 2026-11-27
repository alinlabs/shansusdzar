import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { UNIVERSAL_COLOR_PALETTE } from '../../../../src/lib/color-palette';
import {
  classify3dMaterialRole,
  computeExactLinearTargetColor,
  createModelAppearanceController,
  getGrainStrengthForBucket,
  resolveGrainPresetBucket,
} from '../../../../src/pages/produk/detail/product-3d-materials';

test('classify3dMaterialRole accurately separates kitchen.glb materials and generic furniture parts', () => {
  // Exact kitchen.glb material names
  assert.equal(classify3dMaterialRole({ materialName: 'Marable', metalness: 0 }), 'preserved');
  assert.equal(
    classify3dMaterialRole({ materialName: 'furniture_handle', metalness: 0.71 }),
    'preserved'
  );
  assert.equal(classify3dMaterialRole({ materialName: 'Wood_front', metalness: 0 }), 'primary-panel');
  assert.equal(classify3dMaterialRole({ materialName: 'color_balack', metalness: 0 }), 'carcass-body');

  // Generic furniture GLB names & physical traits
  assert.equal(classify3dMaterialRole({ materialName: 'Glass_Door', transmission: 0.9 }), 'preserved');
  assert.equal(
    classify3dMaterialRole({ materialName: 'Acrylic', transparent: true, opacity: 0.4 }),
    'preserved'
  );
  assert.equal(classify3dMaterialRole({ materialName: 'Chrome_Trim', metalness: 0.85 }), 'preserved');
  assert.equal(classify3dMaterialRole({ materialName: 'Cabinet_Carcass' }), 'carcass-body');
  assert.equal(classify3dMaterialRole({ materialName: 'Cabinet_Door_HPL' }), 'primary-panel');
  assert.equal(classify3dMaterialRole({ materialName: 'Custom_Material' }), 'primary-panel');
});

test('resolveGrainPresetBucket distinguishes Cat Duco, wood-tone HPL, and solid HPL', () => {
  const gading = UNIVERSAL_COLOR_PALETTE.find((c) => c.id === 'gading-hangat')!;
  const kayu = UNIVERSAL_COLOR_PALETTE.find((c) => c.id === 'kayu-muda')!;
  const walnut = UNIVERSAL_COLOR_PALETTE.find((c) => c.id === 'walnut-tua')!;

  assert.equal(resolveGrainPresetBucket(gading, 'HPL'), 'hpl-solid');
  assert.equal(resolveGrainPresetBucket(kayu, 'HPL'), 'hpl-wood');
  assert.equal(resolveGrainPresetBucket(walnut, 'HPL'), 'hpl-wood');
  assert.equal(resolveGrainPresetBucket(kayu, 'Cat Duco'), 'duco');
  assert.equal(resolveGrainPresetBucket(gading, 'Cat Duco'), 'duco');

  assert.ok(getGrainStrengthForBucket('duco') < getGrainStrengthForBucket('hpl-solid'));
  assert.ok(getGrainStrengthForBucket('hpl-solid') < getGrainStrengthForBucket('hpl-wood'));
});

test('computeExactLinearTargetColor compensates texture mean luminance to preserve exact sRGB hex reflectance', () => {
  const hex = '#EAE5DC';
  const expectedLinear = new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);

  // Without texture (mean = 1), exact linear match
  const untextured = computeExactLinearTargetColor(hex, 1, 1);
  assert.ok(Math.abs(untextured.r - expectedLinear.r) < 1e-6);
  assert.ok(Math.abs(untextured.g - expectedLinear.g) < 1e-6);
  assert.ok(Math.abs(untextured.b - expectedLinear.b) < 1e-6);

  // With normalized texture (mean = 0.82), multiplying result by mean recovers exact expectedLinear
  const compensated = computeExactLinearTargetColor(hex, 0.82, 1);
  assert.ok(Math.abs(compensated.r * 0.82 - expectedLinear.r) < 1e-5);
  assert.ok(Math.abs(compensated.g * 0.82 - expectedLinear.g) < 1e-5);
  assert.ok(Math.abs(compensated.b * 0.82 - expectedLinear.b) < 1e-5);
});

test('createModelAppearanceController updates primary-panel & carcass-body while leaving preserved materials untouched', () => {
  const root = new THREE.Group();

  const marbleMat = new THREE.MeshStandardMaterial({ name: 'Marable', color: 0xffffff });
  const handleMat = new THREE.MeshStandardMaterial({
    name: 'furniture_handle',
    color: 0x111111,
    metalness: 0.71,
    roughness: 0.6,
  });
  const frontMat = new THREE.MeshStandardMaterial({
    name: 'Wood_front',
    color: 0xffffff,
    roughness: 0.55,
  });
  const carcassMat = new THREE.MeshStandardMaterial({
    name: 'color_balack',
    color: 0x050505,
    roughness: 0.4,
  });

  const geo = new THREE.BoxGeometry(1, 1, 1);
  root.add(
    new THREE.Mesh(geo, marbleMat),
    new THREE.Mesh(geo, handleMat),
    new THREE.Mesh(geo, frontMat),
    new THREE.Mesh(geo, carcassMat)
  );

  const initialMarble = marbleMat.color.clone();
  const initialHandle = handleMat.color.clone();

  const controller = createModelAppearanceController(root, 1);
  const olive = UNIVERSAL_COLOR_PALETTE.find((c) => c.id === 'zaitun-redup')!;
  controller.apply({ color: olive, finishLabel: 'HPL' });

  const expectedOlive = new THREE.Color().setStyle(olive.hex, THREE.SRGBColorSpace);
  assert.ok(Math.abs(frontMat.color.r - expectedOlive.r) < 1e-5);
  assert.ok(Math.abs(frontMat.color.g - expectedOlive.g) < 1e-5);
  assert.ok(Math.abs(frontMat.color.b - expectedOlive.b) < 1e-5);

  // Carcass follows selected color with subtle tonal depth
  assert.ok(carcassMat.color.r > 0.05 && carcassMat.color.r < frontMat.color.r);
  assert.ok(Math.abs(carcassMat.color.g / carcassMat.color.r - expectedOlive.g / expectedOlive.r) < 1e-4);

  // Preserved materials must never change
  assert.equal(marbleMat.color.getHex(), initialMarble.getHex());
  assert.equal(handleMat.color.getHex(), initialHandle.getHex());

  // Switching to Cat Duco updates roughness smoothly
  controller.apply({ color: olive, finishLabel: 'Cat Duco' });
  assert.ok(frontMat.roughness < 0.55);
  assert.equal(carcassMat.roughness, 0.34);

  controller.dispose();
  geo.dispose();
  marbleMat.dispose();
  handleMat.dispose();
  frontMat.dispose();
  carcassMat.dispose();
});
