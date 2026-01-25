/**
 * Central Module Registry
 *
 * This file registers all modules in the system.
 * Import and register your modules here.
 */

import { moduleRegistry } from '@/core/ModuleRegistry';

// ============================================================================
// CLOTHING BUSINESS MODULES
// ============================================================================

// Operations
import { dashboardModule } from './clothing/operations/dashboard';
import { customersModule } from './clothing/operations/customers';
import { transactionsModule } from './clothing/operations/transactions';
// import { pickupFormModule } from './clothing/operations/pickup-form';
import { shipmentsModule } from './clothing/operations/shipments';
import { productsModule } from './clothing/operations/products';
import { inventoryModule } from './clothing/operations/inventory';
import { pricesModule } from './clothing/operations/prices';
import { sortingDistributionModule } from './clothing/operations/sorting-distribution';
import { dispatchModule } from './clothing/operations/dispatch';
import { settingsModule } from './clothing/operations/settings';

// Employees
// import { attendanceModule } from './clothing/employees/attendance';
// import { payrollModule } from './clothing/employees/payroll';

// Inventory
// import { productsModule } from './clothing/inventory/products';
// import { stockModule } from './clothing/inventory/stock';

// ============================================================================
// TRUCKING BUSINESS MODULES
// ============================================================================

// Operations
// import { deliveriesModule } from './trucking/operations/deliveries';
// import { routesModule } from './trucking/operations/routes';
import { truckingTripsModule } from './trucking/operations/trips';
import { vehicleAssignmentsModule } from './trucking/operations/vehicle-assignments';
import { fleetRegistryModule } from './trucking/operations/fleet-registry';

// General Merchandise
import { generalMerchandiseTransactionsModule } from './general-merchandise/operations/transactions';

// Employees
// import { expensesModule } from './trucking/employees/expenses';
// import { timesheetsModule } from './trucking/employees/timesheets';

// Fleet
// import { vehiclesModule } from './trucking/fleet/vehicles';
// import { maintenanceModule } from './trucking/fleet/maintenance';

// ============================================================================
// REGISTER MODULES
// ============================================================================

// Uncomment as you create modules:

// Clothing
moduleRegistry.register(dashboardModule); // ✅ REGISTERED!
moduleRegistry.register(customersModule); // ✅ REGISTERED!
moduleRegistry.register(transactionsModule); // ✅ REGISTERED!
// moduleRegistry.register(pickupFormModule);
moduleRegistry.register(shipmentsModule); // ✅ REGISTERED!
moduleRegistry.register(productsModule); // ✅ REGISTERED!
moduleRegistry.register(inventoryModule); // ✅ REGISTERED!
moduleRegistry.register(pricesModule); // ✅ REGISTERED!
moduleRegistry.register(sortingDistributionModule); // ✅ REGISTERED!
moduleRegistry.register(dispatchModule); // ✅ REGISTERED!
moduleRegistry.register(settingsModule); // ✅ REGISTERED!
// moduleRegistry.register(attendanceModule);
// moduleRegistry.register(payrollModule);
// moduleRegistry.register(productsModule);
// moduleRegistry.register(stockModule);

// General Merchandise
moduleRegistry.register(generalMerchandiseTransactionsModule);

// Trucking
// moduleRegistry.register(deliveriesModule);
// moduleRegistry.register(routesModule);
moduleRegistry.register(truckingTripsModule);
moduleRegistry.register(vehicleAssignmentsModule);
moduleRegistry.register(fleetRegistryModule);
// moduleRegistry.register(expensesModule);
// moduleRegistry.register(timesheetsModule);
// moduleRegistry.register(vehiclesModule);
// moduleRegistry.register(maintenanceModule);

// ============================================================================
// EXPORT REGISTRY
// ============================================================================

export { moduleRegistry };

// Optional: Export module stats for debugging
export function getModuleStats() {
  return moduleRegistry.getStats();
}

// Optional: Get all enabled modules
export function getEnabledModules() {
  return moduleRegistry.getEnabled();
}
