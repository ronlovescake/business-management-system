import { useState, useEffect } from 'react';
import type { Employee, EmployeeFormData } from '../types';

/**
 * Custom hook for employee detail page
 */
export function useEmployeeDetail(employeeId: string) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    // Fetch employee data from API
    const fetchEmployee = async () => {
      try {
        setIsLoading(true);

        const response = await fetch(`/api/employees/${employeeId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setEmployee(null);
            return;
          }
          throw new Error('Failed to fetch employee');
        }

        const data = await response.json();

        // Transform database response to match Employee type
        const transformedEmployee: Employee = {
          ...data,
          id: data.id.toString(), // Convert number to string for UI
        };

        setEmployee(transformedEmployee);
      } catch (error) {
        console.error('Error fetching employee:', error);
        setEmployee(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployee();
  }, [employeeId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
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

  const handleEdit = () => {
    // Open the edit modal
    setIsFormOpen(true);
  };

  const handleSaveEmployee = async (formData: EmployeeFormData) => {
    if (!employee) {
      return;
    }

    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update employee');
      }

      const updatedEmployee = await response.json();

      // Update local state with transformed employee
      setEmployee({
        ...updatedEmployee,
        id: updatedEmployee.id.toString(),
      });

      // Close the form
      setIsFormOpen(false);
    } catch (error) {
      console.error('Error updating employee:', error);
      alert('Failed to update employee. Please try again.');
    }
  };

  return {
    employee,
    isLoading,
    isFormOpen,
    setIsFormOpen,
    formatDate,
    formatCurrency,
    getStatusColor,
    handleEdit,
    handleSaveEmployee,
  };
}
