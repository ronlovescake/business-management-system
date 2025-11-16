'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Anchor,
  Box,
  Button,
  PasswordInput,
  Stack,
  Text,
  Title,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { IconArrowLeft, IconLock, IconCheck } from '@tabler/icons-react';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);

  const form = useForm({
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

  return (
    <Box
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: 'url(/backgrounds/minimalist-clock.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: '100vh',
        overflow: 'auto',
        padding: '2rem 1rem',
      }}
    >
      <Box
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(255, 255, 255, 0.15)',
          borderRadius: '24px',
          padding: '3rem 2.5rem',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: `
            0 8px 32px 0 rgba(0, 0, 0, 0.1),
            inset 0 1px 1px 0 rgba(255, 255, 255, 0.4),
            inset 0 -1px 1px 0 rgba(255, 255, 255, 0.1)
          `,
        }}
      >
        <Box
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.05) 100%)',
            borderRadius: '24px',
            pointerEvents: 'none',
          }}
        />

        <Stack gap="lg" style={{ position: 'relative', zIndex: 1 }}>
          <Anchor
            component={Link}
            href="/forgot-password"
            size="sm"
            style={{ color: 'rgba(59, 130, 246, 0.95)', fontWeight: 600 }}
          >
            <IconArrowLeft size={16} style={{ marginRight: 6 }} /> Back to
            request link
          </Anchor>

          <Stack gap="xs" align="center">
            <Box
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
              }}
            >
              <IconLock
                size={28}
                stroke={1.5}
                style={{ color: 'rgba(30, 41, 59, 0.85)' }}
              />
            </Box>
            <Title
              order={2}
              ta="center"
              style={{ color: 'rgba(30, 41, 59, 0.95)' }}
            >
              Set a new password
            </Title>
            <Text size="sm" ta="center" c="dimmed">
              {token
                ? 'Create a strong password to secure your account.'
                : 'This link is missing a token. Request a new password reset email.'}
            </Text>
          </Stack>

          {successMessage && (
            <Alert
              icon={<IconCheck size={16} />}
              title="Success"
              color="teal"
              variant="light"
            >
              {successMessage}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <Stack gap="md">
              <PasswordInput
                withAsterisk
                label="New password"
                placeholder="Enter new password"
                leftSection={<IconLock size={18} stroke={1.6} />}
                {...form.getInputProps('password')}
                disabled={!token}
              />

              <PasswordInput
                withAsterisk
                label="Confirm password"
                placeholder="Re-enter new password"
                leftSection={<IconLock size={18} stroke={1.6} />}
                {...form.getInputProps('confirmPassword')}
                disabled={!token}
              />

              <Button
                type="submit"
                loading={isSubmitting}
                disabled={!token}
                fullWidth
              >
                Update password
              </Button>
            </Stack>
          </form>
        </Stack>
      </Box>
    </Box>
  );
}
