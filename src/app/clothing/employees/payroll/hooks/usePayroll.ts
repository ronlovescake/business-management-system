import { useState, useMemo } from 'react';
import { Payroll, PayrollFormData } from '../types';

export function usePayroll() {
  // State Management
  const [payrolls, setPayrolls] = useState<Payroll[]>([
    {
      id: '1',
      employee: 'John Doe',
      payPeriod: '2024-10-01 to 2024-10-15',
      basicSalary: 15000,
      allowance: 2000,
      overtime: 1500,
      bonuses: 3000,
      grossPay: 21500,
      sss: 900,
      philHealth: 400,
      pagIbig: 200,
      tax: 1500,
      loans: 1000,
      others: 500,
      totalDeductions: 4500,
      netPay: 17000,
      status: 'paid',
      bankGcash: 'BDO - 001234567890',
      paidDate: '2024-10-16',
    },
    {
      id: '2',
      employee: 'Jane Smith',
      payPeriod: '2024-10-01 to 2024-10-15',
      basicSalary: 18000,
      allowance: 2500,
      overtime: 2000,
      bonuses: 5000,
      grossPay: 27500,
      sss: 1200,
      philHealth: 500,
      pagIbig: 200,
      tax: 2000,
      loans: 2000,
      others: 300,
      totalDeductions: 6200,
      netPay: 21300,
      status: 'approved',
      bankGcash: 'GCash - 09171234567',
      approvedBy: 'Manager Smith',
      approvedDate: '2024-10-15',
    },
    {
      id: '3',
      employee: 'Mike Johnson',
      payPeriod: '2024-10-01 to 2024-10-15',
      basicSalary: 12000,
      allowance: 1500,
      overtime: 1000,
      bonuses: 2000,
      grossPay: 16500,
      sss: 750,
      philHealth: 350,
      pagIbig: 200,
      tax: 1200,
      loans: 0,
      others: 200,
      totalDeductions: 2700,
      netPay: 13800,
      status: 'pending',
      bankGcash: 'BPI - 123456789012',
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [payPeriodFilter, setPayPeriodFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null);

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
    const others = parseFloat(formData.others) || 0;

    const grossPay = basicSalary + allowance + overtime + bonuses;
    const totalDeductions = sss + philHealth + pagIbig + tax + loans + others;
    const netPay = grossPay - totalDeductions;

    return {
      grossPay,
      totalDeductions,
      netPay: Math.max(0, netPay), // Ensure net pay is not negative
    };
  };

  // Event Handlers
  const handleAddPayroll = () => {
    setEditingPayroll(null);
    setIsFormOpen(true);
  };

  const handleEditPayroll = (payroll: Payroll) => {
    setEditingPayroll(payroll);
    setIsFormOpen(true);
  };

  const handleDeletePayroll = (id: string) => {
    if (confirm('Are you sure you want to delete this payroll record?')) {
      setPayrolls((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleSavePayroll = (formData: PayrollFormData) => {
    const totals = calculateTotals(formData);

    if (editingPayroll) {
      // Update existing payroll
      setPayrolls((prev) =>
        prev.map((p) =>
          p.id === editingPayroll.id
            ? {
                ...p,
                employee: formData.employee,
                payPeriod: formData.payPeriod,
                basicSalary: parseFloat(formData.basicSalary),
                allowance: parseFloat(formData.allowance) || 0,
                overtime: parseFloat(formData.overtime) || 0,
                bonuses: parseFloat(formData.bonuses) || 0,
                sss: parseFloat(formData.sss) || 0,
                philHealth: parseFloat(formData.philHealth) || 0,
                pagIbig: parseFloat(formData.pagIbig) || 0,
                tax: parseFloat(formData.tax) || 0,
                loans: parseFloat(formData.loans) || 0,
                others: parseFloat(formData.others) || 0,
                bankGcash: formData.bankGcash,
                grossPay: totals.grossPay,
                totalDeductions: totals.totalDeductions,
                netPay: totals.netPay,
              }
            : p
        )
      );
    } else {
      // Add new payroll
      const newPayroll: Payroll = {
        id: Date.now().toString(),
        employee: formData.employee,
        payPeriod: formData.payPeriod,
        basicSalary: parseFloat(formData.basicSalary),
        allowance: parseFloat(formData.allowance) || 0,
        overtime: parseFloat(formData.overtime) || 0,
        bonuses: parseFloat(formData.bonuses) || 0,
        sss: parseFloat(formData.sss) || 0,
        philHealth: parseFloat(formData.philHealth) || 0,
        pagIbig: parseFloat(formData.pagIbig) || 0,
        tax: parseFloat(formData.tax) || 0,
        loans: parseFloat(formData.loans) || 0,
        others: parseFloat(formData.others) || 0,
        bankGcash: formData.bankGcash,
        grossPay: totals.grossPay,
        totalDeductions: totals.totalDeductions,
        netPay: totals.netPay,
        status: 'pending',
      };
      setPayrolls((prev) => [newPayroll, ...prev]);
    }
    setIsFormOpen(false);
    setEditingPayroll(null);
  };

  const handleApprove = (id: string) => {
    setPayrolls((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: 'approved' as const,
              approvedBy: 'Current User',
              approvedDate: new Date().toISOString().split('T')[0],
            }
          : p
      )
    );
  };

  const handleMarkAsPaid = (id: string) => {
    setPayrolls((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: 'paid' as const,
              paidDate: new Date().toISOString().split('T')[0],
            }
          : p
      )
    );
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').slice(1); // Skip header row

      const imported = rows
        .filter((row) => row.trim())
        .map((row) => {
          const [
            employee,
            payPeriod,
            basicSalary,
            allowance,
            overtime,
            bonuses,
            sss,
            philHealth,
            pagIbig,
            tax,
            loans,
            others,
            bankGcash,
            status,
          ] = row.split(',');

          const basic = parseFloat(basicSalary?.trim() || '0');
          const allow = parseFloat(allowance?.trim() || '0');
          const ot = parseFloat(overtime?.trim() || '0');
          const bonus = parseFloat(bonuses?.trim() || '0');
          const sssAmt = parseFloat(sss?.trim() || '0');
          const philHealthAmt = parseFloat(philHealth?.trim() || '0');
          const pagIbigAmt = parseFloat(pagIbig?.trim() || '0');
          const taxAmt = parseFloat(tax?.trim() || '0');
          const loansAmt = parseFloat(loans?.trim() || '0');
          const othersAmt = parseFloat(others?.trim() || '0');

          const grossPay = basic + allow + ot + bonus;
          const totalDeductions =
            sssAmt + philHealthAmt + pagIbigAmt + taxAmt + loansAmt + othersAmt;
          const netPay = grossPay - totalDeductions;

          return {
            id: Date.now().toString() + Math.random(),
            employee: employee?.trim() || '',
            payPeriod: payPeriod?.trim() || '',
            basicSalary: basic,
            allowance: allow,
            overtime: ot,
            bonuses: bonus,
            grossPay,
            sss: sssAmt,
            philHealth: philHealthAmt,
            pagIbig: pagIbigAmt,
            tax: taxAmt,
            loans: loansAmt,
            others: othersAmt,
            totalDeductions,
            netPay,
            status: (status?.trim() || 'pending') as Payroll['status'],
            bankGcash: bankGcash?.trim() || '',
          };
        });

      setPayrolls((prev) => [...imported, ...prev]);
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
      'Others',
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
      p.others.toString(),
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
    a.download = `payroll-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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
  };
}
