import type { ReactNode } from 'react';

// Force dynamic rendering for all settings routes
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SettingsLayoutProps {
  children: ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return <>{children}</>;
}
