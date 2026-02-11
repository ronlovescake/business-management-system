# 🚀 Quick Start - Authentication System

> Deprecated: Authentication is currently deferred and not active. This document is retained for future planning only.

## 📋 Planned Scope

Planned features when authentication is enabled:

- NextAuth.js v4
- Role-based access control (RBAC)
- Three user roles: USER, ADMIN, SUPER_ADMIN
- Route protection middleware
- Database User model
- Admin user seed script
- Updated login page with real authentication

---

## ⚡ Quick Setup (5 minutes)

### 1. Install Packages

```bash
npm install next-auth@^4.24.0 bcryptjs --force
npm install --save-dev @types/bcryptjs --legacy-peer-deps
```

### 2. Add Environment Variables

Add to your `.env` file:

```env
NEXTAUTH_SECRET=your-secret-generated-here
NEXTAUTH_URL=http://localhost:5001
```

Generate secret:

```bash
openssl rand -base64 32
```

### 3. Update Database

```bash
npm run db:generate
npm run db:push
```

### 4. Seed Admin Users

```bash
node prisma/seeds/auth-users.js
```

### 5. Restart Server

```bash
npm run dev
```

---

## 🔑 Default Login Credentials

**Super Admin (Example Only)**

- Email: `superadmin@example.com`
- Password: `change-me-now`
- Can access: Everything

**Admin (Example Only)**

- Email: `admin@example.com`
- Password: `change-me-now`
- Can access: All operations + employee pages

⚠️ Do not store real credentials in documentation.

---

## 🛡️ Access Control Summary

### SUPER_ADMIN (czarlie12012010@gmail.com)

✅ Operations pages (customers, dispatch, transactions)  
✅ Employee management pages  
✅ Settings & configuration  
✅ User management

### ADMIN (czarinabalnig@gmail.com)

✅ Operations pages  
✅ Employee management pages  
❌ Settings (restricted)  
❌ User management (restricted)

### USER (future users)

✅ Operations pages only  
❌ Employee pages (restricted)  
❌ Settings (restricted)

---

## 📁 Key Files Created

### Authentication Core

- `/src/lib/auth/auth.config.ts` - NextAuth configuration
- `/src/lib/auth/auth.ts` - NextAuth setup with credentials provider
- `/src/lib/auth/session.ts` - Helper functions for auth checks
- `/src/app/api/auth/[...nextauth]/route.ts` - NextAuth API route

### Route Protection

- `/src/middleware.ts` - Route protection middleware

### Database

- `/prisma/schema.prisma` - Added User model & UserRole enum
- `/prisma/seeds/auth-users.js` - Admin user seed script

### UI

- `/src/app/login/page.tsx` - Updated with real authentication

### Documentation

- `/docs/AUTHENTICATION_SETUP_GUIDE.md` - Full setup guide
- `/docs/AUTH_QUICK_START.md` - This file

### Types

- `/src/types/next-auth.d.ts` - NextAuth type definitions

---

## 🔧 Common Tasks

### Restrict a New Page

Edit `/src/middleware.ts`:

```typescript
const routePermissions: Record<string, string[]> = {
  // Add your route
  '/clothing/new-page': ['ADMIN', 'SUPER_ADMIN'],
};
```

### Check User Role in Component

```typescript
import { getCurrentUser } from '@/lib/auth/session';

async function MyPage() {
  const user = await getCurrentUser();

  if (user?.role === 'SUPER_ADMIN') {
    return <SuperAdminView />;
  }

  return <RegularView />;
}
```

### Protect an API Route

```typescript
import { requireAdmin } from '@/lib/auth/session';

export async function POST(request: Request) {
  await requireAdmin(); // Throws error if not admin

  // Your API logic here
}
```

---

## 🐛 Quick Troubleshooting

**Can't login?**

- Did you add NEXTAUTH_SECRET to .env?
- Did you run `npm run db:generate`?
- Did you run the seed script?

**Getting redirected to login?**

- Clear browser cookies
- Check NEXTAUTH_URL in .env

**Role restrictions not working?**

- Restart dev server
- Check middleware.ts configuration

---

## 📖 Full Documentation

For complete documentation, see:
`/docs/AUTHENTICATION_SETUP_GUIDE.md`

---

Last Updated: November 6, 2025
