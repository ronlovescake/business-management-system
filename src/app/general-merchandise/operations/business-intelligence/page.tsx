import dynamic from 'next/dynamic';
import { PageLayout } from '@/components/layout/PageLayout';
import { Center, Loader } from '@mantine/core';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

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
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/operations/business-intelligence'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <PageLayout title="Business Intelligence">
        <BiDashboard apiBasePath="/api/general-merchandise" />
      </PageLayout>
    </PermissionGuard>
  );
}
