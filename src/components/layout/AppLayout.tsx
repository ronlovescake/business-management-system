'use client';

import {
  AppShell,
  MantineProvider,
  createTheme,
  MantineColorsTuple,
} from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import Sidebar from '../navigation/Sidebar';
import BreadcrumbNavigation from '../navigation/BreadcrumbNavigation';
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
      <GridAdapterProvider adapter={glideGridAdapter}>
        <GridLayoutProvider>
          <Notifications />
          <AppShell
            navbar={{ width: 280, breakpoint: 'sm' }}
            header={{ height: 80 }}
            padding="md"
            style={{
              '--mantine-color-body': 'var(--background)',
            }}
          >
            <AppShell.Header
              style={{
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div
                style={{
                  padding: '1rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  height: '100%',
                }}
              >
                <BreadcrumbNavigation />
              </div>
            </AppShell.Header>

            <AppShell.Navbar
              p="lg"
              style={{
                backgroundColor: '#f8f9fa',
                border: 'none',
                borderRight: 'none',
              }}
            >
              <Sidebar />
            </AppShell.Navbar>

            <AppShell.Main
              style={{
                backgroundColor: '#f8f9fa',
                minHeight: '100vh',
              }}
            >
              {children}
            </AppShell.Main>
          </AppShell>
        </GridLayoutProvider>
      </GridAdapterProvider>
    </MantineProvider>
  );
}

export default AppLayout;
