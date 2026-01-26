'use client';

import {
  NavLink,
  Stack,
  Text,
  Group,
  ThemeIcon,
  Badge,
  Divider,
} from '@mantine/core';
import {
  IconShirt,
  IconTruck,
  IconCurrencyPeso,
  IconBoxSeam,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useBusinessStore } from '../../lib/store';
import { BackupRestoreSidebarPanel } from '@/modules/clothing/operations/settings/components/backup-restore/BackupRestoreSidebarPanel';
import {
  buildNavigationItems,
  getWorkspaceDefinition,
  isBusiness,
  isWorkspace,
} from './navigationItems';

export function Sidebar() {
  const pathname = usePathname();
  const { selectedBusiness, selectedWorkspace, initializeFromPath } =
    useBusinessStore();

  const isAdminBackupRestore = pathname?.startsWith('/admin/backup-restore');

  // Initialize from current path on component mount
  useEffect(() => {
    if ((!selectedBusiness || !selectedWorkspace) && pathname) {
      initializeFromPath(pathname);
    }
  }, [pathname, selectedBusiness, selectedWorkspace, initializeFromPath]);

  const navigationItems = useMemo(() => {
    if (!isBusiness(selectedBusiness) || !isWorkspace(selectedWorkspace)) {
      return [];
    }
    return buildNavigationItems(selectedBusiness, selectedWorkspace);
  }, [selectedBusiness, selectedWorkspace]);

  const workspaceMeta = getWorkspaceDefinition(selectedWorkspace);

  if (isAdminBackupRestore) {
    return (
      <Stack gap="sm" style={{ height: '100%' }}>
        <BackupRestoreSidebarPanel />
      </Stack>
    );
  }

  if (!isBusiness(selectedBusiness) || !isWorkspace(selectedWorkspace)) {
    return (
      <Stack gap="md">
        <Group>
          <ThemeIcon size="sm" radius="sm" variant="light">
            <IconShirt size={16} />
          </ThemeIcon>
          <Text size="sm" c="dimmed">
            Loading navigation...
          </Text>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      {/* Header */}
      <Group gap="sm" mb="md">
        <ThemeIcon
          size="lg"
          radius="md"
          variant="gradient"
          gradient={{
            from:
              selectedBusiness === 'clothing'
                ? 'pink'
                : selectedBusiness === 'trucking'
                  ? 'blue'
                  : selectedBusiness === 'general-merchandise'
                    ? 'orange'
                    : 'teal',
            to:
              selectedBusiness === 'clothing'
                ? 'orange'
                : selectedBusiness === 'trucking'
                  ? 'cyan'
                  : selectedBusiness === 'general-merchandise'
                    ? 'yellow'
                    : 'green',
          }}
        >
          {selectedBusiness === 'clothing' ? (
            <IconShirt size={20} />
          ) : selectedBusiness === 'trucking' ? (
            <IconTruck size={20} />
          ) : selectedBusiness === 'general-merchandise' ? (
            <IconBoxSeam size={20} />
          ) : (
            <IconCurrencyPeso size={20} />
          )}
        </ThemeIcon>
        <Stack gap={2}>
          <Text size="sm" fw={600} c="dark">
            {selectedBusiness === 'clothing'
              ? 'Clothing'
              : selectedBusiness === 'trucking'
                ? 'Trucking'
                : selectedBusiness === 'general-merchandise'
                  ? 'General Merchandise'
                  : 'Personal Finance'}
          </Text>
          <Badge
            size="xs"
            variant="light"
            color={workspaceMeta?.color ?? 'gray'}
          >
            {workspaceMeta?.label ?? 'Workspace'}
          </Badge>
        </Stack>
      </Group>

      <Divider />

      {isAdminBackupRestore ? (
        <BackupRestoreSidebarPanel />
      ) : (
        /* Navigation Items */
        <Stack gap="xs">
          {navigationItems.map((item) => {
            const isActive = pathname === item.path;
            const IconComponent = item.icon;

            return (
              <NavLink
                key={item.path}
                component={Link}
                href={item.path}
                label={item.label}
                leftSection={
                  <ThemeIcon
                    size="md"
                    radius="sm"
                    variant={isActive ? 'filled' : 'light'}
                    color="gray"
                  >
                    <IconComponent size={24} />
                  </ThemeIcon>
                }
                active={isActive}
                style={{
                  borderRadius: '8px',
                  fontWeight: isActive ? 600 : 500,
                  backgroundColor: isActive
                    ? 'rgba(255, 255, 255, 0.9)'
                    : 'transparent',
                  backdropFilter: isActive ? 'blur(10px)' : 'none',
                  WebkitBackdropFilter: isActive ? 'blur(10px)' : 'none',
                  border: isActive
                    ? '1px solid rgba(255, 255, 255, 0.3)'
                    : 'none',
                  boxShadow: isActive
                    ? '0 4px 12px rgba(0, 0, 0, 0.1)'
                    : 'none',
                }}
              />
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

export default Sidebar;
