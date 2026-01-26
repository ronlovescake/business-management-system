'use client';

import { useState, type ElementType } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import {
  ActionIcon,
  Anchor,
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
import { showNotification } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import {
  IconBrandGithub,
  IconBrandGoogle,
  IconBrandSlack,
  IconLock,
  IconMail,
  IconLogin,
} from '@tabler/icons-react';

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
      remember: true,
    },
    validate: {
      email: (value: string) =>
        /^\S+@\S+$/.test(value) ? null : 'Enter a valid email address',
      password: (value: string) =>
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

      // This code won't run if redirect is true
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
      {/* Glassmorphism Login Card */}
      <Box
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '440px',
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
        {/* Gradient Overlay for extra depth */}
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

        <Stack gap="xl" style={{ position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <Stack gap="xs" align="center">
            <Box
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
              }}
            >
              <IconLogin
                size={32}
                stroke={1.5}
                style={{ color: 'rgba(30, 41, 59, 0.85)' }}
              />
            </Box>
            <Title
              order={2}
              fw={700}
              style={{
                color: 'rgba(30, 41, 59, 0.95)',
                textAlign: 'center',
                fontSize: '1.75rem',
                textShadow: '0 2px 8px rgba(255, 255, 255, 0.5)',
              }}
            >
              Welcome Back
            </Title>
            <Text
              size="sm"
              style={{
                color: 'rgba(51, 65, 85, 0.85)',
                textAlign: 'center',
                textShadow: '0 1px 4px rgba(255, 255, 255, 0.5)',
              }}
            >
              Sign in to continue to your account
            </Text>
          </Stack>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            <Stack gap="lg">
              <TextInput
                withAsterisk
                label="Email"
                placeholder="you@company.com"
                leftSection={<IconMail size={18} stroke={1.6} />}
                autoComplete="email"
                {...form.getInputProps('email')}
                styles={{
                  label: {
                    color: 'rgba(30, 41, 59, 0.9)',
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                    textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)',
                  },
                  input: {
                    background: 'rgba(255, 255, 255, 0.25)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    color: 'rgba(30, 41, 59, 0.95)',
                    fontSize: '0.95rem',
                    '&::placeholder': {
                      color: 'rgba(100, 116, 139, 0.6)',
                    },
                    '&:focus': {
                      background: 'rgba(255, 255, 255, 0.35)',
                      borderColor: 'rgba(59, 130, 246, 0.6)',
                    },
                  },
                }}
              />

              <PasswordInput
                withAsterisk
                label="Password"
                placeholder="Your password"
                leftSection={<IconLock size={18} stroke={1.6} />}
                autoComplete="current-password"
                {...form.getInputProps('password')}
                styles={{
                  label: {
                    color: 'rgba(30, 41, 59, 0.9)',
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                    textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)',
                  },
                  input: {
                    background: 'rgba(255, 255, 255, 0.25)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    color: 'rgba(30, 41, 59, 0.95)',
                    fontSize: '0.95rem',
                    '&::placeholder': {
                      color: 'rgba(100, 116, 139, 0.6)',
                    },
                    '&:focus': {
                      background: 'rgba(255, 255, 255, 0.35)',
                      borderColor: 'rgba(59, 130, 246, 0.6)',
                    },
                  },
                  innerInput: {
                    color: 'rgba(30, 41, 59, 0.95)',
                  },
                }}
              />

              <Group justify="space-between" wrap="wrap">
                <Checkbox
                  label="Remember me"
                  {...form.getInputProps('remember', { type: 'checkbox' })}
                  styles={{
                    label: {
                      color: 'rgba(51, 65, 85, 0.85)',
                      textShadow: '0 1px 2px rgba(255, 255, 255, 0.5)',
                    },
                  }}
                />
                <Anchor
                  size="sm"
                  component={Link}
                  href="/forgot-password"
                  style={{
                    color: 'rgba(59, 130, 246, 0.95)',
                    fontWeight: 600,
                    textShadow: '0 1px 2px rgba(255, 255, 255, 0.5)',
                  }}
                >
                  Forgot password?
                </Anchor>
              </Group>

              <Button
                type="submit"
                size="lg"
                radius="md"
                loading={isSubmitting}
                fullWidth
                styles={{
                  root: {
                    background:
                      'linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(37, 99, 235, 0.9) 100%)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '1rem',
                    height: '48px',
                    boxShadow: '0 4px 16px rgba(59, 130, 246, 0.3)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      background:
                        'linear-gradient(135deg, rgba(37, 99, 235, 0.95) 0%, rgba(29, 78, 216, 0.95) 100%)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4)',
                    },
                  },
                }}
              >
                Sign In
              </Button>
            </Stack>
          </form>

          {/* Divider */}
          <Divider
            label="Or continue with"
            labelPosition="center"
            styles={{
              label: {
                color: 'rgba(71, 85, 105, 0.8)',
                textShadow: '0 1px 2px rgba(255, 255, 255, 0.5)',
                fontSize: '0.875rem',
              },
            }}
          />

          {/* Social Buttons */}
          <Group justify="center" gap="md">
            <SocialButton icon={IconBrandGoogle} label="Google" />
            <SocialButton icon={IconBrandGithub} label="GitHub" />
            <SocialButton icon={IconBrandSlack} label="Slack" />
          </Group>

          {/* Footer */}
          <Text
            size="sm"
            ta="center"
            style={{
              color: 'rgba(71, 85, 105, 0.85)',
              textShadow: '0 1px 2px rgba(255, 255, 255, 0.5)',
            }}
          >
            Don&apos;t have an account?{' '}
            <Anchor
              component={Link}
              href="/register"
              fw={600}
              style={{
                color: 'rgba(59, 130, 246, 0.95)',
                textShadow: '0 1px 2px rgba(255, 255, 255, 0.5)',
              }}
            >
              Request access
            </Anchor>
          </Text>
        </Stack>
      </Box>
    </Box>
  );
}

interface SocialButtonProps {
  icon: ElementType;
  label: string;
}

function SocialButton({ icon: IconComponent, label }: SocialButtonProps) {
  return (
    <ActionIcon
      size="lg"
      radius="md"
      variant="subtle"
      aria-label={`Continue with ${label}`}
      style={{
        width: 56,
        height: 56,
        background: 'rgba(255, 255, 255, 0.25)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        color: 'rgba(30, 41, 59, 0.85)',
        transition: 'all 0.3s ease',
      }}
      styles={{
        root: {
          '&:hover': {
            background: 'rgba(255, 255, 255, 0.35)',
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          },
        },
      }}
    >
      <IconComponent size={24} stroke={1.7} />
    </ActionIcon>
  );
}
