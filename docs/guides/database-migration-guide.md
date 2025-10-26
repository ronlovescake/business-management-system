# Database Migration Guide

Complete guide to managing database schema changes with Prisma.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Creating Migrations](#creating-migrations)
4. [Migration Best Practices](#migration-best-practices)
5. [Common Patterns](#common-patterns)
6. [Troubleshooting](#troubleshooting)
7. [Production Migrations](#production-migrations)

---

## Overview

We use **Prisma** as our ORM with PostgreSQL. Prisma handles:

- Schema definition (`schema.prisma`)
- Migration generation
- Type-safe database client
- Database seeding

### Migration Workflow

```
1. Modify schema.prisma
2. Generate migration
3. Review migration SQL
4. Apply to dev database
5. Test thoroughly
6. Commit migration files
7. Deploy to production
```

---

## Quick Start

### Create Your First Migration

1. **Modify the schema**:

   ```prisma
   // prisma/schema.prisma

   model YourEntity {
     id        Int      @id @default(autoincrement())
     name      String
     email     String   @unique
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
   }
   ```

2. **Generate migration**:

   ```bash
   npx prisma migrate dev --name add_your_entity
   ```

3. **Verify**:
   - Check `prisma/migrations/` for new folder
   - Review the generated SQL
   - Verify database was updated

That's it! Prisma generated the migration and applied it.

---

## Creating Migrations

### New Table

```prisma
model Product {
  id          Int      @id @default(autoincrement())
  code        String   @unique
  name        String
  description String?
  price       Decimal  @db.Decimal(10, 2)
  stock       Int      @default(0)
  category    String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
}
```

```bash
npx prisma migrate dev --name create_products_table
```

### Add Column

```prisma
model Employee {
  id          Int       @id @default(autoincrement())
  // ... existing fields ...
  phoneNumber String?   // ← Add this
  address     String?   // ← Add this
}
```

```bash
npx prisma migrate dev --name add_employee_contact_fields
```

### Add Relation

```prisma
model Order {
  id         Int      @id @default(autoincrement())
  customerId Int
  customer   Customer @relation(fields: [customerId], references: [id])
  items      OrderItem[]
  createdAt  DateTime @default(now())
}

model OrderItem {
  id        Int     @id @default(autoincrement())
  orderId   Int
  order     Order   @relation(fields: [orderId], references: [id])
  productId Int
  product   Product @relation(fields: [productId], references: [id])
  quantity  Int
  price     Decimal @db.Decimal(10, 2)
}

model Customer {
  id     Int     @id @default(autoincrement())
  name   String
  orders Order[]
}

model Product {
  id         Int         @id @default(autoincrement())
  name       String
  orderItems OrderItem[]
}
```

```bash
npx prisma migrate dev --name create_order_system
```

### Add Index

```prisma
model Transaction {
  id          Int      @id @default(autoincrement())
  customerId  Int
  productCode String
  date        DateTime

  @@index([customerId])           // Single field
  @@index([date])                 // Single field
  @@index([productCode, date])    // Composite
}
```

```bash
npx prisma migrate dev --name add_transaction_indexes
```

### Add Unique Constraint

```prisma
model Employee {
  id       Int    @id @default(autoincrement())
  email    String @unique           // Single field
  code     String @unique           // Single field

  @@unique([firstName, lastName])  // Composite
}
```

```bash
npx prisma migrate dev --name add_employee_unique_constraints
```

---

## Migration Best Practices

### DO ✅

1. **Name migrations descriptively**

   ```bash
   # ✅ Good
   npx prisma migrate dev --name add_employee_department_field
   npx prisma migrate dev --name create_payroll_table
   npx prisma migrate dev --name add_index_to_transactions_date

   # ❌ Bad
   npx prisma migrate dev --name update
   npx prisma migrate dev --name changes
   ```

2. **Review generated SQL before applying**

   ```bash
   # Generate migration without applying
   npx prisma migrate dev --create-only --name your_migration

   # Review the SQL in prisma/migrations/
   # Then apply:
   npx prisma migrate dev
   ```

3. **Test migrations in development**
   - Apply migration to dev database
   - Test all affected queries
   - Verify data integrity
   - Only then commit

4. **Keep migrations small and focused**

   ```bash
   # ✅ Good - separate migrations
   npx prisma migrate dev --name add_employee_email
   npx prisma migrate dev --name add_employee_phone

   # ❌ Bad - one huge migration
   npx prisma migrate dev --name update_entire_employee_model
   ```

5. **Always commit migration files**

   ```bash
   git add prisma/migrations/
   git commit -m "Add employee contact fields migration"
   ```

6. **Use appropriate field types**

   ```prisma
   // ✅ Good
   price    Decimal  @db.Decimal(10, 2)  // For money
   quantity Int                          // For counts
   rating   Float                        // For decimals

   // ❌ Bad
   price    String   // Don't use strings for numbers!
   ```

### DON'T ❌

1. **Don't edit migration files manually**
   - Let Prisma generate them
   - Exception: Complex data migrations (see below)

2. **Don't delete migrations**
   - Migrations are a history of your database
   - Once in production, never delete

3. **Don't rename models/fields carelessly**

   ```prisma
   // This will DROP and recreate the table!
   // Data will be lost!
   model Employee { ... }  // Old
   model Worker { ... }    // New (renamed)
   ```

   See "Renaming Safely" section below.

4. **Don't skip migration review**
   - Always read the generated SQL
   - Especially for production

---

## Common Patterns

### Pattern 1: Add Required Field with Default

When adding a NOT NULL field to a table with data:

```prisma
model Employee {
  id         Int      @id @default(autoincrement())
  // ... existing fields ...
  department String   @default("General")  // ← Set default
}
```

```bash
npx prisma migrate dev --name add_employee_department_with_default
```

The default ensures existing rows get a value.

### Pattern 2: Soft Delete Fields

Always include soft-delete support:

```prisma
model YourEntity {
  id        Int       @id @default(autoincrement())
  // ... other fields ...
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

### Pattern 3: Audit Fields

Standard audit trail:

```prisma
model YourEntity {
  id        Int       @id @default(autoincrement())
  // ... entity fields ...

  // Audit fields
  createdAt DateTime  @default(now())
  createdBy String?
  updatedAt DateTime  @updatedAt
  updatedBy String?
  deletedAt DateTime?
  deletedBy String?
}
```

### Pattern 4: Enum Types

```prisma
enum LeaveType {
  SICK
  VACATION
  PERSONAL
  BEREAVEMENT
  MATERNITY
  PATERNITY
}

model LeaveRequest {
  id     Int       @id @default(autoincrement())
  type   LeaveType
  status String    @default("pending")
}
```

```bash
npx prisma migrate dev --name add_leave_type_enum
```

### Pattern 5: JSON Fields

For flexible data:

```prisma
model Employee {
  id       Int   @id @default(autoincrement())
  name     String
  metadata Json? // Store arbitrary JSON
}
```

```bash
npx prisma migrate dev --name add_employee_metadata
```

Usage:

```typescript
await prisma.employee.create({
  data: {
    name: 'John',
    metadata: {
      skills: ['TypeScript', 'React'],
      certifications: ['AWS'],
    },
  },
});
```

### Pattern 6: Self-Referencing Relations

```prisma
model Employee {
  id         Int        @id @default(autoincrement())
  name       String
  managerId  Int?
  manager    Employee?  @relation("EmployeeManager", fields: [managerId], references: [id])
  subordinates Employee[] @relation("EmployeeManager")
}
```

---

## Advanced Patterns

### Renaming Safely

Renaming loses data by default. To preserve data:

**Step 1**: Create migration without applying

```bash
npx prisma migrate dev --create-only --name rename_employee_to_worker
```

**Step 2**: Edit the migration SQL

```sql
-- Instead of DROP/CREATE, use RENAME:
ALTER TABLE "Employee" RENAME TO "Worker";
ALTER TABLE "Worker" RENAME COLUMN "oldName" TO "newName";
```

**Step 3**: Apply migration

```bash
npx prisma migrate dev
```

### Data Migration

When you need to transform data during migration:

**Step 1**: Create migration

```bash
npx prisma migrate dev --create-only --name populate_employee_codes
```

**Step 2**: Add data transformation SQL

```sql
-- Migration SQL
ALTER TABLE "Employee" ADD COLUMN "code" VARCHAR(10);

-- Populate codes from ID
UPDATE "Employee"
SET "code" = 'EMP-' || LPAD(id::text, 4, '0')
WHERE "code" IS NULL;

-- Make it required
ALTER TABLE "Employee" ALTER COLUMN "code" SET NOT NULL;
```

**Step 3**: Apply

```bash
npx prisma migrate dev
```

### Complex Constraints

```prisma
model Attendance {
  id         Int      @id @default(autoincrement())
  employeeId Int
  date       DateTime

  // Prevent duplicate attendance per day
  @@unique([employeeId, date])

  // Index for queries
  @@index([date])
}
```

### Full-Text Search (PostgreSQL)

```prisma
model Product {
  id          Int    @id @default(autoincrement())
  name        String
  description String

  @@index([name, description], type: GIN) // Full-text search
}
```

---

## Troubleshooting

### Migration Failed: Column Already Exists

**Problem**: Migration tries to create existing column

**Solution**:

```bash
# Reset migrations (DEV ONLY!)
npx prisma migrate reset

# Or mark as applied without running:
npx prisma migrate resolve --applied <migration_name>
```

### Migration Failed: Cannot Add NOT NULL Column

**Problem**: Adding required field to table with data

**Solution**: Add with default or nullable first

```prisma
// Option 1: Add with default
field String @default("default_value")

// Option 2: Add as nullable, populate, then require
field String?
```

Then create second migration to make it required.

### Schema Drift Detected

**Problem**: Database doesn't match schema

**Solution**:

```bash
# Check status
npx prisma migrate status

# Reset database (DEV ONLY!)
npx prisma migrate reset

# Or create a migration to fix drift
npx prisma migrate dev --name fix_schema_drift
```

### Cannot Drop Table: Foreign Key Constraint

**Problem**: Can't delete model due to relations

**Solution**: Drop in correct order

```prisma
// First remove relations
model Order {
  // Remove: customerId, customer relation
}

// Then you can drop Customer
```

Or use CASCADE in custom SQL.

### Type Generation Out of Sync

**Problem**: TypeScript types don't match schema

**Solution**:

```bash
npx prisma generate
```

Run this after any schema change.

---

## Production Migrations

### Before Deploying

1. **Test migrations in staging**

   ```bash
   # In staging environment
   npx prisma migrate deploy
   ```

2. **Backup database**

   ```bash
   pg_dump your_database > backup_$(date +%Y%m%d).sql
   ```

3. **Review breaking changes**
   - Dropping columns/tables
   - Changing data types
   - Removing constraints

4. **Plan for downtime** (if needed)
   - Especially for large tables
   - Communicate to users

### Deploying Migrations

```bash
# Production deployment
npx prisma migrate deploy
```

This command:

- ✅ Applies pending migrations
- ✅ Doesn't prompt for confirmation
- ✅ Safe for CI/CD

### Zero-Downtime Migrations

For large tables, use multi-phase approach:

**Phase 1**: Add new column (nullable)

```prisma
model Employee {
  oldField String
  newField String?  // ← Add nullable
}
```

Deploy → No downtime

**Phase 2**: Populate data

```sql
UPDATE "Employee" SET "newField" = "oldField";
```

Deploy → Background job, no downtime

**Phase 3**: Make required, remove old

```prisma
model Employee {
  newField String  // ← Now required
  // Remove oldField
}
```

Deploy → No downtime (data already populated)

### Rollback Strategy

If migration fails:

```bash
# Restore from backup
psql your_database < backup_20250124.sql

# Or mark migration as rolled back
npx prisma migrate resolve --rolled-back <migration_name>
```

---

## Useful Commands

```bash
# Create and apply migration
npx prisma migrate dev --name migration_name

# Create migration without applying
npx prisma migrate dev --create-only --name migration_name

# Apply pending migrations (production)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Reset database (DEV ONLY - deletes all data!)
npx prisma migrate reset

# Generate Prisma Client (after schema changes)
npx prisma generate

# Open Prisma Studio (database GUI)
npx prisma studio

# Format schema file
npx prisma format

# Validate schema
npx prisma validate

# Create migration from existing database
npx prisma db pull
npx prisma migrate dev --name initial_migration
```

---

## Migration Checklist

Before creating a migration:

- [ ] Schema changes are minimal and focused
- [ ] Migration name is descriptive
- [ ] New fields have appropriate defaults (if required)
- [ ] Indexes added for frequently queried fields
- [ ] Relations are properly defined
- [ ] Soft-delete field included (deletedAt)
- [ ] Audit fields included (createdAt, updatedAt)

After creating a migration:

- [ ] Generated SQL reviewed
- [ ] Migration applied to dev database
- [ ] Prisma Client regenerated (`npx prisma generate`)
- [ ] Tests updated/added for new schema
- [ ] Service layer updated to use new fields
- [ ] Migration files committed to git
- [ ] Team notified of schema changes

Before production deployment:

- [ ] Migration tested in staging
- [ ] Database backed up
- [ ] Downtime planned (if needed)
- [ ] Rollback plan prepared
- [ ] Monitoring ready

---

## Related Documentation

- [New Module Checklist](./new-module-checklist.md)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [ADR-003: Repository Pattern](../architecture/003-repository-pattern.md)
- [ADR-004: Soft-Delete Pattern](../architecture/004-soft-delete-pattern.md)
