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
import { useExpenses } from '@/app/clothing/accounting/hooks/useExpenses';
import { ExpensesErrorBoundary } from '@/app/clothing/accounting/components/ExpensesErrorBoundary';
import { useGeneralMerchandiseExpenseData } from '@/hooks/useSheetData';

export default function GeneralMerchandiseExpensesPage() {
  const {
    // State
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

    // Form state
    formDate,
    setFormDate,
    formAmount,
    setFormAmount,
    formDescription,
    setFormDescription,
    formCategory,
    setFormCategory,
    formNotes,
    setFormNotes,
    formReceipt,
    setFormReceipt,

    // Receipt viewer state
    viewingReceipt,
    receiptModalOpen,
    setReceiptModalOpen,
    receiptZoom,
    setReceiptZoom,
    receiptFileName,

    // Computed values
    categories,
    sourceOptions,
    totalExpenses,
    pendingExpenses,
    approvedExpenses,
    thisMonthExpenses,
    monthlyBreakdown,

    // Utility functions
    formatDate,
    formatCurrency,
    getCategoryColor,
    getSourceLabel,
    getSourceColor,

    // Event handlers
    handleAddExpense,
    handleEditExpense,
    handleDeleteExpense,
    handleSaveExpense,
    handleApprove,
    handleReject,
    handleViewReceipt,
    handleImportCSV,
    handleExportCSV,
    handleDownloadTemplate,
  } = useExpenses({ expenseDataHook: useGeneralMerchandiseExpenseData });

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
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
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
              onViewReceipt={handleViewReceipt}
              onApprove={handleApprove}
              onReject={handleReject}
              onEdit={handleEditExpense}
              onDelete={handleDeleteExpense}
            />
          ) : (
            <AnalyticsTable
              monthlyBreakdown={monthlyBreakdown}
              totalExpenses={totalExpenses}
              formatCurrency={formatCurrency}
              getCategoryColor={getCategoryColor}
            />
          )}
        </Stack>

        <ExpenseFormDialog
          opened={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          editingExpense={editingExpense}
          categories={categories}
          addTitle="ADD GENERAL MERCHANDISE OPERATIONS EXPENSE"
          editTitle="Edit General Merchandise Operations Expense"
          addSubtitle="Fill in the details to add a general merchandise operations expense"
          editSubtitle="Update the general merchandise operations expense details below"
          formDate={formDate}
          setFormDate={setFormDate}
          formAmount={formAmount}
          setFormAmount={setFormAmount}
          formDescription={formDescription}
          setFormDescription={setFormDescription}
          formCategory={formCategory}
          setFormCategory={setFormCategory}
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
