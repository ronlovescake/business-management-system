import { memo } from 'react';
import { Box, Divider, Group, Stack, Text } from '@mantine/core';
import { IconCalendar, IconShield } from '@tabler/icons-react';
import { timeAgo } from '@/utils/date';
import type { UserProfile } from '../types';

interface ProfileMetaProps {
  profile: UserProfile;
}

function ProfileMetaComponent({ profile }: ProfileMetaProps) {
  return (
    <Stack gap="md">
      <Box>
        <Text size="sm" fw={500} mb="xs">
          Account Information
        </Text>
        <Stack gap="xs">
          <Group gap="xs">
            <IconCalendar size={16} />
            <Text size="sm" c="dimmed">
              Member since {new Date(profile.createdAt).toLocaleDateString('en-US', {
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
    </Stack>
  );
}

export const ProfileMeta = memo(ProfileMetaComponent);
