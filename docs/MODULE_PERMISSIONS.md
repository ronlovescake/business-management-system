# Module Permission System

## Overview

This system allows administrators to manage fine-grained access control for users by assigning specific module permissions. Users can be granted access to individual modules (pages) within the application.

## Features

- **Hierarchical Module Structure**: Modules are organized in a parent-child relationship (e.g., Clothing → Operations → Transactions)
- **Cascading Dropdown UI**: Click on a user's name in the table to expand and see all available modules
- **Checkbox-based Selection**: Easy selection/deselection of modules with checkboxes
- **Grouped by Category**: Modules are organized by business categories (Clothing, Trucking)
- **Real-time Saving**: Save permissions with a single click
- **Visual Feedback**: Loading states and notifications for all actions

## Database Schema

### Tables

1. **modules**: Stores all available modules in the application
   - `id`: Unique identifier
   - `name`: Internal name (e.g., 'clothing-operations-transactions')
   - `displayName`: User-friendly name (e.g., 'Transactions')
   - `path`: Route path (e.g., '/clothing/operations/transactions')
   - `category`: Business category ('clothing', 'trucking')
   - `icon`: Icon identifier for UI
   - `description`: Module description
   - `parentId`: Reference to parent module (null for top-level)
   - `sortOrder`: Display order
   - `isActive`: Enable/disable module

2. **user_permissions**: Junction table for user-module access
   - `id`: Unique identifier
   - `userId`: Reference to user
   - `moduleId`: Reference to module
   - `canAccess`: Access flag (currently always true when record exists)
   - Unique constraint on `(userId, moduleId)`

3. **users** (extended): Added relation to permissions
   - New field: `permissions` (relation to UserPermission[])

## API Endpoints

### Get All Modules

```
GET /api/modules
```

Returns all active modules with their children.

**Response:**

```json
[
  {
    "id": "...",
    "name": "clothing",
    "displayName": "Clothing Business",
    "path": "/clothing",
    "category": "clothing",
    "icon": "IconShirt",
    "children": [
      {
        "id": "...",
        "name": "clothing-operations",
        "displayName": "Operations",
        ...
      }
    ]
  }
]
```

### Sync Modules (SUPER_ADMIN only)

```
POST /api/modules
```

Seeds/updates all modules from the predefined list. Run this after adding new modules to the codebase.

### Get User Permissions

```
GET /api/users/{userId}/permissions
```

Returns all module permissions for a specific user.

**Response:**

```json
[
  {
    "id": "...",
    "userId": "...",
    "moduleId": "...",
    "canAccess": true,
    "module": {
      "id": "...",
      "name": "clothing-operations-transactions",
      "displayName": "Transactions",
      ...
    }
  }
]
```

### Update User Permissions

```
POST /api/users/{userId}/permissions
```

Replaces all permissions for a user with the provided module IDs.

**Request Body:**

```json
{
  "moduleIds": ["module-id-1", "module-id-2", "module-id-3"]
}
```

## Usage

### For Administrators

1. **Navigate to User Management**: Go to `/clothing/users`

2. **View User Permissions**:
   - Click on any user's name or the chevron icon next to it
   - The row will expand showing all available modules

3. **Assign Permissions**:
   - Check the boxes for modules you want to grant access to
   - Parent modules and child modules are independent (checking a parent doesn't auto-check children)
   - Click "Save Permissions" button when done

4. **Hierarchical Structure**:
   - Top-level categories (e.g., "Clothing Business", "Trucking Business")
   - Second-level sections (e.g., "Operations", "Employees")
   - Third-level pages (e.g., "Transactions", "Customers", "Payroll")

### For Developers

#### Adding New Modules

1. **Update Module List**: Edit both files:
   - `/src/app/api/modules/route.ts` - APP_MODULES array
   - `/scripts/seed-modules.ts` - APP_MODULES array

2. **Module Structure**:

```typescript
{
  name: 'unique-module-name',           // Internal identifier
  displayName: 'User-Friendly Name',   // What users see
  path: '/route/path',                 // Application route
  category: 'clothing',                // Business category
  icon: 'IconName',                    // Tabler icon name (optional)
  description: 'Description',          // Optional description
  parentName: 'parent-module-name',    // Optional parent (for hierarchy)
  sortOrder: 1,                        // Display order within parent
}
```

3. **Run Seed Script**:

```bash
npx tsx scripts/seed-modules.ts
```

#### Implementing Permission Checks (Future)

To actually enforce these permissions in your routes, you can create a middleware or hook:

```typescript
// Example: lib/permissions.ts
import { getCurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export async function hasModuleAccess(modulePath: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  // Super admins have access to everything
  if (user.role === 'SUPER_ADMIN') return true;

  // Check if user has permission for this module
  const moduleRecord = await prisma.module.findUnique({
    where: { path: modulePath },
  });

  if (!moduleRecord) return false;

  const permission = await prisma.userPermission.findUnique({
    where: {
      userId_moduleId: {
        userId: user.id,
        moduleId: moduleRecord.id,
      },
    },
  });

  return permission?.canAccess ?? false;
}
```

Then use in your pages:

```typescript
// app/clothing/operations/transactions/page.tsx
export default async function TransactionsPage() {
  const hasAccess = await hasModuleAccess('/clothing/operations/transactions');

  if (!hasAccess) {
    redirect('/unauthorized');
  }

  // ... rest of your page
}
```

## Available Modules

### Clothing Business

- **User Management** - Manage user accounts and permissions
- **Operations**
  - Dashboard
  - Transactions
  - Customers
  - Products
  - Inventory
  - Shipments
  - Prices
  - Due Dates
  - Sorting & Distribution
  - Checkout Links
  - Dispatching
  - Business Intelligence
  - Messaging
  - Post Template
  - Settings
  - Notifications
- **Employees**
  - Dashboard
  - Team
  - Attendance
  - Schedules
  - Calendar
  - Payroll
  - Leave Tracker
  - Cash Advance
  - Employee Loans
  - 13th Month Pay
  - Expenses
  - Settings
  - Notifications

### Trucking Business

- **Employees**
  - Dashboard
  - Team
  - Attendance
  - Schedules
  - Calendar
  - Payroll
  - Leave Tracker
  - Cash Advance
  - Employee Loans
  - 13th Month Pay
  - Trips
  - Expenses
  - Settings
  - Notifications

## Security Notes

- Only SUPER_ADMIN and ADMIN users can view and modify permissions
- Only SUPER_ADMIN users can sync/seed modules
- Permission checks are currently UI-only; implement server-side checks for production
- Consider implementing role-based default permissions (e.g., all ADMINs get certain modules by default)

## Future Enhancements

1. **Permission Enforcement**: Add middleware to actually block access based on permissions
2. **Bulk Operations**: Select/deselect all modules at once
3. **Permission Templates**: Create reusable permission sets (e.g., "Sales Team", "HR Team")
4. **Copy Permissions**: Copy one user's permissions to another
5. **Permission History**: Track changes to user permissions over time
6. **Module Groups**: Group related modules for easier management
7. **Search/Filter**: Search modules when assigning permissions
8. **Default Permissions by Role**: Auto-assign modules based on user role
