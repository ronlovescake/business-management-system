import type { FormEventHandler } from 'react';
import {
  Stack,
  TextInput,
  Select,
  Switch,
  PasswordInput,
  Group,
  Button,
  Alert,
  Text,
} from '@mantine/core';
import { IconUser, IconShield, IconLock } from '@tabler/icons-react';
import type { EditUserForm, User } from '../types';
import { UniversalModal } from '@/components/modals/UniversalModal';

interface EditUserModalProps {
  opened: boolean;
  onClose: () => void;
  form: EditUserForm;
  onSubmit: FormEventHandler<HTMLFormElement>;
  user: User | null;
}

export function EditUserModal({
  opened,
  onClose,
  form,
  onSubmit,
  user,
}: EditUserModalProps) {
  return (
    <UniversalModal
      opened={opened}
      onClose={onClose}
      title="Edit User"
      size="md"
    >
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          {user && (
            <Alert icon={<IconUser size={18} />} color="blue" variant="light">
              <Text size="sm" fw={500}>
                {user.email}
              </Text>
            </Alert>
          )}

          <TextInput
            label="Name"
            placeholder="Full name"
            leftSection={<IconUser size={18} />}
            required
            {...form.getInputProps('name')}
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

          <Switch
            label="Active"
            description="Inactive users cannot log in"
            {...form.getInputProps('isActive', { type: 'checkbox' })}
          />

          <PasswordInput
            label="New Password (Optional)"
            placeholder="Leave empty to keep current password"
            leftSection={<IconLock size={18} />}
            {...form.getInputProps('password')}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Update User</Button>
          </Group>
        </Stack>
      </form>
    </UniversalModal>
  );
}
