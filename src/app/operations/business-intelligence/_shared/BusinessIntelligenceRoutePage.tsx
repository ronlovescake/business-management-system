import dynamic from 'next/dynamic';
import { PageLayout } from '@/components/layout/PageLayout';
import { Center, Loader } from '@mantine/core';

type BusinessIntelligenceRoutePageProps = {
  apiBasePath?: string;
};

const BiDashboard = dynamic(
  () =>
    import(
      '@/app/clothing/operations/business-intelligence/components/BiDashboard'
    ).then((mod) => ({ default: mod.BiDashboard })),
  {
    ssr: false,
    loading: () => (
      <Center py="xl">
        <Loader size="md" color="blue" />
      </Center>
    ),
  }
);

export function BusinessIntelligenceRoutePage(
  props: BusinessIntelligenceRoutePageProps
) {
  const { apiBasePath } = props;

  return (
    <PageLayout title="Business Intelligence">
      <BiDashboard apiBasePath={apiBasePath} />
    </PageLayout>
  );
}
