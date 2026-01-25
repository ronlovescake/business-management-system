import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { createCashAdvanceRoutes } from '@/modules/employees/cash-advance/api/routeFactory';
import {
  CashAdvanceQuerySchema,
  CashAdvanceCreateSchema,
  CashAdvanceUpdateSchema,
  type CashAdvanceQuery,
  type CashAdvanceCreateInput,
  type CashAdvanceUpdateInput,
} from '@/modules/clothing/employees/cash-advance/api';

const gmPrisma = prisma as unknown as {
  generalMerchandiseCashAdvanceRecord: typeof prisma.cashAdvanceRecord;
};

const buildWhere = (
  filters: CashAdvanceQuery
): Prisma.CashAdvanceRecordWhereInput => {
  const where: Prisma.CashAdvanceRecordWhereInput = {};

  if (filters.employeeId) {
    where.employeeId = filters.employeeId;
  }

  if (filters.employeeName) {
    where.employeeName = {
      contains: filters.employeeName,
      mode: 'insensitive',
    };
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.amount = {};
    if (filters.minAmount !== undefined) {
      where.amount.gte = filters.minAmount;
    }
    if (filters.maxAmount !== undefined) {
      where.amount.lte = filters.maxAmount;
    }
  }

  if (filters.startDate || filters.endDate) {
    where.requestDate = {};
    if (filters.startDate) {
      where.requestDate.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.requestDate.lte = filters.endDate;
    }
  }

  if (filters.hasBalance) {
    where.remainingBalance = {
      gt: 0,
    };
  }

  return where;
};

const cashAdvanceService = {
  findAll: async () =>
    gmPrisma.generalMerchandiseCashAdvanceRecord.findMany({
      orderBy: { requestDate: 'desc' },
    }),
  findWithFilters: async (filters: CashAdvanceQuery) =>
    gmPrisma.generalMerchandiseCashAdvanceRecord.findMany({
      where: buildWhere(filters),
      orderBy: { requestDate: 'desc' },
    }),
  create: async (data: CashAdvanceCreateInput) =>
    gmPrisma.generalMerchandiseCashAdvanceRecord.create({
      data,
    }),
  update: async (id: string, data: Partial<CashAdvanceUpdateInput>) =>
    gmPrisma.generalMerchandiseCashAdvanceRecord.update({
      where: { id },
      data,
    }),
  delete: async (id: string) => {
    await gmPrisma.generalMerchandiseCashAdvanceRecord.delete({
      where: { id },
    });
  },
};

const { GET, POST, PUT, DELETE } = createCashAdvanceRoutes({
  service: cashAdvanceService,
  schemas: {
    query: CashAdvanceQuerySchema,
    create: CashAdvanceCreateSchema,
    update: CashAdvanceUpdateSchema,
  },
  loggerScope: 'General merchandise cash advance',
});

export { GET, POST, PUT, DELETE };
