import { useState, useMemo } from 'react';
import type { EmployeeLoan, EmployeeLoanFormData } from '../types';
import { getCurrentDateISO } from '@/utils/date';
import {
  calculateLoanMonthlyPayment,
  createImportedLoanRecord,
  formatLoanCurrency,
  formatLoanDate,
  formatLoanPercent,
  getLoanStatusColor,
  getLoanTypeColor,
} from './employeeLoanUtils';

export function useEmployeeLoans() {
  // State Management
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loanTypeFilter, setLoanTypeFilter] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<EmployeeLoan | null>(null);

  // Computed Values
  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      const matchesSearch =
        loan.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loan.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loan.loanType.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || loan.status === statusFilter;

      const matchesType =
        !loanTypeFilter ||
        loanTypeFilter === 'All' ||
        loan.loanType === loanTypeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [loans, searchQuery, statusFilter, loanTypeFilter]);

  const totalLoans = filteredLoans.length;
  const pendingLoans = filteredLoans.filter(
    (l) => l.status === 'pending'
  ).length;
  const activeLoans = filteredLoans.filter((l) => l.status === 'active').length;
  const totalDisbursed = filteredLoans
    .filter((l) => l.status === 'active' || l.status === 'completed')
    .reduce((sum, l) => sum + l.amount, 0);
  const totalOutstanding = filteredLoans
    .filter((l) => l.status === 'active')
    .reduce((sum, l) => sum + l.remainingBalance, 0);

  const formatDate = formatLoanDate;
  const formatCurrency = formatLoanCurrency;
  const formatPercent = formatLoanPercent;
  const getStatusColor = getLoanStatusColor;

  // Event Handlers
  const handleAddLoan = () => {
    setEditingLoan(null);
    setIsFormOpen(true);
  };

  const handleEditLoan = (loan: EmployeeLoan) => {
    setEditingLoan(loan);
    setIsFormOpen(true);
  };

  const handleDeleteLoan = (id: string) => {
    if (confirm('Are you sure you want to delete this loan application?')) {
      setLoans((prev) => prev.filter((l) => l.id !== id));
    }
  };

  const handleSaveLoan = (formData: EmployeeLoanFormData) => {
    const amount = parseFloat(formData.amount);
    const interestRate = parseFloat(formData.interestRate);
    const termMonths = parseInt(formData.termMonths);
    const monthlyPayment = calculateLoanMonthlyPayment(
      amount,
      interestRate,
      termMonths
    );

    if (editingLoan) {
      // Update existing loan
      setLoans((prev) =>
        prev.map((l) =>
          l.id === editingLoan.id
            ? {
                ...l,
                employee: formData.employee,
                loanType: formData.loanType as EmployeeLoan['loanType'],
                amount,
                interestRate,
                termMonths,
                monthlyPayment,
                remainingBalance:
                  l.status === 'pending' ? amount : l.remainingBalance,
                applicationDate: formData.applicationDate,
                purpose: formData.purpose,
                notes: formData.notes,
              }
            : l
        )
      );
    } else {
      // Add new loan
      const newLoan: EmployeeLoan = {
        id: Date.now().toString(),
        employee: formData.employee,
        loanType: formData.loanType as EmployeeLoan['loanType'],
        amount,
        interestRate,
        termMonths,
        monthlyPayment,
        remainingBalance: amount,
        status: 'pending',
        applicationDate: formData.applicationDate,
        purpose: formData.purpose,
        notes: formData.notes,
      };
      setLoans((prev) => [newLoan, ...prev]);
    }
    setIsFormOpen(false);
    setEditingLoan(null);
  };

  const handleApprove = (id: string) => {
    setLoans((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              status: 'approved' as const,
              approvedBy: 'Current User',
              approvedDate: getCurrentDateISO(),
            }
          : l
      )
    );
  };

  const handleActivate = (id: string) => {
    setLoans((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              status: 'active' as const,
            }
          : l
      )
    );
  };

  const handleReject = (id: string) => {
    const reason = prompt('Please enter rejection reason:');
    if (reason) {
      setLoans((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                status: 'rejected' as const,
                rejectedBy: 'Current User',
                rejectedDate: getCurrentDateISO(),
                rejectionReason: reason,
              }
            : l
        )
      );
    }
  };

  const handleMarkCompleted = (id: string) => {
    setLoans((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              status: 'completed' as const,
              remainingBalance: 0,
            }
          : l
      )
    );
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').slice(1); // Skip header

      const imported = rows
        .filter((row) => row.trim())
        .map((row) => createImportedLoanRecord(row));

      setLoans((prev) => [...imported, ...prev]);
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    const headers = [
      'Employee',
      'Loan Type',
      'Amount',
      'Interest Rate',
      'Term (Months)',
      'Monthly Payment',
      'Remaining Balance',
      'Status',
      'Application Date',
      'Purpose',
    ];
    const rows = filteredLoans.map((l) => [
      l.employee,
      l.loanType,
      l.amount.toString(),
      l.interestRate.toString(),
      l.termMonths.toString(),
      l.monthlyPayment.toFixed(2),
      l.remainingBalance.toString(),
      l.status,
      l.applicationDate,
      l.purpose,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join(
      '\n'
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employee-loans-${getCurrentDateISO()}.csv`;
    a.click();
  };

  return {
    // State
    loans: filteredLoans,
    searchQuery,
    statusFilter,
    loanTypeFilter,
    isFormOpen,
    editingLoan,

    // Computed Values
    totalLoans,
    pendingLoans,
    activeLoans,
    totalDisbursed,
    totalOutstanding,

    // Setters
    setSearchQuery,
    setStatusFilter,
    setLoanTypeFilter,
    setIsFormOpen,

    // Utility Functions
    formatDate,
    formatCurrency,
    formatPercent,
    getStatusColor,
    getLoanTypeColor,

    // Event Handlers
    handleAddLoan,
    handleEditLoan,
    handleDeleteLoan,
    handleSaveLoan,
    handleApprove,
    handleActivate,
    handleReject,
    handleMarkCompleted,
    handleImportCSV,
    handleExportCSV,
  };
}
