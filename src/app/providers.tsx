import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router';
import { FloatingScrollbarOverlay } from '../components/layout/floating-scrollbar';
import { ThemeProvider } from '../components/layout/theme-provider';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <BrowserRouter>
        {children}
        <FloatingScrollbarOverlay />
      </BrowserRouter>
    </ThemeProvider>
  );
}
