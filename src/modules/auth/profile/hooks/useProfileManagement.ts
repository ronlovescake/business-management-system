import { useCallback, useEffect, useRef, useState, createElement } from 'react';
import { useSession } from 'next-auth/react';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import type {
  ProfileFormValues,
  ProfileUpdatePayload,
  UserProfile,
} from '../types';

export function useProfileManagement() {
  const { update: updateSession } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const resetPhotoRef = useRef<() => void>(null);

  const form = useForm<ProfileFormValues>({
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

  const formRef = useRef(form);
  const hasFetchedProfileRef = useRef(false);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const fetchProfile = useCallback(
    async (options?: { force?: boolean }) => {
      const shouldForce = options?.force ?? false;
      if (hasFetchedProfileRef.current && !shouldForce) {
        return;
      }

      hasFetchedProfileRef.current = true;
      try {
        setLoading(true);
        const response = await fetch('/api/users/profile');

        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const data: UserProfile = await response.json();
        setProfile(data);
        formRef.current.setValues({
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
          icon: createElement(IconAlertCircle, { size: 18 }),
        });
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setProfile, setHasChanges]
  );

  // Only fetch on mount
  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleReset = useCallback(() => {
    if (!profile) {
      return;
    }

    form.setValues({
      name: profile.name || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setHasChanges(false);
  }, [form, profile]);

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      setUpdating(true);

      const updateData: ProfileUpdatePayload = {};

      if (values.name !== profile?.name) {
        updateData.name = values.name;
      }

      if (values.newPassword) {
        if (!values.currentPassword) {
          form.setFieldError(
            'currentPassword',
            'Current password is required to set a new password'
          );
          setUpdating(false);
          return;
        }
        updateData.currentPassword = values.currentPassword;
        updateData.newPassword = values.newPassword;
      }

      if (!Object.keys(updateData).length) {
        setUpdating(false);
        return;
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
        icon: createElement(IconCheck, { size: 18 }),
      });

      if (updateData.name) {
        await updateSession();
      }

      form.setValues({
        name: form.values.name,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      await fetchProfile({ force: true });
      setHasChanges(false);
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to update profile',
        color: 'red',
        icon: createElement(IconAlertCircle, { size: 18 }),
      });
    } finally {
      setUpdating(false);
    }
  });

  const handlePhotoUpload = useCallback(
    async (file: File | null) => {
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
          icon: createElement(IconCheck, { size: 18 }),
        });

        await updateSession();
        await fetchProfile({ force: true });

        if (resetPhotoRef.current) {
          resetPhotoRef.current();
        }
      } catch (error) {
        showNotification({
          title: 'Error',
          message:
            error instanceof Error ? error.message : 'Failed to upload photo',
          color: 'red',
          icon: createElement(IconAlertCircle, { size: 18 }),
        });
      } finally {
        setUploadingPhoto(false);
      }
    },
    [fetchProfile, updateSession]
  );

  const handlePhotoRemove = useCallback(async () => {
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
        icon: createElement(IconCheck, { size: 18 }),
      });

      await updateSession();
      await fetchProfile({ force: true });
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to remove photo',
        color: 'red',
        icon: createElement(IconAlertCircle, { size: 18 }),
      });
    } finally {
      setUploadingPhoto(false);
    }
  }, [fetchProfile, updateSession]);

  return {
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
  };
}
