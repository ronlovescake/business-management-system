import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { IconLock } from '@tabler/icons-react';

export interface LoginFormValues {
  email: string;
  password: string;
  remember: boolean;
}

export function useLoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    initialValues: {
      email: '',
      password: '',
      remember: true,
    },
    validate: {
      email: (value) =>
        /^\S+@\S+$/.test(value) ? null : 'Enter a valid email address',
      password: (value) =>
        value.trim().length >= 6
          ? null
          : 'Password must be at least 6 characters long',
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    setIsSubmitting(true);

    try {
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: true,
        callbackUrl: '/api/auth/redirect',
      });

      if (result?.error) {
        showNotification({
          title: 'Authentication Failed',
          message: result.error,
          color: 'red',
          icon: <IconLock size={18} stroke={1.8} />,
        });
        setIsSubmitting(false);
      }
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'An unexpected error occurred. Please try again.',
        color: 'red',
      });
      setIsSubmitting(false);
    }
  });

  return {
    form,
    isSubmitting,
    handleSubmit,
  };
}
