import { prisma } from '@/lib/db';
import { createAttendanceRoutes } from '@/modules/shared/employees/api/attendanceRouteFactory';

const { GET, POST, PATCH, DELETE } = createAttendanceRoutes({
  attendanceModel: {
    findMany: (args) =>
      prisma.truckingAttendance.findMany({
        ...args,
        orderBy: [...args.orderBy],
      }),
    create: (data) => prisma.truckingAttendance.create({ data }),
    createMany: (records) =>
      prisma.$transaction(
        records.map((record) =>
          prisma.truckingAttendance.create({ data: record })
        )
      ),
    update: (id, data) =>
      prisma.truckingAttendance.update({
        where: { id, deletedAt: null },
        data,
      }),
    softDelete: (id) =>
      prisma.truckingAttendance.update({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
  },
  employeeModel: prisma.truckingEmployee,
  logMessages: {
    created: 'Trucking attendance record created',
    bulkCreated: 'Bulk trucking attendance records created',
    updated: 'Trucking attendance record updated',
    deleted: 'Trucking attendance record soft deleted',
  },
});

export { GET, POST, PATCH, DELETE };
