'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { ExpenseFormDialog } from '@/app/clothing/accounting/components/ExpenseFormDialog';
import { StatsCards } from '@/app/clothing/accounting/components/StatsCards';
import { ExpenseControls } from '@/app/clothing/accounting/components/ExpenseControls';
import { ExpenseListTable } from '@/app/clothing/accounting/components/ExpenseListTable';
import { AnalyticsTable } from '@/app/clothing/accounting/components/AnalyticsTable';
import { ReceiptViewerModal } from '@/app/clothing/accounting/components/ReceiptViewerModal';
import { useHouseholdExpenses } from '@/app/personal/hooks/useHouseholdExpenses';
import { ExpensesErrorBoundary } from '@/app/clothing/accounting/components/ExpensesErrorBoundary';
import { RecurringPaymentsPanel } from '@/app/personal/expenses/components/RecurringPaymentsPanel';
import { HouseholdRecurringPaymentService } from '@/services/HouseholdRecurringPaymentService';

export default function PersonalExpensesPage() {
  const [recurringSearchQuery, setRecurringSearchQuery] = React.useState('');
  const [recurringAddOpened, setRecurringAddOpened] = React.useState(false);
  const [lastRecurringGenerateResult, setLastRecurringGenerateResult] =
    React.useState<
      { month: string; created: number; skipped: number } | null | undefined
    >(undefined);

  const queryClient = useQueryClient();

  const generateRecurringMutation = useMutation({
    mutationFn: () => HouseholdRecurringPaymentService.generate(),
    onSuccess: async (result) => {
      setLastRecurringGenerateResult(result);
      await queryClient.invalidateQueries({
        queryKey: ['household-expenses'],
      });
    },
  });

  const {
    expenses,
    filteredExpenses,
    searchQuery,
    setSearchQuery,
    filterCategory,
    setFilterCategory,
    filterStatus,
    setFilterStatus,
    filterSource,
    setFilterSource,
    isModalOpen,
    setIsModalOpen,
    editingExpense,
    activeTab,
    setActiveTab,
    isImporting,

    formDate,
    setFormDate,
    formAmount,
    setFormAmount,
    formDescription,
    setFormDescription,
    formCategory,
    setFormCategory,
    formAccountId,
    setFormAccountId,
    formNotes,
    setFormNotes,
    formReceipt,
    setFormReceipt,

    viewingReceipt,
    receiptModalOpen,
    setReceiptModalOpen,
    receiptZoom,
    setReceiptZoom,
    receiptFileName,

    categories,
    accountOptions,
    sourceOptions,
    totalExpenses,
    pendingExpenses,
    approvedExpenses,
    thisMonthExpenses,
    monthlyBreakdown,

    formatDate,
    formatCurrency,
    getCategoryColor,
    getSourceLabel,
    getSourceColor,

    handleAddExpense,
    handleEditExpense,
    handleDeleteExpense,
    handleSaveExpense,
    handleApprove,
    handleReject,
    handleViewReceipt,
    handleImportCSV,
    handleExportCSV,
  } = useHouseholdExpenses();

  const accountLabelById = React.useMemo(() => {
    return new Map(accountOptions.map((opt) => [opt.value, opt.label]));
  }, [accountOptions]);

  const getAccountLabel = React.useCallback(
    (accountId: string | null | undefined) => {
      if (!accountId) {
        return '—';
      }

      return accountLabelById.get(accountId) || '—';
    },
    [accountLabelById]
  );

  return (
    <ExpensesErrorBoundary>
      <PageLayout fluid withPadding>
        <Stack gap="lg">
          <StatsCards
            totalExpenses={totalExpenses}
            pendingExpenses={pendingExpenses}
            approvedExpenses={approvedExpenses}
            thisMonthExpenses={thisMonthExpenses}
            formatCurrency={formatCurrency}
          />

          <ExpenseControls
            activeTab={activeTab}
            onTabChange={setActiveTab}
            showRecurringPaymentsTab
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            recurringSearchQuery={recurringSearchQuery}
            onRecurringSearchChange={setRecurringSearchQuery}
            onGenerateRecurring={() => generateRecurringMutation.mutate()}
            isGeneratingRecurring={generateRecurringMutation.isPending}
            onAddRecurring={() => setRecurringAddOpened(true)}
            filterCategory={filterCategory}
            onCategoryFilterChange={setFilterCategory}
            filterStatus={filterStatus}
            onStatusFilterChange={setFilterStatus}
            filterSource={filterSource}
            onSourceFilterChange={setFilterSource}
            categories={categories}
            sources={sourceOptions}
            onImportCSV={handleImportCSV}
            onExportCSV={handleExportCSV}
            onAddExpense={handleAddExpense}
            isImporting={isImporting}
          />

          {activeTab === 'list' ? (
            <ExpenseListTable
              expenses={expenses}
              filteredExpenses={filteredExpenses}
              formatDate={formatDate}
              formatCurrency={formatCurrency}
              getCategoryColor={getCategoryColor}
              getSourceLabel={getSourceLabel}
              getSourceColor={getSourceColor}
              showAccountColumn
              getAccountLabel={getAccountLabel}
              onViewReceipt={handleViewReceipt}
              onApprove={handleApprove}
              onReject={handleReject}
              onEdit={handleEditExpense}
              onDelete={handleDeleteExpense}
            />
          ) : activeTab === 'analytics' ? (
            <AnalyticsTable
              monthlyBreakdown={monthlyBreakdown}
              totalExpenses={totalExpenses}
              formatCurrency={formatCurrency}
              getCategoryColor={getCategoryColor}
            />
          ) : (
            <RecurringPaymentsPanel
              categories={categories}
              accountOptions={accountOptions}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              getCategoryColor={getCategoryColor}
              searchQuery={recurringSearchQuery}
              opened={recurringAddOpened}
              setOpened={setRecurringAddOpened}
              lastGenerateResult={lastRecurringGenerateResult}
            />
          )}
        </Stack>

        <ExpenseFormDialog
          opened={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          editingExpense={editingExpense}
          categories={categories}
          accountOptions={accountOptions}
          addTitle="Add New Household Expense"
          editTitle="Edit Household Expense"
          addSubtitle="Fill in the details to add a new household expense"
          editSubtitle="Update the household expense details below"
          formDate={formDate}
          setFormDate={setFormDate}
          formAmount={formAmount}
          setFormAmount={setFormAmount}
          formDescription={formDescription}
          setFormDescription={setFormDescription}
          formCategory={formCategory}
          setFormCategory={setFormCategory}
          formAccountId={formAccountId}
          setFormAccountId={setFormAccountId}
          formNotes={formNotes}
          setFormNotes={setFormNotes}
          formReceipt={formReceipt}
          setFormReceipt={setFormReceipt}
          showTripId={false}
          onSave={handleSaveExpense}
        />

        <ReceiptViewerModal
          opened={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          receiptData={viewingReceipt}
          zoom={receiptZoom}
          onZoomIn={() => setReceiptZoom((prev) => Math.min(300, prev + 25))}
          onZoomOut={() => setReceiptZoom((prev) => Math.max(25, prev - 25))}
          onZoomReset={() => setReceiptZoom(100)}
          onDownload={() => {
            if (viewingReceipt) {
              const link = document.createElement('a');
              link.href = viewingReceipt;
              link.download = receiptFileName || 'receipt';
              link.click();
            }
          }}
        />
      </PageLayout>
    </ExpensesErrorBoundary>
  );
}
