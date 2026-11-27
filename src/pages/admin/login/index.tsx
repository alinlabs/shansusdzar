import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  Eye,
  EyeOff,
} from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Button } from '../../../components/ui/button';
import { FormField, Input } from '../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import { readAdminCredentialsCookie } from '../../../lib/admin-auth-cookie';
import { evaluateAdminBypassAttempt } from '../../../lib/admin-bypass';
import { useCachedMediaSrc } from '../../../lib/media-cache';
import {
  ADMIN_PENDING_ROUTE_STORAGE_KEY,
  sanitizeAdminReturnRoute,
} from '../../../lib/pull-to-refresh-logic';
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
    alamat: address,
  } = businessConfig;

  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const users = useAdminAuthStore((state) => state.users);
  const login = useAdminAuthStore((state) => state.login);
  const logout = useAdminAuthStore((state) => state.logout);

  const darkLogoSrc = useCachedMediaSrc('/logo-white.webp') ?? '/logo-white.webp';
  const showcaseImageSrc =
    useCachedMediaSrc('/images/atelier-studio-craft.webp') ?? '/images/atelier-studio-craft.webp';

  useDocumentTitle(`Masuk Panel Admin | ${brandName}`, undefined, {
    robots: 'noindex, nofollow',
  });

  const savedCredentials = useMemo(() => readAdminCredentialsCookie(), []);
  const bypassErrorFromState =
    (location.state as { bypassError?: string } | null)?.bypassError ?? null;

  const [authMode, setAuthMode] = useState<'login' | 'forgot-email' | 'forgot-otp'>('login');
  const [email, setEmail] = useState(() => savedCredentials?.email ?? '');
  const [password, setPassword] = useState(() => savedCredentials?.password ?? '');
  const [showPassword, setShowPassword] = useState(false);
  const [otpDigits, setOtpDigits] = useState<[string, string, string, string]>(['', '', '', '']);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => bypassErrorFromState);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const activeUser = users.find((u) => u.id === sessionUserId) ?? null;
  const bypassAttempt = useMemo(
    () =>
      evaluateAdminBypassAttempt(users, {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      }),
    [users, location.pathname, location.search, location.hash]
  );

  useEffect(() => {
    if (bypassErrorFromState) {
      setErrorMessage(bypassErrorFromState);
    }
  }, [bypassErrorFromState]);

  useLayoutEffect(() => {
    if (!bypassAttempt.active) return;

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(ADMIN_PENDING_ROUTE_STORAGE_KEY);
      } catch {
        // Ignore storage restrictions
      }
    }

    if (bypassAttempt.ok) {
      if (activeUser?.id !== bypassAttempt.user.id) {
        login(bypassAttempt.user.email, bypassAttempt.user.kataSandi);
      }
      navigate(sanitizeAdminReturnRoute(bypassAttempt.cleanTargetPath), { replace: true });
      return;
    }

    if (activeUser) {
      logout();
    }
    setErrorMessage(bypassAttempt.message);
    navigate('/admin/login', {
      replace: true,
      state: { bypassError: bypassAttempt.message },
    });
  }, [bypassAttempt, activeUser, login, logout, navigate]);

  const storedPendingRoute = (() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.sessionStorage.getItem(ADMIN_PENDING_ROUTE_STORAGE_KEY);
    } catch {
      return null;
    }
  })();
  const targetPath = sanitizeAdminReturnRoute(
    (location.state as { from?: string } | null)?.from ?? storedPendingRoute
  );

  if (bypassAttempt.active) {
    return null;
  }

  if (activeUser) {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(ADMIN_PENDING_ROUTE_STORAGE_KEY);
      } catch {
        // Ignore storage restrictions
      }
    }
    return <Navigate to={targetPath} replace />;
  }

  const handleOpenForgotPassword = () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setOtpDigits(['', '', '', '']);
    setAuthMode('forgot-email');
  };

  const handleBackToLogin = () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setOtpDigits(['', '', '', '']);
    setAuthMode('login');
  };

  const handleOtpChange = (index: number, rawValue: string) => {
    const cleaned = rawValue.replace(/\D/g, '');
    setErrorMessage(null);
    setInfoMessage(null);

    if (cleaned.length > 1) {
      const next: [string, string, string, string] = [...otpDigits] as [
        string,
        string,
        string,
        string,
      ];
      for (let i = 0; i < 4; i += 1) {
        if (cleaned[i]) {
          next[i] = cleaned[i];
        }
      }
      setOtpDigits(next);
      const focusIndex = Math.min(cleaned.length, 3);
      otpInputRefs.current[focusIndex]?.focus();
      return;
    }

    const digit = cleaned.slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev] as [string, string, string, string];
      next[index] = digit;
      return next;
    });

    if (digit && index < 3) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      otpInputRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < 3) {
      event.preventDefault();
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;
    event.preventDefault();
    const next: [string, string, string, string] = [
      pasted[0] ?? '',
      pasted[1] ?? '',
      pasted[2] ?? '',
      pasted[3] ?? '',
    ];
    setOtpDigits(next);
    setErrorMessage(null);
    setInfoMessage(null);
    const focusIndex = Math.min(pasted.length, 3);
    otpInputRefs.current[focusIndex]?.focus();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (authMode === 'forgot-email') {
      setOtpDigits(['', '', '', '']);
      setAuthMode('forgot-otp');
      window.requestAnimationFrame(() => {
        otpInputRefs.current[0]?.focus();
      });
      return;
    }

    if (authMode === 'forgot-otp') {
      const code = otpDigits.join('');
      if (code.length < 4) {
        setErrorMessage('Masukkan 4 digit kode OTP.');
        return;
      }
      setInfoMessage('Pratinjau UI OTP siap. Fungsi verifikasi belum dihubungkan.');
      return;
    }

    const res = login(email, password);
    if (!res.ok) {
      setErrorMessage(res.message ?? 'Gagal masuk ke panel admin.');
      return;
    }
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(ADMIN_PENDING_ROUTE_STORAGE_KEY);
      } catch {
        // Ignore storage restrictions
      }
    }
    navigate(targetPath, { replace: true });
  };

  const submitButtonContent =
    authMode === 'forgot-email' ? (
      <span>Kirim OTP</span>
    ) : authMode === 'forgot-otp' ? (
      <span>Verifikasi OTP</span>
    ) : (
      <>
        <GoogleAuthIcon />
        <span>Masuk</span>
      </>
    );

  return (
    <div className="h-screen supports-[height:100dvh]:h-dvh overflow-hidden w-full grid grid-cols-1 lg:grid-cols-12 bg-[var(--bg)] text-[var(--text)]">
      <aside
        aria-label={`Identitas ${brandName}`}
        className="hidden lg:flex lg:col-span-6 xl:col-span-7 relative overflow-hidden bg-[#191816] text-[#f2f0ec] flex-col justify-between p-10 xl:p-14"
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

        <div className="relative z-10 flex items-center justify-start gap-4">
          <span className="text-xs text-white/75 whitespace-nowrap">
            Workshop &amp; Interior Custom · {address.kabupaten}
          </span>
        </div>

        <div className="relative z-10 max-w-xl my-auto py-10">
          <div className="flex flex-col items-start gap-4">
            <div className="size-16 xl:size-20 rounded-[var(--radius-lg)] border border-white/15 bg-black/35 backdrop-blur-xs p-2.5 flex items-center justify-center shrink-0">
              <img
                src={darkLogoSrc}
                alt={`Logo ${brandName}`}
                className="size-full object-contain select-none"
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <p className="text-2xl xl:text-3xl font-semibold tracking-tight text-white leading-tight">
                {brandName}
              </p>
              <h2 className="text-base xl:text-lg font-medium text-white/85 leading-snug">
                Interior Design &amp; Building
              </h2>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-white/70">
          <p className="leading-relaxed">{address.alamatLengkap}</p>
        </div>
      </aside>

        <div className="lg:col-span-6 xl:col-span-5 flex flex-col h-full min-h-0 overflow-hidden bg-[var(--bg)]">
          <main className="app-scroll-region relative flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain">
            {/* Mobile 4:3 Hero Image Backdrop with Smooth Gradient */}
            <div
              aria-hidden="true"
              className="pointer-events-none lg:hidden absolute inset-x-0 top-0 w-full aspect-[4/3] overflow-hidden bg-[var(--bg)]"
            >
              <img
                src={showcaseImageSrc}
                alt=""
                referrerPolicy="no-referrer"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
                className="size-full object-cover"
              />
              <div className="absolute -inset-x-px -bottom-px h-[75%] bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/90 to-transparent" />
            </div>

            <div className="relative z-10 w-full max-w-md mx-auto mt-auto mb-0 lg:my-auto pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[max(8.5rem,env(safe-area-inset-top))] pb-14 lg:py-8 sm:px-8 lg:px-10 space-y-5 lg:space-y-6">
              <h1
                id="admin-login-heading"
                className="text-2xl lg:text-3xl font-semibold tracking-tight text-[var(--text)] leading-tight text-center"
              >
                Masuk Panel Admin
              </h1>

            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-surface)] text-xs font-medium text-[var(--danger)]"
              >
                {errorMessage}
              </div>
            )}

            {infoMessage && (
              <div
                role="status"
                aria-live="polite"
                className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] text-xs font-medium text-[var(--text)]"
              >
                {infoMessage}
              </div>
            )}

            <form
              id="admin-login-form"
              aria-label="Formulir masuk panel admin"
              onSubmit={handleSubmit}
              className="p-0 lg:p-7 lg:rounded-[var(--radius-lg)] lg:border lg:border-[var(--border)] lg:border-t-2 lg:border-t-[var(--form-card-line)] lg:bg-[var(--surface)] lg:shadow-[var(--shadow-sm)] space-y-4"
            >
              <FormField
                id="admin-email"
                label="Email Pengelola"
                required
                labelAction={
                  authMode !== 'login' ? (
                    <button
                      type="button"
                      data-testid="back-to-login-button"
                      onClick={handleBackToLogin}
                      className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                    >
                      Kembali ke masuk
                    </button>
                  ) : undefined
                }
              >
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  readOnly={authMode === 'forgot-otp'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin1@shansusdzar.com"
                />
              </FormField>

              {authMode === 'login' && (
                <div className="space-y-1.5">
                  <FormField
                    id="admin-password"
                    label="Kata Sandi"
                    required
                    labelAction={
                      <button
                        type="button"
                        data-testid="forgot-password-button"
                        onClick={handleOpenForgotPassword}
                        className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                      >
                        Lupa kata sandi?
                      </button>
                    }
                  >
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
                </div>
              )}

              {authMode === 'forgot-otp' && (
                <div data-testid="otp-verification-section" className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="admin-otp-0"
                      className="block text-sm font-medium text-[var(--text)]"
                    >
                      Kode OTP
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setInfoMessage(null);
                        setAuthMode('forgot-email');
                      }}
                      className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                    >
                      Ganti email
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {otpDigits.map((digit, index) => (
                      <Input
                        key={index}
                        ref={(el) => {
                          otpInputRefs.current[index] = el;
                        }}
                        id={`admin-otp-${index}`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        aria-label={`Digit OTP ${index + 1}`}
                        data-testid={`otp-input-${index}`}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onPaste={handleOtpPaste}
                        className="h-12 px-0 text-center text-lg font-semibold tabular-nums"
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                    <span>Masukkan 4 digit kode OTP.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpDigits(['', '', '', '']);
                        setErrorMessage(null);
                        setInfoMessage('Kode OTP dikirim ulang (pratinjau UI).');
                        otpInputRefs.current[0]?.focus();
                      }}
                      className="font-medium text-[var(--text)] hover:underline cursor-pointer shrink-0"
                    >
                      Kirim ulang
                    </button>
                  </div>
                </div>
              )}

              <div className="hidden lg:block pt-2">
                <Button
                  type="submit"
                  variant="secondary"
                  size="lg"
                  fullWidth
                  data-testid="desktop-login-submit"
                  className="border-[var(--border-strong)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-muted)] font-semibold shadow-[var(--shadow-sm)] gap-2.5"
                >
                  {submitButtonContent}
                </Button>
              </div>
            </form>

            <div className="hidden lg:flex justify-center">
              <Link
                to="/"
                data-testid="desktop-back-to-home"
                className="inline-flex items-center justify-center py-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] no-underline transition-colors"
              >
                Kembali Ke Beranda
              </Link>
            </div>
          </div>
        </main>

        {/* Mobile Bottom Navigation dedicated to Login Action */}
        <nav
          aria-label="Aksi masuk seluler"
          className="lg:hidden shrink-0 bg-transparent pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-3"
        >
          <Button
            type="submit"
            form="admin-login-form"
            variant="secondary"
            size="lg"
            fullWidth
            data-testid="mobile-login-bottom-submit"
            className="!bg-white !text-[#18181b] hover:!bg-[#f4f4f5] !border !border-[#d4d4d8] dark:!border-transparent font-semibold shadow-[var(--shadow-sm)] gap-2.5"
          >
            {submitButtonContent}
          </Button>

          <Link
            to="/"
            data-testid="mobile-back-to-home"
            className="inline-flex items-center justify-center py-0.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] no-underline transition-colors"
          >
            Kembali Ke Beranda
          </Link>
        </nav>

        <footer className="hidden lg:block shrink-0 px-8 lg:px-10 pb-10 xl:pb-14 text-center">
          <p data-testid="desktop-login-copyright" className="text-xs text-[var(--text-muted)]">
            © {new Date().getFullYear()} {brandName}
          </p>
        </footer>
      </div>
    </div>
  );
}
