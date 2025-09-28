import { PageLayout } from '../../../../components/layout/PageLayout';
import { DataGrid } from '../../../../components/ui';
import { Stack, Text } from '@mantine/core';

export default function Inventory() {
  return (
    <PageLayout title="Inventory">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Inventory management system will be implemented here
        </Text>
        
        {/* Example empty data grid for inventory items */}
        <DataGrid 
          title="Inventory Items" 
          height={500}
        />
      </Stack>
    </PageLayout>
  );
}
