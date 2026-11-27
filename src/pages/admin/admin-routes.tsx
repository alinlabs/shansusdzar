import { lazy } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router';
import { AdminShell, RequireAdminPermission } from './admin-shell';

const AdminDashboardPage = lazy(() => import('./dashboard/index'));

const AdminKatalogPage = lazy(() => import('./katalog/produk/index'));
const AdminKatalogFormPage = lazy(() => import('./katalog/produk/form'));

const AdminPortofolioPage = lazy(() => import('./portofolio/proyek/index'));
const AdminPortofolioFormPage = lazy(() => import('./portofolio/proyek/form'));

const AdminMarketingDatabasePage = lazy(() => import('./marketing/database/index'));
const AdminMarketingDatabaseFormPage = lazy(() => import('./marketing/database/form'));
const AdminMarketingCampaignPage = lazy(() => import('./marketing/campaign/index'));
const AdminMarketingCampaignFormPage = lazy(() => import('./marketing/campaign/form'));
const AdminMarketingCampaignSendPage = lazy(() => import('./marketing/campaign/send'));
const AdminSosmedPage = lazy(() => import('./marketing/content-plan/index'));
const AdminSosmedFormPage = lazy(() => import('./marketing/content-plan/form'));

const AdminBeritaPage = lazy(() => import('./informasi/berita/index'));
const AdminBeritaFormPage = lazy(() => import('./informasi/berita/form'));
const AdminMaterialPage = lazy(() => import('./informasi/material/index'));
const AdminMaterialFormPage = lazy(() => import('./informasi/material/form'));
const AdminFaqPage = lazy(() => import('./informasi/faq/index'));
const AdminFaqFormPage = lazy(() => import('./informasi/faq/form'));

const AdminProfilUsahaPage = lazy(() => import('./tentang/index'));

const AdminSeoPage = lazy(() => import('./seo/index'));

const AdminPenawaranFormPage = lazy(() => import('./dokumen/penawaran/form'));
const AdminSuratJalanFormPage = lazy(() => import('./dokumen/surat-jalan/form'));
const AdminBastFormPage = lazy(() => import('./dokumen/bast/form'));
const AdminInvoiceFormPage = lazy(() => import('./dokumen/invoice/form'));
const AdminInvoicePaymentFormPage = lazy(() => import('./dokumen/invoice/payment-form'));

const AdminBukuKasFormPage = lazy(() => import('./keuangan/buku-kas/form'));
const AdminKeuanganUmumPage = lazy(() => import('./keuangan/index'));

const AdminProyekDirectoryPage = lazy(() => import('./proyek/index'));
const AdminProyekFormPage = lazy(() => import('./proyek/form'));
const AdminProyekDetailPage = lazy(() => import('./proyek/detail'));

const AdminAksesPenggunaPage = lazy(() => import('./akses/pengguna/index'));
const AdminAksesPenggunaFormPage = lazy(() => import('./akses/pengguna/form'));

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
  return (
    <Navigate
      to={id ? `/admin/informasi/berita/${id}/edit` : '/admin/informasi/berita'}
      replace
    />
  );
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

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminShell />}>
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

        {/* Profil Usaha */}
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

        {/* SEO & Visibilitas */}
        <Route
          path="seo"
          element={
            <RequireAdminPermission page="profil-usaha" minLevel="view">
              <AdminSeoPage />
            </RequireAdminPermission>
          }
        />

        {/* Proyek */}
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

        {/* Keuangan Umum */}
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

        {/* Redirect rute lama */}
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
        <Route path="akses/peran/*" element={<Navigate to="/admin/akses" replace />} />
        <Route path="akses/cadangan" element={<Navigate to="/admin/akses" replace />} />

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
