'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Anchor,
  Box,
  Button,
  Stack,
  Text,
  TextInput,
  Title,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { IconArrowLeft, IconMail, IconCheck } from '@tabler/icons-react';

export default function ForgotPasswordPage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
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
            href="/login"
            size="sm"
            style={{ color: 'rgba(59, 130, 246, 0.95)', fontWeight: 600 }}
          >
            <IconArrowLeft size={16} style={{ marginRight: 6 }} /> Back to login
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
              <IconMail
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
              Forgot your password?
            </Title>
            <Text size="sm" ta="center" c="dimmed">
              Enter your email and we&apos;ll send you a secure link to reset
              it.
            </Text>
          </Stack>

          {successMessage && (
            <Alert
              icon={<IconCheck size={16} />}
              title="Email sent"
              color="teal"
              variant="light"
            >
              {successMessage}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <Stack gap="md">
              <TextInput
                withAsterisk
                label="Email"
                placeholder="you@company.com"
                leftSection={<IconMail size={18} stroke={1.6} />}
                autoComplete="email"
                {...form.getInputProps('email')}
              />

              <Button type="submit" loading={isSubmitting} fullWidth>
                Send reset link
              </Button>
            </Stack>
          </form>
        </Stack>
      </Box>
    </Box>
  );
}
