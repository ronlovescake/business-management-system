import { prisma } from '@/lib/db';
import { createAttendanceApplyLeaveRoute } from '@/modules/shared/employees/api/applyLeaveRouteFactory';

const { POST } = createAttendanceApplyLeaveRoute({
  employeeModel: prisma.generalMerchandiseEmployee,
  attendanceModel: prisma.generalMerchandiseAttendance,
});

export { POST };
