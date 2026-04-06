'use client';

import React from 'react';
import { Badge, Card, Group, Stack, Table, Text } from '@mantine/core';
import { IconHistory } from '@tabler/icons-react';
import type { EmployeeAutomationRunRecord } from '@/modules/shared/employees/automation/types';
import {
  AUTOMATION_LABELS,
  formatRunTarget,
  formatRunTimestamp,
  getStatusColor,
  getTriggerColor,
} from './employeeAutomationSettingsUtils';

type EmployeeAutomationHistoryCardProps = {
  history: EmployeeAutomationRunRecord[];
};

export function EmployeeAutomationHistoryCard({
  history,
}: EmployeeAutomationHistoryCardProps) {
  return (
    <Card withBorder radius="md" shadow="sm" p="xl">
      <Stack gap="md">
        <Group gap="xs">
          <IconHistory size={18} />
          <Text fw={700} size="lg">
            Recent Automation History
          </Text>
        </Group>

        {history.length === 0 ? (
          <Text c="dimmed" size="sm">
            No automation runs have been recorded yet.
          </Text>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>When</Table.Th>
                  <Table.Th>Automation</Table.Th>
                  <Table.Th>Trigger</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Target</Table.Th>
                  <Table.Th>Summary</Table.Th>
                  <Table.Th>Actor</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {history.map((run) => (
                  <Table.Tr key={run.id}>
                    <Table.Td>
                      <Text size="sm">{formatRunTimestamp(run.createdAt)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {AUTOMATION_LABELS[run.automationType]}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={getTriggerColor(run.triggerSource)}
                        variant="light"
                      >
                        {run.triggerSource}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(run.status)} variant="light">
                        {run.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatRunTarget(run)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="sm">
                          {run.message ?? 'No summary available.'}
                        </Text>
                        <Text c="dimmed" size="xs">
                          Processed {run.processed} | Inserted {run.inserted} |
                          Skipped {run.skipped}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {run.triggeredByUserName ?? 'System'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        )}
      </Stack>
    </Card>
  );
}
