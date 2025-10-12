'use client';

/**
 * ModuleCard Component
 *
 * Displays a module in a card format with actions
 */

import {
  Card,
  Text,
  Badge,
  Group,
  Button,
  Stack,
  Tooltip,
  Rating,
} from '@mantine/core';
import {
  IconDownload,
  IconStar,
  IconPackage,
  IconCheck,
} from '@tabler/icons-react';
import type { ModulePackage } from '../types';

interface ModuleCardProps {
  module: ModulePackage;
  isInstalled?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
  onViewDetails?: () => void;
  loading?: boolean;
}

export function ModuleCard({
  module,
  isInstalled = false,
  onInstall,
  onUninstall,
  onViewDetails,
  loading = false,
}: ModuleCardProps) {
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            <IconPackage size={24} />
            <div>
              <Text fw={600} size="lg">
                {module.name}
              </Text>
              <Text size="xs" c="dimmed">
                v{module.version}
              </Text>
            </div>
          </Group>

          {isInstalled && (
            <Badge
              color="green"
              variant="light"
              leftSection={<IconCheck size={12} />}
            >
              Installed
            </Badge>
          )}
        </Group>

        {/* Description */}
        <Text size="sm" lineClamp={2} c="dimmed">
          {module.metadata?.description || 'No description available'}
        </Text>

        {/* Stats */}
        <Group gap="md">
          {module.downloads !== undefined && (
            <Tooltip label="Downloads">
              <Group gap={4}>
                <IconDownload size={16} />
                <Text size="xs">{module.downloads.toLocaleString()}</Text>
              </Group>
            </Tooltip>
          )}

          {module.rating !== undefined && (
            <Tooltip label="Rating">
              <Group gap={4}>
                <IconStar size={16} />
                <Rating
                  value={module.rating}
                  fractions={2}
                  readOnly
                  size="xs"
                />
                <Text size="xs">({module.rating.toFixed(1)})</Text>
              </Group>
            </Tooltip>
          )}
        </Group>

        {/* Tags */}
        {module.keywords && module.keywords.length > 0 && (
          <Group gap={4}>
            {module.keywords.slice(0, 3).map((keyword) => (
              <Badge key={keyword} size="xs" variant="dot">
                {keyword}
              </Badge>
            ))}
            {module.keywords.length > 3 && (
              <Text size="xs" c="dimmed">
                +{module.keywords.length - 3} more
              </Text>
            )}
          </Group>
        )}

        {/* Actions */}
        <Group gap="xs">
          {!isInstalled && onInstall && (
            <Button
              size="xs"
              variant="filled"
              onClick={onInstall}
              loading={loading}
              fullWidth
            >
              Install
            </Button>
          )}

          {isInstalled && onUninstall && (
            <Button
              size="xs"
              variant="light"
              color="red"
              onClick={onUninstall}
              loading={loading}
              fullWidth
            >
              Uninstall
            </Button>
          )}

          {onViewDetails && (
            <Button
              size="xs"
              variant="subtle"
              onClick={onViewDetails}
              fullWidth
            >
              View Details
            </Button>
          )}
        </Group>
      </Stack>
    </Card>
  );
}
