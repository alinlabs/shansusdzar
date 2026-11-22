import { getDeviceCapabilities } from './device-capabilities';

export const routeLoaders = {
  katalog: () => import('../pages/produk/katalog'),
  katalogDetail: () => import('../pages/produk/detail'),
  customInterior: () => import('../pages/produk/custom'),
  portofolio: () => import('../pages/portofolio'),
  portofolioDetail: () => import('../pages/portofolio/detail'),
  berita: () => import('../pages/berita'),
  beritaDetail: () => import('../pages/berita/detail'),
  tipsInterior: () => import('../pages/tips-interior'),
  faq: () => import('../pages/faq'),
  tentang: () => import('../pages/tentang'),
  pencarian: () => import('../pages/pencarian'),
  pesanan: () => import('../pages/pesanan'),
  kebijakanPrivasi: () => import('../pages/kebijakan-privasi'),
  syaratKetentuan: () => import('../pages/syarat-ketentuan'),
  keamananKepatuhan: () => import('../pages/keamanan-kepatuhan'),
  pengaturan: () => import('../pages/pengaturan'),
  notFound: () => import('../pages/not-found'),
  product3dViewer: () => import('../pages/produk/detail/product-3d-viewer'),
} as const;

type LoaderKey = keyof typeof routeLoaders;

const prefetchedLoaders = new Set<LoaderKey>();
let hasScheduledIdlePrefetch = false;

function runLoaderPrefetch(key: LoaderKey): void {
  if (prefetchedLoaders.has(key)) return;
  prefetchedLoaders.add(key);
  void routeLoaders[key]().catch(() => {
    prefetchedLoaders.delete(key);
  });
}

function normalizeRoutePathname(target: string): string {
  const clean = target.split('?')[0].split('#')[0].trim();
  if (!clean) return '/';
  return clean.startsWith('/') ? clean : `/${clean}`;
}

export function resolveLoaderKeyForPath(pathname: string): LoaderKey | null {
  const normalized = normalizeRoutePathname(pathname);

  if (normalized === '/produk/custom' || normalized === '/katalog/custom' || normalized === '/custom-interior') {
    return 'customInterior';
  }
  if (normalized === '/produk' || normalized === '/katalog') {
    return 'katalog';
  }
  if (normalized.startsWith('/produk/') || normalized.startsWith('/katalog/')) {
    return 'katalogDetail';
  }
  if (normalized === '/portofolio') {
    return 'portofolio';
  }
  if (normalized.startsWith('/portofolio/')) {
    return 'portofolioDetail';
  }
  if (normalized === '/berita' || normalized === '/informasi') {
    return 'berita';
  }
  if (normalized.startsWith('/berita/') || normalized.startsWith('/informasi/berita/')) {
    return 'beritaDetail';
  }
  if (normalized === '/tips-interior') {
    return 'tipsInterior';
  }
  if (normalized === '/faq') {
    return 'faq';
  }
  if (normalized === '/tentang') {
    return 'tentang';
  }
  if (normalized === '/pencarian' || normalized === '/cari' || normalized === '/search') {
    return 'pencarian';
  }
  if (normalized === '/pesanan' || normalized === '/keranjang') {
    return 'pesanan';
  }
  if (normalized === '/pengaturan' || normalized === '/settings') {
    return 'pengaturan';
  }
  if (normalized === '/kebijakan-privasi' || normalized === '/privacy' || normalized === '/privacy-policy') {
    return 'kebijakanPrivasi';
  }
  if (normalized === '/syarat-ketentuan' || normalized === '/terms' || normalized === '/terms-of-service') {
    return 'syaratKetentuan';
  }
  if (normalized === '/keamanan-kepatuhan' || normalized === '/security' || normalized === '/kebijakan-cookie') {
    return 'keamananKepatuhan';
  }

  return null;
}

export function prefetchRoute(to: string): void {
  if (typeof window === 'undefined') return;
  const { isConstrainedNetwork } = getDeviceCapabilities();
  if (isConstrainedNetwork) return;

  const loaderKey = resolveLoaderKeyForPath(to);
  if (loaderKey) {
    runLoaderPrefetch(loaderKey);
  }
}

export function prefetchProduct3dViewer(): void {
  if (typeof window === 'undefined') return;
  const { isConstrainedNetwork } = getDeviceCapabilities();
  if (isConstrainedNetwork) return;
  runLoaderPrefetch('product3dViewer');
}

export function scheduleIdleRoutePrefetch(): void {
  if (typeof window === 'undefined' || hasScheduledIdlePrefetch) return;
  const { shouldPrefetchRoutes } = getDeviceCapabilities();
  if (!shouldPrefetchRoutes) return;

  hasScheduledIdlePrefetch = true;
  const warmTopRoutes = () => {
    runLoaderPrefetch('katalog');
    runLoaderPrefetch('portofolio');
    runLoaderPrefetch('tentang');
  };

  if ('requestIdleCallback' in window && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(warmTopRoutes, { timeout: 2500 });
  } else {
    window.setTimeout(warmTopRoutes, 1200);
  }
}
