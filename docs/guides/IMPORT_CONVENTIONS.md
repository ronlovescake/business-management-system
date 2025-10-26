# Import Conventions Guide

## Overview

This project uses a **hybrid import strategy** that balances **code cleanliness** with **development performance**.

---

## 🎯 Import Rules

### Rule 1: Route Pages (`page.tsx`)

**Use DIRECT imports to components:**

```typescript
// ✅ CORRECT - Direct path to component
import { TransactionsPage } from '@/modules/clothing/operations/transactions/components/TransactionsPage';
import { CustomersPage } from '@/modules/clothing/operations/customers/components/CustomersPage';
import { ProductsPage } from '@/modules/clothing/operations/products/components/ProductsPage';
```

```typescript
// ❌ INCORRECT - Don't use barrel in page.tsx
import { TransactionsPage } from '@/modules/clothing/operations/transactions';
```

**Why?**

- 50-60% faster compilation during development
- Reduces module resolution overhead
- Next.js fast refresh benefits from fewer modules loaded

---

### Rule 2: All Other Files (Components, Services, Hooks)

**Use BARREL imports from module root:**

```typescript
// ✅ CORRECT - Clean barrel imports
import {
  TransactionService,
  useTransactions,
  TransactionData,
} from '@/modules/clothing/operations/transactions';

import {
  CustomerService,
  useCustomersData,
} from '@/modules/clothing/operations/customers';
```

```typescript
// ❌ INCORRECT - Don't use direct paths in non-page files
import { TransactionService } from '@/modules/clothing/operations/transactions/services/TransactionService';
import { useTransactions } from '@/modules/clothing/operations/transactions/hooks/useTransactions';
```

**Why?**

- Cleaner, shorter imports (3-5 lines vs 7-10 lines)
- Easier refactoring (internal structure can change)
- Better code organization

---

## 📂 File-Specific Rules

### `page.tsx` Files

```typescript
// Direct component import only
import { PageComponent } from '@/modules/.../components/PageComponent';
```

### `*.tsx` Components

```typescript
// Barrel imports
import { Service, Hook, Type } from '@/modules/.../';
```

### `*.ts` Services/Utilities

```typescript
// Barrel imports
import { Helper, Type } from '@/modules/.../';
```

### Test Files

```typescript
// Can use either (prefer barrel for cleanliness)
import { Service } from '@/modules/.../';
// OR
import { Service } from '@/modules/.../services/Service';
```

---

## 🔍 Examples by File Type

### Route Page Example

```typescript
// src/app/clothing/operations/transactions/page.tsx
'use client';

// ✅ Direct import for page component
import { TransactionsPage } from '@/modules/clothing/operations/transactions/components/TransactionsPage';

export default function Page() {
  return <TransactionsPage />;
}
```

### Component Example

```typescript
// src/components/features/MyComponent.tsx
'use client';

// ✅ Barrel imports for everything else
import {
  TransactionService,
  useTransactions,
  TransactionData,
  TransactionStatus,
} from '@/modules/clothing/operations/transactions';

export function MyComponent() {
  const { data } = useTransactions();
  // ...
}
```

### Service Example

```typescript
// src/services/MyService.ts

// ✅ Barrel imports
import { CustomerService } from '@/modules/clothing/operations/customers';
import { TransactionService } from '@/modules/clothing/operations/transactions';

export class MyService {
  static async processTransaction() {
    const customer = await CustomerService.getById('123');
    const transaction = await TransactionService.create({...});
    // ...
  }
}
```

---

## 🎨 Shared Components

Shared components have their own barrel:

```typescript
// ✅ Use barrel exports
import { PageLayout, TableSkeleton, DataTable } from '@/components/shared';

// ❌ Don't use direct paths
import { PageLayout } from '@/components/shared/PageTemplates/PageLayout';
```

---

## 🚫 Anti-Patterns to Avoid

### ❌ Mixed Imports

```typescript
// BAD - Mixing direct and barrel
import { TransactionService } from '@/modules/clothing/operations/transactions/services/TransactionService';
import { CustomerService } from '@/modules/clothing/operations/customers'; // Inconsistent!
```

### ❌ Barrel in page.tsx

```typescript
// BAD - Slow in development
// page.tsx
import { TransactionsPage } from '@/modules/clothing/operations/transactions';
```

### ❌ Direct in Components

```typescript
// BAD - Verbose and brittle
// MyComponent.tsx
import { TransactionService } from '@/modules/clothing/operations/transactions/services/TransactionService';
import { useTransactions } from '@/modules/clothing/operations/transactions/hooks/useTransactions';
```

---

## 📊 Performance Impact

### Development (Next.js Fast Refresh)

| Approach                     | Time | Notes                    |
| ---------------------------- | ---- | ------------------------ |
| Direct imports in pages      | 1-3s | ✅ Recommended for pages |
| Barrel imports in pages      | 3-5s | ⚠️ 50-60% slower         |
| Direct imports in components | Same | ❌ Unnecessarily verbose |
| Barrel imports in components | Same | ✅ Clean and fast        |

### Production Build

| Approach       | Bundle Size | Notes              |
| -------------- | ----------- | ------------------ |
| Direct imports | Same        | Tree-shaking works |
| Barrel imports | Same        | Tree-shaking works |

**Conclusion:** Both approaches produce identical production bundles thanks to modern tree-shaking.

---

## 🔧 Enforcement

### ESLint Rule (Coming Soon)

```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": ["@/modules/*/services/*", "@/modules/*/hooks/*"],
            "message": "Import from module barrel: @/modules/moduleName"
          }
        ]
      }
    ]
  },
  "overrides": [
    {
      "files": ["**/app/**/page.tsx"],
      "rules": {
        "no-restricted-imports": "off"
      }
    }
  ]
}
```

### Pre-commit Hook (Coming Soon)

```bash
# Check for violations
node scripts/check-imports.js
```

---

## 🎓 Quick Reference

**I'm editing a `page.tsx` file:**
→ Use **direct import** to the component

**I'm editing any other file:**
→ Use **barrel import** from module root

**I'm confused:**
→ Check existing similar files in the codebase

---

## 📚 Related Documentation

- [Barrel Exports Guide](./barrel-exports-guide.md) - Implementation details
- [Performance Optimization](../../PERFORMANCE_OPTIMIZATION.md) - Why direct imports in pages
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Overall coding standards

---

## 🔄 Migration Guide

If you find inconsistent imports:

```bash
# Check all page files
grep -r "from '@/modules" src/app/**/page.tsx

# Check all component files
grep -r "from '@/modules.*components/" src/components/
```

**Fix pattern:**

1. Route pages → Change to direct component imports
2. Other files → Change to barrel imports
3. Test the change → `npm run dev`
4. Verify build → `npm run build`

---

## ✅ Checklist for New Features

When creating a new module:

- [ ] Create barrel exports (`index.ts`) in all subdirectories
- [ ] Export from module root (`module/index.ts`)
- [ ] Use direct import in route `page.tsx`
- [ ] Use barrel imports everywhere else
- [ ] Update this guide if adding new patterns

---

**Last Updated:** October 26, 2025  
**Status:** ✅ Active Convention
