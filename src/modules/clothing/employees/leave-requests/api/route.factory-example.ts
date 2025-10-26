/**
 * API Route Factory - Usage Examples
 *
 * This file demonstrates how to use the createCrudRoutes factory
 * for different scenarios. These are NOT meant to be used directly,
 * but serve as reference implementations.
 *
 * See src/core/api/README.md for full documentation.
 */

/**
 * EXAMPLE 1: Simple CRUD API (Minimal Configuration)
 *
 * Perfect for simple entities with no special requirements.
 */

/*
import { createCrudRoutes } from '@/core/api';
import { userService } from './service';
import { UserCreateSchema, UserUpdateSchema } from './schemas';

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: userService,
  schemas: {
    create: UserCreateSchema,
    update: UserUpdateSchema,
  },
  resourceName: 'User',
});
*/

/**
 * EXAMPLE 2: API with Custom GET Handler
 *
 * Use when you need custom filtering or search logic.
 */

/*
import type { NextRequest } from 'next/server';
import { createCrudRoutes, ApiResponse } from '@/core/api';
import { productService } from './service';
import { ProductCreateSchema, ProductUpdateSchema } from './schemas';

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: productService,
  schemas: {
    create: ProductCreateSchema,
    update: ProductUpdateSchema,
  },
  resourceName: 'Product',
  
  // Custom GET with search and category filtering
  customGet: async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    
    const products = await productService.search({
      search,
      category,
    });
    
    return ApiResponse.success(products);
  },
});
*/

/**
 * EXAMPLE 3: API with Response Transformation
 *
 * Use when you need to hide/transform data before sending response.
 */

/*
import { createCrudRoutes } from '@/core/api';
import { userService } from './service';
import { UserCreateSchema, UserUpdateSchema } from './schemas';

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: userService,
  schemas: {
    create: UserCreateSchema,
    update: UserUpdateSchema,
  },
  resourceName: 'User',
  
  // Hide sensitive fields (password, tokens, etc.)
  transformResponse: (data) => {
    const transform = ({ password, resetToken, ...user }: any) => user;
    
    return Array.isArray(data)
      ? data.map(transform)
      : transform(data);
  },
});
*/

/**
 * EXAMPLE 4: API with Batch Operation Schemas
 *
 * Use when you want validation for batch operations.
 */

/*
import { createCrudRoutes } from '@/core/api';
import { leaveRequestService } from './service';
import { 
  LeaveRequestCreateSchema,
  LeaveRequestUpdateSchema,
  LeaveRequestBatchCreateSchema,
} from './schemas';

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: leaveRequestService,
  schemas: {
    create: LeaveRequestCreateSchema,
    update: LeaveRequestUpdateSchema,
    batchCreate: LeaveRequestBatchCreateSchema,
  },
  resourceName: 'Leave Request',
});
*/

/**
 * EXAMPLE 5: API with Custom DELETE Protection
 *
 * Override DELETE to add additional safety checks.
 */

/*
import type { NextRequest } from 'next/server';
import { createCrudRoutes, ApiResponse } from '@/core/api';
import { transactionService } from './service';
import { TransactionCreateSchema, TransactionUpdateSchema } from './schemas';
import { validateMassDeleteConfirmation } from '@/lib/safety/mass-deletion';

// Get default handlers but don't export DELETE
const { GET, POST, PUT } = createCrudRoutes({
  service: transactionService,
  schemas: {
    create: TransactionCreateSchema,
    update: TransactionUpdateSchema,
  },
  resourceName: 'Transaction',
});

export { GET, POST, PUT };

// Custom DELETE with extra protection
export async function DELETE(request: NextRequest) {
  // Require confirmation token for mass deletion
  const validation = validateMassDeleteConfirmation(request, 'TRANSACTIONS');
  if (validation) {
    return validation;
  }

  // Additional business logic check
  const hasUnsettled = await transactionService.hasUnsettledTransactions();
  if (hasUnsettled) {
    return ApiResponse.conflict(
      'Cannot delete transactions',
      'There are unsettled transactions that must be resolved first'
    );
  }

  const result = await transactionService.deleteAll();
  return ApiResponse.success(result, `Deleted ${result.count} transactions`);
}
*/

/**
 * EXAMPLE 6: API with ID Conversion
 *
 * Use when database uses integers but client expects strings.
 */

/*
import { createCrudRoutes } from '@/core/api';
import { orderService } from './service';
import { OrderCreateSchema, OrderUpdateSchema } from './schemas';

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: orderService,
  schemas: {
    create: OrderCreateSchema,
    update: OrderUpdateSchema,
  },
  resourceName: 'Order',
  
  // Convert integer IDs to strings for client
  transformResponse: (data) => {
    const transform = (item: any) => ({
      ...item,
      id: String(item.id),
      customerId: String(item.customerId),
    });
    
    return Array.isArray(data)
      ? data.map(transform)
      : transform(data);
  },
});
*/

/**
 * EXAMPLE 7: Single Resource Routes (for /api/resource/[id])
 *
 * Use createSingleResourceRoutes for individual resource endpoints.
 */

/*
import { createSingleResourceRoutes } from '@/core/api';
import { userService } from './service';
import { UserUpdateSchema } from './schemas';

export const { GET, PUT, DELETE } = createSingleResourceRoutes({
  service: userService,
  schema: UserUpdateSchema,
  resourceName: 'User',
});
*/

/**
 * EXAMPLE 8: Hybrid Approach
 *
 * Mix factory-generated routes with custom endpoints.
 */

/*
import type { NextRequest } from 'next/server';
import { createCrudRoutes, ApiResponse } from '@/core/api';
import { employeeService } from './service';
import { EmployeeCreateSchema, EmployeeUpdateSchema } from './schemas';

// Standard CRUD
export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  service: employeeService,
  schemas: {
    create: EmployeeCreateSchema,
    update: EmployeeUpdateSchema,
  },
  resourceName: 'Employee',
});

// Additional custom endpoint
export async function PATCH(request: NextRequest) {
  // Custom logic for partial updates with special business rules
  const body = await request.json();
  const result = await employeeService.specialUpdate(body);
  return ApiResponse.success(result);
}
*/

/**
 * MIGRATION CHECKLIST
 *
 * When migrating existing routes to use the factory:
 *
 * 1. ✓ Ensure service layer exists and implements CrudService interface
 * 2. ✓ Create Zod validation schemas
 * 3. ✓ Replace route handlers with createCrudRoutes call
 * 4. ✓ Add customGet/customPost/customPut/customDelete if needed
 * 5. ✓ Add transformResponse if data needs transformation
 * 6. ✓ Test all CRUD operations
 * 7. ✓ Test validation errors
 * 8. ✓ Test batch operations
 * 9. ✓ Update API documentation
 * 10. ✓ Remove old route code
 */

export {};
