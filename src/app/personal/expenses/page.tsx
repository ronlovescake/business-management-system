'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { ExpenseFormDialog } from '@/app/clothing/accounting/components/ExpenseFormDialog';
import { StatsCards } from '@/app/clothing/accounting/components/StatsCards';
import { ExpenseControls } from '@/app/clothing/accounting/components/ExpenseControls';
import { ExpenseListTable } from '@/app/clothing/accounting/components/ExpenseListTable';
import { AnalyticsTable } from '@/app/clothing/accounting/components/AnalyticsTable';
import { ReceiptViewerModal } from '@/app/clothing/accounting/components/ReceiptViewerModal';
import { usePersonalExpensesView } from '@/app/personal/hooks/usePersonalExpensesView';
import { ExpensesErrorBoundary } from '@/app/clothing/accounting/components/ExpensesErrorBoundary';
import { RecurringPaymentsPanel } from '@/app/personal/expenses/components/RecurringPaymentsPanel';

export default function PersonalExpensesPage() {
  const {
    recurringSearchQuery,
    setRecurringSearchQuery,
    recurringAddOpened,
    setRecurringAddOpened,
    lastRecurringGenerateResult,
    generateRecurringMutation,
    getAccountLabel,
    expenses,
    filteredExpenses,
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    dateFilterOptions,
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
    handleSaveAndAddExpense,
    handleApprove,
    handleReject,
    handleMarkPaid,
    handleViewReceipt,
    handleImportCSV,
    handleExportCSV,
    handleDownloadTemplate,
  } = usePersonalExpensesView();

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
            dateFilter={dateFilter}
            onDateFilterChange={(value) =>
              setDateFilter(value as typeof dateFilter)
            }
            dateFilterOptions={dateFilterOptions}
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
            onDownloadTemplate={handleDownloadTemplate}
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
              pendingActionMode="mark-paid"
              onMarkPaid={handleMarkPaid}
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
          onSaveAndAddNew={handleSaveAndAddExpense}
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
