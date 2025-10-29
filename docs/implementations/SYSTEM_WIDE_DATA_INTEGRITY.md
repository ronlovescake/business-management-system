# 🧱 System-Wide Data Integrity Blueprint

**Last Updated:** October 23, 2025  
**Status:** Production-Ready Framework

---

## Purpose

To ensure every database table enforces correctness, recoverability, and auditability from the start of development.

---

## ⚙️ 1. Schema-Level Constraints

| Rule                  | Recommended Constraint                                                   | Benefit                         |
| --------------------- | ------------------------------------------------------------------------ | ------------------------------- |
| **Required fields**   | `NOT NULL` on essential columns (name, email, amount, etc.)              | Prevents incomplete records     |
| **Uniqueness**        | `UNIQUE` on identifiers (email, code, transactionId)                     | Avoids duplicates               |
| **Valid ranges**      | `CHECK (quantity >= 0)`, `CHECK (price >= 0)`                            | Prevents invalid numbers        |
| **Relationships**     | `FOREIGN KEY (customerId) REFERENCES customers(id)`                      | Maintains referential integrity |
| **Enum-type columns** | Use database enums or `CHECK (status IN ('Pending','Paid','Cancelled'))` | Enforces valid states           |
| **Timestamps**        | `createdAt TIMESTAMP DEFAULT NOW()`, `updatedAt TIMESTAMP`               | Built-in traceability           |
| **Numeric precision** | `DECIMAL(10,2)` for money fields                                         | Prevents rounding errors        |
| **Default values**    | `DEFAULT` for flags or counters (`isActive DEFAULT true`)                | Simplifies inserts              |

---

## 🔒 2. Data Access Protection

| Layer                      | Protection                                  | Description                                 |
| -------------------------- | ------------------------------------------- | ------------------------------------------- |
| **Application middleware** | JWT or session validation                   | Only authenticated users may read/write     |
| **Authorization**          | Role-based checks (admin, manager, user)    | Prevents unauthorized edits                 |
| **Rate limiting**          | 100–200 requests/min per IP                 | Protects against abuse and accidental loops |
| **Connection handling**    | Use connection pool / Prisma `$transaction` | Ensures atomic bulk writes                  |

---

## ♻️ 3. Safe Modification Patterns

### **Use transactions for batch updates**

```typescript
await prisma.$transaction(batchOps);
```

→ All-or-nothing guarantee.

### **Soft-delete instead of hard delete**

```sql
UPDATE "Table" SET "deletedAt" = NOW() WHERE id = $1;
```

→ Records recoverable later.

### **Require explicit confirmation for destructive operations**

`?confirm=DELETE_ALL` or admin-only routes.

### **Use pre-validation before writes**

- Check IDs exist
- Reject invalid data types
- Abort entire batch on single failure

---

## 🧾 4. Audit & Logging

| Type                 | Content                         | Purpose                            |
| -------------------- | ------------------------------- | ---------------------------------- |
| **Change logs**      | Before/after snapshots          | Restore data if corrupted          |
| **Operation logs**   | User ID, action type, timestamp | For accountability                 |
| **Mass delete logs** | Record count + reason           | Alert admins for review            |
| **Error logs**       | API and DB errors               | Early detection of systemic issues |

---

## 🧮 5. Maintenance & Recovery

| Frequency     | Task                                                          |
| ------------- | ------------------------------------------------------------- |
| **Weekly**    | Review soft-deleted record counts; check for unusual patterns |
| **Monthly**   | Vacuum DB, archive old soft-deletes, review audit log growth  |
| **Quarterly** | Test backup restoration and rollback procedures               |

### **Recovery Examples**

```sql
-- Restore a soft-deleted record
UPDATE "Customer" SET "deletedAt" = NULL WHERE id = 123;

-- Find all records deleted this week
SELECT * FROM "Customer" WHERE "deletedAt" > NOW() - INTERVAL '7 days';
```

---

## 🧠 6. Testing Checklist (Pre-Launch)

- [ ] Inserts with missing required fields fail
- [ ] Duplicate keys are rejected
- [ ] Foreign-key violations are blocked
- [ ] Negative numbers trigger check-constraint errors
- [ ] Soft-delete and restore work as expected
- [ ] Audit logs capture changes
- [ ] Auth + rate limits tested

---

## 🚀 7. Future-Ready Add-Ons

| Add-On                                | Benefit                                          |
| ------------------------------------- | ------------------------------------------------ |
| **Database encryption (field-level)** | Protects sensitive info (SSN, credit cards)      |
| **Row-level security (RLS)**          | Enforces tenant-based access at DB level         |
| **Triggers for audit automation**     | Automatically write logs without app logic       |
| **Automated backup rotation**         | Scheduled daily/weekly backups                   |
| **Schema migration tracking**         | Prisma Migrate / Liquibase for traceable changes |

---

## 📊 Implementation Priority

### 🔴 **P0 - Critical (Pre-Launch)**

**Must-Have for Production Safety**

- [x] NOT NULL on required fields
- [x] Soft-delete implementation
- [x] Atomic transactions for bulk updates
- [x] Basic audit logging
- [x] Pre-validation before database writes
- [x] Conflict detection (409 errors)

**Estimated Time:** 1-2 days per table

---

### 🟡 **P1 - High (First Month)**

**Significant Risk Reduction**

- [ ] CHECK constraints for valid ranges (positive numbers)
- [ ] UNIQUE constraints where applicable
- [ ] DEFAULT values for all optional fields
- [ ] Rate limiting on API endpoints
- [ ] Comprehensive error logging
- [ ] Decimal types for money fields (prevents rounding errors)

**Estimated Time:** 2-3 days per table

---

### 🟢 **P2 - Medium (First Quarter)**

**Data Quality & Relationships**

- [ ] Foreign keys (requires table restructuring)
- [ ] Enum types for status fields
- [ ] Automated backup rotation
- [ ] Performance monitoring
- [ ] Advanced audit automation

**Estimated Time:** 1 week per table + infrastructure setup

---

### 🔵 **P3 - Nice-to-Have (Future)**

**Enterprise Features**

- [ ] Field-level encryption
- [ ] Row-level security (multi-tenancy)
- [ ] Database triggers
- [ ] Advanced analytics/reporting
- [ ] Real-time data sync

**Estimated Time:** Ongoing project work

---

## ⚡ Performance Considerations

| Constraint Type | Performance Impact                  | Mitigation                                   |
| --------------- | ----------------------------------- | -------------------------------------------- |
| **NOT NULL**    | ✅ None                             | Use freely                                   |
| **DEFAULT**     | ✅ Negligible                       | Use freely                                   |
| **CHECK**       | ⚠️ Minor (evaluated on every write) | Keep expressions simple                      |
| **UNIQUE**      | ⚠️ Requires index                   | Adds to table size, but improves query speed |
| **FOREIGN KEY** | ⚠️ Requires lookup                  | Index foreign key columns                    |
| **Decimal**     | ⚠️ Slightly slower than Float       | Worth it for accuracy                        |
| **Triggers**    | 🔴 Can be expensive                 | Use sparingly, optimize queries              |

---

## 📋 Table-by-Table Implementation Template

Use this checklist for each table:

```markdown
# [Table Name] Data Integrity

## Schema Constraints

- [ ] NOT NULL: [field1], [field2], [field3]
- [ ] UNIQUE: [field4]
- [ ] CHECK: quantity >= 0, price >= 0
- [ ] FOREIGN KEY: customerId → customers(id)
- [ ] DEFAULT: status = 'pending', quantity = 0
- [ ] Decimal types for money fields

## API Validation

- [ ] Zod schema created: `src/lib/validations/[table].validation.ts`
- [ ] Applied in: POST /api/[table]
- [ ] Applied in: PUT /api/[table]
- [ ] Applied in: PATCH /api/[table]

## Protection Mechanisms

- [ ] Atomic bulk updates (`prisma.$transaction`)
- [ ] Soft-delete enabled
- [ ] Mass deletion requires confirmation
- [ ] Reference integrity checks
- [ ] Pre-validation before writes
- [ ] Conflict detection

## Testing Status

- [ ] Invalid data rejected (API + DB)
- [ ] Duplicates prevented
- [ ] Foreign key violations blocked
- [ ] Negative values rejected
- [ ] Soft-delete & restore tested
- [ ] Audit logs verified
- [ ] Concurrent edit handling tested

## Documentation

- [ ] Field descriptions documented
- [ ] Business logic formulas documented
- [ ] Recovery procedures documented
- [ ] Migration plan created
```

---

## 🎯 Implementation Roadmap for Transactions Table

### **Current Status: ✅ P0 Complete**

| Priority | Feature                  | Status  | Notes                                   |
| -------- | ------------------------ | ------- | --------------------------------------- |
| P0       | Atomic bulk updates      | ✅ Done | `prisma.$transaction` in PUT endpoint   |
| P0       | Soft-delete              | ✅ Done | Prisma middleware                       |
| P0       | Mass deletion protection | ✅ Done | Requires confirmation                   |
| P0       | Audit logging            | ✅ Done | Before/after snapshots + operation logs |
| P0       | Pre-validation           | ✅ Done | ID checks, existence checks             |
| P0       | Conflict detection       | ✅ Done | 409 errors with clear messages          |

---

### **Next Step: 🟡 P1 Implementation**

#### **Schema Migration**

**From (Current):**

```prisma
model Transaction {
  id           Int      @id @default(autoincrement())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  orderDate    String?  @db.VarChar(50)      // ❌ Optional, String type
  customers    String?  @db.VarChar(255)     // ❌ Optional
  productCode  String?  @db.VarChar(100)     // ❌ Optional
  quantity     Float?                        // ❌ Optional, Float (rounding errors)
  unitPrice    Float?                        // ❌ Optional, Float
  discount     Float?                        // ❌ Optional, Float
  adjustment   Float?                        // ❌ Optional, Float
  lineTotal    Float?                        // ❌ Optional, Float
  orderStatus  String?  @db.VarChar(100)     // ❌ Optional, no default
  notes        String?  @db.Text
  invoiceDate  String?  @db.VarChar(50)
  packedDate   String?  @db.VarChar(50)
  shipmentCode String?  @db.VarChar(100)
  deletedAt    DateTime?

  @@index([orderDate])
  @@index([customers])
  @@index([productCode])
  @@index([orderStatus])
  @@index([shipmentCode])
  @@map("transactions")
}
```

**To (Enhanced):**

```prisma
model Transaction {
  id           Int      @id @default(autoincrement())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // ✅ Required fields (NOT NULL)
  orderDate    String   @db.VarChar(50)      // Required for business logic
  customers    String   @db.VarChar(255)     // Required - who ordered?
  productCode  String   @db.VarChar(100)     // Required - what was ordered?

  // ✅ Decimal types with defaults (prevents rounding, ensures valid data)
  quantity     Decimal  @default(0) @db.Decimal(10, 2)   // 0-99,999,999.99
  unitPrice    Decimal  @default(0) @db.Decimal(10, 2)   // Max ₱99,999,999.99
  discount     Decimal  @default(0) @db.Decimal(10, 2)   // Max ₱99,999,999.99
  adjustment   Decimal  @default(0) @db.Decimal(10, 2)   // Max ₱99,999,999.99
  lineTotal    Decimal  @default(0) @db.Decimal(10, 2)   // Max ₱99,999,999.99

  // ✅ Status with default
  orderStatus  String   @default("Prepared") @db.VarChar(100)

  // Optional fields (keep flexible)
  notes        String?  @db.Text
  invoiceDate  String?  @db.VarChar(50)
  packedDate   String?  @db.VarChar(50)
  shipmentCode String?  @db.VarChar(100)

  // Soft-delete
  deletedAt    DateTime?

  // Indexes for performance
  @@index([orderDate])
  @@index([customers])
  @@index([productCode])
  @@index([orderStatus])
  @@index([shipmentCode])
  @@map("transactions")
}
```

---

### **Code Changes Required**

#### **1. Update API Route Parsing**

**File:** `src/app/api/transactions/route.ts`

**Change:**

```typescript
// ❌ OLD: Returns Float
function parseNumeric(value: unknown): number {
  // ... returns number
}

// ✅ NEW: Returns Prisma.Decimal
import { Prisma } from '@prisma/client';

function parseNumeric(value: unknown): Prisma.Decimal {
  if (value === undefined || value === null || value === '') {
    return new Prisma.Decimal(0);
  }

  if (typeof value === 'number') {
    return new Prisma.Decimal(Number.isFinite(value) ? value : 0);
  }

  const str = String(value).replace(/,/g, '').trim();
  if (str.length === 0) {
    return new Prisma.Decimal(0);
  }

  const parsed = Number.parseFloat(str);
  return new Prisma.Decimal(Number.isNaN(parsed) ? 0 : parsed);
}
```

#### **2. Update Frontend to Handle Decimal**

**When displaying:**

```typescript
// Decimal values come as strings from Prisma
const displayPrice = parseFloat(transaction.unitPrice.toString()).toFixed(2);
```

**When calculating:**

```typescript
import { Prisma } from '@prisma/client';

// Use Decimal for calculations
const quantity = new Prisma.Decimal(transaction.quantity);
const unitPrice = new Prisma.Decimal(transaction.unitPrice);
const lineTotal = quantity.mul(unitPrice); // Precise multiplication
```

#### **3. Update Zod Validation**

**File:** `src/lib/validations/transaction.validation.ts`

```typescript
import { z } from 'zod';
import { Prisma } from '@prisma/client';

// Custom Zod schema for Decimal
const decimalSchema = z
  .union([z.number(), z.string(), z.instanceof(Prisma.Decimal)])
  .transform((val) => {
    if (val instanceof Prisma.Decimal) return val;
    return new Prisma.Decimal(val);
  });

export const transactionSchema = z.object({
  orderDate: z.string().min(1, 'Order date is required'),
  customers: z.string().min(1, 'Customer name is required'),
  productCode: z.string().min(1, 'Product code is required'),
  quantity: decimalSchema.refine((val) => val.greaterThanOrEqualTo(0), {
    message: 'Quantity must be positive',
  }),
  unitPrice: decimalSchema.refine((val) => val.greaterThanOrEqualTo(0), {
    message: 'Unit price must be positive',
  }),
  discount: decimalSchema.refine((val) => val.greaterThanOrEqualTo(0), {
    message: 'Discount must be positive',
  }),
  adjustment: decimalSchema,
  lineTotal: decimalSchema.refine((val) => val.greaterThanOrEqualTo(0), {
    message: 'Line total must be positive',
  }),
  orderStatus: z.string().default('Prepared'),
  notes: z.string().optional(),
  invoiceDate: z.string().optional(),
  packedDate: z.string().optional(),
  shipmentCode: z.string().optional(),
});
```

---

### **Migration Steps**

#### **Step 1: Generate Migration**

```bash
npx prisma migrate dev --name enhance_transaction_constraints
```

#### **Step 2: Review Migration SQL**

Prisma will generate something like:

```sql
-- AlterTable
ALTER TABLE "transactions"
  ALTER COLUMN "orderDate" SET NOT NULL,
  ALTER COLUMN "customers" SET NOT NULL,
  ALTER COLUMN "productCode" SET NOT NULL,
  ALTER COLUMN "quantity" SET DEFAULT 0,
  ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,2),
  ALTER COLUMN "unitPrice" SET DEFAULT 0,
  ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(10,2),
  ALTER COLUMN "discount" SET DEFAULT 0,
  ALTER COLUMN "discount" SET DATA TYPE DECIMAL(10,2),
  ALTER COLUMN "adjustment" SET DEFAULT 0,
  ALTER COLUMN "adjustment" SET DATA TYPE DECIMAL(10,2),
  ALTER COLUMN "lineTotal" SET DEFAULT 0,
  ALTER COLUMN "lineTotal" SET DATA TYPE DECIMAL(10,2),
  ALTER COLUMN "orderStatus" SET DEFAULT 'Prepared';
```

#### **Step 3: Apply Migration**

```bash
npx prisma migrate deploy
```

#### **Step 4: Verify Schema**

```bash
npx prisma db pull
npx prisma generate
```

---

### **Benefits After P1 Implementation**

| Benefit                    | Impact                                                   |
| -------------------------- | -------------------------------------------------------- |
| **No incomplete records**  | Database rejects missing orderDate/customers/productCode |
| **No rounding errors**     | Decimal types maintain exact precision for money         |
| **Cleaner data**           | Defaults ensure no NULL math operations                  |
| **Better queries**         | NOT NULL fields optimize query planner                   |
| **Clearer business logic** | Default 'Prepared' status obvious to all users           |

---

### **Estimated Effort**

| Task                  | Time           | Risk                          |
| --------------------- | -------------- | ----------------------------- |
| Schema migration      | 30 min         | ✅ Low (table empty)          |
| Update API parsing    | 1 hour         | ⚠️ Medium (test thoroughly)   |
| Update Zod validation | 1 hour         | ✅ Low                        |
| Frontend adjustments  | 2 hours        | ⚠️ Medium (test calculations) |
| Testing               | 2 hours        | Critical                      |
| **Total**             | **~6-7 hours** | ⚠️ Medium (manageable)        |

---

## 🔄 Rolling Out to Other Tables

Once Transactions is complete, apply the same pattern to:

1. **Customers** (next priority)
2. **Products**
3. **Payroll** (sensitive financial data)
4. **Employees**
5. **Orders/Shipments**

Use this template for each:

1. Copy schema enhancement pattern
2. Update API parsing
3. Update Zod schemas
4. Test thoroughly
5. Document in `[TABLE]_DATA_INTEGRITY.md`

---

## 📚 Reference Documentation

- [Prisma Decimal Type](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-decimal)
- [PostgreSQL CHECK Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Zod Validation](https://zod.dev/)

---

## ✅ Success Criteria

Before considering this blueprint "complete" for Transactions:

- [x] P0 implemented and tested
- [ ] P1 schema migration successful
- [ ] All API endpoints updated for Decimal
- [ ] Frontend calculations tested
- [ ] No rounding errors in money calculations
- [ ] Database rejects invalid data
- [ ] Documentation complete
- [ ] Team trained on new patterns

---

## 📞 Support & Questions

For implementation questions or issues:

1. Check this documentation first
2. Review table-specific `*_DATA_INTEGRITY.md` files
3. Test in staging environment before production
4. Keep audit logs for rollback if needed

---

**Last Updated:** October 23, 2025  
**Next Review:** After Transactions P1 implementation
