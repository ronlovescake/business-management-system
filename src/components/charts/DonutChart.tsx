'use client';

import { memo } from 'react';
import { Box, Center, Group, Table, Text } from '@mantine/core';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import { CHART_SERIES_COLORS } from './chartTheme';

export type DonutSlice = {
  name: string;
  value: number;
};

interface DonutChartProps {
  data: DonutSlice[];
  centerLabel: string;
  centerValue: string;
  valueFormatter: (value: number) => string;
  valueHeader?: string;
  labelHeader?: string;
  height?: number;
  showTable?: boolean;
}

const tableStyles = {
  th: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
    color: 'var(--mantine-color-dimmed)',
  },
};

const sliceColor = (index: number) =>
  CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length];

export const DonutChart = memo(function DonutChart({
  data,
  centerLabel,
  centerValue,
  valueFormatter,
  valueHeader = 'Amount',
  labelHeader = 'Name',
  height = 190,
  showTable = true,
}: DonutChartProps) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <>
      <Box pos="relative" h={height}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="74%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((slice, index) => (
                <Cell key={slice.name} fill={sliceColor(index)} />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTooltip
                  valueFormatter={(value) => valueFormatter(value)}
                />
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <Center
          pos="absolute"
          inset={0}
          style={{ pointerEvents: 'none', flexDirection: 'column' }}
        >
          <Text size="xs" c="dimmed">
            {centerLabel}
          </Text>
          <Text fw={600} c="dark.7">
            {centerValue}
          </Text>
        </Center>
      </Box>
      {showTable ? (
        <Table
          mt="xs"
          verticalSpacing={6}
          horizontalSpacing={4}
          styles={tableStyles}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{labelHeader}</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Share</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>{valueHeader}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((slice, index) => (
              <Table.Tr key={slice.name}>
                <Table.Td>
                  <Group gap={8} wrap="nowrap">
                    <Box
                      w={8}
                      h={8}
                      style={{
                        flexShrink: 0,
                        borderRadius: '50%',
                        backgroundColor: sliceColor(index),
                      }}
                    />
                    <Text size="sm" truncate maw={170}>
                      {slice.name}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="sm" c="dimmed">
                    {total > 0
                      ? `${((slice.value / total) * 100).toFixed(1)}%`
                      : '—'}
                  </Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="sm" fw={500}>
                    {valueFormatter(slice.value)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : null}
    </>
  );
});
