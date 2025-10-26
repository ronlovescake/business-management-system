import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Employee, EmployeeFormData } from '../types';
import { getCurrentDateISO } from '@/utils/date';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';

/**
 * Generate a unique employee ID
 * Format: EMP-XXXX (e.g., EMP-0001)
 */
const generateEmployeeId = async (retryOffset = 0): Promise<string> => {
  // Fetch existing employees to find the next available number
  const employees = await api.get<Employee[]>('/api/employees');

  const prefix = 'EMP-';
  const existingNumbers = employees
    .map((emp: Employee) => {
      const match = emp.employeeId?.match(/^EMP-(\d{4,})$/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((value: number | null): value is number => value !== null);

  const maxNumber =
    existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
  const nextNumber = (maxNumber + 1 + retryOffset).toString().padStart(4, '0');

  return `${prefix}${nextNumber}`;
};

const isDuplicateEmployeeIdError = (errorText: string) =>
  errorText.includes('Unique constraint failed') &&
  errorText.includes('employeeId');

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
  const fetchEmployees = useCallback(async () => {
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

      const data = await api.get<Array<Omit<Employee, 'id'> & { id: number }>>(
        `/api/employees?${params.toString()}`
      );

      // Transform database IDs to strings for UI compatibility
      const transformedData = data.map(
        (emp: Omit<Employee, 'id'> & { id: number }) => ({
          ...emp,
          id: emp.id.toString(),
        })
      );

      setEmployees(transformedData);
    } catch (error) {
      logger.error('Error fetching employees:', error);
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  }, [departmentFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

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
      await api.delete(`/api/employees/${id}`);

      // Remove from local state
      setEmployees((prev) => prev.filter((e) => e.id !== id));
    } catch (error) {
      logger.error('Error deleting employee:', error);
      alert('Failed to delete employee. Please try again.');
    }
  };

  const handleSaveEmployee = async (formData: EmployeeFormData) => {
    try {
      logger.debug('useTeam', 'handleSaveEmployee called', {
        editingEmployee,
        formData,
      });

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
          profilePhoto:
            formData.profilePhoto && formData.profilePhoto.trim().length > 0
              ? formData.profilePhoto
              : editingEmployee.profilePhoto || null,
        };

        const updatedEmployee = await api.put<Employee>(
          `/api/employees/${editingEmployee.id}`,
          payload
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
        // Generate a unique employee ID if not provided, empty, or invalid format
        const isValidFormat =
          formData.employeeId?.trim() &&
          /^EMP-\d{4}$/.test(formData.employeeId.trim());

        const employeeId = isValidFormat
          ? formData.employeeId.trim()
          : await generateEmployeeId();

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
          profilePhoto:
            formData.profilePhoto && formData.profilePhoto.trim().length > 0
              ? formData.profilePhoto
              : null,
        };

        try {
          const newEmployee = await api.post<Employee>(
            '/api/employees',
            payload
          );

          setEmployees((prev) => [
            { ...newEmployee, id: newEmployee.id.toString() },
            ...prev,
          ]);

          setIsFormOpen(false);
          setEditingEmployee(null);
        } catch (error) {
          logger.error('Create employee failed:', error);

          if (
            error instanceof Error &&
            isDuplicateEmployeeIdError(error.message)
          ) {
            const maxRetries = 5;
            for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
              const newEmployeeId = await generateEmployeeId(attempt);

              const retryPayload = { ...payload, employeeId: newEmployeeId };
              try {
                const newEmployee = await api.post<Employee>(
                  '/api/employees',
                  retryPayload
                );

                setEmployees((prev) => [
                  { ...newEmployee, id: newEmployee.id.toString() },
                  ...prev,
                ]);

                setIsFormOpen(false);
                setEditingEmployee(null);
                return;
              } catch (retryError) {
                logger.error(`Retry attempt ${attempt} failed:`, retryError);

                if (
                  !(retryError instanceof Error) ||
                  !isDuplicateEmployeeIdError(retryError.message)
                ) {
                  throw new Error('Failed to create employee');
                }
              }
            }

            throw new Error('Failed to create employee after retries');
          }

          throw error;
        }
      }
    } catch (error) {
      logger.error('Error saving employee:', error);
      alert('Failed to save employee. Please try again.');
    }
  };

  const handleImportCSV = async (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map((h) => h.trim());

        // Parse CSV rows (skip header)
        const rows = lines.slice(1).filter((row) => row.trim());

        let successCount = 0;
        let errorCount = 0;

        for (const row of rows) {
          try {
            // Parse CSV row handling quoted values
            const values: string[] = [];
            let currentValue = '';
            let insideQuotes = false;

            for (let i = 0; i < row.length; i++) {
              const char = row[i];

              if (char === '"') {
                insideQuotes = !insideQuotes;
              } else if (char === ',' && !insideQuotes) {
                values.push(currentValue.trim());
                currentValue = '';
              } else {
                currentValue += char;
              }
            }
            values.push(currentValue.trim()); // Push last value

            // Map CSV columns to employee data
            const employeeData: Record<string, string | number> = {};
            headers.forEach((header, index) => {
              const value = values[index] || '';
              employeeData[header] = value;
            });

            // Create employee object matching API expectations
            const employee = {
              employeeId: employeeData['Employee ID'] as string,
              name: employeeData['Full Name'] as string,
              firstName: employeeData['First Name'] as string,
              middleName: (employeeData['Middle Name'] as string) || undefined,
              lastName: employeeData['Last Name'] as string,
              gender: (employeeData['Gender'] as string) || undefined,
              dateOfBirth:
                (employeeData['Date of Birth'] as string) || undefined,
              maritalStatus:
                (employeeData['Marital Status'] as string) || undefined,
              numberOfKids: employeeData['Number of Kids']
                ? parseInt(employeeData['Number of Kids'] as string)
                : undefined,
              drivingLicense:
                (employeeData['Driving License'] as string) || undefined,
              education: (employeeData['Education'] as string) || undefined,
              email: (() => {
                const email = employeeData['Email'] as string;
                // Only include email if it's valid format (contains @)
                return email && email.includes('@') ? email : undefined;
              })(),
              phone: employeeData['Phone'] as string,
              contact: employeeData['Phone'] as string,
              address: (employeeData['Address'] as string) || undefined,
              emergencyContactPerson:
                (employeeData['Emergency Contact Person'] as string) ||
                undefined,
              emergencyContactNumber:
                (employeeData['Emergency Contact Number'] as string) ||
                undefined,
              emergencyContact:
                (employeeData['Emergency Contact'] as string) || undefined,
              department: employeeData['Department'] as string,
              position: employeeData['Position'] as string,
              jobTitle: employeeData['Job Title'] as string,
              employmentStatus:
                (employeeData['Employment Status'] as string) || undefined,
              employeeType:
                (employeeData['Employee Type'] as string) || undefined,
              status: employeeData['Status'] as string,
              hireDate: employeeData['Hire Date'] as string,
              office: (employeeData['Office'] as string) || undefined,
              hiringSource:
                (employeeData['Hiring Source'] as string) || undefined,
              currentSalary: employeeData['Current Salary']
                ? parseFloat(employeeData['Current Salary'] as string)
                : undefined,
              basicSalary:
                parseFloat(employeeData['Basic Salary'] as string) || 0,
              allowance: employeeData['Allowance']
                ? parseFloat(employeeData['Allowance'] as string)
                : undefined,
              paymentSchedule:
                (employeeData['Payment Schedule'] as string) || undefined,
              bankAccount:
                (employeeData['Bank Account'] as string) || undefined,
              gcashAccount:
                (employeeData['GCash Account'] as string) || undefined,
              sssNumber: (employeeData['SSS Number'] as string) || undefined,
              philHealthNumber:
                (employeeData['PhilHealth Number'] as string) || undefined,
              hdmfNumber: (employeeData['HDMF Number'] as string) || undefined,
              tinNumber: (employeeData['TIN Number'] as string) || undefined,
            };

            // Call API to create employee
            const response = await api.post<Employee>(
              '/api/employees',
              employee
            );

            if (response) {
              successCount++;
            }
          } catch (rowError) {
            errorCount++;
            logger.error('Failed to import employee:', rowError);
          }
        }

        // Refresh employee list
        await fetchEmployees();

        alert(
          `Import complete!\nSuccess: ${successCount}\nFailed: ${errorCount}`
        );
      } catch (error) {
        logger.error('Error importing CSV:', error);
        alert('Failed to import CSV file');
      }
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    const headers = [
      'Employee ID',
      'Full Name',
      'First Name',
      'Middle Name',
      'Last Name',
      'Gender',
      'Date of Birth',
      'Marital Status',
      'Number of Kids',
      'Driving License',
      'Education',
      'Email',
      'Phone',
      'Address',
      'Emergency Contact Person',
      'Emergency Contact Number',
      'Emergency Contact',
      'Department',
      'Position',
      'Job Title',
      'Employment Status',
      'Employee Type',
      'Status',
      'Hire Date',
      'Office',
      'Hiring Source',
      'Current Salary',
      'Basic Salary',
      'Allowance',
      'Payment Schedule',
      'Bank Account',
      'GCash Account',
      'SSS Number',
      'PhilHealth Number',
      'HDMF Number',
      'TIN Number',
    ];

    const escapeCSV = (value: string | number | null | undefined): string => {
      if (value === null || value === undefined) {
        return '';
      }
      const stringValue = String(value ?? '');
      return stringValue.includes(',') || stringValue.includes('"')
        ? `"${stringValue.replace(/"/g, '""')}"`
        : stringValue;
    };

    const rows = filteredEmployees.map((e) => [
      escapeCSV(e.employeeId),
      escapeCSV(e.name),
      escapeCSV(e.firstName),
      escapeCSV(e.middleName || ''),
      escapeCSV(e.lastName),
      escapeCSV(e.gender || ''),
      escapeCSV(e.dateOfBirth || ''),
      escapeCSV(e.maritalStatus || ''),
      escapeCSV(
        e.numberOfKids !== undefined && e.numberOfKids !== null
          ? e.numberOfKids
          : ''
      ),
      escapeCSV(e.drivingLicense || ''),
      escapeCSV(e.education || ''),
      escapeCSV(e.email || ''),
      escapeCSV(e.phone),
      escapeCSV(e.address || ''),
      escapeCSV(e.emergencyContactPerson || ''),
      escapeCSV(e.emergencyContactNumber || ''),
      escapeCSV(e.emergencyContact || ''),
      escapeCSV(e.department),
      escapeCSV(e.position),
      escapeCSV(e.jobTitle),
      escapeCSV(e.employmentStatus || ''),
      escapeCSV(e.employeeType || ''),
      escapeCSV(e.status),
      escapeCSV(e.hireDate),
      escapeCSV(e.office || ''),
      escapeCSV(e.hiringSource || ''),
      escapeCSV(
        e.currentSalary !== undefined && e.currentSalary !== null
          ? e.currentSalary
          : ''
      ),
      escapeCSV(e.basicSalary),
      escapeCSV(
        e.allowance !== undefined && e.allowance !== null ? e.allowance : ''
      ),
      escapeCSV(e.paymentSchedule || ''),
      escapeCSV(e.bankAccount || ''),
      escapeCSV(e.gcashAccount || ''),
      escapeCSV(e.sssNumber || ''),
      escapeCSV(e.philHealthNumber || ''),
      escapeCSV(e.hdmfNumber || ''),
      escapeCSV(e.tinNumber || ''),
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join(
      '\n'
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees-${getCurrentDateISO()}.csv`;
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
