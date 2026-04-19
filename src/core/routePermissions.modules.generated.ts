/**
 * AUTO-GENERATED FILE. Do not edit by hand.
 *
 * Regenerate with: npm run codegen:route-permissions
 *
 * This file catalogs every module currently registered via
 * `moduleRegistry.register()` in `src/modules/index.ts`, including the
 * route paths and permission strings each module declares.
 *
 * The auth middleware does NOT import this file. The hand-maintained
 * `src/core/routePermissions.ts` remains the single runtime source of
 * truth (keeping the edge bundle free of any registry code). This file
 * exists for drift detection (`scripts/check-module-route-acl.js`) and
 * for reviewer visibility.
 */

/* eslint-disable */

export type ModuleRouteCatalogEntry = {
  moduleVar: string;
  file: string;
  paths: string[];
  /** Module-level permission strings (e.g. "admin", "operations"). */
  permissions: string[];
};

export const MODULE_ROUTE_CATALOG: ModuleRouteCatalogEntry[] = [
  {
    moduleVar: 'customersModule',
    file: 'src/modules/clothing/operations/customers/module.config.ts',
    paths: ['/clothing/operations/customers', '/clothing/operations/customers'],
    permissions: ['admin', 'manager', 'operations'],
  },
  {
    moduleVar: 'dashboardModule',
    file: 'src/modules/clothing/operations/dashboard/module.config.ts',
    paths: ['/clothing/operations/dashboard', '/clothing/operations/dashboard'],
    permissions: ['admin', 'manager', 'operations'],
  },
  {
    moduleVar: 'dispatchModule',
    file: 'src/modules/clothing/operations/dispatch/module.config.ts',
    paths: ['/clothing/operations/dispatch'],
    permissions: [],
  },
  {
    moduleVar: 'fleetRegistryModule',
    file: 'src/modules/trucking/operations/fleet-registry/module.config.ts',
    paths: [
      '/trucking/operations/fleet-registry',
      '/trucking/operations/fleet-registry',
    ],
    permissions: ['admin', 'manager', 'operations'],
  },
  {
    moduleVar: 'generalMerchandiseCheckoutLinksModule',
    file: 'src/modules/general-merchandise/operations/checkout-links/module.config.ts',
    paths: ['/general-merchandise/operations/checkout-links'],
    permissions: [],
  },
  {
    moduleVar: 'generalMerchandiseCustomersModule',
    file: 'src/modules/general-merchandise/operations/customers/module.config.ts',
    paths: ['/general-merchandise/operations/customers'],
    permissions: ['admin', 'manager', 'operations'],
  },
  {
    moduleVar: 'generalMerchandiseDashboardModule',
    file: 'src/modules/general-merchandise/operations/dashboard/module.config.ts',
    paths: [
      '/general-merchandise/operations/dashboard',
      '/general-merchandise/operations/dashboard',
    ],
    permissions: ['admin', 'manager', 'operations'],
  },
  {
    moduleVar: 'generalMerchandiseDispatchModule',
    file: 'src/modules/general-merchandise/operations/dispatch/module.config.ts',
    paths: ['/general-merchandise/operations/dispatch'],
    permissions: [],
  },
  {
    moduleVar: 'generalMerchandiseInventoryModule',
    file: 'src/modules/general-merchandise/operations/inventory/module.config.ts',
    paths: ['/general-merchandise/operations/inventory'],
    permissions: ['admin', 'manager', 'operations'],
  },
  {
    moduleVar: 'generalMerchandiseMessageTemplatesModule',
    file: 'src/modules/general-merchandise/operations/message-templates/module.config.ts',
    paths: ['/general-merchandise/operations/message-templates'],
    permissions: [],
  },
  {
    moduleVar: 'generalMerchandisePostTemplateModule',
    file: 'src/modules/general-merchandise/operations/post-template/module.config.ts',
    paths: ['/general-merchandise/operations/post-template'],
    permissions: [],
  },
  {
    moduleVar: 'generalMerchandisePricesModule',
    file: 'src/modules/general-merchandise/operations/prices/module.config.ts',
    paths: ['/general-merchandise/operations/prices'],
    permissions: [],
  },
  {
    moduleVar: 'generalMerchandiseProductsModule',
    file: 'src/modules/general-merchandise/operations/products/module.config.ts',
    paths: ['/general-merchandise/operations/products'],
    permissions: [],
  },
  {
    moduleVar: 'generalMerchandiseSettingsModule',
    file: 'src/modules/general-merchandise/operations/settings/module.config.ts',
    paths: [
      '/general-merchandise/operations/settings',
      '/general-merchandise/operations/settings',
    ],
    permissions: ['admin', 'manager'],
  },
  {
    moduleVar: 'generalMerchandiseShipmentsModule',
    file: 'src/modules/general-merchandise/operations/shipments/module.config.ts',
    paths: ['/general-merchandise/operations/shipments'],
    permissions: [],
  },
  {
    moduleVar: 'generalMerchandiseSortingDistributionModule',
    file: 'src/modules/general-merchandise/operations/sorting-distribution/module.config.ts',
    paths: ['/general-merchandise/operations/sorting-distribution'],
    permissions: [],
  },
  {
    moduleVar: 'generalMerchandiseTransactionsModule',
    file: 'src/modules/general-merchandise/operations/transactions/module.config.ts',
    paths: [
      '/general-merchandise/operations/transactions',
      '/general-merchandise/operations/transactions',
    ],
    permissions: ['admin', 'manager', 'operations', 'finance'],
  },
  {
    moduleVar: 'inventoryModule',
    file: 'src/modules/clothing/operations/inventory/module.config.ts',
    paths: ['/clothing/operations/inventory', '/clothing/operations/inventory'],
    permissions: ['admin', 'manager', 'operations'],
  },
  {
    moduleVar: 'pricesModule',
    file: 'src/modules/clothing/operations/prices/module.config.ts',
    paths: ['/clothing/operations/prices', '/clothing/operations/prices'],
    permissions: ['admin', 'manager', 'operations'],
  },
  {
    moduleVar: 'settingsModule',
    file: 'src/modules/clothing/operations/settings/module.config.ts',
    paths: ['/clothing/operations/settings', '/clothing/operations/settings'],
    permissions: ['admin', 'manager'],
  },
  {
    moduleVar: 'shipmentsModule',
    file: 'src/modules/clothing/operations/shipments/module.config.ts',
    paths: ['/clothing/operations/shipments'],
    permissions: [],
  },
  {
    moduleVar: 'sortingDistributionModule',
    file: 'src/modules/clothing/operations/sorting-distribution/module.config.ts',
    paths: ['/clothing/operations/sorting-distribution'],
    permissions: [],
  },
  {
    moduleVar: 'transactionsModule',
    file: 'src/modules/clothing/operations/transactions/module.config.ts',
    paths: [
      '/clothing/operations/transactions',
      '/clothing/operations/transactions',
    ],
    permissions: ['admin', 'manager', 'operations', 'finance'],
  },
  {
    moduleVar: 'truckingTripsModule',
    file: 'src/modules/trucking/operations/trips/module.config.ts',
    paths: ['/trucking/operations/trips'],
    permissions: [],
  },
  {
    moduleVar: 'vehicleAssignmentsModule',
    file: 'src/modules/trucking/operations/vehicle-assignments/module.config.ts',
    paths: [
      '/trucking/operations/vehicle-assignments',
      '/trucking/operations/vehicle-assignments',
    ],
    permissions: ['admin', 'manager', 'operations'],
  },
];
