# New Module Checklist

Complete step-by-step guide to create a new feature module.

## Overview

This checklist walks you through creating a new module following our established patterns. Estimated time: 30-45 minutes.

## Prerequisites

- [ ] Understand the feature requirements
- [ ] Have a clear entity/resource name (e.g., "Invoice", "Payment", "Order")
- [ ] Know the database schema needed
- [ ] Reviewed [ADR-001: Module-Based Architecture](../architecture/001-module-based-architecture.md)

---

## Step 1: Database Schema (5-10 min)

### 1.1 Update Prisma Schema

Edit `prisma/schema.prisma`:

```prisma
model YourEntity {
  id          Int       @id @default(autoincrement())
  // Your fields here
  name        String
  description String?
  status      String    @default("active")

  // Soft-delete (recommended)
  deletedAt   DateTime?

  // Timestamps (recommended)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Indexes
  @@index([deletedAt])
  @@index([status, deletedAt])
}
```

**Tips**:

- Use `@unique` for unique constraints
- Add `deletedAt` for soft-delete support
- Create indexes for commonly queried fields
- Use proper field types (String, Int, DateTime, Boolean, Decimal)

### 1.2 Create Migration

```bash
npx prisma migrate dev --name add-your-entity
```

### 1.3 Generate Prisma Client

```bash
npx prisma generate
```

**✓ Checkpoint**: Run `npx prisma studio` to verify the table was created.

---

## Step 2: Create Module Directory (2 min)

### 2.1 Create Directory Structure

```bash
mkdir -p src/modules/{domain}/{subdomain}/{entity}/api
```

Example:

```bash
mkdir -p src/modules/clothing/sales/invoices/api
```

### 2.2 Create Required Files

```bash
cd src/modules/{domain}/{subdomain}/{entity}

# API layer
touch api/route.ts
touch api/schemas.ts
touch api/validation.ts
touch api/service.ts
touch api/repository.ts

# Module exports
touch index.ts
touch README.md
```

**✓ Checkpoint**: Directory structure created with empty files.

---

## Step 3: Create Validation Schemas (5-10 min)

Edit `api/schemas.ts`:

```typescript
/**
 * YourEntity Validation Schemas
 *
 * Zod schemas for runtime validation
 */

import { z } from 'zod';

/**
 * Schema for creating a new entity
 */
export const YourEntityCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  // Add your fields...
});

export type YourEntityCreate = z.infer<typeof YourEntityCreateSchema>;

/**
 * Schema for updating an entity
 */
export const YourEntityUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  // Add your fields...
});

export type YourEntityUpdate = z.infer<typeof YourEntityUpdateSchema>;

/**
 * Schema for batch create operations
 */
export const YourEntityBatchCreateSchema = z
  .array(YourEntityCreateSchema)
  .min(1, 'At least one entity is required')
  .max(10000, 'Maximum 10,000 records per batch');

/**
 * Schema for entity with ID (response)
 */
export const YourEntitySchema = YourEntityCreateSchema.extend({
  id: z.number().positive(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deletedAt: z.string().nullable().optional(),
});

export type YourEntity = z.infer<typeof YourEntitySchema>;
```

**✓ Checkpoint**: Schemas compile without errors.

---

## Step 4: Create Repository (10-15 min)

Edit `api/repository.ts`:

```typescript
/**
 * YourEntity Repository
 *
 * Data access layer for YourEntity
 */

import { prisma } from '@/lib/db';
import { BaseRepository } from '@/core/database/repository';
import type { Prisma } from '@prisma/client';
import type { YourEntity } from './schemas';

/**
 * Repository for YourEntity operations
 *
 * Extends BaseRepository with custom query methods
 */
export class YourEntityRepository extends BaseRepository<
  YourEntity,
  Prisma.YourEntityWhereInput,
  Prisma.YourEntityCreateInput,
  Prisma.YourEntityUpdateInput
> {
  protected model = 'yourEntity';
  protected delegate = prisma.yourEntity;

  /**
   * Find entities by status
   */
  async findByStatus(status: string): Promise<YourEntity[]> {
    return this.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Search entities by name
   */
  async search(query: string): Promise<YourEntity[]> {
    return this.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
  }> {
    const [total, active, inactive] = await Promise.all([
      this.count(),
      this.count({ status: 'active' }),
      this.count({ status: 'inactive' }),
    ]);

    return { total, active, inactive };
  }
}

// Export singleton instance
export const yourEntityRepository = new YourEntityRepository();
```

**✓ Checkpoint**: Repository compiles, methods are type-safe.

---

## Step 5: Create Service Layer (10-15 min)

Edit `api/service.ts`:

````typescript
/**
 * YourEntity Service
 *
 * Business logic for YourEntity operations
 */

import { logger } from '@/lib/logger';
import type { YourEntityCreate, YourEntityUpdate, YourEntity } from './schemas';
import { yourEntityRepository } from './repository';

/**
 * Service class for YourEntity business logic
 *
 * @example
 * ```typescript
 * const entity = await yourEntityService.create(data);
 * ```
 */
export class YourEntityService {
  private repository = yourEntityRepository;

  /**
   * Get all entities, optionally filtered
   */
  async findMany(filter?: { status?: string }): Promise<YourEntity[]> {
    try {
      if (filter?.status) {
        return await this.repository.findByStatus(filter.status);
      }
      return await this.repository.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to fetch entities:', error);
      throw new Error('Failed to fetch entities');
    }
  }

  /**
   * Get entity by ID
   */
  async findById(id: number): Promise<YourEntity | null> {
    try {
      return await this.repository.findById(id);
    } catch (error) {
      logger.error('Failed to fetch entity:', error);
      throw new Error('Failed to fetch entity');
    }
  }

  /**
   * Create a new entity
   */
  async create(data: YourEntityCreate): Promise<YourEntity> {
    try {
      // Business validation
      await this.validateCreate(data);

      // Create entity
      const entity = await this.repository.create(data);

      logger.info('Entity created', { id: entity.id, name: entity.name });
      return entity;
    } catch (error) {
      logger.error('Failed to create entity:', error);
      throw error;
    }
  }

  /**
   * Create multiple entities (batch)
   */
  async createMany(data: YourEntityCreate[]): Promise<{ count: number }> {
    try {
      // Validate batch
      await this.validateBatch(data);

      const result = await this.repository.createMany(data);

      logger.info('Entities created (batch)', { count: result.count });
      return result;
    } catch (error) {
      logger.error('Failed to create entities (batch):', error);
      throw error;
    }
  }

  /**
   * Update an entity
   */
  async update(id: number, data: YourEntityUpdate): Promise<YourEntity> {
    try {
      // Verify exists
      const existing = await this.repository.findById(id);
      if (!existing) {
        throw new Error('Entity not found');
      }

      // Business validation
      await this.validateUpdate(id, data);

      const updated = await this.repository.update(id, data);

      logger.info('Entity updated', { id });
      return updated;
    } catch (error) {
      logger.error('Failed to update entity:', error);
      throw error;
    }
  }

  /**
   * Delete an entity (soft-delete if enabled)
   */
  async delete(id: number): Promise<void> {
    try {
      // Verify exists
      const existing = await this.repository.findById(id);
      if (!existing) {
        throw new Error('Entity not found');
      }

      // Check dependencies
      await this.checkDependencies(id);

      await this.repository.delete(id);

      logger.warn('Entity deleted', { id });
    } catch (error) {
      logger.error('Failed to delete entity:', error);
      throw error;
    }
  }

  /**
   * Delete all entities
   */
  async deleteAll(): Promise<{ count: number }> {
    try {
      const result = await this.repository.deleteMany();

      logger.warn('All entities deleted', { count: result.count });
      return result;
    } catch (error) {
      logger.error('Failed to delete all entities:', error);
      throw error;
    }
  }

  /**
   * Search entities
   */
  async search(query: string): Promise<YourEntity[]> {
    try {
      return await this.repository.search(query);
    } catch (error) {
      logger.error('Failed to search entities:', error);
      throw new Error('Failed to search entities');
    }
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    try {
      return await this.repository.getStatistics();
    } catch (error) {
      logger.error('Failed to get statistics:', error);
      throw new Error('Failed to get statistics');
    }
  }

  // Private helper methods

  private async validateCreate(data: YourEntityCreate): Promise<void> {
    // Add business validation logic
    // Example: Check for duplicates, validate relationships, etc.
  }

  private async validateBatch(data: YourEntityCreate[]): Promise<void> {
    // Validate each item
    for (const item of data) {
      await this.validateCreate(item);
    }
  }

  private async validateUpdate(
    id: number,
    data: YourEntityUpdate
  ): Promise<void> {
    // Add update validation logic
  }

  private async checkDependencies(id: number): Promise<void> {
    // Check if entity has dependent records
    // Throw error if dependencies exist
  }
}

// Export singleton instance
export const yourEntityService = new YourEntityService();
````

**✓ Checkpoint**: Service compiles, all methods are implemented.

---

## Step 6: Create API Routes (5 min)

Edit `api/route.ts`:

```typescript
/**
 * YourEntity API Routes
 *
 * Uses API Route Factory for CRUD operations
 */

import { createCrudRoutes } from '@/core/api';
import { yourEntityService } from './service';
import {
  YourEntityCreateSchema,
  YourEntityUpdateSchema,
  YourEntityBatchCreateSchema,
} from './schemas';

/**
 * CRUD routes for YourEntity
 *
 * GET    /api/your-entities - List all
 * POST   /api/your-entities - Create one or many
 * PUT    /api/your-entities - Update one or many
 * DELETE /api/your-entities - Delete one or many
 */
export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: yourEntityService,
  schemas: {
    create: YourEntityCreateSchema,
    update: YourEntityUpdateSchema,
    batchCreate: YourEntityBatchCreateSchema,
  },
  resourceName: 'YourEntity',
});

/**
 * PATCH endpoint for single record updates
 */
export { PATCH } from './route.patch';
```

**Optional**: Create `api/route.patch.ts` for custom PATCH logic.

**✓ Checkpoint**: Routes compile without errors.

---

## Step 7: Create Next.js API Route (2 min)

Create `app/api/your-entities/route.ts`:

```typescript
/**
 * Next.js API Route for YourEntity
 *
 * Delegates to module implementation
 */

export {
  GET,
  POST,
  PUT,
  PATCH,
  DELETE,
} from '@/modules/{domain}/{subdomain}/{entity}/api/route';
```

**✓ Checkpoint**: API endpoint accessible at `/api/your-entities`.

---

## Step 8: Create Module Exports (3 min)

Edit `index.ts`:

```typescript
/**
 * YourEntity Module
 *
 * Public API exports
 */

// Services
export { yourEntityService, YourEntityService } from './api/service';

// Repository
export { yourEntityRepository, YourEntityRepository } from './api/repository';

// Types
export type {
  YourEntity,
  YourEntityCreate,
  YourEntityUpdate,
} from './api/schemas';

// Schemas (for external validation)
export {
  YourEntitySchema,
  YourEntityCreateSchema,
  YourEntityUpdateSchema,
} from './api/schemas';
```

**✓ Checkpoint**: Module can be imported from other code.

---

## Step 9: Add to Soft-Delete (Optional, 2 min)

If using soft-delete, edit `src/core/database/middleware/soft-delete.ts`:

```typescript
const SOFT_DELETE_MODELS = new Set([
  'employee',
  'transaction',
  'yourEntity', // Add your model here
  // ... other models
]);
```

**✓ Checkpoint**: Soft-delete working for your entity.

---

## Step 10: Create Module Documentation (5 min)

Edit `README.md`:

```markdown
# YourEntity Module

Brief description of what this module does.

## Features

- Create and manage entities
- Search and filter
- Statistics and reporting

## API Endpoints

### List Entities

\`\`\`
GET /api/your-entities
Query: ?status=active
\`\`\`

### Create Entity

\`\`\`
POST /api/your-entities
Body: { name: "...", description: "..." }
\`\`\`

### Update Entity

\`\`\`
PUT /api/your-entities
Body: { id: 123, name: "..." }
\`\`\`

### Delete Entity

\`\`\`
DELETE /api/your-entities
Body: { id: 123 }
\`\`\`

## Usage

\`\`\`typescript
import { yourEntityService } from '@/modules/{domain}/{subdomain}/{entity}';

// Create
const entity = await yourEntityService.create({
name: 'Example',
description: 'Description here'
});

// List
const entities = await yourEntityService.findMany();

// Search
const results = await yourEntityService.search('query');
\`\`\`

## Database Schema

See \`prisma/schema.prisma\` for the complete schema.

## Related Modules

- [Related Module 1](../related-module/)
- [Related Module 2](../related-module/)
```

**✓ Checkpoint**: Module is documented.

---

## Step 11: Test the API (5-10 min)

### 11.1 Manual Testing

Use your API client (Postman, Thunder Client, curl):

```bash
# List (should return empty array)
curl http://localhost:3000/api/your-entities

# Create
curl -X POST http://localhost:3000/api/your-entities \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Entity","description":"Testing"}'

# List again (should return created entity)
curl http://localhost:3000/api/your-entities

# Update
curl -X PUT http://localhost:3000/api/your-entities \
  -H "Content-Type: application/json" \
  -d '{"id":1,"name":"Updated Name"}'

# Delete
curl -X DELETE http://localhost:3000/api/your-entities \
  -H "Content-Type: application/json" \
  -d '{"id":1}'
```

### 11.2 Check for Errors

```bash
# Check TypeScript compilation
npm run type-check

# Check for lint errors
npm run lint
```

**✓ Checkpoint**: All CRUD operations working, no errors.

---

## Step 12: Final Checklist

Before considering the module complete:

- [ ] All TypeScript errors resolved
- [ ] All CRUD operations tested and working
- [ ] Validation schemas comprehensive
- [ ] Business logic in service layer
- [ ] Repository has necessary query methods
- [ ] Soft-delete enabled (if applicable)
- [ ] Module exports configured
- [ ] README.md created with documentation
- [ ] API routes delegated from app/api
- [ ] No console.log statements left behind
- [ ] Code follows existing patterns
- [ ] Indexes added to database schema

---

## Next Steps

### Optional Enhancements

1. **Add Frontend Page**
   - Create page in `app/(dashboard)/your-entities/page.tsx`
   - Use CRUD components for quick UI

2. **Add Tests**
   - Unit tests for service methods
   - Integration tests for API routes

3. **Add Advanced Features**
   - Pagination
   - Advanced filtering
   - Export to CSV
   - Bulk operations

### Related Guides

- [API Route Guide](./api-route-guide.md)
- [Database Migration Guide](./database-migration-guide.md)
- [Testing Guide](./testing-guide.md)

---

## Troubleshooting

### "Model not found" error

- Run `npx prisma generate` to regenerate Prisma client

### TypeScript errors in repository

- Ensure model name matches Prisma schema exactly (case-sensitive)
- Check that Prisma types are imported correctly

### API route not found

- Verify delegation file in `app/api/` directory
- Check that exports match route handler names
- Restart Next.js dev server

### Soft-delete not working

- Verify model added to SOFT_DELETE_MODELS
- Check middleware is applied in `lib/db.ts`
- Ensure `deletedAt` field exists in schema

---

## Time Estimate

- **Minimum (basic CRUD)**: 30-45 minutes
- **With all optional features**: 2-3 hours
- **Including tests**: Add 1-2 hours

## Tips for Success

1. **Start with schema** - Get the database right first
2. **Use existing module as template** - Copy from leave-requests module
3. **Test incrementally** - Test each layer as you build it
4. **Follow naming conventions** - Consistency matters
5. **Document as you go** - Don't leave it for later

---

**Congratulations!** 🎉 You've created a new module following all best practices!
