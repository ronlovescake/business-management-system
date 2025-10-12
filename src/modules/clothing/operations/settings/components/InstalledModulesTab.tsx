'use client';

/**
 * InstalledModulesTab Component
 *
 * View and manage installed modules
 */

import {
  Stack,
  TextInput,
  Select,
  SimpleGrid,
  Loader,
  Text,
  Center,
  Badge,
  Group,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useInstalledModules } from '../hooks/useInstalledModules';
import { useModuleOperations } from '../hooks/useModuleOperations';
import { ModuleCard } from './ModuleCard';
import { MODULE_STATUS_OPTIONS, MODULE_SOURCE_OPTIONS } from '../types';

export function InstalledModulesTab() {
  const installed = useInstalledModules();
  const operations = useModuleOperations();

  const handleUninstall = async (moduleId: string) => {
    const success = await operations.uninstallModule(moduleId);
    if (success) {
      await installed.refreshModules();
    }
  };

  if (installed.loading) {
    return (
      <Center h={400}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading installed modules...</Text>
        </Stack>
      </Center>
    );
  }

  if (installed.error) {
    return (
      <Center h={400}>
        <Text c="red">Error: {installed.error}</Text>
      </Center>
    );
  }

  return (
    <Stack gap="md">
      {/* Stats */}
      <Group gap="md">
        <Badge size="lg" variant="light" color="blue">
          Total: {installed.modules.length}
        </Badge>
        <Badge size="lg" variant="light" color="green">
          Enabled: {installed.modules.filter((m) => m.enabled).length}
        </Badge>
        <Badge size="lg" variant="light" color="gray">
          Disabled: {installed.modules.filter((m) => !m.enabled).length}
        </Badge>
      </Group>

      {/* Filters */}
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <TextInput
          placeholder="Search installed modules..."
          leftSection={<IconSearch size={16} />}
          value={installed.filter.searchQuery}
          onChange={(e) => installed.setSearchQuery(e.target.value)}
        />

        <Select
          placeholder="Status"
          data={MODULE_STATUS_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))}
          value={installed.filter.status}
          onChange={(value) =>
            installed.setStatus(value as typeof installed.filter.status)
          }
        />

        <Select
          placeholder="Source"
          data={MODULE_SOURCE_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))}
          value={installed.filter.source}
          onChange={(value) =>
            installed.setSource(value as typeof installed.filter.source)
          }
        />
      </SimpleGrid>

      {/* Module Grid */}
      {installed.filteredModules.length === 0 ? (
        <Center h={300}>
          <Text c="dimmed">No installed modules found</Text>
        </Center>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {installed.filteredModules.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              isInstalled={true}
              onUninstall={() => handleUninstall(module.id)}
              loading={operations.isOperationInProgress(module.id)}
            />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
