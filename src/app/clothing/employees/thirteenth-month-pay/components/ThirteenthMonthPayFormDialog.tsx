import { useEffect } from 'react';
import { NumberInput, Select, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { ComposedDialog } from '@/components/shared/Dialog';
import type { ThirteenthMonthPay, ThirteenthMonthPayFormData } from '../types';

interface ThirteenthMonthPayFormDialogProps {
  opened: boolean;
  editingRecord: ThirteenthMonthPay | null;
  onClose: () => void;
  onSave: (data: ThirteenthMonthPayFormData) => void;
}

export function ThirteenthMonthPayFormDialog({
  opened,
  editingRecord,
  onClose,
  onSave,
}: ThirteenthMonthPayFormDialogProps) {
  const form = useForm<ThirteenthMonthPayFormData>({
    initialValues: {
      employee: '',
      year: new Date().getFullYear().toString(),
      basicSalary: '',
      totalEarnings: '',
      eligibilityMonths: '12',
      deductions: '0',
      notes: '',
    },
    validate: {
      employee: (value) => (!value ? 'Employee name is required' : null),
      year: (value) => {
        if (!value) {
          return 'Year is required';
        }
        const year = parseInt(value);
        if (isNaN(year) || year < 2000 || year > 2100) {
          return 'Invalid year';
        }
        return null;
      },
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
      totalEarnings: (value) => {
        if (!value) {
          return 'Total earnings is required';
        }
        const num = parseFloat(value);
        if (isNaN(num) || num < 0) {
          return 'Total earnings must be 0 or greater';
        }
        return null;
      },
      eligibilityMonths: (value) => {
        if (!value) {
          return 'Eligibility months is required';
        }
        const num = parseInt(value);
        if (isNaN(num) || num < 1 || num > 12) {
          return 'Eligibility must be between 1 and 12 months';
        }
        return null;
      },
      deductions: (value) => {
        if (!value) {
          return 'Deductions is required';
        }
        const num = parseFloat(value);
        if (isNaN(num) || num < 0) {
          return 'Deductions must be 0 or greater';
        }
        return null;
      },
    },
  });

  useEffect(() => {
    if (editingRecord) {
      form.setValues({
        employee: editingRecord.employee,
        year: editingRecord.year,
        basicSalary: editingRecord.basicSalary.toString(),
        totalEarnings: editingRecord.totalEarnings.toString(),
        eligibilityMonths: editingRecord.eligibilityMonths.toString(),
        deductions: editingRecord.deductions.toString(),
        notes: editingRecord.notes || '',
      });
    } else {
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRecord, opened]);

  const handleSubmit = (values: ThirteenthMonthPayFormData) => {
    onSave(values);
    form.reset();
  };

  const handleSave = () => {
    form.onSubmit(handleSubmit)();
  };

  return (
    <ComposedDialog
      opened={opened}
      onClose={onClose}
      size="lg"
      header={{
        title: editingRecord
          ? 'Edit 13th Month Pay Record'
          : 'New 13th Month Pay Record',
        subtitle: editingRecord
          ? 'Update the 13th month pay calculation details'
          : 'Fill in the details to calculate 13th month pay',
        iconColor: '#6366f1',
      }}
      body={{
        padding: 'xl',
        maxHeight: '75vh',
      }}
      footer={{
        layout: 'flex-end',
        secondaryButton: {
          label: 'Cancel',
          onClick: onClose,
          variant: 'subtle',
        },
        primaryButton: {
          label: editingRecord ? 'Update Record' : 'Calculate 13th Month Pay',
          onClick: handleSave,
          disabled: !form.isValid(),
          color: '#6366f1',
        },
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}
        >
          <Select
            label="Employee"
            placeholder="Select employee"
            required
            data={[
              { value: 'John Doe', label: 'John Doe' },
              { value: 'Jane Smith', label: 'Jane Smith' },
              { value: 'Mike Johnson', label: 'Mike Johnson' },
              { value: 'Sarah Williams', label: 'Sarah Williams' },
              { value: 'Robert Brown', label: 'Robert Brown' },
            ]}
            styles={{
              label: {
                fontWeight: 500,
                color: '#333',
                marginBottom: 8,
              },
              input: {
                backgroundColor: '#fff',
                border: '1px solid rgba(0, 0, 0, 0.15)',
                borderRadius: 8,
                fontSize: 14,
                '&:focus': {
                  borderColor: '#6366f1',
                  boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
                },
              },
            }}
            {...form.getInputProps('employee')}
          />

          <NumberInput
            label="Year"
            placeholder="2025"
            required
            min={2000}
            max={2100}
            hideControls
            styles={{
              label: {
                fontWeight: 500,
                color: '#333',
                marginBottom: 8,
              },
              input: {
                backgroundColor: '#fff',
                border: '1px solid rgba(0, 0, 0, 0.15)',
                borderRadius: 8,
                fontSize: 14,
                '&:focus': {
                  borderColor: '#6366f1',
                  boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
                },
              },
            }}
            value={form.values.year}
            onChange={(value) =>
              form.setFieldValue('year', value?.toString() || '')
            }
            error={form.errors.year}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}
        >
          <NumberInput
            label="Basic Salary"
            placeholder="0.00"
            required
            min={0}
            prefix="₱"
            decimalScale={2}
            thousandSeparator=","
            hideControls
            styles={{
              label: {
                fontWeight: 500,
                color: '#333',
                marginBottom: 8,
              },
              input: {
                backgroundColor: '#fff',
                border: '1px solid rgba(0, 0, 0, 0.15)',
                borderRadius: 8,
                fontSize: 14,
                '&:focus': {
                  borderColor: '#6366f1',
                  boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
                },
              },
            }}
            value={form.values.basicSalary}
            onChange={(value) =>
              form.setFieldValue('basicSalary', value?.toString() || '')
            }
            error={form.errors.basicSalary}
          />

          <NumberInput
            label="Total Earnings"
            placeholder="0.00"
            required
            min={0}
            prefix="₱"
            decimalScale={2}
            thousandSeparator=","
            hideControls
            styles={{
              label: {
                fontWeight: 500,
                color: '#333',
                marginBottom: 8,
              },
              input: {
                backgroundColor: '#fff',
                border: '1px solid rgba(0, 0, 0, 0.15)',
                borderRadius: 8,
                fontSize: 14,
                '&:focus': {
                  borderColor: '#6366f1',
                  boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
                },
              },
            }}
            value={form.values.totalEarnings}
            onChange={(value) =>
              form.setFieldValue('totalEarnings', value?.toString() || '')
            }
            error={form.errors.totalEarnings}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}
        >
          <NumberInput
            label="Eligibility (Months)"
            placeholder="12"
            required
            min={1}
            max={12}
            hideControls
            styles={{
              label: {
                fontWeight: 500,
                color: '#333',
                marginBottom: 8,
              },
              input: {
                backgroundColor: '#fff',
                border: '1px solid rgba(0, 0, 0, 0.15)',
                borderRadius: 8,
                fontSize: 14,
                '&:focus': {
                  borderColor: '#6366f1',
                  boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
                },
              },
            }}
            value={form.values.eligibilityMonths}
            onChange={(value) =>
              form.setFieldValue('eligibilityMonths', value?.toString() || '')
            }
            error={form.errors.eligibilityMonths}
          />

          <NumberInput
            label="Deductions"
            placeholder="0.00"
            required
            min={0}
            prefix="₱"
            decimalScale={2}
            thousandSeparator=","
            hideControls
            styles={{
              label: {
                fontWeight: 500,
                color: '#333',
                marginBottom: 8,
              },
              input: {
                backgroundColor: '#fff',
                border: '1px solid rgba(0, 0, 0, 0.15)',
                borderRadius: 8,
                fontSize: 14,
                '&:focus': {
                  borderColor: '#6366f1',
                  boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
                },
              },
            }}
            value={form.values.deductions}
            onChange={(value) =>
              form.setFieldValue('deductions', value?.toString() || '')
            }
            error={form.errors.deductions}
          />
        </div>

        <Textarea
          label="Notes"
          placeholder="Additional notes (optional)"
          minRows={3}
          styles={{
            label: {
              fontWeight: 500,
              color: '#333',
              marginBottom: 8,
            },
            input: {
              backgroundColor: '#fff',
              border: '1px solid rgba(0, 0, 0, 0.15)',
              borderRadius: 8,
              fontSize: 14,
              '&:focus': {
                borderColor: '#6366f1',
                boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)',
              },
            },
          }}
          {...form.getInputProps('notes')}
        />
      </div>
    </ComposedDialog>
  );
}
