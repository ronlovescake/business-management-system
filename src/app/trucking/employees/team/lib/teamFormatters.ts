import type { Employee } from '../types';

export const getEmployeeInitials = (employee: Employee): string => {
  const firstInitial =
    employee.firstName?.[0] || employee.name?.split(' ')[0]?.[0] || '';
  const lastInitial =
    employee.lastName?.[0] || employee.name?.split(' ')[1]?.[0] || '';
  return `${firstInitial}${lastInitial}`.toUpperCase();
};

export const formatEmployeeType = (value?: string | null): string => {
  if (!value) {
    return 'N/A';
  }

  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-');
};
