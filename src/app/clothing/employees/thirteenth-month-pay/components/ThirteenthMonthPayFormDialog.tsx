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
      totalBasicSalary: '',
      totalLwop: '0',
      totalAbsencesLates: '0',
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
      totalBasicSalary: (value) => {
        if (!value) {
          return 'Total basic salary is required';
        }
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
          return 'Total basic salary must be greater than 0';
        }
        return null;
      },
      totalLwop: (value) => {
        const parsed = value ? parseFloat(value) : 0;
        if (Number.isNaN(parsed) || parsed < 0) {
          return 'Total LWOP must be 0 or greater';
        }
        return null;
      },
      totalAbsencesLates: (value) => {
        const parsed = value ? parseFloat(value) : 0;
        if (Number.isNaN(parsed) || parsed < 0) {
          return 'Total absences/lates must be 0 or greater';
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
        totalBasicSalary: editingRecord.totalBasicSalary.toString(),
        totalLwop: editingRecord.totalLwop.toString(),
        totalAbsencesLates: editingRecord.totalAbsencesLates.toString(),
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
            label="Total Basic Salary"
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
            value={form.values.totalBasicSalary}
            onChange={(value) =>
              form.setFieldValue('totalBasicSalary', value?.toString() || '')
            }
            error={form.errors.totalBasicSalary}
          />
          <NumberInput
            label="Total LWOP"
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
            value={form.values.totalLwop}
            onChange={(value) =>
              form.setFieldValue('totalLwop', value?.toString() || '0')
            }
            error={form.errors.totalLwop}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            alignItems: 'end',
          }}
        >
          <NumberInput
            label="Total Absences/Lates"
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
            value={form.values.totalAbsencesLates}
            onChange={(value) =>
              form.setFieldValue('totalAbsencesLates', value?.toString() || '0')
            }
            error={form.errors.totalAbsencesLates}
          />
          <div
            style={{
              fontSize: 13,
              color: '#6b7280',
              lineHeight: 1.5,
            }}
          >
            Formula: <strong>Total Basic Salary</strong> − (
            <strong>Total LWOP</strong> + <strong>Total Absences/Lates</strong>)
          </div>
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
