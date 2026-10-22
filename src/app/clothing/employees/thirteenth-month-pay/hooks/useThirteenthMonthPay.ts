import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ThirteenthMonthPay } from '../types';
import { getCurrentDateISO, formatDisplayDate } from '@/utils/date';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { queryKeys } from '@/lib/queryKeys';
import { getSwal } from '@/lib/alerts';
export function useThirteenthMonthPay(apiBasePath?: string) {
  const queryClient = useQueryClient();
  const resolveApiPath = useCallback(
    (path: string) => buildApiPath(apiBasePath, path),
    [apiBasePath]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  // Filters for query key
  const filters = useMemo(
    () => ({
      year: yearFilter === 'all' ? undefined : parseInt(yearFilter, 10),
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [yearFilter, statusFilter]
  );

  const thirteenthQueryKey = useMemo(
    () => ({
      lists: () => [...queryKeys.thirteenthMonthPay.lists(), { apiBasePath }],
      list: (currentFilters: typeof filters) => [
        ...queryKeys.thirteenthMonthPay.list(currentFilters),
        { apiBasePath },
      ],
    }),
    [apiBasePath]
  );

  // Fetch records already calculated and merged with persisted status on the server.
  const { data: records = [], isLoading } = useQuery({
    queryKey: thirteenthQueryKey.list(filters),
    queryFn: () =>
      api.get<ThirteenthMonthPay[]>(
        resolveApiPath('/thirteenth-month-pay/calculated')
      ),
    staleTime: 30 * 1000,
  });

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
    const total = filteredRecords.length;
    const pending = filteredRecords.filter(
      (r) => r.status === 'pending'
    ).length;
    const calculated = filteredRecords.filter(
      (r) => r.status === 'calculated'
    ).length;
    const approved = filteredRecords.filter(
      (r) => r.status === 'approved'
    ).length;
    const paid = filteredRecords.filter((r) => r.status === 'paid').length;
    const totalAmount = filteredRecords.reduce(
      (sum, r) => sum + r.thirteenthMonthPay,
      0
    );
    const paidAmount = filteredRecords
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
  }, [filteredRecords]);

  // Delete record mutation
  const deleteRecordMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(
        `${resolveApiPath('/thirteenth-month-pay')}?recordId=${encodeURIComponent(id)}`
      );
      return id;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({
        queryKey: thirteenthQueryKey.lists(),
      });

      const previous = queryClient.getQueryData<ThirteenthMonthPay[]>(
        thirteenthQueryKey.list(filters)
      );

      if (previous) {
        queryClient.setQueryData<ThirteenthMonthPay[]>(
          thirteenthQueryKey.list(filters),
          previous.filter((record) => record.id !== deletedId)
        );
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          thirteenthQueryKey.list(filters),
          context.previous
        );
      }
      logger.error('Error deleting record:', error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: thirteenthQueryKey.lists(),
      });
    },
  });

  // Approve record mutation
  const approveRecordMutation = useMutation({
    mutationFn: async (id: string) => {
      const approvedDate = getCurrentDateISO();
      await api.patch(resolveApiPath('/thirteenth-month-pay'), {
        id,
        status: 'approved',
        approvedDate,
      });

      return { id, approvedDate };
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: thirteenthQueryKey.lists(),
      });

      const previous = queryClient.getQueryData<ThirteenthMonthPay[]>(
        thirteenthQueryKey.list(filters)
      );

      if (previous) {
        const approvedDate = getCurrentDateISO();
        queryClient.setQueryData<ThirteenthMonthPay[]>(
          thirteenthQueryKey.list(filters),
          previous.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: 'approved',
                  approvedDate,
                }
              : r
          )
        );
      }

      return { previous };
    },
    onError: async (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          thirteenthQueryKey.list(filters),
          context.previous
        );
      }
      logger.error('Error approving record:', error);
      const Swal = await getSwal();
      Swal.fire({
        title: 'Error',
        text: 'Failed to approve the record. Please try again.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        allowOutsideClick: false,
      });
    },
    onSuccess: async () => {
      const Swal = await getSwal();
      Swal.fire({
        title: 'Approved!',
        text: 'The 13th month pay has been approved and locked.',
        icon: 'success',
        confirmButtonColor: '#10b981',
        allowOutsideClick: false,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: thirteenthQueryKey.lists(),
      });
    },
  });

  // Mark as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const paidDate = getCurrentDateISO();
      await api.patch(resolveApiPath('/thirteenth-month-pay'), {
        id,
        status: 'paid',
        paidDate,
      });

      return { id, paidDate };
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: thirteenthQueryKey.lists(),
      });

      const previous = queryClient.getQueryData<ThirteenthMonthPay[]>(
        thirteenthQueryKey.list(filters)
      );

      if (previous) {
        const paidDate = getCurrentDateISO();
        queryClient.setQueryData<ThirteenthMonthPay[]>(
          thirteenthQueryKey.list(filters),
          previous.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: 'paid',
                  paidDate,
                }
              : r
          )
        );
      }

      return { previous };
    },
    onError: async (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          thirteenthQueryKey.list(filters),
          context.previous
        );
      }
      logger.error('Error marking as paid:', error);
      const Swal = await getSwal();
      Swal.fire({
        title: 'Error',
        text: 'Failed to mark as paid. Please try again.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        allowOutsideClick: false,
      });
    },
    onSuccess: async () => {
      const Swal = await getSwal();
      Swal.fire({
        title: 'Marked as Paid!',
        text: 'The payment has been recorded successfully.',
        icon: 'success',
        confirmButtonColor: '#6366f1',
        allowOutsideClick: false,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: thirteenthQueryKey.lists(),
      });
    },
  });

  // Wrapper functions
  const deleteRecord = (id: string) => {
    deleteRecordMutation.mutate(id);
  };

  const approveRecord = async (id: string) => {
    const Swal = await getSwal();
    const record = records.find((r) => r.id === id);
    if (!record) {
      return;
    }

    // Show confirmation dialog
    const result = await Swal.fire({
      title: 'Approve 13th Month Pay?',
      html: `
        <div style="text-align: left; padding: 0 10px;">
          <p style="margin-bottom: 15px;"><strong>Employee:</strong> ${record.employee}</p>
          <p style="margin-bottom: 15px;"><strong>13th Month Pay:</strong> ₱${record.thirteenthMonthPay.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin-top: 15px;">
            <p style="margin: 0; color: #856404;">
              ⚠️ <strong>Warning:</strong> Once approved, the calculated values will be <strong>locked</strong> and will no longer auto-update based on payroll changes.
            </p>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Approve & Lock',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
      allowOutsideClick: false,
    });

    if (!result.isConfirmed) {
      return;
    }

    Swal.fire({
      title: 'Processing...',
      text: 'Approving 13th month pay record',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    approveRecordMutation.mutate(id);
  };

  const markAsPaid = async (id: string) => {
    const Swal = await getSwal();
    const record = records.find((r) => r.id === id);
    if (!record) {
      return;
    }

    // Show confirmation dialog
    const result = await Swal.fire({
      title: 'Mark as Paid?',
      html: `
        <div style="text-align: left; padding: 0 10px;">
          <p style="margin-bottom: 15px;"><strong>Employee:</strong> ${record.employee}</p>
          <p style="margin-bottom: 15px;"><strong>13th Month Pay:</strong> ₱${record.thirteenthMonthPay.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p style="margin: 0;">This will mark the record as paid and record the payment date.</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Mark as Paid',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
      allowOutsideClick: false,
    });

    if (!result.isConfirmed) {
      return;
    }

    Swal.fire({
      title: 'Processing...',
      text: 'Marking as paid',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    markAsPaidMutation.mutate(id);
  };

  // Utility functions
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const formatDate = (dateString?: string): string =>
    dateString ? formatDisplayDate(dateString) : 'N/A';

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

  const importFromCSV = (file: File) => {
    logger.debug('Importing CSV:', file.name);
    // CSV import logic would go here
  };

  const exportToCSV = () => {
    const headers = [
      'Employee',
      'Year',
      'Hire Date',
      'Tenureship',
      'Total Basic Salary',
      'Total LWOP',
      'Total Absences/Lates',
      'Net Basic Salary',
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
      record.hireDate || '',
      record.tenureship || '',
      record.totalBasicSalary.toString(),
      record.totalLwop.toString(),
      record.totalAbsencesLates.toString(),
      record.netBasicSalary.toFixed(2),
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
    isLoading,
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
    deleteRecord,
    approveRecord,
    markAsPaid,
    importFromCSV,
    exportToCSV,
  };
}
