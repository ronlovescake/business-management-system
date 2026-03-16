'use client';

import React from 'react';
import { Stack, Text, Box } from '@mantine/core';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { StatsCardGrid } from '@/components/ui';
import { PayrollControls } from './components/PayrollControls';
import { DataTable } from '@/components/shared/PageTemplates/DataTable';
import { PayrollErrorBoundary } from './components/PayrollErrorBoundary';
import { PayrollFormDialog } from './components/PayrollFormDialog';
import { usePayrollPage } from './hooks/usePayrollPage';

function PayrollContent({ apiBasePath }: { apiBasePath?: string }) {
  const [columnWidths, setColumnWidths] = React.useState<number[]>([]);

  const {
    payrolls,
    searchQuery,
    statusFilter,
    payPeriodFilter,
    payPeriods,
    payPeriodOptions,
    employeeOptions,
    totalPayrolls,
    isFormOpen,
    editingPayroll,
    isGeneratingPayroll,
    isGeneratingPayslips,
    setSearchQuery,
    setStatusFilter,
    setPayPeriodFilter,
    setIsFormOpen,
    formatCurrency,
    calculateTotals,
    handleOpenManualPayroll,
    handleAddPayroll,
    handleGeneratePayslips,
    handleSavePayroll,
    handleApproveAll,
    handleMarkAllAsPaid,
    handleImportCSV,
    handleExportCSV,
    isBulkApproving,
    isBulkPaying,
    stats,
    columns,
    actions,
    columnTotals,
  } = usePayrollPage(apiBasePath);

  const summaryGridTemplate = React.useMemo(() => {
    if (columnWidths.length === 0) {
      const columnCount = columns.length + (actions.length > 0 ? 1 : 0);
      return `repeat(${columnCount}, minmax(0, 1fr))`;
    }

    return columnWidths.map((width) => `${width}px`).join(' ');
  }, [columnWidths, columns.length, actions.length]);

  const summaryCells = React.useMemo(() => {
    return columns.map((column) => {
      const alignment = column.align || 'center';
      let content: React.ReactNode = null;

      switch (column.key) {
        case 'employee':
          content = (
            <Stack gap={0} align="flex-start">
              <Text fw={600}>Totals</Text>
              <Text size="xs" c="dimmed">
                Showing {payrolls.length} of {totalPayrolls} records
              </Text>
            </Stack>
          );
          break;
        case 'basicSalary':
          content = formatCurrency(columnTotals.basicSalary);
          break;
        case 'allowance':
          content = formatCurrency(columnTotals.allowance);
          break;
        case 'overtime':
          content = formatCurrency(columnTotals.overtime);
          break;
        case 'bonuses':
          content = formatCurrency(columnTotals.bonuses);
          break;
        case 'thirteenthMonth':
          content = formatCurrency(columnTotals.thirteenthMonth);
          break;
        case 'grossPay':
          content = (
            <Text fw={700} c="green">
              {formatCurrency(columnTotals.grossPay)}
            </Text>
          );
          break;
        case 'sss':
          content = formatCurrency(columnTotals.sss);
          break;
        case 'philHealth':
          content = formatCurrency(columnTotals.philHealth);
          break;
        case 'pagIbig':
          content = formatCurrency(columnTotals.pagIbig);
          break;
        case 'tax':
          content = formatCurrency(columnTotals.tax);
          break;
        case 'loans':
          content = formatCurrency(columnTotals.loans);
          break;
        case 'cashAdvance':
          content = formatCurrency(columnTotals.cashAdvance);
          break;
        case 'lwop':
          content = formatCurrency(columnTotals.lwop);
          break;
        case 'absentsLates':
          content = formatCurrency(columnTotals.absentsLates);
          break;
        case 'totalDeductions':
          content = (
            <Text fw={700} c="red">
              {formatCurrency(columnTotals.totalDeductions)}
            </Text>
          );
          break;
        case 'netPay':
          content = (
            <Text fw={800} c="blue">
              {formatCurrency(columnTotals.netPay)}
            </Text>
          );
          break;
        default:
          content = null;
          break;
      }

      return (
        <Box
          key={`summary-${column.key}`}
          style={{
            padding: '8px 12px',
            textAlign: alignment,
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              alignment === 'left'
                ? 'flex-start'
                : alignment === 'right'
                  ? 'flex-end'
                  : 'center',
          }}
        >
          {typeof content === 'string' ? <Text>{content}</Text> : content}
        </Box>
      );
    });
  }, [columns, payrolls.length, totalPayrolls, columnTotals, formatCurrency]);

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        {/* Stats Cards */}
        <StatsCardGrid
          cards={stats}
          variant="vibrant"
          minCardWidth={220}
          spacing="md"
        />

        {/* Controls */}
        <PayrollControls
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          payPeriodFilter={payPeriodFilter}
          onPayPeriodFilterChange={setPayPeriodFilter}
          payPeriods={payPeriods}
          onImportCSV={handleImportCSV}
          onExportCSV={handleExportCSV}
          onAddPayroll={handleAddPayroll}
          onOpenManualPayroll={handleOpenManualPayroll}
          addButtonLabel="Generate Payroll"
          onGeneratePayslips={handleGeneratePayslips}
          isGeneratingPayroll={isGeneratingPayroll}
          isGeneratingPayslips={isGeneratingPayslips}
          onApproveAll={handleApproveAll}
          onMarkAllAsPaid={handleMarkAllAsPaid}
          isBulkApproving={isBulkApproving}
          isBulkPaying={isBulkPaying}
        />

        {/* Payroll Table */}
        <DataTable
          data={payrolls}
          columns={columns}
          actions={actions}
          emptyMessage="No payroll records found"
          showSummary
          summaryLeft={null}
          summaryRight={
            <Box
              style={{
                display: 'grid',
                gridTemplateColumns: summaryGridTemplate,
                width: '100%',
                borderTop: '1px solid var(--mantine-color-gray-3)',
              }}
            >
              {summaryCells}
              {actions.length > 0 && (
                <Box
                  key="summary-actions"
                  style={{ padding: '8px 12px' }}
                ></Box>
              )}
            </Box>
          }
          onColumnWidthsChange={setColumnWidths}
        />
      </Stack>

      {/* Payroll Form Dialog */}
      <PayrollFormDialog
        opened={isFormOpen}
        editingPayroll={editingPayroll}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSavePayroll}
        calculateTotals={calculateTotals}
        employeeOptions={employeeOptions}
        payPeriodOptions={payPeriodOptions}
      />
    </PageLayout>
  );
}

export function EmployeesPayrollPage({
  apiBasePath,
}: {
  apiBasePath?: string;
}) {
  return (
    <PayrollErrorBoundary>
      <PayrollContent apiBasePath={apiBasePath} />
    </PayrollErrorBoundary>
  );
}

export default function Payroll() {
  return <EmployeesPayrollPage />;
}
