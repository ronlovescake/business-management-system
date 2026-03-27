'use client';

import React from 'react';
import { Button, Group, Stack, Text, Title } from '@mantine/core';
import { IconPlus, IconUsers } from '@tabler/icons-react';
import { UserManagementModals } from './components/UserManagementModals';
import { UserManagementTable } from './components/UserManagementTable';
import { useUserManagementPage } from './hooks/useUserManagementPage';

export function UserManagementPanel() {
  const {
    users,
    loading,
    modules,
    createModalOpen,
    editModalOpen,
    selectedUser,
    expandedUserId,
    userPermissions,
    loadingPermissions,
    savingPermissions,
    createForm,
    editForm,
    setCreateModalOpen,
    handleToggleUserExpand,
    handleToggleModule,
    handleSavePermissions,
    hasPermissionChanges,
    toggleSection,
    isSectionExpanded,
    isModuleIndeterminate,
    areAllChildrenChecked,
    handleCreateUser,
    handleEditUser,
    openEditModal,
    closeCreateModal,
    closeEditModal,
    getRoleBadgeColor,
  } = useUserManagementPage();

  return (
    <>
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <div>
            <Group gap="xs" align="center" mb={4}>
              <IconUsers size={28} stroke={1.5} />
              <Title order={2}>User Management</Title>
            </Group>
            <Text size="sm" c="dimmed">
              Manage user accounts, roles, and permissions
            </Text>
          </div>
          <Button
            leftSection={<IconPlus size={18} />}
            onClick={() => setCreateModalOpen(true)}
          >
            Add User
          </Button>
        </Group>

        <UserManagementTable
          users={users}
          loading={loading}
          expandedUserId={expandedUserId}
          modules={modules}
          userPermissions={userPermissions}
          loadingPermissions={loadingPermissions}
          savingPermissions={savingPermissions}
          getRoleBadgeColor={getRoleBadgeColor}
          hasPermissionChanges={hasPermissionChanges}
          onToggleUserExpand={handleToggleUserExpand}
          onSavePermissions={handleSavePermissions}
          onToggleModule={handleToggleModule}
          onToggleSection={toggleSection}
          isSectionExpanded={isSectionExpanded}
          isModuleIndeterminate={isModuleIndeterminate}
          areAllChildrenChecked={areAllChildrenChecked}
          onEditUser={openEditModal}
        />
      </Stack>

      <UserManagementModals
        createModalOpen={createModalOpen}
        editModalOpen={editModalOpen}
        selectedUser={selectedUser}
        createForm={createForm}
        editForm={editForm}
        onCloseCreate={closeCreateModal}
        onCloseEdit={closeEditModal}
        onSubmitCreate={handleCreateUser}
        onSubmitEdit={handleEditUser}
      />
    </>
  );
}
