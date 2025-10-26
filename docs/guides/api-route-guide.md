# API Route Guide

Complete guide to creating and maintaining API endpoints in the Business Management System.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Using the API Route Factory](#using-the-api-route-factory)
4. [Custom Route Handlers](#custom-route-handlers)
5. [Validation](#validation)
6. [Error Handling](#error-handling)
7. [Testing APIs](#testing-apis)
8. [Best Practices](#best-practices)

---

## Overview

We use a layered architecture for API routes:

```
API Route (HTTP) → Validation → Service (Business Logic) → Repository (Data Access) → Database
```

The **API Route Factory** automates most of this, generating CRUD endpoints with validation, error handling, and logging.

---

## Quick Start

### Method 1: Using API Route Factory (Recommended)

Create a full CRUD API in **5 minutes**:

```typescript
// src/modules/your-domain/your-entity/api/route.ts

import { createCrudRoutes } from '@/core/api';
import { yourEntityService } from './service';
import { YourEntityCreateSchema, YourEntityUpdateSchema } from './schemas';

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: yourEntityService,
  schemas: {
    create: YourEntityCreateSchema,
    update: YourEntityUpdateSchema,
  },
  resourceName: 'YourEntity',
});
```

That's it! You now have:

- ✅ GET /api/your-entities (list all)
- ✅ POST /api/your-entities (create single or batch)
- ✅ PUT /api/your-entities (update single or batch)
- ✅ DELETE /api/your-entities (delete single or batch)

All with validation, error handling, and logging built-in.

### Method 2: Custom Route Handler

For routes with unique requirements:

```typescript
import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { yourEntityService } from './service';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const data = await yourEntityService.findMany();
    return ApiResponse.success(data);
  } catch (error) {
    logger.error('GET failed', { error });
    return ApiResponse.error('Failed to fetch data', 500);
  }
}
```

---

## Using the API Route Factory

### Basic Configuration

```typescript
export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: yourEntityService,
  schemas: {
    create: YourEntityCreateSchema,
    update: YourEntityUpdateSchema,
  },
  resourceName: 'YourEntity', // Used in error messages
});
```

### With Batch Operations

```typescript
export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: yourEntityService,
  schemas: {
    create: YourEntityCreateSchema,
    update: YourEntityUpdateSchema,
    batchCreate: z.array(YourEntityCreateSchema).max(10000),
    batchUpdate: z.array(YourEntityUpdateSchema).max(10000),
  },
  resourceName: 'YourEntity',
});
```

### With Custom GET Handler

```typescript
export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: yourEntityService,
  schemas: { create: YourEntityCreateSchema },
  resourceName: 'YourEntity',

  // Custom GET with search
  customGet: async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');

    const results = await yourEntityService.search({
      search,
      category,
    });

    return ApiResponse.success(results);
  },
});
```

### With Response Transformation

```typescript
export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: userService,
  schemas: { create: UserCreateSchema },
  resourceName: 'User',

  // Hide sensitive fields
  transformResponse: (data) => {
    const transform = ({ password, resetToken, ...user }) => user;
    return Array.isArray(data) ? data.map(transform) : transform(data);
  },
});
```

### Override Specific Routes

```typescript
// Get most routes from factory
const { GET, POST, PUT } = createCrudRoutes({
  service: yourEntityService,
  schemas: { create: YourEntityCreateSchema },
  resourceName: 'YourEntity',
});

export { GET, POST, PUT };

// Custom DELETE with extra protection
export async function DELETE(request: NextRequest) {
  const confirmation = validateMassDeleteConfirmation(request);
  if (confirmation) return confirmation;

  const result = await yourEntityService.deleteAll();
  return ApiResponse.success(result);
}
```

---

## Custom Route Handlers

### GET - List Resources

```typescript
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Call service
    const data = await service.findMany({
      status,
      limit,
      offset,
    });

    // Return response
    return ApiResponse.success(data);
  } catch (error) {
    logger.error('GET failed', { error });
    return ApiResponse.error('Failed to fetch resources', 500);
  }
}
```

### POST - Create Resource

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate
    const validation = CreateSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.reduce(
        (acc, err) => ({ ...acc, [err.path.join('.')]: err.message }),
        {}
      );
      return ApiResponse.badRequest('Validation failed', errors);
    }

    // Create
    const result = await service.create(validation.data);

    return ApiResponse.success(result, 'Created successfully');
  } catch (error) {
    logger.error('POST failed', { error });
    return ApiResponse.error('Failed to create resource', 500);
  }
}
```

### PUT - Update Resource

```typescript
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return ApiResponse.badRequest('ID is required');
    }

    // Validate
    const validation = UpdateSchema.safeParse(data);
    if (!validation.success) {
      const errors = validation.error.errors.reduce(
        (acc, err) => ({ ...acc, [err.path.join('.')]: err.message }),
        {}
      );
      return ApiResponse.badRequest('Validation failed', errors);
    }

    // Update
    const result = await service.update(id, validation.data);

    if (!result) {
      return ApiResponse.notFound('Resource');
    }

    return ApiResponse.success(result, 'Updated successfully');
  } catch (error) {
    logger.error('PUT failed', { error });
    return ApiResponse.error('Failed to update resource', 500);
  }
}
```

### DELETE - Delete Resource

```typescript
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return ApiResponse.badRequest('ID is required');
    }

    // Delete
    await service.delete(id);

    return ApiResponse.success({ id }, 'Deleted successfully');
  } catch (error) {
    logger.error('DELETE failed', { error });
    return ApiResponse.error('Failed to delete resource', 500);
  }
}
```

---

## Validation

### Using Zod Schemas

Define schemas in `api/schemas.ts`:

```typescript
import { z } from 'zod';

export const YourEntityCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  age: z.number().int().min(18, 'Must be at least 18'),
  status: z.enum(['active', 'inactive']).default('active'),
  tags: z.array(z.string()).optional(),
});

export type YourEntityCreate = z.infer<typeof YourEntityCreateSchema>;
```

### Validating in Routes

#### Option 1: Factory (Automatic)

```typescript
export const { POST } = createCrudRoutes({
  service: yourEntityService,
  schemas: {
    create: YourEntityCreateSchema, // Automatic validation
  },
  resourceName: 'YourEntity',
});
```

#### Option 2: Manual

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();

  const validation = YourEntityCreateSchema.safeParse(body);

  if (!validation.success) {
    const errors = validation.error.errors.reduce(
      (acc, err) => ({ ...acc, [err.path.join('.')]: err.message }),
      {}
    );
    return ApiResponse.badRequest('Validation failed', errors);
  }

  const result = await service.create(validation.data);
  return ApiResponse.success(result);
}
```

### Complex Validation

```typescript
export const UserCreateSchema = z
  .object({
    email: z.string().email(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain uppercase letter')
      .regex(/[0-9]/, 'Must contain number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
```

---

## Error Handling

### Using ApiResponse Utilities

```typescript
import { ApiResponse } from '@/core/api';

// Success (200)
return ApiResponse.success(data);
return ApiResponse.success(data, 'Operation completed');

// Bad Request (400)
return ApiResponse.badRequest('Invalid input');
return ApiResponse.badRequest('Validation failed', {
  email: 'Invalid format',
  age: 'Must be a number',
});

// Not Found (404)
return ApiResponse.notFound('User');

// Conflict (409)
return ApiResponse.conflict('Email already exists', undefined, 'email');

// Server Error (500)
return ApiResponse.error('Internal server error', 500);

// Unauthorized (401)
return ApiResponse.unauthorized();

// Forbidden (403)
return ApiResponse.forbidden();

// Too Many Requests (429)
return ApiResponse.tooManyRequests(60); // Retry after 60 seconds

// Payload Too Large (413)
return ApiResponse.payloadTooLarge(15000, 10000);
```

### Error Response Format

All errors follow this structure:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional context (optional)",
  "validationErrors": {
    "field": "Error for this field"
  },
  "field": "problemField",
  "suggestion": "How to fix this"
}
```

### Logging Errors

```typescript
import { logger } from '@/lib/logger';

try {
  // Operation
} catch (error) {
  // Log with context
  logger.error('Operation failed', {
    error,
    userId: request.userId,
    operation: 'create',
  });

  return ApiResponse.error('Failed to complete operation', 500);
}
```

---

## Testing APIs

### Manual Testing with curl

```bash
# GET - List
curl http://localhost:3000/api/your-entities

# GET - With query params
curl "http://localhost:3000/api/your-entities?status=active&limit=10"

# POST - Create
curl -X POST http://localhost:3000/api/your-entities \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","description":"Testing"}'

# PUT - Update
curl -X PUT http://localhost:3000/api/your-entities \
  -H "Content-Type: application/json" \
  -d '{"id":1,"name":"Updated"}'

# DELETE - Delete
curl -X DELETE http://localhost:3000/api/your-entities \
  -H "Content-Type: application/json" \
  -d '{"id":1}'
```

### Testing with Postman/Thunder Client

1. Create a collection for your API
2. Add requests for each endpoint
3. Set up environment variables
4. Test success and error cases

### Integration Tests

```typescript
import { describe, it, expect } from 'vitest';
import { POST } from './route';

describe('YourEntity API', () => {
  it('should create an entity', async () => {
    const request = new Request('http://localhost/api/your-entities', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test',
        description: 'Test description',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('Test');
  });

  it('should reject invalid data', async () => {
    const request = new Request('http://localhost/api/your-entities', {
      method: 'POST',
      body: JSON.stringify({
        // Missing required fields
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });
});
```

---

## Best Practices

### DO ✅

1. **Use the factory** for standard CRUD APIs

   ```typescript
   export const { GET, POST } = createCrudRoutes({ ... });
   ```

2. **Validate all input** with Zod schemas

   ```typescript
   const validation = Schema.safeParse(data);
   ```

3. **Log errors** with context

   ```typescript
   logger.error('Failed', { error, userId, operation });
   ```

4. **Use ApiResponse utilities** for consistency

   ```typescript
   return ApiResponse.success(data);
   return ApiResponse.badRequest('Invalid');
   ```

5. **Handle errors gracefully**

   ```typescript
   try {
     // operation
   } catch (error) {
     logger.error('Failed', { error });
     return ApiResponse.error('Failed', 500);
   }
   ```

6. **Keep routes thin** - business logic in service layer

   ```typescript
   // In route: just validation → service → response
   // In service: business logic, validation, orchestration
   ```

7. **Return appropriate status codes**
   - 200: Success
   - 201: Created (not needed with factory)
   - 400: Bad request (validation)
   - 404: Not found
   - 409: Conflict
   - 500: Server error

### DON'T ❌

1. **Don't put business logic in routes**

   ```typescript
   // ❌ Bad
   export async function POST(request) {
     const data = await request.json();
     // ... complex business logic here ...
     return response;
   }

   // ✅ Good
   export async function POST(request) {
     const data = await request.json();
     const result = await service.create(data); // Logic in service
     return ApiResponse.success(result);
   }
   ```

2. **Don't access database directly from routes**

   ```typescript
   // ❌ Bad
   const data = await prisma.entity.findMany();

   // ✅ Good
   const data = await service.findMany();
   ```

3. **Don't skip validation**

   ```typescript
   // ❌ Bad
   const data = await service.create(body); // Unvalidated!

   // ✅ Good
   const validation = Schema.safeParse(body);
   if (!validation.success) return ApiResponse.badRequest(...);
   ```

4. **Don't return inconsistent responses**

   ```typescript
   // ❌ Bad
   return NextResponse.json({ data });

   // ✅ Good
   return ApiResponse.success(data);
   ```

5. **Don't ignore errors**

   ```typescript
   // ❌ Bad
   try {
     await service.create(data);
   } catch (error) {
     // Silent failure
   }

   // ✅ Good
   try {
     await service.create(data);
   } catch (error) {
     logger.error('Failed', { error });
     return ApiResponse.error('Failed', 500);
   }
   ```

---

## Common Patterns

### Pattern 1: List with Filters

```typescript
export const { GET } = createCrudRoutes({
  service: yourEntityService,
  resourceName: 'YourEntity',

  customGet: async (request) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const data = await service.findMany({ status, search });
    return ApiResponse.success(data);
  },
});
```

### Pattern 2: Create with File Upload

```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const data = JSON.parse(formData.get('data') as string);

  // Validate
  const validation = Schema.safeParse(data);
  if (!validation.success) {
    return ApiResponse.badRequest('Invalid data');
  }

  // Upload file
  const fileUrl = await uploadFile(file);

  // Create entity
  const result = await service.create({
    ...validation.data,
    fileUrl,
  });

  return ApiResponse.success(result);
}
```

### Pattern 3: Batch Operations

```typescript
export const { POST } = createCrudRoutes({
  service: yourEntityService,
  schemas: {
    create: YourEntityCreateSchema,
    batchCreate: z.array(YourEntityCreateSchema).max(10000),
  },
  resourceName: 'YourEntity',
});

// Automatically supports:
// Single: POST { name: "..." }
// Batch:  POST [{ name: "..." }, { name: "..." }]
```

### Pattern 4: Pagination

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  const { data, total } = await service.findPaginated({
    page,
    limit,
  });

  return ApiResponse.paginated(data, { page, limit, total });
}
```

---

## Troubleshooting

### Route not found (404)

**Problem**: API route returns 404

**Solutions**:

1. Check file is in `app/api/` directory
2. Verify file is named `route.ts`
3. Check exports are named `GET`, `POST`, etc.
4. Restart Next.js dev server

### Validation not working

**Problem**: Invalid data not rejected

**Solutions**:

1. Verify schema is passed to factory
2. Check schema definition is correct
3. Ensure using `safeParse`, not `parse`
4. Test schema independently

### TypeScript errors

**Problem**: Type errors in route file

**Solutions**:

1. Import types from `'next/server'`
2. Use `NextRequest` for request parameter
3. Check service types match schema types
4. Run `npm run type-check`

---

## Related Documentation

- [New Module Checklist](./new-module-checklist.md)
- [ADR-005: API Route Factory](../architecture/005-api-route-factory.md)
- [ADR-002: Service Layer Pattern](../architecture/002-service-layer-pattern.md)
- [Core API README](../../src/core/api/README.md)
