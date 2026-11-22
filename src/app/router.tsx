import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router';
import { AppShell } from '../components/layout/app-shell';
import { RouteLoadingFallback } from '../components/ui/route-loading-fallback';
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
const AdminKatalogCustomPage = lazy(() => import('../pages/admin/katalog/custom/index'));
const AdminSkemaPembayaranPage = lazy(
  () => import('../pages/admin/katalog/skema-pembayaran/index')
);

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

const AdminTentangPage = lazy(() => import('../pages/admin/tentang/perusahaan/index'));
const AdminTimPage = lazy(() => import('../pages/admin/tentang/tim/index'));
const AdminTimMemberFormPage = lazy(() => import('../pages/admin/tentang/tim/form'));
const AdminBerandaPage = lazy(() => import('../pages/admin/tentang/beranda/index'));
const AdminOperasionalPage = lazy(() => import('../pages/admin/tentang/operasional/index'));
const AdminOperasionalFormPage = lazy(() => import('../pages/admin/tentang/operasional/form'));

const AdminSeoPage = lazy(() => import('../pages/admin/seo/index'));

const AdminSpkPage = lazy(() => import('../pages/admin/dokumen/spk/index'));
const AdminSpkFormPage = lazy(() => import('../pages/admin/dokumen/spk/form'));
const AdminSpksPage = lazy(() => import('../pages/admin/dokumen/spks/index'));
const AdminSpksFormPage = lazy(() => import('../pages/admin/dokumen/spks/form'));
const AdminSpksPreviewPage = lazy(() => import('../pages/admin/dokumen/spks/preview'));
const AdminBastPage = lazy(() => import('../pages/admin/dokumen/bast/index'));
const AdminBastFormPage = lazy(() => import('../pages/admin/dokumen/bast/form'));
const AdminBastPreviewPage = lazy(() => import('../pages/admin/dokumen/bast/preview'));
const AdminInvoicePage = lazy(() => import('../pages/admin/dokumen/invoice/index'));
const AdminInvoiceFormPage = lazy(() => import('../pages/admin/dokumen/invoice/form'));
const AdminInvoicePaymentFormPage = lazy(() => import('../pages/admin/dokumen/invoice/payment-form'));

const AdminProyekPage = lazy(() => import('../pages/admin/keuangan/proyek/index'));
const AdminPembelianPage = lazy(() => import('../pages/admin/keuangan/pembelian/index'));
const AdminPembelianFormPage = lazy(() => import('../pages/admin/keuangan/pembelian/form'));
const AdminArusKasPage = lazy(() => import('../pages/admin/keuangan/arus-kas/index'));
const AdminBukuKasPage = lazy(() => import('../pages/admin/keuangan/buku-kas/index'));
const AdminBukuKasFormPage = lazy(() => import('../pages/admin/keuangan/buku-kas/form'));

const AdminAksesPenggunaPage = lazy(() => import('../pages/admin/akses/pengguna/index'));
const AdminAksesPenggunaFormPage = lazy(() => import('../pages/admin/akses/pengguna/form'));
const AdminAksesPeranPage = lazy(() => import('../pages/admin/akses/peran/index'));
const AdminAksesPeranFormPage = lazy(() => import('../pages/admin/akses/peran/form'));
const AdminAksesCadanganPage = lazy(() => import('../pages/admin/akses/cadangan/index'));

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

function LegacyAdminKebijakanEditRedirect() {
  const { id } = useParams<{ id: string }>();
  return (
    <Navigate
      to={
        id
          ? `/admin/tentang/operasional/kebijakan/${id}/edit`
          : '/admin/tentang/operasional'
      }
      replace
    />
  );
}

export function AppRouter() {
  useEffect(() => {
    scheduleIdleRoutePrefetch();
  }, []);

  return (
    <Suspense fallback={<RouteLoadingFallback fullViewport />}>
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
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="admin/login" element={<AdminLoginPage />} />
        <Route path="admin" element={<AdminShell />}>
          <Route
            index
            element={
              <RequireAdminPermission permission="dashboard.view">
                <AdminDashboardPage />
              </RequireAdminPermission>
            }
          />
          <Route path="dashboard" element={<Navigate to="/admin" replace />} />

          {/* Produk & Custom Interior */}
          <Route
            path="produk"
            element={
              <RequireAdminPermission permission={['katalog.view', 'katalog.edit']}>
                <AdminKatalogPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="produk/baru"
            element={
              <RequireAdminPermission permission="katalog.edit">
                <AdminKatalogFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="produk/:id/edit"
            element={
              <RequireAdminPermission permission={['katalog.view', 'katalog.edit']}>
                <AdminKatalogFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="produk/custom"
            element={
              <RequireAdminPermission permission={['katalog.view', 'katalog.edit']}>
                <AdminKatalogCustomPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="produk/skema-pembayaran"
            element={
              <RequireAdminPermission
                permission={[
                  'katalog.view',
                  'katalog.edit',
                  'keuangan.view',
                  'keuangan.edit',
                  'tentang.view',
                  'tentang.edit',
                ]}
              >
                <AdminSkemaPembayaranPage />
              </RequireAdminPermission>
            }
          />
          <Route path="katalog" element={<Navigate to="/admin/produk" replace />} />
          <Route path="katalog/baru" element={<Navigate to="/admin/produk/baru" replace />} />
          <Route path="katalog/:id/edit" element={<LegacyAdminProdukEditRedirect />} />
          <Route path="katalog/custom" element={<Navigate to="/admin/produk/custom" replace />} />

          {/* Portofolio (Proyek & Ulasan) */}
          <Route
            path="portofolio"
            element={
              <RequireAdminPermission permission={['portofolio.view', 'portofolio.edit']}>
                <AdminPortofolioPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="portofolio/baru"
            element={
              <RequireAdminPermission permission="portofolio.edit">
                <AdminPortofolioFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="portofolio/:id/edit"
            element={
              <RequireAdminPermission permission={['portofolio.view', 'portofolio.edit']}>
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
              <RequireAdminPermission permission={['marketing.view', 'marketing.edit']}>
                <AdminMarketingDatabasePage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/database/baru"
            element={
              <RequireAdminPermission permission="marketing.edit">
                <AdminMarketingDatabaseFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/database/:id/edit"
            element={
              <RequireAdminPermission permission={['marketing.view', 'marketing.edit']}>
                <AdminMarketingDatabaseFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/campaign"
            element={
              <RequireAdminPermission permission={['marketing.view', 'marketing.edit']}>
                <AdminMarketingCampaignPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/campaign/baru"
            element={
              <RequireAdminPermission permission="marketing.edit">
                <AdminMarketingCampaignFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/campaign/:id/edit"
            element={
              <RequireAdminPermission permission={['marketing.view', 'marketing.edit']}>
                <AdminMarketingCampaignFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/campaign/:id/kirim"
            element={
              <RequireAdminPermission permission={['marketing.view', 'marketing.edit']}>
                <AdminMarketingCampaignSendPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/content-plan"
            element={
              <RequireAdminPermission
                permission={['marketing.view', 'marketing.edit', 'tentang.view', 'tentang.edit', 'bisnis.edit']}
              >
                <AdminSosmedPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/content-plan/baru"
            element={
              <RequireAdminPermission permission={['marketing.edit', 'tentang.edit', 'bisnis.edit']}>
                <AdminSosmedFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="marketing/content-plan/:id/edit"
            element={
              <RequireAdminPermission
                permission={['marketing.view', 'marketing.edit', 'tentang.view', 'tentang.edit', 'bisnis.edit']}
              >
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
              <RequireAdminPermission permission={['informasi.view', 'informasi.edit']}>
                <AdminBeritaPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="informasi/berita/baru"
            element={
              <RequireAdminPermission permission="informasi.edit">
                <AdminBeritaFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="informasi/berita/:id/edit"
            element={
              <RequireAdminPermission permission={['informasi.view', 'informasi.edit']}>
                <AdminBeritaFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="informasi/operasional"
            element={<Navigate to="/admin/tentang/operasional" replace />}
          />
          <Route
            path="informasi/operasional/kebijakan/baru"
            element={<Navigate to="/admin/tentang/operasional/kebijakan/baru" replace />}
          />
          <Route
            path="informasi/operasional/kebijakan/:id/edit"
            element={<LegacyAdminKebijakanEditRedirect />}
          />
          <Route
            path="informasi/material"
            element={
              <RequireAdminPermission permission={['informasi.view', 'informasi.edit']}>
                <AdminMaterialPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="informasi/material/baru"
            element={
              <RequireAdminPermission permission="informasi.edit">
                <AdminMaterialFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="informasi/material/:id/edit"
            element={
              <RequireAdminPermission permission={['informasi.view', 'informasi.edit']}>
                <AdminMaterialFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="informasi/faq"
            element={
              <RequireAdminPermission permission={['informasi.view', 'informasi.edit']}>
                <AdminFaqPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="informasi/faq/baru"
            element={
              <RequireAdminPermission permission="informasi.edit">
                <AdminFaqFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="informasi/faq/:id/edit"
            element={
              <RequireAdminPermission permission={['informasi.view', 'informasi.edit']}>
                <AdminFaqFormPage />
              </RequireAdminPermission>
            }
          />

          {/* Tentang & Situs */}
          <Route
            path="tentang"
            element={
              <RequireAdminPermission permission={['tentang.view', 'tentang.edit', 'bisnis.edit']}>
                <AdminTentangPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="tentang/tim"
            element={
              <RequireAdminPermission permission={['tentang.view', 'tentang.edit', 'bisnis.edit']}>
                <AdminTimPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="tentang/tim/anggota/baru"
            element={
              <RequireAdminPermission permission="tentang.edit">
                <AdminTimMemberFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="tentang/tim/anggota/:id/edit"
            element={
              <RequireAdminPermission permission={['tentang.view', 'tentang.edit']}>
                <AdminTimMemberFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="tentang/beranda"
            element={
              <RequireAdminPermission permission={['tentang.view', 'tentang.edit', 'bisnis.edit']}>
                <AdminBerandaPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="tentang/ulasan"
            element={<Navigate to="/admin/portofolio" replace />}
          />
          <Route
            path="tentang/ulasan/baru"
            element={<Navigate to="/admin/portofolio" replace />}
          />
          <Route path="tentang/ulasan/:id/edit" element={<Navigate to="/admin/portofolio" replace />} />
          <Route
            path="tentang/operasional"
            element={
              <RequireAdminPermission
                permission={['tentang.view', 'tentang.edit', 'bisnis.edit', 'informasi.view', 'informasi.edit']}
              >
                <AdminOperasionalPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="tentang/operasional/kebijakan/baru"
            element={
              <RequireAdminPermission permission={['tentang.edit', 'informasi.edit']}>
                <AdminOperasionalFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="tentang/operasional/kebijakan/:id/edit"
            element={
              <RequireAdminPermission
                permission={['tentang.view', 'tentang.edit', 'informasi.view', 'informasi.edit']}
              >
                <AdminOperasionalFormPage />
              </RequireAdminPermission>
            }
          />
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
              <RequireAdminPermission permission={['tentang.view', 'tentang.edit', 'bisnis.edit']}>
                <AdminSeoPage />
              </RequireAdminPermission>
            }
          />

          {/* Dokumen Resmi */}
          <Route path="dokumen" element={<Navigate to="/admin/dokumen/spk" replace />} />
          <Route
            path="dokumen/spk"
            element={
              <RequireAdminPermission permission={['keuangan.view', 'keuangan.edit']}>
                <AdminSpkPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="dokumen/spk/baru"
            element={
              <RequireAdminPermission permission="keuangan.edit">
                <AdminSpkFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="dokumen/spk/:id/edit"
            element={
              <RequireAdminPermission permission={['keuangan.view', 'keuangan.edit']}>
                <AdminSpkFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="dokumen/spks"
            element={
              <RequireAdminPermission permission={['keuangan.view', 'keuangan.edit']}>
                <AdminSpksPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="dokumen/spks/baru"
            element={
              <RequireAdminPermission permission="keuangan.edit">
                <AdminSpksFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="dokumen/spks/:id/edit"
            element={
              <RequireAdminPermission permission={['keuangan.view', 'keuangan.edit']}>
                <AdminSpksFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="dokumen/spks/:id/pratinjau"
            element={
              <RequireAdminPermission permission={['keuangan.view', 'keuangan.edit']}>
                <AdminSpksPreviewPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="dokumen/bast"
            element={
              <RequireAdminPermission permission={['keuangan.view', 'keuangan.edit']}>
                <AdminBastPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="dokumen/bast/baru"
            element={
              <RequireAdminPermission permission="keuangan.edit">
                <AdminBastFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="dokumen/bast/:id/edit"
            element={
              <RequireAdminPermission permission={['keuangan.view', 'keuangan.edit']}>
                <AdminBastFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="dokumen/bast/:id/pratinjau"
            element={
              <RequireAdminPermission permission={['keuangan.view', 'keuangan.edit']}>
                <AdminBastPreviewPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="dokumen/invoice"
            element={
              <RequireAdminPermission permission={['keuangan.view', 'keuangan.edit']}>
                <AdminInvoicePage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="dokumen/invoice/baru"
            element={
              <RequireAdminPermission permission="keuangan.edit">
                <AdminInvoiceFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="dokumen/invoice/:id/edit"
            element={
              <RequireAdminPermission permission={['keuangan.view', 'keuangan.edit']}>
                <AdminInvoiceFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="dokumen/invoice/:id/pembayaran"
            element={
              <RequireAdminPermission permission="keuangan.edit">
                <AdminInvoicePaymentFormPage />
              </RequireAdminPermission>
            }
          />

          {/* Keuangan */}
          <Route
            path="keuangan"
            element={
              <RequireAdminPermission permission={['keuangan.view', 'keuangan.edit']}>
                <AdminProyekPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="keuangan/pembelian"
            element={
              <RequireAdminPermission permission={['keuangan.view', 'keuangan.edit']}>
                <AdminPembelianPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="keuangan/pembelian/baru"
            element={
              <RequireAdminPermission permission="keuangan.edit">
                <AdminPembelianFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="keuangan/pembelian/:id/edit"
            element={
              <RequireAdminPermission permission={['keuangan.view', 'keuangan.edit']}>
                <AdminPembelianFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="keuangan/arus-kas"
            element={
              <RequireAdminPermission permission={['keuangan.view', 'keuangan.edit']}>
                <AdminArusKasPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="keuangan/buku-kas"
            element={
              <RequireAdminPermission permission={['keuangan.view', 'keuangan.edit']}>
                <AdminBukuKasPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="keuangan/buku-kas/baru"
            element={
              <RequireAdminPermission permission="keuangan.edit">
                <AdminBukuKasFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="keuangan/buku-kas/:id/edit"
            element={
              <RequireAdminPermission permission={['keuangan.view', 'keuangan.edit']}>
                <AdminBukuKasFormPage />
              </RequireAdminPermission>
            }
          />

          {/* Hak Akses */}
          <Route
            path="akses"
            element={
              <RequireAdminPermission permission={['akses.view', 'akses.manage']}>
                <AdminAksesPenggunaPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="akses/pengguna/baru"
            element={
              <RequireAdminPermission permission="akses.manage">
                <AdminAksesPenggunaFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="akses/pengguna/:id/edit"
            element={
              <RequireAdminPermission permission={['akses.view', 'akses.manage']}>
                <AdminAksesPenggunaFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="akses/peran"
            element={
              <RequireAdminPermission permission={['akses.view', 'akses.manage']}>
                <AdminAksesPeranPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="akses/peran/baru"
            element={
              <RequireAdminPermission permission="akses.manage">
                <AdminAksesPeranFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="akses/peran/:id/edit"
            element={
              <RequireAdminPermission permission={['akses.view', 'akses.manage']}>
                <AdminAksesPeranFormPage />
              </RequireAdminPermission>
            }
          />
          <Route
            path="akses/cadangan"
            element={
              <RequireAdminPermission permission={['akses.view', 'akses.manage']}>
                <AdminAksesCadanganPage />
              </RequireAdminPermission>
            }
          />

          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
