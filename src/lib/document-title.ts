export const BRAND_TAB_PREFIX = 'Shansusdzar';
export const FAVICON_PATH = '/logo-gelap.webp';
export const FAVICON_MIME_TYPE = 'image/webp';

function normalizeRoutePathname(pathname: string): string {
  const withoutQueryOrHash = (pathname || '/').split(/[?#]/)[0] ?? '/';
  const collapsed = withoutQueryOrHash.replace(/\/+$/, '');
  return collapsed || '/';
}

/**
 * Menentukan 1 kata nama halaman untuk teks di tab/favicon browser.
 * Format akhir selalu: `Shansusdzar - [1 kata nama halaman]`,
 * dan khusus seluruh rute admin selalu `Shansusdzar - Admin`.
 */
export function resolvePageTabLabel(pathname: string): string {
  const normalized = normalizeRoutePathname(pathname);

  if (normalized === '/admin' || normalized.startsWith('/admin/')) {
    return 'Admin';
  }

  if (normalized === '/') {
    return 'Beranda';
  }

  if (
    normalized === '/produk/custom' ||
    normalized === '/katalog/custom' ||
    normalized === '/custom-interior'
  ) {
    return 'Custom';
  }

  if (
    normalized === '/produk' ||
    normalized.startsWith('/produk/') ||
    normalized === '/katalog' ||
    normalized.startsWith('/katalog/')
  ) {
    return 'Produk';
  }

  if (normalized === '/portofolio' || normalized.startsWith('/portofolio/')) {
    return 'Portofolio';
  }

  if (
    normalized === '/berita' ||
    normalized.startsWith('/berita/') ||
    normalized === '/informasi' ||
    normalized.startsWith('/informasi/')
  ) {
    return 'Berita';
  }

  if (normalized === '/tips-interior' || normalized.startsWith('/tips-interior/')) {
    return 'Tips';
  }

  if (normalized === '/faq') {
    return 'FAQ';
  }

  if (normalized === '/tentang') {
    return 'Tentang';
  }

  if (normalized === '/pencarian' || normalized === '/cari' || normalized === '/search') {
    return 'Pencarian';
  }

  if (normalized === '/pesanan' || normalized === '/keranjang') {
    return 'Pesanan';
  }

  if (
    normalized === '/pengaturan' ||
    normalized.startsWith('/pengaturan/') ||
    normalized === '/settings' ||
    normalized === '/profil' ||
    normalized === '/akun' ||
    normalized === '/profile'
  ) {
    return 'Pengaturan';
  }

  if (
    normalized === '/kebijakan-privasi' ||
    normalized === '/privacy' ||
    normalized === '/privacy-policy'
  ) {
    return 'Privasi';
  }

  if (
    normalized === '/syarat-ketentuan' ||
    normalized === '/terms' ||
    normalized === '/terms-of-service'
  ) {
    return 'Ketentuan';
  }

  if (
    normalized === '/keamanan-kepatuhan' ||
    normalized === '/security' ||
    normalized === '/kebijakan-cookie'
  ) {
    return 'Keamanan';
  }

  return '404';
}

export function resolveBrowserTabTitle(pathname: string): string {
  return `${BRAND_TAB_PREFIX} - ${resolvePageTabLabel(pathname)}`;
}

export function syncDocumentTabTitle(pathname: string): string {
  const nextTitle = resolveBrowserTabTitle(pathname);
  if (typeof document !== 'undefined' && document.title !== nextTitle) {
    document.title = nextTitle;
  }
  return nextTitle;
}

export function syncDocumentFavicon(): void {
  if (typeof document === 'undefined' || !document.head) return;

  let iconLink = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!iconLink) {
    iconLink = document.createElement('link');
    iconLink.setAttribute('rel', 'icon');
    document.head.appendChild(iconLink);
  }
  if (iconLink.getAttribute('type') !== FAVICON_MIME_TYPE) {
    iconLink.setAttribute('type', FAVICON_MIME_TYPE);
  }
  if (iconLink.getAttribute('href') !== FAVICON_PATH) {
    iconLink.setAttribute('href', FAVICON_PATH);
  }
}
