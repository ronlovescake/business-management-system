import type { FormEventHandler } from 'react';
import {
  Alert,
  Button,
  Divider,
  Group,
  Stack,
  TextInput,
  Title,
  PasswordInput,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconLock,
  IconMail,
  IconUser,
} from '@tabler/icons-react';
import type { UseFormReturnType } from '@mantine/form';
import type { ProfileFormValues } from '../types';

interface ProfileFormProps {
  form: UseFormReturnType<ProfileFormValues>;
  profileEmail: string;
  hasChanges: boolean;
  updating: boolean;
  onReset: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function ProfileForm({
  form,
  profileEmail,
  hasChanges,
  updating,
  onReset,
  onSubmit,
}: ProfileFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <Stack gap="md">
        <Title order={4}>Update Profile</Title>

        <TextInput
          label="Name"
          placeholder="Your name"
          leftSection={<IconUser size={18} />}
          {...form.getInputProps('name')}
        />

        <TextInput
          label="Email"
          value={profileEmail}
          disabled
          leftSection={<IconMail size={18} />}
          description="Email cannot be changed"
        />

        <Divider label="Change Password (Optional)" labelPosition="center" />

        <Alert
          icon={<IconAlertCircle size={18} />}
          title="Password Security"
          color="blue"
          variant="light"
        >
          Leave password fields empty if you don&apos;t want to change your
          password. New password must be at least 6 characters long.
        </Alert>

        <PasswordInput
          label="Current Password"
          placeholder="Enter current password"
          leftSection={<IconLock size={18} />}
          {...form.getInputProps('currentPassword')}
        />

        <PasswordInput
          label="New Password"
          placeholder="Enter new password"
          leftSection={<IconLock size={18} />}
          {...form.getInputProps('newPassword')}
        />

        <PasswordInput
          label="Confirm New Password"
          placeholder="Confirm new password"
          leftSection={<IconLock size={18} />}
          {...form.getInputProps('confirmPassword')}
        />

        <Group justify="flex-end" mt="md">
          <Button
            type="button"
            variant="subtle"
            onClick={onReset}
            disabled={!hasChanges}
          >
            Reset
          </Button>
          <Button type="submit" loading={updating} disabled={!hasChanges}>
            Save Changes
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
