# Authentication & Authorization Setup Guide

## Overview

This application now has a complete **authentication and role-based access control (RBAC)** system implemented using **NextAuth.js v5**.

---

## 🔐 User Roles & Permissions

### Role Hierarchy

1. **SUPER_ADMIN** - Full system access
   - All operations pages
   - All employee management pages
   - Settings and configuration
   - User management

2. **ADMIN** - Limited administrative access
   - All operations pages
   - All employee management pages
   - **Cannot** access settings or user management

3. **USER** - Basic access
   - Operations pages only (customers, dispatch, transactions, sorting)
   - **Cannot** access employee management
   - **Cannot** access settings

---

## 📧 Default Admin Accounts

Two admin accounts are automatically created when you run the seed script:

### Super Admin

- **Email**: `czarlie12012010@gmail.com`
- **Password**: `Admin@2024!`
- **Role**: SUPER_ADMIN
- **Access**: Full access to all pages

### Admin

- **Email**: `czarinabalnig@gmail.com`
- **Password**: `Admin@2024!`
- **Role**: ADMIN
- **Access**: Operations + Employee pages (no settings)

⚠️ **IMPORTANT**: Change these default passwords after first login!

---

## 🚀 Setup Instructions

### Step 1: Install Dependencies

```bash
npm install next-auth@latest bcryptjs --legacy-peer-deps
npm install --save-dev @types/bcryptjs --legacy-peer-deps
```

### Step 2: Configure Environment Variables

Add these to your `.env` file:

```env
# NextAuth.js Configuration
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000
```

Generate a secure secret:

```bash
openssl rand -base64 32
```

### Step 3: Update Prisma Database

Generate Prisma client and push schema changes:

```bash
npm run db:generate
npm run db:push
```

### Step 4: Seed Admin Users

Run the seed script to create default admin accounts:

```bash
node prisma/seeds/auth-users.js
```

This will create both admin accounts with default passwords.

### Step 5: Restart Development Server

```bash
npm run dev
```

---

## 🔒 Route Protection

### Protected Routes Configuration

The application uses middleware to protect routes based on user roles. Here's the current configuration:

#### Public Routes

- `/login` - Login page (accessible to everyone)

#### Operations Routes (All Authenticated Users)

- `/clothing/operations/*` - USER, ADMIN, SUPER_ADMIN

#### Employee Routes (Admin Only)

- `/clothing/employees/*` - ADMIN, SUPER_ADMIN

#### Settings Routes (Super Admin Only)

- `/clothing/settings/*` - SUPER_ADMIN only
- `/clothing/users/*` - SUPER_ADMIN only

### Route Configuration File

Routes are configured in: `/src/middleware.ts`

```typescript
const routePermissions: Record<string, string[]> = {
  '/login': ['*'],
  '/clothing/operations': ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/clothing/employees': ['ADMIN', 'SUPER_ADMIN'],
  '/clothing/settings': ['SUPER_ADMIN'],
};
```

---

## 🛠️ Adding Route Restrictions

### To Restrict a New Page

Edit `/src/middleware.ts` and add your route to `routePermissions`:

```typescript
const routePermissions: Record<string, string[]> = {
  // ... existing routes
  '/clothing/new-feature': ['ADMIN', 'SUPER_ADMIN'], // Admin only
  '/clothing/reports': ['USER', 'ADMIN', 'SUPER_ADMIN'], // All users
  '/clothing/billing': ['SUPER_ADMIN'], // Super admin only
};
```

### Access Control in Components

Use the session helpers in your components:

```typescript
import { getCurrentUser, hasRole } from '@/lib/auth/session';

// In a server component
async function MyServerComponent() {
  const user = await getCurrentUser();
  const isSuperAdmin = await hasRole('SUPER_ADMIN');

  if (!isSuperAdmin) {
    return <div>Access Denied</div>;
  }

  return <div>Super Admin Content</div>;
}
```

### API Route Protection

Protect API routes:

```typescript
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Require authentication
    const user = await requireAuth();

    // Or require specific role
    await requireAdmin(); // ADMIN or SUPER_ADMIN
    // await requireSuperAdmin(); // SUPER_ADMIN only

    return NextResponse.json({ data: 'Protected data' });
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
```

---

## 👥 Managing Users

### Creating New Users (Future)

To create new users, you'll need to:

1. Create a user management page at `/clothing/users`
2. Hash passwords with bcryptjs before saving:

```typescript
import { hash } from 'bcryptjs';

const hashedPassword = await hash(password, 12);

await prisma.user.create({
  data: {
    email: 'user@example.com',
    name: 'John Doe',
    password: hashedPassword,
    role: 'USER', // or 'ADMIN', 'SUPER_ADMIN'
    isActive: true,
  },
});
```

### Changing User Roles

```typescript
await prisma.user.update({
  where: { email: 'user@example.com' },
  data: { role: 'ADMIN' },
});
```

### Deactivating Users

```typescript
await prisma.user.update({
  where: { email: 'user@example.com' },
  data: { isActive: false },
});
```

---

## 🔧 Authentication Utilities

### Available Functions

Located in `/src/lib/auth/session.ts`:

```typescript
// Get current session
const session = await getSession();

// Get current user
const user = await getCurrentUser();

// Require authentication (throws error if not logged in)
const user = await requireAuth();

// Require specific role (throws error if insufficient permissions)
await requireRole(['ADMIN', 'SUPER_ADMIN']);
await requireAdmin(); // ADMIN or SUPER_ADMIN
await requireSuperAdmin(); // SUPER_ADMIN only

// Check roles (returns boolean)
const hasAccess = await hasRole('ADMIN');
const isAdmin = await isAdmin(); // ADMIN or SUPER_ADMIN
const isSuperAdmin = await isSuperAdmin(); // SUPER_ADMIN only
```

---

## 📊 Database Schema

### User Model

```prisma
enum UserRole {
  USER
  ADMIN
  SUPER_ADMIN
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique @db.VarChar(255)
  name          String?   @db.VarChar(255)
  password      String    @db.VarChar(255)
  role          UserRole  @default(USER)
  isActive      Boolean   @default(true)
  lastLoginAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  @@index([email])
  @@index([role])
  @@index([isActive])
  @@map("users")
}
```

---

## 🔄 Session Management

- **Strategy**: JWT (JSON Web Tokens)
- **Session Duration**: 30 days
- **Automatic Refresh**: Yes (handled by NextAuth.js)
- **Last Login Tracking**: Automatically updated on each login

---

## 🎯 Quick Reference

### Login

- URL: `/login`
- Credentials: See "Default Admin Accounts" above

### Logout

```typescript
import { signOut } from 'next-auth/react';

await signOut({ callbackUrl: '/login' });
```

### Check Current User in Client Component

```typescript
'use client';
import { useSession } from 'next-auth/react';

export function MyComponent() {
  const { data: session } = useSession();

  if (!session) {
    return <div>Not logged in</div>;
  }

  return (
    <div>
      <p>Email: {session.user.email}</p>
      <p>Role: {session.user.role}</p>
    </div>
  );
}
```

---

## 🐛 Troubleshooting

### Error: "NEXTAUTH_SECRET must be provided"

- Make sure `.env` contains `NEXTAUTH_SECRET`
- Generate one with: `openssl rand -base64 32`

### Error: "Property 'user' does not exist on type 'PrismaClient'"

- Run: `npm run db:generate`
- This regenerates Prisma client with the User model

### Redirected to login after successful authentication

- Clear browser cookies
- Check `NEXTAUTH_URL` matches your development URL
- Restart the dev server

### Role restrictions not working

- Check middleware configuration in `/src/middleware.ts`
- Verify route paths match exactly (case-sensitive)
- Check user role in database

---

## 📚 Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [bcryptjs Documentation](https://www.npmjs.com/package/bcryptjs)

---

## ✅ Security Checklist

- [x] Passwords are hashed with bcryptjs (12 rounds)
- [x] JWT sessions with secure secret
- [x] Route protection via middleware
- [x] Role-based access control
- [ ] Change default admin passwords
- [ ] Add password reset functionality
- [ ] Implement 2FA (optional)
- [ ] Add session timeout warnings
- [ ] Implement audit logging for login attempts

---

Last Updated: November 6, 2025
