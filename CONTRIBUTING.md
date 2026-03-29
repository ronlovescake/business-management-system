# Contributing to Business Management System

Thank you for contributing! This guide will help you understand our coding standards, workflow, and best practices.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Coding Standards](#coding-standards)
4. [Architecture Principles](#architecture-principles)
5. [Testing Guidelines](#testing-guidelines)
6. [Git Workflow](#git-workflow)
7. [Code Review Process](#code-review-process)

---

## Getting Started

For the latest contributor quick-start commands, documentation entry points, and quality gates, check [README.md](README.md) first, then use [docs/README.md](docs/README.md) as the documentation hub.

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Git
- VS Code (recommended)

### Initial Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd business-management
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment**

   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Set up database**

   ```bash
  npm run db:generate
  npm run db:push
   ```

  Use `npx prisma migrate dev` only when you are intentionally creating or updating a migration in a safe local environment.

5. **Run development server**

   ```bash
   npm run dev
   ```

6. **Verify setup**

- Open http://localhost:5001
- Check that all pages load
- Run a quick baseline: `npm run test:unit`

---

## Development Workflow

### Before Starting Work

1. **Pull latest changes**

   ```bash
   git checkout main
   git pull origin main
   ```

2. **Create feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Check existing issues/tasks**
   - Review project board
   - Check for related issues
   - Communicate with team

### During Development

1. **Follow the architecture**
   - Use existing patterns
   - Read relevant ADRs
   - Check similar implementations

2. **Write tests**
   - Unit tests for services
   - Integration tests for APIs
   - Test edge cases

3. **Commit frequently**

   ```bash
   git add .
   git commit -m "feat: add feature description"
   ```

4. **Keep commits atomic**
   - One logical change per commit
   - Commit messages follow convention

### Before Submitting

1. **Run all checks**

   ```bash
  npm run guardrails:check
  npm run ci:quality
   ```

2. **Update documentation**
   - Update README if needed
   - Add/update comments
   - Update guides if relevant

3. **Self-review**
   - Review your own code
   - Check for console.logs
   - Verify formatting

---

## Coding Standards

### TypeScript

#### Use Strict Types

```typescript
// ✅ Good
interface User {
  id: number;
  name: string;
  email: string;
}

function getUser(id: number): Promise<User | null> {
  // ...
}

// ❌ Bad
function getUser(id: any): any {
  // ...
}
```

#### Avoid `any`

```typescript
// ✅ Good
function processData<T extends { id: number }>(data: T): T {
  return data;
}

// ❌ Bad
function processData(data: any): any {
  return data;
}
```

#### Use Type Inference When Obvious

```typescript
// ✅ Good
const name = 'John'; // TypeScript infers string
const items = users.map((u) => u.name); // Infers string[]

// ❌ Bad (unnecessary)
const name: string = 'John';
const items: string[] = users.map((u: User) => u.name);
```

#### Prefer Interfaces for Objects

```typescript
// ✅ Good
interface UserProps {
  name: string;
  age: number;
}

// Use type for unions/primitives
type Status = 'active' | 'inactive' | 'pending';
```

### Naming Conventions

#### Files and Folders

```
✅ Good:
src/modules/employees/leave-requests/api/route.ts
src/components/shared/CrudTable.tsx
src/types/api.ts

❌ Bad:
src/modules/employees/LeaveRequests/api/Route.ts
src/components/shared/crud-table.tsx
src/types/API.ts
```

Rules:

- **Folders**: kebab-case (`leave-requests`)
- **React Components**: PascalCase (`CrudTable.tsx`)
- **Other files**: camelCase (`service.ts`) or kebab-case (`api-utils.ts`)

#### Variables and Functions

```typescript
// ✅ Good
const userName = 'John';
const isActive = true;
const userCount = 10;

function calculateTotal(items: Item[]): number {}
function getUserById(id: number): User | null {}

// ❌ Bad
const UserName = 'John'; // Use camelCase
const active = true; // Not descriptive
const num = 10; // Vague

function calculate(items: Item[]): number {} // What are we calculating?
function get(id: number): User | null {} // Get what?
```

#### Classes and Interfaces

```typescript
// ✅ Good
class UserService {}
class LeaveRequestRepository {}
interface UserCreateInput {}
type ApiResponse<T> = {};

// ❌ Bad
class userService {} // Use PascalCase
class Leave_Request {} // No underscores
interface IUser {} // No "I" prefix
```

#### Constants

```typescript
// ✅ Good
const API_BASE_URL = 'https://api.example.com';
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_PAGE_SIZE = 50;

// ❌ Bad
const apiBaseUrl = 'https://api.example.com'; // Not a constant style
const max_retry = 3; // Mixed convention
```

### Code Organization

#### Import Order

```typescript
// 1. External dependencies
import { useEffect, useState } from 'react';
import { z } from 'zod';

// 2. Internal modules (absolute imports)
import { ApiResponse } from '@/core/api';
import { prisma } from '@/lib/prisma';

// 3. Relative imports
import { LeaveRequestService } from './service';
import type { LeaveRequest } from './types';
```

#### Export Patterns

```typescript
// ✅ Good - Named exports (preferred)
export const userService = new UserService();
export const calculateTotal = (items: Item[]) => {};

// ✅ Good - Export at declaration
export class UserService {}
export interface User {}

// ❌ Bad - Default exports (avoid)
export default UserService;
```

#### File Structure

```typescript
// 1. Imports
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

// 2. Types/Interfaces
export interface UserCreateInput {
  name: string;
  email: string;
}

// 3. Constants
const DEFAULT_PAGE_SIZE = 50;

// 4. Main code
export class UserService {
  // ...
}

// 5. Helper functions (if private)
function validateEmail(email: string): boolean {
  // ...
}
```

### React/Next.js Conventions

#### Component Structure

```typescript
// ✅ Good
'use client';

import { useState } from 'react';
import { Button } from '@mantine/core';
import type { User } from '@/types';

interface UserCardProps {
  user: User;
  onEdit: (user: User) => void;
}

export function UserCard({ user, onEdit }: UserCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleEdit = () => {
    setIsEditing(true);
    onEdit(user);
  };

  return (
    <div>
      <h3>{user.name}</h3>
      <Button onClick={handleEdit}>Edit</Button>
    </div>
  );
}
```

#### Hooks

```typescript
// ✅ Good
function useUser(id: number) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(id)
      .then(setUser)
      .finally(() => setLoading(false));
  }, [id]);

  return { user, loading };
}

// ❌ Bad
function getUser(id: number) {
  // Hooks must start with "use"
  const [user, setUser] = useState(null); // Missing type
  // ...
}
```

### Comments

#### When to Comment

```typescript
// ✅ Good - Explain WHY
// Use soft delete to preserve audit trail
await repository.softDelete(id);

// Calculate prorated amount based on work days
const amount = calculateProrated(salary, workDays);

// ❌ Bad - Explain WHAT (code already does this)
// Set user name to John
user.name = 'John';

// Loop through items
items.forEach((item) => {});
```

#### Documentation Comments

```typescript
/**
 * Calculate employee's monthly salary including overtime.
 *
 * @param employeeId - The employee's unique identifier
 * @param month - The month to calculate (1-12)
 * @param overtimeHours - Additional hours worked
 * @returns The total salary amount
 * @throws {NotFoundError} If employee doesn't exist
 */
export async function calculateMonthlySalary(
  employeeId: number,
  month: number,
  overtimeHours: number
): Promise<number> {
  // ...
}
```

### Error Handling

#### Always Handle Errors

```typescript
// ✅ Good
try {
  const result = await service.create(data);
  return ApiResponse.success(result);
} catch (error) {
  logger.error('Failed to create', { error, data });
  return ApiResponse.error('Failed to create resource', 500);
}

// ❌ Bad
const result = await service.create(data); // Unhandled promise
return ApiResponse.success(result);
```

#### Specific Error Types

```typescript
// ✅ Good
class NotFoundError extends Error {
  constructor(resource: string, id: number) {
    super(`${resource} with ID ${id} not found`);
    this.name = 'NotFoundError';
  }
}

if (!user) {
  throw new NotFoundError('User', id);
}

// ❌ Bad
if (!user) {
  throw new Error('not found'); // Too generic
}
```

---

## Architecture Principles

### Layered Architecture

Always follow this flow:

```
API Route → Validation → Service → Repository → Database
```

**Never**:

- Access database directly from route
- Put business logic in routes
- Call repository from components

### Module Structure

```
src/modules/domain/feature/
  ├── api/
  │   ├── route.ts           # API endpoint
  │   ├── service.ts         # Business logic
  │   ├── repository.ts      # Data access
  │   ├── schemas.ts         # Validation
  │   └── types.ts           # Types
  ├── components/
  │   ├── FeatureTable.tsx
  │   └── FeatureForm.tsx
  └── hooks/
      └── useFeature.ts
```

### Service Layer Responsibilities

```typescript
// ✅ Good - Service handles business logic
class LeaveRequestService {
  async create(data: LeaveRequestCreateInput): Promise<LeaveRequest> {
    // 1. Validation
    this.validateLeaveRequest(data);

    // 2. Business rules
    if (await this.hasOverlappingLeave(data)) {
      throw new ConflictError('Overlapping leave request exists');
    }

    // 3. Orchestration
    const request = await this.repository.create(data);
    await this.notificationService.sendLeaveRequestNotification(request);

    return request;
  }
}

// ❌ Bad - Logic in route
export async function POST(request: NextRequest) {
  const data = await request.json();

  // Business logic should be in service!
  if (data.startDate > data.endDate) {
    return ApiResponse.badRequest('Invalid dates');
  }

  const result = await repository.create(data);
  return ApiResponse.success(result);
}
```

### Repository Pattern

```typescript
// ✅ Good - Repository only handles data access
class LeaveRequestRepository extends BaseRepository<LeaveRequest> {
  constructor() {
    super(prisma.leaveRequest);
  }

  async findByEmployeeId(employeeId: number): Promise<LeaveRequest[]> {
    return this.model.findMany({
      where: { employeeId, deletedAt: null },
    });
  }

  async findOverlapping(
    employeeId: number,
    startDate: Date,
    endDate: Date
  ): Promise<LeaveRequest[]> {
    return this.model.findMany({
      where: {
        employeeId,
        deletedAt: null,
        OR: [
          { startDate: { lte: endDate }, endDate: { gte: startDate } },
        ],
      },
    });
  }
}

// ❌ Bad - Repository with business logic
async findByEmployeeId(employeeId: number): Promise<LeaveRequest[]> {
  const requests = await this.model.findMany({ ... });

  // Don't do business logic here!
  const validRequests = requests.filter(r => r.status === 'approved');
  return validRequests;
}
```

---

## Testing Guidelines

### Unit Tests

Test services and utilities:

```typescript
// src/modules/employees/leave-requests/api/__tests__/service.test.ts

import { describe, it, expect, vi } from 'vitest';
import { LeaveRequestService } from '../service';

describe('LeaveRequestService', () => {
  const mockRepository = {
    create: vi.fn(),
    findById: vi.fn(),
  };

  const service = new LeaveRequestService(mockRepository);

  it('should create leave request', async () => {
    const input = {
      employeeId: 1,
      type: 'VACATION',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-05'),
    };

    mockRepository.create.mockResolvedValue({ id: 1, ...input });

    const result = await service.create(input);

    expect(result).toBeDefined();
    expect(result.id).toBe(1);
    expect(mockRepository.create).toHaveBeenCalledWith(input);
  });
});
```

### Integration Tests

Test API endpoints:

```typescript
// src/modules/employees/leave-requests/api/__tests__/route.test.ts

import { describe, it, expect } from 'vitest';
import { POST } from '../route';

describe('POST /api/leave-requests', () => {
  it('should create leave request', async () => {
    const request = new Request('http://localhost/api/leave-requests', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 1,
        type: 'VACATION',
        startDate: '2025-01-01',
        endDate: '2025-01-05',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.type).toBe('VACATION');
  });

  it('should reject invalid data', async () => {
    const request = new Request('http://localhost/api/leave-requests', {
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

### Test Coverage

Aim for:

- **Services**: 80%+ coverage
- **Repositories**: 70%+ coverage
- **API Routes**: 60%+ coverage
- **Critical paths**: 100% coverage

---

## Git Workflow

### Branch Naming

```bash
# ✅ Good
feature/add-employee-dashboard
fix/leave-request-validation
chore/update-dependencies
docs/add-api-guide

# ❌ Bad
my-changes
update
fix
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# ✅ Good
feat: add employee dashboard
fix: resolve leave request validation error
docs: update API guide
chore: update dependencies
refactor: extract validation logic to service
test: add unit tests for payroll service

# ❌ Bad
updated code
fixes
WIP
asdfasdf
```

Format:

```
<type>: <description>

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, missing semi colons, etc
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

### Pull Request Process

1. **Create PR with description**
   - What changed
   - Why it changed
   - How to test

2. **Link to issue** (if applicable)

3. **Request review** from team member

4. **Address feedback**
   - Make requested changes
   - Reply to comments
   - Re-request review

5. **Merge after approval**
   - Squash commits if many small ones
   - Use merge commit for features

---

## Code Review Process

### As Author

- ✅ Self-review before requesting
- ✅ Write clear PR description
- ✅ Respond to all comments
- ✅ Don't take feedback personally
- ✅ Ask questions if unclear

### As Reviewer

- ✅ Review within 24 hours
- ✅ Be constructive and specific
- ✅ Approve if minor issues only
- ✅ Request changes if major concerns
- ✅ Use "Request changes" or "Approve" clearly

### Review Checklist

- [ ] Code follows style guide
- [ ] Tests are included
- [ ] Documentation updated
- [ ] No console.logs left
- [ ] Error handling present
- [ ] Types are correct
- [ ] Performance considered
- [ ] Security considered

---

## Common Patterns

Use these current entry points instead of older guide links:

- [docs/README.md](docs/README.md) for the maintained documentation hub
- [docs/BUSINESS_LOGIC_INDEX.md](docs/BUSINESS_LOGIC_INDEX.md) for domain/workspace business logic docs
- [README.md](README.md) for current commands, scripts, and environment expectations
- [docs/DEBUGGING.md](docs/DEBUGGING.md) for debugger and regression workflows
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for host-neutral deployment guidance

---

## Questions?

- Check [docs/README.md](docs/README.md)
- Read [Repo-Wide Analysis — Business Management System.md](Repo-Wide%20Analysis%20%E2%80%94%20Business%20Management%20System.md)
- Read [docs/BUSINESS_LOGIC_INDEX.md](docs/BUSINESS_LOGIC_INDEX.md)
- Ask in team chat
- Create a discussion issue

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Mantine UI](https://mantine.dev/)
- [Conventional Commits](https://www.conventionalcommits.org/)

Additional repo-specific references:

- [README.md](README.md)
- [docs/README.md](docs/README.md)
- [docs/REPO_VERIFIED_EXEC_SUMMARY_2026-03-29.md](docs/REPO_VERIFIED_EXEC_SUMMARY_2026-03-29.md)

---

**Thank you for contributing! 🎉**
