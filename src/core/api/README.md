# Core API Utilities

Centralized utilities for creating consistent, type-safe API routes with minimal boilerplate.

## Overview

The Core API module provides:

- **ApiResponse**: Standardized response utilities
- **API Route Factory**: Generate CRUD routes automatically
- **Type-safe Patterns**: Full TypeScript support

## Quick Start

### 1. Using the API Route Factory

```typescript
// In your module's API route file
import { createCrudRoutes } from '@/core/api';
import { leaveRequestService } from './service';
import { LeaveRequestCreateSchema, LeaveRequestUpdateSchema } from './schemas';

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: leaveRequestService,
  schemas: {
    create: LeaveRequestCreateSchema,
    update: LeaveRequestUpdateSchema,
  },
  resourceName: 'Leave Request',
});
```

That's it! You now have fully functional CRUD endpoints with:

- ✅ Validation (using Zod)
- ✅ Error handling
- ✅ Consistent responses
- ✅ Logging
- ✅ Batch operations support

### 2. Using ApiResponse Utilities

```typescript
import { ApiResponse } from '@/core/api';

// Success response
return ApiResponse.success(data, 'Operation successful');

// Error response
return ApiResponse.error('Something went wrong', 500);

// Not found
return ApiResponse.notFound('User');

// Validation error
return ApiResponse.badRequest('Validation failed', {
  email: 'Invalid email format',
  age: 'Must be at least 18',
});

// Paginated response
return ApiResponse.paginated(items, {
  page: 1,
  limit: 50,
  total: 150,
});
```

## API Route Factory

### Configuration Options

```typescript
interface CrudRouteConfig<T, TCreate, TUpdate> {
  /** Service instance with CRUD methods */
  service: CrudService<T, TCreate, TUpdate>;

  /** Zod validation schemas */
  schemas: {
    create?: ZodSchema<TCreate>;
    update?: ZodSchema<TUpdate>;
    batchCreate?: ZodSchema;
    batchUpdate?: ZodSchema;
  };

  /** Resource name for error messages (e.g., "Leave Request") */
  resourceName: string;

  /** Custom GET handler (overrides default) */
  customGet?: (request: NextRequest) => Promise<NextResponse>;

  /** Custom POST handler (overrides default) */
  customPost?: (request: NextRequest) => Promise<NextResponse>;

  /** Custom PUT handler (overrides default) */
  customPut?: (request: NextRequest) => Promise<NextResponse>;

  /** Custom DELETE handler (overrides default) */
  customDelete?: (request: NextRequest) => Promise<NextResponse>;

  /** Transform response data before sending */
  transformResponse?: (data: T | T[]) => unknown;
}
```

### Service Interface

Your service must implement this interface:

```typescript
interface CrudService<T, TCreate, TUpdate> {
  findMany: (filter?: unknown) => Promise<T[]>;
  findById?: (id: string | number) => Promise<T | null>;
  create?: (data: TCreate) => Promise<T>;
  createMany?: (data: TCreate[]) => Promise<{ count: number }>;
  update?: (id: string | number, data: TUpdate) => Promise<T>;
  updateMany?: (
    ids: (string | number)[],
    data: TUpdate
  ) => Promise<{ count: number }>;
  delete?: (id: string | number) => Promise<void>;
  deleteMany?: (ids: (string | number)[]) => Promise<{ count: number }>;
}
```

**Note**: Only `findMany` is required. Other methods are optional and will return 405 if not implemented.

### Generated Routes

#### GET - List Resources

```typescript
GET /api/resource
GET /api/resource?filter={"status":"active"}

Response:
{
  "success": true,
  "data": [...]
}
```

#### POST - Create Resource(s)

```typescript
// Single create
POST /api/resource
Body: { "name": "John", ... }

// Batch create
POST /api/resource
Body: [
  { "name": "John", ... },
  { "name": "Jane", ... }
]

Response:
{
  "success": true,
  "data": { ... } | { "count": 2 },
  "message": "Created successfully"
}
```

#### PUT - Update Resource(s)

```typescript
// Single update
PUT /api/resource
Body: { "id": "123", "name": "John Updated" }

// Batch update
PUT /api/resource
Body: [
  { "id": "123", "name": "Updated" },
  { "id": "456", "name": "Also Updated" }
]

Response:
{
  "success": true,
  "data": { ... } | { "count": 2 },
  "message": "Updated successfully"
}
```

#### DELETE - Delete Resource(s)

```typescript
// Single delete
DELETE /api/resource
Body: { "id": "123" }

// Batch delete
DELETE /api/resource
Body: ["123", "456", "789"]

Response:
{
  "success": true,
  "message": "Deleted successfully"
}
```

### Custom Handlers

You can override any default handler:

```typescript
export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: userService,
  schemas: { create: UserCreateSchema },
  resourceName: 'User',

  // Custom GET with search functionality
  customGet: async (request) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const users = await userService.search(search);
    return ApiResponse.success(users);
  },

  // Transform response to hide sensitive data
  transformResponse: (data) => {
    if (Array.isArray(data)) {
      return data.map(({ password, ...user }) => user);
    }
    const { password, ...user } = data;
    return user;
  },
});
```

## Single Resource Routes

For routes like `/api/resource/[id]`:

```typescript
import { createSingleResourceRoutes } from '@/core/api';

export const { GET, PUT, DELETE } = createSingleResourceRoutes({
  service: userService,
  schema: UserUpdateSchema,
  resourceName: 'User',
});
```

This creates:

- `GET /api/resource/[id]` - Get by ID
- `PUT /api/resource/[id]` - Update by ID
- `DELETE /api/resource/[id]` - Delete by ID

## ApiResponse Methods

### Success Responses

```typescript
// Basic success
ApiResponse.success(data);

// With message
ApiResponse.success(data, 'Operation completed');

// With custom status
ApiResponse.success(data, 'Created', 201);
```

### Error Responses

```typescript
// Generic error
ApiResponse.error('Something went wrong', 500);

// With details
ApiResponse.error('Failed', 500, 'Database connection timeout');

// Not found
ApiResponse.notFound('User');

// Bad request with validation errors
ApiResponse.badRequest('Validation failed', {
  email: 'Invalid format',
  age: 'Must be a number',
});

// Unauthorized
ApiResponse.unauthorized('Please log in');

// Forbidden
ApiResponse.forbidden('Admin access required');

// Conflict
ApiResponse.conflict(
  'Email already exists',
  'A user with this email exists',
  'email'
);

// Payload too large
ApiResponse.payloadTooLarge(15000, 10000);

// Rate limit
ApiResponse.tooManyRequests(60); // Retry after 60 seconds
```

### Specialized Responses

```typescript
// Paginated response
ApiResponse.paginated(items, {
  page: 1,
  limit: 50,
  total: 150,
});

// Batch operation
ApiResponse.batch(45, 'Processed 45 items', [
  { index: 5, error: 'Invalid data' },
]);
```

## Benefits

### Before (Manual Route)

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validation
    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Create
    const user = await prisma.user.create({ data: body });

    return NextResponse.json({
      success: true,
      data: user,
      message: 'User created',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
```

### After (Factory)

```typescript
export const { POST } = createCrudRoutes({
  service: userService,
  schemas: { create: UserCreateSchema },
  resourceName: 'User',
});
```

**Result**: 90% less boilerplate! ✨

## Best Practices

1. **Always use validation schemas** - Catch errors early
2. **Implement service layer** - Keep business logic separate
3. **Use transformResponse** - Hide sensitive data
4. **Log appropriately** - Logging is built-in
5. **Handle errors** - The factory catches common errors
6. **Document your API** - Clear resource names help

## Migration Guide

To migrate existing routes to use the factory:

1. **Create service layer** (if not exists)
2. **Create validation schemas**
3. **Replace route handlers** with factory
4. **Test thoroughly**
5. **Add custom handlers** if needed

See the leave-requests module for a complete example.

## Related

- [BaseRepository](../database/repository/README.md) - Data access layer
- [Service Layer Pattern](../../docs/architecture/service-layer.md)
- [Module Structure](../../docs/architecture/module-structure.md)
