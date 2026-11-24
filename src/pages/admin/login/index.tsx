import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Button } from '../../../components/ui/button';
import { FormField, Input } from '../../../components/ui/form-controls';
import { ThemeToggle } from '../../../components/layout/theme-provider';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import { useCachedMediaSrc } from '../../../lib/media-cache';
import { useAdminAuthStore } from '../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../store/site-content-store';

function GoogleAuthIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
    >
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const {
    namaMerek: brandName,
    namaMerekSingkat: shortBrandName,
    drafSlogan: taglineDraft,
    alamat: address,
  } = businessConfig;

  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const users = useAdminAuthStore((state) => state.users);
  const login = useAdminAuthStore((state) => state.login);

  const lightLogoSrc = useCachedMediaSrc('/logo-gelap.webp') ?? '/logo-gelap.webp';
  const darkLogoSrc = useCachedMediaSrc('/logo-white.webp') ?? '/logo-white.webp';
  const showcaseImageSrc =
    useCachedMediaSrc('/images/atelier-studio-craft.webp') ?? '/images/atelier-studio-craft.webp';

  useDocumentTitle(`Masuk Panel Admin | ${shortBrandName}`, undefined, {
    robots: 'noindex, nofollow',
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeUser = users.find((u) => u.id === sessionUserId && u.status === 'aktif');
  const targetPath =
    (location.state as { from?: string } | null)?.from &&
    (location.state as { from?: string }).from !== '/admin/login'
      ? (location.state as { from: string }).from
      : '/admin';

  if (activeUser) {
    return <Navigate to={targetPath} replace />;
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    const res = login(email, password);
    if (!res.ok) {
      setErrorMessage(res.message ?? 'Gagal masuk ke panel admin.');
      return;
    }
    navigate(targetPath, { replace: true });
  };

  return (
    <div className="h-screen supports-[height:100dvh]:h-dvh overflow-hidden w-full grid grid-cols-1 lg:grid-cols-12 bg-[var(--bg)] text-[var(--text)]">
      <aside
        aria-label={`Identitas ${brandName}`}
        className="hidden lg:flex lg:col-span-6 xl:col-span-7 relative overflow-hidden bg-[#191816] text-[#f2f0ec] flex-col justify-between p-10 xl:p-14 border-r border-[var(--border)]"
      >
        <img
          src={showcaseImageSrc}
          alt="Suasana pengerjaan furniture dan interior custom Shansus Dzar Indonesia"
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
          className="pointer-events-none absolute inset-0 size-full object-cover opacity-55"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#141311] via-[#141311]/75 to-[#141311]/50"
        />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[var(--radius-md)] border border-white/20 bg-black/30 backdrop-blur-xs text-xs font-medium text-white hover:bg-black/45 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Kembali ke Situs Publik</span>
          </Link>

          <span className="text-xs text-white/75 whitespace-nowrap">
            Workshop &amp; Interior Custom · {address.kabupaten}
          </span>
        </div>

        <div className="relative z-10 max-w-xl space-y-6 my-auto py-10">
          <div className="flex items-center gap-4">
            <div className="size-16 xl:size-20 rounded-[var(--radius-lg)] border border-white/15 bg-black/35 backdrop-blur-xs p-2.5 flex items-center justify-center shrink-0">
              <img
                src={darkLogoSrc}
                alt={`Logo ${brandName}`}
                className="size-full object-contain select-none"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium tracking-wide text-white/75">
                Portal Administrasi &amp; Operasional
              </p>
              <p className="text-2xl xl:text-3xl font-semibold tracking-tight text-white leading-tight">
                {shortBrandName}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-white/15">
            <h2 className="text-lg xl:text-xl font-medium text-white/95 leading-snug">
              Interior Design &amp; Building
            </h2>
            <p className="text-sm text-white/80 leading-relaxed">{taglineDraft}</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70">
            <span>Statistik &amp; Kunjungan</span>
            <span aria-hidden="true">·</span>
            <span>Katalog &amp; Portofolio</span>
            <span aria-hidden="true">·</span>
            <span>Arus Kas &amp; Termin</span>
            <span aria-hidden="true">·</span>
            <span>Manajemen Akses Internal</span>
          </div>
        </div>

        <div className="relative z-10 pt-5 border-t border-white/15 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 text-xs text-white/70">
          <p className="leading-relaxed">{address.alamatLengkap}</p>
          <p className="whitespace-nowrap shrink-0">
            © {new Date().getFullYear()} {shortBrandName}
          </p>
        </div>
      </aside>

      <div className="lg:col-span-6 xl:col-span-5 flex flex-col h-full min-h-0 overflow-hidden bg-[var(--bg)]">
        <header className="shrink-0 pt-[env(safe-area-inset-top)] border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="h-16 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-8 lg:px-10 flex items-center justify-between gap-3">
            <div className="flex lg:hidden items-center gap-0.5 min-w-0">
              <Link
                to="/"
                aria-label="Kembali ke beranda"
                title="Kembali ke beranda"
                className="inline-flex items-center justify-start w-6 h-10 -ml-0.5 bg-transparent border-0 shadow-none rounded-none text-[var(--text)] hover:text-[var(--text-muted)] transition-colors duration-150 shrink-0"
              >
                <ChevronLeft className="size-5 shrink-0" aria-hidden="true" />
              </Link>

              <Link to="/" className="inline-flex items-center gap-1.5 min-w-0 text-[var(--text)]">
                <img
                  src={lightLogoSrc}
                  alt=""
                  aria-hidden="true"
                  className="size-7 shrink-0 object-contain dark:hidden"
                />
                <img
                  src={darkLogoSrc}
                  alt=""
                  aria-hidden="true"
                  className="hidden size-7 shrink-0 object-contain dark:block"
                />
                <span className="flex flex-col min-w-0 leading-tight">
                  <span className="text-[13px] font-bold tracking-tight truncate">
                    {shortBrandName}
                  </span>
                  <span className="text-[10px] font-light text-[var(--text-muted)] truncate">
                    Panel Admin
                  </span>
                </span>
              </Link>
            </div>

            <div className="hidden lg:flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <ShieldCheck className="size-4 text-[var(--success)] shrink-0" aria-hidden="true" />
              <span>Sesi Terproteksi · Akses Internal</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <ThemeToggle variant="plain" />
            </div>
          </div>
        </header>

        <main className="app-scroll-region flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain">
          {/* Mobile Hero Banner with Beranda-style Gradient */}
          <section
            aria-label="Banner masuk pengelola"
            className="lg:hidden relative w-full aspect-[16/10] sm:aspect-[16/8] shrink-0 overflow-hidden bg-[var(--bg)]"
          >
            <img
              src={showcaseImageSrc}
              alt="Suasana pengerjaan workshop Shansus Dzar Indonesia"
              referrerPolicy="no-referrer"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
              className="pointer-events-none absolute inset-0 size-full object-cover"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-px -bottom-px h-[55%] bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/80 to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-l from-transparent via-[var(--bg)]/60 to-[var(--bg)]/95"
            />

            <div className="relative z-10 h-full flex flex-col justify-end pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-5 pt-6">
              <div className="max-w-sm space-y-1.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]">
                  <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>Masuk Pengelola · {shortBrandName}</span>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] leading-tight">
                  Masuk Panel Admin
                </h1>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Kelola katalog, portofolio, konten informasi, dan laporan studio.
                </p>
              </div>
            </div>
          </section>

          <div className="w-full max-w-md mx-auto lg:my-auto pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-2 pb-6 lg:py-8 sm:px-8 lg:px-10 space-y-5 lg:space-y-6">
            <div className="hidden lg:block space-y-2">
              <div className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Masuk Pengelola · {shortBrandName}</span>
              </div>
              <h1
                id="admin-login-heading"
                className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text)] leading-tight"
              >
                Masuk Panel Admin
              </h1>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Gunakan akun staf terdaftar untuk mengelola katalog, portofolio, konten informasi,
                dan laporan keuangan studio.
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-surface)] text-xs font-medium text-[var(--danger)]"
              >
                {errorMessage}
              </div>
            )}

            <form
              id="admin-login-form"
              aria-label="Formulir masuk panel admin"
              onSubmit={handleSubmit}
              className="p-0 lg:p-7 lg:rounded-[var(--radius-lg)] lg:border lg:border-[var(--border)] lg:bg-[var(--surface)] lg:shadow-[var(--shadow-sm)] space-y-4"
            >
              <FormField id="admin-email" label="Email Pengelola" required>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@shansusdzar.id"
                />
              </FormField>

              <FormField id="admin-password" label="Kata Sandi" required>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="pr-11"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-9 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </FormField>

              <div className="hidden lg:block pt-2">
                <Button
                  type="submit"
                  variant="secondary"
                  size="lg"
                  fullWidth
                  data-testid="desktop-login-submit"
                  className="border-[var(--border-strong)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-muted)] font-semibold shadow-[var(--shadow-sm)] gap-2.5"
                >
                  <GoogleAuthIcon />
                  <span>Masuk</span>
                </Button>
              </div>
            </form>
          </div>
        </main>

        {/* Mobile Bottom Navigation dedicated to Login Action */}
        <nav
          aria-label="Aksi masuk seluler"
          className="lg:hidden shrink-0 border-t border-[var(--border)] bg-[var(--surface)] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <Button
            type="submit"
            form="admin-login-form"
            variant="secondary"
            size="lg"
            fullWidth
            data-testid="mobile-login-bottom-submit"
            className="border-[var(--border-strong)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-muted)] font-semibold shadow-[var(--shadow-sm)] gap-2.5"
          >
            <GoogleAuthIcon />
            <span>Masuk</span>
          </Button>
        </nav>
      </div>
    </div>
  );
}
