'use client';

import { Button, Menu } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { useBusinessStore } from '../../lib/store';
import {
  getWorkspacesForBusiness,
  isBusiness,
  type WorkspaceDefinition,
} from './navigationItems';

export function WorkspaceSelector() {
  const { selectedBusiness, selectedWorkspace, setSelectedWorkspace } =
    useBusinessStore();

  if (!isBusiness(selectedBusiness)) {
    return null;
  }

  const workspaces = getWorkspacesForBusiness(selectedBusiness);
  if (workspaces.length === 0) {
    return null;
  }

  const currentWorkspace = workspaces.find(
    (w) => w.value === selectedWorkspace
  );
  const otherWorkspaces: WorkspaceDefinition[] = currentWorkspace
    ? workspaces.filter((w) => w.value !== selectedWorkspace)
    : [];
  const CurrentIcon = currentWorkspace?.icon ?? workspaces[0].icon;

  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <Button
          variant="subtle"
          rightSection={<IconChevronDown size={14} />}
          leftSection={<CurrentIcon size={16} />}
          size="sm"
        >
          {currentWorkspace?.label || 'Select Workspace'}
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Switch Workspace</Menu.Label>
        {otherWorkspaces.map((workspace) => {
          const WorkspaceIcon = workspace.icon;
          return (
            <Menu.Item
              key={workspace.value}
              onClick={() => setSelectedWorkspace(workspace.value)}
              leftSection={<WorkspaceIcon size={16} />}
            >
              {workspace.label}
            </Menu.Item>
          );
        })}
        {!currentWorkspace &&
          workspaces.map((workspace) => {
            const WorkspaceIcon = workspace.icon;
            return (
              <Menu.Item
                key={workspace.value}
                onClick={() => setSelectedWorkspace(workspace.value)}
                leftSection={<WorkspaceIcon size={16} />}
              >
                {workspace.label}
              </Menu.Item>
            );
          })}
      </Menu.Dropdown>
    </Menu>
  );
}

export default WorkspaceSelector;
