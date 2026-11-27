export type NetworkEffectiveType = 'slow-2g' | '2g' | '3g' | '4g' | string;

export interface DeviceEnvironmentInput {
  saveData?: boolean;
  effectiveType?: NetworkEffectiveType;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  prefersReducedMotion?: boolean;
  isCoarsePointer?: boolean;
}

export interface DeviceCapabilities {
  isConstrainedNetwork: boolean;
  isLowEndDevice: boolean;
  prefersReducedMotion: boolean;
  isCoarsePointer: boolean;
  shouldAutoLoadHeroVideo: boolean;
  shouldPrefetchRoutes: boolean;
  maxMediaConcurrency: number;
  memoryCacheMaxEntries: number;
}

export function resolveDeviceCapabilities(env: DeviceEnvironmentInput): DeviceCapabilities {
  const saveData = Boolean(env.saveData);
  const effectiveType = (env.effectiveType ?? '').toLowerCase();
  const isSlowNetwork = effectiveType === 'slow-2g' || effectiveType === '2g';
  const isConstrainedNetwork = saveData || isSlowNetwork;

  const hasDeviceMemory =
    typeof env.deviceMemory === 'number' &&
    Number.isFinite(env.deviceMemory) &&
    env.deviceMemory > 0;
  const hasCores =
    typeof env.hardwareConcurrency === 'number' &&
    Number.isFinite(env.hardwareConcurrency) &&
    env.hardwareConcurrency > 0;

  const isLowMemory = hasDeviceMemory && (env.deviceMemory as number) <= 2;
  const isUltraLowMemory = hasDeviceMemory && (env.deviceMemory as number) <= 1;
  const isLowCoreCount = hasCores && (env.hardwareConcurrency as number) <= 2;
  const isLowEndDevice = isLowMemory || isLowCoreCount;

  const prefersReducedMotion = Boolean(env.prefersReducedMotion);
  const isCoarsePointer = Boolean(env.isCoarsePointer);

  return {
    isConstrainedNetwork,
    isLowEndDevice,
    prefersReducedMotion,
    isCoarsePointer,
    shouldAutoLoadHeroVideo: !prefersReducedMotion && !isConstrainedNetwork && !isUltraLowMemory,
    shouldPrefetchRoutes: !isConstrainedNetwork && !isLowEndDevice,
    maxMediaConcurrency: isConstrainedNetwork ? 2 : isLowEndDevice ? 3 : 4,
    memoryCacheMaxEntries: isLowEndDevice ? 24 : 48,
  };
}

export function getThreeDQualityProfile(params: {
  isSoftwareGl: boolean;
  isCoarsePointer: boolean;
  isLowEndDevice: boolean;
  hardwareMaxAnisotropy: number;
}): {
  maxDpr: number;
  shadowMapSize: number;
  maxAnisotropy: number;
} {
  const { isSoftwareGl, isCoarsePointer, isLowEndDevice, hardwareMaxAnisotropy } = params;

  const maxDpr = isSoftwareGl ? 1 : isLowEndDevice ? 1.25 : isCoarsePointer ? 1.5 : 2;
  const shadowMapSize = isLowEndDevice ? 512 : 1024;
  const maxAnisotropy = isSoftwareGl
    ? 1
    : Math.max(1, Math.min(isLowEndDevice ? 2 : 4, hardwareMaxAnisotropy || 1));

  return {
    maxDpr,
    shadowMapSize,
    maxAnisotropy,
  };
}

interface NavigatorWithHints extends Navigator {
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
  deviceMemory?: number;
}

export function getDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return resolveDeviceCapabilities({});
  }

  const nav = navigator as NavigatorWithHints;
  const prefersReducedMotion = Boolean(
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  const isCoarsePointer = Boolean(window.matchMedia?.('(pointer: coarse)').matches);

  return resolveDeviceCapabilities({
    saveData: nav.connection?.saveData,
    effectiveType: nav.connection?.effectiveType,
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    prefersReducedMotion,
    isCoarsePointer,
  });
}
