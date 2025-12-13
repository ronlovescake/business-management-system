'use client';

import { Stack } from '@mantine/core';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { PayrollControls } from '@/components/employees/payroll/PayrollControls';
import { PayrollErrorBoundary } from './components/PayrollErrorBoundary';
import { PayrollFormDialog } from './components/PayrollFormDialog';
import { PayrollStatsCards } from './components/PayrollStatsCards';
import { PayrollTableSection } from './components/PayrollTableSection';
import { usePayrollPage } from './hooks/usePayrollPage';

function PayrollContent() {
  const {
    payrolls,
    stats,
    columns,
    actions,
    columnTotals,
    totalPayrolls,
    searchQuery,
    statusFilter,
    payPeriodFilter,
    payPeriods,
    payPeriodOptions,
    employeeOptions,
    isFormOpen,
    editingPayroll,
    isGeneratingPayroll,
    isGeneratingPayslips,
    setSearchQuery,
    setStatusFilter,
    setPayPeriodFilter,
    setIsFormOpen,
    formatCurrency,
    handleImportCSV,
    handleExportCSV,
    handleOpenManualPayroll,
    handleAddPayroll,
    handleGeneratePayslips,
    handleSavePayroll,
    calculateTotals,
  } = usePayrollPage();

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <PayrollStatsCards stats={stats} />

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
          title="Payroll Records"
        />

        <PayrollTableSection
          data={payrolls}
          columns={columns}
          actions={actions}
          columnTotals={columnTotals}
          totalPayrolls={totalPayrolls}
          formatCurrency={formatCurrency}
        />
      </Stack>

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

export default function Payroll() {
  return (
    <PayrollErrorBoundary>
      <PayrollContent />
    </PayrollErrorBoundary>
  );
}
