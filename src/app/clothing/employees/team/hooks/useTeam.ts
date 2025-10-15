import { useState, useMemo, useEffect } from 'react';
import type { Employee, EmployeeFormData } from '../types';

export function useTeam() {
  // State Management
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('employees');

  // Fetch employees from API
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setIsLoading(true);

        // Build query params
        const params = new URLSearchParams();
        if (departmentFilter && departmentFilter !== 'all') {
          params.append('department', departmentFilter);
        }
        if (statusFilter && statusFilter !== 'all') {
          params.append('status', statusFilter);
        }
        if (searchQuery) {
          params.append('search', searchQuery);
        }

        const response = await fetch(`/api/employees?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Failed to fetch employees');
        }

        const data = await response.json();

        // Transform database IDs to strings for UI compatibility
        const transformedData = data.map(
          (emp: Omit<Employee, 'id'> & { id: number }) => ({
            ...emp,
            id: emp.id.toString(),
          })
        );

        setEmployees(transformedData);
      } catch (error) {
        console.error('Error fetching employees:', error);
        setEmployees([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployees();
  }, [departmentFilter, statusFilter, searchQuery]);

  // Get unique departments for filter
  const departments = useMemo(() => {
    const depts = Array.from(new Set(employees.map((e) => e.department)));
    return ['all', ...depts.sort()];
  }, [employees]);

  // Computed Values (API handles filtering, so just use employees directly)
  const filteredEmployees = employees;

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

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) {
      return;
    }

    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete employee');
      }

      // Remove from local state
      setEmployees((prev) => prev.filter((e) => e.id !== id));
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Failed to delete employee. Please try again.');
    }
  };

  const handleSaveEmployee = async (formData: EmployeeFormData) => {
    try {
      if (editingEmployee) {
        // Update existing employee
        const response = await fetch(`/api/employees/${editingEmployee.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
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
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update employee');
        }

        const updatedEmployee = await response.json();

        // Update local state
        setEmployees((prev) =>
          prev.map((e) =>
            e.id === editingEmployee.id
              ? { ...updatedEmployee, id: updatedEmployee.id.toString() }
              : e
          )
        );
      } else {
        // Add new employee
        const response = await fetch('/api/employees', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
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
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create employee');
        }

        const newEmployee = await response.json();

        // Add to local state
        setEmployees((prev) => [
          { ...newEmployee, id: newEmployee.id.toString() },
          ...prev,
        ]);
      }

      setIsFormOpen(false);
      setEditingEmployee(null);
    } catch (error) {
      console.error('Error saving employee:', error);
      alert('Failed to save employee. Please try again.');
    }
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
    isLoading,

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
