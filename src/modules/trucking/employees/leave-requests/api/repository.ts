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

import { BaseRepository } from '@/core/database/repository/BaseRepository';
import type {
  LeaveRequestCreate,
  LeaveRequestUpdate,
  LeaveRequest,
  LeaveStatus,
  PaymentStatus,
} from './schemas';
import type { LeaveRequestId, EmployeeId } from '@/types/branded';
import { logger } from '@/lib/logger';

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
export class LeaveRequestRepository extends BaseRepository<
  LeaveRequest,
  LeaveRequestCreate,
  LeaveRequestUpdate
> {
  protected readonly modelName = 'truckingLeaveRequest';

  /**
   * Find all leave requests for a specific employee
   *
   * @param employeeId - Employee ID
   * @returns Array of leave requests
   */
  async findByEmployee(employeeId: EmployeeId): Promise<LeaveRequest[]> {
    try {
      return await this.findMany({
        where: { employeeId } as any,
        orderBy: { startDate: 'desc' },
      });
    } catch (error) {
      logger.error('findByEmployee failed', { employeeId, error });
      throw error;
    }
  }

  /**
   * Find all leave requests with a specific status
   *
   * @param status - Leave status
   * @returns Array of leave requests
   */
  async findByStatus(status: LeaveStatus): Promise<LeaveRequest[]> {
    try {
      return await this.findMany({
        where: { status } as any,
        orderBy: { appliedDate: 'desc' },
      });
    } catch (error) {
      logger.error('findByStatus failed', { status, error });
      throw error;
    }
  }

  /**
   * Find leave requests within a date range
   *
   * @param startDate - Range start date
   * @param endDate - Range end date
   * @returns Array of leave requests
   */
  async findByDateRange(
    startDate: string,
    endDate: string
  ): Promise<LeaveRequest[]> {
    try {
      return await this.findMany({
        where: {
          AND: [
            { startDate: { gte: startDate } } as any,
            { endDate: { lte: endDate } } as any,
          ],
        } as any,
        orderBy: { startDate: 'asc' },
      });
    } catch (error) {
      logger.error('findByDateRange failed', { startDate, endDate, error });
      throw error;
    }
  }

  /**
   * Find pending leave requests for a specific employee
   *
   * @param employeeId - Employee ID
   * @returns Array of pending leave requests
   */
  async findPendingByEmployee(employeeId: EmployeeId): Promise<LeaveRequest[]> {
    try {
      return await this.findMany({
        where: {
          employeeId,
          status: 'pending',
        } as any,
        orderBy: { appliedDate: 'desc' },
      });
    } catch (error) {
      logger.error('findPendingByEmployee failed', { employeeId, error });
      throw error;
    }
  }

  /**
   * Find leave requests by payment status
   *
   * @param paymentStatus - Payment status
   * @returns Array of leave requests
   */
  async findByPaymentStatus(
    paymentStatus: PaymentStatus
  ): Promise<LeaveRequest[]> {
    try {
      return await this.findMany({
        where: { paymentStatus } as any,
        orderBy: { startDate: 'desc' },
      });
    } catch (error) {
      logger.error('findByPaymentStatus failed', { paymentStatus, error });
      throw error;
    }
  }

  /**
   * Get statistics for leave requests
   *
   * @returns Object with count statistics
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    byPaymentStatus: {
      paid: number;
      unpaid: number;
      notApplicable: number;
    };
  }> {
    try {
      const [total, pending, approved, rejected, paid, unpaid, notApplicable] =
        await Promise.all([
          this.count(),
          this.count({ status: 'pending' } as any),
          this.count({ status: 'approved' } as any),
          this.count({ status: 'rejected' } as any),
          this.count({ paymentStatus: 'paid' } as any),
          this.count({ paymentStatus: 'unpaid' } as any),
          this.count({ paymentStatus: 'not-applicable' } as any),
        ]);

      return {
        total,
        pending,
        approved,
        rejected,
        byPaymentStatus: {
          paid,
          unpaid,
          notApplicable,
        },
      };
    } catch (error) {
      logger.error('getStatistics failed', error);
      throw error;
    }
  }

  /**
   * Find overlapping leave requests for an employee
   * Used to detect conflicting leave periods
   *
   * @param employeeId - Employee ID
   * @param startDate - Start date of leave
   * @param endDate - End date of leave
   * @param excludeId - Optional ID to exclude from results (for updates)
   * @returns Array of overlapping leave requests
   */
  async findOverlappingLeaves(
    employeeId: EmployeeId,
    startDate: string,
    endDate: string,
    excludeId?: LeaveRequestId
  ): Promise<LeaveRequest[]> {
    try {
      const where: any = {
        employeeId,
        OR: [
          // New leave starts during existing leave
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: startDate } },
            ],
          },
          // New leave ends during existing leave
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: endDate } },
            ],
          },
          // New leave completely contains existing leave
          {
            AND: [
              { startDate: { gte: startDate } },
              { endDate: { lte: endDate } },
            ],
          },
        ],
      };

      if (excludeId) {
        where.NOT = { id: excludeId as number };
      }

      return await this.findMany({ where });
    } catch (error) {
      logger.error('findOverlappingLeaves failed', {
        employeeId,
        startDate,
        endDate,
        error,
      });
      throw error;
    }
  }

  /**
   * Get total leave days for an employee within a date range
   *
   * @param employeeId - Employee ID
   * @param startDate - Range start date
   * @param endDate - Range end date
   * @param status - Optional status filter (default: 'approved')
   * @returns Total number of leave days
   */
  async getTotalLeaveDays(
    employeeId: EmployeeId,
    startDate: string,
    endDate: string,
    status: LeaveStatus = 'approved'
  ): Promise<number> {
    try {
      const leaves = await this.findMany({
        where: {
          employeeId,
          status,
          AND: [
            { startDate: { gte: startDate } } as any,
            { endDate: { lte: endDate } } as any,
          ],
        } as any,
      });

      return leaves.reduce(
        (total, leave) => total + (leave.numberOfDays || 0),
        0
      );
    } catch (error) {
      logger.error('getTotalLeaveDays failed', {
        employeeId,
        startDate,
        endDate,
        status,
        error,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const leaveRequestRepository = new LeaveRequestRepository();
