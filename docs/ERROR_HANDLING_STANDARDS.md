# Error Handling Standards

## Overview

This document defines the standardized error handling patterns for the Business Management System. Following these standards ensures consistent error experiences, better debugging, and improved user experience.

## Core Principles

1. **User-Friendly Messages**: Never expose technical details to end users
2. **Comprehensive Logging**: Always log errors with context for debugging
3. **Consistent Structure**: Use standardized error response formats
4. **Recovery Guidance**: Provide actionable suggestions when possible
5. **Error Context**: Include what the user was trying to do

## Error Response Format

### API Routes

All API error responses must follow this structure:

```typescript
interface ApiErrorResponse {
  error: string; // User-friendly error message
  code?: string; // Machine-readable error code
  details?: string; // Additional context (optional)
  field?: string; // Field name for validation errors
  suggestions?: string[]; // Recovery suggestions
  timestamp?: string; // ISO 8601 timestamp
  requestId?: string; // For tracking/debugging
}
```

### Example Responses

```typescript
// 400 Bad Request - Validation Error
{
  error: "Invalid employee data",
  code: "VALIDATION_ERROR",
  field: "email",
  details: "Email address is required",
  suggestions: ["Please provide a valid email address"]
}

// 404 Not Found
{
  error: "Employee not found",
  code: "NOT_FOUND",
  details: "No employee found with ID 123",
  suggestions: ["Check if the employee ID is correct", "The employee may have been deleted"]
}

// 409 Conflict
{
  error: "Duplicate entry",
  code: "DUPLICATE_ENTRY",
  field: "employeeCode",
  details: "An employee with code EMP001 already exists",
  suggestions: ["Use a different employee code", "Update the existing employee instead"]
}

// 500 Internal Server Error
{
  error: "Unable to process your request",
  code: "INTERNAL_ERROR",
  details: "An unexpected error occurred",
  suggestions: ["Please try again", "Contact support if the problem persists"]
}
```

## Error Codes

### Standard HTTP Status Codes

| Code | Name                  | Usage                                    |
| ---- | --------------------- | ---------------------------------------- |
| 400  | Bad Request           | Invalid input, validation errors         |
| 401  | Unauthorized          | Authentication required                  |
| 403  | Forbidden             | Insufficient permissions                 |
| 404  | Not Found             | Resource doesn't exist                   |
| 409  | Conflict              | Duplicate entry, constraint violation    |
| 422  | Unprocessable Entity  | Semantic errors in request               |
| 429  | Too Many Requests     | Rate limiting                            |
| 500  | Internal Server Error | Unexpected errors                        |
| 503  | Service Unavailable   | Database down, external service failures |

### Custom Error Codes

```typescript
enum ErrorCode {
  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Resource Errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',

  // Business Logic Errors
  INVALID_OPERATION = 'INVALID_OPERATION',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',

  // Database Errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  CONSTRAINT_FAILED = 'CONSTRAINT_FAILED',

  // System Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
}
```

## API Route Error Handling

### Standard Try-Catch Pattern

```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate input
    const body = await request.json();

    // 2. Validate required fields
    if (!body.requiredField) {
      return NextResponse.json(
        {
          error: 'Missing required field',
          code: 'MISSING_REQUIRED_FIELD',
          field: 'requiredField',
          suggestions: ['Please provide the requiredField'],
        },
        { status: 400 }
      );
    }

    // 3. Perform operation
    const result = await performOperation(body);

    // 4. Return success response
    return NextResponse.json(result);
  } catch (error) {
    // Handle specific error types
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return handlePrismaError(error);
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'VALIDATION_ERROR',
          field: error.field,
          suggestions: error.suggestions,
        },
        { status: 400 }
      );
    }

    // Log unexpected errors
    logger.error('Unexpected error in POST /api/resource', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      context: { body },
    });

    // Return generic error to user
    return NextResponse.json(
      {
        error: 'Unable to process your request',
        code: 'INTERNAL_ERROR',
        suggestions: [
          'Please try again',
          'Contact support if the problem persists',
        ],
      },
      { status: 500 }
    );
  }
}
```

### Prisma Error Handler

```typescript
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError) {
  switch (error.code) {
    case 'P2002': // Unique constraint violation
      const target = (error.meta?.target as string[]) || [];
      return NextResponse.json(
        {
          error: 'Duplicate entry',
          code: 'DUPLICATE_ENTRY',
          field: target[0],
          details: `A record with this ${target.join(', ')} already exists`,
          suggestions: [
            `Use a different ${target[0]}`,
            'Update the existing record instead',
          ],
        },
        { status: 409 }
      );

    case 'P2025': // Record not found
      return NextResponse.json(
        {
          error: 'Record not found',
          code: 'NOT_FOUND',
          suggestions: [
            'Check if the ID is correct',
            'The record may have been deleted',
          ],
        },
        { status: 404 }
      );

    case 'P2003': // Foreign key constraint failed
      const field = error.meta?.field_name as string;
      return NextResponse.json(
        {
          error: 'Invalid reference',
          code: 'CONSTRAINT_VIOLATION',
          field,
          details: 'Referenced record does not exist',
          suggestions: [
            'Check if the referenced record exists',
            'Create the referenced record first',
          ],
        },
        { status: 422 }
      );

    default:
      logger.error('Unhandled Prisma error', {
        code: error.code,
        meta: error.meta,
      });
      return NextResponse.json(
        {
          error: 'Database operation failed',
          code: 'DATABASE_ERROR',
          suggestions: [
            'Please try again',
            'Contact support if the problem persists',
          ],
        },
        { status: 500 }
      );
  }
}
```

## Client-Side Error Handling

### React Query Error Handling

```typescript
const { data, error, isError } = useQuery({
  queryKey: ['employees', id],
  queryFn: () => fetchEmployee(id),
  retry: (failureCount, error) => {
    // Retry only on network errors or 5xx errors
    if (error instanceof Error) {
      const status = (error as any).status;
      if (status >= 500) return failureCount < 3;
    }
    return false;
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});

if (isError) {
  return <ErrorDisplay error={error} />;
}
```

### Error Display Component

```typescript
interface ErrorDisplayProps {
  error: unknown;
  onRetry?: () => void;
  context?: string;
}

export function ErrorDisplay({ error, onRetry, context }: ErrorDisplayProps) {
  const errorMessage = error instanceof Error ? error.message : 'An error occurred';
  const apiError = (error as any)?.response?.data as ApiErrorResponse | undefined;

  return (
    <Alert
      variant="light"
      color="red"
      title={apiError?.error || 'Error'}
      icon={<IconAlertCircle />}
    >
      <Stack spacing="xs">
        {context && <Text size="sm" c="dimmed">{context}</Text>}
        <Text size="sm">{apiError?.details || errorMessage}</Text>

        {apiError?.suggestions && apiError.suggestions.length > 0 && (
          <Box>
            <Text size="sm" fw={500} mb={4}>Suggestions:</Text>
            <List size="sm">
              {apiError.suggestions.map((suggestion, i) => (
                <List.Item key={i}>{suggestion}</List.Item>
              ))}
            </List>
          </Box>
        )}

        {onRetry && (
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} />}
            onClick={onRetry}
          >
            Try Again
          </Button>
        )}
      </Stack>
    </Alert>
  );
}
```

## Form Validation Errors

### Mantine Form Integration

```typescript
form.validate();

if (form.errors) {
  // Display validation errors
  Object.entries(form.errors).forEach(([field, message]) => {
    notifications.show({
      title: 'Validation Error',
      message: `${field}: ${message}`,
      color: 'red',
      icon: <IconX />,
    });
  });
  return;
}
```

### Server-Side Validation Errors

```typescript
try {
  await createEmployee(formData);
} catch (error) {
  const apiError = (error as any)?.response?.data as ApiErrorResponse;

  if (apiError?.field) {
    // Set field-specific error
    form.setFieldError(apiError.field, apiError.error);
  } else {
    // Show general error
    notifications.show({
      title: 'Error',
      message: apiError?.error || 'Failed to create employee',
      color: 'red',
      icon: <IconX />,
    });
  }
}
```

## Logging Standards

### What to Log

```typescript
// SUCCESS - Info level
logger.info('Employee created successfully', {
  employeeId: employee.id,
  employeeCode: employee.code,
  department: employee.department,
});

// EXPECTED ERRORS - Warn level
logger.warn('Employee not found', {
  employeeId: requestedId,
  requestPath: request.url,
});

// UNEXPECTED ERRORS - Error level
logger.error('Failed to create employee', {
  error: error.message,
  stack: error.stack,
  context: {
    employeeData: body,
    userId: session?.user?.id,
    timestamp: new Date().toISOString(),
  },
});
```

### What NOT to Log

- ❌ Passwords or sensitive credentials
- ❌ Full credit card numbers
- ❌ Social security numbers
- ❌ Personal health information
- ❌ API keys or tokens

## Error Notifications

### Success Notifications

```typescript
notifications.show({
  title: 'Success',
  message: 'Employee created successfully',
  color: 'green',
  icon: <IconCheck />,
  autoClose: 3000,
});
```

### Error Notifications

```typescript
notifications.show({
  title: 'Error',
  message: 'Failed to create employee',
  color: 'red',
  icon: <IconX />,
  autoClose: 5000,
});
```

### Warning Notifications

```typescript
notifications.show({
  title: 'Warning',
  message: 'Employee data may be incomplete',
  color: 'yellow',
  icon: <IconAlertTriangle />,
  autoClose: 4000,
});
```

## Error Recovery Strategies

### Automatic Retry

```typescript
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function fetchWithRetry(
  url: string,
  retries = MAX_RETRIES
): Promise<Response> {
  try {
    const response = await fetch(url);

    if (!response.ok && response.status >= 500 && retries > 0) {
      // Retry on server errors
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, retries - 1);
    }

    return response;
  } catch (error) {
    if (retries > 0) {
      // Retry on network errors
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, retries - 1);
    }
    throw error;
  }
}
```

### Optimistic Updates with Rollback

```typescript
const updateEmployee = useMutation({
  mutationFn: updateEmployeeApi,
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['employees', id] });

    // Snapshot previous value
    const previousEmployee = queryClient.getQueryData(['employees', id]);

    // Optimistically update
    queryClient.setQueryData(['employees', id], newData);

    return { previousEmployee };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    if (context?.previousEmployee) {
      queryClient.setQueryData(['employees', id], context.previousEmployee);
    }

    notifications.show({
      title: 'Update Failed',
      message: 'Failed to update employee. Changes have been reverted.',
      color: 'red',
      icon: <IconX />,
    });
  },
  onSuccess: () => {
    notifications.show({
      title: 'Updated',
      message: 'Employee updated successfully',
      color: 'green',
      icon: <IconCheck />,
    });
  },
});
```

## Module-Level Error Boundaries

### Per-Module Error Boundary

```typescript
'use client';

export function EmployeesErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <Container size="sm" py="xl">
          <Alert
            variant="light"
            color="red"
            title="Employees Module Error"
            icon={<IconAlertCircle />}
          >
            <Text>
              There was an error loading the employees module. This may be due to:
            </Text>
            <List mt="sm" size="sm">
              <List.Item>Network connectivity issues</List.Item>
              <List.Item>Server maintenance</List.Item>
              <List.Item>Invalid data format</List.Item>
            </List>
            <Button
              mt="md"
              variant="light"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </Alert>
        </Container>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
```

## Checklist

When implementing error handling:

- [ ] Use standardized error response format
- [ ] Include user-friendly error messages
- [ ] Add machine-readable error codes
- [ ] Provide recovery suggestions
- [ ] Log errors with context
- [ ] Handle Prisma errors specifically
- [ ] Implement retry logic for transient errors
- [ ] Add error boundaries per module
- [ ] Display errors in user-friendly format
- [ ] Test error scenarios
- [ ] Never expose sensitive information
- [ ] Document custom error codes

## Resources

- Prisma Error Reference: https://www.prisma.io/docs/reference/api-reference/error-reference
- HTTP Status Codes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
- React Error Boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
