/* eslint-disable no-console */
import { useState, useEffect } from 'react';
import type { Employee, EmployeeFormData } from '../types';

/**
 * Custom hook for employee detail page
 */
export function useEmployeeDetail(employeeId: string) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);

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
      console.log('🔵 [useEmployeeDetail] handleSaveEmployee called');
      console.log('🔵 [useEmployeeDetail] formData:', formData);

      const payload = {
        employeeId: formData.employeeId,
        // Name fields - use the actual form data
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
          formData.emergencyContact || formData.emergencyContactNumber || null,
        // Financial
        bankAccount: formData.bankAccount || null,
        gcashAccount: formData.gcashAccount || null,
        profilePhoto:
          formData.profilePhoto && formData.profilePhoto.trim().length > 0
            ? formData.profilePhoto
            : employee.profilePhoto || null,
      };

      console.log(
        '🟡 [useEmployeeDetail] Updating employee - payload:',
        payload
      );

      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log(
        '🟢 [useEmployeeDetail] Update response status:',
        response.status
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 [useEmployeeDetail] Update failed:', errorText);
        throw new Error('Failed to update employee');
      }

      const updatedEmployee = await response.json();
      console.log(
        '✅ [useEmployeeDetail] Employee updated successfully:',
        updatedEmployee
      );

      // Update local state with transformed employee
      setEmployee({
        ...updatedEmployee,
        id: updatedEmployee.id.toString(),
      });

      // Close the form
      setIsFormOpen(false);
    } catch (error) {
      console.error('🔴 [useEmployeeDetail] Error updating employee:', error);
      console.error('🔴 [useEmployeeDetail] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      alert('Failed to update employee. Please try again.');
    }
  };

  const handleProfilePhotoUpload = async (base64Photo: string) => {
    if (!employee) {
      return;
    }

    try {
      setIsPhotoUploading(true);

      const payload = {
        employeeId: employee.employeeId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        middleName: employee.middleName || null,
        name: employee.name,
        phone: employee.phone,
        contact: employee.contact,
        email: employee.email || null,
        department: employee.department,
        position: employee.position,
        jobTitle: employee.jobTitle,
        status: employee.status,
        employmentStatus: employee.employmentStatus || null,
        employeeType: employee.employeeType || null,
        office: employee.office || null,
        hiringSource: employee.hiringSource || null,
        hireDate: employee.hireDate,
        basicSalary: employee.basicSalary,
        currentSalary:
          employee.currentSalary !== undefined &&
          employee.currentSalary !== null
            ? employee.currentSalary
            : employee.basicSalary,
        allowance: employee.allowance ?? null,
        paymentSchedule: employee.paymentSchedule || null,
        sssNumber: employee.sssNumber || null,
        philHealthNumber: employee.philHealthNumber || null,
        hdmfNumber: employee.hdmfNumber || null,
        tinNumber: employee.tinNumber || null,
        gender: employee.gender || null,
        education: employee.education || null,
        dateOfBirth: employee.dateOfBirth || null,
        maritalStatus: employee.maritalStatus || null,
        numberOfKids: employee.numberOfKids ?? null,
        drivingLicense: employee.drivingLicense || null,
        address: employee.address || null,
        emergencyContactPerson: employee.emergencyContactPerson || null,
        emergencyContactNumber: employee.emergencyContactNumber || null,
        emergencyContact: employee.emergencyContact || null,
        bankAccount: employee.bankAccount || null,
        gcashAccount: employee.gcashAccount || null,
        profilePhoto: base64Photo,
      };

      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          '🔴 [useEmployeeDetail] Profile photo update failed:',
          errorText
        );
        throw new Error('Failed to update profile photo');
      }

      const updatedEmployee = await response.json();

      setEmployee({
        ...updatedEmployee,
        id: updatedEmployee.id.toString(),
      });
    } catch (error) {
      console.error('🔴 [useEmployeeDetail] Error uploading photo:', error);
      alert('Failed to upload profile photo. Please try again.');
    } finally {
      setIsPhotoUploading(false);
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
    handleProfilePhotoUpload,
    isPhotoUploading,
  };
}
