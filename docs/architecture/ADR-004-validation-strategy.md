# ADR-004: Validation Strategy with Zod

**Status**: Accepted

**Date**: 2025-10-26

---

## Context

API routes previously had inconsistent validation:

```typescript
// ❌ Manual validation (error-prone)
export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.employeeId || typeof body.employeeId !== 'string') {
    return NextResponse.json({ error: 'Invalid employeeId' }, { status: 400 });
  }

  if (!body.amount || typeof body.amount !== 'number' || body.amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  // ... more validation
}
```

**Problems**:

1. **Verbose**: Lots of boilerplate code
2. **Inconsistent**: Different error formats across routes
3. **No Type Safety**: No automatic TypeScript types
4. **Hard to Test**: Need to test each validation case
5. **Runtime-Only**: No compile-time guarantees

---

## Decision

We will use **Zod** for all API input validation with this pattern:

### 1. Define Schemas

```typescript
// api/schemas.ts
import { z } from 'zod';

export const CreateExpenseSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  category: z.enum(['travel', 'meals', 'supplies']),
  date: z.string().datetime(),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
});

export const ExpenseQuerySchema = z.object({
  employeeId: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

// ✅ TypeScript types generated automatically
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
export type ExpenseQuery = z.infer<typeof ExpenseQuerySchema>;
```

### 2. Use in API Routes

```typescript
// api/route.ts
import { withValidation, ApiResponseUtil } from '@/core/api';
import { CreateExpenseSchema, ExpenseQuerySchema } from './schemas';

// POST with body validation
export const POST = withValidation(
  CreateExpenseSchema,
  async (_request, validated) => {
    // `validated` is fully type-safe!
    const expense = await expenseService.create(validated);
    return ApiResponseUtil.success(expense, 'Expense created', 201);
  }
);

// GET with query validation
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = ExpenseQuerySchema.parse(Object.fromEntries(searchParams));

  const expenses = await expenseService.findWithFilters(query);
  return ApiResponseUtil.success(expenses);
});
```

### 3. Validation Middleware

```typescript
// core/api/middleware.ts
export function withValidation<T>(
  schema: ZodSchema<T>,
  handler: (request: NextRequest, validated: T) => Promise<NextResponse>
) {
  return withErrorHandler(async (request: NextRequest) => {
    try {
      const body = await request.json();
      const validated = schema.parse(body); // ✅ Throws on invalid
      return handler(request, validated);
    } catch (error) {
      if (error instanceof ZodError) {
        return ApiResponseUtil.validationError(error); // ✅ Formatted error
      }
      throw error;
    }
  });
}
```

---

## Consequences

### Positive

✅ **Type Safety**: TypeScript types generated from schemas  
✅ **Runtime Safety**: Validation at runtime catches bad data  
✅ **Consistency**: All validation errors formatted the same  
✅ **DRY**: Schema defined once, used everywhere  
✅ **Self-Documenting**: Schema is the contract  
✅ **Testability**: Easy to test with invalid payloads  
✅ **Developer Experience**: Autocomplete in IDEs

### Negative

⚠️ **Bundle Size**: Zod adds ~15kb (gzipped)  
⚠️ **Learning Curve**: Team needs to learn Zod API  
⚠️ **Duplication**: Schemas + Prisma models (can diverge)

### Mitigations

- Zod already in `dependencies` (no added cost)
- Extensive examples in module generator
- Prisma models are source of truth, schemas validate input
- Use `z.infer` to derive types from schemas

---

## Examples

### Complex Validation

```typescript
export const CreateTransactionSchema = z
  .object({
    customerId: z.string().min(1),
    items: z
      .array(
        z.object({
          productCode: z.string().min(1),
          quantity: z.number().int().positive(),
          unitPrice: z.number().positive(),
          discount: z.number().min(0).max(100).default(0),
        })
      )
      .min(1, 'At least one item required'),
    paymentMethod: z.enum(['cash', 'credit', 'debit']),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      // Custom validation: Check total isn't negative
      const total = data.items.reduce((sum, item) => {
        const itemTotal = item.quantity * item.unitPrice;
        const discountAmount = (itemTotal * item.discount) / 100;
        return sum + (itemTotal - discountAmount);
      }, 0);
      return total > 0;
    },
    { message: 'Transaction total must be positive' }
  );
```

### Query Parameter Coercion

```typescript
// URL: /api/expenses?page=2&limit=20&status=approved

export const ExpenseQuerySchema = z.object({
  page: z.coerce.number().default(1), // ✅ "2" → 2
  limit: z.coerce.number().default(50), // ✅ "20" → 20
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

const query = ExpenseQuerySchema.parse(Object.fromEntries(searchParams));
// query = { page: 2, limit: 20, status: 'approved' }
```

### Reusable Schemas

```typescript
// shared/schemas/common.ts
export const DateRangeSchema = z
  .object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  })
  .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
    message: 'End date must be after start date',
  });

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

// Use in module schemas
export const ExpenseQuerySchema = z.intersection(
  DateRangeSchema.partial(),
  PaginationSchema
);
```

---

## Alternatives Considered

### 1. Manual Validation

**Pros**: No dependencies, full control  
**Cons**: Verbose, error-prone, no type generation  
**Decision**: ❌ Rejected

### 2. class-validator

**Pros**: Decorator-based, popular  
**Cons**: Requires classes, no type inference, heavier  
**Decision**: ❌ Rejected

### 3. Yup

**Pros**: Similar to Zod, popular  
**Cons**: Worse TypeScript support, larger bundle  
**Decision**: ❌ Rejected

### 4. Zod (Chosen)

**Pros**: Best TypeScript integration, lightweight, composable  
**Cons**: Newer (but mature)  
**Decision**: ✅ Accepted

---

## Related

- [ADR-003: API Response Standardization](./ADR-003-api-response-standardization.md)
- [Validation Middleware](../../src/core/api/middleware.ts)
- [Zod Documentation](https://zod.dev)

---

## Testing

```typescript
// __tests__/api-validation.test.ts
import { describe, it, expect } from 'vitest';
import { CreateExpenseSchema } from '../api/schemas';

describe('CreateExpenseSchema', () => {
  it('should validate correct input', () => {
    const valid = {
      employeeId: 'EMP123',
      amount: 1000,
      description: 'Travel expense',
      category: 'travel',
      date: new Date().toISOString(),
    };

    expect(() => CreateExpenseSchema.parse(valid)).not.toThrow();
  });

  it('should reject invalid amount', () => {
    const invalid = {
      employeeId: 'EMP123',
      amount: -100, // ❌ Negative
      description: 'Test',
      category: 'travel',
      date: new Date().toISOString(),
    };

    expect(() => CreateExpenseSchema.parse(invalid)).toThrow();
  });
});
```

---

## Notes

This decision brings **Type Safety** from **9/10 to 10/10** by ensuring runtime validation matches compile-time types. Zod is now the standard for all API input validation.
