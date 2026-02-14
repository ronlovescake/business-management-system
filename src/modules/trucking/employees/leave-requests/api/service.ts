/**
 * Leave Request Service
 *
 * Business logic for leave request operations
 * Uses repository pattern for data access
 */

import { prisma } from '@/lib/db';
import { LeaveRequestServiceBase } from '@/modules/shared/employees/leave-requests/api/serviceBase';
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
export class LeaveRequestService extends LeaveRequestServiceBase<
  {
    id: number;
    numberOfDays?: number | null;
  },
  LeaveRequestCreate,
  LeaveRequestUpdate
> {
  constructor() {
    super(leaveRequestRepository, {
      findExistingEmployeeIds: async (employeeIds: string[]) => {
        const existingEmployees = await prisma.truckingEmployee.findMany({
          where: {
            employeeId: { in: employeeIds },
            deletedAt: null,
          },
          select: { employeeId: true },
        });

        return existingEmployees.map((employee) => employee.employeeId);
      },
      createManyLeaveRequests: async (data) => {
        return await prisma.truckingLeaveRequest.createMany({ data });
      },
      findEmployeeById: async (employeeId: string) => {
        return await prisma.truckingEmployee.findFirst({
          where: {
            employeeId,
            deletedAt: null,
          },
        });
      },
    });
  }

  async findMany(employeeId?: EmployeeId) {
    return await super.findMany(employeeId);
  }

  async updateOne(id: LeaveRequestId, data: LeaveRequestUpdate) {
    return await super.updateOne(id, data);
  }

  async updateMany(
    updates: Array<{ id: LeaveRequestId; data: LeaveRequestUpdate }>
  ) {
    return await super.updateMany(updates);
  }

  async validateEmployee(employeeId: EmployeeId): Promise<boolean> {
    return await super.validateEmployee(employeeId);
  }

  async checkOverlappingLeaves(
    employeeId: EmployeeId,
    startDate: string,
    endDate: string,
    excludeId?: LeaveRequestId
  ) {
    return await super.checkOverlappingLeaves(
      employeeId,
      startDate,
      endDate,
      excludeId
    );
  }

  async getEmployeeLeaveDays(
    employeeId: EmployeeId,
    startDate: string,
    endDate: string
  ) {
    return await super.getEmployeeLeaveDays(employeeId, startDate, endDate);
  }
}

// Export singleton instance
export const leaveRequestService = new LeaveRequestService();
