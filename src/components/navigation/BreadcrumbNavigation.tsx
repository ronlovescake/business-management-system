'use client';

import {
  Breadcrumbs,
  Button,
  Menu,
  Text,
  Group,
  ThemeIcon,
  ActionIcon,
} from '@mantine/core';
import {
  IconChevronDown,
  IconUsers,
  IconSettings,
  IconHome,
  IconShirt,
  IconTruck,
} from '@tabler/icons-react';
import { useBusinessStore } from '../../lib/store';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getIconButtonLabel } from '@/lib/accessibility';

const businesses = [
  { value: 'clothing', label: 'Czarlie & Ron Clothing' },
  { value: 'trucking', label: 'Czarlie & Ron Trucking' },
];

export function BreadcrumbNavigation() {
  const {
    selectedBusiness,
    selectedWorkspace,
    setSelectedBusiness,
    setSelectedWorkspace,
    initializeFromPath,
  } = useBusinessStore();
  const pathname = usePathname();

  // Initialize from current path on component mount
  useEffect(() => {
    if ((!selectedBusiness || !selectedWorkspace) && pathname) {
      initializeFromPath(pathname);
    }
  }, [pathname, selectedBusiness, selectedWorkspace, initializeFromPath]);

  const currentBusiness = businesses.find((b) => b.value === selectedBusiness);
  const otherBusinesses = businesses.filter(
    (b) => b.value !== selectedBusiness
  );

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

  const getCurrentPageName = () => {
    if (!pathname || pathname === '/') {
      return 'Home';
    }

    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      return 'Home';
    }

    // Get the last segment and format it
    const lastSegment = segments[segments.length - 1];
    return lastSegment
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const workspaces = getWorkspaces();
  const currentWorkspace = workspaces.find(
    (w) => w.value === selectedWorkspace
  );
  const otherWorkspaces = workspaces.filter(
    (w) => w.value !== selectedWorkspace
  );

  const breadcrumbItems = [
    // Business Level
    <Menu key="business" shadow="lg" width={280} radius="md">
      <Menu.Target>
        <Button
          variant="light"
          rightSection={<IconChevronDown size={14} />}
          size="md"
          radius="md"
          fw={500}
        >
          {currentBusiness?.label || 'Select Business'}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Switch Business</Menu.Label>
        {currentBusiness
          ? // Show only other businesses when one is selected
            otherBusinesses.map((business) => (
              <Menu.Item
                key={business.value}
                onClick={() => setSelectedBusiness(business.value)}
                leftSection={
                  <ThemeIcon
                    size="sm"
                    radius="sm"
                    variant="light"
                    color={business.value === 'clothing' ? 'pink' : 'blue'}
                  >
                    {business.value === 'clothing' ? (
                      <IconShirt size={14} />
                    ) : (
                      <IconTruck size={14} />
                    )}
                  </ThemeIcon>
                }
              >
                {business.label}
              </Menu.Item>
            ))
          : // Show all businesses when none is selected
            businesses.map((business) => (
              <Menu.Item
                key={business.value}
                onClick={() => setSelectedBusiness(business.value)}
                leftSection={
                  <ThemeIcon
                    size="sm"
                    radius="sm"
                    variant="light"
                    color={business.value === 'clothing' ? 'pink' : 'blue'}
                  >
                    {business.value === 'clothing' ? (
                      <IconShirt size={14} />
                    ) : (
                      <IconTruck size={14} />
                    )}
                  </ThemeIcon>
                }
              >
                {business.label}
              </Menu.Item>
            ))}
      </Menu.Dropdown>
    </Menu>,
  ];

  // Workspace Level (only show if business is selected)
  if (selectedBusiness && workspaces.length > 0) {
    breadcrumbItems.push(
      <Menu key="workspace" shadow="lg" width={220} radius="md">
        <Menu.Target>
          <Button
            variant="light"
            rightSection={<IconChevronDown size={14} />}
            size="md"
            radius="md"
            fw={500}
          >
            {currentWorkspace?.label || 'Select Workspace'}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Switch Workspace</Menu.Label>
          {currentWorkspace
            ? // Show only other workspaces when one is selected
              otherWorkspaces.map((workspace) => {
                const WorkspaceIcon = workspace.icon;
                return (
                  <Menu.Item
                    key={workspace.value}
                    onClick={() => setSelectedWorkspace(workspace.value)}
                    leftSection={
                      <ThemeIcon
                        size="sm"
                        radius="sm"
                        variant="light"
                        color={
                          workspace.value === 'operations' ? 'blue' : 'green'
                        }
                      >
                        <WorkspaceIcon size={14} />
                      </ThemeIcon>
                    }
                  >
                    {workspace.label}
                  </Menu.Item>
                );
              })
            : // Show all workspaces when none is selected
              workspaces.map((workspace) => {
                const WorkspaceIcon = workspace.icon;
                return (
                  <Menu.Item
                    key={workspace.value}
                    onClick={() => setSelectedWorkspace(workspace.value)}
                    leftSection={
                      <ThemeIcon
                        size="sm"
                        radius="sm"
                        variant="light"
                        color={
                          workspace.value === 'operations' ? 'blue' : 'green'
                        }
                      >
                        <WorkspaceIcon size={14} />
                      </ThemeIcon>
                    }
                  >
                    {workspace.label}
                  </Menu.Item>
                );
              })}
        </Menu.Dropdown>
      </Menu>
    );
  }

  // Current Page (only show if not home page)
  const currentPage = getCurrentPageName();
  if (currentPage !== 'Home' && pathname !== '/') {
    breadcrumbItems.push(
      <Text key="current-page" size="sm" c="dimmed">
        {currentPage}
      </Text>
    );
  }

  return (
    <Group gap="sm">
      <ActionIcon
        variant="light"
        size="lg"
        radius="md"
        component="a"
        href="/"
        {...getIconButtonLabel('Go to home page')}
      >
        <IconHome size={18} />
      </ActionIcon>
      <Breadcrumbs separator="/" separatorMargin="md">
        {breadcrumbItems}
      </Breadcrumbs>
    </Group>
  );
}

export default BreadcrumbNavigation;
