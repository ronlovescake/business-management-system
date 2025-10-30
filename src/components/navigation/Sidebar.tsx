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
  IconChartBar,
  IconBoxSeam,
  IconDashboard,
  IconPackage,
  IconGift,
  IconLink,
  IconBell,
  IconSettings,
  IconClipboardList,
  IconReceipt,
  IconCurrencyPeso,
  IconCalendar,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useBusinessStore } from '../../lib/store';
import { moduleRegistry } from '@/modules';

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

  // Type guards to ensure proper types for ModuleRegistry
  const business = selectedBusiness as 'clothing' | 'trucking';
  const workspace = selectedWorkspace as 'operations' | 'employees';

  const getNavigationItems = () => {
    const basePath = `/${selectedBusiness}/${selectedWorkspace}`;

    // Get registered modules for the current business context
    const moduleNavItems = moduleRegistry.getNavigation(business, workspace);

    // Additional navigation items that don't have modules yet
    const additionalItems: Array<{
      label: string;
      path: string;
      icon: React.ComponentType;
      order: number;
    }> = [];

    if (selectedBusiness === 'clothing' && selectedWorkspace === 'operations') {
      additionalItems.push(
        {
          label: 'Business Intelligence',
          path: `${basePath}/business-intelligence`,
          icon: IconChartBar,
          order: 1.5, // Between Dashboard (0) and other modules
        },
        {
          label: 'Inventory',
          path: `${basePath}/inventory`,
          icon: IconBoxSeam,
          order: 8.5, // After the main modules
        },
        {
          label: 'Shipments Dashboard',
          path: `${basePath}/shipments-dashboard`,
          icon: IconDashboard,
          order: 6.5, // After Shipments module
        },
        {
          label: 'Pickup Form',
          path: `${basePath}/pickup-form`,
          icon: IconPackage,
          order: 9,
        },
        {
          label: 'Post Template',
          path: `${basePath}/post-template`,
          icon: IconGift,
          order: 10,
        },
        {
          label: 'Checkout Links',
          path: `${basePath}/checkout-links`,
          icon: IconLink,
          order: 11,
        },
        {
          label: 'Notifications',
          path: `${basePath}/notifications`,
          icon: IconBell,
          order: 12,
        },
        {
          label: 'Settings',
          path: `${basePath}/settings`,
          icon: IconSettings,
          order: 13,
        }
      );
    }

    if (selectedWorkspace === 'employees') {
      const employeeItems = [
        {
          label: 'Dashboard',
          path: `${basePath}/dashboard`,
          icon: IconDashboard,
          order: 0,
        },
        {
          label: 'Attendance',
          path: `${basePath}/attendance`,
          icon: IconClipboardList,
          order: 1,
        },
        {
          label: 'Expenses',
          path: `${basePath}/expenses`,
          icon: IconReceipt,
          order: 2,
        },
        {
          label: 'Payroll',
          path: `${basePath}/payroll`,
          icon: IconCurrencyPeso,
          order: 3,
        },
        {
          label: 'Calendar',
          path: `${basePath}/calendar`,
          icon: IconCalendar,
          order: 4,
        },
        {
          label: 'Schedules',
          path: `${basePath}/schedules`,
          icon: IconClipboardList,
          order: 5,
        },
        {
          label: 'Leave Tracker',
          path: `${basePath}/leave-tracker`,
          icon: IconCalendar,
          order: 6,
        },
        {
          label: 'Cash Advance',
          path: `${basePath}/cash-advance`,
          icon: IconCurrencyPeso,
          order: 7,
        },
        {
          label: 'Employee Loans',
          path: `${basePath}/employee-loans`,
          icon: IconCurrencyPeso,
          order: 8,
        },
        {
          label: '13th Month Pay',
          path: `${basePath}/thirteenth-month-pay`,
          icon: IconGift,
          order: 9,
        },
        {
          label: 'Team',
          path: `${basePath}/team`,
          icon: IconUsers,
          order: 10,
        },
        {
          label: 'Notifications',
          path: `${basePath}/notifications`,
          icon: IconBell,
          order: 11,
        },
        {
          label: 'Settings',
          path: `${basePath}/settings`,
          icon: IconSettings,
          order: 12,
        },
      ];

      // Add Trips for trucking employees
      if (selectedBusiness === 'trucking') {
        employeeItems.splice(1, 0, {
          label: 'Trips',
          path: `${basePath}/trips`,
          icon: IconTruck,
          order: 1.5,
        });
      }

      additionalItems.push(...employeeItems);
    }

    // Combine module navigation with additional items
    const allItems = [
      ...moduleNavItems.map((item) => ({
        label: item.label,
        path: item.path,
        icon: item.icon,
        order: item.order,
      })),
      ...additionalItems,
    ];

    // Sort by order and remove duplicates (prefer module items)
    const seenPaths = new Set<string>();
    const uniqueItems = allItems
      .sort((a, b) => a.order - b.order)
      .filter((item) => {
        if (seenPaths.has(item.path)) {
          return false;
        }
        seenPaths.add(item.path);
        return true;
      });

    return uniqueItems;
  };

  const navigationItems = getNavigationItems();

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
