import { useState, useMemo } from 'react';
import type { Employee, EmployeeFormData } from '../types';

export function useTeam() {
  // State Management
  const [employees, setEmployees] = useState<Employee[]>([
    {
      id: '1',
      employeeId: 'EMP-001',
      name: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      middleName: 'Michael',
      department: 'Sales',
      jobTitle: 'Sales Manager',
      position: 'Sales Manager',
      status: 'active',
      hireDate: '2022-01-15',
      basicSalary: 35000,
      currentSalary: 38000,
      contact: '09171234567',
      phone: '09171234567',
      email: 'john.doe@company.com',
      address: '123 Main St, Makati City, Metro Manila',
      emergencyContact: '09171234999',
      emergencyContactPerson: 'Jane Doe (Wife)',
      emergencyContactNumber: '09171234999',
      // Government IDs
      sssNumber: '34-1234567-8',
      philHealthNumber: '12-345678901-2',
      hdmfNumber: '1234-5678-9012',
      tinNumber: '123-456-789-000',
      // Personal Information
      gender: 'male',
      education: 'Bachelor of Science in Business Administration',
      dateOfBirth: '1990-05-15',
      maritalStatus: 'married',
      numberOfKids: 2,
      drivingLicense: 'N12-34-567890',
      // Employment Details
      employmentStatus: 'regular',
      employeeType: 'full-time',
      office: 'Main Office - Makati',
      hiringSource: 'LinkedIn',
      // Compensation
      allowance: 5000,
      paymentSchedule: 'monthly',
      bankAccount: 'BDO - 1234567890',
      gcashAccount: '09171234567',
    },
    {
      id: '2',
      employeeId: 'EMP-002',
      name: 'Jane Smith',
      firstName: 'Jane',
      lastName: 'Smith',
      department: 'Operations',
      jobTitle: 'Operations Supervisor',
      position: 'Operations Supervisor',
      status: 'active',
      hireDate: '2021-06-20',
      basicSalary: 32000,
      currentSalary: 34000,
      contact: '09181234567',
      phone: '09181234567',
      email: 'jane.smith@company.com',
      address: '456 Rizal Ave, Quezon City, Metro Manila',
      emergencyContact: '09181234888',
      emergencyContactPerson: 'Mary Smith (Mother)',
      emergencyContactNumber: '09181234888',
      // Government IDs
      sssNumber: '34-2345678-9',
      philHealthNumber: '12-456789012-3',
      hdmfNumber: '2345-6789-0123',
      tinNumber: '234-567-890-001',
      // Personal Information
      gender: 'female',
      education: 'Bachelor of Science in Industrial Engineering',
      dateOfBirth: '1992-08-22',
      maritalStatus: 'single',
      numberOfKids: 0,
      drivingLicense: 'N23-45-678901',
      // Employment Details
      employmentStatus: 'regular',
      employeeType: 'full-time',
      office: 'Warehouse - Paranaque',
      hiringSource: 'Employee Referral',
      // Compensation
      allowance: 4000,
      paymentSchedule: 'monthly',
      bankAccount: 'BPI - 2345678901',
    },
    {
      id: '3',
      employeeId: 'EMP-003',
      name: 'Mike Johnson',
      firstName: 'Mike',
      lastName: 'Johnson',
      middleName: 'Andrew',
      department: 'Warehouse',
      jobTitle: 'Warehouse Staff',
      position: 'Warehouse Staff',
      status: 'on-leave',
      hireDate: '2023-03-10',
      basicSalary: 18000,
      currentSalary: 18000,
      contact: '09191234567',
      phone: '09191234567',
      email: 'mike.johnson@company.com',
      address: '789 Commonwealth Ave, Quezon City',
      emergencyContact: '09191234777',
      emergencyContactPerson: 'Linda Johnson (Sister)',
      emergencyContactNumber: '09191234777',
      // Government IDs
      sssNumber: '34-3456789-0',
      philHealthNumber: '12-567890123-4',
      hdmfNumber: '3456-7890-1234',
      tinNumber: '345-678-901-002',
      // Personal Information
      gender: 'male',
      education: 'High School Graduate',
      dateOfBirth: '1995-12-03',
      maritalStatus: 'single',
      drivingLicense: 'N34-56-789012',
      // Employment Details
      employmentStatus: 'probationary',
      employeeType: 'full-time',
      office: 'Warehouse - Paranaque',
      hiringSource: 'Walk-in',
      // Compensation
      allowance: 2000,
      paymentSchedule: 'semi-monthly',
      gcashAccount: '09191234567',
    },
    {
      id: '4',
      employeeId: 'EMP-004',
      name: 'Sarah Williams',
      firstName: 'Sarah',
      lastName: 'Williams',
      middleName: 'Grace',
      department: 'Accounting',
      jobTitle: 'Accountant',
      position: 'Accountant',
      status: 'active',
      hireDate: '2020-09-05',
      basicSalary: 28000,
      currentSalary: 32000,
      contact: '09201234567',
      phone: '09201234567',
      email: 'sarah.williams@company.com',
      address: '321 Ortigas Ave, Pasig City, Metro Manila',
      emergencyContact: '09201234666',
      emergencyContactPerson: 'David Williams (Husband)',
      emergencyContactNumber: '09201234666',
      // Government IDs
      sssNumber: '34-4567890-1',
      philHealthNumber: '12-678901234-5',
      hdmfNumber: '4567-8901-2345',
      tinNumber: '456-789-012-003',
      // Personal Information
      gender: 'female',
      education: 'Bachelor of Science in Accountancy',
      dateOfBirth: '1988-04-18',
      maritalStatus: 'married',
      numberOfKids: 1,
      drivingLicense: 'N45-67-890123',
      // Employment Details
      employmentStatus: 'regular',
      employeeType: 'full-time',
      office: 'Main Office - Makati',
      hiringSource: 'JobStreet',
      // Compensation
      allowance: 3500,
      paymentSchedule: 'monthly',
      bankAccount: 'Metrobank - 3456789012',
    },
    {
      id: '5',
      employeeId: 'EMP-005',
      name: 'Robert Brown',
      firstName: 'Robert',
      lastName: 'Brown',
      department: 'Drivers',
      jobTitle: 'Delivery Driver',
      position: 'Delivery Driver',
      status: 'inactive',
      hireDate: '2019-11-12',
      basicSalary: 22000,
      currentSalary: 24000,
      contact: '09211234567',
      phone: '09211234567',
      email: 'robert.brown@company.com',
      address: '654 EDSA, Mandaluyong City, Metro Manila',
      emergencyContact: '09211234555',
      emergencyContactPerson: 'Betty Brown (Mother)',
      emergencyContactNumber: '09211234555',
      // Government IDs
      sssNumber: '34-5678901-2',
      philHealthNumber: '12-789012345-6',
      hdmfNumber: '5678-9012-3456',
      tinNumber: '567-890-123-004',
      // Personal Information
      gender: 'male',
      education: 'Vocational Course - Automotive',
      dateOfBirth: '1985-09-28',
      maritalStatus: 'divorced',
      numberOfKids: 1,
      drivingLicense: 'P123-45-678901 (Professional)',
      // Employment Details
      employmentStatus: 'regular',
      employeeType: 'full-time',
      office: 'Warehouse - Paranaque',
      hiringSource: 'Facebook Jobs',
      // Compensation
      allowance: 3000,
      paymentSchedule: 'weekly',
      bankAccount: 'Landbank - 4567890123',
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('employees');

  // Get unique departments for filter
  const departments = useMemo(() => {
    const depts = Array.from(new Set(employees.map((e) => e.department)));
    return ['all', ...depts.sort()];
  }, [employees]);

  // Computed Values
  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const matchesSearch =
        employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.contact.includes(searchQuery);

      const matchesDepartment =
        departmentFilter === 'all' || employee.department === departmentFilter;

      const matchesStatus =
        statusFilter === 'all' || employee.status === statusFilter;

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [employees, searchQuery, departmentFilter, statusFilter]);

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status === 'active').length;
  const onLeaveEmployees = employees.filter(
    (e) => e.status === 'on-leave'
  ).length;
  const totalSalary = employees
    .filter((e) => e.status === 'active')
    .reduce((sum, e) => sum + e.basicSalary, 0);

  // Utility Functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const getStatusColor = (status: Employee['status']) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'red';
      case 'on-leave':
        return 'orange';
      default:
        return 'gray';
    }
  };

  // Event Handlers
  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setIsFormOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsFormOpen(true);
  };

  const handleDeleteEmployee = (id: string) => {
    if (confirm('Are you sure you want to delete this employee?')) {
      setEmployees((prev) => prev.filter((e) => e.id !== id));
    }
  };

  const handleSaveEmployee = (formData: EmployeeFormData) => {
    if (editingEmployee) {
      // Update existing employee
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === editingEmployee.id
            ? {
                ...e,
                employeeId: formData.employeeId,
                name: formData.name,
                firstName: formData.name.split(' ')[0] || '',
                lastName: formData.name.split(' ').slice(1).join(' ') || '',
                department: formData.department,
                jobTitle: formData.jobTitle,
                position: formData.jobTitle,
                status: formData.status,
                hireDate: formData.hireDate,
                basicSalary: parseFloat(formData.basicSalary),
                currentSalary: parseFloat(formData.basicSalary),
                contact: formData.contact,
                phone: formData.contact,
                email: formData.email,
                address: formData.address,
                emergencyContact: formData.emergencyContact,
              }
            : e
        )
      );
    } else {
      // Add new employee
      const newEmployee: Employee = {
        id: Date.now().toString(),
        employeeId: formData.employeeId,
        name: formData.name,
        firstName: formData.name.split(' ')[0] || '',
        lastName: formData.name.split(' ').slice(1).join(' ') || '',
        department: formData.department,
        jobTitle: formData.jobTitle,
        position: formData.jobTitle,
        status: formData.status,
        hireDate: formData.hireDate,
        basicSalary: parseFloat(formData.basicSalary),
        currentSalary: parseFloat(formData.basicSalary),
        contact: formData.contact,
        phone: formData.contact,
        email: formData.email,
        address: formData.address,
        emergencyContact: formData.emergencyContact,
      };
      setEmployees((prev) => [newEmployee, ...prev]);
    }
    setIsFormOpen(false);
    setEditingEmployee(null);
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').slice(1); // Skip header row

      const imported = rows
        .filter((row) => row.trim())
        .map((row) => {
          const [
            employeeId,
            name,
            department,
            jobTitle,
            status,
            hireDate,
            basicSalary,
            contact,
            email,
          ] = row.split(',');

          return {
            id: Date.now().toString() + Math.random(),
            employeeId: employeeId?.trim() || '',
            name: name?.trim() || '',
            firstName: name?.trim().split(' ')[0] || '',
            lastName: name?.trim().split(' ').slice(1).join(' ') || '',
            department: department?.trim() || '',
            jobTitle: jobTitle?.trim() || '',
            position: jobTitle?.trim() || '',
            status: (status?.trim() || 'active') as Employee['status'],
            hireDate: hireDate?.trim() || '',
            basicSalary: parseFloat(basicSalary?.trim() || '0'),
            currentSalary: parseFloat(basicSalary?.trim() || '0'),
            contact: contact?.trim() || '',
            phone: contact?.trim() || '',
            email: email?.trim() || '',
          };
        });

      setEmployees((prev) => [...imported, ...prev]);
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    const headers = [
      'Employee ID',
      'Name',
      'Department',
      'Job Title',
      'Status',
      'Hire Date',
      'Basic Salary',
      'Contact',
      'Email',
    ];
    const rows = filteredEmployees.map((e) => [
      e.employeeId,
      e.name,
      e.department,
      e.jobTitle,
      e.status,
      e.hireDate,
      e.basicSalary.toString(),
      e.contact,
      e.email || '',
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join(
      '\n'
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return {
    // State
    employees: filteredEmployees,
    searchQuery,
    departmentFilter,
    statusFilter,
    isFormOpen,
    editingEmployee,
    activeTab,
    departments,

    // Computed Values
    totalEmployees,
    activeEmployees,
    onLeaveEmployees,
    totalSalary,

    // Setters
    setSearchQuery,
    setDepartmentFilter,
    setStatusFilter,
    setIsFormOpen,
    setActiveTab,

    // Utility Functions
    formatDate,
    formatCurrency,
    getStatusColor,

    // Event Handlers
    handleAddEmployee,
    handleEditEmployee,
    handleDeleteEmployee,
    handleSaveEmployee,
    handleImportCSV,
    handleExportCSV,
  };
}
