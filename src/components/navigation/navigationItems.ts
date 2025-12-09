import {
  IconBell,
  IconCalendar,
  IconChartBar,
  IconClipboardList,
  IconCurrencyPeso,
  IconDashboard,
  IconGift,
  IconLink,
  IconSettings,
  IconBoxSeam,
  IconUsers,
  IconReceipt,
  IconMessage,
} from '@tabler/icons-react';
import { moduleRegistry } from '@/modules';
import type { IconComponent } from '@/core/ModuleRegistry';

export type WorkspaceType = 'operations' | 'employees' | 'expenses';
export type BusinessType = 'clothing' | 'trucking';

export interface WorkspaceDefinition {
  value: WorkspaceType;
  label: string;
  icon: IconComponent;
  color: string;
  businesses: BusinessType[];
  description?: string;
}

export const BUSINESS_OPTIONS: ReadonlyArray<{
  value: BusinessType;
  label: string;
}> = [
  { value: 'clothing', label: 'Czarlie & Ron Clothing' },
  { value: 'trucking', label: 'Czarlie & Ron Trucking' },
];

export const isBusiness = (
  value: string | null | undefined
): value is BusinessType => value === 'clothing' || value === 'trucking';

const WORKSPACE_DEFINITIONS: WorkspaceDefinition[] = [
  {
    value: 'operations',
    label: 'Operations',
    icon: IconSettings as IconComponent,
    color: 'blue',
    businesses: ['clothing', 'trucking'],
  },
  {
    value: 'employees',
    label: 'Employees',
    icon: IconUsers as IconComponent,
    color: 'green',
    businesses: ['clothing', 'trucking'],
  },
  {
    value: 'expenses',
    label: 'Expenses',
    icon: IconReceipt as IconComponent,
    color: 'grape',
    businesses: ['trucking'],
    description: 'Standalone trucking expenses workspace',
  },
];

export function getWorkspacesForBusiness(
  business?: BusinessType | null
): WorkspaceDefinition[] {
  if (!business) {
    return [];
  }
  return WORKSPACE_DEFINITIONS.filter((workspace) =>
    workspace.businesses.includes(business)
  );
}

export function getWorkspaceDefinition(
  value?: string | null
): WorkspaceDefinition | undefined {
  if (!value) {
    return undefined;
  }
  return WORKSPACE_DEFINITIONS.find((workspace) => workspace.value === value);
}

export function isWorkspace(value?: string | null): value is WorkspaceType {
  if (!value) {
    return false;
  }
  return WORKSPACE_DEFINITIONS.some((workspace) => workspace.value === value);
}

export interface NavigationItem {
  label: string;
  path: string;
  icon: IconComponent;
  order: number;
}

export function buildNavigationItems(
  business: BusinessType,
  workspace: WorkspaceType
): NavigationItem[] {
  const basePath = `/${business}/${workspace}`;

  const moduleNavItems = moduleRegistry
    .getNavigation(business, workspace)
    .map((item) => ({
      label: item.label,
      path: item.path,
      icon: item.icon,
      order: item.order,
    }));

  const additionalItems: NavigationItem[] = [];

  if (business === 'clothing' && workspace === 'operations') {
    additionalItems.push(
      {
        label: 'Business Intelligence',
        path: `${basePath}/business-intelligence`,
        icon: IconChartBar as IconComponent,
        order: 1.5,
      },
      {
        label: 'Inventory',
        path: `${basePath}/inventory`,
        icon: IconBoxSeam as IconComponent,
        order: 8.5,
      },
      {
        label: 'Post Template',
        path: `${basePath}/post-template`,
        icon: IconGift as IconComponent,
        order: 10,
      },
      {
        label: 'Message Templates',
        path: `${basePath}/message-templates`,
        icon: IconMessage as IconComponent,
        order: 10.5,
      },
      {
        label: 'Invoicing',
        path: `${basePath}/checkout-links`,
        icon: IconLink as IconComponent,
        order: 11,
      },
      {
        label: 'Notifications',
        path: `${basePath}/notifications`,
        icon: IconBell as IconComponent,
        order: 12,
      },
      {
        label: 'Settings',
        path: `${basePath}/settings`,
        icon: IconSettings as IconComponent,
        order: 13,
      }
    );
  }

  if (workspace === 'operations') {
    if (business === 'trucking') {
      additionalItems.push({
        label: 'Operations Overview',
        path: basePath,
        icon: IconDashboard as IconComponent,
        order: 0,
      });
    }
  }

  if (workspace === 'employees') {
    const employeeItems: NavigationItem[] = [
      {
        label: 'Dashboard',
        path: `${basePath}/dashboard`,
        icon: IconDashboard as IconComponent,
        order: 0,
      },
      {
        label: 'Attendance',
        path: `${basePath}/attendance`,
        icon: IconClipboardList as IconComponent,
        order: 1,
      },
      {
        label: 'Expenses',
        path: `${basePath}/expenses`,
        icon: IconReceipt as IconComponent,
        order: 2,
      },
      {
        label: 'Payroll',
        path: `${basePath}/payroll`,
        icon: IconCurrencyPeso as IconComponent,
        order: 3,
      },
      {
        label: 'Calendar',
        path: `${basePath}/calendar`,
        icon: IconCalendar as IconComponent,
        order: 4,
      },
      {
        label: 'Schedules',
        path: `${basePath}/schedules`,
        icon: IconClipboardList as IconComponent,
        order: 5,
      },
      {
        label: 'Leave Tracker',
        path: `${basePath}/leave-tracker`,
        icon: IconCalendar as IconComponent,
        order: 6,
      },
      {
        label: 'Cash Advance',
        path: `${basePath}/cash-advance`,
        icon: IconCurrencyPeso as IconComponent,
        order: 7,
      },
      {
        label: 'Employee Loans',
        path: `${basePath}/employee-loans`,
        icon: IconCurrencyPeso as IconComponent,
        order: 8,
      },
      {
        label: '13th Month Pay',
        path: `${basePath}/thirteenth-month-pay`,
        icon: IconGift as IconComponent,
        order: 9,
      },
      {
        label: 'Team',
        path: `${basePath}/team`,
        icon: IconUsers as IconComponent,
        order: 10,
      },
      {
        label: 'Notifications',
        path: `${basePath}/notifications`,
        icon: IconBell as IconComponent,
        order: 11,
      },
      {
        label: 'Settings',
        path: `${basePath}/settings`,
        icon: IconSettings as IconComponent,
        order: 12,
      },
    ];

    additionalItems.push(...employeeItems);
  }

  if (workspace === 'expenses') {
    if (business === 'trucking') {
      additionalItems.push({
        label: 'Expenses',
        path: basePath,
        icon: IconReceipt as IconComponent,
        order: 0,
      });
    }
  }

  const seenPaths = new Set<string>();
  return [...moduleNavItems, ...additionalItems]
    .sort((a, b) => a.order - b.order)
    .filter((item) => {
      if (seenPaths.has(item.path)) {
        return false;
      }
      seenPaths.add(item.path);
      return true;
    });
}
