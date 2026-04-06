import { prisma } from '@/lib/db';
import { createAttendanceRoutes } from '@/modules/shared/employees/api/attendanceRouteFactory';

const { GET, POST, PATCH, DELETE } = createAttendanceRoutes({
  attendanceModel: {
    findMany: (args) =>
      prisma.generalMerchandiseAttendance.findMany({
        ...args,
        orderBy: [...args.orderBy],
      }),
    create: (data) => prisma.generalMerchandiseAttendance.create({ data }),
    createMany: (records) =>
      prisma.$transaction(
        records.map((record) =>
          prisma.generalMerchandiseAttendance.create({ data: record })
        )
      ),
    update: (id, data) =>
      prisma.generalMerchandiseAttendance.update({
        where: { id, deletedAt: null },
        data,
      }),
    softDelete: (id) =>
      prisma.generalMerchandiseAttendance.update({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
  },
  employeeModel: prisma.generalMerchandiseEmployee,
  logMessages: {
    created: 'GM attendance record created',
    bulkCreated: 'GM bulk attendance records created',
    updated: 'GM attendance record updated',
    deleted: 'GM attendance record deleted',
  },
});

export { GET, POST, PATCH, DELETE };
