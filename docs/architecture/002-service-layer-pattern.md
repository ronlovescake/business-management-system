# ADR-002: Service Layer Pattern

**Date**: 2025-10-26  
**Status**: Accepted  
**Deciders**: Development Team

## Context

Initially, API route handlers contained a mix of concerns:

- HTTP request/response handling
- Input validation
- Business logic
- Database queries
- Error handling
- Logging

This led to several problems:

1. **Fat controllers**: Route handlers became hundreds of lines long
2. **Difficult to test**: Business logic was tightly coupled to HTTP layer
3. **Code duplication**: Similar logic repeated across multiple routes
4. **Hard to reuse**: Business logic couldn't be used outside API routes
5. **Poor separation**: All concerns mixed together

Example of problematic code:

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validation
    if (!body.employeeId || !body.startDate) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Business logic
    const employee = await prisma.employee.findUnique({
      where: { employeeId: body.employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // More business logic
    const overlapping = await prisma.leaveRequest.findMany({
      where: {
        employeeId: body.employeeId,
        // Complex date overlap logic...
      },
    });

    if (overlapping.length > 0) {
      return NextResponse.json({ error: 'Overlapping dates' }, { status: 409 });
    }

    // Database operation
    const result = await prisma.leaveRequest.create({ data: body });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

## Decision

We decided to introduce a **Service Layer** that sits between the API routes and the data layer.

### Architecture Layers

```
┌─────────────────────────────────────┐
│     API Routes (HTTP Layer)         │  ← Request/Response
├─────────────────────────────────────┤
│     Validation Layer                 │  ← Input validation
├─────────────────────────────────────┤
│     Service Layer (Business Logic)   │  ← Business rules ⭐
├─────────────────────────────────────┤
│     Repository Layer (Data Access)   │  ← Database queries
├─────────────────────────────────────┤
│     Database (Prisma ORM)           │  ← Persistence
└─────────────────────────────────────┘
```

### Service Class Structure

```typescript
export class EntityService {
  private repository: EntityRepository;

  // READ operations
  async findMany(filter?: Filter): Promise<Entity[]> {
    // Business logic + validation
    return this.repository.findMany(filter);
  }

  async findById(id: EntityId): Promise<Entity | null> {
    return this.repository.findById(id);
  }

  // CREATE operations
  async create(data: EntityCreate): Promise<Entity> {
    // Business validation
    await this.validateBusinessRules(data);

    // Delegate to repository
    return this.repository.create(data);
  }

  async createMany(data: EntityCreate[]): Promise<{ count: number }> {
    // Batch validation
    await this.validateBatch(data);

    return this.repository.createMany(data);
  }

  // UPDATE operations
  async update(id: EntityId, data: EntityUpdate): Promise<Entity> {
    // Business validation
    await this.validateUpdate(id, data);

    return this.repository.update(id, data);
  }

  // DELETE operations
  async delete(id: EntityId): Promise<void> {
    // Business logic (e.g., check dependencies)
    await this.checkDependencies(id);

    return this.repository.delete(id);
  }

  // Business logic methods
  private async validateBusinessRules(data: EntityCreate): Promise<void> {
    // Complex business validation
  }
}
```

## Consequences

### Positive

✅ **Separation of Concerns**: Business logic separated from HTTP and data access
✅ **Testability**: Services can be tested without HTTP layer or database
✅ **Reusability**: Business logic can be used from API routes, background jobs, CLI tools
✅ **Single Responsibility**: Each layer has one clear purpose
✅ **Maintainability**: Easier to modify business logic without touching routes
✅ **Consistency**: Business rules enforced in one place
✅ **Composition**: Services can call other services for complex workflows

### Negative

⚠️ **More files**: Additional layer means more files to manage
⚠️ **Learning curve**: Team needs to understand where code belongs
⚠️ **Overhead**: Simple CRUD might feel over-engineered

### Neutral

- Requires discipline to keep logic in the right layer
- Need clear guidelines on service responsibilities
- Service dependencies should be managed carefully

## Alternatives Considered

### Alternative 1: Fat Controllers (Status Quo)

Keep all logic in API route handlers.

**Rejected because**:

- Routes become 300+ lines long
- Business logic can't be tested independently
- Code duplication across routes
- Hard to maintain and modify
- Difficult for multiple developers to work on same feature

### Alternative 2: Anemic Services (Data Access Only)

Services only perform database operations, no business logic.

```typescript
class LeaveRequestService {
  async create(data) {
    return prisma.leaveRequest.create({ data });
  }

  async findAll() {
    return prisma.leaveRequest.findMany();
  }
}
```

**Rejected because**:

- Business logic still in route handlers
- Doesn't solve the main problem
- Just adds an extra layer without benefits
- Better to use repository pattern directly

### Alternative 3: Transaction Scripts

Organize by use cases rather than entities.

```typescript
class CreateLeaveRequestUseCase {
  async execute(data) {
    // Everything for this one use case
  }
}

class ApproveLeaveRequestUseCase {
  async execute(id) {
    // Everything for this one use case
  }
}
```

**Rejected because**:

- Creates many small classes
- Code duplication between use cases
- Harder to find common operations
- Can still use this pattern for complex workflows

## Implementation

### Service Layer Responsibilities

**Services SHOULD**:

- Implement business rules and validation
- Coordinate multiple repository operations
- Handle cross-entity operations
- Manage transactions
- Log business events
- Call external services

**Services SHOULD NOT**:

- Handle HTTP requests/responses (that's the route's job)
- Construct database queries (that's the repository's job)
- Format data for display (that's the component's job)
- Contain validation schemas (use separate validation layer)

### Example Implementation

```typescript
// service.ts
export class LeaveRequestService {
  private repository = leaveRequestRepository;

  async create(data: LeaveRequestCreate): Promise<LeaveRequest> {
    // 1. Validate employee exists
    const employee = await employeeRepository.findById(data.employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    // 2. Check for overlapping leave
    const overlapping = await this.repository.findOverlapping(
      data.employeeId,
      data.startDate,
      data.endDate
    );

    if (overlapping.length > 0) {
      throw new Error('Leave request overlaps with existing request');
    }

    // 3. Create the leave request
    return this.repository.create(data);
  }
}

// route.ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validation layer
    const validData = LeaveRequestCreateSchema.parse(body);

    // Service layer
    const result = await leaveRequestService.create(validData);

    // Response
    return ApiResponse.success(result, 'Leave request created');
  } catch (error) {
    return handleError(error);
  }
}
```

### Testing Services

Services can be tested independently:

```typescript
describe('LeaveRequestService', () => {
  it('should reject overlapping leave requests', async () => {
    // Mock repository
    const mockRepo = {
      findOverlapping: jest.fn().mockResolvedValue([existingLeave]),
      create: jest.fn(),
    };

    const service = new LeaveRequestService(mockRepo);

    await expect(service.create(overlappingData)).rejects.toThrow(
      'overlaps with existing'
    );

    expect(mockRepo.create).not.toHaveBeenCalled();
  });
});
```

## Benefits Observed

After implementing the service layer:

- **Route handlers reduced** from 200-300 lines to 30-50 lines
- **Business logic reused** in background jobs and CLI tools
- **Test coverage increased** from 40% to 85%
- **Bug fixes faster** - locate and fix in service, affects all consumers
- **Onboarding faster** - clear separation makes code easier to understand

## Migration Pattern

To migrate existing routes to use services:

1. **Extract business logic** from route handler into service methods
2. **Keep validation** in separate validation layer
3. **Make route handler thin** - just validation → service → response
4. **Write tests** for service methods
5. **Update documentation**

## Related Decisions

- [ADR-001: Module-Based Architecture](./001-module-based-architecture.md) - Services live within modules
- [ADR-003: Repository Pattern](./003-repository-pattern.md) - Services use repositories for data access
- [ADR-005: API Route Factory](./005-api-route-factory.md) - Factory integrates with service layer

## References

- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Patterns of Enterprise Application Architecture by Martin Fowler](https://martinfowler.com/books/eaa.html)
- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
