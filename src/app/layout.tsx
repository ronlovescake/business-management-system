import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppLayout } from '../components/layout/AppLayout';
import { ReactQueryProvider } from '../lib/query-client';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Initialize module registry
import '@/modules';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={inter.className}>
        <ErrorBoundary>
          <ReactQueryProvider>
            <AppLayout>{children}</AppLayout>
          </ReactQueryProvider>
        </ErrorBoundary>
        {/* Portal for Glide Data Grid overlay editor */}
        <div id="portal" />
      </body>
    </html>
  );
}
