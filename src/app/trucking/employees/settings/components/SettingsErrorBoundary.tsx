/**
 * Settings Error Boundary
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

export class SettingsErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _errorInfo: React.ErrorInfo): void {
    logger.error('Settings module error:', error);
    this.setState({ error });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Stack align="center" justify="center" style={{ minHeight: '400px' }}>
          <Paper shadow="md" p="xl" withBorder style={{ maxWidth: 600 }}>
            <Stack gap="md">
              <Stack gap="xs" align="center">
                <IconAlertTriangle size={48} color="red" />
                <Title order={2}>Settings Module Error</Title>
              </Stack>
              <Text c="dimmed" ta="center">
                An error occurred in the settings module.
              </Text>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <Code block color="red">
                  {this.state.error.message}
                </Code>
              )}
              <Stack gap="sm">
                <Button
                  leftSection={<IconRefresh size={16} />}
                  onClick={() => window.location.reload()}
                  fullWidth
                >
                  Reload
                </Button>
                <Button
                  leftSection={<IconHome size={16} />}
                  onClick={() => (window.location.href = '/')}
                  variant="light"
                  fullWidth
                >
                  Home
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      );
    }
    return this.props.children;
  }
}
