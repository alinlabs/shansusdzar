import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_THEME,
  resolveInitialTheme,
  resolveThemeMetaConfig,
  shouldTriggerDeployReload,
} from './theme-preference';

test('resolveInitialTheme defaults to dark when storage is empty or unrecognised', () => {
  assert.equal(DEFAULT_THEME, 'dark');
  assert.equal(resolveInitialTheme(null), 'dark');
  assert.equal(resolveInitialTheme(undefined), 'dark');
  assert.equal(resolveInitialTheme(''), 'dark');
  assert.equal(resolveInitialTheme('system'), 'dark');
  assert.equal(resolveInitialTheme('dark'), 'dark');
});

test('resolveInitialTheme honours explicit light mode selection', () => {
  assert.equal(resolveInitialTheme('light'), 'light');
});

test('resolveThemeMetaConfig maps theme modes to native OS bar colors', () => {
  assert.deepEqual(resolveThemeMetaConfig('dark'), {
    colorScheme: 'dark',
    themeColor: '#171716',
    appleStatusBarStyle: 'black',
  });
  assert.deepEqual(resolveThemeMetaConfig('light'), {
    colorScheme: 'light',
    themeColor: '#fafafa',
    appleStatusBarStyle: 'default',
  });
});

test('shouldTriggerDeployReload only reloads returning controlled clients outside cooldown', () => {
  assert.equal(
    shouldTriggerDeployReload({
      hadController: false,
      isReloading: false,
      lastReloadAt: null,
      now: 100_000,
    }),
    false
  );

  assert.equal(
    shouldTriggerDeployReload({
      hadController: true,
      isReloading: true,
      lastReloadAt: null,
      now: 100_000,
    }),
    false
  );

  assert.equal(
    shouldTriggerDeployReload({
      hadController: true,
      isReloading: false,
      lastReloadAt: 95_000,
      now: 100_000,
    }),
    false
  );

  assert.equal(
    shouldTriggerDeployReload({
      hadController: true,
      isReloading: false,
      lastReloadAt: 85_000,
      now: 100_000,
    }),
    true
  );

  assert.equal(
    shouldTriggerDeployReload({
      hadController: true,
      isReloading: false,
      lastReloadAt: null,
      now: 100_000,
    }),
    true
  );
});
