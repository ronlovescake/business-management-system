'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
  PasswordInput,
} from '@mantine/core';
import {
  IconArrowRight,
  IconLock,
  IconLogin,
  IconMail,
} from '@tabler/icons-react';
import { useLoginForm } from '../hooks/useLoginForm';
import { AuthBackground, AuthCard } from '../../shared';

function LoginPageContent() {
  const searchParams = useSearchParams();
  const { form, isSubmitting, handleSubmit } = useLoginForm();
  const error = searchParams?.get('error');
  const errorMessage =
    error === 'CredentialsSignin'
      ? 'Invalid email or password.'
      : error || null;

  return (
    <AuthBackground>
      <Box style={{ display: 'flex', justifyContent: 'center' }}>
        <AuthCard maxWidth={480}>
          <Stack gap="xl">
            <Stack gap="lg">
              <Group justify="space-between" align="flex-start">
                <Stack gap={6}>
                  <Badge
                    variant="light"
                    radius="xl"
                    color="indigo"
                    style={badgeStyle}
                  >
                    Secure access
                  </Badge>
                  <Title order={2} fw={800} style={titleStyle}>
                    Welcome back
                  </Title>
                  <Text size="sm" style={subtitleStyle}>
                    Sign in to access your dashboards, workflows, and business
                    records.
                  </Text>
                </Stack>
                <BrandMark compact />
              </Group>

              {errorMessage ? (
                <Alert
                  color="red"
                  radius="lg"
                  variant="light"
                  title="Unable to sign in"
                  icon={<IconLock size={16} />}
                  styles={{
                    root: {
                      background: 'rgba(254, 226, 226, 0.92)',
                      border: '1px solid rgba(248, 113, 113, 0.28)',
                    },
                    title: {
                      color: '#991b1b',
                      fontWeight: 700,
                    },
                    body: {
                      color: '#7f1d1d',
                    },
                  }}
                >
                  {errorMessage}
                </Alert>
              ) : null}
            </Stack>

            <form onSubmit={handleSubmit} noValidate>
              <Stack gap="lg">
                <TextInput
                  withAsterisk
                  label="Email"
                  placeholder="you@company.com"
                  leftSection={<IconMail size={18} stroke={1.6} />}
                  autoComplete="email"
                  {...form.getInputProps('email')}
                  styles={inputStyles}
                />

                <PasswordInput
                  withAsterisk
                  label="Password"
                  placeholder="Enter your password"
                  leftSection={<IconLock size={18} stroke={1.6} />}
                  autoComplete="current-password"
                  {...form.getInputProps('password')}
                  styles={{
                    ...inputStyles,
                    innerInput: {
                      color: '#0f172a',
                    },
                  }}
                />

                <Group justify="space-between" wrap="wrap" gap="sm">
                  <Checkbox
                    label="Remember me"
                    {...form.getInputProps('remember', { type: 'checkbox' })}
                    styles={checkboxStyles}
                  />
                  <Anchor
                    size="sm"
                    component={Link}
                    href="/forgot-password"
                    style={linkStyle}
                  >
                    Forgot password?
                  </Anchor>
                </Group>

                <Button
                  type="submit"
                  size="lg"
                  radius="xl"
                  loading={isSubmitting}
                  fullWidth
                  rightSection={<IconArrowRight size={18} />}
                  styles={buttonStyles}
                >
                  Sign in
                </Button>
              </Stack>
            </form>

            <Divider color="rgba(148, 163, 184, 0.35)" />

            <Text size="sm" ta="center" style={footerStyle}>
              Need access to the system? Contact an administrator to have your
              account provisioned.
            </Text>
          </Stack>
        </AuthCard>
      </Box>
    </AuthBackground>
  );
}

function LoginPageFallback() {
  return (
    <AuthBackground>
      <Box style={{ display: 'flex', justifyContent: 'center' }}>
        <AuthCard maxWidth={480}>
          <Stack gap="md" align="center">
            <Title order={3} fw={800} style={titleStyle} ta="center">
              Loading sign in
            </Title>
            <Text size="sm" style={subtitleStyle} ta="center">
              Preparing the secure login experience.
            </Text>
          </Stack>
        </AuthCard>
      </Box>
    </AuthBackground>
  );
}

export function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}

const inputStyles = {
  label: {
    color: '#334155',
    fontWeight: 600,
    marginBottom: '0.45rem',
  },
  input: {
    background: 'rgba(255, 255, 255, 0.88)',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    color: '#0f172a',
    fontSize: '0.98rem',
    height: '3.15rem',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.65)',
    '&::placeholder': {
      color: '#94a3b8',
    },
    '&:focus': {
      background: '#ffffff',
      borderColor: 'rgba(79, 70, 229, 0.45)',
      boxShadow: '0 0 0 4px rgba(99, 102, 241, 0.12)',
    },
  },
};

const buttonStyles = {
  root: {
    background:
      'linear-gradient(135deg, #4f46e5 0%, #2563eb 52%, #0ea5e9 100%)',
    border: '1px solid rgba(79, 70, 229, 0.3)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '1rem',
    height: '3.35rem',
    boxShadow: '0 16px 32px rgba(37, 99, 235, 0.24)',
    transition: 'all 0.3s ease',
    '&:hover': {
      background:
        'linear-gradient(135deg, #4338ca 0%, #1d4ed8 52%, #0284c7 100%)',
      transform: 'translateY(-2px)',
      boxShadow: '0 20px 34px rgba(37, 99, 235, 0.3)',
    },
  },
};

const badgeStyle = {
  alignSelf: 'flex-start' as const,
  background: 'rgba(79, 70, 229, 0.1)',
  color: '#4338ca',
  border: '1px solid rgba(79, 70, 229, 0.12)',
};

const titleStyle = {
  color: '#0f172a',
  fontSize: 'clamp(1.9rem, 2vw + 1rem, 2.5rem)',
  lineHeight: 1.05,
};

const subtitleStyle = {
  color: '#475569',
  maxWidth: '28rem',
  lineHeight: 1.7,
};

const footerStyle = {
  color: '#64748b',
};

const linkStyle = {
  color: '#2563eb',
  fontWeight: 700,
};

const checkboxStyles = {
  label: {
    color: '#475569',
  },
};

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Box
      style={{
        position: 'relative',
        width: compact ? 54 : 72,
        height: compact ? 54 : 72,
        flexShrink: 0,
      }}
    >
      {brandMarkCircles.map((circle) => (
        <Box
          key={circle.background}
          style={{ ...brandCircleStyle, ...circle }}
        />
      ))}
      <Box
        style={{
          position: 'absolute',
          inset: compact ? '16px' : '22px',
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: '0 8px 20px rgba(99, 102, 241, 0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconLogin size={compact ? 16 : 20} stroke={2} color="#4338ca" />
      </Box>
    </Box>
  );
}

const brandCircleStyle = {
  position: 'absolute' as const,
  width: '52%',
  height: '52%',
  borderRadius: '50%',
  filter: 'drop-shadow(0 10px 18px rgba(79, 70, 229, 0.14))',
};

const brandMarkCircles = [
  { top: 0, left: '24%', background: '#fb7185' },
  { top: '24%', right: 0, background: '#f59e0b' },
  { bottom: 0, left: '24%', background: '#22c55e' },
  { top: '24%', left: 0, background: '#60a5fa' },
];
