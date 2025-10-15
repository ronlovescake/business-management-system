import { useState, useMemo, useEffect } from 'react';
import type { Employee, EmployeeFormData } from '../types';

/**
 * Generate a unique employee ID
 * Format: EMP-YYYYMMDD-XXXX (e.g., EMP-20251016-0001)
 */
const generateEmployeeId = async (): Promise<string> => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  // Fetch existing employees to find the next available number
  const response = await fetch('/api/employees');
  const employees = await response.json();

  // Find all employee IDs with today's date
  const todayPrefix = `EMP-${dateStr}-`;
  const todayEmployees = employees
    .filter((emp: Employee) => emp.employeeId?.startsWith(todayPrefix))
    .map((emp: Employee) => {
      const match = emp.employeeId?.match(/EMP-\d{8}-(\d{4})$/);
      return match ? parseInt(match[1], 10) : 0;
    });

  // Get the next number
  const maxNumber = todayEmployees.length > 0 ? Math.max(...todayEmployees) : 0;
  const nextNumber = (maxNumber + 1).toString().padStart(4, '0');

  return `${todayPrefix}${nextNumber}`;
};

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
      console.log('🔵 [useTeam] handleSaveEmployee called');
      console.log('🔵 [useTeam] editingEmployee:', editingEmployee);
      console.log('🔵 [useTeam] formData:', formData);

      if (editingEmployee) {
        // Update existing employee
        const payload = {
          employeeId: formData.employeeId,
          // Name fields - use the actual form data, don't split
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName || null,
          name:
            formData.name ||
            `${formData.firstName} ${formData.middleName || ''} ${formData.lastName}`
              .replace(/\s+/g, ' ')
              .trim(),
          // Contact
          phone: formData.phone,
          contact: formData.contact || formData.phone,
          email: formData.email || null,
          // Employment
          department: formData.department,
          position: formData.position,
          jobTitle: formData.jobTitle || formData.position,
          status: formData.status,
          employmentStatus: formData.employmentStatus || null,
          employeeType: formData.employeeType || null,
          office: formData.office || null,
          hiringSource: formData.hiringSource || null,
          hireDate: formData.hireDate,
          // Salary
          basicSalary: parseFloat(formData.basicSalary) || 0,
          currentSalary: formData.currentSalary
            ? parseFloat(formData.currentSalary)
            : parseFloat(formData.basicSalary) || 0,
          allowance: formData.allowance ? parseFloat(formData.allowance) : null,
          paymentSchedule: formData.paymentSchedule || null,
          // Government IDs
          sssNumber: formData.sssNumber || null,
          philHealthNumber: formData.philHealthNumber || null,
          hdmfNumber: formData.hdmfNumber || null,
          tinNumber: formData.tinNumber || null,
          // Personal Info
          gender: formData.gender || null,
          education: formData.education || null,
          dateOfBirth: formData.dateOfBirth || null,
          maritalStatus: formData.maritalStatus || null,
          numberOfKids: formData.numberOfKids
            ? parseInt(formData.numberOfKids)
            : null,
          drivingLicense: formData.drivingLicense || null,
          // Address & Emergency
          address: formData.address || null,
          emergencyContactPerson: formData.emergencyContactPerson || null,
          emergencyContactNumber: formData.emergencyContactNumber || null,
          emergencyContact:
            formData.emergencyContact ||
            formData.emergencyContactNumber ||
            null,
          // Financial
          bankAccount: formData.bankAccount || null,
          gcashAccount: formData.gcashAccount || null,
        };

        console.log('🟡 [useTeam] Updating employee - payload:', payload);

        const response = await fetch(`/api/employees/${editingEmployee.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        console.log('🟢 [useTeam] Update response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('🔴 [useTeam] Update failed:', errorText);
          throw new Error('Failed to update employee');
        }

        const updatedEmployee = await response.json();
        console.log(
          '✅ [useTeam] Employee updated successfully:',
          updatedEmployee
        );

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
        // Generate a unique employee ID if not provided or if empty
        const employeeId = formData.employeeId?.trim()
          ? formData.employeeId
          : await generateEmployeeId();

        console.log('🟢 [useTeam] Generated/Using employee ID:', employeeId);

        const payload = {
          employeeId,
          // Name fields - use the actual form data, don't split
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName || null,
          name:
            formData.name ||
            `${formData.firstName} ${formData.middleName || ''} ${formData.lastName}`
              .replace(/\s+/g, ' ')
              .trim(),
          // Contact
          phone: formData.phone,
          contact: formData.contact || formData.phone,
          email: formData.email || null,
          // Employment
          department: formData.department,
          position: formData.position,
          jobTitle: formData.jobTitle || formData.position,
          status: formData.status,
          employmentStatus: formData.employmentStatus || null,
          employeeType: formData.employeeType || null,
          office: formData.office || null,
          hiringSource: formData.hiringSource || null,
          hireDate: formData.hireDate,
          // Salary
          basicSalary: parseFloat(formData.basicSalary) || 0,
          currentSalary: formData.currentSalary
            ? parseFloat(formData.currentSalary)
            : parseFloat(formData.basicSalary) || 0,
          allowance: formData.allowance ? parseFloat(formData.allowance) : null,
          paymentSchedule: formData.paymentSchedule || null,
          // Government IDs
          sssNumber: formData.sssNumber || null,
          philHealthNumber: formData.philHealthNumber || null,
          hdmfNumber: formData.hdmfNumber || null,
          tinNumber: formData.tinNumber || null,
          // Personal Info
          gender: formData.gender || null,
          education: formData.education || null,
          dateOfBirth: formData.dateOfBirth || null,
          maritalStatus: formData.maritalStatus || null,
          numberOfKids: formData.numberOfKids
            ? parseInt(formData.numberOfKids)
            : null,
          drivingLicense: formData.drivingLicense || null,
          // Address & Emergency
          address: formData.address || null,
          emergencyContactPerson: formData.emergencyContactPerson || null,
          emergencyContactNumber: formData.emergencyContactNumber || null,
          emergencyContact:
            formData.emergencyContact ||
            formData.emergencyContactNumber ||
            null,
          // Financial
          bankAccount: formData.bankAccount || null,
          gcashAccount: formData.gcashAccount || null,
        };

        console.log('🟢 [useTeam] Creating new employee - payload:', payload);
        console.log('🟢 [useTeam] API endpoint: /api/employees');

        const response = await fetch('/api/employees', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        console.log('🟢 [useTeam] Create response status:', response.status);
        console.log('🟢 [useTeam] Create response ok:', response.ok);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            '🔴 [useTeam] Create failed - status:',
            response.status
          );
          console.error('🔴 [useTeam] Create failed - error:', errorText);

          // Check if it's a duplicate employee ID error
          if (
            errorText.includes('Unique constraint failed') &&
            errorText.includes('employeeId')
          ) {
            console.log(
              '🔄 [useTeam] Duplicate employeeId detected, generating new ID...'
            );
            // Generate a new ID and retry
            const newEmployeeId = await generateEmployeeId();
            console.log(
              '🔄 [useTeam] Retrying with new employee ID:',
              newEmployeeId
            );

            const retryPayload = { ...payload, employeeId: newEmployeeId };
            const retryResponse = await fetch('/api/employees', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(retryPayload),
            });

            if (!retryResponse.ok) {
              throw new Error('Failed to create employee after retry');
            }

            const newEmployee = await retryResponse.json();
            console.log(
              '✅ [useTeam] Employee created successfully on retry:',
              newEmployee
            );

            // Add to local state
            setEmployees((prev) => [
              { ...newEmployee, id: newEmployee.id.toString() },
              ...prev,
            ]);

            setIsFormOpen(false);
            setEditingEmployee(null);
            console.log('✅ [useTeam] Form closed and state reset');
            return; // Exit early on successful retry
          }

          throw new Error('Failed to create employee');
        }

        const newEmployee = await response.json();
        console.log('✅ [useTeam] Employee created successfully:', newEmployee);

        // Add to local state
        setEmployees((prev) => [
          { ...newEmployee, id: newEmployee.id.toString() },
          ...prev,
        ]);
      }

      setIsFormOpen(false);
      setEditingEmployee(null);
      console.log('✅ [useTeam] Form closed and state reset');
    } catch (error) {
      console.error('🔴 [useTeam] Error saving employee:', error);
      console.error('🔴 [useTeam] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
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
