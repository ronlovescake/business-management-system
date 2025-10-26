import { PageLayout } from '../../../../components/layout/PageLayout';
import { Stack, Text } from '@mantine/core';

export default function Inventory() {
  return (
    <PageLayout title="Inventory">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Inventory management system will be implemented here
        </Text>

        {/* FUTURE: Implement inventory data grid with stock tracking */}
        {/* Features: Product quantities, warehouse locations, reorder alerts */}
      </Stack>
    </PageLayout>
  );
}
