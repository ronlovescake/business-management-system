import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type {
  ThirteenthMonthPayRouteFilters,
  ThirteenthMonthPayRouteService,
} from '@/modules/shared/employees/api/thirteenthMonthPayRouteFactory';

type GMThirteenthMonthPayRecord = {
  id: string | number;
  approvedDate?: string | null;
  paidDate?: string | null;
};

function buildWhere(filters: ThirteenthMonthPayRouteFilters) {
  const where: Record<string, unknown> = {};

  if (filters.employeeId) {
    where.employeeId = filters.employeeId;
  }
  if (filters.year !== undefined) {
    where.year = filters.year;
  }
  if (filters.status) {
    where.status = filters.status;
  }

  return Object.keys(where).length > 0 ? where : undefined;
}

export const generalMerchandiseThirteenthMonthPayService: ThirteenthMonthPayRouteService<GMThirteenthMonthPayRecord> =
  {
    findAll: () =>
      prisma.generalMerchandiseThirteenthMonthPayRecord.findMany({
        orderBy: [{ employeeName: 'asc' }, { year: 'desc' }],
      }),
    findWithFilters: (filters) =>
      prisma.generalMerchandiseThirteenthMonthPayRecord.findMany({
        where: buildWhere(filters),
        orderBy: [{ employeeName: 'asc' }, { year: 'desc' }],
      }),
    findByRecordId: (recordId) =>
      prisma.generalMerchandiseThirteenthMonthPayRecord.findFirst({
        where: { recordId },
      }),
    create: (data) =>
      prisma.generalMerchandiseThirteenthMonthPayRecord.create({
        data: data as Prisma.ThirteenthMonthPayRecordCreateInput,
      }),
    update: (id, data) =>
      prisma.generalMerchandiseThirteenthMonthPayRecord.update({
        where: { id },
        data,
      }),
    updateStatusByRecordId: async (recordId, status) => {
      const record =
        await prisma.generalMerchandiseThirteenthMonthPayRecord.findFirst({
          where: { recordId },
        });

      if (!record) {
        throw new Error('Record not found');
      }

      const updateData: Record<string, string> = { status };

      if (status === 'approved' && !record.approvedDate) {
        updateData.approvedDate = new Date().toISOString();
      } else if (status === 'paid' && !record.paidDate) {
        updateData.paidDate = new Date().toISOString();
      }

      return prisma.generalMerchandiseThirteenthMonthPayRecord.update({
        where: { id: record.id },
        data: updateData,
      });
    },
  };
