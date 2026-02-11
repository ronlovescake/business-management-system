# User Profile & Management System

> Deprecated: Authentication is currently deferred and not active. This document is retained for future planning only.

## Overview

Planned user profile and management system. This is not active while authentication is deferred.

## Features Implemented

### 1. User Profile Page (`/profile`)

**Access:** All authenticated users

**Features:**

- View and edit personal information (name, email)
- Change password securely
- View account information (role, status, last login, member since)
- Real-time session updates
- Password validation (minimum 6 characters)

**API Endpoints:**

- `GET /api/users/profile` - Get current user's profile
- `PATCH /api/users/profile` - Update profile and password

### 2. User Management Interface (`/clothing/users`)

**Access:** SUPER_ADMIN only

**Features:**

- View all users in a table with key information
- Create new users with email, name, password, and role
- Edit existing users (name, role, active status, password)
- Delete users (soft delete with confirmation modal)
- Protection against self-demotion and self-deletion
- Real-time user list updates

**API Endpoints:**

- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `GET /api/users/[id]` - Get user by ID
- `PATCH /api/users/[id]` - Update user
- `DELETE /api/users/[id]` - Soft delete user

### 3. Navigation Integration

**Profile Menu Added to Header:**

- Click on avatar/dropdown to access:
  - **My Profile** - Navigate to profile page
  - **User Management** - (SUPER_ADMIN only)
  - **Logout** - Sign out and redirect to login

## User Roles

### USER

- Access to operations pages
- Can view and edit own profile
- Cannot access employee or settings pages

### ADMIN

- All USER permissions
- Access to employee management pages
- Can view and edit own profile
- Cannot access user management

### SUPER_ADMIN

- All ADMIN permissions
- Access to user management interface
- Access to settings pages
- Can create, edit, and delete users
- Cannot demote or delete own account

## Security Features

1. **Password Security:**
   - Minimum 6 characters required
   - Passwords hashed with bcryptjs (12 rounds)
   - Current password verification required to change password

2. **Role-Based Access Control:**
   - Middleware protection on all routes
   - API endpoints verify user roles
   - Super admin cannot harm own account

3. **Data Protection:**
   - Passwords never returned in API responses
   - Soft deletes (data retained with deletedAt timestamp)
   - Session-based authentication

## Installed Dependencies

```bash
npm install @mantine/modals --legacy-peer-deps
```

- **@mantine/modals** - Modal dialogs for confirmations

## Usage

### For All Users:

1. Click on your avatar in the top right
2. Select "My Profile"
3. Update your name or password
4. Click "Save Changes"

### For SUPER_ADMIN:

1. Click on your avatar in the top right
2. Select "User Management"
3. Click "Add User" to create new users
4. Click the three-dot menu on any user to edit or delete
5. Users can be activated/deactivated without deletion

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── users/
│   │       ├── route.ts              # List & create users
│   │       ├── profile/
│   │       │   └── route.ts          # Profile endpoints
│   │       └── [id]/
│   │           └── route.ts          # Update & delete user
│   ├── profile/
│   │   └── page.tsx                  # Profile page
│   └── clothing/
│       └── users/
│           └── page.tsx              # User management page
├── components/
│   └── navigation/
│       └── HeaderQuickActions.tsx    # Updated with profile menu
├── middleware.ts                      # Updated route protection
└── lib/
    └── auth/
        └── session.ts                 # Auth helper functions

```

## Next Steps

### Recommended Enhancements:

1. **Email Verification** - Verify email addresses on account creation
2. **Password Reset** - Add "Forgot Password" functionality
3. **2FA** - Two-factor authentication for enhanced security
4. **Audit Logging** - Track user actions and changes
5. **Profile Pictures** - Allow users to upload avatars
6. **User Preferences** - Theme, language, notification settings
7. **Activity Log** - Show user's recent activity
8. **Bulk Actions** - Import/export users, bulk role changes

### Testing Checklist:

- [ ] Login with SUPER_ADMIN account
- [ ] Access user management page
- [ ] Create a new USER account
- [ ] Create a new ADMIN account
- [ ] Edit user roles and status
- [ ] Try to delete your own account (should fail)
- [ ] Try to change your own role (should fail)
- [ ] Login with regular USER account
- [ ] Access profile page
- [ ] Update name and password
- [ ] Verify user management is not accessible
- [ ] Test logout functionality

## Default Admin Credentials

```
Super Admin:
Email: czarlie12012010@gmail.com
Password: Admin@2024!

Admin:
Email: czarinabalnig@gmail.com
Password: Admin@2024!
```

**⚠️ Important:** Change these default passwords immediately after first login!

## API Response Examples

### Get Profile

```json
{
  "id": "clxxxx",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "USER",
  "isActive": true,
  "lastLoginAt": "2025-11-06T10:30:00Z",
  "createdAt": "2025-11-01T08:00:00Z",
  "updatedAt": "2025-11-06T10:30:00Z"
}
```

### Update Profile

```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": "clxxxx",
    "email": "user@example.com",
    "name": "John Smith",
    "role": "USER",
    ...
  }
}
```

### Create User

```json
{
  "message": "User created successfully",
  "user": {
    "id": "clxxxx",
    "email": "newuser@example.com",
    "name": "New User",
    "role": "USER",
    "isActive": true,
    "createdAt": "2025-11-06T12:00:00Z"
  }
}
```

## Error Handling

All API endpoints return appropriate error messages:

- **400** - Invalid data or validation errors
- **401** - Unauthorized (not logged in)
- **403** - Forbidden (insufficient permissions)
- **404** - User not found
- **409** - User already exists (duplicate email)
- **500** - Server error

## Notes

- All API routes use the logger utility instead of console.log
- TypeScript strict mode enabled with proper type definitions
- ESLint rules enforced for code quality
- Soft deletes preserve data integrity
- Session updates automatically after profile changes
