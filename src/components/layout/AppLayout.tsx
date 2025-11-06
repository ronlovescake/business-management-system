'use client';

import { AppShell, MantineProvider, createTheme } from '@mantine/core';
import type { MantineColorsTuple } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import Sidebar from '../navigation/Sidebar';
import BreadcrumbNavigation from '../navigation/BreadcrumbNavigation';
import HeaderQuickActions from '../navigation/HeaderQuickActions';
import {
  GridAdapterProvider,
  GridLayoutProvider,
  glideGridAdapter,
} from '../grid';

interface AppLayoutProps {
  children: React.ReactNode;
}

const primaryColor: MantineColorsTuple = [
  '#eff6ff',
  '#dbeafe',
  '#bfdbfe',
  '#93c5fd',
  '#60a5fa',
  '#3b82f6',
  '#2563eb',
  '#1d4ed8',
  '#1e40af',
  '#1e3a8a',
];

const theme = createTheme({
  primaryColor: 'blue',
  colors: {
    blue: primaryColor,
  },
  fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  headings: {
    fontFamily:
      'Roboto, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    fontWeight: '600',
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
  shadows: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
});

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <MantineProvider theme={theme}>
      <ModalsProvider>
        <GridAdapterProvider adapter={glideGridAdapter}>
          <GridLayoutProvider>
            {/* Skip navigation link for accessibility */}
            <a
              href="#main-content"
              style={{
                position: 'absolute',
                left: '-9999px',
                zIndex: 9999,
                padding: '1rem',
                backgroundColor: '#2563eb',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontWeight: 600,
              }}
              onFocus={(e) => {
                e.currentTarget.style.left = '1rem';
                e.currentTarget.style.top = '1rem';
              }}
              onBlur={(e) => {
                e.currentTarget.style.left = '-9999px';
              }}
            >
              Skip to main content
            </a>
            <Notifications />
            <AppShell
              navbar={{ width: 280, breakpoint: 'sm' }}
              header={{ height: 80 }}
              padding="md"
              style={{
                '--mantine-color-body': 'var(--background)',
                background: 'url(/backgrounds/orange-waves.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundAttachment: 'fixed',
                minHeight: '100vh',
              }}
            >
              <AppShell.Header
                style={{
                  border: 'none',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                }}
              >
                <div
                  style={{
                    padding: '1rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: '100%',
                    gap: '1.5rem',
                  }}
                >
                  <BreadcrumbNavigation />
                  <HeaderQuickActions />
                </div>
              </AppShell.Header>

              <AppShell.Navbar
                p="lg"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRight: 'none',
                  boxShadow: '4px 0 16px rgba(0, 0, 0, 0.1)',
                }}
              >
                <Sidebar />
              </AppShell.Navbar>

              <AppShell.Main
                id="main-content"
                style={{
                  backgroundColor: 'transparent',
                  minHeight: '100vh',
                }}
              >
                {children}
              </AppShell.Main>
            </AppShell>
          </GridLayoutProvider>
        </GridAdapterProvider>
      </ModalsProvider>
    </MantineProvider>
  );
}

export default AppLayout;
