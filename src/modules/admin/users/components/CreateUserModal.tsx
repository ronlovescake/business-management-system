import type { FormEventHandler } from 'react';
import {
  Stack,
  TextInput,
  PasswordInput,
  Select,
  Group,
  Button,
} from '@mantine/core';
import { IconMail, IconUser, IconLock, IconShield } from '@tabler/icons-react';
import type { CreateUserForm } from '../types';
import { UniversalModal } from '@/components/modals/UniversalModal';

interface CreateUserModalProps {
  opened: boolean;
  onClose: () => void;
  form: CreateUserForm;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function CreateUserModal({
  opened,
  onClose,
  form,
  onSubmit,
}: CreateUserModalProps) {
  return (
    <UniversalModal
      opened={opened}
      onClose={() => {
        onClose();
      }}
      title="Create New User"
      size="md"
    >
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          <TextInput
            label="Email"
            placeholder="user@example.com"
            leftSection={<IconMail size={18} />}
            required
            {...form.getInputProps('email')}
          />

          <TextInput
            label="Name"
            placeholder="Full name"
            leftSection={<IconUser size={18} />}
            required
            {...form.getInputProps('name')}
          />

          <PasswordInput
            label="Password"
            placeholder="At least 6 characters"
            leftSection={<IconLock size={18} />}
            required
            {...form.getInputProps('password')}
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
            {...form.getInputProps('role')}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Create User</Button>
          </Group>
        </Stack>
      </form>
    </UniversalModal>
  );
}
