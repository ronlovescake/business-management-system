type EmployeeFixtureOverrides = Partial<{
  id: number;
  employeeId: string;
  name: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  department: string;
  position: string;
  jobTitle: string;
  status: string;
  hireDate: string;
  phone: string;
  contact: string;
  email: string;
  basicSalary: number;
  currentSalary: number;
  deletedAt: null;
}>;

export const buildEmployeeFixture = (
  overrides: EmployeeFixtureOverrides = {}
) => ({
  id: 1,
  employeeId: 'EMP-0001',
  name: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  middleName: null,
  department: 'Operations',
  position: 'Manager',
  jobTitle: 'General Manager',
  status: 'active',
  hireDate: '2025-01-01',
  phone: '09123456789',
  contact: '09123456789',
  email: 'john@example.com',
  basicSalary: 50000,
  currentSalary: 55000,
  deletedAt: null,
  ...overrides,
});

export const buildEmployeePairFixture = () => [
  buildEmployeeFixture(),
  buildEmployeeFixture({
    id: 2,
    employeeId: 'EMP-0002',
    name: 'Jane Smith',
    firstName: 'Jane',
    lastName: 'Smith',
    department: 'IT',
    position: 'Developer',
    jobTitle: 'Senior Developer',
    hireDate: '2025-02-01',
    phone: '09198765432',
    contact: '09198765432',
    email: 'jane@example.com',
    basicSalary: 45000,
    currentSalary: 48000,
  }),
];
