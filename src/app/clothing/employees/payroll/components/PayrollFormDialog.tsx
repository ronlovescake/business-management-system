import { useEffect } from 'react';
import { TextInput, NumberInput, Grid } from '@mantine/core';
import { useForm } from '@mantine/form';
import { ComposedDialog } from '@/components/shared/Dialog';
import type { Payroll, PayrollFormData } from '../types';

interface PayrollFormDialogProps {
  opened: boolean;
  editingPayroll: Payroll | null;
  onClose: () => void;
  onSave: (data: PayrollFormData) => void;
  calculateTotals: (data: PayrollFormData) => {
    grossPay: number;
    totalDeductions: number;
    netPay: number;
  };
}

export function PayrollFormDialog({
  opened,
  editingPayroll,
  onClose,
  onSave,
  calculateTotals,
}: PayrollFormDialogProps) {
  const form = useForm<PayrollFormData>({
    initialValues: {
      employee: '',
      payPeriod: '',
      basicSalary: '',
      allowance: '0',
      overtime: '0',
      bonuses: '0',
      sss: '0',
      philHealth: '0',
      pagIbig: '0',
      tax: '0',
      loans: '0',
      cashAdvance: '0',
      lwop: '0',
      absentsLates: '0',
      bankGcash: '',
    },
    validate: {
      employee: (value) => (!value ? 'Employee name is required' : null),
      payPeriod: (value) => (!value ? 'Pay period is required' : null),
      basicSalary: (value) => {
        if (!value) {
          return 'Basic salary is required';
        }
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
          return 'Basic salary must be greater than 0';
        }
        return null;
      },
      bankGcash: (value) => (!value ? 'Bank/GCash info is required' : null),
    },
  });

  useEffect(() => {
    if (editingPayroll) {
      form.setValues({
        employee: editingPayroll.employee,
        payPeriod: editingPayroll.payPeriod,
        basicSalary: editingPayroll.basicSalary.toString(),
        allowance: editingPayroll.allowance.toString(),
        overtime: editingPayroll.overtime.toString(),
        bonuses: editingPayroll.bonuses.toString(),
        sss: editingPayroll.sss.toString(),
        philHealth: editingPayroll.philHealth.toString(),
        pagIbig: editingPayroll.pagIbig.toString(),
        tax: editingPayroll.tax.toString(),
        loans: editingPayroll.loans.toString(),
        cashAdvance: editingPayroll.cashAdvance.toString(),
        lwop: editingPayroll.lwop.toString(),
        absentsLates: editingPayroll.absentsLates.toString(),
        bankGcash: editingPayroll.bankGcash,
      });
    } else {
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPayroll, opened]);

  const handleSubmit = (values: PayrollFormData) => {
    onSave(values);
    form.reset();
  };

  const handleSave = () => {
    form.onSubmit(handleSubmit)();
  };

  // Calculate real-time totals
  const totals = calculateTotals(form.values);

  return (
    <ComposedDialog
      opened={opened}
      onClose={onClose}
      size="xl"
      header={{
        title: editingPayroll ? 'Edit Payroll' : 'Add Payroll',
        subtitle: editingPayroll
          ? 'Update the payroll details below'
          : 'Fill in the details to create a new payroll record',
        iconColor: '#6366f1',
      }}
      body={{
        padding: 'md',
        maxHeight: '75vh',
      }}
      footer={{
        layout: 'flex-end',
        secondaryButton: {
          label: 'Cancel',
          onClick: onClose,
          variant: 'default',
        },
        primaryButton: {
          label: editingPayroll ? 'Update Payroll' : 'Create Payroll',
          onClick: handleSave,
          disabled: !form.isValid(),
          color: '#6366f1',
        },
      }}
    >
      <Grid gutter="md">
        {/* Employee & Pay Period */}
        <Grid.Col span={6}>
          <TextInput
            label="Employee Name"
            placeholder="Enter employee name"
            required
            {...form.getInputProps('employee')}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput
            label="Pay Period"
            placeholder="e.g., 2024-10-01 to 2024-10-15"
            required
            {...form.getInputProps('payPeriod')}
          />
        </Grid.Col>

        {/* Earnings Section */}
        <Grid.Col span={12}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '8px',
              color: '#495057',
              borderBottom: '2px solid #e9ecef',
              paddingBottom: '8px',
            }}
          >
            💰 Earnings
          </div>
        </Grid.Col>

        <Grid.Col span={6}>
          <NumberInput
            label="Basic Salary"
            placeholder="Enter basic salary"
            required
            min={0}
            prefix="₱"
            decimalScale={2}
            thousandSeparator=","
            hideControls
            value={form.values.basicSalary}
            onChange={(value) =>
              form.setFieldValue('basicSalary', value?.toString() || '')
            }
            error={form.errors.basicSalary}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <NumberInput
            label="Allowance"
            placeholder="Enter allowance"
            min={0}
            prefix="₱"
            decimalScale={2}
            thousandSeparator=","
            hideControls
            value={form.values.allowance}
            onChange={(value) =>
              form.setFieldValue('allowance', value?.toString() || '0')
            }
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <NumberInput
            label="Overtime"
            placeholder="Enter overtime pay"
            min={0}
            prefix="₱"
            decimalScale={2}
            thousandSeparator=","
            hideControls
            value={form.values.overtime}
            onChange={(value) =>
              form.setFieldValue('overtime', value?.toString() || '0')
            }
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <NumberInput
            label="Bonuses"
            placeholder="Enter bonuses"
            min={0}
            prefix="₱"
            decimalScale={2}
            thousandSeparator=","
            hideControls
            value={form.values.bonuses}
            onChange={(value) =>
              form.setFieldValue('bonuses', value?.toString() || '0')
            }
          />
        </Grid.Col>

        {/* Gross Pay Display */}
        <Grid.Col span={12}>
          <div
            style={{
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e9ecef',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 600, color: '#495057' }}>
              Gross Pay:
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: '18px',
                color: '#10b981',
              }}
            >
              ₱
              {totals.grossPay.toLocaleString('en-PH', {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </Grid.Col>

        {/* Deductions Section */}
        <Grid.Col span={12}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '8px',
              color: '#495057',
              borderBottom: '2px solid #e9ecef',
              paddingBottom: '8px',
              marginTop: '16px',
            }}
          >
            📉 Deductions
          </div>
        </Grid.Col>

        <Grid.Col span={6}>
          <NumberInput
            label="SSS"
            placeholder="Enter SSS contribution"
            min={0}
            prefix="₱"
            decimalScale={2}
            thousandSeparator=","
            hideControls
            value={form.values.sss}
            onChange={(value) =>
              form.setFieldValue('sss', value?.toString() || '0')
            }
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <NumberInput
            label="PhilHealth"
            placeholder="Enter PhilHealth contribution"
            min={0}
            prefix="₱"
            decimalScale={2}
            thousandSeparator=","
            hideControls
            value={form.values.philHealth}
            onChange={(value) =>
              form.setFieldValue('philHealth', value?.toString() || '0')
            }
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <NumberInput
            label="Pag-IBIG"
            placeholder="Enter Pag-IBIG contribution"
            min={0}
            prefix="₱"
            decimalScale={2}
            thousandSeparator=","
            hideControls
            value={form.values.pagIbig}
            onChange={(value) =>
              form.setFieldValue('pagIbig', value?.toString() || '0')
            }
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <NumberInput
            label="Tax"
            placeholder="Enter withholding tax"
            min={0}
            prefix="₱"
            decimalScale={2}
            thousandSeparator=","
            hideControls
            value={form.values.tax}
            onChange={(value) =>
              form.setFieldValue('tax', value?.toString() || '0')
            }
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <NumberInput
            label="Loans"
            placeholder="Enter loan deductions"
            min={0}
            prefix="₱"
            decimalScale={2}
            thousandSeparator=","
            hideControls
            value={form.values.loans}
            onChange={(value) =>
              form.setFieldValue('loans', value?.toString() || '0')
            }
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <NumberInput
            label="Cash Advance"
            placeholder="Enter cash advance deductions"
            min={0}
            prefix="₱"
            decimalScale={2}
            thousandSeparator=","
            hideControls
            value={form.values.cashAdvance}
            onChange={(value) =>
              form.setFieldValue('cashAdvance', value?.toString() || '0')
            }
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <NumberInput
            label="LWOP"
            placeholder="Enter leave without pay deductions"
            min={0}
            prefix="₱"
            decimalScale={2}
            thousandSeparator=","
            hideControls
            value={form.values.lwop}
            onChange={(value) =>
              form.setFieldValue('lwop', value?.toString() || '0')
            }
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <NumberInput
            label="Absents/Lates"
            placeholder="Enter deductions for absents/lates"
            min={0}
            prefix="₱"
            decimalScale={2}
            thousandSeparator=","
            hideControls
            value={form.values.absentsLates}
            onChange={(value) =>
              form.setFieldValue('absentsLates', value?.toString() || '0')
            }
          />
        </Grid.Col>

        {/* Total Deductions Display */}
        <Grid.Col span={12}>
          <div
            style={{
              padding: '12px',
              backgroundColor: '#fff5f5',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 600, color: '#495057' }}>
              Total Deductions:
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: '18px',
                color: '#ef4444',
              }}
            >
              ₱
              {totals.totalDeductions.toLocaleString('en-PH', {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </Grid.Col>

        {/* Net Pay Display */}
        <Grid.Col span={12}>
          <div
            style={{
              padding: '16px',
              backgroundColor: '#f0f9ff',
              borderRadius: '8px',
              border: '2px solid #3b82f6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{ fontWeight: 700, fontSize: '16px', color: '#1e40af' }}
            >
              NET PAY:
            </span>
            <span
              style={{
                fontWeight: 900,
                fontSize: '24px',
                color: '#1e40af',
              }}
            >
              ₱
              {totals.netPay.toLocaleString('en-PH', {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        </Grid.Col>

        {/* Bank/GCash */}
        <Grid.Col span={12}>
          <TextInput
            label="Bank/GCash"
            placeholder="e.g., BDO - 001234567890 or GCash - 09171234567"
            required
            {...form.getInputProps('bankGcash')}
          />
        </Grid.Col>
      </Grid>
    </ComposedDialog>
  );
}
