import {
  Group,
  NumberInput,
  Select,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useEffect } from 'react';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import {
  IconCalendar,
  IconGasStation,
  IconRoute,
  IconTruck,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';
import { PolishedFormTemplate } from '@/components/forms/polished/PolishedFormTemplate';
import type { NewTripPayload } from '../hooks/useTripsDashboard';
import type { TripRecord } from './TripsTable';

interface LogTripModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (payload: NewTripPayload, existingId?: string) => void;
  initialTrip?: TripRecord | null;
  mode?: 'create' | 'edit';
  drivers: string[];
  helpers: string[];
  trucks: string[];
}

interface LogTripFormValues {
  date: Date | null;
  truckId: string;
  destination: string;
  driver: string;
  helper: string;
  grossRevenue: number;
  fuelLiters: number;
  fuelCost: number;
  maintenance: number;
  tollFees: number;
  miscExpenses: number;
  remarks: string;
}

const DEFAULT_FORM: LogTripFormValues = {
  date: new Date(),
  truckId: '',
  destination: '',
  driver: '',
  helper: '',
  grossRevenue: 0,
  fuelLiters: 0,
  fuelCost: 0,
  maintenance: 0,
  tollFees: 0,
  miscExpenses: 0,
  remarks: '',
};

const toDateString = (value: Date | null) =>
  value ? value.toISOString().slice(0, 10) : '';

export function LogTripModal({
  opened,
  onClose,
  onSubmit,
  drivers,
  helpers,
  trucks,
  initialTrip = null,
  mode = 'create',
}: LogTripModalProps) {
  const form = useForm<LogTripFormValues>({
    initialValues: initialTrip
      ? {
          date: initialTrip.date ? new Date(initialTrip.date) : new Date(),
          truckId: initialTrip.truckId,
          destination: initialTrip.destination,
          driver: initialTrip.driver,
          helper: initialTrip.helper,
          grossRevenue: initialTrip.grossRevenue,
          fuelLiters: initialTrip.fuelLiters,
          fuelCost: initialTrip.fuelCost,
          maintenance: initialTrip.maintenance,
          tollFees: initialTrip.tollFees,
          miscExpenses: initialTrip.miscExpenses,
          remarks: initialTrip.remarks,
        }
      : DEFAULT_FORM,
    validate: {
      date: (value) => (value ? null : 'Date is required'),
      truckId: (value) => (value ? null : 'Select a vehicle'),
      destination: (value) =>
        value.trim().length > 0 ? null : 'Add a destination',
      driver: (value) => (value ? null : 'Select a driver'),
      grossRevenue: (value) => (value >= 0 ? null : 'Cannot be negative'),
      fuelLiters: (value) => (value >= 0 ? null : 'Cannot be negative'),
      fuelCost: (value) => (value >= 0 ? null : 'Cannot be negative'),
      maintenance: (value) => (value >= 0 ? null : 'Cannot be negative'),
      tollFees: (value) => (value >= 0 ? null : 'Cannot be negative'),
      miscExpenses: (value) => (value >= 0 ? null : 'Cannot be negative'),
    },
  });

  // Sync form when switching between create/edit
  // Reset or prefill when modal opens or the target trip changes
  useEffect(() => {
    if (initialTrip) {
      form.setValues({
        date: initialTrip.date ? new Date(initialTrip.date) : new Date(),
        truckId: initialTrip.truckId,
        destination: initialTrip.destination,
        driver: initialTrip.driver,
        helper: initialTrip.helper,
        grossRevenue: initialTrip.grossRevenue,
        fuelLiters: initialTrip.fuelLiters,
        fuelCost: initialTrip.fuelCost,
        maintenance: initialTrip.maintenance,
        tollFees: initialTrip.tollFees,
        miscExpenses: initialTrip.miscExpenses,
        remarks: initialTrip.remarks,
      });
    } else {
      form.setValues(DEFAULT_FORM);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTrip?.id, opened]);

  const values = form.values;
  const totalExpenses =
    values.fuelCost +
    values.maintenance +
    values.tollFees +
    values.miscExpenses;

  const handleSubmit = (payload: LogTripFormValues) => {
    onSubmit(
      {
        date: toDateString(payload.date),
        truckId: payload.truckId,
        destination: payload.destination.trim(),
        driver: payload.driver,
        helper: payload.helper,
        grossRevenue: payload.grossRevenue,
        fuelLiters: payload.fuelLiters,
        fuelCost: payload.fuelCost,
        maintenance: payload.maintenance,
        tollFees: payload.tollFees,
        miscExpenses: payload.miscExpenses,
        remarks: payload.remarks,
      },
      initialTrip?.id
    );
    form.reset();
  };

  return (
    <PolishedFormTemplate
      opened={opened}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit trip' : 'Log a trip'}
      subtitle="Capture revenue and expenses for a completed run"
      description="Use this form to log trip earnings and costs. Fields support quick keyboard navigation."
      primaryAction={{
        label: mode === 'edit' ? 'Update trip' : 'Save trip',
        onClick: form.onSubmit(handleSubmit),
        disabled: !opened,
      }}
      secondaryAction={{
        label: 'Cancel',
        onClick: () => {
          form.reset();
          onClose();
        },
      }}
      size={900}
    >
      {(polished) => (
        <Stack gap="md">
          <Group grow gap="md" align="flex-start">
            <DateInput
              label="Trip date"
              value={form.values.date}
              onChange={(value) => form.setFieldValue('date', value)}
              leftSection={<IconCalendar size={16} />}
              required
              {...polished.getFieldProps('date').handlers}
              styles={{
                ...polished.getFieldProps('date').styles,
                input: {
                  ...polished.getFieldProps('date').styles.input,
                  paddingLeft: '2.5rem',
                },
              }}
            />
            <Select
              label="Vehicle"
              placeholder="Select truck"
              data={trucks.map((truck) => ({ label: truck, value: truck }))}
              leftSection={<IconTruck size={16} />}
              value={form.values.truckId}
              onChange={(value) => form.setFieldValue('truckId', value || '')}
              searchable
              required
              {...polished.getSelectProps('truckId').handlers}
              styles={{
                ...polished.getSelectProps('truckId').styles,
                input: {
                  ...polished.getSelectProps('truckId').styles.input,
                  paddingLeft: '2.5rem',
                },
              }}
            />
            <TextInput
              label="Destination"
              placeholder="Where is this trip heading?"
              leftSection={<IconRoute size={16} />}
              value={form.values.destination}
              onChange={(event) =>
                form.setFieldValue('destination', event.currentTarget.value)
              }
              required
              {...polished.getFieldProps('destination').handlers}
              styles={{
                ...polished.getFieldProps('destination').styles,
                input: {
                  ...polished.getFieldProps('destination').styles.input,
                  paddingLeft: '2.5rem',
                },
              }}
            />
          </Group>

          <Group grow gap="md" align="flex-start">
            <Select
              label="Driver"
              placeholder="Select driver"
              data={drivers.map((driver) => ({ label: driver, value: driver }))}
              leftSection={<IconUser size={16} />}
              value={form.values.driver}
              onChange={(value) => form.setFieldValue('driver', value || '')}
              searchable
              required
              {...polished.getSelectProps('driver').handlers}
              styles={{
                ...polished.getSelectProps('driver').styles,
                input: {
                  ...polished.getSelectProps('driver').styles.input,
                  paddingLeft: '2.5rem',
                },
              }}
            />
            <Select
              label="Helper"
              placeholder="Select helper"
              data={helpers.map((helper) => ({ label: helper, value: helper }))}
              leftSection={<IconUsers size={16} />}
              value={form.values.helper}
              onChange={(value) => form.setFieldValue('helper', value || '')}
              searchable
              clearable
              {...polished.getSelectProps('helper').handlers}
              styles={{
                ...polished.getSelectProps('helper').styles,
                input: {
                  ...polished.getSelectProps('helper').styles.input,
                  paddingLeft: '2.5rem',
                },
              }}
            />
          </Group>

          <Group grow gap="md" align="flex-start">
            <NumberInput
              label="Gross revenue"
              prefix="₱ "
              thousandSeparator=","
              value={form.values.grossRevenue}
              onChange={(value) =>
                form.setFieldValue('grossRevenue', Number(value) || 0)
              }
              min={0}
              hideControls
              {...polished.getFieldProps('grossRevenue').handlers}
              styles={polished.getFieldProps('grossRevenue').styles}
            />
            <NumberInput
              label="Fuel (liters)"
              suffix=" L"
              value={form.values.fuelLiters}
              onChange={(value) =>
                form.setFieldValue('fuelLiters', Number(value) || 0)
              }
              min={0}
              hideControls
              leftSection={<IconGasStation size={16} />}
              {...polished.getFieldProps('fuelLiters').handlers}
              styles={polished.getFieldProps('fuelLiters').styles}
            />
            <NumberInput
              label="Fuel cost"
              prefix="₱ "
              thousandSeparator=","
              value={form.values.fuelCost}
              onChange={(value) =>
                form.setFieldValue('fuelCost', Number(value) || 0)
              }
              min={0}
              hideControls
              {...polished.getFieldProps('fuelCost').handlers}
              styles={polished.getFieldProps('fuelCost').styles}
            />
            <NumberInput
              label="Maintenance"
              prefix="₱ "
              thousandSeparator=","
              value={form.values.maintenance}
              onChange={(value) =>
                form.setFieldValue('maintenance', Number(value) || 0)
              }
              min={0}
              hideControls
              {...polished.getFieldProps('maintenance').handlers}
              styles={polished.getFieldProps('maintenance').styles}
            />
          </Group>

          <Group grow gap="md" align="flex-start">
            <NumberInput
              label="Toll fees"
              prefix="₱ "
              thousandSeparator=","
              value={form.values.tollFees}
              onChange={(value) =>
                form.setFieldValue('tollFees', Number(value) || 0)
              }
              min={0}
              hideControls
              {...polished.getFieldProps('tollFees').handlers}
              styles={polished.getFieldProps('tollFees').styles}
            />
            <NumberInput
              label="Misc. expenses"
              prefix="₱ "
              thousandSeparator=","
              value={form.values.miscExpenses}
              onChange={(value) =>
                form.setFieldValue('miscExpenses', Number(value) || 0)
              }
              min={0}
              hideControls
              {...polished.getFieldProps('miscExpenses').handlers}
              styles={polished.getFieldProps('miscExpenses').styles}
            />
            <NumberInput
              label="Total expenses"
              prefix="₱ "
              thousandSeparator=","
              value={totalExpenses}
              readOnly
              hideControls
              {...polished.getFieldProps('totalExpenses').handlers}
              styles={polished.getFieldProps('totalExpenses').styles}
            />
          </Group>

          <Textarea
            label="Remarks"
            minRows={3}
            value={form.values.remarks}
            onChange={(event) =>
              form.setFieldValue('remarks', event.currentTarget.value)
            }
            {...polished.getTextareaProps('remarks').handlers}
            styles={polished.getTextareaProps('remarks').styles}
          />
        </Stack>
      )}
    </PolishedFormTemplate>
  );
}
