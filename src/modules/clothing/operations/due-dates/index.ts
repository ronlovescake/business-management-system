/**
 * Due Dates Module - Public API
 *
 * This is the only file other modules should import from.
 */

// Export module configuration
export { dueDatesModule } from './module.config';

// Export types
export type {
  DueDateItem,
  DueDateFilters,
  DueDateStats,
} from './types/dueDate.types';

// Export services (in case other modules need them)
export { DueDateService } from './services/DueDateService';

// Export hooks
export { useDueDateData } from './hooks/useDueDateData';

// Export components
export { DueDatesPage } from './components/DueDatesPage';
