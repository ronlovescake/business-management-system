'use client';

import { Paper, Stack, Tabs, Text } from '@mantine/core';
import { PageLayout } from '../../../../components/layout/PageLayout';

const TAB_ITEMS = [
  { value: 'all', label: 'All notifications' },
  { value: 'transactions', label: 'Transactions' },
  { value: 'products', label: 'Products' },
  { value: 'prices', label: 'Prices' },
  { value: 'shipments', label: 'Shipments' },
];

export default function OperationsNotifications() {
  return (
    <PageLayout size="100%" withPadding={false}>
      <Stack px={40} py="xl">
        <Paper
          withBorder
          radius="lg"
          shadow="md"
          p="xl"
          style={{
            width: '100%',
            maxWidth: 'min(1800px, 92vw)',
            margin: '0 auto',
            minHeight: '86vh',
          }}
        >
          <Tabs defaultValue="all" keepMounted={false}>
            <Tabs.List grow>
              {TAB_ITEMS.map((tab) => (
                <Tabs.Tab key={tab.value} value={tab.value}>
                  {tab.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            {TAB_ITEMS.map((tab) => (
              <Tabs.Panel key={tab.value} value={tab.value} pt="lg">
                <Stack align="center" gap="xs">
                  <Text fw={600}>{tab.label}</Text>
                  <Text size="sm" c="dimmed">
                    This section will surface {tab.label.toLowerCase()} soon.
                  </Text>
                </Stack>
              </Tabs.Panel>
            ))}
          </Tabs>
        </Paper>
      </Stack>
    </PageLayout>
  );
}
