import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getAccessibleModules } from '@/lib/auth/permissions';
import WorkspaceModal from './WorkspaceModal';
import type { WorkspaceDefinition, WorkspaceOption } from './workspaces.types';

const workspaceCatalog: WorkspaceDefinition[] = [
  {
    id: 'clothing-operations',
    title: 'Clothing Operations',
    subtitle: 'Transactions • Inventory • Dispatch',
    badge: 'Operations',
    highlights: ['Transactions', 'Inventory', 'Dispatch'],
    href: '/clothing/operations/transactions',
    requiredPaths: [
      '/clothing/operations/transactions',
      '/clothing/operations/dashboard',
    ],
    icon: 'settings',
  },
  {
    id: 'clothing-employees',
    title: 'Clothing Employees',
    subtitle: 'Payroll • Leave • Workforce',
    badge: 'HR & Payroll',
    highlights: ['Payroll', 'Leave Tracker', 'Schedules'],
    href: '/clothing/employees/dashboard',
    requiredPaths: ['/clothing/employees/dashboard'],
    icon: 'users',
  },
  {
    id: 'trucking-employees',
    title: 'Trucking Operations',
    subtitle: 'Fleet • Drivers • Trips',
    badge: 'Trucking',
    highlights: ['Trips', 'Drivers', 'Fleet'],
    href: '/trucking/employees/dashboard',
    requiredPaths: ['/trucking/employees/dashboard'],
    icon: 'truck',
  },
  {
    id: 'gm-operations',
    title: 'General Merchandise Operations',
    subtitle: 'Transactions • Inventory • Dispatch',
    badge: 'Operations',
    highlights: ['Transactions', 'Inventory', 'Dispatch'],
    href: '/general-merchandise/operations/transactions',
    requiredPaths: ['/general-merchandise/operations/transactions'],
    icon: 'settings',
  },
  {
    id: 'gm-employees',
    title: 'General Merchandise Employees',
    subtitle: 'Payroll • Leave • Workforce',
    badge: 'HR & Payroll',
    highlights: ['Payroll', 'Leave Tracker', 'Schedules'],
    href: '/general-merchandise/employees/dashboard',
    requiredPaths: ['/general-merchandise/employees/dashboard'],
    icon: 'users',
  },
  {
    id: 'gm-accounting',
    title: 'General Merchandise Accounting',
    subtitle: 'Expenses • Ledger • Reports',
    badge: 'Accounting',
    highlights: ['Expenses', 'Ledger', 'Reports'],
    href: '/general-merchandise/accounting/expenses',
    requiredPaths: ['/general-merchandise/accounting/expenses'],
    icon: 'receipt',
  },
];

function resolveWorkspaces(accessiblePaths: string[], role: string) {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
    return workspaceCatalog;
  }

  return workspaceCatalog.filter((workspace) =>
    workspace.requiredPaths.some((path: string) =>
      accessiblePaths.includes(path)
    )
  );
}

export default async function WorkspacesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const accessiblePaths = await getAccessibleModules();
  const availableWorkspaces = resolveWorkspaces(
    accessiblePaths,
    user.role || 'USER'
  );

  const serializedWorkspaces: WorkspaceOption[] = availableWorkspaces.map(
    ({ requiredPaths: _requiredPaths, ...workspace }) => workspace
  );

  return (
    <>
      <WorkspaceModal
        userName={user.name ?? user.email ?? 'friend'}
        workspaces={serializedWorkspaces}
      />
      <noscript>
        <p className="workspace-noscript">
          Workspace selection requires JavaScript. Please enable it in your
          browser to choose a workspace.
        </p>
      </noscript>
    </>
  );
}
