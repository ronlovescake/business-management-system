'use client';

import { useMemo, useState } from 'react';
import { Stack, Badge } from '@mantine/core';
import {
  StatsCardGroup,
  PageControls,
  DataTable,
} from '@/components/shared/PageTemplates';
import type {
  TableColumn,
  TableAction,
  StatCard,
} from '@/components/shared/PageTemplates';
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

export default function ThirteenthMonthPayPage() {
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
  } = useThirteenthMonthPay();

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
  const stats: StatCard[] = [
    {
      title: 'Total Records',
      value: statsData.total.toString(),
      icon: <IconFileText size={32} stroke={1.5} />,
    },
    {
      title: 'Calculated',
      value: statsData.calculated.toString(),
      icon: <IconCalculator size={32} stroke={1.5} />,
    },
    {
      title: 'Approved',
      value: statsData.approved.toString(),
      icon: <IconCircleCheck size={32} stroke={1.5} />,
    },
    {
      title: 'Total Amount',
      value: formatCurrency(statsData.totalAmount),
      icon: <IconWallet size={32} stroke={1.5} />,
    },
  ];

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
      onClick: (record) => approveRecord(record.id),
      show: (record) =>
        record.status === 'calculated' || record.status === 'pending',
    },
    {
      label: 'Mark as Paid',
      icon: <IconCash size={16} />,
      color: '#6366f1',
      onClick: (record) => markAsPaid(record.id),
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
    <Stack
      gap="lg"
      style={{
        padding: '24px',
        minHeight: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
      }}
    >
      <StatsCardGroup stats={stats} />

      <PageControls
        title="13th Month Pay Records"
        searchPlaceholder="Search by employee or year..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={[
          {
            placeholder: 'Filter by status',
            data: ['All', 'pending', 'calculated', 'approved', 'paid'],
            value: statusFilter,
            onChange: (value: string | null) =>
              setStatusFilter(value === 'All' || !value ? 'all' : value),
          },
          {
            placeholder: 'Filter by year',
            data: yearFilterOptions,
            value: yearFilter,
            onChange: (value: string | null) =>
              setYearFilter(value === 'All' || !value ? 'all' : value),
          },
        ]}
        onImportCSV={(file: File | null) => file && importFromCSV(file)}
        onExportCSV={exportToCSV}
        onAdd={() => setDialogOpened(true)}
        addButtonLabel="Add Record"
      />

      <DataTable
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
  );
}
