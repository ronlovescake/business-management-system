import {
  Container,
  Stack,
  Group,
  Title,
  Text,
  Button,
  Box,
} from '@mantine/core';
import { IconUsers, IconPlus } from '@tabler/icons-react';
import { UsersTable } from './UsersTable';
import { CreateUserModal } from './CreateUserModal';
import { EditUserModal } from './EditUserModal';
import { useUserManagement } from '../hooks/useUserManagement';

export function UsersPage() {
  const {
    users,
    modules,
    loading,
    expandedUserId,
    userPermissions,
    loadingPermissions,
    savingPermissions,
    createModalOpen,
    editModalOpen,
    selectedUser,
    createForm,
    editForm,
    handleCreateUserSubmit,
    handleEditUserSubmit,
    openCreateModal,
    closeCreateModal,
    openEditModal,
    closeEditModal,
    handleToggleUserExpand,
    handleToggleModule,
    handleSavePermissions,
    hasPermissionChanges,
    toggleSection,
    isSectionExpanded,
    isModuleIndeterminate,
    areAllChildrenChecked,
  } = useUserManagement();

  return (
    <Container size="xl" py="xl">
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
            onClick={openCreateModal}
          >
            Add User
          </Button>
        </Group>

        <UsersTable
          users={users}
          modules={modules}
          loading={loading}
          expandedUserId={expandedUserId}
          userPermissions={userPermissions}
          loadingPermissions={loadingPermissions}
          savingPermissions={savingPermissions}
          onToggleUserExpand={handleToggleUserExpand}
          onToggleModule={handleToggleModule}
          onSavePermissions={handleSavePermissions}
          hasPermissionChanges={hasPermissionChanges}
          onToggleSection={toggleSection}
          isSectionExpanded={isSectionExpanded}
          isModuleIndeterminate={isModuleIndeterminate}
          areAllChildrenChecked={areAllChildrenChecked}
          onEditUser={openEditModal}
        />

        {users.length === 0 && !loading && (
          <Box py="xl" style={{ textAlign: 'center' }}>
            <Text c="dimmed">No users found</Text>
          </Box>
        )}
      </Stack>

      <CreateUserModal
        opened={createModalOpen}
        onClose={closeCreateModal}
        form={createForm}
        onSubmit={handleCreateUserSubmit}
      />

      <EditUserModal
        opened={editModalOpen}
        onClose={closeEditModal}
        form={editForm}
        onSubmit={handleEditUserSubmit}
        user={selectedUser}
      />
    </Container>
  );
}
