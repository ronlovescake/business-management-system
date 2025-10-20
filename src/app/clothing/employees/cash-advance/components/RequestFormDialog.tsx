import { useEffect, useMemo } from 'react';
import {
  Stack,
  Group,
  Text,
  Select,
  TextInput,
  NumberInput,
  Textarea,
  Button,
} from '@mantine/core';
import { IconCurrencyPeso } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { DateInput } from '@mantine/dates';
import { PolishedModal } from '@/components/modals/PolishedModal';
import { polishedPrimaryButtonStyles } from '@/components/modals/polishedModalTheme';
import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';
import { getCurrentDateISO, toDate, toISODate } from '@/utils/date';
import { FormatterService } from '@/services/FormatterService';
import { calculateMonthlyPayment } from '../hooks/useCashAdvance';
import type { CashAdvance, CashAdvanceFormData } from '../types';
import type { EmployeeOption } from '../hooks/useCashAdvance';

interface RequestFormDialogProps {
  opened: boolean;
  editingRequest: CashAdvance | null;
  onClose: () => void;
  onSave: (
    data: CashAdvanceFormData
  ) => Promise<boolean | void> | boolean | void;
  employeeOptions: EmployeeOption[];
  isLoadingEmployees: boolean;
}

export function RequestFormDialog({
  opened,
  editingRequest,
  onClose,
  onSave,
  employeeOptions,
  isLoadingEmployees,
}: RequestFormDialogProps) {
  const withHiddenError = <T extends Record<string, unknown>>(styles: T) => ({
    ...styles,
    error: { display: 'none' },
  });

  const buildDefaultValues = (): CashAdvanceFormData => ({
    employee: '',
    amount: '',
    purpose: '',
    terms: '',
    monthlyPayment: '',
    requestDate: getCurrentDateISO(),
    notes: '',
  });

  const form = useForm<CashAdvanceFormData>({
    initialValues: buildDefaultValues(),
    validateInputOnBlur: true,
    validateInputOnChange: true,
    validate: {
      employee: (value) => (!value ? 'Employee name is required' : null),
      amount: (value) => {
        if (!value) {
          return 'Amount is required';
        }
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
          return 'Amount must be greater than 0';
        }
        return null;
      },
      purpose: (value) => (!value ? 'Purpose is required' : null),
      terms: (value) => {
        if (!value) {
          return 'Terms are required';
        }
        const num = parseFloat(value);
        if (Number.isNaN(num) || num <= 0 || !Number.isInteger(num)) {
          return 'Terms must be a whole number greater than 0';
        }
        return null;
      },
      requestDate: (value) => (!value ? 'Request date is required' : null),
    },
  });

  const { getFieldProps, getTextareaProps, getSelectProps } =
    usePolishedFieldStyles(opened);

  const employeeSelect = getSelectProps('employee');
  const amountField = getFieldProps('amount');
  const purposeField = getFieldProps('purpose');
  const termsField = getFieldProps('terms');
  const monthlyPaymentField = getFieldProps('monthlyPayment');
  const requestDateField = getFieldProps('requestDate');
  const notesField = getTextareaProps('notes');

  useEffect(() => {
    if (!opened) {
      return;
    }

    if (editingRequest) {
      const editValues: CashAdvanceFormData = {
        employee: editingRequest.employeeId || editingRequest.employee,
        amount: editingRequest.amount.toString(),
        purpose: editingRequest.purpose,
        terms: editingRequest.terms,
        monthlyPayment: editingRequest.monthlyPayment
          ? editingRequest.monthlyPayment.toString()
          : '',
        requestDate: editingRequest.requestDate,
        notes: editingRequest.notes || '',
      };
      form.setInitialValues(editValues);
      form.reset();
      return;
    }

    const defaults = buildDefaultValues();
    form.setInitialValues(defaults);
    form.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRequest, opened]);

  const handleSubmit = async (values: CashAdvanceFormData) => {
    try {
      const result = await onSave(values);
      if (result === false) {
        return;
      }

      const defaults = buildDefaultValues();
      form.setInitialValues(defaults);
      form.reset();
    } catch (error) {
      console.error('Error submitting cash advance form:', error);
    }
  };

  const handleSave = () => {
    void form.onSubmit(handleSubmit)();
  };

  const employeeError = form.errors.employee;
  const { error: purposeError, ...purposeInputProps } =
    form.getInputProps('purpose');
  const termsError = form.errors.terms;
  const { error: notesError, ...notesInputProps } = form.getInputProps('notes');

  const hasErrors = Object.keys(form.errors).length > 0;
  const amountValue = parseFloat(form.values.amount);
  const termValue = parseFloat(form.values.terms);
  const computedMonthlyPayment = useMemo(() => {
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      return '';
    }
    const termNumber = Number.isNaN(termValue) ? 0 : termValue;
    const payment = calculateMonthlyPayment(amountValue, termNumber);
    return payment ? payment.toString() : '';
  }, [amountValue, termValue]);

  useEffect(() => {
    if (!opened) {
      return;
    }

    const nextValue = computedMonthlyPayment;
    if (form.values.monthlyPayment !== nextValue) {
      form.setFieldValue('monthlyPayment', nextValue);
    }
  }, [computedMonthlyPayment, opened, form]);
  const hasValidAmount = !Number.isNaN(amountValue) && amountValue > 0;
  const requiredFieldsFilled =
    form.values.employee.trim() &&
    form.values.purpose.trim() &&
    form.values.terms.trim() &&
    form.values.requestDate &&
    form.values.amount.trim();
  const isSubmitDisabled =
    hasErrors || !requiredFieldsFilled || !hasValidAmount;

  const modalTitle = (
    <Group gap="sm" align="center">
      <IconCurrencyPeso size={26} color="#65ab58" />
      <Stack gap={2}>
        <Text fw={700} fz="lg" c="#101828">
          {editingRequest
            ? 'Edit Cash Advance Request'
            : 'Add Cash Advance Request'}
        </Text>
        <Text fz="sm" c="#667085">
          {editingRequest
            ? 'Update the request details below'
            : 'Fill in the details to submit a new cash advance request'}
        </Text>
      </Stack>
    </Group>
  );

  return (
    <PolishedModal
      opened={opened}
      onClose={onClose}
      title={modalTitle}
      size="lg"
    >
      <Stack gap="lg">
        <Select
          label="Employee Name"
          required
          data={employeeOptions}
          value={form.values.employee || null}
          onChange={(value) =>
            form.setFieldValue('employee', value ? String(value) : '')
          }
          searchable
          comboboxProps={{ withinPortal: true, zIndex: 600 }}
          nothingFoundMessage={
            isLoadingEmployees ? 'Loading employees…' : 'No employees found'
          }
          {...employeeSelect.handlers}
          styles={withHiddenError(employeeSelect.styles)}
          error={employeeError ? ' ' : undefined}
          disabled={isLoadingEmployees && employeeOptions.length === 0}
          withCheckIcon={false}
        />

        <Group gap="lg" align="flex-start" grow>
          <NumberInput
            label="Amount"
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
                '&::-webkit-inner-spin-button': {
                  display: 'none',
                },
              },
            }}
          />

          <DateInput
            label="Request Date"
            valueFormat="MM/DD/YYYY"
            firstDayOfWeek={0}
            value={toDate(form.values.requestDate)}
            onChange={(value) =>
              form.setFieldValue('requestDate', toISODate(value))
            }
            required
            {...requestDateField.handlers}
            styles={withHiddenError(requestDateField.styles)}
            error={form.errors.requestDate ? ' ' : undefined}
          />
        </Group>

        <TextInput
          label="Purpose"
          required
          {...purposeInputProps}
          error={purposeError ? ' ' : undefined}
          onFocus={(event) => {
            purposeField.handlers.onFocus();
            purposeInputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            purposeField.handlers.onBlur();
            purposeInputProps.onBlur?.(event);
          }}
          styles={withHiddenError(purposeField.styles)}
        />

        <Group gap="lg" align="flex-start" grow>
          <NumberInput
            label="Terms (Months)"
            required
            min={1}
            step={1}
            decimalScale={0}
            hideControls
            value={form.values.terms ? Number(form.values.terms) : undefined}
            onChange={(value) =>
              form.setFieldValue('terms', value?.toString() || '')
            }
            error={termsError ? ' ' : undefined}
            {...termsField.handlers}
            styles={{
              ...withHiddenError(termsField.styles),
              input: {
                ...termsField.styles.input,
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
            value={
              form.values.monthlyPayment
                ? Number(form.values.monthlyPayment)
                : undefined
            }
            {...monthlyPaymentField.handlers}
            styles={{
              ...withHiddenError(monthlyPaymentField.styles),
              input: {
                ...monthlyPaymentField.styles.input,
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
          error={notesError ? ' ' : undefined}
          onFocus={(event) => {
            notesField.handlers.onFocus();
            notesInputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            notesField.handlers.onBlur();
            notesInputProps.onBlur?.(event);
          }}
          styles={withHiddenError(notesField.styles)}
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
            {editingRequest ? 'Update' : 'Submit'}
          </Button>
        </Group>
      </Stack>
    </PolishedModal>
  );
}
