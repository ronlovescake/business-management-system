import { useState, useMemo } from 'react';
import type { ThirteenthMonthPay, ThirteenthMonthPayFormData } from '../types';
import { getCurrentDateISO, formatDisplayDate } from '@/utils/date';
import { logger } from '@/lib/logger';

export function useThirteenthMonthPay() {
  const [records, setRecords] = useState<ThirteenthMonthPay[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  // Calculate 13th month pay
  const calculate13thMonthPay = (
    totalEarnings: number,
    eligibilityMonths: number,
    deductions: number
  ): number => {
    // Formula: (Total Earnings / 12) * (Eligibility Months / 12) - Deductions
    const monthlyAverage = totalEarnings / 12;
    const proRated = monthlyAverage * (eligibilityMonths / 12);
    const finalAmount = proRated - deductions;
    return Math.max(0, finalAmount); // Can't be negative
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesSearch =
        searchQuery === '' ||
        record.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.year.includes(searchQuery);

      const matchesStatus =
        statusFilter === 'all' || record.status === statusFilter;

      const matchesYear = yearFilter === 'all' || record.year === yearFilter;

      return matchesSearch && matchesStatus && matchesYear;
    });
  }, [records, searchQuery, statusFilter, yearFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = records.length;
    const pending = records.filter((r) => r.status === 'pending').length;
    const calculated = records.filter((r) => r.status === 'calculated').length;
    const approved = records.filter((r) => r.status === 'approved').length;
    const paid = records.filter((r) => r.status === 'paid').length;
    const totalAmount = records.reduce(
      (sum, r) => sum + r.thirteenthMonthPay,
      0
    );
    const paidAmount = records
      .filter((r) => r.status === 'paid')
      .reduce((sum, r) => sum + r.thirteenthMonthPay, 0);

    return {
      total,
      pending,
      calculated,
      approved,
      paid,
      totalAmount,
      paidAmount,
    };
  }, [records]);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString?: string): string =>
    dateString ? formatDisplayDate(dateString, 'MMM D, YYYY') : 'N/A';

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'calculated':
        return '#3b82f6';
      case 'approved':
        return '#10b981';
      case 'paid':
        return '#6366f1';
      default:
        return '#6b7280';
    }
  };

  // Get status label
  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'calculated':
        return 'Calculated';
      case 'approved':
        return 'Approved';
      case 'paid':
        return 'Paid';
      default:
        return status;
    }
  };

  // Add record
  const addRecord = (data: ThirteenthMonthPayFormData) => {
    const thirteenthMonthPay = calculate13thMonthPay(
      parseFloat(data.totalEarnings),
      parseInt(data.eligibilityMonths),
      parseFloat(data.deductions)
    );

    const newRecord: ThirteenthMonthPay = {
      id: Date.now().toString(),
      employee: data.employee,
      year: data.year,
      basicSalary: parseFloat(data.basicSalary),
      totalEarnings: parseFloat(data.totalEarnings),
      eligibilityMonths: parseInt(data.eligibilityMonths),
      deductions: parseFloat(data.deductions),
      thirteenthMonthPay,
      status: 'calculated',
      calculatedDate: getCurrentDateISO(),
      notes: data.notes,
    };

    setRecords([newRecord, ...records]);
  };

  // Edit record
  const editRecord = (id: string, data: ThirteenthMonthPayFormData) => {
    const thirteenthMonthPay = calculate13thMonthPay(
      parseFloat(data.totalEarnings),
      parseInt(data.eligibilityMonths),
      parseFloat(data.deductions)
    );

    setRecords(
      records.map((record) =>
        record.id === id
          ? {
              ...record,
              employee: data.employee,
              year: data.year,
              basicSalary: parseFloat(data.basicSalary),
              totalEarnings: parseFloat(data.totalEarnings),
              eligibilityMonths: parseInt(data.eligibilityMonths),
              deductions: parseFloat(data.deductions),
              thirteenthMonthPay,
              notes: data.notes,
            }
          : record
      )
    );
  };

  // Delete record
  const deleteRecord = (id: string) => {
    setRecords(records.filter((record) => record.id !== id));
  };

  // Approve record
  const approveRecord = (id: string) => {
    setRecords(
      records.map((record) =>
        record.id === id
          ? {
              ...record,
              status: 'approved',
              approvedDate: getCurrentDateISO(),
            }
          : record
      )
    );
  };

  // Mark as paid
  const markAsPaid = (id: string) => {
    setRecords(
      records.map((record) =>
        record.id === id
          ? {
              ...record,
              status: 'paid',
              paidDate: getCurrentDateISO(),
            }
          : record
      )
    );
  };

  // Import CSV
  const importFromCSV = (file: File) => {
    logger.debug('Importing CSV:', file.name);
    // CSV import logic would go here
  };

  // Export CSV
  const exportToCSV = () => {
    const headers = [
      'Employee',
      'Year',
      'Basic Salary',
      'Total Earnings',
      'Eligibility (Months)',
      'Deductions',
      '13th Month Pay',
      'Status',
      'Calculated Date',
      'Approved Date',
      'Paid Date',
      'Notes',
    ];

    const rows = filteredRecords.map((record) => [
      record.employee,
      record.year,
      record.basicSalary.toString(),
      record.totalEarnings.toString(),
      record.eligibilityMonths.toString(),
      record.deductions.toString(),
      record.thirteenthMonthPay.toFixed(2),
      record.status,
      record.calculatedDate || '',
      record.approvedDate || '',
      record.paidDate || '',
      record.notes || '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `13th-month-pay-${getCurrentDateISO()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return {
    records: filteredRecords,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    yearFilter,
    setYearFilter,
    stats,
    formatCurrency,
    formatDate,
    getStatusColor,
    getStatusLabel,
    addRecord,
    editRecord,
    deleteRecord,
    approveRecord,
    markAsPaid,
    importFromCSV,
    exportToCSV,
  };
}
