import { useState, useMemo } from 'react';
import type { EmployeeLoan, EmployeeLoanFormData } from '../types';
import { getCurrentDateISO } from '@/utils/date';

export function useEmployeeLoans() {
  // Sample data
  const [loans, setLoans] = useState<EmployeeLoan[]>([
    {
      id: '1',
      employee: 'John Doe',
      loanType: 'personal',
      amount: 50000,
      interestRate: 5.5,
      termMonths: 24,
      monthlyPayment: 2247.82,
      remainingBalance: 35000,
      status: 'active',
      applicationDate: '2024-01-15',
      purpose: 'Home renovation',
      approvedBy: 'Manager Smith',
      approvedDate: '2024-01-20',
    },
    {
      id: '2',
      employee: 'Jane Smith',
      loanType: 'emergency',
      amount: 15000,
      interestRate: 3.0,
      termMonths: 12,
      monthlyPayment: 1267.5,
      remainingBalance: 0,
      status: 'completed',
      applicationDate: '2023-06-01',
      purpose: 'Medical emergency',
      approvedBy: 'Manager Smith',
      approvedDate: '2023-06-02',
    },
    {
      id: '3',
      employee: 'Mike Johnson',
      loanType: 'educational',
      amount: 30000,
      interestRate: 4.0,
      termMonths: 36,
      monthlyPayment: 885.08,
      remainingBalance: 30000,
      status: 'pending',
      applicationDate: '2024-03-01',
      purpose: 'Masters degree program',
    },
    {
      id: '4',
      employee: 'Sarah Williams',
      loanType: 'vehicle',
      amount: 25000,
      interestRate: 6.0,
      termMonths: 48,
      monthlyPayment: 587.13,
      remainingBalance: 18500,
      status: 'active',
      applicationDate: '2023-11-10',
      purpose: 'Car purchase',
      approvedBy: 'Manager Smith',
      approvedDate: '2023-11-12',
    },
  ]);

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

  const totalLoans = loans.length;
  const pendingLoans = loans.filter((l) => l.status === 'pending').length;
  const activeLoans = loans.filter((l) => l.status === 'active').length;
  const totalDisbursed = loans
    .filter((l) => l.status === 'active' || l.status === 'completed')
    .reduce((sum, l) => sum + l.amount, 0);
  const totalOutstanding = loans
    .filter((l) => l.status === 'active')
    .reduce((sum, l) => sum + l.remainingBalance, 0);

  // Utility Functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercent = (rate: number) => {
    return `${rate.toFixed(2)}%`;
  };

  const getStatusColor = (status: EmployeeLoan['status']) => {
    switch (status) {
      case 'pending':
        return 'yellow';
      case 'approved':
        return 'blue';
      case 'active':
        return 'green';
      case 'completed':
        return 'teal';
      case 'rejected':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getLoanTypeColor = (type: EmployeeLoan['loanType']) => {
    switch (type) {
      case 'personal':
        return 'blue';
      case 'emergency':
        return 'red';
      case 'educational':
        return 'violet';
      case 'housing':
        return 'green';
      case 'vehicle':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const calculateMonthlyPayment = (
    principal: number,
    annualRate: number,
    months: number
  ) => {
    if (annualRate === 0) {
      return principal / months;
    }
    const monthlyRate = annualRate / 100 / 12;
    return (
      (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1)
    );
  };

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
    const monthlyPayment = calculateMonthlyPayment(
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
        .map((row) => {
          const [
            employee,
            loanType,
            amount,
            interestRate,
            termMonths,
            purpose,
            applicationDate,
          ] = row.split(',');

          const loanAmount = parseFloat(amount?.trim() || '0');
          const rate = parseFloat(interestRate?.trim() || '0');
          const term = parseInt(termMonths?.trim() || '12');
          const monthlyPayment = calculateMonthlyPayment(
            loanAmount,
            rate,
            term
          );

          return {
            id: Date.now().toString() + Math.random(),
            employee: employee?.trim() || '',
            loanType: (loanType?.trim() ||
              'personal') as EmployeeLoan['loanType'],
            amount: loanAmount,
            interestRate: rate,
            termMonths: term,
            monthlyPayment,
            remainingBalance: loanAmount,
            status: 'pending' as const,
            applicationDate: applicationDate?.trim() || getCurrentDateISO(),
            purpose: purpose?.trim() || '',
          };
        });

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
