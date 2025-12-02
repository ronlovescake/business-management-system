import { prisma } from '@/lib/db';
import { createEmployeeSalaryHistoryRoutes } from '@/modules/employees/salary-history/api/routeFactory';

const { GET, POST } = createEmployeeSalaryHistoryRoutes({
  employeeDelegate: prisma.employee,
  salaryHistoryDelegate: prisma.salaryHistory,
  loggerScope: 'Clothing',
});

export { GET, POST };
