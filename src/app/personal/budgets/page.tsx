'use client';

import {
  Badge,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import {
  IconAdjustments,
  IconChartPie,
  IconCurrencyPeso,
  IconDownload,
  IconList,
  IconPlus,
  IconSearch,
  IconUpload,
} from '@tabler/icons-react';
import { StatsCardGrid, type StatCard } from '@/components/ui';
import { ControlPanelCard } from '@/components/ui/ControlPanelCard';
import { actionButtonStyles } from '@/components/shared/styles/actionButtonStyles';
import { PersonalPageShell } from '../components/PersonalPageShell';
import {
  usePersonalBudgetsView,
  type BudgetStatus,
} from '../hooks/usePersonalBudgetsView';

const statusColors: Record<BudgetStatus, string> = {
  over: 'red',
  under: 'teal',
  'on-track': 'blue',
};

export default function PersonalBudgetsPage() {
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filterCategory,
    setFilterCategory,
    filterPeriod,
    setFilterPeriod,
    filterStatus,
    setFilterStatus,
    categories,
    filteredBudgets,
    analyticsByCategory,
    stats,
    formatCurrency,
    handleImportCSV,
    handleExportCSV,
    handleAddBudget,
  } = usePersonalBudgetsView();

  const statCards: StatCard[] = [
    {
      title: 'Total Planned',
      value: formatCurrency(stats.totalPlanned),
      icon: <IconCurrencyPeso size={22} stroke={1.6} />,
      color: 'blue',
      backgroundColor:
        'linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(99, 102, 241, 0.95))',
    },
    {
      title: 'Total Actual',
      value: formatCurrency(stats.totalActual),
      icon: <IconChartPie size={22} stroke={1.6} />,
      color: 'green',
      backgroundColor:
        'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(34, 197, 94, 0.95))',
    },
    {
      title: 'Remaining',
      value: formatCurrency(stats.totalRemaining),
      icon: <IconAdjustments size={22} stroke={1.6} />,
      color: 'orange',
      backgroundColor:
        'linear-gradient(135deg, rgba(251, 146, 60, 0.95), rgba(249, 115, 22, 0.95))',
    },
    {
      title: 'This Month',
      value: formatCurrency(stats.thisMonthActual || stats.thisMonthPlanned),
      icon: <IconList size={22} stroke={1.6} />,
      color: 'teal',
      backgroundColor:
        'linear-gradient(135deg, rgba(20, 184, 166, 0.95), rgba(13, 148, 136, 0.95))',
    },
  ];

  return (
    <PersonalPageShell
      title="Budgets"
      description="Plan monthly and annual budgets across categories and accounts."
    >
      <Stack gap="lg">
        <StatsCardGrid cards={statCards} variant="vibrant" minCardWidth={240} />

        <ControlPanelCard
          title="Budget Records"
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={[
            {
              value: 'list',
              label: 'Budget List',
              leftSection: <IconList size={16} />,
              panel: (
                <Group wrap="wrap" gap="sm">
                  <TextInput
                    placeholder="Search budgets..."
                    leftSection={<IconSearch size={16} />}
                    value={searchQuery}
                    onChange={(event) =>
                      setSearchQuery(event.currentTarget.value)
                    }
                    style={{ flex: 1, minWidth: 240 }}
                  />
                  <Select
                    placeholder="Filter by category"
                    data={['All', ...categories]}
                    value={filterCategory ?? 'All'}
                    onChange={(value) =>
                      setFilterCategory(value === 'All' ? null : value)
                    }
                    clearable
                    style={{ width: 200 }}
                  />
                  <Select
                    placeholder="Filter by period"
                    data={['All', 'monthly', 'annual']}
                    value={filterPeriod ?? 'All'}
                    onChange={(value) =>
                      setFilterPeriod(
                        value === 'All' ? null : (value as 'monthly' | 'annual')
                      )
                    }
                    clearable
                    style={{ width: 200 }}
                  />
                  <Select
                    placeholder="Filter by status"
                    data={['All', 'over', 'under', 'on-track']}
                    value={filterStatus ?? 'All'}
                    onChange={(value) =>
                      setFilterStatus(
                        value === 'All'
                          ? null
                          : (value as BudgetStatus | 'all' | null)
                      )
                    }
                    clearable
                    style={{ width: 200 }}
                  />
                  <Button
                    leftSection={<IconUpload size={16} />}
                    size="sm"
                    radius="sm"
                    styles={actionButtonStyles}
                    onClick={handleImportCSV}
                  >
                    Import CSV
                  </Button>
                  <Button
                    leftSection={<IconDownload size={16} />}
                    size="sm"
                    radius="sm"
                    styles={actionButtonStyles}
                    onClick={handleExportCSV}
                  >
                    Export
                  </Button>
                  <Button
                    leftSection={<IconPlus size={16} />}
                    size="sm"
                    radius="sm"
                    color="green"
                    onClick={handleAddBudget}
                  >
                    Add Budget
                  </Button>
                </Group>
              ),
            },
            {
              value: 'analytics',
              label: 'Analytics',
              leftSection: <IconChartPie size={16} />,
              panel: (
                <Text size="sm" c="dimmed">
                  Category rollups and variance are displayed below.
                </Text>
              ),
            },
          ]}
        />

        {activeTab === 'list' ? (
          <Card withBorder padding={0} radius="md">
            <Table highlightOnHover withTableBorder>
              <Table.Thead style={{ backgroundColor: '#f1f3f5' }}>
                <Table.Tr>
                  <Table.Th style={{ padding: '12px' }}>CATEGORY</Table.Th>
                  <Table.Th style={{ padding: '12px' }}>PERIOD</Table.Th>
                  <Table.Th style={{ padding: '12px', textAlign: 'right' }}>
                    PLANNED
                  </Table.Th>
                  <Table.Th style={{ padding: '12px', textAlign: 'right' }}>
                    ACTUAL
                  </Table.Th>
                  <Table.Th style={{ padding: '12px', textAlign: 'right' }}>
                    VARIANCE
                  </Table.Th>
                  <Table.Th style={{ padding: '12px' }}>STATUS</Table.Th>
                  <Table.Th style={{ padding: '12px' }}>ACCOUNT</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredBudgets.length === 0 ? (
                  <Table.Tr>
                    <Table.Td
                      colSpan={7}
                      style={{ textAlign: 'center', padding: '18px' }}
                    >
                      <Text c="dimmed">
                        No budgets found for the selected filters.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredBudgets.map((budget) => (
                    <Table.Tr key={budget.id}>
                      <Table.Td>
                        <Stack gap={2}>
                          <Text fw={600}>{budget.category}</Text>
                          {budget.notes ? (
                            <Text size="xs" c="dimmed">
                              {budget.notes}
                            </Text>
                          ) : null}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Badge color="gray" variant="light">
                          {budget.period === 'monthly'
                            ? budget.monthLabel
                            : 'Annual'}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {formatCurrency(budget.planned)}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {formatCurrency(budget.actual)}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text
                          c={
                            budget.variance > 0
                              ? 'red'
                              : budget.variance < 0
                                ? 'teal'
                                : 'gray'
                          }
                        >
                          {formatCurrency(budget.variance)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={statusColors[budget.status]}
                          variant="light"
                        >
                          {budget.status === 'on-track'
                            ? 'On track'
                            : budget.status === 'over'
                              ? 'Over'
                              : 'Under'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{budget.account ?? '—'}</Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </Card>
        ) : (
          <Card withBorder padding="md" radius="md">
            <Stack gap="md">
              <Text fw={600}>Category rollups</Text>
              <Table highlightOnHover withTableBorder>
                <Table.Thead style={{ backgroundColor: '#f1f3f5' }}>
                  <Table.Tr>
                    <Table.Th style={{ padding: '12px' }}>CATEGORY</Table.Th>
                    <Table.Th style={{ padding: '12px', textAlign: 'right' }}>
                      PLANNED
                    </Table.Th>
                    <Table.Th style={{ padding: '12px', textAlign: 'right' }}>
                      ACTUAL
                    </Table.Th>
                    <Table.Th style={{ padding: '12px', textAlign: 'right' }}>
                      VARIANCE
                    </Table.Th>
                    <Table.Th style={{ padding: '12px' }}>STATUS</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analyticsByCategory.length === 0 ? (
                    <Table.Tr>
                      <Table.Td
                        colSpan={5}
                        style={{ textAlign: 'center', padding: '18px' }}
                      >
                        <Text c="dimmed">No analytics available.</Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    analyticsByCategory.map((row) => (
                      <Table.Tr key={row.category}>
                        <Table.Td>{row.category}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {formatCurrency(row.planned)}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {formatCurrency(row.actual)}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text
                            c={
                              row.variance > 0
                                ? 'red'
                                : row.variance < 0
                                  ? 'teal'
                                  : 'gray'
                            }
                          >
                            {formatCurrency(row.variance)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={statusColors[row.status]}
                            variant="light"
                          >
                            {row.status === 'on-track'
                              ? 'On track'
                              : row.status === 'over'
                                ? 'Over'
                                : 'Under'}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Stack>
          </Card>
        )}
      </Stack>
    </PersonalPageShell>
  );
}
