'use client';

import { NavLink, Stack, Text, Group, ThemeIcon, Badge, Divider } from '@mantine/core';
import { 
  IconDashboard, 
  IconChartBar, 
  IconReceipt, 
  IconPackage, 
  IconCalendar, 
  IconTruck, 
  IconUsers, 
  IconCurrencyDollar, 
  IconSettings,
  IconBell,
  IconShirt,
  IconClipboardList,
  IconBoxSeam,
  IconShoppingCart,
  IconGift
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useBusinessStore } from '../../lib/store';

export function Sidebar() {
  const pathname = usePathname();
  const { selectedBusiness, selectedWorkspace, initializeFromPath } = useBusinessStore();

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
            <IconDashboard size={16} />
          </ThemeIcon>
          <Text size="sm" c="dimmed">
            Loading navigation...
          </Text>
        </Group>
      </Stack>
    );
  }

  const getNavigationItems = () => {
    const basePath = `/${selectedBusiness}/${selectedWorkspace}`;
    
    if (selectedBusiness === 'clothing' && selectedWorkspace === 'operations') {
      return [
        { label: 'Dashboard', href: `${basePath}/dashboard`, icon: IconDashboard, color: 'blue' },
        { label: 'Business Intelligence', href: `${basePath}/business-intelligence`, icon: IconChartBar, color: 'violet' },
        { label: 'Transactions', href: `${basePath}/transactions`, icon: IconReceipt, color: 'green' },
        { label: 'Products', href: `${basePath}/products`, icon: IconShirt, color: 'pink' },
        { label: 'Due Dates', href: `${basePath}/due-dates`, icon: IconCalendar, color: 'orange' },
        { label: 'Inventory', href: `${basePath}/inventory`, icon: IconBoxSeam, color: 'teal' },
        { label: 'Prices', href: `${basePath}/prices`, icon: IconCurrencyDollar, color: 'yellow' },
        { label: 'Sorting/Distribution', href: `${basePath}/sorting-distribution`, icon: IconClipboardList, color: 'indigo' },
        { label: 'Customers', href: `${basePath}/customers`, icon: IconUsers, color: 'cyan' },
        { label: 'Shipments', href: `${basePath}/shipments`, icon: IconTruck, color: 'blue' },
        { label: 'Shipments Dashboard', href: `${basePath}/shipments-dashboard`, icon: IconDashboard, color: 'blue' },
        { label: 'Pickup Form', href: `${basePath}/pickup-form`, icon: IconPackage, color: 'brown' },
        { label: 'Post Template', href: `${basePath}/post-template`, icon: IconGift, color: 'grape' },
        { label: 'Notifications', href: `${basePath}/notifications`, icon: IconBell, color: 'red' },
        { label: 'Settings', href: `${basePath}/settings`, icon: IconSettings, color: 'gray' },
      ];
    }
    
    if (selectedWorkspace === 'employees') {
      const employeeItems = [
        { label: 'Dashboard', href: `${basePath}/dashboard`, icon: IconDashboard, color: 'blue' },
        { label: 'Attendance', href: `${basePath}/attendance`, icon: IconClipboardList, color: 'green' },
        { label: 'Expenses', href: `${basePath}/expenses`, icon: IconReceipt, color: 'red' },
        { label: 'Payroll', href: `${basePath}/payroll`, icon: IconCurrencyDollar, color: 'yellow' },
        { label: 'Calendar', href: `${basePath}/calendar`, icon: IconCalendar, color: 'orange' },
        { label: 'Schedules', href: `${basePath}/schedules`, icon: IconClipboardList, color: 'violet' },
        { label: 'Leave Tracker', href: `${basePath}/leave-tracker`, icon: IconCalendar, color: 'teal' },
        { label: 'Cash Advance', href: `${basePath}/cash-advance`, icon: IconCurrencyDollar, color: 'pink' },
        { label: 'Employee Loans', href: `${basePath}/employee-loans`, icon: IconCurrencyDollar, color: 'indigo' },
        { label: '13th Month Pay', href: `${basePath}/thirteenth-month-pay`, icon: IconGift, color: 'cyan' },
        { label: 'Team', href: `${basePath}/team`, icon: IconUsers, color: 'blue' },
        { label: 'Notifications', href: `${basePath}/notifications`, icon: IconBell, color: 'red' },
        { label: 'Settings', href: `${basePath}/settings`, icon: IconSettings, color: 'gray' },
      ];
      
      // Add Trips for trucking employees
      if (selectedBusiness === 'trucking') {
        employeeItems.splice(1, 0, { label: 'Trips', href: `${basePath}/trips`, icon: IconTruck, color: 'blue' });
      }
      
      return employeeItems;
    }
    
    return [];
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
          gradient={{ from: selectedBusiness === 'clothing' ? 'pink' : 'blue', to: selectedBusiness === 'clothing' ? 'orange' : 'cyan' }}
        >
          {selectedBusiness === 'clothing' ? <IconShirt size={20} /> : <IconTruck size={20} />}
        </ThemeIcon>
        <Stack gap={2}>
          <Text size="sm" fw={600} c="dark">
            {selectedBusiness === 'clothing' ? 'Clothing' : 'Trucking'}
          </Text>
          <Badge size="xs" variant="light" color={selectedWorkspace === 'operations' ? 'blue' : 'green'}>
            {selectedWorkspace === 'operations' ? 'Operations' : 'Employees'}
          </Badge>
        </Stack>
      </Group>

      <Divider />
      
      {/* Navigation Items */}
      <Stack gap="xs">
        {navigationItems.map((item: any) => {
          const isActive = pathname === item.href;
          return (
            <NavLink
              key={item.href}
              component={Link}
              href={item.href}
              label={item.label}
              leftSection={
                <ThemeIcon 
                  size="sm" 
                  radius="sm" 
                  variant={isActive ? 'filled' : 'light'} 
                  color={item.color}
                >
                  <item.icon size={16} />
                </ThemeIcon>
              }
              active={isActive}
              style={{
                borderRadius: '8px',
                fontWeight: isActive ? 600 : 500,
              }}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}

export default Sidebar;