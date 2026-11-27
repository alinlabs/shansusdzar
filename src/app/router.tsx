import { lazy, Suspense, useEffect, useLayoutEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router';
import { AppShell } from '../components/layout/app-shell';
import { RouteLoadingFallback } from '../components/ui/route-loading-fallback';
import { checkStandaloneMode } from '../hooks/use-app-install';
import {
  shouldReloadForManifestBoundary,
  syncDocumentPwaManifest,
} from '../lib/app-install';
import { routeLoaders, scheduleIdleRoutePrefetch } from '../lib/route-prefetch';
import BerandaPage from '../pages/beranda';
import { AdminShell, RequireAdminPermission } from '../pages/admin/admin-shell';

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
const AdminDashboardPage = lazy(() => import('../pages/admin/dashboard/index'));

const AdminKatalogPage = lazy(() => import('../pages/admin/katalog/produk/index'));
const AdminKatalogFormPage = lazy(() => import('../pages/admin/katalog/produk/form'));

const AdminPortofolioPage = lazy(() => import('../pages/admin/portofolio/proyek/index'));
const AdminPortofolioFormPage = lazy(() => import('../pages/admin/portofolio/proyek/form'));

const AdminMarketingDatabasePage = lazy(() => import('../pages/admin/marketing/database/index'));
const AdminMarketingDatabaseFormPage = lazy(() => import('../pages/admin/marketing/database/form'));
const AdminMarketingCampaignPage = lazy(() => import('../pages/admin/marketing/campaign/index'));
const AdminMarketingCampaignFormPage = lazy(() => import('../pages/admin/marketing/campaign/form'));
const AdminMarketingCampaignSendPage = lazy(() => import('../pages/admin/marketing/campaign/send'));
const AdminSosmedPage = lazy(() => import('../pages/admin/marketing/content-plan/index'));
const AdminSosmedFormPage = lazy(() => import('../pages/admin/marketing/content-plan/form'));

const AdminBeritaPage = lazy(() => import('../pages/admin/informasi/berita/index'));
const AdminBeritaFormPage = lazy(() => import('../pages/admin/informasi/berita/form'));
const AdminMaterialPage = lazy(() => import('../pages/admin/informasi/material/index'));
const AdminMaterialFormPage = lazy(() => import('../pages/admin/informasi/material/form'));
const AdminFaqPage = lazy(() => import('../pages/admin/informasi/faq/index'));
const AdminFaqFormPage = lazy(() => import('../pages/admin/informasi/faq/form'));

const AdminProfilUsahaPage = lazy(() => import('../pages/admin/tentang/index'));

const AdminSeoPage = lazy(() => import('../pages/admin/seo/index'));

const AdminPenawaranFormPage = lazy(() => import('../pages/admin/dokumen/penawaran/form'));
const AdminSuratJalanFormPage = lazy(() => import('../pages/admin/dokumen/surat-jalan/form'));
const AdminBastFormPage = lazy(() => import('../pages/admin/dokumen/bast/form'));
const AdminInvoiceFormPage = lazy(() => import('../pages/admin/dokumen/invoice/form'));
const AdminInvoicePaymentFormPage = lazy(() => import('../pages/admin/dokumen/invoice/payment-form'));

const AdminBukuKasFormPage = lazy(() => import('../pages/admin/keuangan/buku-kas/form'));
const AdminKeuanganUmumPage = lazy(() => import('../pages/admin/keuangan/index'));

const AdminProyekDirectoryPage = lazy(() => import('../pages/admin/proyek/index'));
const AdminProyekFormPage = lazy(() => import('../pages/admin/proyek/form'));
const AdminProyekDetailPage = lazy(() => import('../pages/admin/proyek/detail'));

const AdminAksesPenggunaPage = lazy(() => import('../pages/admin/akses/pengguna/index'));
const AdminAksesPenggunaFormPage = lazy(() => import('../pages/admin/akses/pengguna/form'));

function LegacyBeritaRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={slug ? `/berita/${slug}` : '/berita'} replace />;
}

function LegacyKatalogDetailRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={slug ? `/produk/${encodeURIComponent(slug)}` : '/produk'} replace />;
}

function LegacyAdminProdukEditRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/admin/produk/${id}/edit` : '/admin/produk'} replace />;
}

function LegacyAdminSosmedEditRedirect() {
  const { id } = useParams<{ id: string }>();
  return (
    <Navigate
      to={id ? `/admin/marketing/content-plan/${id}/edit` : '/admin/marketing/content-plan'}
      replace
    />
  );
}

function LegacyAdminArtikelEditRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/admin/informasi/berita/${id}/edit` : '/admin/informasi/berita'} replace />;
}

function LegacyProfilRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/pengaturan${search}#akun`} replace />;
}

function LegacyProjectDocumentRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <Navigate
      to={projectId ? `/admin/proyek/${projectId}?tab=dokumen` : '/admin/proyek'}
      replace
    />
  );
}

function LegacyProjectFinanceRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <Navigate
      to={projectId ? `/admin/proyek/${projectId}?tab=keuangan` : '/admin/proyek'}
      replace
    />
  );
}

function ManifestContextSync() {
  const location = useLocation();
  const isStandalone = checkStandaloneMode();
  const bootContext =
    typeof window !== 'undefined' ? window.__SHANSUSDZAR_BOOT_APP_CONTEXT__ : undefined;
  const needsBoundaryReload = shouldReloadForManifestBoundary({
    bootContext,
    pathname: location.pathname,
    isStandalone,
  });

  useLayoutEffect(() => {
    syncDocumentPwaManifest(location.pathname);
    if (needsBoundaryReload && typeof window !== 'undefined') {
      const nextUrl = `${location.pathname}${location.search}${location.hash}`;
      window.location.replace(nextUrl);
    }
  }, [location.pathname, location.search, location.hash, needsBoundaryReload]);

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
        <Route path="admin" element={<AdminShell />}>
          <Route
            index
            element={
              <RequireAdminPermission>
                <AdminDashboardPage />
              </RequireAdminPermission>
            }
          />
          <Route path="dashboard" element={<Navigate to="/admin" replace />} />

          {/* Produk & Skema Pembayaran */}
          <Route
            path="produk"
            element={
              <RequireAdminPermission page="produk" minLevel="view">
                <AdminKatalogPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="produk/baru"
            element={
              <RequireAdminPermission page="produk" minLevel="editor">
                <AdminKatalogFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="produk/:id/edit"
            element={
              <RequireAdminPermission page="produk" minLevel="view">
                <AdminKatalogFormPage />
              </RequireAdminPermission>
            }
          />
          <Route path="produk/:id" element={<LegacyAdminProdukEditRedirect />} />
          <Route path="produk/custom" element={<Navigate to="/admin/produk" replace />} />
          <Route
            path="skema-pembayaran"
            element={<Navigate to="/admin/keuangan?tab=skema" replace />}
          />
          <Route
            path="produk/skema-pembayaran"
            element={<Navigate to="/admin/keuangan?tab=skema" replace />}
          />
          <Route path="katalog" element={<Navigate to="/admin/produk" replace />} />
          <Route path="katalog/baru" element={<Navigate to="/admin/produk/baru" replace />} />
          <Route path="katalog/:id/edit" element={<LegacyAdminProdukEditRedirect />} />
          <Route path="katalog/custom" element={<Navigate to="/admin/produk" replace />} />

          {/* Portofolio (Proyek & Ulasan) */}
          <Route
            path="portofolio"
            element={
              <RequireAdminPermission page="portofolio" minLevel="view">
                <AdminPortofolioPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="portofolio/baru"
            element={
              <RequireAdminPermission page="portofolio" minLevel="editor">
                <AdminPortofolioFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="portofolio/:id/edit"
            element={
              <RequireAdminPermission page="portofolio" minLevel="view">
                <AdminPortofolioFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="portofolio/ulasan"
            element={<Navigate to="/admin/portofolio" replace />}
          />
          <Route
            path="portofolio/ulasan/baru"
            element={<Navigate to="/admin/portofolio" replace />}
          />
          <Route
            path="portofolio/ulasan/:id/edit"
            element={<Navigate to="/admin/portofolio" replace />}
          />

          {/* Legacy Sosial Media Redirects -> Marketing Content Plan / Informasi Berita */}
          <Route path="sosmed" element={<Navigate to="/admin/marketing/content-plan" replace />} />
          <Route
            path="sosmed/baru"
            element={<Navigate to="/admin/marketing/content-plan/baru" replace />}
          />
          <Route path="sosmed/:id/edit" element={<LegacyAdminSosmedEditRedirect />} />
          <Route path="sosmed/artikel" element={<Navigate to="/admin/informasi/berita" replace />} />
          <Route
            path="sosmed/artikel/baru"
            element={<Navigate to="/admin/informasi/berita/baru" replace />}
          />
          <Route path="sosmed/artikel/:id/edit" element={<LegacyAdminArtikelEditRedirect />} />

          {/* Marketing (Database, Campaign + Tools WA/Email & Content Plan) */}
          <Route
            path="marketing"
            element={<Navigate to="/admin/marketing/database" replace />}
          />
          <Route
            path="marketing/email"
            element={<Navigate to="/admin/marketing/campaign" replace />}
          />
          <Route
            path="marketing/database"
            element={
              <RequireAdminPermission page="profil-usaha" minLevel="view">
                <AdminMarketingDatabasePage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/database/baru"
            element={
              <RequireAdminPermission page="profil-usaha" minLevel="editor">
                <AdminMarketingDatabaseFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/database/:id/edit"
            element={
              <RequireAdminPermission page="profil-usaha" minLevel="view">
                <AdminMarketingDatabaseFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/campaign"
            element={
              <RequireAdminPermission page="profil-usaha" minLevel="view">
                <AdminMarketingCampaignPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/campaign/baru"
            element={
              <RequireAdminPermission page="profil-usaha" minLevel="editor">
                <AdminMarketingCampaignFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/campaign/:id/edit"
            element={
              <RequireAdminPermission page="profil-usaha" minLevel="view">
                <AdminMarketingCampaignFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/campaign/:id/kirim"
            element={
              <RequireAdminPermission page="profil-usaha" minLevel="view">
                <AdminMarketingCampaignSendPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/content-plan"
            element={
              <RequireAdminPermission page="profil-usaha" minLevel="view">
                <AdminSosmedPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/content-plan/baru"
            element={
              <RequireAdminPermission page="profil-usaha" minLevel="editor">
                <AdminSosmedFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/content-plan/:id/edit"
            element={
              <RequireAdminPermission page="profil-usaha" minLevel="view">
                <AdminSosmedFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/sosmed"
            element={<Navigate to="/admin/marketing/content-plan" replace />}
          />
          <Route
            path="marketing/sosmed/baru"
            element={<Navigate to="/admin/marketing/content-plan/baru" replace />}
          />
          <Route path="marketing/sosmed/:id/edit" element={<LegacyAdminSosmedEditRedirect />} />

          {/* Informasi & FAQ */}
          <Route
            path="informasi"
            element={<Navigate to="/admin/informasi/berita" replace />}
          />
          <Route path="informasi/baru" element={<Navigate to="/admin/informasi/berita/baru" replace />} />
          <Route path="informasi/:id/edit" element={<LegacyAdminArtikelEditRedirect />} />
          <Route
            path="informasi/berita"
            element={
              <RequireAdminPermission page="berita" minLevel="view">
                <AdminBeritaPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="informasi/berita/baru"
            element={
              <RequireAdminPermission page="berita" minLevel="editor">
                <AdminBeritaFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="informasi/berita/:id/edit"
            element={
              <RequireAdminPermission page="berita" minLevel="view">
                <AdminBeritaFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="informasi/operasional"
            element={<Navigate to="/admin/tentang" replace />}
          />
          <Route
            path="informasi/material"
            element={
              <RequireAdminPermission page="material" minLevel="view">
                <AdminMaterialPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="informasi/material/baru"
            element={
              <RequireAdminPermission page="material" minLevel="editor">
                <AdminMaterialFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="informasi/material/:id/edit"
            element={
              <RequireAdminPermission page="material" minLevel="view">
                <AdminMaterialFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="informasi/faq"
            element={
              <RequireAdminPermission page="faq" minLevel="view">
                <AdminFaqPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="informasi/faq/baru"
            element={
              <RequireAdminPermission page="faq" minLevel="editor">
                <AdminFaqFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="informasi/faq/:id/edit"
            element={
              <RequireAdminPermission page="faq" minLevel="view">
                <AdminFaqFormPage />
              </RequireAdminPermission>
            }
          />

          {/* Profil Usaha (Terpadu: Identitas, Narasi, Pemilik & Tim, Beranda, Operasional) */}
          <Route
            path="tentang"
            element={
              <RequireAdminPermission page="profil-usaha" minLevel="view">
                <AdminProfilUsahaPage />
              </RequireAdminPermission>
            }
          />
          <Route path="profil-usaha" element={<Navigate to="/admin/tentang" replace />} />
          <Route path="tentang/tim" element={<Navigate to="/admin/tentang" replace />} />
          <Route path="tentang/tim/*" element={<Navigate to="/admin/tentang" replace />} />
          <Route path="tentang/beranda" element={<Navigate to="/admin/tentang" replace />} />
          <Route
            path="tentang/ulasan"
            element={<Navigate to="/admin/portofolio" replace />}
          />
          <Route
            path="tentang/ulasan/baru"
            element={<Navigate to="/admin/portofolio" replace />}
          />
          <Route path="tentang/ulasan/:id/edit" element={<Navigate to="/admin/portofolio" replace />} />
          <Route path="tentang/operasional" element={<Navigate to="/admin/tentang" replace />} />
          <Route path="tentang/operasional/*" element={<Navigate to="/admin/tentang" replace />} />
          <Route path="tentang/bisnis" element={<Navigate to="/admin/tentang" replace />} />
          <Route path="tentang/seo" element={<Navigate to="/admin/seo" replace />} />
          <Route
            path="tentang/sosmed"
            element={<Navigate to="/admin/marketing/content-plan" replace />}
          />
          <Route
            path="tentang/sosmed/baru"
            element={<Navigate to="/admin/marketing/content-plan/baru" replace />}
          />
          <Route path="tentang/sosmed/:id/edit" element={<LegacyAdminSosmedEditRedirect />} />

          {/* SEO & Visibilitas (Top-Level Standalone Section) */}
          <Route
            path="seo"
            element={
              <RequireAdminPermission page="profil-usaha" minLevel="view">
                <AdminSeoPage />
              </RequireAdminPermission>
            }
          />

          {/* Proyek (Dokumen & Keuangan terpadu per proyek) */}
          <Route
            path="proyek"
            element={
              <RequireAdminPermission page="proyek" minLevel="view">
                <AdminProyekDirectoryPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="proyek/baru"
            element={
              <RequireAdminPermission page="proyek" minLevel="editor">
                <AdminProyekFormPage />
              </RequireAdminPermission>
            }
          />
          <Route path="proyek/kas" element={<Navigate to="/admin/keuangan" replace />} />
          <Route path="proyek/kas/*" element={<Navigate to="/admin/keuangan" replace />} />
          <Route
            path="proyek/:projectId"
            element={
              <RequireAdminPermission page="proyek" minLevel="view">
                <AdminProyekDetailPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="proyek/:projectId/edit"
            element={
              <RequireAdminPermission page="proyek" minLevel="view">
                <AdminProyekFormPage />
              </RequireAdminPermission>
            }
          />

          {/* Dokumen di dalam Proyek */}
          <Route
            path="proyek/:projectId/dokumen/penawaran/baru"
            element={
              <RequireAdminPermission page="proyek" minLevel="editor">
                <AdminPenawaranFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="proyek/:projectId/dokumen/penawaran/:id/edit"
            element={<LegacyProjectDocumentRedirect />}
          />
          <Route
            path="proyek/:projectId/dokumen/penawaran/:id/pratinjau"
            element={<LegacyProjectDocumentRedirect />}
          />
          <Route
            path="proyek/:projectId/dokumen/surat-jalan/baru"
            element={
              <RequireAdminPermission page="proyek" minLevel="editor">
                <AdminSuratJalanFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="proyek/:projectId/dokumen/surat-jalan/:id/edit"
            element={<LegacyProjectDocumentRedirect />}
          />
          <Route
            path="proyek/:projectId/dokumen/surat-jalan/:id/pratinjau"
            element={<LegacyProjectDocumentRedirect />}
          />
          <Route
            path="proyek/:projectId/dokumen/spks/*"
            element={<LegacyProjectDocumentRedirect />}
          />
          <Route
            path="proyek/:projectId/dokumen/spk/*"
            element={<LegacyProjectDocumentRedirect />}
          />
          <Route
            path="proyek/:projectId/dokumen/bast/baru"
            element={
              <RequireAdminPermission page="proyek" minLevel="editor">
                <AdminBastFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="proyek/:projectId/dokumen/bast/:id/edit"
            element={<LegacyProjectDocumentRedirect />}
          />
          <Route
            path="proyek/:projectId/dokumen/bast/:id/pratinjau"
            element={<LegacyProjectDocumentRedirect />}
          />
          <Route
            path="proyek/:projectId/dokumen/invoice/baru"
            element={
              <RequireAdminPermission page="proyek" minLevel="editor">
                <AdminInvoiceFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="proyek/:projectId/dokumen/invoice/:id/edit"
            element={<LegacyProjectDocumentRedirect />}
          />
          <Route
            path="proyek/:projectId/dokumen/invoice/:id/pratinjau"
            element={<LegacyProjectDocumentRedirect />}
          />
          <Route
            path="proyek/:projectId/dokumen/invoice/:id/pembayaran"
            element={
              <RequireAdminPermission page="proyek" minLevel="editor">
                <AdminInvoicePaymentFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="proyek/:projectId/dokumen/*"
            element={<LegacyProjectDocumentRedirect />}
          />

          {/* Keuangan di dalam Proyek */}
          <Route
            path="proyek/:projectId/keuangan/pembelian/baru"
            element={
              <RequireAdminPermission page="proyek" minLevel="editor">
                <AdminBukuKasFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="proyek/:projectId/keuangan/pembelian/:id/edit"
            element={
              <RequireAdminPermission page="proyek" minLevel="view">
                <AdminBukuKasFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="proyek/:projectId/keuangan/transaksi/baru"
            element={
              <RequireAdminPermission page="proyek" minLevel="editor">
                <AdminBukuKasFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="proyek/:projectId/keuangan/transaksi/:id/edit"
            element={
              <RequireAdminPermission page="proyek" minLevel="view">
                <AdminBukuKasFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="proyek/:projectId/keuangan/*"
            element={<LegacyProjectFinanceRedirect />}
          />

          {/* Keuangan Umum (Top-Level Standalone Section) */}
          <Route
            path="keuangan"
            element={
              <RequireAdminPermission page="keuangan" minLevel="view">
                <AdminKeuanganUmumPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="keuangan/baru"
            element={
              <RequireAdminPermission page="keuangan" minLevel="editor">
                <AdminBukuKasFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="keuangan/:id/edit"
            element={
              <RequireAdminPermission page="keuangan" minLevel="view">
                <AdminBukuKasFormPage />
              </RequireAdminPermission>
            }
          />

          {/* Redirect rute lama Dokumen & sub-rute Keuangan */}
          <Route path="dokumen" element={<Navigate to="/admin/proyek" replace />} />
          <Route path="dokumen/*" element={<Navigate to="/admin/proyek" replace />} />
          <Route path="keuangan/pembelian" element={<Navigate to="/admin/keuangan" replace />} />
          <Route path="keuangan/pembelian/*" element={<Navigate to="/admin/keuangan" replace />} />
          <Route path="keuangan/arus-kas" element={<Navigate to="/admin/keuangan" replace />} />
          <Route path="keuangan/buku-kas" element={<Navigate to="/admin/keuangan" replace />} />
          <Route path="keuangan/buku-kas/*" element={<Navigate to="/admin/keuangan" replace />} />

          {/* Hak Akses */}
          <Route
            path="akses"
            element={
              <RequireAdminPermission page="pengguna" minLevel="view">
                <AdminAksesPenggunaPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="akses/pengguna/baru"
            element={
              <RequireAdminPermission page="pengguna" minLevel="editor">
                <AdminAksesPenggunaFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="akses/pengguna/:id/edit"
            element={
              <RequireAdminPermission page="pengguna" minLevel="view">
                <AdminAksesPenggunaFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="akses/peran/*"
            element={<Navigate to="/admin/akses" replace />}
          />
          <Route
            path="akses/cadangan"
            element={<Navigate to="/admin/akses" replace />}
          />

          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
