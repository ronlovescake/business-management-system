import dynamic from 'next/dynamic';
import { PageLayout } from '@/components/layout/PageLayout';
import { Center, Loader } from '@mantine/core';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

// Lazy load BiDashboard to reduce initial bundle size (heavy recharts dependency)
const BiDashboard = dynamic(
  () =>
    import(
      '@/app/clothing/operations/business-intelligence/components/BiDashboard'
    ).then((mod) => ({
      default: mod.BiDashboard,
    })),
  {
    ssr: false,
    loading: () => (
      <Center h={400}>
        <Loader size="lg" />
      </Center>
    ),
  }
);

export default async function BusinessIntelligencePage() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/business-intelligence',
    <PageLayout title="Business Intelligence">
      <BiDashboard apiBasePath="/api/general-merchandise" />
    </PageLayout>
  );
}
