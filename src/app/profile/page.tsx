'use client';

import { useState, useEffect, useRef } from 'react';
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
  FileButton,
  ActionIcon,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import {
  IconUser,
  IconMail,
  IconLock,
  IconCheck,
  IconAlertCircle,
  IconShield,
  IconCalendar,
  IconCamera,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { timeAgo } from '@/utils/date';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  photoUrl: string | null;
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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const resetPhotoRef = useRef<() => void>(null);

  const form = useForm({
    initialValues: {
      name: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      name: (value: string) =>
        value.trim().length < 1 ? 'Name is required' : null,
      newPassword: (value: string) => {
        if (value && value.length < 6) {
          return 'Password must be at least 6 characters';
        }
        return null;
      },
      confirmPassword: (
        value: string,
        values: { newPassword: string; confirmPassword: string }
      ) => {
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
      setHasChanges(false);
    } catch (error) {
      showNotification({
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

  // Track changes to form values
  useEffect(() => {
    if (!profile) {
      return;
    }

    const nameChanged = form.values.name !== (profile.name || '');
    const hasPasswordInput = Boolean(
      form.values.currentPassword ||
        form.values.newPassword ||
        form.values.confirmPassword
    );

    setHasChanges(nameChanged || hasPasswordInput);
  }, [form.values, profile]);

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

      showNotification({
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
      setHasChanges(false);
    } catch (error) {
      showNotification({
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

  const handlePhotoUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      setUploadingPhoto(true);

      const formData = new FormData();
      formData.append('photo', file);

      const response = await fetch('/api/users/profile/photo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload photo');
      }

      showNotification({
        title: 'Success',
        message: data.message || 'Profile photo updated successfully',
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      // Update session and refresh profile
      await updateSession();
      await fetchProfile();

      // Reset file input
      if (resetPhotoRef.current) {
        resetPhotoRef.current();
      }
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to upload photo',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoRemove = async () => {
    try {
      setUploadingPhoto(true);

      const response = await fetch('/api/users/profile/photo', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove photo');
      }

      showNotification({
        title: 'Success',
        message: data.message || 'Profile photo removed successfully',
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      // Update session and refresh profile
      await updateSession();
      await fetchProfile();
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to remove photo',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setUploadingPhoto(false);
    }
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
              <Group align="flex-start">
                <Box pos="relative">
                  <Avatar
                    size={80}
                    radius="xl"
                    color="blue"
                    src={profile.photoUrl || undefined}
                  >
                    {!profile.photoUrl &&
                      (profile.name
                        ? profile.name.charAt(0).toUpperCase()
                        : profile.email.charAt(0).toUpperCase())}
                  </Avatar>
                  <Group gap={4} mt="xs">
                    <FileButton
                      resetRef={resetPhotoRef}
                      onChange={handlePhotoUpload}
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                    >
                      {(props) => (
                        <ActionIcon
                          {...props}
                          size="sm"
                          variant="light"
                          color="blue"
                          loading={uploadingPhoto}
                          title="Upload photo"
                        >
                          <IconCamera size={16} />
                        </ActionIcon>
                      )}
                    </FileButton>
                    {profile.photoUrl && (
                      <ActionIcon
                        size="sm"
                        variant="light"
                        color="red"
                        onClick={handlePhotoRemove}
                        loading={uploadingPhoto}
                        title="Remove photo"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    )}
                  </Group>
                  {!profile.photoUrl && (
                    <Text size="xs" c="dimmed" mt={4}>
                      Click{' '}
                      <IconUpload
                        size={12}
                        style={{ display: 'inline', verticalAlign: 'middle' }}
                      />{' '}
                      to upload
                    </Text>
                  )}
                </Box>
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
                      {new Date(profile.createdAt).toLocaleDateString('en-US', {
                        month: 'long',
                        day: '2-digit',
                        year: 'numeric',
                        timeZone: 'Asia/Manila',
                      })}
                    </Text>
                  </Group>
                  {profile.lastLoginAt && (
                    <Group gap="xs">
                      <IconShield size={16} />
                      <Text size="sm" c="dimmed">
                        Last login {timeAgo(profile.lastLoginAt)}
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
                        setHasChanges(false);
                      }}
                      disabled={!hasChanges}
                    >
                      Reset
                    </Button>
                    <Button
                      type="submit"
                      loading={updating}
                      disabled={!hasChanges}
                    >
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
