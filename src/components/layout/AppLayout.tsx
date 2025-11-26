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
  '#eef2ff',
  '#e0e7ff',
  '#c7d2fe',
  '#a5b4fc',
  '#818cf8',
  '#6366f1',
  '#4f46e5',
  '#4338ca',
  '#3730a3',
  '#312e81',
];

const theme = createTheme({
  primaryColor: 'indigo',
  colors: {
    indigo: primaryColor,
  },
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  headings: {
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    fontWeight: '700',
  },
  radius: {
    xs: '6px',
    sm: '8px',
    md: '10px',
    lg: '16px',
    xl: '24px',
  },
  shadows: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  },
  defaultRadius: 'md',
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
                background: '#f1f5f9',
                minHeight: '100vh',
              }}
            >
              <AppShell.Header
                style={{
                  border: 'none',
                  backgroundColor: '#ffffff',
                  borderBottom: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
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
                  backgroundColor: '#ffffff',
                  border: 'none',
                  borderRight: '1px solid #e2e8f0',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
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
