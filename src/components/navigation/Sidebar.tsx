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
import { IconShirt, IconTruck } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useBusinessStore } from '../../lib/store';
import { buildNavigationItems } from './navigationItems';

export function Sidebar() {
  const pathname = usePathname();
  const { selectedBusiness, selectedWorkspace, initializeFromPath } =
    useBusinessStore();

  // Initialize from current path on component mount
  useEffect(() => {
    if ((!selectedBusiness || !selectedWorkspace) && pathname) {
      initializeFromPath(pathname);
    }
  }, [pathname, selectedBusiness, selectedWorkspace, initializeFromPath]);

  const navigationItems = useMemo(() => {
    if (!selectedBusiness || !selectedWorkspace) {
      return [];
    }
    const business = selectedBusiness as 'clothing' | 'trucking';
    const workspace = selectedWorkspace as 'operations' | 'employees';
    return buildNavigationItems(business, workspace);
  }, [selectedBusiness, selectedWorkspace]);

  if (!selectedBusiness || !selectedWorkspace) {
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
            from: selectedBusiness === 'clothing' ? 'pink' : 'blue',
            to: selectedBusiness === 'clothing' ? 'orange' : 'cyan',
          }}
        >
          {selectedBusiness === 'clothing' ? (
            <IconShirt size={20} />
          ) : (
            <IconTruck size={20} />
          )}
        </ThemeIcon>
        <Stack gap={2}>
          <Text size="sm" fw={600} c="dark">
            {selectedBusiness === 'clothing' ? 'Clothing' : 'Trucking'}
          </Text>
          <Badge
            size="xs"
            variant="light"
            color={selectedWorkspace === 'operations' ? 'blue' : 'green'}
          >
            {selectedWorkspace === 'operations' ? 'Operations' : 'Employees'}
          </Badge>
        </Stack>
      </Group>

      <Divider />

      {/* Navigation Items */}
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
                boxShadow: isActive ? '0 4px 12px rgba(0, 0, 0, 0.1)' : 'none',
              }}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}

export default Sidebar;
