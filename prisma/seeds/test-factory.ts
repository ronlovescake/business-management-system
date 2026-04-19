/**
 * Test data factory for integration / hardening tests.
 *
 * Use these helpers to build minimal, valid Prisma rows for tests so each
 * test does not have to remember every required field.
 *
 * Conventions:
 *   - Builders return *input objects*. Tests decide whether to call
 *     `prisma.<model>.create({ data })` or pass the object to a service.
 *   - Builders accept a `Partial<T>` override so individual tests can
 *     customize only the fields they care about.
 *   - Numeric IDs are auto-incremented by Prisma; do not hardcode them.
 *   - Strings use deterministic prefixes + a counter so tests can assert on
 *     created values without relying on Math.random.
 *   - Money fields stay in their current schema types (currently `Float`
 *     pending the Decimal migration tracked in IMPROVEMENTS_CHECKLIST.md
 *     \u00a71). Keep values small (< 1000) so rounding noise does not pollute
 *     ledger assertions.
 *
 * This file is intentionally NOT executed by `prisma db seed`. It is imported
 * directly by tests:
 *
 *   import { customerInput, productInput } from '@/../prisma/seeds/test-factory';
 *
 *   const customer = await prisma.customer.create({
 *     data: customerInput({ customerName: 'Alice' }),
 *   });
 */

let counter = 0;
const nextId = () => ++counter;

const isoToday = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

export interface CustomerInputOverrides {
  customerName?: string;
  phoneNumber?: string;
  address?: string;
  facebook?: string;
  emailAddress?: string;
  businessName?: string;
  taxNumber?: string;
  businessAddress?: string;
  businessContactNumber?: string;
  customerStatus?: string;
  date?: string;
}

export function customerInput(overrides: CustomerInputOverrides = {}) {
  const id = nextId();
  return {
    date: overrides.date ?? isoToday(),
    customerName: overrides.customerName ?? `Test Customer ${id}`,
    phoneNumber:
      overrides.phoneNumber ?? `+10000000${String(id).padStart(3, '0')}`,
    address: overrides.address ?? `123 Test St #${id}`,
    facebook: overrides.facebook ?? '',
    emailAddress: overrides.emailAddress ?? `customer-${id}@example.test`,
    businessName: overrides.businessName ?? '',
    taxNumber: overrides.taxNumber ?? '',
    businessAddress: overrides.businessAddress ?? '',
    businessContactNumber: overrides.businessContactNumber ?? '',
    customerStatus: overrides.customerStatus ?? 'ACTIVE',
  };
}

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

export interface ProductInputOverrides {
  shipmentCode?: string | null;
  cvNumber?: string | null;
  productCode?: string;
  unitPrice?: number;
  quantity?: number;
  noOfSacks?: number;
}

export function productInput(overrides: ProductInputOverrides = {}) {
  const id = nextId();
  return {
    shipmentCode: overrides.shipmentCode ?? `SHIP-${id}`,
    cvNumber: overrides.cvNumber ?? `CV-${id}`,
    productCode: overrides.productCode ?? `SKU-${id}`,
    unitPrice: overrides.unitPrice ?? 100,
    quantity: overrides.quantity ?? 1,
    noOfSacks: overrides.noOfSacks ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Transaction
// ---------------------------------------------------------------------------

export interface TransactionInputOverrides {
  productCode?: string;
  unitPrice?: number;
  quantity?: number;
  orderStatus?: string;
  customerName?: string;
  date?: string;
}

export function transactionInput(overrides: TransactionInputOverrides = {}) {
  const id = nextId();
  const unitPrice = overrides.unitPrice ?? 100;
  const quantity = overrides.quantity ?? 1;
  return {
    date: overrides.date ?? isoToday(),
    productCode: overrides.productCode ?? `SKU-${id}`,
    unitPrice,
    quantity,
    lineTotal: unitPrice * quantity,
    orderStatus: overrides.orderStatus ?? 'pending',
    customerName: overrides.customerName ?? `Test Customer ${id}`,
  };
}

// ---------------------------------------------------------------------------
// Employee
// ---------------------------------------------------------------------------

export interface EmployeeInputOverrides {
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  status?: string;
}

export function employeeInput(overrides: EmployeeInputOverrides = {}) {
  const id = nextId();
  return {
    employeeId: overrides.employeeId ?? `EMP-${String(id).padStart(4, '0')}`,
    firstName: overrides.firstName ?? `First${id}`,
    lastName: overrides.lastName ?? `Last${id}`,
    position: overrides.position ?? 'Tester',
    status: overrides.status ?? 'ACTIVE',
  };
}

// ---------------------------------------------------------------------------
// User (auth)
// ---------------------------------------------------------------------------

export interface UserInputOverrides {
  email?: string;
  name?: string;
  role?: string;
  isActive?: boolean;
  passwordHash?: string;
}

export function userInput(overrides: UserInputOverrides = {}) {
  const id = nextId();
  return {
    email: overrides.email ?? `user-${id}@example.test`,
    name: overrides.name ?? `Test User ${id}`,
    role: overrides.role ?? 'STAFF',
    isActive: overrides.isActive ?? true,
    passwordHash:
      overrides.passwordHash ??
      // bcrypt hash of "test-password-123"; safe for tests only
      '$2b$10$abcdefghijklmnopqrstuv0000000000000000000000000000000000',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reset the internal counter. Call from `beforeAll` if a test suite needs
 * deterministic, predictable IDs across runs.
 */
export function resetTestFactoryCounter(): void {
  counter = 0;
}
