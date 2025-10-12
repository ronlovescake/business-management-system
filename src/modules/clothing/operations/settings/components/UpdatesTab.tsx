'use client';

/**
 * UpdatesTab Component
 *
 * View and install available updates
 */

import { useEffect, useState } from 'react';
import {
  Stack,
  Card,
  Group,
  Text,
  Button,
  Badge,
  Loader,
  Center,
  SimpleGrid,
} from '@mantine/core';
import { IconArrowUp, IconCheck } from '@tabler/icons-react';
import { useInstalledModules } from '../hooks/useInstalledModules';
import { useModuleMarketplace } from '../hooks/useModuleMarketplace';
import { useModuleOperations } from '../hooks/useModuleOperations';
import type { ModuleUpdateInfo } from '../types';

export function UpdatesTab() {
  const installed = useInstalledModules();
  const marketplace = useModuleMarketplace();
  const operations = useModuleOperations();
  const [updates, setUpdates] = useState<ModuleUpdateInfo[]>([]);

  useEffect(() => {
    // Calculate available updates
    const availableUpdates: ModuleUpdateInfo[] = [];

    installed.modules.forEach((installedModule) => {
      const marketplaceModule = marketplace.modules.find(
        (m) => m.id === installedModule.id
      );

      if (
        marketplaceModule &&
        marketplaceModule.version !== installedModule.version
      ) {
        availableUpdates.push({
          module: installedModule,
          currentVersion: installedModule.version,
          latestVersion: marketplaceModule.version,
        });
      }
    });

    setUpdates(availableUpdates);
  }, [installed.modules, marketplace.modules]);

  const handleUpdate = async (moduleId: string) => {
    const success = await operations.updateModule(moduleId);
    if (success) {
      await installed.refreshModules();
      await marketplace.refreshMarketplace();
    }
  };

  const handleUpdateAll = async () => {
    for (const update of updates) {
      await handleUpdate(update.module.id);
    }
  };

  if (installed.loading || marketplace.loading) {
    return (
      <Center h={400}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Checking for updates...</Text>
        </Stack>
      </Center>
    );
  }

  if (updates.length === 0) {
    return (
      <Center h={400}>
        <Stack align="center" gap="md">
          <IconCheck size={48} color="green" />
          <Text size="lg" fw={500}>
            All modules are up to date!
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <Badge size="lg" variant="light" color="orange">
          {updates.length} Update{updates.length !== 1 ? 's' : ''} Available
        </Badge>
        <Button
          leftSection={<IconArrowUp size={16} />}
          onClick={handleUpdateAll}
          loading={Array.from(operations.operationStatus.values()).some(
            (status) => status.status === 'loading'
          )}
        >
          Update All
        </Button>
      </Group>

      {/* Updates List */}
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {updates.map((update) => (
          <Card
            key={update.module.id}
            shadow="sm"
            padding="md"
            radius="md"
            withBorder
          >
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={600}>{update.module.name}</Text>
                <Badge color="orange">Update Available</Badge>
              </Group>

              <Group gap="md">
                <Text size="sm" c="dimmed">
                  Current: v{update.currentVersion}
                </Text>
                <IconArrowUp size={16} />
                <Text size="sm" fw={500} c="green">
                  Latest: v{update.latestVersion}
                </Text>
              </Group>

              <Button
                fullWidth
                size="sm"
                onClick={() => handleUpdate(update.module.id)}
                loading={operations.isOperationInProgress(update.module.id)}
              >
                Update Now
              </Button>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
