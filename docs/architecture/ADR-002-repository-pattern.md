# ADR-002: Repository Pattern for Data Access

**Status**: Accepted

**Date**: 2025-10-26

---

## Context

Direct Prisma calls scattered throughout the codebase led to:

1. **Duplication**: Same queries repeated across modules
2. **Testing Difficulty**: Hard to mock database operations
3. **Inconsistent Behavior**: Soft delete not applied uniformly
4. **No Audit Trail**: Changes not logged consistently
5. **Tight Coupling**: Business logic tightly coupled to ORM

Example of the problem:

```typescript
// ❌ Service directly using Prisma
class ExpenseService {
  async findAll() {
    return prisma.expense.findMany({ where: { deletedAt: null } });
  }

  async delete(id: number) {
    return prisma.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
```

This approach:

- Repeats soft delete logic
- No automatic logging
- Hard to test (requires full Prisma mock)
- Violates single responsibility principle

---

## Decision

We will implement the **Repository Pattern** using a generic `BaseRepository<T>` class:

```typescript
// core/database/base-repository.ts
export class BaseRepository<T extends BaseEntity> {
  constructor(
    private model: any,
    private modelName: string
  ) {}

  async findAll(): Promise<T[]> {
    /* ... */
  }
  async findById(id: number): Promise<T | null> {
    /* ... */
  }
  async create(data: CreateInput<T>): Promise<T> {
    /* ... */
  }
  async update(id: number, data: UpdateInput<T>): Promise<T> {
    /* ... */
  }
  async delete(id: number): Promise<void> {
    /* soft delete */
  }
  // ... more methods
}
```

### Usage in Modules:

```typescript
// Module-specific repository
export const expenseRepository = new BaseRepository(prisma.expense, 'Expense');

// Service uses repository
class ExpenseService {
  async findAll() {
    return expenseRepository.findAll(); // ✅ Soft delete automatic
  }

  async delete(id: number) {
    return expenseRepository.delete(id); // ✅ Logged automatically
  }
}
```

### Key Features:

1. **Soft Delete by Default**: `deletedAt` filter applied automatically
2. **Audit Logging**: All operations logged via `logger`
3. **Pagination**: Built-in pagination support
4. **Generic**: Works with any Prisma model
5. **Testable**: Easy to mock repository methods

---

## Consequences

### Positive

✅ **DRY Principle**: No duplicated query logic  
✅ **Testability**: Easy to mock repository in service tests  
✅ **Consistency**: Soft delete applied uniformly  
✅ **Audit Trail**: All operations automatically logged  
✅ **Maintainability**: Change database logic in one place  
✅ **Separation of Concerns**: Clear boundary between service and data access

### Negative

⚠️ **Abstraction Cost**: Additional layer between service and database  
⚠️ **Learning Curve**: Team needs to understand repository pattern  
⚠️ **Type Safety**: Requires `any` for Prisma model delegate

### Mitigations

- Well-documented `BaseRepository` with examples
- Module generator includes repository setup
- Service tests mock repository, not Prisma

---

## Examples

### Unit Testing with Repository Pattern

```typescript
// __tests__/expense-service.test.ts
import { vi } from 'vitest';
import { expenseService } from '../services';
import { expenseRepository } from '../services/repository';

// ✅ Mock repository (clean, simple)
vi.mock('../services/repository', () => ({
  expenseRepository: {
    findAll: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('ExpenseService', () => {
  it('should find all expenses', async () => {
    vi.mocked(expenseRepository.findAll).mockResolvedValue([mockExpense]);

    const result = await expenseService.findAll();

    expect(result).toEqual([mockExpense]);
    expect(expenseRepository.findAll).toHaveBeenCalledOnce();
  });
});
```

### Custom Repository Methods

```typescript
// services/repository.ts
class ExpenseRepository extends BaseRepository<Expense> {
  constructor() {
    super(prisma.expense, 'Expense');
  }

  /**
   * Custom method: Find expenses by status
   */
  async findByStatus(status: ExpenseStatus): Promise<Expense[]> {
    return this.findMany({ where: { status } }).then((r) => r.data);
  }

  /**
   * Custom method: Calculate total expenses
   */
  async getTotalAmount(employeeId: string): Promise<number> {
    const expenses = await this.findMany({ where: { employeeId } });
    return expenses.data.reduce((sum, e) => sum + e.amount, 0);
  }
}

export const expenseRepository = new ExpenseRepository();
```

---

## Alternatives Considered

### 1. Direct Prisma Usage

**Pros**: Simple, no abstraction  
**Cons**: Duplication, hard to test, inconsistent behavior  
**Decision**: ❌ Rejected - doesn't scale

### 2. Prisma Middleware

**Pros**: Automatic soft delete at ORM level  
**Cons**: Less explicit, harder to debug, performance overhead  
**Decision**: ❌ Rejected - too "magical"

### 3. Repository Pattern (Chosen)

**Pros**: Explicit, testable, reusable, maintainable  
**Cons**: Additional abstraction  
**Decision**: ✅ Accepted

---

## Related

- [ADR-001: Module Structure](./ADR-001-module-structure.md)
- [ADR-005: Soft Delete Strategy](./ADR-005-soft-delete-strategy.md)
- [BaseRepository Implementation](../../src/core/database/base-repository.ts)

---

## Notes

This decision brings **Separation of Concerns** from **9/10 to 10/10** by clearly separating data access from business logic. The `BaseRepository` is a key infrastructure component used by all modules.
