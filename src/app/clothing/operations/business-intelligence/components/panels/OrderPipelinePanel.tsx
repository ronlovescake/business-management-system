import { memo } from 'react';
import { Box, Group, Progress, Stack, Text } from '@mantine/core';
import { ChartCard } from '@/components/charts/ChartCard';
import { CHART_SERIES_COLORS } from '@/components/charts/chartTheme';
import type { PipelineStage } from '../../types';

interface OrderPipelinePanelProps {
  stages: PipelineStage[];
  formatCurrency: (value: number) => string;
}

export const OrderPipelinePanel = memo(function OrderPipelinePanel({
  stages,
  formatCurrency,
}: OrderPipelinePanelProps) {
  const maxValue = Math.max(...stages.map((stage) => stage.value), 0);
  const totalCount = stages.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <ChartCard
      title="Order pipeline"
      subtitle={`${totalCount.toLocaleString('en-US')} orders by status, excluding cancelled`}
    >
      <Stack gap={12}>
        {stages.map((stage, index) => (
          <div key={stage.status}>
            <Group justify="space-between" gap="xs" wrap="nowrap" mb={4}>
              <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                <Box
                  w={8}
                  h={8}
                  style={{
                    flexShrink: 0,
                    borderRadius: '50%',
                    backgroundColor:
                      CHART_SERIES_COLORS[
                        Math.min(index, CHART_SERIES_COLORS.length - 1)
                      ],
                  }}
                />
                <Text size="sm" truncate>
                  {stage.status}
                </Text>
                <Text size="xs" c="dimmed">
                  {stage.count}
                </Text>
              </Group>
              <Text size="sm" fw={600} c="dark.7" style={{ flexShrink: 0 }}>
                {formatCurrency(stage.value)}
              </Text>
            </Group>
            <Progress
              value={maxValue > 0 ? (stage.value / maxValue) * 100 : 0}
              size={6}
              radius="xl"
              color="indigo"
              bg="indigo.0"
              aria-label={`${stage.status} share`}
            />
          </div>
        ))}
      </Stack>
    </ChartCard>
  );
});
