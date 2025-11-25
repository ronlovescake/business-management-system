import React, { useEffect } from 'react';
import {
  TextInput,
  NumberInput,
  Textarea,
  Select,
  Stack,
  Text,
  Group,
  Button,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { DateInput } from '@mantine/dates';
import { IconPigMoney } from '@tabler/icons-react';
import { PolishedModal } from '@/components/modals/PolishedModal';
import { polishedPrimaryButtonStyles } from '@/components/modals/polishedModalTheme';
import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';
import { FormatterService } from '@/services/FormatterService';
import { getCurrentDateISO, toDate, toISODate } from '@/utils/date';
import type { EmployeeLoan, EmployeeLoanFormData } from '../types';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';

interface LoanFormDialogProps {
  opened: boolean;
  editingLoan?: EmployeeLoan | null;
  onClose: () => void;
  onSave: (data: EmployeeLoanFormData) => void;
}

export const LoanFormDialog = React.memo(function LoanFormDialog({
  opened,
  editingLoan,
  onClose,
  onSave,
}: LoanFormDialogProps) {
  const buildDefaultValues = (): EmployeeLoanFormData => ({
    employee: '',
    loanType: 'personal',
    amount: '',
    interestRate: '',
    termMonths: '12',
    applicationDate: getCurrentDateISO(),
    purpose: '',
    notes: '',
  });

  const form = useForm<EmployeeLoanFormData>({
    initialValues: buildDefaultValues(),
    validateInputOnBlur: true,
    validateInputOnChange: true,
    validate: {
      employee: (value) => (!value ? 'Employee name is required' : null),
      loanType: (value) => (!value ? 'Loan type is required' : null),
      amount: (value) => {
        if (!value) {
          return 'Amount is required';
        }
        const num = parseFloat(value);
        if (Number.isNaN(num) || num <= 0) {
          return 'Amount must be greater than 0';
        }
        return null;
      },
      interestRate: (value) => {
        if (!value) {
          return 'Interest rate is required';
        }
        const num = parseFloat(value);
        if (Number.isNaN(num) || num < 0) {
          return 'Interest rate must be 0 or greater';
        }
        return null;
      },
      termMonths: (value) => {
        if (!value) {
          return 'Term is required';
        }
        const num = parseInt(value, 10);
        if (Number.isNaN(num) || num <= 0) {
          return 'Term must be greater than 0';
        }
        return null;
      },
      applicationDate: (value) =>
        !value ? 'Application date is required' : null,
      purpose: (value) => (!value ? 'Purpose is required' : null),
    },
  });

  useEffect(() => {
    if (!opened) {
      return;
    }

    if (editingLoan) {
      const editValues: EmployeeLoanFormData = {
        employee: editingLoan.employee,
        loanType: editingLoan.loanType,
        amount: editingLoan.amount.toString(),
        interestRate: editingLoan.interestRate.toString(),
        termMonths: editingLoan.termMonths.toString(),
        applicationDate: editingLoan.applicationDate,
        purpose: editingLoan.purpose,
        notes: editingLoan.notes || '',
      };
      form.setInitialValues(editValues);
      form.reset();
      return;
    }

    const defaults = buildDefaultValues();
    form.setInitialValues(defaults);
    form.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingLoan, opened]);

  const handleSubmit = (values: EmployeeLoanFormData) => {
    onSave(values);
    const defaults = buildDefaultValues();
    form.setInitialValues(defaults);
    form.reset();
  };

  const handleSave = () => {
    form.onSubmit(handleSubmit)();
  };

  const withHiddenError = <T extends Record<string, unknown>>(styles: T) => ({
    ...styles,
    error: { display: 'none' },
  });

  const { getFieldProps, getTextareaProps, getSelectProps } =
    usePolishedFieldStyles(opened);

  const employeeField = getFieldProps('employee');
  const loanTypeSelect = getSelectProps('loanType');
  const amountField = getFieldProps('amount');
  const interestRateField = getFieldProps('interestRate');
  const termMonthsField = getFieldProps('termMonths');
  const applicationDateField = getFieldProps('applicationDate');
  const purposeField = getFieldProps('purpose');
  const notesField = getTextareaProps('notes');
  const monthlyPaymentField = getFieldProps('monthlyPayment');

  const employeeInputProps = form.getInputProps('employee');
  const purposeInputProps = form.getInputProps('purpose');
  const { error: notesError, ...notesInputProps } = form.getInputProps('notes');

  const calculateMonthlyPayment = (
    principal: number,
    annualRate: number,
    months: number
  ) => {
    if (Number.isNaN(principal) || principal <= 0 || months <= 0) {
      return NaN;
    }
    if (Number.isNaN(annualRate) || annualRate === 0) {
      return principal / months;
    }
    const monthlyRate = annualRate / 100 / 12;
    const factor = Math.pow(1 + monthlyRate, months);
    return (principal * monthlyRate * factor) / (factor - 1);
  };

  const amountValue = parseFloat(form.values.amount);
  const interestValue = parseFloat(form.values.interestRate);
  const termValue = parseInt(form.values.termMonths, 10);
  const monthlyPayment = Number.isNaN(amountValue)
    ? NaN
    : calculateMonthlyPayment(amountValue, interestValue, termValue);

  const hasErrors = Object.keys(form.errors).length > 0;
  const requiredFieldsFilled =
    form.values.employee.trim() &&
    form.values.loanType.trim() &&
    form.values.amount.trim() &&
    form.values.interestRate.trim() &&
    form.values.termMonths.trim() &&
    form.values.applicationDate &&
    form.values.purpose.trim();

  const hasValidAmount = !Number.isNaN(amountValue) && amountValue > 0;
  const hasValidInterest = !Number.isNaN(interestValue) && interestValue >= 0;
  const hasValidTerm = !Number.isNaN(termValue) && termValue > 0;

  const isSubmitDisabled =
    hasErrors ||
    !requiredFieldsFilled ||
    !hasValidAmount ||
    !hasValidInterest ||
    !hasValidTerm;

  const modalTitle = (
    <Group gap="sm" align="center">
      <IconPigMoney size={26} color="#65ab58" />
      <Text fw={700} fz="lg" c="#101828">
        {editingLoan ? 'Edit Loan Application' : 'New Loan Application'}
      </Text>
    </Group>
  );

  const formattedMonthlyPayment = Number.isNaN(monthlyPayment)
    ? undefined
    : Number(monthlyPayment.toFixed(2));

  return (
    <PolishedModal
      opened={opened}
      onClose={onClose}
      title={modalTitle}
      size="lg"
    >
      <Stack gap="lg">
        <TextInput
          label="Employee Name"
          required
          {...employeeInputProps}
          onFocus={(event) => {
            employeeField.handlers.onFocus();
            employeeInputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            employeeField.handlers.onBlur();
            employeeInputProps.onBlur?.(event);
          }}
          styles={withHiddenError(employeeField.styles)}
          error={form.errors.employee ? ' ' : undefined}
        />

        <Group gap="lg" align="flex-start" grow>
          <DateInput
            label="Application Date"
            valueFormat="MM/DD/YYYY"
            {...COMMON_DATE_INPUT_PROPS}
            value={toDate(form.values.applicationDate)}
            onChange={(value) =>
              form.setFieldValue('applicationDate', toISODate(value))
            }
            required
            {...applicationDateField.handlers}
            styles={withHiddenError(applicationDateField.styles)}
            error={form.errors.applicationDate ? ' ' : undefined}
          />

          <TextInput
            label="Purpose"
            required
            {...purposeInputProps}
            onFocus={(event) => {
              purposeField.handlers.onFocus();
              purposeInputProps.onFocus?.(event);
            }}
            onBlur={(event) => {
              purposeField.handlers.onBlur();
              purposeInputProps.onBlur?.(event);
            }}
            styles={withHiddenError(purposeField.styles)}
            error={form.errors.purpose ? ' ' : undefined}
          />
        </Group>

        <Group gap="lg" align="flex-start" grow>
          <Select
            label="Loan Type"
            required
            data={[
              { value: 'personal', label: 'Personal Loan' },
              { value: 'emergency', label: 'Emergency Loan' },
              { value: 'educational', label: 'Educational Loan' },
              { value: 'housing', label: 'Housing Loan' },
              { value: 'vehicle', label: 'Vehicle Loan' },
            ]}
            {...loanTypeSelect.handlers}
            value={form.values.loanType}
            onChange={(value) => form.setFieldValue('loanType', value || '')}
            styles={withHiddenError(loanTypeSelect.styles)}
            error={form.errors.loanType ? ' ' : undefined}
            comboboxProps={{ withinPortal: true, zIndex: 600 }}
          />

          <NumberInput
            label="Interest Rate"
            required
            min={0}
            max={100}
            decimalScale={2}
            suffix="%"
            hideControls
            value={form.values.interestRate}
            onChange={(value) =>
              form.setFieldValue('interestRate', value?.toString() || '')
            }
            error={form.errors.interestRate ? ' ' : undefined}
            {...interestRateField.handlers}
            styles={{
              ...withHiddenError(interestRateField.styles),
              input: {
                ...interestRateField.styles.input,
                fontWeight: 600,
                '&::-webkit-inner-spin-button': {
                  display: 'none',
                },
              },
            }}
          />

          <NumberInput
            label="Term (Months)"
            required
            min={1}
            max={360}
            hideControls
            value={form.values.termMonths}
            onChange={(value) =>
              form.setFieldValue('termMonths', value?.toString() || '')
            }
            error={form.errors.termMonths ? ' ' : undefined}
            {...termMonthsField.handlers}
            styles={{
              ...withHiddenError(termMonthsField.styles),
              input: {
                ...termMonthsField.styles.input,
                fontWeight: 600,
                '&::-webkit-inner-spin-button': {
                  display: 'none',
                },
              },
            }}
          />
        </Group>

        <Group gap="lg" align="flex-start" grow>
          <NumberInput
            label="Loan Amount"
            required
            min={0}
            prefix={`${FormatterService.currencySymbol} `}
            decimalScale={2}
            thousandSeparator=","
            hideControls
            value={form.values.amount}
            onChange={(value) =>
              form.setFieldValue('amount', value?.toString() || '')
            }
            error={form.errors.amount ? ' ' : undefined}
            {...amountField.handlers}
            styles={{
              ...withHiddenError(amountField.styles),
              input: {
                ...amountField.styles.input,
                fontWeight: 600,
                '&::-webkit-inner-spin-button': {
                  display: 'none',
                },
              },
            }}
          />

          <NumberInput
            label="Monthly Payment"
            min={0}
            prefix={`${FormatterService.currencySymbol} `}
            decimalScale={2}
            thousandSeparator=","
            hideControls
            disabled
            value={formattedMonthlyPayment}
            {...monthlyPaymentField.handlers}
            styles={{
              ...withHiddenError(monthlyPaymentField.styles),
              input: {
                ...monthlyPaymentField.styles.input,
                fontWeight: 600,
                color: '#047857',
                '&::-webkit-inner-spin-button': {
                  display: 'none',
                },
              },
            }}
          />
        </Group>

        <Textarea
          label="Notes"
          minRows={3}
          {...notesInputProps}
          onFocus={(event) => {
            notesField.handlers.onFocus();
            notesInputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            notesField.handlers.onBlur();
            notesInputProps.onBlur?.(event);
          }}
          styles={withHiddenError(notesField.styles)}
          error={notesError ? ' ' : undefined}
        />

        <Group justify="flex-end" gap="sm">
          <Button radius="md" variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            radius="md"
            onClick={handleSave}
            disabled={isSubmitDisabled}
            styles={polishedPrimaryButtonStyles}
          >
            {editingLoan ? 'Update Loan' : 'Submit Application'}
          </Button>
        </Group>
      </Stack>
    </PolishedModal>
  );
});
