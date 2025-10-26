# Error Handling Migration Example

This document shows a before/after comparison of API route error handling.

## BEFORE: Original Error Handling

```typescript
// ❌ BEFORE - Inconsistent error handling
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Manual validation with inconsistent responses
    if (!body.employeeId) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.create({
      data: body,
    });

    return NextResponse.json(employee);
  } catch (error) {
    // Generic error handling
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'Duplicate entry' }, { status: 409 });
      }
    }

    logger.error('Failed to create employee', error);
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    );
  }
}
```

### Problems with original approach:

1. ❌ **Inconsistent error format** - Different routes return different error structures
2. ❌ **No error codes** - Hard for clients to programmatically handle errors
3. ❌ **No suggestions** - Users don't know how to fix the issue
4. ❌ **Limited Prisma handling** - Only handles one specific Prisma error
5. ❌ **No context** - Logs don't capture what the user was trying to do
6. ❌ **Repetitive code** - Same error handling logic copied across routes

## AFTER: Standardized Error Handling

```typescript
// ✅ AFTER - Standardized error handling
import { handleApiError, ValidationError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Structured validation with custom error class
    if (!body.employeeId) {
      throw new ValidationError(
        'Missing required field',
        'employeeId',
        'Employee ID is required',
        ['Please provide an employee ID']
      );
    }

    const employee = await prisma.employee.create({
      data: body,
    });

    logger.info('Employee created successfully', {
      employeeId: employee.id,
      employeeCode: employee.employeeId,
    });

    return NextResponse.json(employee);
  } catch (error) {
    // Automatic comprehensive error handling
    return handleApiError(error, {
      action: 'create_employee',
      employeeCode: body?.employeeId,
    });
  }
}
```

### Improvements:

1. ✅ **Consistent error format** - All responses use `ApiErrorResponse` structure
2. ✅ **Machine-readable codes** - `ErrorCode.VALIDATION_ERROR`, `ErrorCode.DUPLICATE_ENTRY`, etc.
3. ✅ **User-friendly suggestions** - Clear guidance on how to fix the issue
4. ✅ **Comprehensive Prisma handling** - Handles 8+ different Prisma error codes automatically
5. ✅ **Rich context logging** - Logs include action context and relevant data
6. ✅ **DRY principle** - One centralized error handler for all routes

## Error Response Comparison

### BEFORE - Inconsistent Structure

```json
// Validation error
{ "error": "Employee ID is required" }

// Duplicate error
{ "error": "Duplicate entry" }

// Server error
{
  "error": "Failed to create employee",
  "details": "Cannot read property 'id' of undefined"
}
```

### AFTER - Standardized Structure

```json
// Validation error
{
  "error": "Missing required field",
  "code": "VALIDATION_ERROR",
  "field": "employeeId",
  "details": "Employee ID is required",
  "suggestions": ["Please provide an employee ID"],
  "timestamp": "2025-01-27T10:30:00.000Z"
}

// Duplicate error
{
  "error": "Duplicate record",
  "code": "DUPLICATE_ENTRY",
  "field": "employeeId",
  "details": "A record with this employeeId already exists",
  "suggestions": [
    "Use a different employeeId",
    "Update the existing record instead"
  ],
  "timestamp": "2025-01-27T10:30:00.000Z"
}

// Server error
{
  "error": "Unable to process your request",
  "code": "INTERNAL_ERROR",
  "details": "An unexpected error occurred",
  "suggestions": [
    "Please try again",
    "Contact support if the problem persists"
  ],
  "timestamp": "2025-01-27T10:30:00.000Z"
}
```

## Client-Side Usage Comparison

### BEFORE - Manual Error Handling

```typescript
// ❌ BEFORE - Manual error extraction
try {
  const response = await fetch('/api/employees', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    notifications.show({
      title: 'Error',
      message: error.error || 'Something went wrong',
      color: 'red',
    });
    return;
  }
} catch (error) {
  notifications.show({
    title: 'Error',
    message: 'Network error',
    color: 'red',
  });
}
```

### AFTER - Using ErrorDisplay Component

```typescript
// ✅ AFTER - Using ErrorDisplay component
const { data, error, isError, refetch } = useQuery({
  queryKey: ['employees', id],
  queryFn: () => fetchEmployee(id),
});

if (isError) {
  return (
    <ErrorDisplay
      error={error}
      onRetry={() => refetch()}
      context="Loading employee data"
    />
  );
}
```

## React Query Integration

### BEFORE - No Automatic Retry

```typescript
// ❌ BEFORE - No retry logic
const { data, error } = useQuery({
  queryKey: ['employees'],
  queryFn: fetchEmployees,
});
```

### AFTER - Smart Retry Logic

```typescript
// ✅ AFTER - Retry only on server errors
const { data, error } = useQuery({
  queryKey: ['employees'],
  queryFn: fetchEmployees,
  retry: (failureCount, error) => {
    // Don't retry on client errors (4xx)
    const status = (error as any)?.status;
    if (status >= 400 && status < 500) return false;

    // Retry up to 3 times on server errors (5xx)
    if (status >= 500) return failureCount < 3;

    return false;
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});
```

## Custom Error Types

### Creating Domain-Specific Errors

```typescript
// ✅ NEW - Domain-specific error classes
class InsufficientBalanceError extends AppError {
  constructor(required: number, available: number) {
    super(
      'Insufficient balance',
      ErrorCode.INSUFFICIENT_BALANCE,
      422,
      'amount',
      `Required: $${required}, Available: $${available}`,
      [
        'Reduce the transaction amount',
        'Add funds to the account',
        'Contact finance team for assistance',
      ]
    );
  }
}

// Usage in API route
if (cashAdvance.amount > employee.availableBalance) {
  throw new InsufficientBalanceError(
    cashAdvance.amount,
    employee.availableBalance
  );
}
```

## Error Boundary Integration

### BEFORE - No Module-Level Error Boundaries

```typescript
// ❌ BEFORE - Errors crash entire app
export default function EmployeesPage() {
  const { data } = useEmployees();
  return <EmployeeList employees={data} />;
}
```

### AFTER - Module-Level Error Boundaries

```typescript
// ✅ AFTER - Errors contained to module
export default function EmployeesPage() {
  return (
    <ErrorBoundary
      fallback={
        <ErrorDisplay
          error="Failed to load employees module"
          context="An error occurred while loading the employees module"
        />
      }
    >
      <EmployeesContent />
    </ErrorBoundary>
  );
}
```

## Testing Error Scenarios

### Error Scenario Tests

```typescript
// ✅ NEW - Testing error handling
describe('POST /api/employees', () => {
  it('should return validation error for missing employeeId', async () => {
    const response = await fetch('/api/employees', {
      method: 'POST',
      body: JSON.stringify({ name: 'John Doe' }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.field).toBe('employeeId');
    expect(data.suggestions).toBeDefined();
  });

  it('should return duplicate error for existing employeeId', async () => {
    // Create first employee
    await createEmployee({ employeeId: 'EMP001' });

    // Try to create duplicate
    const response = await fetch('/api/employees', {
      method: 'POST',
      body: JSON.stringify({ employeeId: 'EMP001' }),
    });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.code).toBe('DUPLICATE_ENTRY');
    expect(data.field).toBe('employeeId');
  });

  it('should handle database connection errors', async () => {
    // Simulate database down
    prisma.$disconnect();

    const response = await fetch('/api/employees', {
      method: 'POST',
      body: JSON.stringify({ employeeId: 'EMP001' }),
    });

    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.code).toBe('SERVICE_UNAVAILABLE');
  });
});
```

## Summary of Benefits

### For Users:

- ✅ Clear error messages they can understand
- ✅ Actionable suggestions on how to fix issues
- ✅ Consistent error experience across the app
- ✅ Faster error recovery with retry functionality

### For Developers:

- ✅ Standardized error handling patterns
- ✅ Less boilerplate code
- ✅ Easier to debug with structured logging
- ✅ Type-safe error handling with TypeScript
- ✅ Comprehensive Prisma error handling
- ✅ Testable error scenarios

### For System Reliability:

- ✅ Automatic retry for transient errors
- ✅ Error boundaries prevent app crashes
- ✅ Better error tracking and monitoring
- ✅ Consistent logging for debugging
