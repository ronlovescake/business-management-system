/**
 * Transactions Module Error Boundary
 *
 * Provides graceful error handling for the entire transactions module.
 * Catches errors and displays a user-friendly recovery UI.
 */

'use client';

import React, { Component, type ReactNode } from 'react';
import { Alert, Button, Stack, Text, Group } from '@mantine/core';
import { IconAlertCircle, IconRefresh, IconHome } from '@tabler/icons-react';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class TransactionsErrorBoundary extends Component<Props, State> {
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
    logger.error('Transactions module error:', error, {
      componentStack: errorInfo.componentStack,
      module: 'transactions',
      boundary: 'TransactionsErrorBoundary',
    });

    this.setState({
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    
    // Reload the page to reset state
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Stack
          style={{
            minHeight: '60vh',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '2rem',
          }}
        >
          <Alert
            icon={<IconAlertCircle size={24} />}
            title="Transactions Module Error"
            color="red"
            style={{ maxWidth: 600, width: '100%' }}
          >
            <Stack gap="md">
              <div>
                <Text size="sm" fw={600} mb="xs">
                  Something went wrong in the transactions module
                </Text>
                <Text size="sm" c="dimmed">
                  {this.state.error?.message || 'An unexpected error occurred'}
                </Text>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details style={{ marginTop: '1rem' }}>
                  <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <Text size="sm" fw={500} span>
                      Error Details (Development Only)
                    </Text>
                  </summary>
                  <pre
                    style={{
                      marginTop: '0.5rem',
                      padding: '1rem',
                      background: '#f5f5f5',
                      borderRadius: '4px',
                      fontSize: '12px',
                      overflow: 'auto',
                      maxHeight: '300px',
                    }}
                  >
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <Group gap="sm" mt="md">
                <Button
                  leftSection={<IconRefresh size={16} />}
                  onClick={this.handleReset}
                  variant="filled"
                  color="blue"
                >
                  Reload Page
                </Button>
                <Button
                  leftSection={<IconHome size={16} />}
                  onClick={this.handleGoHome}
                  variant="outline"
                >
                  Go to Home
                </Button>
              </Group>

              <Text size="xs" c="dimmed" mt="sm">
                If this error persists, please contact support with the error details above.
              </Text>
            </Stack>
          </Alert>
        </Stack>
      );
    }

    return this.props.children;
  }
}
