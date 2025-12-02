import { useState } from 'react';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';

interface ForgotPasswordFormValues {
  email: string;
}

export function useForgotPasswordForm() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    initialValues: { email: '' },
    validate: {
      email: (value) =>
        /^\S+@\S+\.\S+$/.test(value.trim())
          ? null
          : 'Enter a valid email address',
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: values.email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        showNotification({
          title: 'Request Failed',
          message: data.error || 'Unable to send reset link. Try again later.',
          color: 'red',
        });
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage(
        data.message ||
          'If an account exists for this email, you will receive a reset link shortly.'
      );
      form.reset();
      showNotification({
        title: 'Email Sent',
        message: 'Check your inbox for the reset link.',
        color: 'teal',
        icon: <IconCheck size={18} />,
      });
    } catch (error) {
      showNotification({
        title: 'Network Error',
        message: 'We could not reach the server. Please try again.',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  });

  return {
    form,
    successMessage,
    isSubmitting,
    handleSubmit,
  };
}
