import {
  Accordion,
  Badge,
  Card,
  Group,
  Progress,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { InventoryAlert } from '../../types/dashboard.types';

const severityColors: Record<InventoryAlert['severity'], string> = {
  high: 'red',
  medium: 'orange',
  low: 'yellow',
};

interface InventoryHealthCardProps {
  inventoryAlerts: InventoryAlert[];
  inventorySummary: Record<InventoryAlert['severity'], number>;
}

export function InventoryHealthCard({
  inventoryAlerts,
  inventorySummary,
}: InventoryHealthCardProps) {
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
            <Title order={4}>Inventory Health</Title>
            <Text size="sm" c="dimmed">
              {inventoryAlerts.length} flagged SKUs • stay ahead of stock-outs.
            </Text>
          </div>
          <Group gap="xs">
            {(
              Object.keys(inventorySummary) as Array<InventoryAlert['severity']>
            ).map((level) => (
              <Badge key={level} color={severityColors[level]} variant="light">
                {level.toUpperCase()} {inventorySummary[level]}
              </Badge>
            ))}
          </Group>
        </Group>
        <Accordion radius="md" variant="separated" chevronPosition="right">
          {inventoryAlerts.map((alert) => (
            <Accordion.Item key={alert.productCode} value={alert.productCode}>
              <Accordion.Control>
                <Group gap="sm" align="center">
                  <ThemeIcon
                    radius="md"
                    size="sm"
                    color={severityColors[alert.severity]}
                    variant="light"
                  >
                    <IconAlertTriangle size={14} />
                  </ThemeIcon>
                  <div>
                    <Text fw={600} size="sm">
                      {alert.productCode}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {alert.description}
                    </Text>
                  </div>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  <Group justify="space-between" gap="md">
                    <Text size="sm">Stock Level</Text>
                    <Text size="sm" fw={600}>
                      {alert.stockLevel} units
                    </Text>
                  </Group>
                  <Progress
                    value={Math.min(
                      100,
                      (alert.stockLevel / alert.reorderPoint) * 100
                    )}
                    color={severityColors[alert.severity]}
                    radius="lg"
                  />
                  <Text size="xs" c="dimmed">
                    Reorder point at {alert.reorderPoint} units.
                    {alert.etaDays && ` ETA ${alert.etaDays} days`}
                  </Text>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Stack>
    </Card>
  );
}
