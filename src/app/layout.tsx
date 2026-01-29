import type { Metadata } from 'next';
import './globals.css';
import { AppLayout } from '../components/layout/AppLayout';
import { ReactQueryProvider } from '../lib/query-client';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PerformanceMonitor } from '../components/PerformanceMonitor';
import { AuthProvider } from '../components/auth/AuthProvider';
import { GlobalMessageNotifications } from '../components/GlobalMessageNotifications';

// Initialize module registry
import '@/modules';

export const metadata: Metadata = {
  title: 'Business Management System',
  description: 'Czarlie & Ron Business Management Application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <AuthProvider>
            <ReactQueryProvider>
              <AppLayout>{children}</AppLayout>
              <GlobalMessageNotifications />
            </ReactQueryProvider>
          </AuthProvider>
        </ErrorBoundary>
        {/* Portal for Glide Data Grid overlay editor */}
        <div id="portal" />
        {/* Performance monitoring */}
        <PerformanceMonitor />
      </body>
    </html>
  );
}
