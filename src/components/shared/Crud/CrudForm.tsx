/**
 * Generic CRUD Form Component
 *
 * A reusable form component with type safety for Create/Update operations.
 * Built on top of Mantine's useForm hook with automatic validation and
 * field rendering based on configuration.
 *
 * @example
 * ```tsx
 * <CrudForm
 *   fields={[
 *     { name: 'employeeName', label: 'Employee Name', type: 'text', required: true },
 *     { name: 'leaveType', label: 'Leave Type', type: 'select', options: ['Sick', 'Vacation'] },
 *     { name: 'startDate', label: 'Start Date', type: 'date', required: true }
 *   ]}
 *   initialValues={editingItem}
 *   onSubmit={handleSubmit}
 *   submitLabel={isEditing ? 'Update' : 'Create'}
 * />
 * ```
 */

import type { ReactNode } from 'react';
import {
  TextInput,
  NumberInput,
  Textarea,
  Select,
  Checkbox,
  Switch,
  Stack,
  Button,
  Group,
  Grid,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';

/**
 * Field types supported by CrudForm
 */
export type CrudFormFieldType =
  | 'text'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'switch'
  | 'date'
  | 'email'
  | 'password'
  | 'tel'
  | 'url';

/**
 * Field configuration for CrudForm
 */
export interface CrudFormField<T = Record<string, unknown>> {
  /** Field name (must match data property) */
  name: keyof T;
  /** Display label */
  label: string;
  /** Field type */
  type: CrudFormFieldType;
  /** Placeholder text */
  placeholder?: string;
  /** Required validation */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Options for select fields */
  options?: Array<{ value: string; label: string }> | string[];
  /** Minimum value (for number fields) */
  min?: number;
  /** Maximum value (for number fields) */
  max?: number;
  /** Step value (for number fields) */
  step?: number;
  /** Custom validation function */
  validate?: (value: unknown) => string | null;
  /** Help text to display below field */
  description?: string;
  /** Custom render function for advanced fields */
  render?: (value: unknown, onChange: (value: unknown) => void) => ReactNode;
  /** Grid column span (1-12) */
  span?: number;
}

/**
 * Props for CrudForm component
 */
export interface CrudFormProps<T extends Record<string, unknown>> {
  /** Field configuration */
  fields: CrudFormField<T>[];
  /** Initial values for form */
  initialValues?: Partial<T>;
  /** Form submit handler */
  onSubmit: (values: T) => void | Promise<void>;
  /** Cancel handler */
  onCancel?: () => void;
  /** Submit button label */
  submitLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Loading state */
  loading?: boolean;
  /** Custom validation function for entire form */
  validate?: (values: T) => Record<string, string>;
  /** Hide action buttons */
  hideActions?: boolean;
  /** Custom action buttons */
  customActions?: ReactNode;
}

/**
 * Generic CRUD Form Component
 *
 * Automatically renders form fields based on configuration with
 * built-in validation and type safety.
 */
export function CrudForm<T extends Record<string, unknown>>({
  fields,
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  loading = false,
  validate: customValidate,
  hideActions = false,
  customActions,
}: CrudFormProps<T>) {
  // Initialize form with validation
  const form = useForm<Partial<T>>({
    initialValues,
    validate: (values) => {
      const errors: Record<string, string> = {};

      // Field-level validation
      fields.forEach((field) => {
        const value = values[field.name];

        // Required validation
        if (field.required && (!value || value === '')) {
          errors[String(field.name)] = `${field.label} is required`;
        }

        // Custom field validation
        if (field.validate && value) {
          const error = field.validate(value);
          if (error) {
            errors[String(field.name)] = error;
          }
        }
      });

      // Form-level custom validation
      if (customValidate) {
        const customErrors = customValidate(values as T);
        Object.assign(errors, customErrors);
      }

      return errors;
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    await onSubmit(values as T);
  });

  // Render field based on type
  const renderField = (field: CrudFormField<T>) => {
    const commonProps = {
      label: field.label,
      placeholder: field.placeholder,
      required: field.required,
      disabled: field.disabled || loading,
      description: field.description,
      ...form.getInputProps(String(field.name)),
    };

    // Custom render
    if (field.render) {
      return field.render(
        form.values[field.name],
        // Type assertion needed: Form library's setFieldValue has strict type requirements
        // while render callback uses unknown for flexibility
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (value) => form.setFieldValue(String(field.name), value as any)
      );
    }

    // Standard field types
    switch (field.type) {
      case 'text':
      case 'email':
      case 'password':
      case 'tel':
      case 'url':
        return <TextInput {...commonProps} type={field.type} />;

      case 'number':
        return (
          <NumberInput
            {...commonProps}
            min={field.min}
            max={field.max}
            step={field.step}
          />
        );

      case 'textarea':
        return <Textarea {...commonProps} minRows={3} autosize />;

      case 'select':
        const selectOptions = field.options?.map((opt) =>
          typeof opt === 'string' ? { value: opt, label: opt } : opt
        );
        return <Select {...commonProps} data={selectOptions || []} />;

      case 'checkbox':
        return <Checkbox {...commonProps} />;

      case 'switch':
        return <Switch {...commonProps} />;

      case 'date':
        return <DateInput {...commonProps} />;

      default:
        return <TextInput {...commonProps} />;
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Grid>
          {fields.map((field) => (
            <Grid.Col key={String(field.name)} span={field.span || 12}>
              {renderField(field)}
            </Grid.Col>
          ))}
        </Grid>

        {!hideActions && (
          <Group justify="flex-end" mt="md">
            {customActions || (
              <>
                {onCancel && (
                  <Button
                    variant="default"
                    onClick={onCancel}
                    disabled={loading}
                  >
                    {cancelLabel}
                  </Button>
                )}
                <Button type="submit" loading={loading}>
                  {submitLabel}
                </Button>
              </>
            )}
          </Group>
        )}
      </Stack>
    </form>
  );
}
