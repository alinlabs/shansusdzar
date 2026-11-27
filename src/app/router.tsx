import { lazy, Suspense, useEffect, useLayoutEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router';
import { AppShell } from '../components/layout/app-shell';
import { RouteLoadingFallback } from '../components/ui/route-loading-fallback';
import { syncDocumentPwaManifest } from '../lib/app-install';
import { syncDocumentFavicon, syncDocumentTabTitle } from '../lib/document-title';
import { routeLoaders, scheduleIdleRoutePrefetch } from '../lib/route-prefetch';
import BerandaPage from '../pages/beranda';

const KatalogPage = lazy(routeLoaders.katalog);
const KatalogDetailPage = lazy(routeLoaders.katalogDetail);
const CustomInteriorPage = lazy(routeLoaders.customInterior);
const PortofolioPage = lazy(routeLoaders.portofolio);
const PortofolioDetailPage = lazy(routeLoaders.portofolioDetail);
const BeritaPage = lazy(routeLoaders.berita);
const BeritaDetailPage = lazy(routeLoaders.beritaDetail);
const TipsInteriorPage = lazy(routeLoaders.tipsInterior);
const TipsInteriorDetailPage = lazy(routeLoaders.tipsInteriorDetail);
const FaqPage = lazy(routeLoaders.faq);
const TentangPage = lazy(routeLoaders.tentang);
const PencarianPage = lazy(routeLoaders.pencarian);
const PesananPage = lazy(routeLoaders.pesanan);
const KebijakanPrivasiPage = lazy(routeLoaders.kebijakanPrivasi);
const SyaratKetentuanPage = lazy(routeLoaders.syaratKetentuan);
const KeamananKepatuhanPage = lazy(routeLoaders.keamananKepatuhan);
const PengaturanPage = lazy(routeLoaders.pengaturan);
const NotFoundPage = lazy(routeLoaders.notFound);

const AdminLoginPage = lazy(() => import('../pages/admin/login/index'));
const AdminRoutes = lazy(() => import('../pages/admin/admin-routes'));

function LegacyBeritaRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={slug ? `/berita/${slug}` : '/berita'} replace />;
}

function LegacyKatalogDetailRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={slug ? `/produk/${encodeURIComponent(slug)}` : '/produk'} replace />;
}

function LegacyProfilRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/pengaturan${search}#akun`} replace />;
}

function ManifestContextSync() {
  const location = useLocation();

  useLayoutEffect(() => {
    syncDocumentPwaManifest(location.pathname);
    syncDocumentFavicon();
    syncDocumentTabTitle(location.pathname);
  }, [location.pathname]);

  return null;
}

export function AppRouter() {
  useEffect(() => {
    scheduleIdleRoutePrefetch();
  }, []);

  return (
    <Suspense fallback={<RouteLoadingFallback fullViewport />}>
      <ManifestContextSync />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<BerandaPage />} />
          <Route path="produk" element={<KatalogPage />} />
          <Route path="produk/custom" element={<CustomInteriorPage />} />
          <Route path="produk/:slug" element={<KatalogDetailPage />} />
          <Route path="katalog" element={<Navigate to="/produk" replace />} />
          <Route path="katalog/custom" element={<Navigate to="/produk/custom" replace />} />
          <Route path="katalog/:slug" element={<LegacyKatalogDetailRedirect />} />
          <Route path="custom-interior" element={<Navigate to="/produk/custom" replace />} />
          <Route path="portofolio" element={<PortofolioPage />} />
          <Route path="portofolio/:slug" element={<PortofolioDetailPage />} />
          <Route path="berita" element={<BeritaPage />} />
          <Route path="berita/:slug" element={<BeritaDetailPage />} />
          <Route path="tips-interior" element={<TipsInteriorPage />} />
          <Route path="tips-interior/:id" element={<TipsInteriorDetailPage />} />
          <Route path="faq" element={<FaqPage />} />
          <Route path="informasi" element={<Navigate to="/berita" replace />} />
          <Route path="informasi/berita/:slug" element={<LegacyBeritaRedirect />} />
          <Route path="tentang" element={<TentangPage />} />
          <Route path="pencarian" element={<PencarianPage />} />
          <Route path="cari" element={<Navigate to="/pencarian" replace />} />
          <Route path="search" element={<Navigate to="/pencarian" replace />} />
          <Route path="pesanan" element={<PesananPage />} />
          <Route path="keranjang" element={<Navigate to="/pesanan" replace />} />
          <Route path="kebijakan-privasi" element={<KebijakanPrivasiPage />} />
          <Route path="privacy" element={<Navigate to="/kebijakan-privasi" replace />} />
          <Route path="privacy-policy" element={<Navigate to="/kebijakan-privasi" replace />} />
          <Route path="syarat-ketentuan" element={<SyaratKetentuanPage />} />
          <Route path="terms" element={<Navigate to="/syarat-ketentuan" replace />} />
          <Route path="terms-of-service" element={<Navigate to="/syarat-ketentuan" replace />} />
          <Route path="keamanan-kepatuhan" element={<KeamananKepatuhanPage />} />
          <Route path="security" element={<Navigate to="/keamanan-kepatuhan" replace />} />
          <Route path="kebijakan-cookie" element={<Navigate to="/keamanan-kepatuhan" replace />} />
          <Route path="pengaturan" element={<PengaturanPage />} />
          <Route path="settings" element={<Navigate to="/pengaturan" replace />} />
          <Route path="profil" element={<LegacyProfilRedirect />} />
          <Route path="akun" element={<LegacyProfilRedirect />} />
          <Route path="profile" element={<LegacyProfilRedirect />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="admin/login" element={<AdminLoginPage />} />
        <Route path="admin/*" element={<AdminRoutes />} />
      </Routes>
    </Suspense>
  );
}
