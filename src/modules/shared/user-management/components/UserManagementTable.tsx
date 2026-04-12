'use client';

import React from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Collapse,
  Group,
  LoadingOverlay,
  Menu,
  Paper,
  Table,
  Text,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconEdit,
} from '@tabler/icons-react';
import { timeAgo } from '@/utils/date';
import type { User, UserModule, UserRole } from '../types';
import { UserPermissionTree } from './UserPermissionTree';

type UserManagementTableProps = {
  users: User[];
  loading: boolean;
  expandedUserId: string | null;
  modules: UserModule[];
  userPermissions: Record<string, string[]>;
  loadingPermissions: Record<string, boolean>;
  savingPermissions: Record<string, boolean>;
  getRoleBadgeColor: (role: UserRole) => string;
  hasPermissionChanges: (userId: string) => boolean;
  onToggleUserExpand: (userId: string) => Promise<void> | void;
  onSavePermissions: (userId: string) => Promise<void> | void;
  onToggleModule: (
    userId: string,
    moduleId: string,
    module?: UserModule
  ) => void;
  onToggleSection: (userId: string, sectionId: string) => void;
  isSectionExpanded: (userId: string, sectionId: string) => boolean;
  isModuleIndeterminate: (userId: string, module: UserModule) => boolean;
  areAllChildrenChecked: (userId: string, module: UserModule) => boolean;
  onEditUser: (user: User) => void;
};

export function UserManagementTable({
  users,
  loading,
  expandedUserId,
  modules,
  userPermissions,
  loadingPermissions,
  savingPermissions,
  getRoleBadgeColor,
  hasPermissionChanges,
  onToggleUserExpand,
  onSavePermissions,
  onToggleModule,
  onToggleSection,
  isSectionExpanded,
  isModuleIndeterminate,
  areAllChildrenChecked,
  onEditUser,
}: UserManagementTableProps) {
  return (
    <Paper shadow="sm" p="md" radius="md" pos="relative">
      <LoadingOverlay visible={loading} />

      <Table.ScrollContainer minWidth={800}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>User</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Last Login</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users.map((user) => (
              <React.Fragment key={user.id}>
                <Table.Tr>
                  <Table.Td>
                    <Group gap="sm">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={() => void onToggleUserExpand(user.id)}
                      >
                        {expandedUserId === user.id ? (
                          <IconChevronDown size={16} />
                        ) : (
                          <IconChevronRight size={16} />
                        )}
                      </ActionIcon>
                      <Avatar size={36} radius="xl" color="blue">
                        {(user.name || user.email).charAt(0).toUpperCase()}
                      </Avatar>
                      <Box
                        style={{ cursor: 'pointer' }}
                        onClick={() => void onToggleUserExpand(user.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            void onToggleUserExpand(user.id);
                          }
                        }}
                      >
                        <Text size="sm" fw={500}>
                          {user.name || 'No name'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {user.email}
                        </Text>
                      </Box>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getRoleBadgeColor(user.role)} size="sm">
                      {user.role.replace('_', ' ')}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={user.isActive ? 'green' : 'red'}
                      size="sm"
                      variant="light"
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'Never'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(user.createdAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: '2-digit',
                        year: 'numeric',
                        timeZone: 'Asia/Manila',
                      })}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Menu position="bottom-end" withinPortal>
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray">
                          <IconDots size={18} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconEdit size={16} />}
                          onClick={() => onEditUser(user)}
                        >
                          Edit
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>

                {expandedUserId === user.id ? (
                  <Table.Tr>
                    <Table.Td
                      colSpan={6}
                      style={{ backgroundColor: '#f8f9fa' }}
                    >
                      <Collapse in>
                        <UserPermissionTree
                          userId={user.id}
                          modules={modules}
                          selectedModuleIds={userPermissions[user.id] || []}
                          loading={loadingPermissions[user.id] || false}
                          saving={savingPermissions[user.id] || false}
                          hasChanges={hasPermissionChanges(user.id)}
                          onSave={onSavePermissions}
                          onToggleModule={onToggleModule}
                          onToggleSection={onToggleSection}
                          isSectionExpanded={isSectionExpanded}
                          isModuleIndeterminate={isModuleIndeterminate}
                          areAllChildrenChecked={areAllChildrenChecked}
                        />
                      </Collapse>
                    </Table.Td>
                  </Table.Tr>
                ) : null}
              </React.Fragment>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {users.length === 0 && !loading ? (
        <Box py="xl" style={{ textAlign: 'center' }}>
          <Text c="dimmed">No users found</Text>
        </Box>
      ) : null}
    </Paper>
  );
}
