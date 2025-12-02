import {
  Alert,
  Container,
  LoadingOverlay,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { ProfileHeader } from './ProfileHeader';
import { ProfileMeta } from './ProfileMeta';
import { ProfileForm } from './ProfileForm';
import { useProfileManagement } from '../hooks/useProfileManagement';

export function ProfilePage() {
  const {
    profile,
    loading,
    updating,
    uploadingPhoto,
    hasChanges,
    form,
    resetPhotoRef,
    handleSubmit,
    handleReset,
    handlePhotoUpload,
    handlePhotoRemove,
  } = useProfileManagement();

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={2}>My Profile</Title>
          <Text size="sm" c="dimmed">
            Manage your account settings and preferences
          </Text>
        </div>

        <Paper shadow="sm" p="xl" radius="md" pos="relative">
          <LoadingOverlay visible={loading} />

          {profile ? (
            <Stack gap="xl">
              <ProfileHeader
                profile={profile}
                uploadingPhoto={uploadingPhoto}
                onUpload={handlePhotoUpload}
                onRemove={handlePhotoRemove}
                resetPhotoRef={resetPhotoRef}
              />

              <ProfileMeta profile={profile} />

              <ProfileForm
                form={form}
                profileEmail={profile.email}
                hasChanges={hasChanges}
                updating={updating}
                onReset={handleReset}
                onSubmit={handleSubmit}
              />
            </Stack>
          ) : (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="red"
              variant="light"
            >
              We couldn&apos;t load your profile. Please refresh the page to try
              again.
            </Alert>
          )}
        </Paper>
      </Stack>
    </Container>
  );
}
