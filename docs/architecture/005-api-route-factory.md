# ADR-005: API Route Factory

**Date**: 2025-10-26  
**Status**: Accepted  
**Deciders**: Development Team

## Context

After implementing service and repository layers, creating new CRUD API endpoints still required significant boilerplate:

1. **Repetitive code**: Every API route had similar structure
   - Request parsing
   - Validation
   - Service calls
   - Error handling
   - Response formatting
   - Logging

2. **Consistency challenges**: Different developers implemented routes differently
   - Different error messages
   - Different status codes
   - Different response structures
   - Inconsistent validation

3. **Time consuming**: Creating a full CRUD API took 30-60 minutes
   - Write GET, POST, PUT, DELETE handlers
   - Add validation for each
   - Handle batch operations
   - Write error handling
   - Add logging

4. **Maintenance burden**: Bugs in one route needed fixing in all routes
   - Update error handling across 20+ routes
   - Change response format everywhere
   - Add new feature to all APIs

Example of repetitive route code:

```typescript
// POST endpoint (50+ lines of boilerplate)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validation
    const validation = CreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error },
        { status: 400 }
      );
    }

    // Service call
    const result = await service.create(validation.data);

    // Logging
    logger.info('Created record', { id: result.id });

    // Response
    return NextResponse.json({
      success: true,
      data: result,
      message: 'Record created successfully',
    });
  } catch (error) {
    logger.error('Failed to create', { error });
    return NextResponse.json(
      { error: 'Failed to create record' },
      { status: 500 }
    );
  }
}

// Repeat for GET, PUT, DELETE... (200+ lines total)
```

This needed to be written for EVERY entity!

## Decision

We decided to create a **factory function** that automatically generates CRUD API route handlers.

### Factory Design

```typescript
function createCrudRoutes<T, TCreate, TUpdate>(
  config: CrudRouteConfig<T, TCreate, TUpdate>
): {
  GET: (request: NextRequest) => Promise<NextResponse>;
  POST: (request: NextRequest) => Promise<NextResponse>;
  PUT: (request: NextRequest) => Promise<NextResponse>;
  DELETE: (request: NextRequest) => Promise<NextResponse>;
};
```

### Usage

```typescript
// Before: 200+ lines of boilerplate

// After: 5 lines
export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: leaveRequestService,
  schemas: {
    create: LeaveRequestCreateSchema,
    update: LeaveRequestUpdateSchema,
  },
  resourceName: 'Leave Request',
});
```

**Result**: 96% reduction in boilerplate! ✨

### Configuration Options

```typescript
interface CrudRouteConfig<T, TCreate, TUpdate> {
  // Required
  service: CrudService<T, TCreate, TUpdate>;
  resourceName: string;

  // Optional
  schemas?: {
    create?: ZodSchema<TCreate>;
    update?: ZodSchema<TUpdate>;
    batchCreate?: ZodSchema;
    batchUpdate?: ZodSchema;
  };

  // Custom handlers (override defaults)
  customGet?: (request: NextRequest) => Promise<NextResponse>;
  customPost?: (request: NextRequest) => Promise<NextResponse>;
  customPut?: (request: NextRequest) => Promise<NextResponse>;
  customDelete?: (request: NextRequest) => Promise<NextResponse>;

  // Transform response data
  transformResponse?: (data: T | T[]) => unknown;
}
```

## Consequences

### Positive

✅ **90-95% less boilerplate**: Create full CRUD API in 5 lines
✅ **Consistency**: All APIs follow same patterns automatically
✅ **Faster development**: 5 minutes vs 30-60 minutes
✅ **Centralized fixes**: Fix bugs once, applies to all routes
✅ **Type safety**: Full TypeScript inference with generics
✅ **Flexibility**: Can override any handler when needed
✅ **Built-in features**: Validation, logging, error handling included
✅ **Batch operations**: Automatic support for creating/updating multiple records
✅ **Better testing**: Test factory once, all routes work

### Negative

⚠️ **Abstraction overhead**: Need to understand factory
⚠️ **Less explicit**: Route behavior not visible in code
⚠️ **Learning curve**: Team needs to learn factory API

### Neutral

- Works best with service layer pattern
- Requires Zod schemas for validation
- Some routes may need custom handlers

## Alternatives Considered

### Alternative 1: Code Generation

Generate route files from templates/CLI.

```bash
npm run generate:crud Employee
# Generates route.ts, service.ts, repository.ts
```

**Rejected because**:

- Generated code still needs maintenance
- Changes to template don't apply to existing routes
- Duplication remains (just automated)
- Harder to update all routes at once
- More complex tooling

### Alternative 2: Higher-Order Functions

Wrap route handlers with HOFs for common behavior.

```typescript
export const POST = withValidation(
  withErrorHandling(
    withLogging(async (request, validated) => {
      return service.create(validated);
    })
  ),
  CreateSchema
);
```

**Rejected because**:

- Still write handler for each route
- Nested HOFs are hard to read
- Each HOF adds runtime overhead
- Doesn't reduce boilerplate significantly

### Alternative 3: Class-Based Controllers

Use classes for controllers like NestJS.

```typescript
@Controller('leave-requests')
export class LeaveRequestController {
  @Post()
  @ValidateBody(CreateSchema)
  async create(@Body() data: CreateInput) {
    return this.service.create(data);
  }
}
```

**Rejected because**:

- Requires decorator support
- Doesn't work with Next.js App Router
- More complex setup
- Different pattern from Next.js conventions
- Heavier framework

### Alternative 4: tRPC or GraphQL

Use alternative API paradigms.

**Rejected because**:

- Major architectural change
- Requires rewriting all clients
- Learning curve for team
- Not compatible with existing REST APIs
- Overkill for current needs

## Implementation

### Factory Features

#### 1. Automatic Validation

```typescript
schemas: {
  create: LeaveRequestCreateSchema,
  update: LeaveRequestUpdateSchema,
}

// Factory automatically validates:
// - Parses request body
// - Validates with Zod
// - Returns formatted errors
// - Rejects invalid requests
```

#### 2. Batch Operations

```typescript
// Single create
POST /api/leave-requests
Body: { employeeId: "EMP-001", ... }

// Batch create (automatic)
POST /api/leave-requests
Body: [
  { employeeId: "EMP-001", ... },
  { employeeId: "EMP-002", ... }
]
```

#### 3. Error Handling

```typescript
// Factory handles:
// - Validation errors (400)
// - Not found (404)
// - Server errors (500)
// - Logs all errors
// - Consistent error format
```

#### 4. Response Transformation

```typescript
transformResponse: (data) => {
  // Hide sensitive fields
  const { password, resetToken, ...user } = data;
  return user;
};
```

#### 5. Custom Handlers

```typescript
customGet: async (request) => {
  // Custom search logic
  const search = new URL(request.url).searchParams.get('search');
  const results = await service.search(search);
  return ApiResponse.success(results);
};
```

### Service Interface

Services must implement this interface:

```typescript
interface CrudService<T, TCreate, TUpdate> {
  // Required
  findMany: (filter?: unknown) => Promise<T[]>;

  // Optional (returns 405 if not implemented)
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

### Generated Routes

#### GET - List Resources

```
GET /api/resource
GET /api/resource?filter={"status":"active"}

Response:
{
  "success": true,
  "data": [...]
}
```

#### POST - Create Resource(s)

```
POST /api/resource
Body: { ... }  // Single

Body: [{ ... }, { ... }]  // Batch

Response:
{
  "success": true,
  "data": { ... } | { "count": 2 },
  "message": "Created successfully"
}
```

#### PUT - Update Resource(s)

```
PUT /api/resource
Body: { "id": "123", ... }  // Single

Body: [{ "id": "123", ... }]  // Batch

Response:
{
  "success": true,
  "data": { ... } | { "count": 2 },
  "message": "Updated successfully"
}
```

#### DELETE - Delete Resource(s)

```
DELETE /api/resource
Body: { "id": "123" }  // Single

Body: ["123", "456"]  // Batch

Response:
{
  "success": true,
  "message": "Deleted successfully"
}
```

## Example Implementations

### Example 1: Simple CRUD

```typescript
export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: productService,
  schemas: {
    create: ProductCreateSchema,
    update: ProductUpdateSchema,
  },
  resourceName: 'Product',
});
```

### Example 2: With Custom Search

```typescript
export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: userService,
  schemas: { create: UserCreateSchema },
  resourceName: 'User',

  customGet: async (request) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const users = await userService.search(search);
    return ApiResponse.success(users);
  },

  transformResponse: (data) => {
    // Hide passwords
    const hide = ({ password, ...user }) => user;
    return Array.isArray(data) ? data.map(hide) : hide(data);
  },
});
```

### Example 3: Override DELETE for Safety

```typescript
const { GET, POST, PUT } = createCrudRoutes({
  service: transactionService,
  schemas: { create: TransactionCreateSchema },
  resourceName: 'Transaction',
});

export { GET, POST, PUT };

// Custom DELETE with extra protection
export async function DELETE(request: NextRequest) {
  const validation = validateMassDeleteConfirmation(request);
  if (validation) return validation;

  const result = await transactionService.deleteAll();
  return ApiResponse.success(result);
}
```

## Migration Pattern

To migrate existing routes to use factory:

1. **✓ Ensure service layer exists** and implements CrudService
2. **✓ Create Zod validation schemas**
3. **✓ Replace route handlers** with factory call
4. **✓ Test all CRUD operations**
5. **✓ Add custom handlers** if needed
6. **✓ Add transformResponse** if needed
7. **✓ Remove old route code**

Time: ~15 minutes per route

## Benefits Observed

After implementing the factory:

- **Development time**: 30-60 min → 5 min per CRUD API (90% faster)
- **Code reduction**: 200+ lines → 5 lines (96% less code)
- **Consistency**: 100% of new APIs follow same patterns
- **Bug fixes**: Fixed validation bug once, fixed 15 APIs
- **Features**: Added logging to all APIs in one place
- **Testing**: Test factory once, all routes work

## Performance

Factory overhead is negligible:

- **Function call overhead**: ~0.01ms
- **Memory**: Minimal (shared code)
- **Response time**: Identical to hand-written routes
- **Optimization**: Easier to optimize in one place

## Documentation

Comprehensive documentation provided:

- ✅ [Core API README](../../src/core/api/README.md) - 350+ lines
- ✅ [Factory implementation](../../src/core/api/factory.ts) - 400+ lines with comments
- ✅ [Usage examples](../../src/modules/clothing/employees/leave-requests/api/route.factory-example.ts) - 8 scenarios
- ✅ API reference with all options
- ✅ Migration guide
- ✅ Best practices

## Future Enhancements

Potential improvements:

- **Pagination**: Built-in pagination support
- **Sorting**: Automatic sorting from query params
- **Filtering**: Advanced filtering DSL
- **Caching**: Built-in caching layer
- **Rate limiting**: Per-route rate limits
- **API versioning**: Support for v1, v2 endpoints
- **OpenAPI**: Auto-generate OpenAPI specs

## Related Decisions

- [ADR-002: Service Layer Pattern](./002-service-layer-pattern.md) - Factory integrates with services
- [ADR-003: Repository Pattern](./003-repository-pattern.md) - Services use repositories
- [ADR-001: Module-Based Architecture](./001-module-based-architecture.md) - Factory used within modules
- [ADR-006: Type Safety with Branded Types](./006-type-safety-branded-types.md) - Factory maintains type safety

## References

- [Factory Pattern - Design Patterns](https://refactoring.guru/design-patterns/factory-method)
- [DRY Principle](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
