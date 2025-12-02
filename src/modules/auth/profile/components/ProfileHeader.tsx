import { memo } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  FileButton,
  Group,
  Stack,
  Text,
} from '@mantine/core';
import { IconCamera, IconTrash, IconUpload } from '@tabler/icons-react';
import type { MutableRefObject } from 'react';
import type { UserProfile } from '../types';

interface ProfileHeaderProps {
  profile: UserProfile;
  uploadingPhoto: boolean;
  onUpload: (file: File | null) => Promise<void> | void;
  onRemove: () => Promise<void> | void;
  resetPhotoRef: MutableRefObject<(() => void) | null>;
}

const roleBadgeColorMap: Record<string, string> = {
  SUPER_ADMIN: 'red',
  ADMIN: 'blue',
};

function getRoleBadgeColor(role: string) {
  return roleBadgeColorMap[role] ?? 'gray';
}

function ProfileHeaderComponent({
  profile,
  uploadingPhoto,
  onUpload,
  onRemove,
  resetPhotoRef,
}: ProfileHeaderProps) {
  return (
    <Stack gap="xs">
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
              onChange={onUpload}
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
                onClick={onRemove}
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
        <Stack gap={4} style={{ flex: 1 }}>
          <Group gap="xs" mb={4} wrap="nowrap">
            <Text size="xl" fw={600} style={{ maxWidth: '100%' }}>
              {profile.name || 'No name set'}
            </Text>
            <Badge color={getRoleBadgeColor(profile.role)} size="sm">
              {profile.role.replace('_', ' ')}
            </Badge>
            <Badge
              color={profile.isActive ? 'green' : 'red'}
              size="sm"
              variant="light"
            >
              {profile.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {profile.email}
          </Text>
        </Stack>
      </Group>
    </Stack>
  );
}

export const ProfileHeader = memo(ProfileHeaderComponent);
