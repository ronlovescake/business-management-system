'use client';

import React from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Collapse,
  Divider,
  Group,
  LoadingOverlay,
  Paper,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconKey,
} from '@tabler/icons-react';
import type { UserModule } from '../types';

type PermissionNodeProps = {
  userId: string;
  module: UserModule;
  selectedModuleIds: string[];
  collapsible?: boolean;
  depth?: number;
  onToggleModule: (
    userId: string,
    moduleId: string,
    module?: UserModule
  ) => void;
  onToggleSection: (userId: string, sectionId: string) => void;
  isSectionExpanded: (userId: string, sectionId: string) => boolean;
  isModuleIndeterminate: (userId: string, module: UserModule) => boolean;
  areAllChildrenChecked: (userId: string, module: UserModule) => boolean;
};

function PermissionNode({
  userId,
  module,
  selectedModuleIds,
  collapsible = true,
  depth = 0,
  onToggleModule,
  onToggleSection,
  isSectionExpanded,
  isModuleIndeterminate,
  areAllChildrenChecked,
}: PermissionNodeProps) {
  const hasChildren = Boolean(module.children?.length);
  const isExpanded =
    !collapsible || !hasChildren || isSectionExpanded(userId, module.id);

  return (
    <Box>
      <Group gap="xs" wrap="nowrap" align="center">
        {collapsible && hasChildren ? (
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={() => onToggleSection(userId, module.id)}
          >
            {isExpanded ? (
              <IconChevronDown size={16} />
            ) : (
              <IconChevronRight size={16} />
            )}
          </ActionIcon>
        ) : (
          <Box w={24} />
        )}

        <Checkbox
          label={
            <Text
              fw={depth === 0 ? 600 : depth === 1 ? 500 : 400}
              size="sm"
              c={depth >= 2 ? 'dimmed' : undefined}
            >
              {module.displayName}
            </Text>
          }
          checked={
            selectedModuleIds.includes(module.id) ||
            areAllChildrenChecked(userId, module)
          }
          indeterminate={isModuleIndeterminate(userId, module)}
          onChange={() => onToggleModule(userId, module.id, module)}
        />
      </Group>

      {hasChildren ? (
        <Collapse in={isExpanded}>
          <Box pl={depth === 0 ? 'xl' : 'lg'} mt={depth === 0 ? 'xs' : 6}>
            <Stack gap={depth === 0 ? 'md' : 'xs'}>
              {module.children?.map((child) => (
                <PermissionNode
                  key={child.id}
                  userId={userId}
                  module={child}
                  selectedModuleIds={selectedModuleIds}
                  depth={depth + 1}
                  onToggleModule={onToggleModule}
                  onToggleSection={onToggleSection}
                  isSectionExpanded={isSectionExpanded}
                  isModuleIndeterminate={isModuleIndeterminate}
                  areAllChildrenChecked={areAllChildrenChecked}
                />
              ))}
            </Stack>
          </Box>
        </Collapse>
      ) : null}
    </Box>
  );
}

type UserPermissionTreeProps = {
  userId: string;
  modules: UserModule[];
  selectedModuleIds: string[];
  loading: boolean;
  saving: boolean;
  hasChanges: boolean;
  onSave: (userId: string) => Promise<void> | void;
  onToggleModule: (
    userId: string,
    moduleId: string,
    module?: UserModule
  ) => void;
  onToggleSection: (userId: string, sectionId: string) => void;
  isSectionExpanded: (userId: string, sectionId: string) => boolean;
  isModuleIndeterminate: (userId: string, module: UserModule) => boolean;
  areAllChildrenChecked: (userId: string, module: UserModule) => boolean;
};

export function UserPermissionTree({
  userId,
  modules,
  selectedModuleIds,
  loading,
  saving,
  hasChanges,
  onSave,
  onToggleModule,
  onToggleSection,
  isSectionExpanded,
  isModuleIndeterminate,
  areAllChildrenChecked,
}: UserPermissionTreeProps) {
  return (
    <Box p="md">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <IconKey size={20} />
          <Text size="sm" fw={600}>
            Module Permissions
          </Text>
        </Group>
        <Button
          size="xs"
          loading={saving}
          disabled={!hasChanges}
          onClick={() => void onSave(userId)}
        >
          Save Permissions
        </Button>
      </Group>

      {loading ? (
        <LoadingOverlay visible />
      ) : (
        <ScrollArea style={{ height: '86vh' }}>
          <Stack gap="md">
            {modules.map((module) => (
              <Paper key={module.id} p="sm" withBorder>
                <Stack gap="xs">
                  <PermissionNode
                    userId={userId}
                    module={module}
                    selectedModuleIds={selectedModuleIds}
                    collapsible={false}
                    onToggleModule={onToggleModule}
                    onToggleSection={onToggleSection}
                    isSectionExpanded={isSectionExpanded}
                    isModuleIndeterminate={isModuleIndeterminate}
                    areAllChildrenChecked={areAllChildrenChecked}
                  />
                  {module.children?.length ? <Divider /> : null}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </ScrollArea>
      )}
    </Box>
  );
}
