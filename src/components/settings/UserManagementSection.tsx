'use client';

import { useState, useEffect, Fragment } from 'react';
import {
  Paper,
  Title,
  Text,
  Button,
  Stack,
  Group,
  Badge,
  Table,
  ActionIcon,
  Modal,
  TextInput,
  PasswordInput,
  Select,
  Switch,
  Menu,
  LoadingOverlay,
  Avatar,
  Alert,
  Box,
  Collapse,
  Checkbox,
  Divider,
  ScrollArea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import {
  IconPlus,
  IconEdit,
  IconDots,
  IconUser,
  IconMail,
  IconLock,
  IconShield,
  IconCheck,
  IconAlertCircle,
  IconUsers,
  IconChevronDown,
  IconChevronRight,
  IconKey,
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Module {
  id: string;
  name: string;
  displayName: string;
  path: string;
  category: string;
  icon: string | null;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  children?: Module[];
}

interface UserPermission {
  id: string;
  userId: string;
  moduleId: string;
  canAccess: boolean;
  module: Module;
}

export function UserManagementSection() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [userPermissions, setUserPermissions] = useState<
    Record<string, string[]>
  >({});
  const [originalPermissions, setOriginalPermissions] = useState<
    Record<string, string[]>
  >({});
  const [loadingPermissions, setLoadingPermissions] = useState<
    Record<string, boolean>
  >({});
  const [savingPermissions, setSavingPermissions] = useState<
    Record<string, boolean>
  >({});
  const [expandedSections, setExpandedSections] = useState<
    Record<string, Set<string>>
  >({});

  const createForm = useForm({
    initialValues: {
      email: '',
      name: '',
      password: '',
      role: 'USER' as 'USER' | 'ADMIN' | 'SUPER_ADMIN',
    },
    validate: {
      email: (value: string) =>
        /^\S+@\S+$/.test(value) ? null : 'Invalid email',
      name: (value: string) =>
        value.trim().length < 1 ? 'Name is required' : null,
      password: (value: string) =>
        value.length < 6 ? 'Password must be at least 6 characters' : null,
    },
  });

  const editForm = useForm({
    initialValues: {
      name: '',
      role: 'USER' as 'USER' | 'ADMIN' | 'SUPER_ADMIN',
      isActive: true,
      password: '',
    },
    validate: {
      name: (value: string) =>
        value.trim().length < 1 ? 'Name is required' : null,
      password: (value: string) =>
        value && value.length < 6
          ? 'Password must be at least 6 characters'
          : null,
    },
  });

  useEffect(() => {
    void fetchUsers();
    void fetchModules();
  }, []);

  const fetchModules = async () => {
    try {
      const response = await fetch('/api/modules');
      if (!response.ok) {
        throw new Error('Failed to fetch modules');
      }
      const data = await response.json();
      setModules(data);
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Failed to load modules',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    }
  };

  const fetchUserPermissions = async (userId: string) => {
    try {
      setLoadingPermissions((prev) => ({ ...prev, [userId]: true }));
      const response = await fetch(`/api/users/${userId}/permissions`);
      if (!response.ok) {
        throw new Error('Failed to fetch permissions');
      }
      const data: UserPermission[] = await response.json();
      const moduleIds = data.map((p) => p.moduleId);
      setUserPermissions((prev) => ({ ...prev, [userId]: moduleIds }));
      setOriginalPermissions((prev) => ({ ...prev, [userId]: moduleIds }));
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Failed to load user permissions',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setLoadingPermissions((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleToggleUserExpand = async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
    } else {
      setExpandedUserId(userId);
      if (!userPermissions[userId]) {
        await fetchUserPermissions(userId);
      }
    }
  };

  const handleToggleModule = (
    userId: string,
    moduleId: string,
    moduleObj?: Module
  ) => {
    setUserPermissions((prev) => {
      const current = prev[userId] || [];
      const isCurrentlyChecked = current.includes(moduleId);

      // Find all descendant module IDs
      const getAllDescendantIds = (mod: Module): string[] => {
        const ids: string[] = [mod.id];
        if (mod.children && mod.children.length > 0) {
          mod.children.forEach((child) => {
            ids.push(...getAllDescendantIds(child));
          });
        }
        return ids;
      };

      let newPermissions = [...current];

      if (moduleObj) {
        // Get all IDs including children
        const allIds = getAllDescendantIds(moduleObj);

        if (isCurrentlyChecked) {
          // Remove module and all its children
          newPermissions = newPermissions.filter((id) => !allIds.includes(id));
        } else {
          // Add module and all its children
          allIds.forEach((id) => {
            if (!newPermissions.includes(id)) {
              newPermissions.push(id);
            }
          });
        }
      } else {
        // Fallback for single toggle (no children info)
        if (isCurrentlyChecked) {
          newPermissions = newPermissions.filter((id) => id !== moduleId);
        } else {
          newPermissions.push(moduleId);
        }
      }

      return { ...prev, [userId]: newPermissions };
    });
  };

  const handleSavePermissions = async (userId: string) => {
    try {
      setSavingPermissions((prev) => ({ ...prev, [userId]: true }));
      const moduleIds = userPermissions[userId] || [];

      const response = await fetch(`/api/users/${userId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to update permissions');
      }

      // Update original permissions to match current after successful save
      setOriginalPermissions((prev) => ({ ...prev, [userId]: moduleIds }));

      showNotification({
        title: 'Success',
        message: 'Permissions updated successfully',
        color: 'green',
        icon: <IconCheck size={18} />,
      });
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Failed to update permissions',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setSavingPermissions((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const hasPermissionChanges = (userId: string): boolean => {
    const current = userPermissions[userId] || [];
    const original = originalPermissions[userId] || [];

    if (current.length !== original.length) {
      return true;
    }

    const currentSorted = [...current].sort();
    const originalSorted = [...original].sort();

    return !currentSorted.every((id, index) => id === originalSorted[index]);
  };

  const toggleSection = (userId: string, sectionId: string) => {
    setExpandedSections((prev) => {
      const userSections = prev[userId] || new Set<string>();
      const newSet = new Set(userSections);

      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }

      return { ...prev, [userId]: newSet };
    });
  };

  const isSectionExpanded = (userId: string, sectionId: string): boolean => {
    return expandedSections[userId]?.has(sectionId) ?? false;
  };

  // Helper to get all descendant IDs of a module
  const getAllDescendantIds = (module: Module): string[] => {
    const ids: string[] = [];
    if (module.children && module.children.length > 0) {
      module.children.forEach((child) => {
        ids.push(child.id);
        ids.push(...getAllDescendantIds(child));
      });
    }
    return ids;
  };

  // Check if a module should be indeterminate (some but not all children checked)
  const isModuleIndeterminate = (userId: string, module: Module): boolean => {
    if (!module.children || module.children.length === 0) {
      return false;
    }

    const permissions = userPermissions[userId] || [];
    const descendantIds = getAllDescendantIds(module);

    if (descendantIds.length === 0) {
      return false;
    }

    const checkedDescendants = descendantIds.filter((id) =>
      permissions.includes(id)
    );

    // Indeterminate if some (but not all) descendants are checked
    return (
      checkedDescendants.length > 0 &&
      checkedDescendants.length < descendantIds.length
    );
  };

  // Check if all children of a module are checked
  const areAllChildrenChecked = (userId: string, module: Module): boolean => {
    if (!module.children || module.children.length === 0) {
      return false;
    }

    const permissions = userPermissions[userId] || [];
    const descendantIds = getAllDescendantIds(module);

    if (descendantIds.length === 0) {
      return false;
    }

    return descendantIds.every((id) => permissions.includes(id));
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Failed to load users',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = createForm.onSubmit(async (values) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      showNotification({
        title: 'Success',
        message: data.message || 'User created successfully',
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      setCreateModalOpen(false);
      createForm.reset();
      fetchUsers();
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to create user',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    }
  });

  const handleEditUser = editForm.onSubmit(async (values) => {
    if (!selectedUser) {
      return;
    }

    try {
      const updateData: {
        name?: string;
        role?: string;
        isActive?: boolean;
        password?: string;
      } = {};

      if (values.name !== selectedUser.name) {
        updateData.name = values.name;
      }
      if (values.role !== selectedUser.role) {
        updateData.role = values.role;
      }
      if (values.isActive !== selectedUser.isActive) {
        updateData.isActive = values.isActive;
      }
      if (values.password) {
        updateData.password = values.password;
      }

      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      showNotification({
        title: 'Success',
        message: data.message || 'User updated successfully',
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      setEditModalOpen(false);
      setSelectedUser(null);
      editForm.reset();
      fetchUsers();
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to update user',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    }
  });

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    editForm.setValues({
      name: user.name || '',
      role: user.role,
      isActive: user.isActive,
      password: '',
    });
    setEditModalOpen(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'red';
      case 'ADMIN':
        return 'blue';
      default:
        return 'gray';
    }
  };

  return (
    <Box>
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
                    <Table.Tr key={user.id}>
                      <Table.Td>
                        <Group gap="sm">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            onClick={() => void handleToggleUserExpand(user.id)}
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
                            onClick={() => void handleToggleUserExpand(user.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                void handleToggleUserExpand(user.id);
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
                          {user.lastLoginAt
                            ? formatDistanceToNow(new Date(user.lastLoginAt), {
                                addSuffix: true,
                              })
                            : 'Never'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {new Date(user.createdAt).toLocaleDateString()}
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
                              onClick={() => openEditModal(user)}
                            >
                              Edit
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    </Table.Tr>
                    {expandedUserId === user.id && (
                      <Table.Tr key={`${user.id}-permissions`}>
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
                                  loading={savingPermissions[user.id]}
                                  disabled={!hasPermissionChanges(user.id)}
                                  onClick={() =>
                                    void handleSavePermissions(user.id)
                                  }
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
                                      .filter((m) => !m.parentId)
                                      .map((category) => (
                                        <Paper
                                          key={category.id}
                                          p="sm"
                                          withBorder
                                        >
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
                                                  handleToggleModule(
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
                                                                  .length >
                                                                  0 && (
                                                                  <ActionIcon
                                                                    size="sm"
                                                                    variant="subtle"
                                                                    onClick={() =>
                                                                      toggleSection(
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
                                                                        size={
                                                                          16
                                                                        }
                                                                      />
                                                                    ) : (
                                                                      <IconChevronRight
                                                                        size={
                                                                          16
                                                                        }
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
                                                                  handleToggleModule(
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
                                                                              handleToggleModule(
                                                                                user.id,
                                                                                subModule.id
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

          {users.length === 0 && !loading && (
            <Box py="xl" style={{ textAlign: 'center' }}>
              <Text c="dimmed">No users found</Text>
            </Box>
          )}
        </Paper>
      </Stack>

      {/* Create User Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          createForm.reset();
        }}
        title="Create New User"
        size="md"
      >
        <form onSubmit={handleCreateUser}>
          <Stack gap="md">
            <TextInput
              label="Email"
              placeholder="user@example.com"
              leftSection={<IconMail size={18} />}
              required
              {...createForm.getInputProps('email')}
            />

            <TextInput
              label="Name"
              placeholder="Full name"
              leftSection={<IconUser size={18} />}
              required
              {...createForm.getInputProps('name')}
            />

            <PasswordInput
              label="Password"
              placeholder="At least 6 characters"
              leftSection={<IconLock size={18} />}
              required
              {...createForm.getInputProps('password')}
            />

            <Select
              label="Role"
              placeholder="Select role"
              leftSection={<IconShield size={18} />}
              required
              data={[
                { value: 'USER', label: 'User' },
                { value: 'ADMIN', label: 'Admin' },
                { value: 'SUPER_ADMIN', label: 'Super Admin' },
              ]}
              {...createForm.getInputProps('role')}
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="subtle"
                onClick={() => {
                  setCreateModalOpen(false);
                  createForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Create User</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        opened={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedUser(null);
          editForm.reset();
        }}
        title="Edit User"
        size="md"
      >
        <form onSubmit={handleEditUser}>
          <Stack gap="md">
            {selectedUser && (
              <Alert icon={<IconUser size={18} />} color="blue" variant="light">
                <Text size="sm" fw={500}>
                  {selectedUser.email}
                </Text>
              </Alert>
            )}

            <TextInput
              label="Name"
              placeholder="Full name"
              leftSection={<IconUser size={18} />}
              required
              {...editForm.getInputProps('name')}
            />

            <Select
              label="Role"
              placeholder="Select role"
              leftSection={<IconShield size={18} />}
              required
              data={[
                { value: 'USER', label: 'User' },
                { value: 'ADMIN', label: 'Admin' },
                { value: 'SUPER_ADMIN', label: 'Super Admin' },
              ]}
              {...editForm.getInputProps('role')}
            />

            <Switch
              label="Active"
              description="Inactive users cannot log in"
              {...editForm.getInputProps('isActive', { type: 'checkbox' })}
            />

            <PasswordInput
              label="New Password (Optional)"
              placeholder="Leave empty to keep current password"
              leftSection={<IconLock size={18} />}
              {...editForm.getInputProps('password')}
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="subtle"
                onClick={() => {
                  setEditModalOpen(false);
                  setSelectedUser(null);
                  editForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Update User</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Box>
  );
}

export default UserManagementSection;
