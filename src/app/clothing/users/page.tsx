'use client';

import { useState, useEffect } from 'react';
import {
  Container,
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
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconDots,
  IconUser,
  IconMail,
  IconLock,
  IconShield,
  IconCheck,
  IconAlertCircle,
  IconUsers,
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

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const createForm = useForm({
    initialValues: {
      email: '',
      name: '',
      password: '',
      role: 'USER' as 'USER' | 'ADMIN' | 'SUPER_ADMIN',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      name: (value) => (value.trim().length < 1 ? 'Name is required' : null),
      password: (value) =>
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
      name: (value) => (value.trim().length < 1 ? 'Name is required' : null),
      password: (value) =>
        value && value.length < 6
          ? 'Password must be at least 6 characters'
          : null,
    },
  });

  useEffect(() => {
    fetchUsers();
  }, []);

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
      notifications.show({
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

      notifications.show({
        title: 'Success',
        message: data.message || 'User created successfully',
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      setCreateModalOpen(false);
      createForm.reset();
      fetchUsers();
    } catch (error) {
      notifications.show({
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

      notifications.show({
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
      notifications.show({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to update user',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    }
  });

  const handleDeleteUser = async (user: User) => {
    modals.openConfirmModal({
      title: 'Delete User',
      children: (
        <Stack gap="sm">
          <Text size="sm">
            Are you sure you want to delete this user? This action cannot be
            undone.
          </Text>
          <Alert
            color="red"
            variant="light"
            icon={<IconAlertCircle size={18} />}
          >
            <Text size="sm" fw={500}>
              {user.name || user.email}
            </Text>
            <Text size="xs" c="dimmed">
              {user.email}
            </Text>
          </Alert>
        </Stack>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/users/${user.id}`, {
            method: 'DELETE',
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to delete user');
          }

          notifications.show({
            title: 'Success',
            message: data.message || 'User deleted successfully',
            color: 'green',
            icon: <IconCheck size={18} />,
          });

          fetchUsers();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message:
              error instanceof Error ? error.message : 'Failed to delete user',
            color: 'red',
            icon: <IconAlertCircle size={18} />,
          });
        }
      },
    });
  };

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
                  <Table.Tr key={user.id}>
                    <Table.Td>
                      <Group gap="sm">
                        <Avatar size={36} radius="xl" color="blue">
                          {user.name
                            ? user.name.charAt(0).toUpperCase()
                            : user.email.charAt(0).toUpperCase()}
                        </Avatar>
                        <div>
                          <Text size="sm" fw={500}>
                            {user.name || 'No name'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {user.email}
                          </Text>
                        </div>
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
                          <Menu.Item
                            leftSection={<IconTrash size={16} />}
                            color="red"
                            onClick={() => handleDeleteUser(user)}
                          >
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
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
    </Container>
  );
}
