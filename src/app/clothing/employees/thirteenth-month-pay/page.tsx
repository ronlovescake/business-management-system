'use client';

import { useMemo, useState } from 'react';
import { Stack, Badge } from '@mantine/core';
// Direct imports for faster compilation (bypasses barrel export)
import { StatsCardGrid, type StatCard } from '@/components/ui';
import { DataTable } from '@/components/shared/PageTemplates/DataTable';
import type {
  TableColumn,
  TableAction,
} from '@/components/shared/PageTemplates/DataTable';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { useThirteenthMonthPay } from './hooks/useThirteenthMonthPay';
import type { ThirteenthMonthPay, ThirteenthMonthPayFormData } from './types';
import { ThirteenthMonthPayFormDialog } from './components/ThirteenthMonthPayFormDialog';
import {
  IconCheck,
  IconCash,
  IconFileText,
  IconCalculator,
  IconCircleCheck,
  IconWallet,
} from '@tabler/icons-react';
import { ThirteenthMonthPayControls } from './components/ThirteenthMonthPayControls';

type ThirteenthMonthPayPageProps = {
  apiBasePath?: string;
};

export function EmployeesThirteenthMonthPayPage({
  apiBasePath,
}: ThirteenthMonthPayPageProps) {
  const {
    records,
    isLoading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    yearFilter,
    setYearFilter,
    stats: statsData,
    formatCurrency,
    formatDate,
    getStatusColor,
    getStatusLabel,
    addRecord,
    editRecord,
    approveRecord,
    markAsPaid,
    importFromCSV,
    exportToCSV,
  } = useThirteenthMonthPay(apiBasePath);

  const [dialogOpened, setDialogOpened] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ThirteenthMonthPay | null>(
    null
  );

  const yearFilterOptions = useMemo(() => {
    const uniqueYears = Array.from(
      new Set(records.map((record) => record.year))
    );
    uniqueYears.sort((a, b) => b.localeCompare(a));
    return ['All', ...uniqueYears];
  }, [records]);

  // Stats cards configuration
  const stats: StatCard[] = useMemo(
    () => [
      {
        title: 'Total Records',
        value: statsData.total,
        icon: <IconFileText size={20} stroke={1.6} />,
        color: 'blue',
        backgroundColor: 'var(--mantine-color-blue-6)',
      },
      {
        title: 'Calculated',
        value: statsData.calculated,
        icon: <IconCalculator size={20} stroke={1.6} />,
        color: 'grape',
        backgroundColor: 'var(--mantine-color-grape-6)',
      },
      {
        title: 'Approved',
        value: statsData.approved,
        icon: <IconCircleCheck size={20} stroke={1.6} />,
        color: 'green',
        backgroundColor: 'var(--mantine-color-green-6)',
      },
      {
        title: 'Total Amount',
        value: formatCurrency(statsData.totalAmount),
        icon: <IconWallet size={20} stroke={1.6} />,
        color: 'teal',
        backgroundColor: 'var(--mantine-color-teal-6)',
      },
    ],
    [
      formatCurrency,
      statsData.approved,
      statsData.calculated,
      statsData.total,
      statsData.totalAmount,
    ]
  );

  // Table columns configuration
  const columns: TableColumn<ThirteenthMonthPay>[] = [
    {
      key: 'employee',
      label: 'EMPLOYEE NAME',
      render: (record) => (
        <span style={{ fontWeight: 500 }}>{record.employee}</span>
      ),
    },
    {
      key: 'year',
      label: 'YEAR',
      render: (record) => record.year,
    },
    {
      key: 'hireDate',
      label: 'HIRE DATE',
      render: (record) => (
        <span style={{ fontWeight: 500 }}>
          {record.hireDate ? formatDate(record.hireDate) : 'N/A'}
        </span>
      ),
    },
    {
      key: 'tenureship',
      label: 'TENURESHIP',
      render: (record) => record.tenureship ?? 'N/A',
    },
    {
      key: 'totalBasicSalary',
      label: 'TOTAL BASIC SALARY',
      render: (record) => (
        <span style={{ fontWeight: 500 }}>
          {formatCurrency(record.totalBasicSalary)}
        </span>
      ),
    },
    {
      key: 'totalLwop',
      label: 'TOTAL LWOP',
      render: (record) => (
        <span style={{ fontWeight: 500, color: '#ef4444' }}>
          {formatCurrency(record.totalLwop)}
        </span>
      ),
    },
    {
      key: 'totalAbsencesLates',
      label: 'ABSENCES/LATES',
      render: (record) => (
        <span style={{ fontWeight: 500, color: '#ef4444' }}>
          {formatCurrency(record.totalAbsencesLates)}
        </span>
      ),
    },
    {
      key: 'netBasicSalary',
      label: 'NET BASIC SALARY',
      render: (record) => (
        <span style={{ fontWeight: 500 }}>
          {formatCurrency(record.netBasicSalary)}
        </span>
      ),
    },
    {
      key: 'thirteenthMonthPay',
      label: '13TH MONTH PAY',
      render: (record) => (
        <span style={{ fontWeight: 600, color: '#10b981', fontSize: '15px' }}>
          {formatCurrency(record.thirteenthMonthPay)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (record) => (
        <Badge
          variant="light"
          color={getStatusColor(record.status)}
          style={{ textTransform: 'capitalize' }}
        >
          {getStatusLabel(record.status)}
        </Badge>
      ),
    },
  ];

  // Table actions configuration
  const actions: TableAction<ThirteenthMonthPay>[] = [
    {
      label: 'Approve',
      icon: <IconCheck size={16} />,
      color: '#10b981',
      onClick: async (record) => {
        await approveRecord(record.id);
      },
      show: (record) =>
        record.status === 'calculated' || record.status === 'pending',
    },
    {
      label: 'Mark as Paid',
      icon: <IconCash size={16} />,
      color: '#6366f1',
      onClick: async (record) => {
        await markAsPaid(record.id);
      },
      show: (record) => record.status === 'approved',
    },
  ];

  // Handle save from dialog
  const handleSave = (data: ThirteenthMonthPayFormData) => {
    if (editingRecord) {
      editRecord(editingRecord.id, data);
    } else {
      addRecord(data);
    }
    setDialogOpened(false);
    setEditingRecord(null);
  };

  // Handle dialog close
  const handleDialogClose = () => {
    setDialogOpened(false);
    setEditingRecord(null);
  };

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <StatsCardGrid
          cards={stats}
          variant="vibrant"
          minCardWidth={220}
          spacing="md"
        />

        <ThirteenthMonthPayControls
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          yearFilter={yearFilter}
          onYearFilterChange={setYearFilter}
          yearOptions={yearFilterOptions}
          onImportCSV={(file) => file && importFromCSV(file)}
          onExportCSV={exportToCSV}
          onAddRecord={() => setDialogOpened(true)}
        />

        <DataTable
          height="73vh"
          data={records}
          columns={columns}
          actions={actions}
          emptyMessage={
            isLoading
              ? 'Loading 13th month pay records...'
              : 'No 13th month pay records found'
          }
          showSummary
          summaryLeft={
            <span style={{ fontSize: '14px', color: '#868e96' }}>
              Showing {records.length} of {statsData.total} records
            </span>
          }
          summaryRight={
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              Total Amount: {formatCurrency(statsData.totalAmount)}
            </span>
          }
        />

        <ThirteenthMonthPayFormDialog
          opened={dialogOpened}
          editingRecord={editingRecord}
          onClose={handleDialogClose}
          onSave={handleSave}
        />
      </Stack>
    </PageLayout>
  );
}

export default function ThirteenthMonthPayPage() {
  return <EmployeesThirteenthMonthPayPage />;
}
