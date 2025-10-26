# 📖 Complete Implementation Guide

## 🎯 Goal: Upgrade ALL Modules to 10/10

This guide provides step-by-step instructions to systematically upgrade all 26 modules across your **Employee** and **Operations** workspaces.

---

## 📊 Current State Assessment

### Employee Workspace (13 modules)

1. ✅ `thirteenth-month-pay` - Already excellent (9.5/10)
2. `attendance` - Needs repository + Zod
3. `expenses` - Needs repository + Zod
4. `payroll` - Needs repository + Zod
5. `calendar` - Needs repository + Zod
6. `schedules` - Needs repository + Zod
7. `leave-tracker` - Needs repository + Zod
8. `cash-advance` - Needs repository + Zod
9. `employee-loans` - Needs repository + Zod
10. `team` - Needs repository + Zod
11. `dashboard` - Frontend only
12. `notifications` - Needs repository + Zod
13. `settings` - Configuration only

### Operations Workspace (13 modules)

1. `transactions` - 🔥 HIGH PRIORITY - Needs full upgrade
2. `customers` - Needs repository + Zod
3. `products` - Needs repository + Zod
4. `prices` - Needs repository + Zod
5. `shipments` - Needs repository + Zod
6. `inventory` - Needs repository + Zod
7. `sorting-distribution` - Needs repository + Zod
8. `due-dates` - Needs repository + Zod
9. `pickup-form` - Form only
10. `business-intelligence` - Dashboard only
11. `shipments-dashboard` - Dashboard only
12. `post-template` - Template only
13. `dashboard` - Frontend only

---

## 🚀 Quick Start: Upgrade Your First Module

### Example: Upgrade `expenses` module

#### Step 1: Analyze Current Structure

```bash
# See current structure
ls -la src/modules/clothing/employees/expenses/
```

Expected:

```
expenses/
├── api/                  # May or may not exist
├── services/             # Probably exists
├── components/           # Exists
├── hooks/                # May exist
└── types/                # May exist
```

#### Step 2: Create Repository

Create `services/repository.ts`:

```typescript
import { BaseRepository } from '@/core/database';
import { prisma } from '@/lib/prisma';
import type { Expense } from '@prisma/client';

class ExpenseRepository extends BaseRepository<Expense> {
  constructor() {
    super(prisma.expense, 'Expense');
  }

  /**
   * Custom: Find by employee and status
   */
  async findByEmployeeAndStatus(
    employeeId: string,
    status: string
  ): Promise<Expense[]> {
    return this.findMany({
      where: { employeeId, status },
    }).then((r) => r.data);
  }

  /**
   * Custom: Get total expenses for employee
   */
  async getTotalForEmployee(employeeId: string): Promise<number> {
    const expenses = await this.findMany({ where: { employeeId } });
    return expenses.data.reduce((sum, e) => sum + e.amount, 0);
  }
}

export const expenseRepository = new ExpenseRepository();
```

#### Step 3: Update Service

Update `services/index.ts`:

```typescript
import { expenseRepository } from './repository';
import type { Expense } from '@prisma/client';
import { logger } from '@/lib/logger';

interface CreateExpenseInput {
  employeeId: string;
  amount: number;
  description: string;
  category: string;
  status?: string;
}

class ExpenseService {
  /**
   * Find all expenses
   */
  async findAll(): Promise<Expense[]> {
    return expenseRepository.findAll();
  }

  /**
   * Find by filters
   */
  async findWithFilters(filters: {
    employeeId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Expense[]> {
    return expenseRepository
      .findMany({ where: filters as any })
      .then((r) => r.data);
  }

  /**
   * Find by ID
   */
  async findById(id: number): Promise<Expense | null> {
    return expenseRepository.findById(id);
  }

  /**
   * Create expense
   */
  async create(data: CreateExpenseInput): Promise<Expense> {
    logger.info('Expense: Creating', { data });
    return expenseRepository.create({
      ...data,
      status: data.status || 'pending',
    } as any);
  }

  /**
   * Update expense
   */
  async update(
    id: number,
    data: Partial<CreateExpenseInput>
  ): Promise<Expense> {
    logger.info('Expense: Updating', { id, data });
    return expenseRepository.update(id, data as any);
  }

  /**
   * Delete expense (soft delete)
   */
  async delete(id: number): Promise<void> {
    logger.info('Expense: Deleting', { id });
    await expenseRepository.delete(id);
  }

  /**
   * Approve expense
   */
  async approve(id: number): Promise<Expense> {
    return this.update(id, { status: 'approved' });
  }

  /**
   * Reject expense
   */
  async reject(id: number): Promise<Expense> {
    return this.update(id, { status: 'rejected' });
  }
}

export const expenseService = new ExpenseService();
```

#### Step 4: Create Zod Schemas

Create `api/schemas.ts`:

```typescript
import { z } from 'zod';

export const CreateExpenseSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  category: z.enum(['travel', 'meals', 'supplies', 'equipment', 'other']),
  date: z.string().datetime(),
  receiptUrl: z.string().url().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
});

export const UpdateExpenseSchema = CreateExpenseSchema.partial();

export const ExpenseQuerySchema = z.object({
  employeeId: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  category: z
    .enum(['travel', 'meals', 'supplies', 'equipment', 'other'])
    .optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;
export type ExpenseQuery = z.infer<typeof ExpenseQuerySchema>;
```

#### Step 5: Upgrade API Route

Update `api/route.ts` (or create if in `/app/api/`):

```typescript
import type { NextRequest } from 'next/server';
import { withErrorHandler, withValidation, ApiResponseUtil } from '@/core/api';
import { expenseService } from '../services';
import {
  CreateExpenseSchema,
  UpdateExpenseSchema,
  ExpenseQuerySchema,
} from './schemas';

/**
 * GET /api/expenses
 * Fetch expenses with optional filters
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);

  if (searchParams.size > 0) {
    const query = ExpenseQuerySchema.parse(Object.fromEntries(searchParams));
    const expenses = await expenseService.findWithFilters(query);
    return ApiResponseUtil.success(expenses);
  }

  const expenses = await expenseService.findAll();
  return ApiResponseUtil.success(expenses);
});

/**
 * POST /api/expenses
 * Create a new expense
 */
export const POST = withValidation(
  CreateExpenseSchema,
  async (_request, validated) => {
    const expense = await expenseService.create(validated);
    return ApiResponseUtil.success(
      expense,
      'Expense created successfully',
      201
    );
  }
);

/**
 * PUT /api/expenses
 * Update an expense
 */
export const PUT = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { id, ...data } = body;

  if (!id) {
    return ApiResponseUtil.badRequest('Expense ID is required');
  }

  const validated = UpdateExpenseSchema.parse(data);
  const expense = await expenseService.update(Number(id), validated);

  return ApiResponseUtil.success(expense, 'Expense updated successfully');
});

/**
 * DELETE /api/expenses
 * Delete an expense (soft delete)
 */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return ApiResponseUtil.badRequest('Expense ID is required');
  }

  await expenseService.delete(Number(id));

  return ApiResponseUtil.success(null, 'Expense deleted successfully');
});
```

#### Step 6: Add Unit Tests

Create `__tests__/service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expenseService } from '../services';
import { expenseRepository } from '../services/repository';

vi.mock('../services/repository', () => ({
  expenseRepository: {
    findAll: vi.fn(),
    findMany: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('ExpenseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all expenses', async () => {
      const mockExpenses = [
        { id: 1, amount: 1000, employeeId: 'EMP123' },
        { id: 2, amount: 2000, employeeId: 'EMP456' },
      ];

      vi.mocked(expenseRepository.findAll).mockResolvedValue(
        mockExpenses as any
      );

      const result = await expenseService.findAll();

      expect(result).toEqual(mockExpenses);
      expect(expenseRepository.findAll).toHaveBeenCalledOnce();
    });
  });

  describe('create', () => {
    it('should create an expense', async () => {
      const input = {
        employeeId: 'EMP123',
        amount: 1000,
        description: 'Travel',
        category: 'travel' as const,
      };

      const mockExpense = {
        id: 1,
        ...input,
        status: 'pending',
        createdAt: new Date(),
      };

      vi.mocked(expenseRepository.create).mockResolvedValue(mockExpense as any);

      const result = await expenseService.create(input);

      expect(result).toEqual(mockExpense);
      expect(expenseRepository.create).toHaveBeenCalledWith({
        ...input,
        status: 'pending',
      });
    });
  });

  describe('approve', () => {
    it('should update expense status to approved', async () => {
      const mockExpense = {
        id: 1,
        status: 'approved',
      };

      vi.mocked(expenseRepository.update).mockResolvedValue(mockExpense as any);

      const result = await expenseService.approve(1);

      expect(result.status).toBe('approved');
      expect(expenseRepository.update).toHaveBeenCalledWith(1, {
        status: 'approved',
      });
    });
  });
});
```

#### Step 7: Add Integration Test (Optional)

Create `__tests__/api.integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Expense API', () => {
  const API_URL = 'http://localhost:3000/api/expenses';

  describe('GET /api/expenses', () => {
    it('should return all expenses', async () => {
      const response = await fetch(API_URL);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await fetch(`${API_URL}?status=approved`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.every((e: any) => e.status === 'approved')).toBe(true);
    });
  });

  describe('POST /api/expenses', () => {
    it('should create expense with valid data', async () => {
      const payload = {
        employeeId: 'EMP123',
        amount: 1000,
        description: 'Test expense',
        category: 'travel',
        date: new Date().toISOString(),
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
    });

    it('should reject invalid payload', async () => {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' }),
      });

      expect(response.status).toBe(422);
    });
  });
});
```

#### Step 8: Update Module Index

Update `index.ts`:

```typescript
/**
 * Expenses Module
 */

export * from './types';
export { expenseService } from './services';
export {
  CreateExpenseSchema,
  UpdateExpenseSchema,
  ExpenseQuerySchema,
  type CreateExpenseInput,
  type UpdateExpenseInput,
  type ExpenseQuery,
} from './api/schemas';
```

#### Step 9: Run Tests

```bash
# Run unit tests
npm run test expenses

# Check coverage
npm run test:coverage -- expenses

# Run integration tests
npm run test:integration -- expenses
```

#### Step 10: Verify Metrics

Checklist after upgrade:

- [x] **Modularity**: API in `module/api/`, service layer separated
- [x] **Separation of Concerns**: Validation → Service → Repository → DB
- [x] **Type Safety**: Zod schemas + TypeScript types
- [x] **Reusability**: Uses BaseRepository, core middleware
- [x] **Testing**: Unit tests + integration tests
- [x] **Performance**: Repository pattern enables caching later

**Result**: ✅ Module upgraded from ~7/10 to 10/10!

---

## ⏱️ Time Estimates

| Module Complexity         | Time to Upgrade | Example                     |
| ------------------------- | --------------- | --------------------------- |
| Simple (CRUD only)        | 1-2 hours       | `cash-advance`, `due-dates` |
| Medium (+ business logic) | 2-4 hours       | `expenses`, `attendance`    |
| Complex (+ calculations)  | 4-8 hours       | `payroll`, `transactions`   |

**Total for 20 modules** (excluding dashboards/forms):

- Simple (10): 15 hours
- Medium (8): 24 hours
- Complex (2): 12 hours
- **Total: ~51 hours (6-7 workdays)**

---

## 📋 Batch Upgrade Strategy

### Week 1: Foundation + High Priority

- [x] Core infrastructure (DONE)
- [x] Documentation (DONE)
- [ ] `transactions` (Complex, high priority)
- [ ] `expenses` (Medium)
- [ ] `attendance` (Medium)

### Week 2: Employee Modules

- [ ] `payroll` (Complex)
- [ ] `leave-tracker` (Medium)
- [ ] `cash-advance` (Simple)
- [ ] `employee-loans` (Simple)
- [ ] `schedules` (Medium)

### Week 3: Operations Modules

- [ ] `customers` (Medium)
- [ ] `products` (Simple)
- [ ] `prices` (Simple)
- [ ] `shipments` (Medium)
- [ ] `inventory` (Medium)

### Week 4: Remaining + Polish

- [ ] `sorting-distribution` (Medium)
- [ ] Remaining modules
- [ ] E2E tests
- [ ] Performance optimization
- [ ] Documentation updates

---

## 🎯 Success Metrics

After upgrading all modules, you should have:

- ✅ **100% of modules** use `BaseRepository`
- ✅ **100% of API routes** have Zod validation
- ✅ **80%+ test coverage** across all modules
- ✅ **Consistent patterns** everywhere
- ✅ **Type-safe** end-to-end
- ✅ **10/10** on all metrics!

---

## 🆘 Need Help?

1. **Module too complex?** Break it into sub-modules
2. **Stuck on Zod schema?** Check existing examples in `thirteenth-month-pay`
3. **Tests failing?** Use `mockService` helper from `@/core/testing`
4. **Questions?** Refer to [MODULE_FRAMEWORK.md](./MODULE_FRAMEWORK.md) or ADRs

---

**Let's get started! 🚀** Pick a simple module first to practice, then tackle complex ones.
