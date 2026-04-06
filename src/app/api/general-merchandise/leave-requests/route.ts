import { prisma } from '@/lib/db';
import { createLeaveRequestRoutes } from '@/modules/shared/employees/api/leaveRequestRouteFactory';

const { GET, POST, PUT, PATCH, DELETE } = createLeaveRequestRoutes({
  leaveRequestModel: {
    findMany: (args) => prisma.generalMerchandiseLeaveRequest.findMany(args),
    findActiveById: (id) =>
      prisma.generalMerchandiseLeaveRequest.findFirst({
        where: { id, deletedAt: null },
      }),
    createMany: (data) =>
      prisma.generalMerchandiseLeaveRequest.createMany({ data }),
    update: (id, data) =>
      prisma.generalMerchandiseLeaveRequest.update({
        where: { id },
        data,
      }),
    softDelete: (id) =>
      prisma.generalMerchandiseLeaveRequest.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
    softDeleteAll: () =>
      prisma.generalMerchandiseLeaveRequest.updateMany({
        where: { deletedAt: null },
        data: { deletedAt: new Date() },
      }),
  },
  employeeModel: {
    findExistingIds: (employeeIds) =>
      prisma.generalMerchandiseEmployee.findMany({
        where: {
          employeeId: { in: employeeIds },
          deletedAt: null,
        },
        select: { employeeId: true },
      }),
  },
});

export { GET, POST, PUT, PATCH, DELETE };
