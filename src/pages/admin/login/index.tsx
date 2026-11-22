import { useState, type FormEvent } from 'react';
import { ArrowLeft, ChevronDown, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Button } from '../../../components/ui/button';
import { FormField, Input } from '../../../components/ui/form-controls';
import { ThemeToggle } from '../../../components/layout/theme-provider';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import { useCachedMediaSrc } from '../../../lib/media-cache';
import { useAdminAuthStore } from '../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../store/site-content-store';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const { namaMerek: brandName, namaMerekSingkat: shortBrandName, drafSlogan: taglineDraft, alamat: address } = businessConfig;

  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const login = useAdminAuthStore((state) => state.login);
  const loginAsDemoUser = useAdminAuthStore((state) => state.loginAsDemoUser);

  const lightLogoSrc = useCachedMediaSrc('/logo-gelap.webp') ?? '/logo-gelap.webp';
  const darkLogoSrc = useCachedMediaSrc('/logo-white.webp') ?? '/logo-white.webp';
  const showcaseImageSrc =
    useCachedMediaSrc('/images/atelier-studio-craft.webp') ?? '/images/atelier-studio-craft.webp';

  useDocumentTitle(`Masuk Panel Admin | ${shortBrandName}`, undefined, {
    robots: 'noindex, nofollow',
  });

  const [email, setEmail] = useState('admin@shansusdzar.id');
  const [password, setPassword] = useState('sdi-admin-2026');
  const [showPassword, setShowPassword] = useState(false);
  const [showQuickAccess, setShowQuickAccess] = useState(false);
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

  const handleQuickLogin = (userId: string) => {
    setErrorMessage(null);
    const res = loginAsDemoUser(userId);
    if (!res.ok) {
      setErrorMessage(res.message ?? 'Gagal masuk dengan akun terpilih.');
      return;
    }
    navigate(targetPath, { replace: true });
  };

  return (
    <div className="min-h-dvh w-full grid grid-cols-1 lg:grid-cols-12 bg-[var(--bg)] text-[var(--text)]">
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
            <span>Kontrol Akses RBAC</span>
          </div>
        </div>

        <div className="relative z-10 pt-5 border-t border-white/15 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 text-xs text-white/70">
          <p className="leading-relaxed">{address.alamatLengkap}</p>
          <p className="whitespace-nowrap shrink-0">
            © {new Date().getFullYear()} {shortBrandName}
          </p>
        </div>
      </aside>

      <div className="lg:col-span-6 xl:col-span-5 flex flex-col min-h-dvh bg-[var(--surface)] lg:bg-[var(--bg)]">
        <header className="h-16 shrink-0 px-5 sm:px-8 lg:px-10 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between gap-4">
          <Link
            to="/"
            className="lg:hidden inline-flex items-center gap-2.5 min-w-0 text-[var(--text)]"
          >
            <img
              src={lightLogoSrc}
              alt=""
              aria-hidden="true"
              className="size-8 shrink-0 object-contain dark:hidden"
            />
            <img
              src={darkLogoSrc}
              alt=""
              aria-hidden="true"
              className="hidden size-8 shrink-0 object-contain dark:block"
            />
            <span className="flex flex-col min-w-0 leading-tight">
              <span className="text-sm font-bold tracking-tight truncate">{shortBrandName}</span>
              <span className="text-[11px] text-[var(--text-muted)] truncate">Panel Admin</span>
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <ShieldCheck className="size-4 text-[var(--success)] shrink-0" aria-hidden="true" />
            <span>Sesi Terproteksi · Akses Internal</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/"
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] whitespace-nowrap"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Beranda
            </Link>
            <ThemeToggle variant="plain" />
          </div>
        </header>

        <main className="app-scroll-region flex-1 flex flex-col px-5 py-8 sm:px-8 lg:px-10 xl:px-14 overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-md mx-auto my-auto space-y-6">
            <div className="space-y-2">
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
              aria-labelledby="admin-login-heading"
              onSubmit={handleSubmit}
              className="p-6 sm:p-7 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)] space-y-4"
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

              <div className="pt-1">
                <Button type="submit" variant="primary" size="lg" fullWidth>
                  Masuk ke Dashboard
                </Button>
              </div>

              <p className="text-xs text-[var(--text-subtle)] leading-relaxed pt-3 border-t border-[var(--border)]">
                Kredensial default Super Admin:{' '}
                <span className="font-mono text-[var(--text)]">admin@shansusdzar.id</span> /{' '}
                <span className="font-mono text-[var(--text)]">sdi-admin-2026</span>
              </p>
            </form>

            <div className="border border-[var(--border)] rounded-[var(--radius-lg)] bg-[var(--surface)] overflow-hidden">
              <button
                type="button"
                aria-expanded={showQuickAccess}
                onClick={() => setShowQuickAccess((prev) => !prev)}
                className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[var(--surface-muted)]/60 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <KeyRound className="size-4 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-[var(--text)]">
                      Masuk Cepat Berdasarkan Peran (RBAC)
                    </span>
                    <span className="block text-[11px] text-[var(--text-muted)] truncate">
                      Uji hak akses Super Admin, Editor, atau Staf Keuangan
                    </span>
                  </span>
                </span>
                <ChevronDown
                  className={[
                    'size-4 text-[var(--text-muted)] shrink-0 transition-transform duration-150',
                    showQuickAccess ? 'rotate-180' : '',
                  ].join(' ')}
                  aria-hidden="true"
                />
              </button>

              {showQuickAccess && (
                <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
                  {users.map((user) => {
                    const role = roles.find((r) => r.id === user.idPeran);
                    return (
                      <div
                        key={user.id}
                        className="px-5 py-3 flex items-center justify-between gap-3 bg-[var(--surface)] hover:bg-[var(--surface-elevated)] transition-colors"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-xs font-medium text-[var(--text)] truncate">
                            {user.nama}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)] truncate">
                            {role?.nama ?? 'Staf'} · {user.email}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={user.status !== 'aktif'}
                          onClick={() => handleQuickLogin(user.id)}
                          className="shrink-0 whitespace-nowrap"
                        >
                          {user.status === 'aktif' ? 'Masuk' : 'Nonaktif'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="shrink-0 px-5 sm:px-8 lg:px-10 py-4 border-t border-[var(--border)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          <span>Penyimpanan sesi lokal peramban</span>
          <div className="flex items-center gap-4">
            <Link to="/kebijakan-privasi" className="hover:text-[var(--text)] hover:underline whitespace-nowrap">
              Kebijakan Privasi
            </Link>
            <Link to="/keamanan-kepatuhan" className="hover:text-[var(--text)] hover:underline whitespace-nowrap">
              Keamanan
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
