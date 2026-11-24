import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router';
import { MotionConfig } from 'motion/react';
import { FloatingScrollbarOverlay } from '../components/layout/floating-scrollbar';
import { ThemeProvider } from '../components/layout/theme-provider';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          {children}
          <FloatingScrollbarOverlay />
        </BrowserRouter>
      </MotionConfig>
    </ThemeProvider>
  );
}
