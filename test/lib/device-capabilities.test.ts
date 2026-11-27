import test from 'node:test';
import assert from 'node:assert/strict';
import { getThreeDQualityProfile, resolveDeviceCapabilities } from '../../src/lib/device-capabilities';

test('resolveDeviceCapabilities disables heavy auto-loads on constrained networks', () => {
  const saveDataCap = resolveDeviceCapabilities({ saveData: true, effectiveType: '4g' });
  assert.equal(saveDataCap.isConstrainedNetwork, true);
  assert.equal(saveDataCap.shouldAutoLoadHeroVideo, false);
  assert.equal(saveDataCap.shouldPrefetchRoutes, false);
  assert.equal(saveDataCap.maxMediaConcurrency, 2);

  const slowNetCap = resolveDeviceCapabilities({ saveData: false, effectiveType: '2g' });
  assert.equal(slowNetCap.isConstrainedNetwork, true);
  assert.equal(slowNetCap.shouldAutoLoadHeroVideo, false);
  assert.equal(slowNetCap.shouldPrefetchRoutes, false);
});

test('resolveDeviceCapabilities scales concurrency and cache limits for low-end vs desktop devices', () => {
  const lowEnd = resolveDeviceCapabilities({
    effectiveType: '4g',
    deviceMemory: 2,
    hardwareConcurrency: 2,
  });
  assert.equal(lowEnd.isLowEndDevice, true);
  assert.equal(lowEnd.maxMediaConcurrency, 3);
  assert.equal(lowEnd.memoryCacheMaxEntries, 24);
  assert.equal(lowEnd.shouldPrefetchRoutes, false);

  const ultraLowRam = resolveDeviceCapabilities({
    effectiveType: '4g',
    deviceMemory: 1,
  });
  assert.equal(ultraLowRam.shouldAutoLoadHeroVideo, false);

  const desktop = resolveDeviceCapabilities({
    effectiveType: '4g',
    deviceMemory: 8,
    hardwareConcurrency: 8,
  });
  assert.equal(desktop.isConstrainedNetwork, false);
  assert.equal(desktop.isLowEndDevice, false);
  assert.equal(desktop.shouldAutoLoadHeroVideo, true);
  assert.equal(desktop.shouldPrefetchRoutes, true);
  assert.equal(desktop.maxMediaConcurrency, 4);
  assert.equal(desktop.memoryCacheMaxEntries, 48);
});

test('resolveDeviceCapabilities respects prefers-reduced-motion for auto-playing hero video', () => {
  const reduced = resolveDeviceCapabilities({
    effectiveType: '4g',
    deviceMemory: 8,
    prefersReducedMotion: true,
  });
  assert.equal(reduced.prefersReducedMotion, true);
  assert.equal(reduced.shouldAutoLoadHeroVideo, false);
});

test('getThreeDQualityProfile adapts DPR, shadow map, and anisotropy cleanly', () => {
  assert.deepEqual(
    getThreeDQualityProfile({
      isSoftwareGl: true,
      isCoarsePointer: false,
      isLowEndDevice: false,
      hardwareMaxAnisotropy: 16,
    }),
    { maxDpr: 1, shadowMapSize: 1024, maxAnisotropy: 1 }
  );

  assert.deepEqual(
    getThreeDQualityProfile({
      isSoftwareGl: false,
      isCoarsePointer: true,
      isLowEndDevice: true,
      hardwareMaxAnisotropy: 8,
    }),
    { maxDpr: 1.25, shadowMapSize: 512, maxAnisotropy: 2 }
  );

  assert.deepEqual(
    getThreeDQualityProfile({
      isSoftwareGl: false,
      isCoarsePointer: false,
      isLowEndDevice: false,
      hardwareMaxAnisotropy: 16,
    }),
    { maxDpr: 2, shadowMapSize: 1024, maxAnisotropy: 4 }
  );
});
