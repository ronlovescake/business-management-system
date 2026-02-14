/**
 * Leave Request Repository
 *
 * Data access layer for leave requests
 * Extends BaseRepository with custom query methods
 *
 * Note: This file contains 'as any' type assertions due to incompatibility between
 * BaseRepository's generic types and Prisma's strict where clause types. This is an
 * architectural limitation that would require refactoring BaseRepository to resolve.
 * The eslint warnings are accepted as unavoidable in this context.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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
