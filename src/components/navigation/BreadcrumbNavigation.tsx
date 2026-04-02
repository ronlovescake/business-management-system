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
  IconHome,
  IconShirt,
  IconTruck,
  IconCurrencyPeso,
  IconBoxSeam,
} from '@tabler/icons-react';
import { useBusinessStore } from '../../lib/store';
import { useBreadcrumbStore } from '../../lib/useBreadcrumbStore';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getIconButtonLabel } from '@/lib/accessibility';
import {
  BUSINESS_OPTIONS,
  getWorkspacesForBusiness,
  isBusiness,
  type WorkspaceDefinition,
} from './navigationItems';

export function BreadcrumbNavigation() {
  const {
    selectedBusiness,
    selectedWorkspace,
    setSelectedBusiness,
    setSelectedWorkspace,
    initializeFromPath,
  } = useBusinessStore();
  const pathname = usePathname();
  const pageLabel = useBreadcrumbStore((s) => s.pageLabel);

  // Initialize from current path on component mount
  useEffect(() => {
    if ((!selectedBusiness || !selectedWorkspace) && pathname) {
      initializeFromPath(pathname);
    }
  }, [pathname, selectedBusiness, selectedWorkspace, initializeFromPath]);

  const currentBusiness = BUSINESS_OPTIONS.find(
    (b) => b.value === selectedBusiness
  );
  const otherBusinesses = BUSINESS_OPTIONS.filter(
    (b) => b.value !== selectedBusiness
  );

  const formatSegment = (segment: string) =>
    segment
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  const getPageSegments = (): string[] => {
    if (!pathname || pathname === '/') {
      return [];
    }

    const segments = pathname.split('/').filter(Boolean);
    // First two segments are business/workspace (handled by menus)
    const pageSegments = segments.slice(2);
    if (pageSegments.length === 0) {
      return [];
    }

    // Format intermediate segments, override the last one if store has a label
    return pageSegments.map((seg, i) => {
      if (i === pageSegments.length - 1 && pageLabel) {
        return pageLabel;
      }
      return formatSegment(seg);
    });
  };

  const workspaces = isBusiness(selectedBusiness)
    ? getWorkspacesForBusiness(selectedBusiness)
    : [];
  const currentWorkspace = workspaces.find(
    (w) => w.value === selectedWorkspace
  );
  const otherWorkspaces: WorkspaceDefinition[] = currentWorkspace
    ? workspaces.filter((w) => w.value !== selectedWorkspace)
    : workspaces;

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
                onClick={() => {
                  setSelectedBusiness(business.value);
                  if (business.value === 'personal') {
                    setSelectedWorkspace('personal');
                  }
                }}
                leftSection={
                  <ThemeIcon
                    size="sm"
                    radius="sm"
                    variant="light"
                    color={
                      business.value === 'clothing'
                        ? 'pink'
                        : business.value === 'trucking'
                          ? 'blue'
                          : business.value === 'general-merchandise'
                            ? 'orange'
                            : 'teal'
                    }
                  >
                    {business.value === 'clothing' ? (
                      <IconShirt size={14} />
                    ) : business.value === 'trucking' ? (
                      <IconTruck size={14} />
                    ) : business.value === 'general-merchandise' ? (
                      <IconBoxSeam size={14} />
                    ) : (
                      <IconCurrencyPeso size={14} />
                    )}
                  </ThemeIcon>
                }
              >
                {business.label}
              </Menu.Item>
            ))
          : // Show all businesses when none is selected
            BUSINESS_OPTIONS.map((business) => (
              <Menu.Item
                key={business.value}
                onClick={() => {
                  setSelectedBusiness(business.value);
                  if (business.value === 'personal') {
                    setSelectedWorkspace('personal');
                  }
                }}
                leftSection={
                  <ThemeIcon
                    size="sm"
                    radius="sm"
                    variant="light"
                    color={
                      business.value === 'clothing'
                        ? 'pink'
                        : business.value === 'trucking'
                          ? 'blue'
                          : business.value === 'general-merchandise'
                            ? 'orange'
                            : 'teal'
                    }
                  >
                    {business.value === 'clothing' ? (
                      <IconShirt size={14} />
                    ) : business.value === 'trucking' ? (
                      <IconTruck size={14} />
                    ) : business.value === 'general-merchandise' ? (
                      <IconBoxSeam size={14} />
                    ) : (
                      <IconCurrencyPeso size={14} />
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
                        color={workspace.color}
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
                        color={workspace.color}
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

  // Page segments (intermediate + current page)
  const pageSegments = getPageSegments();
  pageSegments.forEach((label, index) => {
    breadcrumbItems.push(
      <Text key={`page-${index}`} size="sm" c="dimmed">
        {label}
      </Text>
    );
  });

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
