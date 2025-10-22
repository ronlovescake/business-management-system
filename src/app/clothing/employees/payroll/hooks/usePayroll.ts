import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Payroll, PayrollFormData } from '../types';
import { getCurrentDateISO } from '@/utils/date';
import Swal from 'sweetalert2';

interface EmployeeDirectoryEntry {
  id: string;
  employeeId: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  sssMonthlyContribution?: number | null;
  philHealthMonthlyContribution?: number | null;
  pagibigMonthlyContribution?: number | null;
  taxMonthlyContribution?: number | null;
}

const normalizeIdentifier = (value: string | undefined | null) =>
  (value ?? '').toString().trim().replace(/\s+/g, ' ').toLowerCase();

export function usePayroll() {
  // State Management
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeDirectoryEntry[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [payPeriodFilter, setPayPeriodFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null);
  const [isGeneratingPayroll, setIsGeneratingPayroll] = useState(false);

  const resolveEmployeeRecord = useCallback(
    (identifier: string | undefined | null) => {
      const normalized = normalizeIdentifier(identifier);
      if (!normalized) {
        return undefined;
      }

      return employees.find((entry) => {
        if (entry.id && normalizeIdentifier(entry.id) === normalized) {
          return true;
        }

        if (normalizeIdentifier(entry.employeeId) === normalized) {
          return true;
        }

        if (normalizeIdentifier(entry.name) === normalized) {
          return true;
        }

        const combined = `${entry.firstName ?? ''} ${entry.lastName ?? ''}`;
        return normalizeIdentifier(combined) === normalized;
      });
    },
    [employees]
  );

  // Fetch payrolls from API
  useEffect(() => {
    fetchPayrolls();
  }, []);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch('/api/employees');
        if (!response.ok) {
          throw new Error('Failed to load employees');
        }
        const data = await response.json();
        const toOptionalNumber = (value: unknown) => {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : undefined;
        };
        const directory = Array.isArray(data)
          ? data.map((item) => ({
              id:
                item.id !== undefined && item.id !== null
                  ? String(item.id)
                  : '',
              employeeId: item.employeeId,
              name:
                item.name ?? `${item.firstName ?? ''} ${item.lastName ?? ''}`,
              firstName: item.firstName ?? null,
              lastName: item.lastName ?? null,
              sssMonthlyContribution:
                toOptionalNumber(item.sssMonthlyContribution) ?? null,
              philHealthMonthlyContribution:
                toOptionalNumber(item.philHealthMonthlyContribution) ?? null,
              pagibigMonthlyContribution:
                toOptionalNumber(item.pagibigMonthlyContribution) ?? null,
              taxMonthlyContribution:
                toOptionalNumber(item.taxMonthlyContribution) ?? null,
            }))
          : [];
        setEmployees(directory);
      } catch (error) {
        console.error('Error fetching employees for payroll directory:', error);
      }
    };

    fetchEmployees();
  }, []);

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/payroll');
      if (!response.ok) {
        throw new Error('Failed to fetch payrolls');
      }
      const data = await response.json();

      const toNumber = (value: unknown): number => {
        if (value === null || value === undefined) {
          return 0;
        }
        if (typeof value === 'number') {
          return value;
        }
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        }
        if (typeof value === 'object' && 'toString' in (value as object)) {
          const parsed = parseFloat(
            (value as { toString(): string }).toString()
          );
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };

      // Map database records to Payroll type
      const mappedPayrolls = data.map((record: Record<string, unknown>) => {
        const basicSalary = toNumber(record.basicSalary);
        const allowance = toNumber(record.allowance);
        const overtime = toNumber(record.overtime);
        const bonuses = toNumber(record.bonuses);
        const thirteenthMonth = toNumber(record.thirteenthMonth);
        const grossPay = toNumber(record.grossPay);
        const sss = toNumber(record.sss);
        const philHealth = toNumber(record.philHealth);
        const pagIbig = toNumber(record.pagIbig);
        const tax = toNumber(record.tax);
        const loans = toNumber(record.loans);
        const cashAdvance = toNumber(record.cashAdvance);
        const lwop = toNumber(
          record.lwop !== undefined && record.lwop !== null
            ? record.lwop
            : record.deduction
        );
        const absentsLates = toNumber(record.absentsLates);

        const derivedTotalDeductions =
          sss +
          philHealth +
          pagIbig +
          tax +
          loans +
          cashAdvance +
          lwop +
          absentsLates;
        const derivedNetPay = Math.max(0, grossPay - derivedTotalDeductions);

        const totalDeductions = toNumber(record.totalDeductions);
        const netPay = toNumber(record.netPay);

        return {
          id: record.id,
          employee: record.employeeName,
          employeeId: record.employeeId ?? null,
          payPeriod: record.payPeriod,
          basicSalary,
          allowance,
          overtime,
          bonuses,
          grossPay,
          thirteenthMonth,
          sss,
          philHealth,
          pagIbig,
          tax,
          loans,
          cashAdvance,
          lwop,
          absentsLates,
          totalDeductions:
            totalDeductions > 0 ? totalDeductions : derivedTotalDeductions,
          netPay: netPay > 0 ? netPay : derivedNetPay,
          status: record.status as 'pending' | 'approved' | 'paid',
          bankGcash: record.bankGcash || '',
          approvedBy: record.approvedBy,
          approvedDate: record.approvedDate,
          paidDate: record.paidDate,
        };
      });

      setPayrolls(mappedPayrolls);
    } catch (error) {
      console.error('Error fetching payrolls:', error);
    } finally {
      setLoading(false);
    }
  };

  // Computed Values
  const filteredPayrolls = useMemo(() => {
    return payrolls.filter((payroll) => {
      const matchesSearch =
        payroll.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payroll.payPeriod.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payroll.bankGcash.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || payroll.status === statusFilter;

      const matchesPayPeriod =
        payPeriodFilter === 'all' || payroll.payPeriod === payPeriodFilter;

      return matchesSearch && matchesStatus && matchesPayPeriod;
    });
  }, [payrolls, searchQuery, statusFilter, payPeriodFilter]);

  const totalPayrolls = payrolls.length;
  const pendingPayrolls = payrolls.filter((p) => p.status === 'pending').length;
  const approvedPayrolls = payrolls.filter(
    (p) => p.status === 'approved'
  ).length;
  const totalNetPay = payrolls
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.netPay, 0);

  // Get unique pay periods for filter
  const payPeriods = useMemo(() => {
    const periods = Array.from(new Set(payrolls.map((p) => p.payPeriod)));
    return ['all', ...periods];
  }, [payrolls]);

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

  const getStatusColor = (status: Payroll['status']) => {
    switch (status) {
      case 'pending':
        return 'orange';
      case 'approved':
        return 'green';
      case 'paid':
        return 'blue';
      default:
        return 'gray';
    }
  };

  // Calculate totals from form data
  const calculateTotals = (formData: PayrollFormData) => {
    const basicSalary = parseFloat(formData.basicSalary) || 0;
    const allowance = parseFloat(formData.allowance) || 0;
    const overtime = parseFloat(formData.overtime) || 0;
    const bonuses = parseFloat(formData.bonuses) || 0;
    const sss = parseFloat(formData.sss) || 0;
    const philHealth = parseFloat(formData.philHealth) || 0;
    const pagIbig = parseFloat(formData.pagIbig) || 0;
    const tax = parseFloat(formData.tax) || 0;
    const loans = parseFloat(formData.loans) || 0;
    const cashAdvance = parseFloat(formData.cashAdvance) || 0;
    const lwop = parseFloat(formData.lwop) || 0;
    const absentsLates = parseFloat(formData.absentsLates) || 0;

    const grossPay = basicSalary + allowance + overtime + bonuses;
    const totalDeductions =
      sss +
      philHealth +
      pagIbig +
      tax +
      loans +
      cashAdvance +
      lwop +
      absentsLates;
    const netPay = grossPay - totalDeductions;

    return {
      grossPay,
      totalDeductions,
      netPay: Math.max(0, netPay), // Ensure net pay is not negative
    };
  };

  // Event Handlers
  const handleAddPayroll = async () => {
    if (isGeneratingPayroll) {
      return;
    }

    setIsGeneratingPayroll(true);

    try {
      const response = await fetch('/api/payroll/generate', {
        method: 'POST',
      });

      let result: unknown = null;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error(
          'Failed to parse payroll generation response:',
          parseError
        );
      }

      const normalized =
        typeof result === 'object' && result !== null
          ? (result as Record<string, unknown>)
          : {};

      if (!response.ok || normalized.success === false) {
        const message =
          typeof normalized.message === 'string'
            ? normalized.message
            : typeof normalized.error === 'string'
              ? normalized.error
              : 'Failed to generate payroll for the current period.';
        throw new Error(message);
      }

      await fetchPayrolls();

      if (typeof normalized.message === 'string' && normalized.message.trim()) {
        alert(normalized.message);
      } else {
        const count = Number(normalized.count ?? 0);
        const safeCount = Number.isFinite(count) ? count : 0;
        alert(
          `Successfully generated payroll for ${safeCount} employee${safeCount === 1 ? '' : 's'}.`
        );
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to generate payroll. Please try again.';
      console.error('Error generating payroll:', error);
      alert(message);
    } finally {
      setIsGeneratingPayroll(false);
    }
  };

  const handleEditPayroll = (payroll: Payroll) => {
    setEditingPayroll(payroll);
    setIsFormOpen(true);
  };

  const handleDeletePayroll = async (id: string) => {
    if (confirm('Are you sure you want to delete this payroll record?')) {
      try {
        const response = await fetch(`/api/payroll?id=${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete payroll');
        }

        // Remove from local state
        setPayrolls((prev) => prev.filter((p) => p.id !== id));
      } catch (error) {
        console.error('Error deleting payroll:', error);
        alert('Failed to delete payroll record');
      }
    }
  };

  const handleSavePayroll = async (formData: PayrollFormData) => {
    const totals = calculateTotals(formData);
    const employeeRecord = resolveEmployeeRecord(formData.employee);
    const employeeId =
      employeeRecord?.employeeId ?? editingPayroll?.employeeId ?? null;
    const employeeName = employeeRecord?.name ?? formData.employee;

    try {
      if (editingPayroll) {
        // Update existing payroll
        const response = await fetch('/api/payroll', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingPayroll.id,
            employeeId,
            employeeName,
            payPeriod: formData.payPeriod,
            basicSalary: parseFloat(formData.basicSalary),
            allowance: parseFloat(formData.allowance) || 0,
            overtime: parseFloat(formData.overtime) || 0,
            bonuses: parseFloat(formData.bonuses) || 0,
            thirteenthMonth: parseFloat(formData.thirteenthMonth) || 0,
            sss: parseFloat(formData.sss) || 0,
            philHealth: parseFloat(formData.philHealth) || 0,
            pagIbig: parseFloat(formData.pagIbig) || 0,
            tax: parseFloat(formData.tax) || 0,
            loans: parseFloat(formData.loans) || 0,
            cashAdvance: parseFloat(formData.cashAdvance) || 0,
            lwop: parseFloat(formData.lwop) || 0,
            absentsLates: parseFloat(formData.absentsLates) || 0,
            bankGcash: formData.bankGcash,
            grossPay: totals.grossPay,
            totalDeductions: totals.totalDeductions,
            netPay: totals.netPay,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update payroll');
        }

        const updated = await response.json();

        setPayrolls((prev) =>
          prev.map((p) =>
            p.id === editingPayroll.id
              ? {
                  ...p,
                  employee: updated.employeeName ?? employeeName,
                  employeeId:
                    updated.employeeId ?? employeeId ?? p.employeeId ?? null,
                  payPeriod: updated.payPeriod,
                  basicSalary: updated.basicSalary,
                  allowance: updated.allowance,
                  overtime: updated.overtime,
                  bonuses: updated.bonuses,
                  thirteenthMonth: updated.thirteenthMonth ?? 0,
                  grossPay: updated.grossPay,
                  sss: updated.sss,
                  philHealth: updated.philHealth,
                  pagIbig: updated.pagIbig,
                  tax: updated.tax,
                  loans: updated.loans,
                  cashAdvance: updated.cashAdvance,
                  lwop: updated.lwop,
                  absentsLates: updated.absentsLates,
                  totalDeductions: updated.totalDeductions,
                  netPay: updated.netPay,
                  bankGcash: updated.bankGcash,
                }
              : p
          )
        );
      } else {
        // Add new payroll
        const response = await fetch('/api/payroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId,
            employeeName,
            payPeriod: formData.payPeriod,
            periodStart: formData.payPeriod.split(' to ')[0],
            periodEnd: formData.payPeriod.split(' to ')[1],
            basicSalary: parseFloat(formData.basicSalary),
            allowance: parseFloat(formData.allowance) || 0,
            overtime: parseFloat(formData.overtime) || 0,
            bonuses: parseFloat(formData.bonuses) || 0,
            thirteenthMonth: parseFloat(formData.thirteenthMonth) || 0,
            grossPay: totals.grossPay,
            sss: parseFloat(formData.sss) || 0,
            philHealth: parseFloat(formData.philHealth) || 0,
            pagIbig: parseFloat(formData.pagIbig) || 0,
            tax: parseFloat(formData.tax) || 0,
            loans: parseFloat(formData.loans) || 0,
            cashAdvance: parseFloat(formData.cashAdvance) || 0,
            lwop: parseFloat(formData.lwop) || 0,
            absentsLates: parseFloat(formData.absentsLates) || 0,
            totalDeductions: totals.totalDeductions,
            netPay: totals.netPay,
            status: 'pending',
            bankGcash: formData.bankGcash,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create payroll');
        }

        const newPayroll = await response.json();

        setPayrolls((prev) => [
          {
            id: newPayroll.id,
            employee: newPayroll.employeeName ?? employeeName,
            employeeId: newPayroll.employeeId ?? employeeId ?? null,
            payPeriod: newPayroll.payPeriod,
            basicSalary: newPayroll.basicSalary,
            allowance: newPayroll.allowance,
            overtime: newPayroll.overtime,
            bonuses: newPayroll.bonuses,
            thirteenthMonth: newPayroll.thirteenthMonth ?? 0,
            grossPay: newPayroll.grossPay,
            sss: newPayroll.sss,
            philHealth: newPayroll.philHealth,
            pagIbig: newPayroll.pagIbig,
            tax: newPayroll.tax,
            loans: newPayroll.loans,
            cashAdvance: newPayroll.cashAdvance,
            lwop: newPayroll.lwop,
            absentsLates: newPayroll.absentsLates,
            totalDeductions: newPayroll.totalDeductions,
            netPay: newPayroll.netPay,
            status: newPayroll.status,
            bankGcash: newPayroll.bankGcash,
          },
          ...prev,
        ]);
      }

      setIsFormOpen(false);
      setEditingPayroll(null);
    } catch (error) {
      console.error('Error saving payroll:', error);
      alert('Failed to save payroll record');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch('/api/payroll', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: 'approved',
          approvedBy: 'Current User',
          approvedDate: getCurrentDateISO(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve payroll');
      }

      const updated = await response.json();

      setPayrolls((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                status: 'approved' as const,
                approvedBy: updated.approvedBy,
                approvedDate: updated.approvedDate,
              }
            : p
        )
      );
    } catch (error) {
      console.error('Error approving payroll:', error);
      alert('Failed to approve payroll record');
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    const payroll = payrolls.find((p) => p.id === id);
    if (!payroll) {
      return;
    }

    // Show confirmation dialog
    const result = await Swal.fire({
      title: 'Mark Payroll as Paid?',
      html: `
        <div style="text-align: left; padding: 0 10px;">
          <p style="margin-bottom: 15px;"><strong>Employee:</strong> ${payroll.employee}</p>
          <p style="margin-bottom: 15px;"><strong>Period:</strong> ${payroll.payPeriod}</p>
          <p style="margin-bottom: 15px;"><strong>Net Pay:</strong> ₱${(payroll.netPay ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          ${
            payroll.thirteenthMonth && payroll.thirteenthMonth > 0
              ? `
          <div style="background-color: #e0f2fe; border-left: 4px solid #0284c7; padding: 12px; margin-top: 15px;">
            <p style="margin: 0; color: #075985;">
              ℹ️ <strong>Note:</strong> This payroll includes 13th month pay (₱${payroll.thirteenthMonth.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). 
              The corresponding 13th month record will also be marked as paid.
            </p>
          </div>
          `
              : ''
          }
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Mark as Paid',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      // Show loading
      Swal.fire({
        title: 'Processing...',
        text: 'Marking payroll as paid',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const paidDate = getCurrentDateISO();

      const response = await fetch('/api/payroll', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: 'paid',
          paidDate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark payroll as paid');
      }

      const updated = await response.json();

      // If this payroll has 13th month pay, also mark 13th month record as paid
      if (payroll.thirteenthMonth && payroll.thirteenthMonth > 0) {
        // Extract year from pay period
        let year = new Date().getFullYear();
        if (payroll.payPeriod) {
          const endDateStr =
            payroll.payPeriod.split(' to ')[1] ||
            payroll.payPeriod.split(' - ')[1] ||
            payroll.payPeriod;
          const parsedDate = new Date(endDateStr);
          if (!isNaN(parsedDate.getTime())) {
            year = parsedDate.getFullYear();
          }
        }

        const employeeId = payroll.employeeId || '';
        const thirteenthMonthRecordId = `${employeeId.toLowerCase()}-${year}`;

        try {
          // Simply update the 13th month record status to 'paid'
          await fetch(
            `/api/thirteenth-month-pay/${thirteenthMonthRecordId}/status`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'paid',
                paidDate: paidDate,
              }),
            }
          );
        } catch (thirteenthError) {
          console.warn(
            'Failed to sync 13th month pay status:',
            thirteenthError
          );
          // Don't fail the entire operation if 13th month sync fails
        }
      }

      setPayrolls((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                status: 'paid' as const,
                paidDate: updated.paidDate,
              }
            : p
        )
      );

      // Show success message
      Swal.fire({
        title: 'Marked as Paid!',
        text:
          payroll.thirteenthMonth && payroll.thirteenthMonth > 0
            ? 'Payroll and 13th month pay have been marked as paid.'
            : 'Payroll has been marked as paid.',
        icon: 'success',
        confirmButtonColor: '#10b981',
      });
    } catch (error) {
      console.error('Error marking payroll as paid:', error);

      // Show error message
      Swal.fire({
        title: 'Error',
        text: 'Failed to mark payroll as paid. Please try again.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
      });
    }
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = (e.target?.result as string) ?? '';
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length <= 1) {
          return;
        }

        const [, ...rows] = lines; // drop header

        const unmatchedEmployees = new Set<string>();

        const payload = rows.map((row) => {
          const columns = row.split(',');
          const employee = columns[0]?.trim() ?? '';
          const payPeriod = columns[1]?.trim() ?? '';
          const [periodStart = '', periodEnd = ''] = payPeriod
            .split(' to ')
            .map((value) => value.trim());

          const employeeRecord = resolveEmployeeRecord(employee);

          const parseNumber = (value: string | undefined) => {
            const parsed = parseFloat((value ?? '').trim() || '0');
            return Number.isFinite(parsed) ? parsed : 0;
          };

          const status = columns[18]?.trim().toLowerCase() || 'pending';

          if (!employeeRecord) {
            unmatchedEmployees.add(employee);
          }

          return {
            employeeId: employeeRecord?.employeeId,
            employeeName: employeeRecord?.name ?? employee,
            payPeriod,
            periodStart,
            periodEnd,
            basicSalary: parseNumber(columns[2]),
            allowance: parseNumber(columns[3]),
            overtime: parseNumber(columns[4]),
            bonuses: parseNumber(columns[5]),
            thirteenthMonth: parseNumber(columns[6]),
            grossPay: parseNumber(columns[7]),
            sss: parseNumber(columns[8]),
            philHealth: parseNumber(columns[9]),
            pagIbig: parseNumber(columns[10]),
            tax: parseNumber(columns[11]),
            loans: parseNumber(columns[12]),
            cashAdvance: parseNumber(columns[13]),
            lwop: parseNumber(columns[14]),
            absentsLates: parseNumber(columns[15]),
            totalDeductions: parseNumber(columns[16]),
            netPay: parseNumber(columns[17]),
            status,
            bankGcash: columns[19]?.trim() ?? '',
          };
        });

        if (payload.length === 0) {
          return;
        }

        const response = await fetch('/api/payroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error('Failed to import payroll CSV');
        }

        await fetchPayrolls();

        if (unmatchedEmployees.size > 0) {
          alert(
            `Imported payroll data, but the following employees could not be matched to existing employee IDs: ${Array.from(
              unmatchedEmployees
            ).join(
              ', '
            )}. Cash advance deductions will only apply to matched employees.`
          );
        }
      } catch (err) {
        console.error('Error importing payroll CSV:', err);
        alert('Failed to import payroll data. Please try again.');
      }
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    const headers = [
      'Employee',
      'Pay Period',
      'Basic Salary',
      'Allowance',
      'Overtime',
      'Bonuses',
      'Gross Pay',
      'SSS',
      'PhilHealth',
      'Pag-IBIG',
      'Tax',
      'Loans',
      'Cash Advance',
      'LWOP',
      'Absences/Lates',
      'Total Deductions',
      'Net Pay',
      'Status',
      'Bank/GCash',
    ];
    const rows = filteredPayrolls.map((p) => [
      p.employee,
      p.payPeriod,
      p.basicSalary.toString(),
      p.allowance.toString(),
      p.overtime.toString(),
      p.bonuses.toString(),
      p.grossPay.toString(),
      p.sss.toString(),
      p.philHealth.toString(),
      p.pagIbig.toString(),
      p.tax.toString(),
      p.loans.toString(),
      p.cashAdvance.toString(),
      p.lwop.toString(),
      p.absentsLates.toString(),
      p.totalDeductions.toString(),
      p.netPay.toString(),
      p.status,
      p.bankGcash,
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join(
      '\n'
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${getCurrentDateISO()}.csv`;
    a.click();
  };

  const getEmployeeMonthlyContributions = useCallback(
    (employeeId?: string | null, fallbackName?: string) => {
      const directoryEntry =
        resolveEmployeeRecord(employeeId) ||
        resolveEmployeeRecord(fallbackName);

      if (!directoryEntry) {
        return null;
      }

      return {
        sss:
          directoryEntry.sssMonthlyContribution !== undefined &&
          directoryEntry.sssMonthlyContribution !== null
            ? directoryEntry.sssMonthlyContribution
            : null,
        philHealth:
          directoryEntry.philHealthMonthlyContribution !== undefined &&
          directoryEntry.philHealthMonthlyContribution !== null
            ? directoryEntry.philHealthMonthlyContribution
            : null,
        pagIbig:
          directoryEntry.pagibigMonthlyContribution !== undefined &&
          directoryEntry.pagibigMonthlyContribution !== null
            ? directoryEntry.pagibigMonthlyContribution
            : null,
        tax:
          directoryEntry.taxMonthlyContribution !== undefined &&
          directoryEntry.taxMonthlyContribution !== null
            ? directoryEntry.taxMonthlyContribution
            : null,
      };
    },
    [resolveEmployeeRecord]
  );

  // ============================================================================
  // LWOP SYNC FUNCTIONALITY
  // ============================================================================

  const [isSyncingLwop, setIsSyncingLwop] = useState(false);

  const handleSyncLwop = async () => {
    if (isSyncingLwop) {
      return;
    }

    if (
      !confirm(
        'This will calculate and update LWOP deductions for all payroll records based on approved unpaid leave requests. Continue?'
      )
    ) {
      return;
    }

    setIsSyncingLwop(true);
    try {
      const response = await fetch('/api/payroll/sync-lwop?all=true', {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        alert(
          `Successfully synced LWOP!\n\nUpdated: ${result.synced} record(s)\nTotal checked: ${result.total} record(s)`
        );
        await fetchPayrolls();
      } else {
        const error = await response.json();
        alert(`Failed to sync LWOP: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error syncing LWOP:', error);
      alert('Failed to sync LWOP. Please try again.');
    } finally {
      setIsSyncingLwop(false);
    }
  };

  return {
    // State
    payrolls: filteredPayrolls,
    searchQuery,
    statusFilter,
    payPeriodFilter,
    isFormOpen,
    editingPayroll,
    payPeriods,
    loading,

    // Computed Values
    totalPayrolls,
    pendingPayrolls,
    approvedPayrolls,
    totalNetPay,

    // Setters
    setSearchQuery,
    setStatusFilter,
    setPayPeriodFilter,
    setIsFormOpen,

    // Utility Functions
    formatDate,
    formatCurrency,
    getStatusColor,
    calculateTotals,

    // Event Handlers
    handleAddPayroll,
    handleEditPayroll,
    handleDeletePayroll,
    handleSavePayroll,
    handleApprove,
    handleMarkAsPaid,
    handleImportCSV,
    handleExportCSV,
    handleSyncLwop,
    getEmployeeMonthlyContributions,

    // Loading States
    isSyncingLwop,
  };
}
