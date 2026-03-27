'use client';

import React, { type FormEvent } from 'react';
import {
  Alert,
  Button,
  Group,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { IconLock, IconMail, IconShield, IconUser } from '@tabler/icons-react';
import { UniversalModal } from '@/components/modals/UniversalModal';
import type { CreateUserFormValues, EditUserFormValues, User } from '../types';

type UserManagementModalsProps = {
  createModalOpen: boolean;
  editModalOpen: boolean;
  selectedUser: User | null;
  createForm: UseFormReturnType<CreateUserFormValues>;
  editForm: UseFormReturnType<EditUserFormValues>;
  onCloseCreate: () => void;
  onCloseEdit: () => void;
  onSubmitCreate: (event?: FormEvent<HTMLFormElement>) => void;
  onSubmitEdit: (event?: FormEvent<HTMLFormElement>) => void;
};

const roleOptions = [
  { value: 'USER', label: 'User' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];

export function UserManagementModals({
  createModalOpen,
  editModalOpen,
  selectedUser,
  createForm,
  editForm,
  onCloseCreate,
  onCloseEdit,
  onSubmitCreate,
  onSubmitEdit,
}: UserManagementModalsProps) {
  return (
    <>
      <UniversalModal
        opened={createModalOpen}
        onClose={onCloseCreate}
        title="Create New User"
        size="md"
      >
        <form onSubmit={onSubmitCreate}>
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
              data={roleOptions}
              {...createForm.getInputProps('role')}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={onCloseCreate}>
                Cancel
              </Button>
              <Button type="submit">Create User</Button>
            </Group>
          </Stack>
        </form>
      </UniversalModal>

      <UniversalModal
        opened={editModalOpen}
        onClose={onCloseEdit}
        title="Edit User"
        size="md"
      >
        <form onSubmit={onSubmitEdit}>
          <Stack gap="md">
            {selectedUser ? (
              <Alert icon={<IconUser size={18} />} color="blue" variant="light">
                <Text size="sm" fw={500}>
                  {selectedUser.email}
                </Text>
              </Alert>
            ) : null}

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
              data={roleOptions}
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
              <Button variant="subtle" onClick={onCloseEdit}>
                Cancel
              </Button>
              <Button type="submit">Update User</Button>
            </Group>
          </Stack>
        </form>
      </UniversalModal>
    </>
  );
}
