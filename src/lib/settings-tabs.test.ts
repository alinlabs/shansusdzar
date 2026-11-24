import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOBILE_SETTINGS_TABS,
  formatStorageBytes,
  resolveMobileSettingsTabFromLocation,
} from './settings-tabs.ts';

test('MOBILE_SETTINGS_TABS exposes Akun, Tampilan, Notifikasi, and Penyimpanan in order', () => {
  assert.deepEqual(
    MOBILE_SETTINGS_TABS.map((t) => t.label),
    ['Akun', 'Tampilan', 'Notifikasi', 'Penyimpanan']
  );
});

test('resolveMobileSettingsTabFromLocation maps section hashes and intents accurately', () => {
  assert.equal(resolveMobileSettingsTabFromLocation({}), 'akun');
  assert.equal(resolveMobileSettingsTabFromLocation({ hash: '#akun' }), 'akun');
  assert.equal(resolveMobileSettingsTabFromLocation({ intent: 'survei' }), 'akun');
  assert.equal(resolveMobileSettingsTabFromLocation({ hash: '#tema' }), 'tampilan');
  assert.equal(resolveMobileSettingsTabFromLocation({ hash: '#navigasi' }), 'tampilan');
  assert.equal(resolveMobileSettingsTabFromLocation({ hash: '#sain-ai' }), 'tampilan');
  assert.equal(resolveMobileSettingsTabFromLocation({ hash: '#bahasa' }), 'tampilan');
  assert.equal(resolveMobileSettingsTabFromLocation({ hash: '#notifikasi' }), 'notifikasi');
  assert.equal(resolveMobileSettingsTabFromLocation({ hash: '#penyimpanan' }), 'penyimpanan');
});

test('formatStorageBytes formats bytes cleanly across scales', () => {
  assert.equal(formatStorageBytes(null), null);
  assert.equal(formatStorageBytes(512), '512 B');
  assert.equal(formatStorageBytes(1536), '1.5 KB');
  assert.equal(formatStorageBytes(2 * 1024 * 1024), '2.0 MB');
});
