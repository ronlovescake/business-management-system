'use client';

import React from 'react';
import { Drawer, Stack, Text, Group, Badge, Alert } from '@mantine/core';
import { IconClock, IconAlertTriangle } from '@tabler/icons-react';

interface VersionHistoryPanelProps {
  opened: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  currentData: Record<string, unknown>;
  onRestore: (versionId: string) => void;
  onCompare?: (versionId1: string, versionId2: string) => void;
}

/**
 * Version History Panel Component
 *
 * @status DEFERRED - Feature implementation postponed to future sprint
 * @reason Version history requires additional backend infrastructure:
 *   - Database schema for storing historical versions
 *   - API endpoints for version retrieval and restoration
 *   - Diff calculation and comparison logic
 * Currently displays a placeholder until the full feature is implemented.
 *
 * @see https://github.com/czarlieandron-oss/business-management-system/issues/VERSION-HISTORY
 */
export function VersionHistoryPanel({
  opened,
  onClose,
}: VersionHistoryPanelProps) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="xl"
      title={
        <Group gap="sm">
          <IconClock size={24} />
          <Text size="lg" fw={600}>
            Version History
          </Text>
          <Badge color="blue" variant="light">
            0 versions
          </Badge>
        </Group>
      }
      styles={{
        content: {
          background:
            'linear-gradient(135deg, #ffeaa7 0%, #fab1a0 25%, #fd79a8 50%, #fdcb6e 75%, #e17055 100%)',
        },
        header: {
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        },
      }}
    >
      <Stack gap="md" p="md">
        <Alert icon={<IconAlertTriangle size={16} />} color="blue">
          Version history feature is currently under development. Full
          functionality will be available in a future update.
        </Alert>
      </Stack>
    </Drawer>
  );
}
