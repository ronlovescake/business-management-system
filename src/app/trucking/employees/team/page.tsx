'use client';

import { Stack } from '@mantine/core';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { EmployeeFormDialog } from './components/EmployeeFormDialog';
import { TeamControls } from './components/TeamControls';
import { TeamStatsCards } from './components/TeamStatsCards';
import { TeamTabsPanel } from './components/TeamTabsPanel';
import { useTeamPage } from './hooks/useTeamPage';

export default function Team() {
  const {
    // Derived view data
    stats,
    columns,
    actions,
    handleRowDoubleClick,

    // State
    employees,
    searchQuery,
    departmentFilter,
    statusFilter,
    isFormOpen,
    editingEmployee,
    activeTab,
    departments,

    // Setters
    setSearchQuery,
    setDepartmentFilter,
    setStatusFilter,
    setIsFormOpen,
    setActiveTab,

    // Event Handlers
    handleAddEmployee,
    handleSaveEmployee,
    handleImportCSV,
    handleExportCSV,
  } = useTeamPage();

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <TeamStatsCards stats={stats} />

        <TeamControls
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          departments={departments}
          departmentFilter={departmentFilter}
          onDepartmentFilterChange={setDepartmentFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onImportCSV={handleImportCSV}
          onExportCSV={handleExportCSV}
          onAddEmployee={handleAddEmployee}
        />

        <TeamTabsPanel
          activeTab={activeTab}
          onTabChange={setActiveTab}
          employees={employees}
          columns={columns}
          actions={actions}
          onRowDoubleClick={handleRowDoubleClick}
        />
      </Stack>

      <EmployeeFormDialog
        opened={isFormOpen}
        editingEmployee={editingEmployee}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveEmployee}
      />
    </PageLayout>
  );
}
