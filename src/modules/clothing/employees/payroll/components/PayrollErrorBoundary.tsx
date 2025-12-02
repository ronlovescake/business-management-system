/**
 * Payroll Error Boundary
 *
 * Catches errors in the payroll module and displays a user-friendly error message
 * instead of crashing the entire application.
 *
 * Features:
 * - Graceful error handling
 * - User-friendly error messages
 * - Detailed error information in development mode
 * - Reload and navigation options
 * - Automatic error logging
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
  errorInfo: React.ErrorInfo | null;
}

export class PayrollErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to monitoring service
    logger.error('Payroll module error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
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
          <Paper
            shadow="md"
            p="xl"
            withBorder
            style={{ maxWidth: 600, width: '100%' }}
          >
            <Stack gap="md">
              <Stack gap="xs" align="center">
                <IconAlertTriangle size={48} color="red" />
                <Title order={2}>Payroll Module Error</Title>
              </Stack>

              <Text c="dimmed" ta="center">
                An unexpected error occurred in the payroll module. The error
                has been logged and our team has been notified.
              </Text>

              {isDevelopment && this.state.error && (
                <Stack gap="xs">
                  <Text fw={500}>Error Details (Development Only):</Text>
                  <Code block color="red">
                    {this.state.error.message}
                  </Code>
                  {this.state.error.stack && (
                    <Code block style={{ maxHeight: 200, overflow: 'auto' }}>
                      {this.state.error.stack}
                    </Code>
                  )}
                </Stack>
              )}

              <Stack gap="sm">
                <Button
                  leftSection={<IconRefresh size={16} />}
                  onClick={this.handleReload}
                  fullWidth
                >
                  Reload Page
                </Button>
                <Button
                  leftSection={<IconHome size={16} />}
                  onClick={this.handleGoHome}
                  variant="light"
                  fullWidth
                >
                  Go to Home Page
                </Button>
              </Stack>

              <Text size="xs" c="dimmed" ta="center">
                If this error persists, please contact support with the error
                details above.
              </Text>
            </Stack>
          </Paper>
        </Stack>
      );
    }

    return this.props.children;
  }
}
