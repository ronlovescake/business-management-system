import { useState, useMemo } from 'react';
import type { Employee, EmployeeFormData } from '../types';

export function useTeam() {
  // State Management
  const [employees, setEmployees] = useState<Employee[]>([
    {
      id: '1',
      employeeId: 'EMP-001',
      name: 'John Doe',
      department: 'Sales',
      jobTitle: 'Sales Manager',
      status: 'active',
      hireDate: '2022-01-15',
      basicSalary: 35000,
      contact: '09171234567',
      email: 'john.doe@company.com',
    },
    {
      id: '2',
      employeeId: 'EMP-002',
      name: 'Jane Smith',
      department: 'Operations',
      jobTitle: 'Operations Supervisor',
      status: 'active',
      hireDate: '2021-06-20',
      basicSalary: 32000,
      contact: '09181234567',
      email: 'jane.smith@company.com',
    },
    {
      id: '3',
      employeeId: 'EMP-003',
      name: 'Mike Johnson',
      department: 'Warehouse',
      jobTitle: 'Warehouse Staff',
      status: 'on-leave',
      hireDate: '2023-03-10',
      basicSalary: 18000,
      contact: '09191234567',
      email: 'mike.johnson@company.com',
    },
    {
      id: '4',
      employeeId: 'EMP-004',
      name: 'Sarah Williams',
      department: 'Accounting',
      jobTitle: 'Accountant',
      status: 'active',
      hireDate: '2020-09-05',
      basicSalary: 28000,
      contact: '09201234567',
      email: 'sarah.williams@company.com',
    },
    {
      id: '5',
      employeeId: 'EMP-005',
      name: 'Robert Brown',
      department: 'Drivers',
      jobTitle: 'Delivery Driver',
      status: 'inactive',
      hireDate: '2019-11-12',
      basicSalary: 22000,
      contact: '09211234567',
      email: 'robert.brown@company.com',
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
                department: formData.department,
                jobTitle: formData.jobTitle,
                status: formData.status,
                hireDate: formData.hireDate,
                basicSalary: parseFloat(formData.basicSalary),
                contact: formData.contact,
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
        department: formData.department,
        jobTitle: formData.jobTitle,
        status: formData.status,
        hireDate: formData.hireDate,
        basicSalary: parseFloat(formData.basicSalary),
        contact: formData.contact,
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
            department: department?.trim() || '',
            jobTitle: jobTitle?.trim() || '',
            status: (status?.trim() || 'active') as Employee['status'],
            hireDate: hireDate?.trim() || '',
            basicSalary: parseFloat(basicSalary?.trim() || '0'),
            contact: contact?.trim() || '',
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
