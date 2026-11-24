import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInstallGuideSteps,
  detectIOSDevice,
  INSTALL_PROMPT_COOLDOWN_MS,
  shouldShowInstallPromptCard,
  shouldShowManualInstallAction,
} from './app-install';

test('shouldShowInstallPromptCard suppresses prompt in standalone or admin mode', () => {
  const base = {
    hasNativePrompt: true,
    isIOS: false,
    record: { dismissedAt: null, dismissCount: 0, installedAt: null, neverShowAgain: false },
    now: 1_000_000,
  };

  assert.equal(
    shouldShowInstallPromptCard({ ...base, isStandalone: true, isAdminRoute: false }),
    false
  );
  assert.equal(
    shouldShowInstallPromptCard({ ...base, isStandalone: false, isAdminRoute: true }),
    false
  );
  assert.equal(
    shouldShowInstallPromptCard({ ...base, isStandalone: false, isAdminRoute: false }),
    true
  );
});

test('shouldShowInstallPromptCard respects temporary dismissal cooldown and re-enables periodically', () => {
  const dismissedAt = 10_000;
  const record = { dismissedAt, dismissCount: 1, installedAt: null, neverShowAgain: false };

  assert.equal(
    shouldShowInstallPromptCard({
      isStandalone: false,
      isAdminRoute: false,
      hasNativePrompt: false,
      isIOS: false,
      record,
      now: dismissedAt + INSTALL_PROMPT_COOLDOWN_MS - 1000,
    }),
    false
  );

  assert.equal(
    shouldShowInstallPromptCard({
      isStandalone: false,
      isAdminRoute: false,
      hasNativePrompt: false,
      isIOS: false,
      record,
      now: dismissedAt + INSTALL_PROMPT_COOLDOWN_MS + 1000,
    }),
    true
  );
});

test('shouldShowInstallPromptCard suppresses forever once installed or neverShowAgain is chosen', () => {
  assert.equal(
    shouldShowInstallPromptCard({
      isStandalone: false,
      isAdminRoute: false,
      hasNativePrompt: true,
      isIOS: false,
      record: { dismissedAt: null, dismissCount: 0, installedAt: 5000, neverShowAgain: false },
      now: 5000 + INSTALL_PROMPT_COOLDOWN_MS * 10,
    }),
    false
  );

  assert.equal(
    shouldShowInstallPromptCard({
      isStandalone: false,
      isAdminRoute: false,
      hasNativePrompt: true,
      isIOS: false,
      record: { dismissedAt: 5000, dismissCount: 1, installedAt: null, neverShowAgain: true },
      now: 5000 + INSTALL_PROMPT_COOLDOWN_MS * 10,
    }),
    false
  );
});

test('detectIOSDevice and buildInstallGuideSteps avoid PWA terminology cleanly', () => {
  assert.equal(detectIOSDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), true);
  assert.equal(detectIOSDevice('Mozilla/5.0 (Linux; Android 14)'), false);

  const iosGuide = buildInstallGuideSteps(true);
  const desktopGuide = buildInstallGuideSteps(false);
  const combined = `${iosGuide.title} ${iosGuide.steps.join(' ')} ${desktopGuide.title} ${desktopGuide.steps.join(' ')}`;

  assert.equal(/\bpwa\b/i.test(combined), false);
});

test('shouldShowManualInstallAction remains available even after banner is dismissed unless standalone or admin', () => {
  assert.equal(shouldShowManualInstallAction({ isStandalone: false, isAdminRoute: false }), true);
  assert.equal(shouldShowManualInstallAction({ isStandalone: true, isAdminRoute: false }), false);
  assert.equal(shouldShowManualInstallAction({ isStandalone: false, isAdminRoute: true }), false);
});
