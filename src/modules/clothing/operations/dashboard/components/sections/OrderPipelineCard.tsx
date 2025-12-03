import {
  Badge,
  Card,
  Group,
  Progress,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconArrowDownRight, IconArrowUpRight } from '@tabler/icons-react';
import type { OrderFunnelStage } from '../../types/dashboard.types';

const funnelColors: Record<OrderFunnelStage['status'], string> = {
  positive: 'green',
  neutral: 'blue',
  negative: 'red',
};

interface OrderPipelineCardProps {
  orderFunnel: OrderFunnelStage[];
  activeStage: string;
  onStageChange: (stage: string) => void;
  selectedStage?: OrderFunnelStage;
}

export function OrderPipelineCard({
  orderFunnel,
  activeStage,
  onStageChange,
  selectedStage,
}: OrderPipelineCardProps) {
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
            <Title order={4}>Order Pipeline</Title>
            <Text c="dimmed" size="sm">
              Tap a stage to inspect throughput.
            </Text>
          </div>
          <Badge variant="light" color="blue">
            {orderFunnel.length} stages
          </Badge>
        </Group>
        <Group gap="xs" wrap="wrap">
          {orderFunnel.map((stage) => (
            <Card
              key={stage.label}
              padding="sm"
              radius="md"
              withBorder
              onClick={() => onStageChange(stage.label)}
              className={
                stage.label === activeStage
                  ? 'modern-card active'
                  : 'modern-card'
              }
              style={{ cursor: 'pointer', minWidth: '120px' }}
            >
              <Stack gap={2}>
                <Text size="sm" fw={600}>
                  {stage.label}
                </Text>
                <Text size="xs" c="dimmed">
                  {stage.value} orders
                </Text>
              </Stack>
            </Card>
          ))}
        </Group>
        {selectedStage && (
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>{selectedStage.label}</Text>
              <Group gap={4}>
                <ThemeIcon
                  size="sm"
                  variant="light"
                  color={funnelColors[selectedStage.status]}
                  radius="sm"
                >
                  {selectedStage.delta >= 0 ? (
                    <IconArrowUpRight size={14} />
                  ) : (
                    <IconArrowDownRight size={14} />
                  )}
                </ThemeIcon>
                <Text
                  size="sm"
                  fw={600}
                  color={selectedStage.delta >= 0 ? 'green' : 'red'}
                >
                  {selectedStage.delta >= 0 ? '+' : ''}
                  {selectedStage.delta}% vs last week
                </Text>
              </Group>
            </Group>
            <Progress
              value={Math.min(
                100,
                (selectedStage.value /
                  (orderFunnel[0]?.value || selectedStage.value)) *
                  100
              )}
              color={funnelColors[selectedStage.status]}
              size="xl"
              radius="lg"
            />
            <Text size="sm" c="dimmed">
              Keeping this stage flowing unlocks faster cash collection
              downstream.
            </Text>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
