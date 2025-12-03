import {
  Card,
  Group,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Timeline,
  Title,
  Progress,
} from '@mantine/core';
import { IconTruck } from '@tabler/icons-react';
import type { ShipmentUpdate } from '../../types/dashboard.types';

const shipmentTabs: Array<{
  label: string;
  value: ShipmentUpdate['status'] | 'all';
}> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'Pending' },
  { label: 'In Transit', value: 'In Transit' },
  { label: 'Delivered', value: 'Delivered' },
];

interface ShipmentTimelineCardProps {
  shipments: ShipmentUpdate[];
  shipmentFilter: ShipmentUpdate['status'] | 'all';
  onFilterChange: (value: ShipmentUpdate['status'] | 'all') => void;
}

export function ShipmentTimelineCard({
  shipments,
  shipmentFilter,
  onFilterChange,
}: ShipmentTimelineCardProps) {
  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      className="modern-card"
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>Shipment Timeline</Title>
            <Text c="dimmed" size="sm">
              Monitor high-value routes in one place.
            </Text>
          </div>
          <Tabs
            value={shipmentFilter}
            onChange={(value) =>
              onFilterChange(value as ShipmentUpdate['status'] | 'all')
            }
            radius="md"
          >
            <Tabs.List>
              {shipmentTabs.map((tab) => (
                <Tabs.Tab value={tab.value} key={tab.value}>
                  {tab.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
        </Group>
        <ScrollArea h={230} offsetScrollbars>
          <Timeline
            active={shipments.length}
            bulletSize={24}
            lineWidth={2}
            color="pink"
          >
            {shipments.map((shipment) => (
              <Timeline.Item
                key={shipment.shipmentCode}
                bullet={
                  <ThemeIcon size={24} radius="xl" color="pink" variant="light">
                    <IconTruck size={14} />
                  </ThemeIcon>
                }
                title={shipment.shipmentCode}
              >
                <Text size="sm" fw={500}>
                  {shipment.status}
                </Text>
                <Text size="xs" c="dimmed">
                  {shipment.location} • {shipment.timestamp}
                </Text>
                <Progress
                  value={shipment.progress}
                  mt="xs"
                  color="pink"
                  size="lg"
                  radius="lg"
                />
              </Timeline.Item>
            ))}
            {shipments.length === 0 && (
              <Timeline.Item title="No shipments" lineVariant="dashed">
                <Text size="sm" c="dimmed">
                  No shipments in this status right now.
                </Text>
              </Timeline.Item>
            )}
          </Timeline>
        </ScrollArea>
      </Stack>
    </Card>
  );
}
