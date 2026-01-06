'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '../../../components/layout/PageLayout';
import { ExpenseFormDialog } from './components/ExpenseFormDialog';
import { StatsCards } from './components/StatsCards';
import { ExpenseControls } from './components/ExpenseControls';
import { ExpenseListTable } from './components/ExpenseListTable';
import { AnalyticsTable } from './components/AnalyticsTable';
import { ReceiptViewerModal } from './components/ReceiptViewerModal';
import { useExpenses } from './hooks/useExpenses';
import { ExpensesErrorBoundary } from './components/ExpensesErrorBoundary';

/**
 * Expenses Page Component
 *
 * This is now a thin orchestration layer that:
 * - Uses the useExpenses hook for all business logic
 * - Focuses solely on UI composition and layout
 * - Delegates rendering to specialized components
 *
 * Architecture Benefits:
 * - Business logic is testable in isolation (useExpenses hook)
 * - Page component is ~200 lines instead of 1,643 lines
 * - UI can be easily swapped (e.g., switching from Mantine to another library)
 * - Clear separation of concerns
 */
export default function Expenses() {
  // Use the custom hook for all business logic
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
    formVehicleId,
    setFormVehicleId,
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
    vehicleOptions,
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
  } = useExpenses();

  return (
    <ExpensesErrorBoundary>
      <PageLayout fluid withPadding>
        <Stack gap="lg">
          {/* Stats Cards */}
          <StatsCards
            totalExpenses={totalExpenses}
            pendingExpenses={pendingExpenses}
            approvedExpenses={approvedExpenses}
            thisMonthExpenses={thisMonthExpenses}
            formatCurrency={formatCurrency}
          />

          {/* Controls - Tabs, Search, Filters, Actions */}
          <ExpenseControls
            activeTab={activeTab}
            onTabChange={setActiveTab}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterCategory={filterCategory}
            onCategoryFilterChange={setFilterCategory}
            filterStatus={filterStatus}
            onStatusFilterChange={setFilterStatus}
            categories={categories}
            onImportCSV={handleImportCSV}
            onExportCSV={handleExportCSV}
            onAddExpense={handleAddExpense}
            isImporting={isImporting}
          />

          {/* Tables */}
          {activeTab === 'list' ? (
            <ExpenseListTable
              expenses={expenses}
              filteredExpenses={filteredExpenses}
              formatDate={formatDate}
              formatCurrency={formatCurrency}
              getCategoryColor={getCategoryColor}
              getSourceLabel={getSourceLabel}
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

        {/* Add/Edit Expense Dialog */}
        <ExpenseFormDialog
          opened={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          editingExpense={editingExpense}
          categories={categories}
          vehicleOptions={vehicleOptions}
          formDate={formDate}
          setFormDate={setFormDate}
          formAmount={formAmount}
          setFormAmount={setFormAmount}
          formDescription={formDescription}
          setFormDescription={setFormDescription}
          formCategory={formCategory}
          setFormCategory={setFormCategory}
          formVehicleId={formVehicleId}
          setFormVehicleId={setFormVehicleId}
          formNotes={formNotes}
          setFormNotes={setFormNotes}
          formReceipt={formReceipt}
          setFormReceipt={setFormReceipt}
          onSave={handleSaveExpense}
        />

        {/* Receipt Viewer Modal */}
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
