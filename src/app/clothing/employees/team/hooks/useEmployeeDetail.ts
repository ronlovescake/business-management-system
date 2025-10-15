import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Employee } from '../types';

/**
 * Custom hook for employee detail page
 */
export function useEmployeeDetail(employeeId: string) {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    // Navigate back to team page with edit mode
    router.push(`/clothing/employees/team?edit=${employeeId}`);
  };

  return {
    employee,
    isLoading,
    formatDate,
    formatCurrency,
    getStatusColor,
    handleEdit,
  };
}
