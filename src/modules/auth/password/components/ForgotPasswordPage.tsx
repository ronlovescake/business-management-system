import Link from 'next/link';
import {
  Alert,
  Anchor,
  Button,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconArrowLeft, IconCheck, IconMail } from '@tabler/icons-react';
import { useForgotPasswordForm } from '../hooks/useForgotPasswordForm';
import { AuthBackground, AuthCard } from '../../shared';

export function ForgotPasswordPage() {
  const { form, successMessage, isSubmitting, handleSubmit } =
    useForgotPasswordForm();

  return (
    <AuthBackground>
      <AuthCard maxWidth={420}>
        <Stack gap="lg">
          <Anchor
            component={Link}
            href="/login"
            size="sm"
            style={{ color: 'rgba(59, 130, 246, 0.95)', fontWeight: 600 }}
          >
            <IconArrowLeft size={16} style={{ marginRight: 6 }} /> Back to login
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
              <IconMail
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
      </AuthCard>
    </AuthBackground>
  );
}
