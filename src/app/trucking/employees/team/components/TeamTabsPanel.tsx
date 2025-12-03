import { memo } from 'react';
import { Tabs, Paper, Text } from '@mantine/core';
import { IconChartBar, IconList } from '@tabler/icons-react';
import {
  DataTable,
  type TableAction,
  type TableColumn,
} from '@/components/shared/PageTemplates/DataTable';
import type { Employee } from '../types';

interface TeamTabsPanelProps {
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  employees: Employee[];
  columns: TableColumn<Employee>[];
  actions: TableAction<Employee>[];
  onRowDoubleClick: (employee: Employee) => void;
}

export const TeamTabsPanel = memo(function TeamTabsPanel({
  activeTab,
  onTabChange,
  employees,
  columns,
  actions,
  onRowDoubleClick,
}: TeamTabsPanelProps) {
  return (
    <Tabs value={activeTab} onChange={onTabChange}>
      <Tabs.List>
        <Tabs.Tab value="employees" leftSection={<IconList size={16} />}>
          Employees
        </Tabs.Tab>
        <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
          Analytics
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="employees" pt="lg">
        <DataTable
          data={employees}
          columns={columns}
          actions={actions}
          emptyMessage="No employees found"
          onRowDoubleClick={onRowDoubleClick}
        />
      </Tabs.Panel>

      <Tabs.Panel value="analytics" pt="lg">
        <Paper
          p="xl"
          withBorder
          style={{
            textAlign: 'center',
            backgroundColor: '#f8f9fa',
            minHeight: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div>
            <IconChartBar size={64} stroke={1.5} color="#adb5bd" />
            <Text size="xl" fw={600} c="dimmed" mt="md">
              Analytics Coming Soon
            </Text>
            <Text size="sm" c="dimmed" mt="xs">
              Employee analytics and insights will be displayed here
            </Text>
          </div>
        </Paper>
      </Tabs.Panel>
    </Tabs>
  );
});
