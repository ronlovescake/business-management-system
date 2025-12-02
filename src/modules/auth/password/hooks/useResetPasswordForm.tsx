import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';

interface ResetPasswordFormValues {
  password: string;
  confirmPassword: string;
}

export function useResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const token = useMemo(() => {
    if (!searchParams) {
      return '';
    }
    return searchParams.get('token') ?? '';
  }, [searchParams]);

  const form = useForm<ResetPasswordFormValues>({
    initialValues: {
      password: '',
      confirmPassword: '',
    },
    validate: {
      password: (value) =>
        value.trim().length >= 8
          ? null
          : 'Password must be at least 8 characters long',
      confirmPassword: (value, values) =>
        value === values.password ? null : 'Passwords do not match',
    },
  });

  const handleSubmit = form.onSubmit(async ({ password }) => {
    if (!token) {
      showNotification({
        title: 'Missing token',
        message: 'The reset link is incomplete. Request a new one.',
        color: 'red',
      });
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        showNotification({
          title: 'Reset failed',
          message:
            data.error || 'Unable to reset password. Request a new link.',
          color: 'red',
        });
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage('Password updated! You can now sign in with it.');
      form.reset();
      showNotification({
        title: 'Success',
        message: 'Password updated successfully.',
        color: 'teal',
        icon: <IconCheck size={18} />,
      });
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error) {
      showNotification({
        title: 'Network error',
        message: 'We could not reach the server. Please try again.',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  });

  return {
    token,
    form,
    isSubmitting,
    successMessage,
    handleSubmit,
  };
}
