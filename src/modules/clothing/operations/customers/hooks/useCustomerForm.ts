'use client';

import { useState, useCallback } from 'react';
import type { CustomerFormData, CustomerData } from '../types/customer.types';
import { CustomerService } from '../services/CustomerService';

/**
 * Custom hook for managing customer form state and logic
 * Handles form validation, business info auto-fill, and form submission
 */
export function useCustomerForm(existingCustomers: CustomerData[]) {
  const [formData, setFormData] = useState<CustomerFormData>(
    CustomerService.createEmptyForm()
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handle customer name change with business info auto-fill
  const handleCustomerNameChange = useCallback(
    (customerName: string) => {
      setFormData((prev) => {
        const businessInfo = CustomerService.autoFillBusinessInfo(
          customerName,
          existingCustomers
        );
        return {
          ...prev,
          customerName,
          ...businessInfo,
        };
      });
    },
    [existingCustomers]
  );

  // Handle field change
  const handleFieldChange = useCallback(
    (field: keyof CustomerFormData, value: string) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  // Reset form
  const resetForm = useCallback(() => {
    setFormData(CustomerService.createEmptyForm());
  }, []);

  // Open modal
  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  // Close modal
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    resetForm();
  }, [resetForm]);

  // Validate and get customer data
  const getValidatedCustomerData = useCallback((): {
    isValid: boolean;
    data?: CustomerData;
    errors?: string[];
  } => {
    const validation = CustomerService.validateCustomer(formData);

    if (!validation.isValid) {
      return {
        isValid: false,
        errors: validation.errors,
      };
    }

    return {
      isValid: true,
      data: CustomerService.formToCustomerData(formData),
    };
  }, [formData]);

  return {
    formData,
    isModalOpen,
    handleCustomerNameChange,
    handleFieldChange,
    resetForm,
    openModal,
    closeModal,
    getValidatedCustomerData,
    setFormData,
  };
}
