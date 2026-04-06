import { prisma } from '@/lib/db';
import { createAttendanceApplyLeaveRoute } from '@/modules/shared/employees/api/applyLeaveRouteFactory';

const { POST } = createAttendanceApplyLeaveRoute({
  employeeModel: prisma.employee,
  attendanceModel: prisma.attendance,
});

export { POST };
