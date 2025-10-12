'use client';

/**
 * DependenciesTab Component
 *
 * View module dependencies and conflicts
 */

import { Stack, Card, Text, Center, Badge, Group, Tree } from '@mantine/core';
import { IconGitBranch } from '@tabler/icons-react';
import { useInstalledModules } from '../hooks/useInstalledModules';

export function DependenciesTab() {
  const installed = useInstalledModules();

  // Build dependency tree
  const buildDependencyTree = () => {
    return installed.modules.map((module) => ({
      label: (
        <Group gap="sm">
          <Text>{module.name}</Text>
          <Badge size="xs">{module.version}</Badge>
          {module.enabled ? (
            <Badge size="xs" color="green">
              Enabled
            </Badge>
          ) : (
            <Badge size="xs" color="gray">
              Disabled
            </Badge>
          )}
        </Group>
      ),
      value: module.id,
      children:
        module.dependencies?.map((depId) => {
          const depModule = installed.modules.find((m) => m.id === depId);
          return {
            label: depModule ? (
              <Group gap="sm">
                <Text size="sm">{depModule.name}</Text>
                <Badge size="xs">{depModule.version}</Badge>
              </Group>
            ) : (
              <Text size="sm" c="red">
                {depId} (Missing)
              </Text>
            ),
            value: depId,
          };
        }) || [],
    }));
  };

  if (installed.loading) {
    return (
      <Center h={400}>
        <Text c="dimmed">Loading dependencies...</Text>
      </Center>
    );
  }

  if (installed.modules.length === 0) {
    return (
      <Center h={400}>
        <Stack align="center" gap="md">
          <IconGitBranch size={48} />
          <Text c="dimmed">No modules installed</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="md">
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Text fw={600} mb="md">
          Module Dependency Tree
        </Text>
        <Tree data={buildDependencyTree()} />
      </Card>
    </Stack>
  );
}
