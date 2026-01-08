import { type NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';

// Define all available modules in your app
const APP_MODULES = [
  // Clothing Business
  {
    name: 'clothing',
    displayName: 'Clothing Business',
    path: '/clothing',
    category: 'clothing',
    icon: 'IconShirt',
    description: 'Clothing business management',
    sortOrder: 1,
  },
  {
    name: 'clothing-users',
    displayName: 'User Management',
    path: '/clothing/users',
    category: 'clothing',
    icon: 'IconUsers',
    description: 'Manage user accounts and permissions',
    parentName: 'clothing',
    sortOrder: 1,
  },
  // Clothing Operations
  {
    name: 'clothing-operations',
    displayName: 'Operations',
    path: '/clothing/operations',
    category: 'clothing',
    icon: 'IconBriefcase',
    description: 'Clothing operations management',
    parentName: 'clothing',
    sortOrder: 2,
  },
  {
    name: 'clothing-operations-dashboard',
    displayName: 'Dashboard',
    path: '/clothing/operations/dashboard',
    category: 'clothing',
    icon: 'IconDashboard',
    parentName: 'clothing-operations',
    sortOrder: 1,
  },
  {
    name: 'clothing-operations-transactions',
    displayName: 'Transactions',
    path: '/clothing/operations/transactions',
    category: 'clothing',
    icon: 'IconReceipt',
    parentName: 'clothing-operations',
    sortOrder: 2,
  },
  {
    name: 'clothing-operations-customers',
    displayName: 'Customers',
    path: '/clothing/operations/customers',
    category: 'clothing',
    icon: 'IconUserCheck',
    parentName: 'clothing-operations',
    sortOrder: 3,
  },
  {
    name: 'clothing-operations-products',
    displayName: 'Products',
    path: '/clothing/operations/products',
    category: 'clothing',
    icon: 'IconPackage',
    parentName: 'clothing-operations',
    sortOrder: 4,
  },
  {
    name: 'clothing-operations-inventory',
    displayName: 'Inventory',
    path: '/clothing/operations/inventory',
    category: 'clothing',
    icon: 'IconBox',
    parentName: 'clothing-operations',
    sortOrder: 5,
  },
  {
    name: 'clothing-operations-shipments',
    displayName: 'Shipments',
    path: '/clothing/operations/shipments',
    category: 'clothing',
    icon: 'IconTruck',
    parentName: 'clothing-operations',
    sortOrder: 6,
  },
  {
    name: 'clothing-operations-prices',
    displayName: 'Prices',
    path: '/clothing/operations/prices',
    category: 'clothing',
    icon: 'IconCurrencyDollar',
    parentName: 'clothing-operations',
    sortOrder: 7,
  },
  {
    name: 'clothing-operations-sorting-distribution',
    displayName: 'Sorting & Distribution',
    path: '/clothing/operations/sorting-distribution',
    category: 'clothing',
    icon: 'IconFilter',
    parentName: 'clothing-operations',
    sortOrder: 9,
  },
  {
    name: 'clothing-operations-checkout-links',
    displayName: 'Invoicing',
    path: '/clothing/operations/checkout-links',
    category: 'clothing',
    icon: 'IconLink',
    parentName: 'clothing-operations',
    sortOrder: 10,
  },
  {
    name: 'clothing-operations-dispatching',
    displayName: 'Dispatching',
    path: '/clothing/operations/dispatching',
    category: 'clothing',
    icon: 'IconSend',
    parentName: 'clothing-operations',
    sortOrder: 11,
  },
  {
    name: 'clothing-operations-business-intelligence',
    displayName: 'Business Intelligence',
    path: '/clothing/operations/business-intelligence',
    category: 'clothing',
    icon: 'IconChartBar',
    parentName: 'clothing-operations',
    sortOrder: 12,
  },
  {
    name: 'clothing-operations-messaging',
    displayName: 'Messaging',
    path: '/clothing/operations/messaging',
    category: 'clothing',
    icon: 'IconMessage',
    parentName: 'clothing-operations',
    sortOrder: 13,
  },
  {
    name: 'clothing-operations-post-template',
    displayName: 'Post Template',
    path: '/clothing/operations/post-template',
    category: 'clothing',
    icon: 'IconTemplate',
    parentName: 'clothing-operations',
    sortOrder: 14,
  },
  {
    name: 'clothing-operations-message-templates',
    displayName: 'Message Templates',
    path: '/clothing/operations/message-templates',
    category: 'clothing',
    icon: 'IconMessage',
    parentName: 'clothing-operations',
    sortOrder: 14.5,
  },
  {
    name: 'clothing-operations-settings',
    displayName: 'Settings',
    path: '/clothing/operations/settings',
    category: 'clothing',
    icon: 'IconSettings',
    parentName: 'clothing-operations',
    sortOrder: 15,
  },
  {
    name: 'clothing-operations-notifications',
    displayName: 'Notifications',
    path: '/clothing/operations/notifications',
    category: 'clothing',
    icon: 'IconBell',
    parentName: 'clothing-operations',
    sortOrder: 16,
  },
  // Clothing Employees
  {
    name: 'clothing-employees',
    displayName: 'Employees',
    path: '/clothing/employees',
    category: 'clothing',
    icon: 'IconUsers',
    description: 'Employee management',
    parentName: 'clothing',
    sortOrder: 3,
  },
  {
    name: 'clothing-employees-dashboard',
    displayName: 'Dashboard',
    path: '/clothing/employees/dashboard',
    category: 'clothing',
    icon: 'IconDashboard',
    parentName: 'clothing-employees',
    sortOrder: 1,
  },
  {
    name: 'clothing-employees-team',
    displayName: 'Team',
    path: '/clothing/employees/team',
    category: 'clothing',
    icon: 'IconUsers',
    parentName: 'clothing-employees',
    sortOrder: 2,
  },
  {
    name: 'clothing-employees-attendance',
    displayName: 'Attendance',
    path: '/clothing/employees/attendance',
    category: 'clothing',
    icon: 'IconClock',
    parentName: 'clothing-employees',
    sortOrder: 3,
  },
  {
    name: 'clothing-employees-schedules',
    displayName: 'Schedules',
    path: '/clothing/employees/schedules',
    category: 'clothing',
    icon: 'IconCalendar',
    parentName: 'clothing-employees',
    sortOrder: 4,
  },
  {
    name: 'clothing-employees-calendar',
    displayName: 'Calendar',
    path: '/clothing/employees/calendar',
    category: 'clothing',
    icon: 'IconCalendarEvent',
    parentName: 'clothing-employees',
    sortOrder: 5,
  },
  {
    name: 'clothing-employees-payroll',
    displayName: 'Payroll',
    path: '/clothing/employees/payroll',
    category: 'clothing',
    icon: 'IconCash',
    parentName: 'clothing-employees',
    sortOrder: 6,
  },
  {
    name: 'clothing-employees-leave-tracker',
    displayName: 'Leave Tracker',
    path: '/clothing/employees/leave-tracker',
    category: 'clothing',
    icon: 'IconCalendarOff',
    parentName: 'clothing-employees',
    sortOrder: 7,
  },
  {
    name: 'clothing-employees-cash-advance',
    displayName: 'Cash Advance',
    path: '/clothing/employees/cash-advance',
    category: 'clothing',
    icon: 'IconCreditCard',
    parentName: 'clothing-employees',
    sortOrder: 8,
  },
  {
    name: 'clothing-employees-employee-loans',
    displayName: 'Employee Loans',
    path: '/clothing/employees/employee-loans',
    category: 'clothing',
    icon: 'IconCoinPound',
    parentName: 'clothing-employees',
    sortOrder: 9,
  },
  {
    name: 'clothing-employees-thirteenth-month-pay',
    displayName: '13th Month Pay',
    path: '/clothing/employees/thirteenth-month-pay',
    category: 'clothing',
    icon: 'IconGift',
    parentName: 'clothing-employees',
    sortOrder: 10,
  },
  {
    name: 'clothing-employees-expenses',
    displayName: 'Expenses',
    path: '/clothing/accounting',
    category: 'clothing',
    icon: 'IconReceipt',
    parentName: 'clothing-employees',
    sortOrder: 11,
  },
  {
    name: 'clothing-employees-settings',
    displayName: 'Settings',
    path: '/clothing/employees/settings',
    category: 'clothing',
    icon: 'IconSettings',
    parentName: 'clothing-employees',
    sortOrder: 12,
  },
  {
    name: 'clothing-employees-notifications',
    displayName: 'Notifications',
    path: '/clothing/employees/notifications',
    category: 'clothing',
    icon: 'IconBell',
    parentName: 'clothing-employees',
    sortOrder: 13,
  },
  // Trucking Business
  {
    name: 'trucking',
    displayName: 'Trucking Business',
    path: '/trucking',
    category: 'trucking',
    icon: 'IconTruck',
    description: 'Trucking business management',
    sortOrder: 2,
  },
  {
    name: 'trucking-employees',
    displayName: 'Employees',
    path: '/trucking/employees',
    category: 'trucking',
    icon: 'IconUsers',
    description: 'Trucking employee management',
    parentName: 'trucking',
    sortOrder: 1,
  },
  {
    name: 'trucking-employees-dashboard',
    displayName: 'Dashboard',
    path: '/trucking/employees/dashboard',
    category: 'trucking',
    icon: 'IconDashboard',
    parentName: 'trucking-employees',
    sortOrder: 1,
  },
  {
    name: 'trucking-employees-team',
    displayName: 'Team',
    path: '/trucking/employees/team',
    category: 'trucking',
    icon: 'IconUsers',
    parentName: 'trucking-employees',
    sortOrder: 2,
  },
  {
    name: 'trucking-employees-attendance',
    displayName: 'Attendance',
    path: '/trucking/employees/attendance',
    category: 'trucking',
    icon: 'IconClock',
    parentName: 'trucking-employees',
    sortOrder: 3,
  },
  {
    name: 'trucking-employees-schedules',
    displayName: 'Schedules',
    path: '/trucking/employees/schedules',
    category: 'trucking',
    icon: 'IconCalendar',
    parentName: 'trucking-employees',
    sortOrder: 4,
  },
  {
    name: 'trucking-employees-calendar',
    displayName: 'Calendar',
    path: '/trucking/employees/calendar',
    category: 'trucking',
    icon: 'IconCalendarEvent',
    parentName: 'trucking-employees',
    sortOrder: 5,
  },
  {
    name: 'trucking-employees-payroll',
    displayName: 'Payroll',
    path: '/trucking/employees/payroll',
    category: 'trucking',
    icon: 'IconCash',
    parentName: 'trucking-employees',
    sortOrder: 6,
  },
  {
    name: 'trucking-employees-leave-tracker',
    displayName: 'Leave Tracker',
    path: '/trucking/employees/leave-tracker',
    category: 'trucking',
    icon: 'IconCalendarOff',
    parentName: 'trucking-employees',
    sortOrder: 7,
  },
  {
    name: 'trucking-employees-cash-advance',
    displayName: 'Cash Advance',
    path: '/trucking/employees/cash-advance',
    category: 'trucking',
    icon: 'IconCreditCard',
    parentName: 'trucking-employees',
    sortOrder: 8,
  },
  {
    name: 'trucking-employees-employee-loans',
    displayName: 'Employee Loans',
    path: '/trucking/employees/employee-loans',
    category: 'trucking',
    icon: 'IconCoinPound',
    parentName: 'trucking-employees',
    sortOrder: 9,
  },
  {
    name: 'trucking-employees-thirteenth-month-pay',
    displayName: '13th Month Pay',
    path: '/trucking/employees/thirteenth-month-pay',
    category: 'trucking',
    icon: 'IconGift',
    parentName: 'trucking-employees',
    sortOrder: 10,
  },
  {
    name: 'trucking-employees-trips',
    displayName: 'Trips',
    path: '/trucking/employees/trips',
    category: 'trucking',
    icon: 'IconRoute',
    parentName: 'trucking-employees',
    sortOrder: 11,
  },
  {
    name: 'trucking-employees-expenses',
    displayName: 'Expenses',
    path: '/trucking/expenses',
    category: 'trucking',
    icon: 'IconReceipt',
    parentName: 'trucking',
    sortOrder: 3,
  },
  {
    name: 'trucking-employees-settings',
    displayName: 'Settings',
    path: '/trucking/employees/settings',
    category: 'trucking',
    icon: 'IconSettings',
    parentName: 'trucking-employees',
    sortOrder: 13,
  },
  {
    name: 'trucking-employees-notifications',
    displayName: 'Notifications',
    path: '/trucking/employees/notifications',
    category: 'trucking',
    icon: 'IconBell',
    parentName: 'trucking-employees',
    sortOrder: 14,
  },
];

const moduleInclude: Prisma.ModuleInclude = {
  children: {
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }],
    include: {
      children: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }],
      },
    },
  },
};

const fetchActiveModules = () => {
  return prisma.module.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
    include: moduleInclude,
  });
};

const syncModulesFromDefinitions = async () => {
  const moduleIdMap = new Map<string, string>();

  for (const moduleData of APP_MODULES) {
    const moduleRecord = await prisma.module.upsert({
      where: { path: moduleData.path },
      update: {
        displayName: moduleData.displayName,
        icon: moduleData.icon,
        description: moduleData.description,
        category: moduleData.category,
        sortOrder: moduleData.sortOrder,
        isActive: true,
      },
      create: {
        name: moduleData.name,
        displayName: moduleData.displayName,
        path: moduleData.path,
        category: moduleData.category,
        icon: moduleData.icon,
        description: moduleData.description,
        sortOrder: moduleData.sortOrder,
        isActive: true,
      },
    });

    moduleIdMap.set(moduleData.name, moduleRecord.id);
  }

  for (const moduleData of APP_MODULES) {
    if (moduleData.parentName) {
      const parentId = moduleIdMap.get(moduleData.parentName);
      if (parentId) {
        await prisma.module.update({
          where: { path: moduleData.path },
          data: { parentId },
        });
      }
    }
  }

  return fetchActiveModules();
};

// GET - Fetch all modules
export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let modules = await fetchActiveModules();

    if (modules.length === 0) {
      modules = await syncModulesFromDefinitions();
    }

    return NextResponse.json(modules);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch modules' },
      { status: 500 }
    );
  }
}

// POST - Seed/sync modules
export async function POST(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const modules = await syncModulesFromDefinitions();

    return NextResponse.json({
      message: 'Modules synced successfully',
      modules,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to sync modules' },
      { status: 500 }
    );
  }
}
