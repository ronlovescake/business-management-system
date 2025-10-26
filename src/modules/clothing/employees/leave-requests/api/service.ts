/**
 * Leave Request Service
 *
 * Business logic for leave request operations
 * Uses repository pattern for data access
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { LeaveRequestCreate, LeaveRequestUpdate } from './schemas';
import type { LeaveRequestId, EmployeeId } from '@/types/branded';
import { leaveRequestRepository } from './repository';

/**
 * Leave Request Service Class
 *
 * Handles all business logic for leave requests:
 * - CRUD operations (via repository)
 * - Employee validation
 * - Business rules
 * - Conflict detection
 *
 * @example
 * ```typescript
 * const service = new LeaveRequestService();
 * const result = await service.create(data);
 * ```
 */
export class LeaveRequestService {
  private repository = leaveRequestRepository;

  /**
   * Get all leave requests, optionally filtered by employee
   */
  async findMany(employeeId?: EmployeeId) {
    try {
      if (employeeId) {
        return await this.repository.findByEmployee(employeeId);
      }
      return await this.repository.findMany({
        orderBy: { startDate: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to fetch leave requests:', error);
      throw new Error('Failed to fetch leave requests');
    }
  }

  /**
   * Create multiple leave requests (batch operation)
   */
  async createMany(data: LeaveRequestCreate[]) {
    try {
      // Validate all employee IDs exist
      const employeeIds = Array.from(
        new Set(data.map((item) => item.employeeId))
      );

      if (employeeIds.length > 0) {
        const existingEmployees = await prisma.employee.findMany({
          where: {
            employeeId: { in: employeeIds },
            deletedAt: null,
          },
          select: { employeeId: true },
        });

        const existingIds = new Set(existingEmployees.map((e) => e.employeeId));
        const missingIds = employeeIds.filter((id) => !existingIds.has(id));

        if (missingIds.length > 0) {
          return {
            success: false,
            error: 'Referenced employees not found',
            details: `The following employee IDs do not exist: ${missingIds.join(', ')}`,
            missingEmployeeIds: missingIds,
          };
        }
      }

      // Ensure all required fields are present and transform to Prisma format
      const prismaData = data.map((item) => ({
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        leaveType: item.leaveType,
        paymentStatus: item.paymentStatus,
        startDate: item.startDate,
        endDate: item.endDate,
        numberOfDays: item.numberOfDays || 0,
        reason: item.reason,
        status: item.status,
        appliedDate: item.appliedDate || new Date().toISOString().split('T')[0],
        approvedBy: item.approvedBy || null,
        notes: item.notes || null,
      }));

      // Create all leave requests
      const result = await prisma.leaveRequest.createMany({ data: prismaData });

      logger.info('Leave requests created', { count: result.count });

      return {
        success: true,
        count: result.count,
        message: `Successfully imported ${result.count} leave request records`,
      };
    } catch (error) {
      logger.error('Failed to create leave requests', error);
      throw error;
    }
  }

  /**
   * Update a single leave request
   */
  async updateOne(id: LeaveRequestId, data: LeaveRequestUpdate) {
    try {
      const updated = await this.repository.update(id as number, data);

      logger.info('Leave request updated', { id });

      return {
        success: true,
        data: updated,
        message: 'Leave request updated successfully',
      };
    } catch (error) {
      logger.error('Failed to update leave request', { id, error });
      throw error;
    }
  }

  /**
   * Update multiple leave requests (batch operation)
   */
  async updateMany(
    updates: Array<{ id: LeaveRequestId; data: LeaveRequestUpdate }>
  ) {
    try {
      const results = await Promise.all(
        updates.map(async (update) => {
          if (Object.keys(update.data).length === 0) {
            return null;
          }

          return this.repository.update(update.id as number, update.data);
        })
      );

      const updatedCount = results.filter(Boolean).length;

      logger.info('Leave requests bulk updated', { count: updatedCount });

      return {
        success: true,
        count: updatedCount,
        message: `Successfully updated ${updatedCount} leave requests`,
      };
    } catch (error) {
      logger.error('Failed to bulk update leave requests', error);
      throw error;
    }
  }

  /**
   * Delete all leave requests (requires confirmation)
   */
  async deleteAll() {
    try {
      const result = await this.repository.deleteMany();

      logger.warn('Mass deletion executed', {
        entity: 'leave_requests',
        count: result.count,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        count: result.count,
        message: `Successfully deleted ${result.count} leave request records`,
      };
    } catch (error) {
      logger.error('Failed to delete leave requests', error);
      throw new Error('Failed to delete leave requests');
    }
  }

  /**
   * Check if an employee exists and is not deleted
   */
  async validateEmployee(employeeId: EmployeeId): Promise<boolean> {
    try {
      const employee = await prisma.employee.findFirst({
        where: {
          employeeId,
          deletedAt: null,
        },
      });

      return employee !== null;
    } catch (error) {
      logger.error('Failed to validate employee', { employeeId, error });
      return false;
    }
  }

  /**
   * Get leave request statistics
   */
  async getStatistics() {
    try {
      return await this.repository.getStatistics();
    } catch (error) {
      logger.error('Failed to get leave request statistics', error);
      throw new Error('Failed to get statistics');
    }
  }

  /**
   * Check for overlapping leave requests
   * Useful for validation before creating/updating leave requests
   */
  async checkOverlappingLeaves(
    employeeId: EmployeeId,
    startDate: string,
    endDate: string,
    excludeId?: LeaveRequestId
  ) {
    try {
      const overlapping = await this.repository.findOverlappingLeaves(
        employeeId,
        startDate,
        endDate,
        excludeId
      );

      return {
        hasOverlap: overlapping.length > 0,
        overlappingLeaves: overlapping,
      };
    } catch (error) {
      logger.error('Failed to check overlapping leaves', error);
      throw new Error('Failed to check overlapping leaves');
    }
  }

  /**
   * Get total leave days taken by an employee
   */
  async getEmployeeLeaveDays(
    employeeId: EmployeeId,
    startDate: string,
    endDate: string
  ) {
    try {
      return await this.repository.getTotalLeaveDays(
        employeeId,
        startDate,
        endDate
      );
    } catch (error) {
      logger.error('Failed to get employee leave days', error);
      throw new Error('Failed to get employee leave days');
    }
  }
}

// Export singleton instance
export const leaveRequestService = new LeaveRequestService();
