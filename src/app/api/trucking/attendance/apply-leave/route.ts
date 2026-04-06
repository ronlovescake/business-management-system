import { prisma } from '@/lib/db';
import { createAttendanceApplyLeaveRoute } from '@/modules/shared/employees/api/applyLeaveRouteFactory';

const { POST } = createAttendanceApplyLeaveRoute({
  employeeModel: prisma.truckingEmployee,
  attendanceModel: prisma.truckingAttendance,
});

export { POST };
