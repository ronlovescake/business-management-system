import { prisma } from '@/lib/db';
import { createEmployeeSalaryHistoryRoutes } from '@/modules/employees/salary-history/api/routeFactory';

const { GET, POST } = createEmployeeSalaryHistoryRoutes({
  employeeDelegate: prisma.truckingEmployee,
  salaryHistoryDelegate: prisma.truckingSalaryHistory,
  loggerScope: 'Trucking',
});

export { GET, POST };
