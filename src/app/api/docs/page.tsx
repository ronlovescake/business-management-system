'use client';

/**
 * API Documentation Page - Swagger UI
 *
 * Interactive API documentation using Swagger UI React.
 * Displays all available endpoints with request/response schemas.
 *
 * Access at: http://localhost:3000/api/docs
 */

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Paper,
  Loader,
  Center,
  Text,
  Stack,
} from '@mantine/core';
import { logger } from '@/lib/logger';
import 'swagger-ui-react/swagger-ui.css';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(
  // @ts-expect-error - swagger-ui-react types are not fully compatible with React 18
  () => import('swagger-ui-react').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <Center style={{ minHeight: '400px' }}>
        <Loader size="lg" />
      </Center>
    ),
  }
);

export default function ApiDocsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [spec, setSpec] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the OpenAPI specification from the API route
    fetch('/api/docs/spec')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load API spec: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        setSpec(data);
        setLoading(false);
      })
      .catch((err) => {
        logger.error('Error loading API spec:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load API documentation'
        );
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Center style={{ minHeight: '60vh' }}>
          <Stack align="center" gap="md">
            <Loader size="xl" />
            <Text size="lg" c="dimmed">
              Loading API Documentation...
            </Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Paper p="xl" withBorder>
          <Stack gap="md">
            <Title order={2} c="red">
              Error Loading API Documentation
            </Title>
            <Text c="dimmed">{error}</Text>
            <Text size="sm" c="dimmed">
              Please ensure the API server is running and try refreshing the
              page.
            </Text>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
        <Title order={1}>API Documentation</Title>
        <Text c="dimmed" size="lg">
          Complete REST API reference for the Business Management System
        </Text>

        <Paper withBorder>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {spec && (
            <SwaggerUI
              {...({
                spec,
                docExpansion: 'list',
                defaultModelsExpandDepth: -1,
                filter: true,
                tryItOutEnabled: true,
                persistAuthorization: true,
                displayRequestDuration: true,
                deepLinking: true,
                supportedSubmitMethods: [
                  'get',
                  'post',
                  'put',
                  'delete',
                  'patch',
                ],
              } as Record<string, unknown>)}
            />
          )}
        </Paper>
      </Stack>
    </Container>
  );
}
