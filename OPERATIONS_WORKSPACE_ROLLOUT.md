# Operations Workspace Protection Rollout Plan

## Executive Summary

This document provides a comprehensive rollout plan to apply enterprise-grade data integrity protection to all 9+ operation pages in the business management system. Based on the completed Transactions hardening, this plan standardizes atomic updates, validation, audit logging, and soft-delete safeguards across the entire operations workspace.

---

## Page-to-Table Mapping

### Core Operations (Database Write Operations)

| #   | Page URL                           | Database Table(s)          | API Route                   | Current Status     | Priority        |
| --- | ---------------------------------- | -------------------------- | --------------------------- | ------------------ | --------------- |
| 1   | `/operations/transactions`         | `transactions`             | `/api/transactions`         | ✅ **PROTECTED**   | P0 (Done)       |
| 2   | `/operations/customers`            | `customers`                | `/api/customers`            | ⚠️ **PARTIAL**     | P0 (Critical)   |
| 3   | `/operations/products`             | `products`                 | `/api/products`             | ❌ **UNPROTECTED** | P0 (Critical)   |
| 4   | `/operations/prices`               | `prices`                   | `/api/prices`               | ❌ **UNPROTECTED** | P0 (Critical)   |
| 5   | `/operations/shipments`            | `shipments`                | `/api/shipments`            | ❌ **UNPROTECTED** | P1 (High)       |
| 6   | `/operations/sorting-distribution` | `sorting_distributions`    | `/api/sorting-distribution` | ❌ **UNPROTECTED** | P1 (High)       |
| 7   | `/operations/due-dates`            | `transactions` (read-only) | `/api/transactions`         | ✅ **COVERED**     | N/A (Read-only) |

### Supporting Operations (Read-Only or Aggregations)

| #   | Page URL                            | Database Table(s)       | Purpose             | Protection Needed   |
| --- | ----------------------------------- | ----------------------- | ------------------- | ------------------- |
| 8   | `/operations/business-intelligence` | Multiple (aggregations) | Read-only analytics | ❌ None (read-only) |
| 9   | `/operations/dashboard`             | Multiple (metrics)      | Read-only KPIs      | ❌ None (read-only) |

### Additional Operations Discovered

| Page                        | Database Table(s)          | Status    | Priority |
| --------------------------- | -------------------------- | --------- | -------- |
| `/operations/inventory`     | `products`, `transactions` | Read-only | N/A      |
| `/operations/notifications` | N/A (UI state)             | N/A       | N/A      |
| `/operations/settings`      | N/A (config)               | N/A       | N/A      |

---

## Current Protection Status Analysis

### ✅ PROTECTED: Transactions (`/api/transactions`)

**Status**: Fully hardened (completed in previous work)

**Protections Implemented**:

- ✅ Atomic bulk updates via `prisma.$transaction`
- ✅ Zod validation schema
- ✅ Pre-validation checks (existence, references)
- ✅ Soft-delete safeguards
- ✅ Audit logging (dual Prisma client)
- ✅ Mass deletion protection (`?confirm=DELETE_ALL_TRANSACTIONS`)
- ✅ 404/409 error handling
- ✅ Reference integrity checks (customers, products)
- ✅ Formula validation (Unit Price, Line Total)

**Validation Schema**: `/src/lib/validations/transaction.validation.ts`

**Estimated Effort**: ✅ **COMPLETE** (20+ hours invested)

---

### ⚠️ PARTIAL: Customers (`/api/customers`)

**Status**: Has validation + transactions, missing reference checks

**Current Protections**:

- ✅ Zod validation schema (`customer.validation.ts`)
- ✅ Atomic bulk updates (`prisma.$transaction`)
- ✅ Soft-delete via middleware
- ⚠️ NO reference integrity checks (transactions may orphan)
- ⚠️ NO mass deletion protection
- ⚠️ NO conflict detection (409 errors)

**Missing Protections**:

```typescript
// NEEDED: Check if customer has active transactions before delete
async function checkCustomerReferences(customerName: string) {
  const activeTransactions = await prisma.transaction.count({
    where: { customers: customerName, deletedAt: null },
  });

  if (activeTransactions > 0) {
    throw new Error(
      `Cannot delete customer "${customerName}": ${activeTransactions} active transactions exist`
    );
  }
}
```

**Business Logic**:

- Email validation + URL normalization
- Customer status enum (Active/Inactive/Prospect/VIP/Banned)
- Flexible field mapping (same as Transactions)

**Estimated Effort**: 4-6 hours

- Add reference checks (transactions)
- Add mass deletion protection
- Add 404/409 error handling
- Test with existing transactions

---

### ❌ UNPROTECTED: Products (`/api/products`)

**Status**: High-risk - uses destructive `deleteMany` pattern

**Current Implementation** (DANGEROUS):

```typescript
// POST handler - DESTRUCTIVE PATTERN
if (Array.isArray(body)) {
  // ⚠️ DELETES ALL RECORDS FIRST
  await prisma.product.deleteMany({});

  // Then creates new ones - PARTIAL WRITE RISK
  const products = body.map(mapImportRow);
  await prisma.product.createMany({ data: products });
}
```

**Critical Issues**:

1. **Data Loss Risk**: `deleteMany` + `createMany` not atomic
2. **No Validation**: Accepts any CSV data structure
3. **No Reference Checks**: Products may be referenced by transactions/prices
4. **Transaction Timeout**: Large CSVs (1000+ rows) can timeout
5. **Soft-Delete Bypass**: Uses hard delete (no recovery)

**Required Protections**:

```typescript
// 1. Atomic upsert pattern
await prisma.$transaction(async (tx) => {
  // Check for active references
  const productsInUse = await tx.transaction.findMany({
    where: { productCode: { in: productCodes }, deletedAt: null },
    select: { productCode: true },
    distinct: ['productCode'],
  });

  if (productsInUse.length > 0) {
    throw new Error(
      `Cannot delete products: ${productsInUse.length} in active transactions`
    );
  }

  // Soft-delete old records
  await tx.product.updateMany({
    where: { productCode: { in: existingCodes } },
    data: { deletedAt: new Date() },
  });

  // Create new records
  await tx.product.createMany({ data: validatedProducts });
});

// 2. Zod validation schema
const productSchema = z.object({
  shipmentCode: z.string().nullable(),
  productCode: z.string().min(1, 'Product code required'),
  quantity: z.number().min(0, 'Quantity cannot be negative'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  // ... 25+ fields
});
```

**Business Logic**:

- CSV import with 25+ fields
- Array length detection (single = add, multi = replace all)
- Float calculations (rounding risk)
- No foreign keys to enforce

**Estimated Effort**: 10-12 hours

- Create Zod schema (25+ fields)
- Replace deleteMany with atomic upsert
- Add reference checks (transactions, prices)
- Add mass deletion protection
- Add batch size limits (prevent timeout)
- Test with large CSV imports (1000+ rows)

---

### ❌ UNPROTECTED: Prices (`/api/prices`)

**Status**: High-risk - uses destructive `deleteMany` pattern

**Current Implementation** (DANGEROUS):

```typescript
// POST handler - SAME DESTRUCTIVE PATTERN AS PRODUCTS
await prisma.price.deleteMany(); // ⚠️ DELETES ALL RECORDS
await prisma.price.createMany({ data: pricesData });
```

**Critical Issues**:

1. **Data Loss Risk**: Same atomic transaction issue
2. **No Validation**: Only has `product-price.validation.ts` (not used)
3. **No Reference Checks**: Prices used by transactions for tier pricing
4. **Multiplier Logic**: Stores prices × 100 (e.g., $10.50 → 1050)
5. **Soft-Delete Available**: But bypassed in POST

**Required Protections**:

```typescript
// 1. Use existing validation schema
import { productPriceSchema } from '@/lib/validations/product-price.validation';

// 2. Atomic upsert pattern
await prisma.$transaction(async (tx) => {
  // Check if prices are in use by transactions
  const pricesInUse = await tx.transaction.findMany({
    where: {
      productCode: { in: productCodes },
      orderStatus: { in: ['Prepared', 'Invoiced', 'Packed'] },
      deletedAt: null,
    },
    select: { productCode: true, orderStatus: true },
    distinct: ['productCode'],
  });

  if (pricesInUse.length > 0) {
    throw new Error(
      `Cannot modify prices: ${pricesInUse.length} products have active orders`
    );
  }

  // Soft-delete old prices
  await tx.price.updateMany({
    where: { productCode: { in: existingCodes } },
    data: { deletedAt: new Date() },
  });

  // Create new prices
  await tx.price.createMany({ data: validatedPrices });
});
```

**Business Logic**:

- Tier pricing (Lower Limit, Upper Limit, Price, Adjustment)
- Used by transactions for Unit Price calculation
- Multiplier × 100 storage (avoid Float rounding)
- Product Code reference (no foreign key)

**Estimated Effort**: 8-10 hours

- Use existing validation schema
- Replace deleteMany with atomic upsert
- Add reference checks (transactions with Prepared/Invoiced status)
- Add mass deletion protection
- Test tier pricing logic still works

---

### ❌ UNPROTECTED: Shipments (`/api/shipments`)

**Status**: Moderate-risk - uses destructive pattern

**Current Implementation** (DANGEROUS):

```typescript
// POST handler - BULK IMPORT
if (Array.isArray(body)) {
  await prisma.shipment.deleteMany({}); // ⚠️ DELETES ALL
  await prisma.shipment.createMany({ data: shipmentsToCreate });
}
```

**Critical Issues**:

1. **Data Loss Risk**: Same atomic transaction issue
2. **No Validation**: Only type conversions
3. **No Reference Checks**: Shipments referenced by products/transactions
4. **Currency Parsing**: Custom `cleanFee()` logic (removes ₱ symbol)
5. **Date Fields**: String type (no validation)

**Required Protections**:

```typescript
// 1. Zod validation schema
const shipmentSchema = z.object({
  shipmentCode: z.string().min(1, 'Shipment code required'),
  cvNumber: z.string().nullable(),
  noOfSacks: z.number().int().min(0, 'Must be positive integer'),
  totalCBM: z.number().min(0),
  weight: z.number().min(0),
  fee: z.number().min(0),
  shipmentStatus: z.enum(['Pending', 'In Transit', 'Delivered', 'Cancelled']),
  dateCreated: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  dateDelivered: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

// 2. Atomic upsert pattern
await prisma.$transaction(async (tx) => {
  // Check if shipments are in use
  const shipmentsInUse = await tx.product.findMany({
    where: {
      shipmentCode: { in: shipmentCodes },
      shipmentStatus: 'In Transit',
      deletedAt: null,
    },
    select: { shipmentCode: true },
  });

  const transactionsInUse = await tx.transaction.findMany({
    where: {
      shipmentCode: { in: shipmentCodes },
      orderStatus: { in: ['Invoiced', 'Packed'] },
      deletedAt: null,
    },
    select: { shipmentCode: true },
  });

  const inUse = [...shipmentsInUse, ...transactionsInUse];
  if (inUse.length > 0) {
    throw new Error(
      `Cannot delete shipments: ${inUse.length} active references exist`
    );
  }

  // Soft-delete old shipments
  await tx.shipment.updateMany({
    where: { shipmentCode: { in: existingCodes } },
    data: { deletedAt: new Date() },
  });

  // Create new shipments
  await tx.shipment.createMany({ data: validatedShipments });
});
```

**Business Logic**:

- Shipment tracking (Pending → In Transit → Delivered)
- Referenced by products (inventory tracking)
- Referenced by transactions (packing lists)
- Currency parsing (₱ symbol cleanup)
- Duration calculation

**Estimated Effort**: 8-10 hours

- Create Zod schema
- Replace deleteMany with atomic upsert
- Add reference checks (products, transactions)
- Add mass deletion protection
- Test shipment status transitions

---

### ❌ UNPROTECTED: Sorting Distribution (`/api/sorting-distribution`)

**Status**: Moderate-risk - uses raw SQL queries

**Current Implementation** (DANGEROUS):

```typescript
// POST handler - RAW SQL
await prisma.$executeRaw`
  DELETE FROM sorting_distributions 
  WHERE product_code = ${productCode}
`;

// Then inserts new rows (non-atomic)
for (const row of rows) {
  await prisma.$executeRaw`
    INSERT INTO sorting_distributions (...) VALUES (...)
  `;
}
```

**Critical Issues**:

1. **Raw SQL**: Bypasses Prisma type safety
2. **Non-Atomic Deletes**: DELETE then INSERT loop (corruption risk)
3. **No Validation**: Accepts any row data
4. **Unique Constraint**: `productCode + rowNumber` but not enforced in code
5. **Hard Delete**: No soft-delete (permanent loss)

**Required Protections**:

```typescript
// 1. Switch to Prisma ORM (not raw SQL)
await prisma.$transaction(async (tx) => {
  // Soft-delete existing rows
  await tx.sortingDistribution.updateMany({
    where: { productCode },
    data: { deletedAt: new Date() },
  });

  // Validate row data
  const validatedRows = rows.map((row) => {
    const validated = sortingDistributionSchema.parse(row);
    return {
      productCode,
      selectedQuantity,
      rowNumber: validated.rowNumber,
      quantity: validated.quantity,
      percentage: validated.percentage,
      groupNumber: validated.groupNumber,
      distribution: validated.distribution,
      checked: validated.checked,
    };
  });

  // Create new rows atomically
  await tx.sortingDistribution.createMany({
    data: validatedRows,
    skipDuplicates: true, // Handles unique constraint
  });
});

// 2. Zod validation schema
const sortingDistributionSchema = z.object({
  rowNumber: z.number().int().min(1),
  quantity: z.number().min(0),
  percentage: z.number().min(0).max(100),
  groupNumber: z.string(),
  distribution: z.number().min(0),
  checked: z.boolean(),
});
```

**Business Logic**:

- Product quantity distribution
- Group assignments
- Percentage calculations (must sum to 100%)
- Unique constraint on `productCode + rowNumber`
- Used by packing list generation

**Estimated Effort**: 6-8 hours

- Replace raw SQL with Prisma ORM
- Create Zod schema
- Add atomic transaction wrapper
- Add validation (percentages sum to 100%)
- Test unique constraint handling

---

## Protection Implementation Template

### Step-by-Step Checklist (Per Table)

#### Phase 1: Preparation (1-2 hours)

- [ ] Review current API route implementation
- [ ] Identify business logic constraints
- [ ] Check for existing validation schemas
- [ ] Map all database references (foreign relations)
- [ ] Document current test coverage

#### Phase 2: Validation (2-3 hours)

- [ ] Create Zod schema in `/src/lib/validations/{table}.validation.ts`
- [ ] Define all required fields
- [ ] Add business logic constraints (e.g., min/max, enums)
- [ ] Add custom validators (e.g., date format, currency)
- [ ] Export error formatting helper

**Example Schema**:

```typescript
// /src/lib/validations/product.validation.ts
import { z } from 'zod';

export const productSchema = z
  .object({
    shipmentCode: z.string().nullable(),
    productCode: z.string().min(1, 'Product code required'),
    quantity: z.number().min(0, 'Quantity cannot be negative'),
    unitPrice: z.number().min(0, 'Unit price cannot be negative'),
    // ... all 25+ fields
  })
  .strict();

export const productBulkSchema = z.array(productSchema).min(1);

export function formatProductValidationErrors(error: z.ZodError) {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}
```

#### Phase 3: Reference Integrity (2-3 hours)

- [ ] Identify all tables that reference this table
- [ ] Create `getMissingReferences()` helper
- [ ] Create `checkReferences()` for delete operations
- [ ] Add foreign key checks (even without DB constraints)

**Example Reference Check**:

```typescript
// Check if products are in use before delete
async function checkProductReferences(productCodes: string[]) {
  const [transactionRefs, priceRefs] = await Promise.all([
    prisma.transaction.count({
      where: {
        productCode: { in: productCodes },
        deletedAt: null,
      },
    }),
    prisma.price.count({
      where: {
        productCode: { in: productCodes },
        deletedAt: null,
      },
    }),
  ]);

  if (transactionRefs > 0 || priceRefs > 0) {
    throw new Error(
      `Cannot delete products: ${transactionRefs} transactions + ${priceRefs} price tiers exist`
    );
  }
}
```

#### Phase 4: Atomic Operations (3-4 hours)

- [ ] Wrap all bulk updates in `prisma.$transaction`
- [ ] Replace `Promise.all` with transaction blocks
- [ ] Replace `deleteMany` with soft-delete updates
- [ ] Add batch size limits (prevent timeout)
- [ ] Add optimistic concurrency checks

**Example Atomic Bulk Update**:

```typescript
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate all records upfront
    const validationResult = productBulkSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatProductValidationErrors(validationResult.error),
        },
        { status: 400 }
      );
    }

    const products = validationResult.data;

    // Check batch size
    if (products.length > 1000) {
      return NextResponse.json(
        {
          error: 'Batch too large. Maximum 1000 records per request.',
        },
        { status: 413 }
      );
    }

    // Atomic bulk update
    const results = await prisma.$transaction(async (tx) => {
      const updateResults = [];

      for (const product of products) {
        // Check if product exists
        const existing = await tx.product.findUnique({
          where: { id: product.id },
        });

        if (!existing) {
          throw new Error(`Product ID ${product.id} not found`);
        }

        if (existing.deletedAt) {
          throw new Error(`Product ID ${product.id} was deleted`);
        }

        // Update product
        const updated = await tx.product.update({
          where: { id: product.id },
          data: {
            shipmentCode: product.shipmentCode,
            productCode: product.productCode,
            quantity: product.quantity,
            unitPrice: product.unitPrice,
            // ... all fields
            updatedAt: new Date(),
          },
        });

        updateResults.push(updated);
      }

      return updateResults;
    });

    logger.info(`Bulk updated ${results.length} products`);
    return NextResponse.json({
      success: true,
      updated: results.length,
    });
  } catch (error) {
    logger.error('Bulk product update failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Update failed',
      },
      { status: 500 }
    );
  }
}
```

#### Phase 5: Error Handling (1-2 hours)

- [ ] Add 400 errors for validation failures
- [ ] Add 404 errors for missing records
- [ ] Add 409 errors for conflict detection
- [ ] Add 413 errors for batch size limits
- [ ] Improve error messages (user-friendly)

**Example Error Handling**:

```typescript
// 404: Record not found
if (!existing) {
  return NextResponse.json({
    error: 'Not Found',
    message: `Product with ID ${id} does not exist`,
    id
  }, { status: 404 });
}

// 409: Conflict (soft-deleted)
if (existing.deletedAt) {
  return NextResponse.json({
    error: 'Conflict',
    message: `Product with ID ${id} was deleted on ${existing.deletedAt.toISOString()}`,
    deletedAt: existing.deletedAt,
    id
  }, { status: 409 });
}

// 409: Conflict (unique constraint)
catch (error) {
  if (error.code === 'P2002') {
    return NextResponse.json({
      error: 'Conflict',
      message: `Product code "${productCode}" already exists`,
      field: 'productCode'
    }, { status: 409 });
  }
}
```

#### Phase 6: Mass Deletion Protection (1 hour)

- [ ] Add confirmation query parameter
- [ ] Add warning logs
- [ ] Require explicit confirmation string
- [ ] Rate limit delete operations

**Example Mass Delete Protection**:

```typescript
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const confirm = searchParams.get('confirm');

  if (confirm !== 'DELETE_ALL_PRODUCTS') {
    logger.warn('Attempted mass delete without confirmation');
    return NextResponse.json(
      {
        error: 'Confirmation required',
        message:
          'To delete all products, add query parameter: ?confirm=DELETE_ALL_PRODUCTS',
        warning: 'This action cannot be undone',
      },
      { status: 400 }
    );
  }

  // Check for active references
  await checkProductReferences(await getAllProductCodes());

  // Soft-delete all
  const result = await prisma.product.updateMany({
    where: { deletedAt: null },
    data: { deletedAt: new Date() },
  });

  logger.warn(`Mass deleted ${result.count} products`);
  return NextResponse.json({
    success: true,
    deleted: result.count,
  });
}
```

#### Phase 7: Testing (2-3 hours)

- [ ] Test single record create/update/delete
- [ ] Test bulk operations (10, 100, 1000 records)
- [ ] Test validation errors (each field)
- [ ] Test reference integrity checks
- [ ] Test soft-delete recovery
- [ ] Test atomic transaction rollback
- [ ] Test error responses (400, 404, 409, 413, 500)
- [ ] Test mass deletion protection
- [ ] Performance test (response time < 5s for 1000 records)

#### Phase 8: Documentation (1 hour)

- [ ] Update API route comments
- [ ] Document business logic constraints
- [ ] Add recovery procedures
- [ ] Update `/SYSTEM_WIDE_DATA_INTEGRITY.md`
- [ ] Create table-specific docs (if complex)

---

## Prioritized Rollout Schedule

### Priority 0 (Critical) - Week 1-2

**Target**: Financial/transactional data with high business impact

| Table           | Estimated Effort | Business Risk              | Rollout Order |
| --------------- | ---------------- | -------------------------- | ------------- |
| ✅ Transactions | ✅ COMPLETE      | Critical                   | 1 (Done)      |
| ⚠️ Customers    | 4-6 hours        | High (orphan transactions) | 2             |
| ❌ Products     | 10-12 hours      | Critical (inventory)       | 3             |
| ❌ Prices       | 8-10 hours       | Critical (tier pricing)    | 4             |

**Total Effort**: 22-28 hours (2-3 business days for 1 developer)

**Justification**:

- **Customers**: Referenced by transactions (foreign relation risk)
- **Products**: Core inventory data, high CSV import volume
- **Prices**: Used for transaction calculations, tier pricing logic

---

### Priority 1 (High) - Week 3

**Target**: Operational data with moderate business impact

| Table                   | Estimated Effort | Business Risk       | Rollout Order |
| ----------------------- | ---------------- | ------------------- | ------------- |
| ❌ Shipments            | 8-10 hours       | Moderate (tracking) | 5             |
| ❌ Sorting Distribution | 6-8 hours        | Moderate (packing)  | 6             |

**Total Effort**: 14-18 hours (1.5-2 business days)

**Justification**:

- **Shipments**: Referenced by products/transactions, status tracking
- **Sorting Distribution**: Used by packing list generation

---

### Priority 2 (Medium) - Week 4+

**Target**: Supporting data, read-only pages

| Page                  | Action                  | Estimated Effort |
| --------------------- | ----------------------- | ---------------- |
| Business Intelligence | No action (read-only)   | 0 hours          |
| Dashboard             | No action (read-only)   | 0 hours          |
| Due Dates             | Covered by Transactions | 0 hours          |
| Inventory             | No action (read-only)   | 0 hours          |

**Total Effort**: 0 hours (no changes needed)

---

## Consolidated Timeline

### Phase 1: Critical Tables (Week 1-2)

- **Day 1-2**: Customers (4-6 hours)
- **Day 3-5**: Products (10-12 hours)
- **Day 6-8**: Prices (8-10 hours)
- **Milestone**: All financial/transactional tables protected

### Phase 2: Operational Tables (Week 3)

- **Day 9-10**: Shipments (8-10 hours)
- **Day 11-12**: Sorting Distribution (6-8 hours)
- **Milestone**: All write operations protected

### Phase 3: Schema Hardening (Week 4-6) - P1 Priority

- Migrate Float → Decimal for all money fields
- Add NOT NULL constraints
- Add CHECK constraints
- Add default values
- Add foreign keys (where possible)
- **Estimated Effort**: 20-30 hours

### Total Project Duration

- **Immediate Protection**: 2-3 weeks (36-46 hours)
- **With Schema Migration**: 4-6 weeks (56-76 hours)

---

## Risk Assessment

### High-Risk Tables (Require Immediate Attention)

#### 1. Products

**Why High-Risk**:

- Destructive `deleteMany` pattern
- Large CSV imports (1000+ rows)
- No validation (25+ fields)
- Referenced by transactions, prices
- Float rounding on money fields

**Failure Impact**:

- Complete inventory loss
- Transaction orphaning
- Price tier mismatches
- Cannot generate invoices/packing lists

**Mitigation**:

- Prioritize in Week 1
- Add reference checks first
- Implement batch size limits
- Test with production CSV exports

---

#### 2. Prices

**Why High-Risk**:

- Destructive `deleteMany` pattern
- Used by transactions for calculations
- Multiplier × 100 logic (rounding risk)
- No validation on tier ranges

**Failure Impact**:

- Incorrect Unit Price calculations
- Transaction corruption
- Financial reporting errors
- Cannot process new orders

**Mitigation**:

- Prioritize in Week 1
- Validate tier range logic (lower < upper)
- Add reference checks (transactions with Prepared/Invoiced status)
- Test Unit Price calculations still work

---

### Moderate-Risk Tables

#### 3. Customers

**Why Moderate-Risk**:

- Already has validation + transactions
- Soft-delete enabled
- Missing reference checks only

**Failure Impact**:

- Transaction orphaning (no customer name)
- Cannot generate invoices (missing data)

**Mitigation**:

- Quick fix (4-6 hours)
- Add reference checks immediately
- Test with existing transactions

---

#### 4. Shipments

**Why Moderate-Risk**:

- Destructive pattern
- Referenced by products/transactions
- Currency parsing logic

**Failure Impact**:

- Lose shipment tracking
- Cannot generate packing lists
- Products without shipment codes

**Mitigation**:

- Prioritize in Week 2-3
- Test shipment status transitions
- Validate currency parsing

---

#### 5. Sorting Distribution

**Why Moderate-Risk**:

- Raw SQL (type safety risk)
- Unique constraint logic
- Non-atomic deletes

**Failure Impact**:

- Cannot generate distribution reports
- Packing list generation fails
- Percentage calculation errors

**Mitigation**:

- Replace raw SQL with Prisma ORM
- Test unique constraint handling
- Validate percentage sums to 100%

---

## Code Quality Standards

### Validation

- ✅ All fields validated via Zod
- ✅ Custom validators for business logic
- ✅ Error messages user-friendly
- ✅ Validation errors return 400 with details

### Atomic Operations

- ✅ All bulk updates wrapped in `prisma.$transaction`
- ✅ No `Promise.all` for database writes
- ✅ Batch size limits (max 1000 records)
- ✅ Optimistic concurrency checks

### Error Handling

- ✅ 400: Validation errors
- ✅ 404: Record not found
- ✅ 409: Conflict (soft-deleted, unique constraint)
- ✅ 413: Batch too large
- ✅ 500: Internal errors (logged)

### Soft-Delete

- ✅ Never use hard delete (except mass delete with confirmation)
- ✅ Check `deletedAt` in all queries
- ✅ Return 409 if updating deleted record
- ✅ Provide recovery procedures in docs

### Reference Integrity

- ✅ Check all foreign relations before delete
- ✅ Return 409 if references exist
- ✅ Provide list of blocking references
- ✅ Document reference chains

### Audit Logging

- ✅ Log all mutations (create/update/delete)
- ✅ Use dual Prisma client for audit logs
- ✅ Include before/after state
- ✅ Include timestamp + user (if available)

### Mass Deletion

- ✅ Require explicit confirmation query parameter
- ✅ Log warnings before execution
- ✅ Check references before deletion
- ✅ Rate limit (prevent accidental spam)

---

## Testing Strategy

### Per-Table Test Checklist

#### Unit Tests (Vitest)

- [ ] Validation schema tests (each field)
- [ ] Reference integrity checks
- [ ] Error formatting helpers
- [ ] Business logic functions

#### Integration Tests (Vitest + Prisma)

- [ ] Single record CRUD operations
- [ ] Bulk operations (10, 100, 1000 records)
- [ ] Atomic transaction rollback
- [ ] Soft-delete recovery
- [ ] Unique constraint handling
- [ ] Foreign key validation

#### E2E Tests (Playwright)

- [ ] CSV import flow
- [ ] Handsontable bulk paste
- [ ] Mass deletion confirmation
- [ ] Error message display
- [ ] Optimistic UI updates

#### Performance Tests

- [ ] Bulk update < 5s for 1000 records
- [ ] Reference checks < 1s
- [ ] Validation < 100ms for 1000 records

---

## Maintenance & Monitoring

### Ongoing Tasks

#### Weekly

- [ ] Review audit logs for anomalies
- [ ] Check soft-deleted records (candidates for hard delete)
- [ ] Monitor API response times (alert if > 5s)

#### Monthly

- [ ] Analyze validation error patterns
- [ ] Review reference integrity violations
- [ ] Check for orphaned records (missing foreign keys)
- [ ] Performance optimization (if needed)

#### Quarterly

- [ ] Hard delete old soft-deleted records (> 90 days)
- [ ] Review and update validation rules
- [ ] Schema migration planning
- [ ] Audit log archival

---

## Future Enhancements (Post-Rollout)

### Phase 3: Schema Hardening (P1)

- [ ] Float → Decimal migration (all money fields)
- [ ] String → Date migration (all date fields)
- [ ] Add NOT NULL constraints (critical fields)
- [ ] Add CHECK constraints (business rules)
- [ ] Add default values
- [ ] Add foreign keys (where possible)

### Phase 4: Advanced Protection (P2)

- [ ] Rate limiting per table
- [ ] Authentication middleware (user tracking)
- [ ] Row-level security (if multi-tenant)
- [ ] Optimistic locking (version fields)
- [ ] CDC (Change Data Capture) for real-time sync

### Phase 5: Developer Experience (P3)

- [ ] Auto-generated Zod schemas from Prisma
- [ ] API route generator (from schema)
- [ ] Test case generator
- [ ] Migration script generator
- [ ] Documentation generator

---

## Appendix: Reference

### Related Documentation

- `/TRANSACTIONS_DATA_INTEGRITY.md` - Complete Transactions protection guide
- `/SYSTEM_WIDE_DATA_INTEGRITY.md` - Enterprise blueprint with schema migration
- `/prisma/schema.prisma` - Current database schema

### Key Files

- `/src/app/api/transactions/route.ts` - Example of fully protected route
- `/src/lib/validations/transaction.validation.ts` - Example validation schema
- `/src/lib/validations/customer.validation.ts` - Example with custom validators

### Code Templates

All code examples in this document can be copied and adapted for each table.

---

## Next Steps

### Immediate Actions (Today)

1. **Review this rollout plan** - Confirm priorities and timeline
2. **Set up development environment** - Branch, test database, etc.
3. **Start with Customers** - Lowest effort, highest return (4-6 hours)

### Week 1 (Priority 0)

1. **Day 1-2**: Harden Customers
2. **Day 3-5**: Harden Products
3. **Day 6-8**: Harden Prices
4. **Milestone**: All financial tables protected

### Week 2-3 (Priority 1)

1. **Day 9-10**: Harden Shipments
2. **Day 11-12**: Harden Sorting Distribution
3. **Milestone**: All write operations protected

### Week 4+ (Priority 2)

1. Plan schema migration (Float → Decimal)
2. Add NOT NULL constraints
3. Add foreign keys
4. **Milestone**: Database schema fully validated

---

## Success Criteria

### Operational Metrics

- ✅ Zero data loss incidents
- ✅ All mutations atomic (no partial writes)
- ✅ 100% validation coverage
- ✅ Response time < 5s for 1000 records
- ✅ Zero orphaned records

### Code Quality Metrics

- ✅ 100% of write operations use `prisma.$transaction`
- ✅ 100% of tables have Zod schemas
- ✅ 100% of routes have error handling (400/404/409/413/500)
- ✅ 100% of soft-delete tables protected from hard delete
- ✅ 100% of foreign relations validated before delete

### Business Metrics

- ✅ Can recover from any data corruption (soft-delete)
- ✅ Audit trail for all mutations
- ✅ No unexpected downtime from database errors
- ✅ Confidence to deploy to production

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Author**: GitHub Copilot  
**Status**: Ready for Implementation
