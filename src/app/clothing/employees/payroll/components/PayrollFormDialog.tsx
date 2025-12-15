'use client';

import { useEffect } from 'react';
import React from 'react';
import {
  Autocomplete,
  TextInput,
  NumberInput,
  Grid,
  Stack,
  Group,
  Text,
  ThemeIcon,
  Paper,
  SimpleGrid,
  Divider,
  Button,
} from '@mantine/core';
import { IconCurrencyPeso } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { PolishedModal } from '@/components/modals/PolishedModal';
import { polishedPrimaryButtonStyles } from '@/components/modals/polishedModalTheme';
import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';
import type { Payroll, PayrollFormData } from '../types';

type NumericPayrollField =
  | 'allowance'
  | 'overtime'
  | 'bonuses'
  | 'thirteenthMonth'
  | 'sss'
  | 'philHealth'
  | 'pagIbig'
  | 'tax'
  | 'loans'
  | 'cashAdvance'
  | 'lwop'
  | 'absentsLates';

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
  employeeOptions: string[];
  payPeriodOptions: string[];
}

export const PayrollFormDialog = React.memo(function PayrollFormDialog({
  opened,
  editingPayroll,
  onClose,
  onSave,
  calculateTotals,
  employeeOptions,
  payPeriodOptions,
}: PayrollFormDialogProps) {
  const form = useForm<PayrollFormData>({
    initialValues: {
      employee: '',
      payPeriod: '',
      basicSalary: '',
      allowance: '0',
      overtime: '0',
      bonuses: '0',
      thirteenthMonth: '0',
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
        if (Number.isNaN(num) || num <= 0) {
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
        thirteenthMonth: editingPayroll.thirteenthMonth.toString(),
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

  const totals = calculateTotals(form.values);
  const canSave = form.isValid();

  const { getFieldProps, getSelectProps } = usePolishedFieldStyles(opened);
  const employeeSelect = getSelectProps('employee');
  const payPeriodSelect = getSelectProps('payPeriod');
  const payPeriodField = getFieldProps('payPeriod');
  const bankField = getFieldProps('bankGcash');

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const renderNumberField = (
    key: NumericPayrollField,
    label: string,
    placeholder: string
  ) => {
    const fieldProps = getFieldProps(key);
    return (
      <NumberInput
        label={label}
        placeholder={placeholder}
        min={0}
        prefix="₱"
        decimalScale={2}
        thousandSeparator=","
        hideControls
        value={form.values[key]}
        onChange={(value) => form.setFieldValue(key, value?.toString() || '0')}
        {...fieldProps.handlers}
        styles={fieldProps.styles}
      />
    );
  };

  const modalTitle = (
    <Group gap="md" align="center">
      <ThemeIcon size={44} radius="xl" variant="light" color="violet">
        <IconCurrencyPeso size={24} />
      </ThemeIcon>
      <Stack gap={2}>
        <Text fw={700} fz="lg" c="#101828">
          {editingPayroll ? 'Edit Payroll' : 'Add Payroll'}
        </Text>
        <Text fz="sm" c="#667085">
          {editingPayroll
            ? 'Update the employee payroll details below'
            : 'Fill in the details to create a new payroll record'}
        </Text>
      </Stack>
    </Group>
  );

  return (
    <PolishedModal
      opened={opened}
      onClose={onClose}
      size="70rem"
      title={modalTitle}
    >
      <Stack gap="xl">
        <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 4 }}>
          <Stack gap="xl">
            <Stack gap={4}>
              <Text fw={600} c="#101828">
                Employee & Pay Period
              </Text>
              <Text fz="sm" c="dimmed">
                Assign the payroll entry to an employee and choose the
                applicable pay period.
              </Text>
            </Stack>

            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Autocomplete
                  label="Employee Name"
                  placeholder="Select or type employee"
                  data={employeeOptions}
                  required
                  value={form.values.employee}
                  onChange={(value) => form.setFieldValue('employee', value)}
                  comboboxProps={{ withinPortal: true }}
                  {...employeeSelect.handlers}
                  styles={employeeSelect.styles}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                {payPeriodOptions.length > 0 ? (
                  <Autocomplete
                    label="Pay Period"
                    placeholder="Select or type pay period"
                    data={payPeriodOptions}
                    required
                    value={form.values.payPeriod}
                    onChange={(value) => form.setFieldValue('payPeriod', value)}
                    comboboxProps={{ withinPortal: true }}
                    {...payPeriodSelect.handlers}
                    styles={payPeriodSelect.styles}
                  />
                ) : (
                  <TextInput
                    label="Pay Period"
                    placeholder="e.g., 2024-10-01 to 2024-10-15"
                    required
                    {...form.getInputProps('payPeriod')}
                    {...payPeriodField.handlers}
                    styles={payPeriodField.styles}
                  />
                )}
              </Grid.Col>
            </Grid>

            <Divider label="Earnings" labelPosition="left" color="violet" />

            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, md: 6 }}>
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
                  {...getFieldProps('basicSalary').handlers}
                  styles={getFieldProps('basicSalary').styles}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                {renderNumberField('allowance', 'Allowance', 'Enter allowance')}
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                {renderNumberField(
                  'overtime',
                  'Overtime',
                  'Enter overtime pay'
                )}
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                {renderNumberField('bonuses', 'Bonuses', 'Enter bonuses')}
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                {renderNumberField(
                  'thirteenthMonth',
                  '13th Month Pay',
                  'Enter 13th month amount'
                )}
              </Grid.Col>
            </Grid>

            <Divider label="Deductions" labelPosition="left" color="pink" />

            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, md: 6 }}>
                {renderNumberField('sss', 'SSS', 'Enter SSS contribution')}
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                {renderNumberField(
                  'philHealth',
                  'PhilHealth',
                  'Enter PhilHealth contribution'
                )}
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                {renderNumberField(
                  'pagIbig',
                  'Pag-IBIG',
                  'Enter Pag-IBIG contribution'
                )}
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                {renderNumberField('tax', 'Tax', 'Enter withholding tax')}
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                {renderNumberField('loans', 'Loans', 'Enter loan deductions')}
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                {renderNumberField(
                  'cashAdvance',
                  'Cash Advance',
                  'Enter cash advance deductions'
                )}
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                {renderNumberField(
                  'lwop',
                  'LWOP',
                  'Enter leave without pay deductions'
                )}
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                {renderNumberField(
                  'absentsLates',
                  'Absences/Lates',
                  'Enter deductions for absences/lates'
                )}
              </Grid.Col>
            </Grid>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <Paper shadow="xs" radius="md" p="md" withBorder>
                <Text fz="sm" c="dimmed">
                  Gross Pay
                </Text>
                <Text fw={700} fz="xl" c="teal.6">
                  {formatCurrency(totals.grossPay)}
                </Text>
              </Paper>

              <Paper shadow="xs" radius="md" p="md" withBorder>
                <Text fz="sm" c="dimmed">
                  Total Deductions
                </Text>
                <Text fw={700} fz="xl" c="red.6">
                  {formatCurrency(totals.totalDeductions)}
                </Text>
              </Paper>

              <Paper shadow="xs" radius="md" p="md" withBorder>
                <Text fz="sm" c="dimmed">
                  Net Pay
                </Text>
                <Text fw={700} fz="xl" c="blue.6">
                  {formatCurrency(totals.netPay)}
                </Text>
              </Paper>
            </SimpleGrid>

            <Divider label="Disbursement" labelPosition="left" color="blue" />

            <TextInput
              label="Bank/GCash"
              placeholder="e.g., BDO - 001234567890 or GCash - 09171234567"
              required
              {...form.getInputProps('bankGcash')}
              {...bankField.handlers}
              styles={bankField.styles}
            />
          </Stack>
        </div>

        <Group justify="flex-end" gap="sm">
          <Button radius="md" variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            radius="md"
            onClick={handleSave}
            disabled={!canSave}
            styles={polishedPrimaryButtonStyles}
          >
            {editingPayroll ? 'Update Payroll' : 'Create Payroll'}
          </Button>
        </Group>
      </Stack>
    </PolishedModal>
  );
});
