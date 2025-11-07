# Module Permission System - Implementation Guide

## Problem

Users with limited module permissions (e.g., only access to `/clothing/operations/sorting-distribution`) could still access other pages like `/clothing/operations/transactions` after login because:

1. The middleware only checked **role-based permissions** (USER, ADMIN, SUPER_ADMIN)
2. There was no **module-level permission checking** on individual pages
3. Login always redirected to `/clothing/operations/transactions` regardless of user permissions

## Solution

Implemented a **granular module-based permission system** with three layers of security:

### 1. Permission Utilities (`src/lib/auth/permissions.ts`)

Created helper functions for checking and enforcing module permissions:

- **`hasModuleAccess(modulePath)`** - Check if user has permission to access a specific module
- **`requireModuleAccess(modulePath)`** - Enforce access control (redirects unauthorized users)
- **`getFirstAccessibleModule()`** - Get the first module a user has permission to access
- **`getAccessibleModules()`** - Get all modules a user can access

### 2. Page-Level Protection

Pages now check permissions before rendering:

```typescript
// src/app/clothing/operations/transactions/page.tsx
import { requireModuleAccess } from '@/lib/auth/permissions';

export default async function TransactionsRoute() {
  // Check if user has permission to access this module
  await requireModuleAccess('/clothing/operations/transactions');

  return <TransactionsPage />;
}
```

### 3. Smart Login Redirect

Users are now redirected to their **first accessible module** after login:

- **Login page** → redirects to `/api/auth/redirect`
- **Redirect handler** → determines user's first accessible module
- **User lands on** → the page they have permission to access

## Security Layers

### Layer 1: Middleware (Role-Based)

- Checks if user is authenticated
- Validates user role (USER, ADMIN, SUPER_ADMIN)
- Blocks access to entire sections based on role

### Layer 2: Module Permissions (Granular)

- Checks specific module access from database
- Uses `UserPermission` table to determine access
- Admins and Super Admins bypass this check

### Layer 3: Page Protection

- Each protected page calls `requireModuleAccess()`
- Redirects unauthorized users to their accessible page
- Shows "Unauthorized" page if no accessible modules found

## How It Works

### For Regular Users

1. User logs in
2. System checks their `UserPermission` records in database
3. User is redirected to their first accessible module
4. If they try to manually navigate to unauthorized page:
   - Permission check fails
   - User is redirected to their first accessible module

### For Admins

- ADMIN and SUPER_ADMIN roles have access to all modules
- Permission checks are bypassed for admins
- They can access any page without restriction

## Database Structure

```prisma
model User {
  id          String           @id
  email       String
  role        UserRole         // USER, ADMIN, SUPER_ADMIN
  permissions UserPermission[]
}

model Module {
  id          String           @id
  path        String           @unique
  displayName String
  permissions UserPermission[]
}

model UserPermission {
  id        String  @id
  userId    String
  moduleId  String
  canAccess Boolean
  user      User    @relation(fields: [userId], references: [id])
  module    Module  @relation(fields: [moduleId], references: [id])

  @@unique([userId, moduleId])
}
```

## Example: Arnel's Case

**Before:**

- Arnel has permission for `/clothing/operations/sorting-distribution` only
- Login redirects to `/clothing/operations/transactions`
- He can access and edit transactions page (unauthorized!)

**After:**

- Arnel logs in
- System checks his permissions
- He's redirected to `/clothing/operations/sorting-distribution` (his only permitted module)
- If he tries to go to `/clothing/operations/transactions`:
  - `requireModuleAccess()` checks his permissions
  - Permission check fails
  - He's redirected back to sorting-distribution page

## Adding Protection to New Pages

To protect a new page:

```typescript
// 1. Import the utility
import { requireModuleAccess } from '@/lib/auth/permissions';

// 2. Make the component async
export default async function YourPage() {
  // 3. Add permission check
  await requireModuleAccess('/your/module/path');

  // 4. Render your component
  return <YourPageComponent />;
}
```

## Testing

To verify the system works:

1. Create a test user with limited permissions
2. Grant them access to only one module (e.g., sorting-distribution)
3. Log in as that user
4. Verify they land on their permitted page
5. Try to manually navigate to another page
6. Verify they are redirected back to their permitted page

## Files Modified

- ✅ `src/lib/auth/permissions.ts` - Permission utilities
- ✅ `src/app/clothing/operations/transactions/page.tsx` - Added permission check
- ✅ `src/app/login/page.tsx` - Updated redirect URL
- ✅ `src/app/api/auth/redirect/route.ts` - Smart redirect handler
- ✅ `src/app/unauthorized/page.tsx` - Unauthorized access page

## Next Steps

### Recommended Actions

1. **Add permission checks to all sensitive pages:**
   - Products page
   - Customers page
   - Inventory page
   - All other operations pages

2. **Update navigation:**
   - Hide menu items user doesn't have access to
   - Use `getAccessibleModules()` to filter navigation

3. **Add API protection:**
   - Protect API routes with `hasModuleAccess()`
   - Prevent unauthorized data access via API

### Example: Protect All Pages

```typescript
// Apply this pattern to each page
await requireModuleAccess('/clothing/operations/customers');
await requireModuleAccess('/clothing/operations/products');
await requireModuleAccess('/clothing/operations/inventory');
// etc...
```

## Benefits

✅ **Security** - Users can only access pages they have permission for  
✅ **Flexibility** - Fine-grained control over module access  
✅ **User Experience** - Users land on relevant pages after login  
✅ **Maintainability** - Simple API for adding protection to pages  
✅ **Database-Driven** - Permissions managed in UI, no code changes needed

## Related Documentation

- `/docs/MODULE_PERMISSIONS.md` - Complete module permission system docs
- `/docs/AUTHENTICATION_SETUP_GUIDE.md` - Authentication and RBAC guide
- `/src/middleware.ts` - Role-based middleware configuration
