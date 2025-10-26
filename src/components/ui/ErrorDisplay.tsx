'use client';

/**
 * ErrorDisplay Component
 * Displays API errors in a user-friendly format with suggestions and retry options
 */

import { Alert, Button, Stack, Text, Box, List } from '@mantine/core';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import type { ApiErrorResponse } from '@/lib/errors';
import { extractApiError } from '@/lib/errors';

export interface ErrorDisplayProps {
  /** The error to display (can be any error type) */
  error: unknown;

  /** Optional callback to retry the failed operation */
  onRetry?: () => void;

  /** Optional context about what the user was trying to do */
  context?: string;

  /** Optional title override */
  title?: string;

  /** Whether to show suggestions (default: true) */
  showSuggestions?: boolean;

  /** Whether to show retry button (default: true if onRetry provided) */
  showRetry?: boolean;

  /** Alert color (default: 'red') */
  color?: string;

  /** Alert variant (default: 'light') */
  variant?: 'light' | 'filled' | 'outline';
}

/**
 * ErrorDisplay Component
 *
 * Displays errors in a user-friendly format with:
 * - Error message and details
 * - Contextual information
 * - Recovery suggestions
 * - Optional retry button
 *
 * Example usage:
 * ```tsx
 * {isError && (
 *   <ErrorDisplay
 *     error={error}
 *     onRetry={() => refetch()}
 *     context="Loading employee data"
 *   />
 * )}
 * ```
 */
export function ErrorDisplay({
  error,
  onRetry,
  context,
  title,
  showSuggestions = true,
  showRetry = true,
  color = 'red',
  variant = 'light',
}: ErrorDisplayProps) {
  // Extract API error information
  const apiError: ApiErrorResponse = extractApiError(error);

  // Fallback to generic error message
  const errorMessage = apiError.error || 'An unexpected error occurred';
  const errorTitle = title || 'Error';

  return (
    <Alert
      variant={variant}
      color={color}
      title={errorTitle}
      icon={<IconAlertCircle />}
    >
      <Stack gap="xs">
        {/* Context - what the user was trying to do */}
        {context && (
          <Text size="sm" c="dimmed">
            {context}
          </Text>
        )}

        {/* Main error message */}
        <Text size="sm" fw={500}>
          {errorMessage}
        </Text>

        {/* Additional details */}
        {apiError.details && apiError.details !== errorMessage && (
          <Text size="sm" c="dimmed">
            {apiError.details}
          </Text>
        )}

        {/* Error code (for technical users) */}
        {apiError.code && (
          <Text size="xs" c="dimmed" ff="monospace">
            Error Code: {apiError.code}
          </Text>
        )}

        {/* Recovery suggestions */}
        {showSuggestions &&
          apiError.suggestions &&
          apiError.suggestions.length > 0 && (
            <Box>
              <Text size="sm" fw={500} mb={4}>
                Suggestions:
              </Text>
              <List size="sm">
                {apiError.suggestions.map((suggestion) => (
                  <List.Item key={suggestion}>{suggestion}</List.Item>
                ))}
              </List>
            </Box>
          )}

        {/* Retry button */}
        {showRetry && onRetry && (
          <Button
            size="xs"
            variant="light"
            color={color}
            leftSection={<IconRefresh size={14} />}
            onClick={onRetry}
            mt="xs"
          >
            Try Again
          </Button>
        )}
      </Stack>
    </Alert>
  );
}

/**
 * CompactErrorDisplay Component
 * A more compact version of ErrorDisplay without suggestions
 */
export function CompactErrorDisplay({
  error,
  onRetry,
  color = 'red',
}: Pick<ErrorDisplayProps, 'error' | 'onRetry' | 'color'>) {
  const apiError: ApiErrorResponse = extractApiError(error);
  const errorMessage = apiError.error || 'An unexpected error occurred';

  return (
    <Alert variant="light" color={color} icon={<IconAlertCircle size={16} />}>
      <Stack gap="xs">
        <Text size="sm">{errorMessage}</Text>
        {onRetry && (
          <Button
            size="xs"
            variant="subtle"
            color={color}
            leftSection={<IconRefresh size={12} />}
            onClick={onRetry}
          >
            Retry
          </Button>
        )}
      </Stack>
    </Alert>
  );
}

/**
 * InlineErrorDisplay Component
 * A minimalist inline error display
 */
export function InlineErrorDisplay({
  error,
  color = 'red',
}: Pick<ErrorDisplayProps, 'error' | 'color'>) {
  const apiError: ApiErrorResponse = extractApiError(error);
  const errorMessage = apiError.error || 'An error occurred';

  return (
    <Text size="sm" c={color}>
      <IconAlertCircle
        size={14}
        style={{ verticalAlign: 'middle', marginRight: 4 }}
      />
      {errorMessage}
    </Text>
  );
}
