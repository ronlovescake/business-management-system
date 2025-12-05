'use client';

import { Button, Menu } from '@mantine/core';
import { IconChevronDown, IconUsers, IconSettings } from '@tabler/icons-react';
import { useBusinessStore } from '../../lib/store';

export function WorkspaceSelector() {
  const { selectedBusiness, selectedWorkspace, setSelectedWorkspace } =
    useBusinessStore();

  const getWorkspaces = () => {
    if (selectedBusiness === 'clothing') {
      return [
        { value: 'operations', label: 'Operations', icon: IconSettings },
        { value: 'employees', label: 'Employees', icon: IconUsers },
      ];
    }
    if (selectedBusiness === 'trucking') {
      return [
        { value: 'operations', label: 'Operations', icon: IconSettings },
        { value: 'employees', label: 'Employees', icon: IconUsers },
      ];
    }
    return [];
  };

  if (!selectedBusiness) {
    return null;
  }

  const workspaces = getWorkspaces();
  const currentWorkspace = workspaces.find(
    (w) => w.value === selectedWorkspace
  );
  const otherWorkspaces = workspaces.filter(
    (w) => w.value !== selectedWorkspace
  );
  const CurrentIcon = currentWorkspace?.icon || IconSettings;

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
