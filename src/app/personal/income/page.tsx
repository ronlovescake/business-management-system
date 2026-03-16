'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { usePersonalIncomeView } from '@/app/personal/hooks/usePersonalIncomeView';
import { IncomeFormDialog } from './components/IncomeFormDialog';
import { IncomeListTable } from './components/IncomeListTable';
import { IncomeControls } from './components/IncomeControls';
import { IncomeStatsCards } from './components/IncomeStatsCards';
import { IncomeAnalyticsTable } from './components/IncomeAnalyticsTable';

function formatCurrencyPhp(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export default function PersonalIncomePage() {
  const {
    income,
    filteredIncome,
    accountOptions,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    filterAccount,
    setFilterAccount,
    filterMonth,
    setFilterMonth,
    filterYear,
    setFilterYear,
    monthOptions,
    yearOptions,
    isModalOpen,
    setIsModalOpen,
    editingIncome,
    draft,
    setDraft,
    isImporting,
    types,
    accounts,
    totals,
    handleAddIncome,
    handleEditIncome,
    handleDeleteIncome,
    handleSaveIncome,
    handleImportCSV,
    handleExportCSV,
  } = usePersonalIncomeView();

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <IncomeStatsCards
          totalIncome={totals.totalIncome}
          incomeCount={totals.incomeCount}
          thisMonthIncome={totals.thisMonthIncome}
          last30DaysIncome={totals.last30DaysIncome}
          formatCurrency={formatCurrencyPhp}
        />

        <IncomeControls
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterType={filterType}
          onTypeFilterChange={(val) => setFilterType(val as typeof filterType)}
          filterAccount={filterAccount}
          onAccountFilterChange={setFilterAccount}
          filterMonth={filterMonth}
          onMonthFilterChange={setFilterMonth}
          filterYear={filterYear}
          onYearFilterChange={setFilterYear}
          monthOptions={monthOptions}
          yearOptions={yearOptions}
          types={types}
          accounts={accounts}
          onImportCSV={handleImportCSV}
          onExportCSV={handleExportCSV}
          onAddIncome={handleAddIncome}
          isImporting={isImporting}
        />

        {activeTab === 'list' ? (
          <IncomeListTable
            income={income}
            filteredIncome={filteredIncome}
            formatCurrency={formatCurrencyPhp}
            onEdit={handleEditIncome}
            onDelete={handleDeleteIncome}
          />
        ) : (
          <IncomeAnalyticsTable
            income={filteredIncome}
            formatCurrency={formatCurrencyPhp}
          />
        )}
      </Stack>

      <IncomeFormDialog
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingIncome ? 'EDIT PERSONAL INCOME' : 'ADD PERSONAL INCOME'}
        description={
          editingIncome
            ? 'Update this income record.'
            : 'Add money coming into your household (business draw, salary, refund, etc.).'
        }
        initial={draft}
        onChange={setDraft}
        onSave={handleSaveIncome}
        accountOptions={accountOptions}
      />
    </PageLayout>
  );
}
