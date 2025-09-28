import { PageLayout } from '../../../../components/layout/PageLayout';
import { DataGrid } from '../../../../components/ui';
import { Stack, Text } from '@mantine/core';

export default function BusinessIntelligence() {
  return (
    <PageLayout title="Business Intelligence">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Data visualization and analytics will be implemented here
        </Text>
        
        {/* Example empty data grid - ready for real data integration */}
        <DataGrid 
          title="Analytics Data" 
          height={300}
        />
      </Stack>
    </PageLayout>
  );
}
