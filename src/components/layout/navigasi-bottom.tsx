import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { BookOpen, Briefcase, Home, Info, LayoutGrid } from 'lucide-react';
import { usePublicPreferencesStore } from '../../store/public-preferences-store';
import { Container } from './container';
import { InformasiBottomSheet, isInformasiRouteActive } from './informasi-menu-popup';

function MobileNavItem({
  to,
  label,
  end,
  icon: Icon,
  showLabel,
}: {
  to: string;
  label: string;
  end: boolean;
  icon: typeof Home;
  showLabel: boolean;
}) {
  const isCenterCatalog = to === '/produk';

  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      className={({ isActive }) =>
        [
          'relative h-full w-full flex flex-col items-center gap-1 px-1 transition-colors duration-150',
          isCenterCatalog
            ? showLabel
              ? 'justify-end pb-3'
              : 'justify-center pb-1.5'
            : 'justify-center',
          isActive
            ? 'text-[var(--text)] font-semibold'
            : 'text-[var(--text-muted)] font-normal hover:text-[var(--text)]',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {isCenterCatalog ? (
            <span
              className={[
                showLabel ? '-mt-6' : '-mt-3',
                'size-12 rounded-full flex items-center justify-center shrink-0 transition-transform duration-150',
                'bg-[var(--accent)] text-[var(--accent-contrast)] dark:bg-[#5C4B3E] dark:text-white',
                'ring-4 ring-[var(--surface)] shadow-[var(--shadow-md)]',
                isActive ? 'scale-[1.03]' : '',
              ].join(' ')}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
            </span>
          ) : (
            <Icon className={showLabel ? 'size-4 shrink-0' : 'size-5 shrink-0'} aria-hidden="true" />
          )}
          {showLabel && (
            <span className="text-[10px] tracking-tight leading-none whitespace-nowrap">{label}</span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function NavigasiBottom() {
  const location = useLocation();
  const [isInfoMenuOpen, setIsInfoMenuOpen] = useState(false);
  const showBottomNav = usePublicPreferencesStore((state) => state.navigation.showBottomNav);
  const showBottomNavLabels = usePublicPreferencesStore(
    (state) => state.navigation.showBottomNavLabels
  );
  const infoActive = isInformasiRouteActive(location.pathname);

  useEffect(() => {
    setIsInfoMenuOpen(false);
  }, [location.pathname, showBottomNav]);

  if (!showBottomNav) return null;

  return (
    <>
      <InformasiBottomSheet
        isOpen={isInfoMenuOpen}
        currentPathname={location.pathname}
        onSelectItem={() => setIsInfoMenuOpen(false)}
        onClose={() => setIsInfoMenuOpen(false)}
      />

      <nav
        aria-label="Navigasi utama seluler"
        className="md:hidden shrink-0 relative z-40 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] print:hidden"
      >
        <Container>
          <ul className={['grid grid-cols-5', showBottomNavLabels ? 'h-15' : 'h-13'].join(' ')}>
            <li className="h-full">
              <MobileNavItem to="/" label="Beranda" end icon={Home} showLabel={showBottomNavLabels} />
            </li>
            <li className="h-full">
              <MobileNavItem
                to="/portofolio"
                label="Portofolio"
                end={false}
                icon={Briefcase}
                showLabel={showBottomNavLabels}
              />
            </li>
            <li className="h-full">
              <MobileNavItem
                to="/produk"
                label="Produk"
                end={false}
                icon={LayoutGrid}
                showLabel={showBottomNavLabels}
              />
            </li>
            <li className="h-full">
              <button
                type="button"
                aria-label="Informasi"
                aria-haspopup="dialog"
                aria-expanded={isInfoMenuOpen}
                onClick={() => setIsInfoMenuOpen((prev) => !prev)}
                className={[
                  'relative h-full w-full flex flex-col items-center justify-center gap-1 px-1 transition-colors duration-150 cursor-pointer',
                  infoActive || isInfoMenuOpen
                    ? 'text-[var(--text)] font-semibold'
                    : 'text-[var(--text-muted)] font-normal hover:text-[var(--text)]',
                ].join(' ')}
              >
                <BookOpen
                  className={showBottomNavLabels ? 'size-4 shrink-0' : 'size-5 shrink-0'}
                  aria-hidden="true"
                />
                {showBottomNavLabels && (
                  <span className="text-[10px] tracking-tight leading-none whitespace-nowrap">
                    Informasi
                  </span>
                )}
              </button>
            </li>
            <li className="h-full">
              <MobileNavItem
                to="/tentang"
                label="Tentang"
                end={false}
                icon={Info}
                showLabel={showBottomNavLabels}
              />
            </li>
          </ul>
        </Container>
      </nav>
    </>
  );
}
