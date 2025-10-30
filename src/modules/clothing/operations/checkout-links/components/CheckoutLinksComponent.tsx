/**
 * Checkout Links Component
 * Main component for managing payment checkout links with product details
 */

'use client';

import { Card, Stack, Text, Title, Group, Button, Table } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

interface CheckoutLinkData {
  id: string;
  weight: string;
  width: string;
  length: string;
  height: string;
  checkoutLinks: string;
  productPortals: string;
  productNames: string;
}

export function CheckoutLinksComponent() {
  // Sample data structure - replace with real data later
  const mockData: CheckoutLinkData[] = [
    // Add your data here
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Checkout Links</Title>
          <Text size="sm" c="dimmed">
            Manage payment checkout links with product details
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />}>Add New</Button>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Table highlightOnHover striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>WEIGHT</Table.Th>
              <Table.Th>WIDTH</Table.Th>
              <Table.Th>LENGTH</Table.Th>
              <Table.Th>HEIGHT</Table.Th>
              <Table.Th>CHECKOUT LINKS</Table.Th>
              <Table.Th>PRODUCT PORTALS</Table.Th>
              <Table.Th>PRODUCT NAMES</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {mockData.length === 0 ? (
              <Table.Tr>
                <Table.Td
                  colSpan={7}
                  style={{ textAlign: 'center', padding: '2rem' }}
                >
                  <Text c="dimmed">
                    No data available. Click &quot;Add New&quot; to get started.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              mockData.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>{row.weight}</Table.Td>
                  <Table.Td>{row.width}</Table.Td>
                  <Table.Td>{row.length}</Table.Td>
                  <Table.Td>{row.height}</Table.Td>
                  <Table.Td>{row.checkoutLinks}</Table.Td>
                  <Table.Td>{row.productPortals}</Table.Td>
                  <Table.Td>{row.productNames}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
