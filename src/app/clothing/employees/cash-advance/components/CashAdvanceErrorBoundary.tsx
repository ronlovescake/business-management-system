'use client';

import React from 'react';
import { Container, Title, Text, Button, Stack, Paper } from '@mantine/core';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { logger } from '@/lib/logger';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class CashAdvanceErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error reporting service in production
    logger.error(
      'Cash Advance Error Boundary caught an error:',
      error,
      errorInfo
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Container size="md" py="xl">
          <Paper p="xl" withBorder shadow="sm">
            <Stack align="center" gap="lg">
              <IconAlertCircle size={64} color="var(--mantine-color-red-6)" />
              <Title order={2}>Cash Advance Error</Title>
              <Text c="dimmed" ta="center">
                Something went wrong while loading the cash advance module.
                {this.state.error && (
                  <Text size="sm" mt="xs" c="red">
                    {this.state.error.message}
                  </Text>
                )}
              </Text>
              <Button
                leftSection={<IconRefresh size={16} />}
                onClick={this.handleReset}
                variant="filled"
              >
                Reload Page
              </Button>
            </Stack>
          </Paper>
        </Container>
      );
    }

    return this.props.children;
  }
}
