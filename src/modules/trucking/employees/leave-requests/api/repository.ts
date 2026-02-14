/**
 * Leave Request Repository
 *
 * Data access layer for leave requests
 * Extends BaseRepository with custom query methods
 */

import { LeaveRequestRepositoryBase } from '@/modules/shared/employees/leave-requests/api/repositoryBase';
import type {
  LeaveRequestCreate,
  LeaveRequestUpdate,
  LeaveRequest,
} from './schemas';

/**
 * Leave Request Repository Class
 *
 * Provides data access methods for leave requests with type safety
 *
 * @example
 * ```typescript
 * const repository = new LeaveRequestRepository();
 * const requests = await repository.findByEmployee('EMP-0001');
 * const pending = await repository.findByStatus('pending');
 * ```
 */
export class LeaveRequestRepository extends LeaveRequestRepositoryBase<
  LeaveRequest,
  LeaveRequestCreate,
  LeaveRequestUpdate
> {
  constructor() {
    super('truckingLeaveRequest');
  }
}

// Export singleton instance
export const leaveRequestRepository = new LeaveRequestRepository();
