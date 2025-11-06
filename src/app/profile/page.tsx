'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Group,
  Badge,
  Divider,
  Avatar,
  Box,
  Alert,
  LoadingOverlay,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconUser,
  IconMail,
  IconLock,
  IconCheck,
  IconAlertCircle,
  IconShield,
  IconCalendar,
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function ProfilePage() {
  const { update: updateSession } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const form = useForm({
    initialValues: {
      name: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      name: (value) => (value.trim().length < 1 ? 'Name is required' : null),
      newPassword: (value) => {
        if (value && value.length < 6) {
          return 'Password must be at least 6 characters';
        }
        return null;
      },
      confirmPassword: (value, values) => {
        if (values.newPassword && value !== values.newPassword) {
          return 'Passwords do not match';
        }
        return null;
      },
    },
  });

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users/profile');

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setProfile(data);
      form.setValues({
        name: data.name || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load profile',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      setUpdating(true);

      const updateData: {
        name?: string;
        currentPassword?: string;
        newPassword?: string;
      } = {};

      if (values.name !== profile?.name) {
        updateData.name = values.name;
      }

      if (values.newPassword) {
        if (!values.currentPassword) {
          form.setFieldError(
            'currentPassword',
            'Current password is required to set a new password'
          );
          return;
        }
        updateData.currentPassword = values.currentPassword;
        updateData.newPassword = values.newPassword;
      }

      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      notifications.show({
        title: 'Success',
        message: data.message || 'Profile updated successfully',
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      // Update session if name changed
      if (updateData.name) {
        await updateSession();
      }

      // Clear password fields
      form.setValues({
        ...form.values,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      // Refresh profile
      await fetchProfile();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to update profile',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setUpdating(false);
    }
  });

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
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>My Profile</Title>
            <Text size="sm" c="dimmed">
              Manage your account settings and preferences
            </Text>
          </div>
        </Group>

        <Paper shadow="sm" p="xl" radius="md" pos="relative">
          <LoadingOverlay visible={loading} />

          {profile && (
            <Stack gap="xl">
              {/* Profile Header */}
              <Group>
                <Avatar size={80} radius="xl" color="blue">
                  {profile.name
                    ? profile.name.charAt(0).toUpperCase()
                    : profile.email.charAt(0).toUpperCase()}
                </Avatar>
                <div style={{ flex: 1 }}>
                  <Group gap="xs" mb={4}>
                    <Text size="xl" fw={600}>
                      {profile.name || 'No name set'}
                    </Text>
                    <Badge color={getRoleBadgeColor(profile.role)} size="sm">
                      {profile.role.replace('_', ' ')}
                    </Badge>
                    {profile.isActive ? (
                      <Badge color="green" size="sm" variant="light">
                        Active
                      </Badge>
                    ) : (
                      <Badge color="red" size="sm" variant="light">
                        Inactive
                      </Badge>
                    )}
                  </Group>
                  <Text size="sm" c="dimmed">
                    {profile.email}
                  </Text>
                </div>
              </Group>

              {/* Account Info */}
              <Box>
                <Text size="sm" fw={500} mb="xs">
                  Account Information
                </Text>
                <Stack gap="xs">
                  <Group gap="xs">
                    <IconCalendar size={16} />
                    <Text size="sm" c="dimmed">
                      Member since{' '}
                      {new Date(profile.createdAt).toLocaleDateString()}
                    </Text>
                  </Group>
                  {profile.lastLoginAt && (
                    <Group gap="xs">
                      <IconShield size={16} />
                      <Text size="sm" c="dimmed">
                        Last login{' '}
                        {formatDistanceToNow(new Date(profile.lastLoginAt), {
                          addSuffix: true,
                        })}
                      </Text>
                    </Group>
                  )}
                </Stack>
              </Box>

              <Divider />

              {/* Edit Profile Form */}
              <form onSubmit={handleSubmit}>
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
                    value={profile.email}
                    disabled
                    leftSection={<IconMail size={18} />}
                    description="Email cannot be changed"
                  />

                  <Divider
                    label="Change Password (Optional)"
                    labelPosition="center"
                  />

                  <Alert
                    icon={<IconAlertCircle size={18} />}
                    title="Password Security"
                    color="blue"
                    variant="light"
                  >
                    Leave password fields empty if you don&apos;t want to change
                    your password. New password must be at least 6 characters
                    long.
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
                      onClick={() => {
                        form.setValues({
                          name: profile.name || '',
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: '',
                        });
                      }}
                    >
                      Reset
                    </Button>
                    <Button type="submit" loading={updating}>
                      Save Changes
                    </Button>
                  </Group>
                </Stack>
              </form>
            </Stack>
          )}
        </Paper>
      </Stack>
    </Container>
  );
}
