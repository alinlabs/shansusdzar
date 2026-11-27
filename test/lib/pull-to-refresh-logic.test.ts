import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  PULL_ACTIVATION_DEADZONE_PX,
  PULL_MAX_DISTANCE_PX,
  PULL_TRIGGER_THRESHOLD_PX,
  buildLocationFullPath,
  canStartPullToRefresh,
  computePullDistance,
  resolvePullPhase,
  sanitizeAdminReturnRoute,
} from '../../src/lib/pull-to-refresh-logic';

const ROOT_DIR = process.cwd();

function readProjectFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

test('pull-to-refresh physics obey deadzone, asymptotic resistance, and phase thresholds', () => {
  assert.equal(computePullDistance(-20), 0);
  assert.equal(computePullDistance(0), 0);
  assert.equal(computePullDistance(PULL_ACTIVATION_DEADZONE_PX), 0);

  const midPull = computePullDistance(PULL_ACTIVATION_DEADZONE_PX + 60);
  assert.ok(midPull > 0 && midPull < 60);

  const extremePull = computePullDistance(5000);
  assert.ok(extremePull <= PULL_MAX_DISTANCE_PX);
  assert.ok(extremePull > PULL_TRIGGER_THRESHOLD_PX);

  assert.equal(resolvePullPhase({ isRefreshing: false, pullDistance: 0 }), 'idle');
  assert.equal(
    resolvePullPhase({ isRefreshing: false, pullDistance: PULL_TRIGGER_THRESHOLD_PX - 1 }),
    'pulling'
  );
  assert.equal(
    resolvePullPhase({ isRefreshing: false, pullDistance: PULL_TRIGGER_THRESHOLD_PX }),
    'ready'
  );
  assert.equal(resolvePullPhase({ isRefreshing: true, pullDistance: 0 }), 'refreshing');
});

test('canStartPullToRefresh only allows pull when scrolled to top without modals or protected targets', () => {
  assert.equal(
    canStartPullToRefresh({ scrollTop: 0, hasOpenModal: false, hasProtectedTarget: false }),
    true
  );
  assert.equal(
    canStartPullToRefresh({ scrollTop: 1, hasOpenModal: false, hasProtectedTarget: false }),
    true
  );
  assert.equal(
    canStartPullToRefresh({ scrollTop: 12, hasOpenModal: false, hasProtectedTarget: false }),
    false
  );
  assert.equal(
    canStartPullToRefresh({ scrollTop: 0, hasOpenModal: true, hasProtectedTarget: false }),
    false
  );
  assert.equal(
    canStartPullToRefresh({ scrollTop: 0, hasOpenModal: false, hasProtectedTarget: true }),
    false
  );
});

test('admin return route helpers preserve pathname, query, and hash while blocking invalid redirects', () => {
  assert.equal(
    buildLocationFullPath({ pathname: '/admin/proyek/PRJ-001', search: '?tab=dokumen', hash: '#boq' }),
    '/admin/proyek/PRJ-001?tab=dokumen#boq'
  );
  assert.equal(
    buildLocationFullPath({ pathname: '/admin/keuangan', search: '?tab=skema' }),
    '/admin/keuangan?tab=skema'
  );

  assert.equal(sanitizeAdminReturnRoute('/admin/produk/PRD-001/edit'), '/admin/produk/PRD-001/edit');
  assert.equal(sanitizeAdminReturnRoute('/admin/keuangan?tab=skema'), '/admin/keuangan?tab=skema');
  assert.equal(sanitizeAdminReturnRoute('/admin/login'), '/admin');
  assert.equal(sanitizeAdminReturnRoute('/admin/login?next=1'), '/admin');
  assert.equal(sanitizeAdminReturnRoute('/produk'), '/admin');
  assert.equal(sanitizeAdminReturnRoute('//evil.example/admin'), '/admin');
  assert.equal(sanitizeAdminReturnRoute(null), '/admin');
});

test('pull-to-refresh UI is strictly buttonless, wired to both AppShell and AdminShell, and every store supports reloadFromStorage', () => {
  const indicatorSrc = readProjectFile('src/components/ui/pull-to-refresh-indicator.tsx');
  assert.doesNotMatch(indicatorSrc, /<button\b/i);
  assert.doesNotMatch(indicatorSrc, /role="button"/i);
  assert.match(indicatorSrc, /pointer-events-none/);
  assert.match(indicatorSrc, /data-testid="pull-to-refresh-indicator"/);

  const appShellSrc = readProjectFile('src/components/layout/app-shell.tsx');
  assert.match(appShellSrc, /usePullToRefresh/);
  assert.match(appShellSrc, /executeInPlacePageRefresh/);
  assert.match(appShellSrc, /<PullToRefreshIndicator/);

  const adminShellSrc = readProjectFile('src/pages/admin/admin-shell.tsx');
  assert.match(adminShellSrc, /usePullToRefresh/);
  assert.match(adminShellSrc, /executeInPlacePageRefresh/);
  assert.match(adminShellSrc, /<PullToRefreshIndicator/);
  assert.match(adminShellSrc, /ADMIN_PENDING_ROUTE_STORAGE_KEY/);
  assert.match(adminShellSrc, /buildLocationFullPath/);

  const adminLoginSrc = readProjectFile('src/pages/admin/login/index.tsx');
  assert.match(adminLoginSrc, /ADMIN_PENDING_ROUTE_STORAGE_KEY/);
  assert.match(adminLoginSrc, /sanitizeAdminReturnRoute/);

  const catalogPageSrc = readProjectFile('src/pages/produk/katalog/index.tsx');
  assert.match(catalogPageSrc, /usePageRefreshStore/);

  const productDetailHookSrc = readProjectFile('src/pages/produk/detail/use-product-detail.ts');
  assert.match(productDetailHookSrc, /usePageRefreshStore/);

  const storeFiles = [
    'src/store/site-content-store.ts',
    'src/store/projects-store.ts',
    'src/store/finance-store.ts',
    'src/store/documents-store.ts',
    'src/store/marketing-store.ts',
    'src/store/analytics-store.ts',
    'src/store/admin-auth-store.ts',
    'src/store/cart-store.ts',
    'src/store/user-profile-store.ts',
    'src/store/public-preferences-store.ts',
  ];
  for (const relPath of storeFiles) {
    const src = readProjectFile(relPath);
    assert.match(src, /reloadFromStorage\s*:/, `${relPath} missing reloadFromStorage`);
  }
});
