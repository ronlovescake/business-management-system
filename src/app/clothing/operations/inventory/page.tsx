import { PageLayout } from '../../../../components/layout/PageLayout';
import { Stack, Text } from '@mantine/core';

export default function Inventory() {
  return (
    <PageLayout title="Inventory">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Inventory management system will be implemented here
        </Text>

        {/* TODO: Implement inventory data grid */}
      </Stack>
    </PageLayout>
  );
}
