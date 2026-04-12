import { Fragment } from 'react';
import {
  Paper,
  LoadingOverlay,
  Table,
  ActionIcon,
  Avatar,
  Box,
  Text,
  Badge,
  Menu,
  Button,
  Group,
  Collapse,
  ScrollArea,
  Stack,
  Divider,
  Checkbox,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconDots,
  IconKey,
  IconEdit,
} from '@tabler/icons-react';
import { timeAgo } from '@/utils/date';
import type { Module, User, UserPermissionsMap, LoadingMap } from '../types';

interface UsersTableProps {
  users: User[];
  modules: Module[];
  loading: boolean;
  expandedUserId: string | null;
  userPermissions: UserPermissionsMap;
  loadingPermissions: LoadingMap;
  savingPermissions: LoadingMap;
  onToggleUserExpand: (userId: string) => Promise<void>;
  onToggleModule: (
    userId: string,
    moduleId: string,
    moduleObj?: Module
  ) => void;
  onSavePermissions: (userId: string) => Promise<void>;
  hasPermissionChanges: (userId: string) => boolean;
  onToggleSection: (userId: string, sectionId: string) => void;
  isSectionExpanded: (userId: string, sectionId: string) => boolean;
  isModuleIndeterminate: (userId: string, moduleData: Module) => boolean;
  areAllChildrenChecked: (userId: string, moduleData: Module) => boolean;
  onEditUser: (user: User) => void;
}

const getRoleBadgeColor = (role: User['role']) => {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'red';
    case 'ADMIN':
      return 'blue';
    default:
      return 'gray';
  }
};

export function UsersTable({
  users,
  modules,
  loading,
  expandedUserId,
  userPermissions,
  loadingPermissions,
  savingPermissions,
  onToggleUserExpand,
  onToggleModule,
  onSavePermissions,
  hasPermissionChanges,
  onToggleSection,
  isSectionExpanded,
  isModuleIndeterminate,
  areAllChildrenChecked,
  onEditUser,
}: UsersTableProps) {
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
              <Fragment key={user.id}>
                <Table.Tr>
                  <Table.Td>
                    <Group gap="sm">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={() => {
                          void onToggleUserExpand(user.id);
                        }}
                      >
                        {expandedUserId === user.id ? (
                          <IconChevronDown size={16} />
                        ) : (
                          <IconChevronRight size={16} />
                        )}
                      </ActionIcon>
                      <Avatar size={36} radius="xl" color="blue">
                        {user.name
                          ? user.name.charAt(0).toUpperCase()
                          : user.email.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          void onToggleUserExpand(user.id);
                        }}
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
                {expandedUserId === user.id && (
                  <Table.Tr>
                    <Table.Td
                      colSpan={6}
                      style={{ backgroundColor: '#f8f9fa' }}
                    >
                      <Collapse in={expandedUserId === user.id}>
                        <Box p="md">
                          <Group justify="space-between" mb="md">
                            <Group gap="xs">
                              <IconKey size={20} />
                              <Text size="sm" fw={600}>
                                Module Permissions
                              </Text>
                            </Group>
                            <Button
                              size="xs"
                              loading={Boolean(savingPermissions[user.id])}
                              disabled={!hasPermissionChanges(user.id)}
                              onClick={() => {
                                void onSavePermissions(user.id);
                              }}
                            >
                              Save Permissions
                            </Button>
                          </Group>

                          {loadingPermissions[user.id] ? (
                            <LoadingOverlay visible />
                          ) : (
                            <ScrollArea style={{ height: '86vh' }}>
                              <Stack gap="md">
                                {modules
                                  .filter((module) => !module.parentId)
                                  .map((category) => (
                                    <Paper key={category.id} p="sm" withBorder>
                                      <Stack gap="xs">
                                        <Group>
                                          <Checkbox
                                            label={
                                              <Text fw={600} size="sm">
                                                {category.displayName}
                                              </Text>
                                            }
                                            checked={
                                              userPermissions[
                                                user.id
                                              ]?.includes(category.id) ||
                                              areAllChildrenChecked(
                                                user.id,
                                                category
                                              )
                                            }
                                            indeterminate={isModuleIndeterminate(
                                              user.id,
                                              category
                                            )}
                                            onChange={() =>
                                              onToggleModule(
                                                user.id,
                                                category.id,
                                                category
                                              )
                                            }
                                          />
                                        </Group>
                                        {category.children &&
                                          category.children.length > 0 && (
                                            <>
                                              <Divider />
                                              <Box pl="xl">
                                                <Stack gap="md">
                                                  {category.children.map(
                                                    (section) => (
                                                      <Box key={section.id}>
                                                        <Group
                                                          gap="xs"
                                                          wrap="nowrap"
                                                        >
                                                          {section.children &&
                                                            section.children
                                                              .length > 0 && (
                                                              <ActionIcon
                                                                size="sm"
                                                                variant="subtle"
                                                                onClick={() =>
                                                                  onToggleSection(
                                                                    user.id,
                                                                    section.id
                                                                  )
                                                                }
                                                              >
                                                                {isSectionExpanded(
                                                                  user.id,
                                                                  section.id
                                                                ) ? (
                                                                  <IconChevronDown
                                                                    size={16}
                                                                  />
                                                                ) : (
                                                                  <IconChevronRight
                                                                    size={16}
                                                                  />
                                                                )}
                                                              </ActionIcon>
                                                            )}
                                                          <Checkbox
                                                            label={
                                                              <Text
                                                                fw={500}
                                                                size="sm"
                                                              >
                                                                {
                                                                  section.displayName
                                                                }
                                                              </Text>
                                                            }
                                                            checked={
                                                              userPermissions[
                                                                user.id
                                                              ]?.includes(
                                                                section.id
                                                              ) ||
                                                              areAllChildrenChecked(
                                                                user.id,
                                                                section
                                                              )
                                                            }
                                                            indeterminate={isModuleIndeterminate(
                                                              user.id,
                                                              section
                                                            )}
                                                            onChange={() =>
                                                              onToggleModule(
                                                                user.id,
                                                                section.id,
                                                                section
                                                              )
                                                            }
                                                          />
                                                        </Group>
                                                        {section.children &&
                                                          section.children
                                                            .length > 0 && (
                                                            <Collapse
                                                              in={isSectionExpanded(
                                                                user.id,
                                                                section.id
                                                              )}
                                                            >
                                                              <Box
                                                                pl="xl"
                                                                mt="xs"
                                                              >
                                                                <Stack gap="xs">
                                                                  {section.children.map(
                                                                    (
                                                                      subModule
                                                                    ) => (
                                                                      <Checkbox
                                                                        key={
                                                                          subModule.id
                                                                        }
                                                                        label={
                                                                          <Text
                                                                            size="sm"
                                                                            c="dimmed"
                                                                          >
                                                                            {
                                                                              subModule.displayName
                                                                            }
                                                                          </Text>
                                                                        }
                                                                        checked={userPermissions[
                                                                          user
                                                                            .id
                                                                        ]?.includes(
                                                                          subModule.id
                                                                        )}
                                                                        onChange={() =>
                                                                          onToggleModule(
                                                                            user.id,
                                                                            subModule.id,
                                                                            subModule
                                                                          )
                                                                        }
                                                                      />
                                                                    )
                                                                  )}
                                                                </Stack>
                                                              </Box>
                                                            </Collapse>
                                                          )}
                                                      </Box>
                                                    )
                                                  )}
                                                </Stack>
                                              </Box>
                                            </>
                                          )}
                                      </Stack>
                                    </Paper>
                                  ))}
                              </Stack>
                            </ScrollArea>
                          )}
                        </Box>
                      </Collapse>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Fragment>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}
