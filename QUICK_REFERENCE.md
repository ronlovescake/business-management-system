# 🚀 Quick Reference Guide - Code Quality Improvements

## 📌 What We Did (Summary)

✅ **Phase 1-3 Complete** - Foundation for 10/10 code quality

- Created type-safe infrastructure with branded types
- Implemented Zod validation schemas
- Extracted business logic into service layer
- Centralized API responses and constants

---

## 🎯 How to Use New Components

### 1. Branded Types (Type-Safe IDs)

```typescript
import { BrandedId, type EmployeeId, type LeaveRequestId } from '@/types/branded';

// Create branded IDs
const empId: EmployeeId = BrandedId.employee('EMP-0001');
const leaveId: LeaveRequestId = BrandedId.leaveRequest(123);

// TypeScript prevents mixing different ID types
function getEmployee(id: EmployeeId) { ... }
getEmployee(leaveId); // ❌ Compile error!
```

### 2. Async State Management

```typescript
import { AsyncData } from '@/types/api';

const [state, setState] = useState<AsyncData<User[]>>({ status: 'idle' });

// Type-safe state transitions
setState({ status: 'loading' });
setState({ status: 'success', data: users });
setState({ status: 'error', error: new Error('Failed') });

// Type guards
if (AsyncData.isSuccess(state)) {
  console.log(state.data); // TypeScript knows data exists
}
```

### 3. API Response Utilities

```typescript
import { ApiResponse } from '@/core/api/response';
import { HTTP_STATUS } from '@/shared/constants/api';

// In your API route:
export async function GET(request: NextRequest) {
  try {
    const data = await fetchData();
    return ApiResponse.success(data);
  } catch (error) {
    return ApiResponse.error(
      'Failed to fetch',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

// Available methods:
ApiResponse.success(data, 'Optional message');
ApiResponse.error(message, status, details, options);
ApiResponse.paginated(items, { page, limit, total });
ApiResponse.notFound('Resource name');
ApiResponse.badRequest('Error', validationErrors);
ApiResponse.conflict('Duplicate found');
```

### 4. Zod Validation

```typescript
import { LeaveRequestCreateSchema } from '@/app/api/leave-requests/schemas';
import { validateCreateLeaveRequest } from '@/app/api/leave-requests/validation';

// Validate data
const result = validateCreateLeaveRequest(unknownData);

if (result.success) {
  // result.data is fully typed
  console.log(result.data.employeeId);
} else {
  // result.error is a Zod error
  const formatted = formatZodError(result.error);
  console.log(formatted.validationErrors);
}
```

### 5. Service Layer

```typescript
import { leaveRequestService } from '@/app/api/leave-requests/service';

// Use in your code
const requests = await leaveRequestService.findMany();
const result = await leaveRequestService.createMany(validatedData);
const stats = await leaveRequestService.getStatistics();
```

---

## 📁 New File Structure

```
src/
├── types/
│   ├── branded.ts           # Branded types for IDs
│   └── api.ts               # API types & state management
│
├── shared/
│   └── constants/
│       └── api.ts           # API constants (limits, status codes)
│
├── core/
│   └── api/
│       └── response.ts      # ApiResponse utility
│
└── app/api/[resource]/
    ├── schemas.ts           # Zod schemas
    ├── validation.ts        # Validation functions
    ├── service.ts           # Business logic
    └── route.ts             # Route handlers (thin layer)
```

---

## 🎨 Patterns to Follow

### API Route Structure (New Pattern)

```typescript
// route.ts - Keep it thin!
import { validateBatchCreate } from './validation';
import { leaveRequestService } from './service';
import { ApiResponse } from '@/core/api/response';
import { HTTP_STATUS, BATCH_LIMITS } from '@/shared/constants/api';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // 1. Validate
    const validation = validateBatchCreate(payload);
    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        formatZodError(validation.error).validationErrors
      );
    }

    // 2. Business logic (in service)
    const result = await leaveRequestService.createMany(validation.data);

    // 3. Return response
    return ApiResponse.success(result, result.message);
  } catch (error) {
    logger.error('POST /api/leave-requests failed', error);
    return ApiResponse.error('Failed to create leave requests');
  }
}
```

### Service Structure

```typescript
// service.ts - Business logic only
export class ResourceService {
  // CRUD operations
  async findMany() { ... }
  async create(data) { ... }
  async update(id, data) { ... }

  // Business logic
  async validateBusinessRules(data) { ... }
  async getStatistics() { ... }

  // Helper methods
  private async checkDependencies(id) { ... }
}
```

---

## 🔧 Constants Usage

```typescript
import {
  BATCH_LIMITS,
  PAGINATION,
  HTTP_STATUS,
  MASS_DELETE_TOKENS,
} from '@/shared/constants/api';

// Use instead of magic numbers
if (items.length > BATCH_LIMITS.MAX_BATCH_SIZE) {
  return ApiResponse.payloadTooLarge(items.length, BATCH_LIMITS.MAX_BATCH_SIZE);
}

const page = parseInt(
  searchParams.get('page') || String(PAGINATION.DEFAULT_PAGE)
);
```

---

## ✨ Quick Wins You Can Do Now

### 1. Use Branded Types in Existing Code

```typescript
// Before
function getEmployee(id: string) { ... }

// After
import { type EmployeeId } from '@/types/branded';
function getEmployee(id: EmployeeId) { ... }
```

### 2. Replace Magic Numbers

```typescript
// Before
if (items.length > 10000) { ... }

// After
import { BATCH_LIMITS } from '@/shared/constants/api';
if (items.length > BATCH_LIMITS.MAX_BATCH_SIZE) { ... }
```

### 3. Use ApiResponse Utility

```typescript
// Before
return NextResponse.json({ error: 'Not found' }, { status: 404 });

// After
return ApiResponse.notFound('Resource');
```

### 4. Add Async State Management

```typescript
// Before
const [data, setData] = useState<User[] | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

// After
const [state, setState] = useState<AsyncData<User[]>>({ status: 'idle' });
```

---

## 📝 Next Phase Preview

### Phase 4: Repository Pattern

```typescript
// You'll soon be able to write:
const repository = new LeaveRequestRepository();
const requests = await repository.findMany();
const request = await repository.findById(123);

// With automatic:
// - Soft-delete filtering
// - Type safety
// - Error handling
// - Logging
```

---

## 🎓 Key Principles

1. **Type Safety First** - Start with types, everything else follows
2. **Single Responsibility** - Each file/class does ONE thing well
3. **DRY (Don't Repeat Yourself)** - Use utilities and shared code
4. **Consistent Patterns** - Same approach across all modules
5. **Documentation** - JSDoc for public APIs, comments for complex logic

---

## 📚 Files to Reference

| File                                   | Purpose                        |
| -------------------------------------- | ------------------------------ |
| `IMPLEMENTATION_SUMMARY.md`            | Detailed progress and examples |
| `CODE_QUALITY_IMPROVEMENT_PROGRESS.md` | Tracking document              |
| `TODO List (VS Code)`                  | Active tasks                   |
| This file                              | Quick reference guide          |

---

## 🤝 Contributing Pattern (Future)

When adding new features:

1. ✅ Define types (`types/` or `schemas.ts`)
2. ✅ Create Zod schema if API endpoint
3. ✅ Write validation functions
4. ✅ Implement business logic in service
5. ✅ Create thin route handler
6. ✅ Add JSDoc comments
7. ✅ Update exports
8. ✅ Test thoroughly

---

## 💡 Tips

- **Always validate at the edge** (API routes, form submissions)
- **Keep route handlers thin** (< 50 lines if possible)
- **Log errors with context** (use structured logging)
- **Return consistent responses** (use ApiResponse utility)
- **Document public APIs** (JSDoc with examples)

---

_Created: October 26, 2025_  
_For: Business Management System_  
_Status: Foundation Complete (3/20 phases)_
