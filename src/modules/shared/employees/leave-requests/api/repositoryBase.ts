import { BaseRepository } from '@/core/database/repository/BaseRepository';
import type {
  OrderByInput,
  WhereInput,
} from '@/core/database/repository/BaseRepository';
import type { PrismaModelName } from '@/types/prisma';
import { logger } from '@/lib/logger';

type LeaveRequestIdLike = number | string;
type EmployeeIdLike = string;
type LeaveStatusLike = string;
type PaymentStatusLike = string;

type LeaveRequestEntity = {
  numberOfDays?: number | null;
};

export class LeaveRequestRepositoryBase<
  TEntity extends LeaveRequestEntity,
  TCreateInput,
  TUpdateInput,
> extends BaseRepository<TEntity, TCreateInput, TUpdateInput> {
  protected readonly modelName: PrismaModelName;

  constructor(modelName: PrismaModelName) {
    super();
    this.modelName = modelName;
  }

  private toWhereInput(value: Record<string, unknown>): WhereInput<TEntity> {
    return value as unknown as WhereInput<TEntity>;
  }

  private toOrderByInput(
    value: Record<string, 'asc' | 'desc'>
  ): OrderByInput<TEntity> {
    return value as unknown as OrderByInput<TEntity>;
  }

  async findByEmployee(employeeId: EmployeeIdLike): Promise<TEntity[]> {
    try {
      return await this.findMany({
        where: this.toWhereInput({ employeeId }),
        orderBy: this.toOrderByInput({ startDate: 'desc' }),
      });
    } catch (error) {
      logger.error('findByEmployee failed', { employeeId, error });
      throw error;
    }
  }

  async findByStatus(status: LeaveStatusLike): Promise<TEntity[]> {
    try {
      return await this.findMany({
        where: this.toWhereInput({ status }),
        orderBy: this.toOrderByInput({ appliedDate: 'desc' }),
      });
    } catch (error) {
      logger.error('findByStatus failed', { status, error });
      throw error;
    }
  }

  async findByDateRange(
    startDate: string,
    endDate: string
  ): Promise<TEntity[]> {
    try {
      return await this.findMany({
        where: {
          AND: [
            { startDate: { gte: startDate } },
            { endDate: { lte: endDate } },
          ],
        } as unknown as WhereInput<TEntity>,
        orderBy: this.toOrderByInput({ startDate: 'asc' }),
      });
    } catch (error) {
      logger.error('findByDateRange failed', { startDate, endDate, error });
      throw error;
    }
  }

  async findPendingByEmployee(employeeId: EmployeeIdLike): Promise<TEntity[]> {
    try {
      return await this.findMany({
        where: {
          employeeId,
          status: 'pending',
        } as unknown as WhereInput<TEntity>,
        orderBy: this.toOrderByInput({ appliedDate: 'desc' }),
      });
    } catch (error) {
      logger.error('findPendingByEmployee failed', { employeeId, error });
      throw error;
    }
  }

  async findByPaymentStatus(
    paymentStatus: PaymentStatusLike
  ): Promise<TEntity[]> {
    try {
      return await this.findMany({
        where: this.toWhereInput({ paymentStatus }),
        orderBy: this.toOrderByInput({ startDate: 'desc' }),
      });
    } catch (error) {
      logger.error('findByPaymentStatus failed', { paymentStatus, error });
      throw error;
    }
  }

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
          this.count(this.toWhereInput({ status: 'pending' })),
          this.count(this.toWhereInput({ status: 'approved' })),
          this.count(this.toWhereInput({ status: 'rejected' })),
          this.count(this.toWhereInput({ paymentStatus: 'paid' })),
          this.count(this.toWhereInput({ paymentStatus: 'unpaid' })),
          this.count(this.toWhereInput({ paymentStatus: 'not-applicable' })),
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

  async findOverlappingLeaves(
    employeeId: EmployeeIdLike,
    startDate: string,
    endDate: string,
    excludeId?: LeaveRequestIdLike
  ): Promise<TEntity[]> {
    try {
      const where: Record<string, unknown> = {
        employeeId,
        OR: [
          {
            AND: [
              { startDate: { lte: startDate } },
              { endDate: { gte: startDate } },
            ],
          },
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: endDate } },
            ],
          },
          {
            AND: [
              { startDate: { gte: startDate } },
              { endDate: { lte: endDate } },
            ],
          },
        ],
      };

      if (excludeId) {
        where.NOT = { id: excludeId };
      }

      return await this.findMany({ where: this.toWhereInput(where) });
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

  async getTotalLeaveDays(
    employeeId: EmployeeIdLike,
    startDate: string,
    endDate: string,
    status: LeaveStatusLike = 'approved'
  ): Promise<number> {
    try {
      const leaves = await this.findMany({
        where: {
          employeeId,
          status,
          AND: [
            { startDate: { gte: startDate } },
            { endDate: { lte: endDate } },
          ],
        } as unknown as WhereInput<TEntity>,
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
