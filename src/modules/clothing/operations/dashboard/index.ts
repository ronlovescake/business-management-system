/**
 * Dashboard Module Public API
 *
 * Central export point for Dashboard module
 */

// =============================================================================
// MODULE CONFIGURATION
// =============================================================================

export { dashboardModule } from './module.config';

// =============================================================================
// TYPES
// =============================================================================

export type {
  DashboardData,
  DashboardMetrics,
  DashboardStatistic,
  TodayActivity,
  MonthlyGoal,
  RecentActivity,
  IconComponent,
} from './types/dashboard.types';

// =============================================================================
// SERVICES
// =============================================================================

export {
  DashboardService,
  dashboardService,
} from './services/DashboardService';

// =============================================================================
// HOOKS
// =============================================================================

export { useDashboardData } from './hooks/useDashboardData';

// =============================================================================
// COMPONENTS
// =============================================================================

export { DashboardPage } from './components/DashboardPage';
