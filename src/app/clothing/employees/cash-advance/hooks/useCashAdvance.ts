import { useState, useMemo } from 'react';
import type { CashAdvance, CashAdvanceFormData } from '../types';

export function useCashAdvance() {
  // State Management
  const [cashAdvances, setCashAdvances] = useState<CashAdvance[]>([
    {
      id: '1',
      employee: 'John Doe',
      amount: 5000,
      purpose: 'Medical Emergency',
      terms: '6 months installment',
      requestDate: '2024-01-15',
      status: 'approved',
      approvedBy: 'Manager Smith',
      approvedDate: '2024-01-16',
    },
    {
      id: '2',
      employee: 'Jane Smith',
      amount: 3000,
      purpose: 'Educational expenses',
      terms: '3 months installment',
      requestDate: '2024-02-01',
      status: 'pending',
    },
    {
      id: '3',
      employee: 'Mike Johnson',
      amount: 10000,
      purpose: 'Home renovation',
      terms: '12 months installment',
      requestDate: '2024-02-10',
      status: 'rejected',
      rejectedBy: 'Manager Smith',
      rejectedDate: '2024-02-11',
      rejectionReason: 'Amount exceeds policy limit',
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<CashAdvance | null>(
    null
  );

  // Computed Values
  const filteredRequests = useMemo(() => {
    return cashAdvances.filter((request) => {
      const matchesSearch =
        request.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.terms.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || request.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [cashAdvances, searchQuery, statusFilter]);

  const totalRequests = cashAdvances.length;
  const pendingRequests = cashAdvances.filter(
    (r) => r.status === 'pending'
  ).length;
  const approvedRequests = cashAdvances.filter(
    (r) => r.status === 'approved'
  ).length;
  const totalAmount = cashAdvances
    .filter((r) => r.status === 'approved' || r.status === 'paid')
    .reduce((sum, r) => sum + r.amount, 0);

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

  const getStatusColor = (status: CashAdvance['status']) => {
    switch (status) {
      case 'pending':
        return 'yellow';
      case 'approved':
        return 'green';
      case 'rejected':
        return 'red';
      case 'paid':
        return 'blue';
      default:
        return 'gray';
    }
  };

  // Event Handlers
  const handleAddRequest = () => {
    setEditingRequest(null);
    setIsFormOpen(true);
  };

  const handleEditRequest = (request: CashAdvance) => {
    setEditingRequest(request);
    setIsFormOpen(true);
  };

  const handleDeleteRequest = (id: string) => {
    if (confirm('Are you sure you want to delete this cash advance request?')) {
      setCashAdvances((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const handleSaveRequest = (formData: CashAdvanceFormData) => {
    if (editingRequest) {
      // Update existing request
      setCashAdvances((prev) =>
        prev.map((r) =>
          r.id === editingRequest.id
            ? {
                ...r,
                employee: formData.employee,
                amount: parseFloat(formData.amount),
                purpose: formData.purpose,
                terms: formData.terms,
                requestDate: formData.requestDate,
                notes: formData.notes,
              }
            : r
        )
      );
    } else {
      // Add new request
      const newRequest: CashAdvance = {
        id: Date.now().toString(),
        employee: formData.employee,
        amount: parseFloat(formData.amount),
        purpose: formData.purpose,
        terms: formData.terms,
        requestDate: formData.requestDate,
        status: 'pending',
        notes: formData.notes,
      };
      setCashAdvances((prev) => [newRequest, ...prev]);
    }
    setIsFormOpen(false);
    setEditingRequest(null);
  };

  const handleApprove = (id: string) => {
    setCashAdvances((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'approved' as const,
              approvedBy: 'Current User', // In real app, this would be the logged-in user
              approvedDate: new Date().toISOString().split('T')[0],
            }
          : r
      )
    );
  };

  const handleReject = (id: string) => {
    const reason = prompt('Please enter rejection reason:');
    if (reason) {
      setCashAdvances((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: 'rejected' as const,
                rejectedBy: 'Current User', // In real app, this would be the logged-in user
                rejectedDate: new Date().toISOString().split('T')[0],
                rejectionReason: reason,
              }
            : r
        )
      );
    }
  };

  const handleMarkAsPaid = (id: string) => {
    setCashAdvances((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'paid' as const,
            }
          : r
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
      const rows = text.split('\n').slice(1); // Skip header row

      const imported = rows
        .filter((row) => row.trim())
        .map((row) => {
          const [employee, amount, purpose, terms, requestDate, status] =
            row.split(',');
          return {
            id: Date.now().toString() + Math.random(),
            employee: employee?.trim() || '',
            amount: parseFloat(amount?.trim() || '0'),
            purpose: purpose?.trim() || '',
            terms: terms?.trim() || '',
            requestDate: requestDate?.trim() || '',
            status: (status?.trim() || 'pending') as CashAdvance['status'],
          };
        });

      setCashAdvances((prev) => [...imported, ...prev]);
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    const headers = [
      'Employee',
      'Amount',
      'Purpose',
      'Terms',
      'Request Date',
      'Status',
    ];
    const rows = filteredRequests.map((r) => [
      r.employee,
      r.amount.toString(),
      r.purpose,
      r.terms,
      r.requestDate,
      r.status,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join(
      '\n'
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-advances-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return {
    // State
    cashAdvances: filteredRequests,
    searchQuery,
    statusFilter,
    isFormOpen,
    editingRequest,

    // Computed Values
    totalRequests,
    pendingRequests,
    approvedRequests,
    totalAmount,

    // Setters
    setSearchQuery,
    setStatusFilter,
    setIsFormOpen,

    // Utility Functions
    formatDate,
    formatCurrency,
    getStatusColor,

    // Event Handlers
    handleAddRequest,
    handleEditRequest,
    handleDeleteRequest,
    handleSaveRequest,
    handleApprove,
    handleReject,
    handleMarkAsPaid,
    handleImportCSV,
    handleExportCSV,
  };
}
