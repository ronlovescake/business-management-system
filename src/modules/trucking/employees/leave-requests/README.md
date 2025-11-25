# Leave Requests Module

This module handles all leave request operations for employees.

## 📁 Structure

```
leave-requests/
├── api/
│   ├── [id]/
│   │   └── route.ts          # Individual leave request operations (GET, DELETE)
│   ├── route.ts              # Collection operations (GET, POST, PUT, PATCH, DELETE)
│   ├── schemas.ts            # Zod validation schemas
│   ├── validation.ts         # Validation functions
│   ├── service.ts            # Business logic layer
│   └── repository.ts         # Data access layer
└── index.ts                  # Module exports
```

## 🔌 API Endpoints

### Collection Operations (`/api/leave-requests`)

- **GET** - List all leave requests (with optional filters)
- **POST** - Create single or batch leave requests
- **PUT** - Update multiple leave requests
- **PATCH** - Partial update of leave requests
- **DELETE** - Mass delete leave requests (with safety token)

### Individual Operations (`/api/leave-requests/[id]`)

- **GET** - Get single leave request by ID
- **DELETE** - Delete single leave request

## 🏗️ Architecture

This module follows a layered architecture:

1. **Route Layer** (`/app/api/leave-requests/`) - Next.js App Router endpoints (delegation only)
2. **Validation Layer** (`validation.ts`) - Zod-based request validation
3. **Service Layer** (`service.ts`) - Business logic and rules
4. **Repository Layer** (`repository.ts`) - Database operations
5. **Schema Layer** (`schemas.ts`) - Type definitions and validation schemas

## 📦 Usage

### Importing from the Module

```typescript
// Import service
import { leaveRequestService } from '@/modules/clothing/employees/leave-requests';

// Import repository
import { leaveRequestRepository } from '@/modules/clothing/employees/leave-requests';

// Import schemas
import { LeaveRequestCreateSchema } from '@/modules/clothing/employees/leave-requests';

// Import validation
import { validateCreateLeaveRequest } from '@/modules/clothing/employees/leave-requests';
```

### Using the Service

```typescript
import { leaveRequestService } from '@/modules/clothing/employees/leave-requests';

// Find all leave requests
const requests = await leaveRequestService.findMany();

// Find by employee
const employeeRequests = await leaveRequestService.findMany('EMP-001');

// Create many
const result = await leaveRequestService.createMany([...data]);

// Update one
await leaveRequestService.updateOne(id, updateData);

// Delete
await leaveRequestService.deleteAll(ids, confirmationToken);
```

## 🔐 Validation

All requests are validated using Zod schemas:

```typescript
import { LeaveRequestCreateSchema } from '@/modules/clothing/employees/leave-requests';

const result = LeaveRequestCreateSchema.safeParse(data);
if (!result.success) {
  // Handle validation errors
}
```

## 📝 Types

```typescript
// Inferred from Zod schemas
type LeaveRequestCreate = z.infer<typeof LeaveRequestCreateSchema>;
type LeaveRequestUpdate = z.infer<typeof LeaveRequestUpdateSchema>;

// Branded type for type-safe IDs
type LeaveRequestId = Brand<number, 'LeaveRequestId'>;
```

## 🎯 Next Steps

When authentication is implemented:

1. Add auth middleware to routes
2. Track user actions in audit log
3. Implement role-based permissions
