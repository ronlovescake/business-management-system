'use client';

import dynamic from 'next/dynamic';

// Dynamically import the client component with no SSR to avoid MantineProvider context issues during server rendering
const SettingsPageClient = dynamic(
  () =>
    import('./_components/SettingsPageClient').then(
      (mod) => mod.SettingsPageClient
    ),
  { ssr: false }
);

export default function SettingsPage() {
  return <SettingsPageClient />;
}
