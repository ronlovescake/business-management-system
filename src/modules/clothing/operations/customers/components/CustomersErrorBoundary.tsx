/**
 * Customers Error Boundary
 */

'use client';

import React, { Component, type ReactNode } from 'react';
import { Stack, Text, Button, Paper, Title, Code } from '@mantine/core';
import { IconAlertTriangle, IconRefresh, IconHome } from '@tabler/icons-react';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CustomersErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error('Customers module error:', { error: error.message, stack: error.stack, componentStack: errorInfo.componentStack });
    this.setState({ error });
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <Stack align="center" justify="center" style={{ minHeight: '400px' }}>
          <Paper shadow="md" p="xl" withBorder style={{ maxWidth: 600, width: '100%' }}>
            <Stack gap="md">
              <Stack gap="xs" align="center">
                <IconAlertTriangle size={48} color="red" />
                <Title order={2}>Customers Module Error</Title>
              </Stack>
              <Text c="dimmed" ta="center">An unexpected error occurred in the customers module.</Text>
              {isDevelopment && this.state.error && (
                <Stack gap="xs">
                  <Text fw={500}>Error Details:</Text>
                  <Code block color="red">{this.state.error.message}</Code>
                </Stack>
              )}
              <Stack gap="sm">
                <Button leftSection={<IconRefresh size={16} />} onClick={this.handleReload} fullWidth>Reload Page</Button>
                <Button leftSection={<IconHome size={16} />} onClick={this.handleGoHome} variant="light" fullWidth>Go to Home</Button>
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      );
    }

    return this.props.children;
  }
}
