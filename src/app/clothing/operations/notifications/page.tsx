'use client';

import { Paper, Stack, Tabs, Table, Text } from '@mantine/core';
import { PageLayout } from '../../../../components/layout/PageLayout';

const TAB_ITEMS = [
  { value: 'all', label: 'All notifications' },
  { value: 'transactions', label: 'Transactions' },
  { value: 'products', label: 'Products' },
  { value: 'prices', label: 'Prices' },
  { value: 'shipments', label: 'Shipments' },
];

const TABLE_HEADERS = ['Date', 'Time', 'User', 'Changes'];

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
            maxWidth: 'min(1800px, 98vw)',
            margin: '0 auto',
            minHeight: '90vh',
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
                <Stack gap="md">
                  <Table striped highlightOnHover withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        {TABLE_HEADERS.map((header) => (
                          <Table.Th
                            key={header}
                            style={{ textAlign: 'center' }}
                          >
                            {header}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Td colSpan={TABLE_HEADERS.length}>
                          <Text size="sm" c="dimmed" ta="center">
                            No {tab.label.toLowerCase()} yet.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                </Stack>
              </Tabs.Panel>
            ))}
          </Tabs>
        </Paper>
      </Stack>
    </PageLayout>
  );
}
