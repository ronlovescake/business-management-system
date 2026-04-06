import { prisma } from '@/lib/db';
import { createAttendanceRoutes } from '@/modules/shared/employees/api/attendanceRouteFactory';

const { GET, POST, PATCH, DELETE } = createAttendanceRoutes({
  attendanceModel: {
    findMany: (args) =>
      prisma.attendance.findMany({
        ...args,
        orderBy: [...args.orderBy],
      }),
    create: (data) => prisma.attendance.create({ data }),
    createMany: (records) =>
      prisma.$transaction(
        records.map((record) => prisma.attendance.create({ data: record }))
      ),
    update: (id, data) =>
      prisma.attendance.update({
        where: { id, deletedAt: null },
        data,
      }),
    softDelete: (id) =>
      prisma.attendance.update({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
  },
  employeeModel: prisma.employee,
  logMessages: {
    created: 'Attendance record created',
    bulkCreated: 'Bulk attendance records created',
    updated: 'Attendance record updated',
    deleted: 'Attendance record soft deleted',
  },
});

export { GET, POST, PATCH, DELETE };
