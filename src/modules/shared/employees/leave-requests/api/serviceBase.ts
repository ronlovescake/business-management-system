import { logger } from '@/lib/logger';

type LeaveRequestCreateLike = {
  employeeId: string;
  employeeName: string;
  leaveType: string;
  paymentStatus: string;
  startDate: string;
  endDate: string;
  numberOfDays?: number;
  reason: string;
  status: string;
  appliedDate?: string;
  approvedBy?: string | null;
  notes?: string | null;
};

type LeaveRequestEntityLike = {
  id: number | string;
  numberOfDays?: number | null;
};

type LeaveRequestRepositoryLike<TEntity, TUpdateInput> = {
  findMany(options?: unknown): Promise<TEntity[]>;
  findByEmployee(employeeId: string): Promise<TEntity[]>;
  update(id: number, data: TUpdateInput): Promise<TEntity>;
  deleteMany(): Promise<{ count: number }>;
  getStatistics(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    byPaymentStatus: {
      paid: number;
      unpaid: number;
      notApplicable: number;
    };
  }>;
  findOverlappingLeaves(
    employeeId: string,
    startDate: string,
    endDate: string,
    excludeId?: number | string
  ): Promise<TEntity[]>;
  getTotalLeaveDays(
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<number>;
};

type LeaveRequestPrismaAdapter = {
  findExistingEmployeeIds(employeeIds: string[]): Promise<string[]>;
  createManyLeaveRequests(
    data: Array<
      Omit<
        LeaveRequestCreateLike,
        'numberOfDays' | 'appliedDate' | 'approvedBy' | 'notes'
      > & {
        numberOfDays: number;
        appliedDate: string;
        approvedBy: string | null;
        notes: string | null;
      }
    >
  ): Promise<{ count: number }>;
  findEmployeeById(employeeId: string): Promise<unknown | null>;
};

export class LeaveRequestServiceBase<
  TEntity extends LeaveRequestEntityLike,
  TCreateInput extends LeaveRequestCreateLike,
  TUpdateInput,
> {
  private readonly repository: LeaveRequestRepositoryLike<
    TEntity,
    TUpdateInput
  >;
  private readonly prismaAdapter: LeaveRequestPrismaAdapter;

  constructor(
    repository: LeaveRequestRepositoryLike<TEntity, TUpdateInput>,
    prismaAdapter: LeaveRequestPrismaAdapter
  ) {
    this.repository = repository;
    this.prismaAdapter = prismaAdapter;
  }

  async findMany(employeeId?: string) {
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

  async createMany(data: TCreateInput[]) {
    try {
      const employeeIds = Array.from(
        new Set(data.map((item) => item.employeeId))
      );

      if (employeeIds.length > 0) {
        const existingIds = new Set(
          await this.prismaAdapter.findExistingEmployeeIds(employeeIds)
        );
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

      const result =
        await this.prismaAdapter.createManyLeaveRequests(prismaData);

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

  async updateOne(id: number | string, data: TUpdateInput) {
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

  async updateMany(
    updates: Array<{ id: number | string; data: TUpdateInput }>
  ) {
    try {
      const results = await Promise.all(
        updates.map(async (update) => {
          if (Object.keys(update.data as object).length === 0) {
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

  async validateEmployee(employeeId: string): Promise<boolean> {
    try {
      const employee = await this.prismaAdapter.findEmployeeById(employeeId);
      return employee !== null;
    } catch (error) {
      logger.error('Failed to validate employee', { employeeId, error });
      return false;
    }
  }

  async getStatistics() {
    try {
      return await this.repository.getStatistics();
    } catch (error) {
      logger.error('Failed to get leave request statistics', error);
      throw new Error('Failed to get statistics');
    }
  }

  async checkOverlappingLeaves(
    employeeId: string,
    startDate: string,
    endDate: string,
    excludeId?: number | string
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

  async getEmployeeLeaveDays(
    employeeId: string,
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
