# 🎯 Module Improvement Framework

## Overview

This framework provides **automated tools and patterns** to upgrade all modules in your business management system to **10/10 quality standards**.

---

## 🏗️ Architecture

### Core Infrastructure (`/src/core/`)

#### 1. **API Layer** (`/core/api/`)

- **`response.ts`** - Standardized API responses with pagination
- **`middleware.ts`** - Error handling, validation, rate limiting
- **`factory.ts`** - CRUD route generators (existing)

#### 2. **Database Layer** (`/core/database/`)

- **`base-repository.ts`** - Generic CRUD with soft delete & audit logging
- Automatic pagination
- Soft delete by default
- Audit logging

#### 3. **Testing** (`/core/testing/`)

- **`test-helpers.ts`** - Mock factories, test utilities
- Unit test templates
- Integration test templates
- E2E test patterns

---

## 🚀 Quick Start

### 1. Generate New Module (Perfect 10/10 Structure)

```bash
# Generate employee module
npm run generate:module -- --name=bonuses --workspace=employees

# Generate operations module
npm run generate:module -- --name=suppliers --workspace=operations
```

**What it creates:**

```
src/modules/clothing/employees/bonuses/
├── api/
│   ├── route.ts          # API routes with validation
│   └── schemas.ts        # Zod validation schemas
├── services/
│   ├── index.ts          # Business logic
│   └── repository.ts     # Data access (uses BaseRepository)
├── types/
│   └── index.ts          # TypeScript interfaces
├── components/           # React components
├── hooks/                # Custom React hooks
├── utils/                # Module-specific utilities
├── __tests__/
│   ├── service.test.ts          # Unit tests
│   └── api.integration.test.ts  # Integration tests
└── index.ts              # Module exports
```

### 2. Upgrade Existing Module

Follow the **Module Migration Guide** (see below)

---

## 📚 Usage Examples

### Example 1: API Route with Core Infrastructure

```typescript
// ❌ OLD WAY (Mixed concerns, no type safety)
export async function GET(request: NextRequest) {
  try {
    const data = await prisma.expense.findMany();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// ✅ NEW WAY (Separation of concerns, type-safe)
import { withErrorHandler, ApiResponseUtil } from '@/core/api';
import { expenseService } from '../services';

export const GET = withErrorHandler(async (_request: NextRequest) => {
  const expenses = await expenseService.findAll();
  return ApiResponseUtil.success(expenses);
});
```

### Example 2: Service with Repository Pattern

```typescript
// ❌ OLD WAY (Direct Prisma calls)
class ExpenseService {
  async findAll() {
    return prisma.expense.findMany({ where: { deletedAt: null } });
  }
}

// ✅ NEW WAY (Repository pattern)
import { BaseRepository } from '@/core/database';

const expenseRepository = new BaseRepository(prisma.expense, 'Expense');

class ExpenseService {
  async findAll() {
    return expenseRepository.findAll(); // Includes soft delete, logging
  }

  async findPaginated(page: number, limit: number) {
    return expenseRepository.findMany({
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}
```

### Example 3: Validation with Zod

```typescript
// api/schemas.ts
import { z } from 'zod';

export const CreateExpenseSchema = z.object({
  employeeId: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().min(1),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
});

// api/route.ts
import { withValidation, ApiResponseUtil } from '@/core/api';

export const POST = withValidation(
  CreateExpenseSchema,
  async (_request, validated) => {
    const expense = await expenseService.create(validated);
    return ApiResponseUtil.success(expense, 'Expense created', 201);
  }
);
```

### Example 4: Unit Testing

```typescript
// __tests__/service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { expenseService } from '../services';
import { expenseRepository } from '../services/repository';

vi.mock('../services/repository');

describe('ExpenseService', () => {
  it('should find all expenses', async () => {
    const mockExpenses = [{ id: 1, amount: 1000 }];
    vi.mocked(expenseRepository.findAll).mockResolvedValue(mockExpenses);

    const result = await expenseService.findAll();

    expect(result).toEqual(mockExpenses);
    expect(expenseRepository.findAll).toHaveBeenCalledOnce();
  });
});
```

---

## 🔄 Module Migration Guide

### Step 1: Create Service + Repository

```typescript
// 1. Create services/repository.ts
import { BaseRepository } from '@/core/database';
import { prisma } from '@/lib/prisma';

export const expenseRepository = new BaseRepository(prisma.expense, 'Expense');

// 2. Update services/index.ts
import { expenseRepository } from './repository';

class ExpenseService {
  async findAll() {
    return expenseRepository.findAll();
  }

  // Migrate all methods to use repository
}
```

### Step 2: Add Zod Schemas

```typescript
// Create api/schemas.ts
import { z } from 'zod';

export const CreateExpenseSchema = z.object({
  // Copy your validation rules here
});

export const ExpenseQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  employeeId: z.string().optional(),
});
```

### Step 3: Upgrade API Route

```typescript
// Update api/route.ts
import { withErrorHandler, withValidation, ApiResponseUtil } from '@/core/api';
import { expenseService } from '../services';
import { CreateExpenseSchema, ExpenseQuerySchema } from './schemas';

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);

  if (searchParams.size > 0) {
    const filters = ExpenseQuerySchema.parse(Object.fromEntries(searchParams));
    const expenses = await expenseService.findWithFilters(filters);
    return ApiResponseUtil.success(expenses);
  }

  const expenses = await expenseService.findAll();
  return ApiResponseUtil.success(expenses);
});

export const POST = withValidation(
  CreateExpenseSchema,
  async (_request, validated) => {
    const expense = await expenseService.create(validated);
    return ApiResponseUtil.success(expense, 'Expense created', 201);
  }
);
```

### Step 4: Add Tests

```typescript
// Create __tests__/service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { expenseService } from '../services';

describe('ExpenseService', () => {
  it('should create expense', async () => {
    // Test implementation
  });
});

// Create __tests__/api.integration.test.ts
describe('Expense API', () => {
  it('should create expense via POST', async () => {
    const response = await fetch('http://localhost:3000/api/expenses', {
      method: 'POST',
      body: JSON.stringify({ amount: 1000 }),
    });

    expect(response.status).toBe(201);
  });
});
```

---

## 📊 Progress Tracking

### Metrics Checklist

After upgrading a module, verify:

- [ ] **Modularity (10/10)**
  - [ ] API routes in `module/api/`
  - [ ] Service layer separated
  - [ ] Repository pattern implemented
  - [ ] Barrel exports in `index.ts`

- [ ] **Separation of Concerns (10/10)**
  - [ ] Validation in Zod schemas
  - [ ] Business logic in service layer
  - [ ] Data access in repository
  - [ ] API routes only handle routing

- [ ] **Type Safety (10/10)**
  - [ ] Zod schemas for all inputs
  - [ ] TypeScript types for all entities
  - [ ] No `any` or `unknown` types
  - [ ] Runtime validation on all inputs

- [ ] **Reusability (10/10)**
  - [ ] Uses BaseRepository
  - [ ] Uses core API middleware
  - [ ] Shared validation patterns
  - [ ] Generic helpers

- [ ] **Testing (10/10)**
  - [ ] Unit tests (80%+ coverage)
  - [ ] Integration tests for API
  - [ ] E2E tests for critical flows

- [ ] **Performance (10/10)**
  - [ ] Pagination implemented
  - [ ] Database indexes added
  - [ ] Efficient queries (no N+1)

---

## 🎯 Module Upgrade Priority

### Phase 1: High-Traffic Modules (Week 1-2)

1. ✅ **thirteenth-month-pay** (Already excellent!)
2. **transactions** - Most critical
3. **expenses** - High usage
4. **attendance** - Daily operations

### Phase 2: Employee Workspace (Week 3-4)

5. **payroll**
6. **leave-requests**
7. **cash-advance**
8. **employee-loans**
9. **schedules**

### Phase 3: Operations Workspace (Week 5-6)

10. **customers**
11. **products**
12. **prices**
13. **shipments**
14. **inventory**

---

## 🛠️ Available Scripts

```json
{
  "generate:module": "node scripts/generate-module.js",
  "test:module": "vitest run -- <module-name>",
  "test:coverage": "vitest run --coverage",
  "migrate:module": "node scripts/migrate-module.js"
}
```

---

## 📖 Additional Resources

- [Architecture Decision Records](../docs/architecture/README.md)
- [Testing Guide](../docs/guides/testing-guide.md)
- [API Documentation](../docs/api/README.md)
- [Performance Optimization](../PERFORMANCE_OPTIMIZATION.md)

---

## 🤝 Contributing

When creating a new module or upgrading an existing one:

1. Use the module generator: `npm run generate:module`
2. Follow the structure exactly
3. Add unit tests (80%+ coverage)
4. Add integration tests
5. Update module index exports
6. Document any custom patterns

---

## ✅ Success Criteria

A module reaches **10/10** when:

- ✅ Uses BaseRepository for all data access
- ✅ Has Zod schemas for all API inputs
- ✅ API routes use core middleware
- ✅ Service layer has no direct Prisma calls
- ✅ 80%+ test coverage
- ✅ All TypeScript types are strict
- ✅ Pagination implemented
- ✅ Error handling is consistent
- ✅ Documentation is complete

---

**Next Steps:** Start with `npm run generate:module` or follow the migration guide to upgrade existing modules! 🚀
