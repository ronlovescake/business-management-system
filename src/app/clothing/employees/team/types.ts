export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  jobTitle: string;
  status: 'active' | 'inactive' | 'on-leave';
  hireDate: string;
  basicSalary: number;
  contact: string;
  email?: string;
  address?: string;
  emergencyContact?: string;
}

export interface EmployeeFormData {
  employeeId: string;
  name: string;
  department: string;
  jobTitle: string;
  status: 'active' | 'inactive' | 'on-leave';
  hireDate: string;
  basicSalary: string;
  contact: string;
  email?: string;
  address?: string;
  emergencyContact?: string;
}
