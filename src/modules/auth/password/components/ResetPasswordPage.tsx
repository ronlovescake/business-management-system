import { Suspense } from 'react';
import Link from 'next/link';
import {
  Alert,
  Anchor,
  Button,
  PasswordInput,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconArrowLeft, IconCheck, IconLock } from '@tabler/icons-react';
import { AuthBackground, AuthCard } from '../../shared';
import { useResetPasswordForm } from '../hooks/useResetPasswordForm';

function ResetPasswordContent() {
  const { token, form, isSubmitting, successMessage, handleSubmit } =
    useResetPasswordForm();

  return (
    <AuthBackground>
      <AuthCard maxWidth={420}>
        <Stack gap="lg">
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
            <div
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
            </div>
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
      </AuthCard>
    </AuthBackground>
  );
}

function ResetPasswordFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1d4ed8, #1e293b)',
        padding: '2rem',
      }}
    >
      <Text size="lg" fw={600} c="white">
        Loading secure reset experience…
      </Text>
    </div>
  );
}

export function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
