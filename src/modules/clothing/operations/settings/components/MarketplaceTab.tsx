'use client';

/**
 * MarketplaceTab Component
 *
 * Browse and install modules from marketplace
 */

import {
  Stack,
  TextInput,
  Select,
  SimpleGrid,
  Loader,
  Text,
  Center,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useModuleMarketplace } from '../hooks/useModuleMarketplace';
import { useInstalledModules } from '../hooks/useInstalledModules';
import { useModuleOperations } from '../hooks/useModuleOperations';
import { ModuleCard } from './ModuleCard';
import { MODULE_CATEGORIES, SORT_OPTIONS } from '../types';

export function MarketplaceTab() {
  const marketplace = useModuleMarketplace();
  const installed = useInstalledModules();
  const operations = useModuleOperations();

  const installedModuleIds = new Set(installed.modules.map((m) => m.id));

  const handleInstall = async (moduleId: string) => {
    const success = await operations.installModule(moduleId);
    if (success) {
      await installed.refreshModules();
      await marketplace.refreshMarketplace();
    }
  };

  if (marketplace.loading) {
    return (
      <Center h={400}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading marketplace...</Text>
        </Stack>
      </Center>
    );
  }

  if (marketplace.error) {
    return (
      <Center h={400}>
        <Text c="red">Error: {marketplace.error}</Text>
      </Center>
    );
  }

  return (
    <Stack gap="md">
      {/* Filters */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
        <TextInput
          placeholder="Search modules..."
          leftSection={<IconSearch size={16} />}
          value={marketplace.filter.searchQuery}
          onChange={(e) => marketplace.setSearchQuery(e.target.value)}
        />

        <Select
          placeholder="All categories"
          data={[
            { value: '', label: 'All Categories' },
            ...MODULE_CATEGORIES.map((cat) => ({
              value: cat.value,
              label: cat.label,
            })),
          ]}
          value={marketplace.filter.category || ''}
          onChange={(value) => marketplace.setCategory(value || null)}
          clearable
        />

        <Select
          placeholder="Sort by"
          data={SORT_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))}
          value={marketplace.filter.sortBy}
          onChange={(value) =>
            marketplace.setSortBy(value as typeof marketplace.filter.sortBy)
          }
        />
      </SimpleGrid>

      {/* Module Grid */}
      {marketplace.filteredModules.length === 0 ? (
        <Center h={300}>
          <Text c="dimmed">No modules found</Text>
        </Center>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {marketplace.filteredModules.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              isInstalled={installedModuleIds.has(module.id)}
              onInstall={() => handleInstall(module.id)}
              loading={operations.isOperationInProgress(module.id)}
            />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
