import {
  Group,
  NumberInput,
  Select,
  Stack,
  Textarea,
  TextInput,
  Switch,
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
  customers: Array<{ label: string; value: string }>;
}

interface LogTripFormValues {
  date: Date | null;
  truckId: string;
  destination: string;
  driver: string;
  helper: string;
  customerId: string;
  grossRevenue: number;
  fuelLiters: number;
  fuelCost: number;
  maintenance: number;
  tollFees: number;
  miscExpenses: number;
  remarks: string;
  overrideEnabled: boolean;
  actualDriver: string;
  actualHelper: string;
  crewOverrideReason: string;
  attendanceStatus: string;
}

const DEFAULT_FORM: LogTripFormValues = {
  date: new Date(),
  truckId: '',
  destination: '',
  driver: '',
  helper: '',
  customerId: '',
  grossRevenue: 0,
  fuelLiters: 0,
  fuelCost: 0,
  maintenance: 0,
  tollFees: 0,
  miscExpenses: 0,
  remarks: '',
  overrideEnabled: false,
  actualDriver: '',
  actualHelper: '',
  crewOverrideReason: '',
  attendanceStatus: 'UNCONFIRMED',
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
  customers,
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
          overrideEnabled:
            Boolean(initialTrip.crewOverrideReason) ||
            Boolean(
              (initialTrip.actualDriver || '').trim() &&
                (initialTrip.actualDriver || '').trim() !==
                  (initialTrip.driver || '').trim()
            ) ||
            Boolean(
              (initialTrip.actualHelper || '').trim() &&
                (initialTrip.actualHelper || '').trim() !==
                  (initialTrip.helper || '').trim()
            ),
          actualDriver: initialTrip.actualDriver || initialTrip.driver || '',
          actualHelper: initialTrip.actualHelper || initialTrip.helper || '',
          crewOverrideReason: initialTrip.crewOverrideReason || '',
          attendanceStatus: initialTrip.attendanceStatus || 'UNCONFIRMED',
          customerId: initialTrip.customerId
            ? String(initialTrip.customerId)
            : '',
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
      customerId: () => null,
      grossRevenue: (value) => (value >= 0 ? null : 'Cannot be negative'),
      fuelLiters: (value) => (value >= 0 ? null : 'Cannot be negative'),
      fuelCost: (value) => (value >= 0 ? null : 'Cannot be negative'),
      maintenance: (value) => (value >= 0 ? null : 'Cannot be negative'),
      tollFees: (value) => (value >= 0 ? null : 'Cannot be negative'),
      miscExpenses: (value) => (value >= 0 ? null : 'Cannot be negative'),
      crewOverrideReason: (value, values) =>
        values.overrideEnabled && value.trim().length === 0
          ? 'Add a brief reason'
          : null,
      attendanceStatus: (value, values) =>
        values.overrideEnabled && !value ? 'Select crew status' : null,
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
        overrideEnabled:
          Boolean(initialTrip.crewOverrideReason) ||
          Boolean(
            (initialTrip.actualDriver || '').trim() &&
              (initialTrip.actualDriver || '').trim() !==
                (initialTrip.driver || '').trim()
          ) ||
          Boolean(
            (initialTrip.actualHelper || '').trim() &&
              (initialTrip.actualHelper || '').trim() !==
                (initialTrip.helper || '').trim()
          ),
        actualDriver: initialTrip.actualDriver || initialTrip.driver || '',
        actualHelper: initialTrip.actualHelper || initialTrip.helper || '',
        crewOverrideReason: initialTrip.crewOverrideReason || '',
        attendanceStatus: initialTrip.attendanceStatus || 'UNCONFIRMED',
        customerId: initialTrip.customerId
          ? String(initialTrip.customerId)
          : '',
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
    const overrideEnabled = payload.overrideEnabled;
    const actualDriverInput = (payload.actualDriver || '').trim();
    const actualHelperInput = (payload.actualHelper || '').trim();

    const actualDriver = overrideEnabled
      ? actualDriverInput || payload.driver
      : payload.driver;

    const actualHelper = overrideEnabled
      ? actualHelperInput || payload.helper
      : payload.helper;

    const crewOverrideReason = overrideEnabled
      ? payload.crewOverrideReason.trim() || null
      : null;

    const attendanceStatus = overrideEnabled
      ? payload.attendanceStatus || 'UNCONFIRMED'
      : 'UNCONFIRMED';

    onSubmit(
      {
        date: toDateString(payload.date),
        truckId: payload.truckId,
        destination: payload.destination.trim(),
        driver: payload.driver,
        helper: payload.helper,
        actualDriver,
        actualHelper,
        crewOverrideReason,
        attendanceStatus,
        customerId: payload.customerId ? Number(payload.customerId) : null,
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

  const attendanceOptions = [
    { value: 'UNCONFIRMED', label: 'Unconfirmed' },
    { value: 'PRESENT', label: 'Present' },
    { value: 'LATE', label: 'Late' },
    { value: 'ABSENT_NO_SHOW', label: 'Absent / No show' },
    { value: 'REPLACED_BY_RELIEVER', label: 'Replaced by reliever' },
    { value: 'TRIP_CANCELLED', label: 'Trip cancelled' },
  ];

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
              data={trucks
                .filter((truck) => truck && truck.trim().length > 0)
                .map((truck) => ({ label: truck, value: truck }))}
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
              label="Customer"
              placeholder="Select customer"
              data={customers}
              value={form.values.customerId}
              onChange={(value) =>
                form.setFieldValue('customerId', value || '')
              }
              searchable
              {...polished.getSelectProps('customerId').handlers}
            />
            <Select
              label="Driver"
              placeholder="Select driver"
              data={drivers
                .filter((driver) => driver && driver.trim().length > 0)
                .map((driver) => ({ label: driver, value: driver }))}
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
              data={helpers
                .filter((helper) => helper && helper.trim().length > 0)
                .map((helper) => ({ label: helper, value: helper }))}
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

          <Stack gap="xs">
            <Switch
              label="Override crew / reliever"
              description="Enable when a different driver/helper or reliever handled the trip."
              checked={form.values.overrideEnabled}
              onChange={(event) =>
                form.setFieldValue(
                  'overrideEnabled',
                  event.currentTarget.checked
                )
              }
            />

            {form.values.overrideEnabled && (
              <Group grow gap="md" align="flex-start">
                <Select
                  label="Actual driver / reliever"
                  placeholder="Select driver"
                  data={drivers
                    .filter((driver) => driver && driver.trim().length > 0)
                    .map((driver) => ({ label: driver, value: driver }))}
                  leftSection={<IconUser size={16} />}
                  value={form.values.actualDriver}
                  onChange={(value) =>
                    form.setFieldValue('actualDriver', value || '')
                  }
                  searchable
                  {...polished.getSelectProps('actualDriver').handlers}
                  styles={{
                    ...polished.getSelectProps('actualDriver').styles,
                    input: {
                      ...polished.getSelectProps('actualDriver').styles.input,
                      paddingLeft: '2.5rem',
                    },
                  }}
                />
                <Select
                  label="Actual helper / reliever"
                  placeholder="Select helper"
                  data={helpers
                    .filter((helper) => helper && helper.trim().length > 0)
                    .map((helper) => ({ label: helper, value: helper }))}
                  leftSection={<IconUsers size={16} />}
                  value={form.values.actualHelper}
                  onChange={(value) =>
                    form.setFieldValue('actualHelper', value || '')
                  }
                  searchable
                  clearable
                  {...polished.getSelectProps('actualHelper').handlers}
                  styles={{
                    ...polished.getSelectProps('actualHelper').styles,
                    input: {
                      ...polished.getSelectProps('actualHelper').styles.input,
                      paddingLeft: '2.5rem',
                    },
                  }}
                />
                <TextInput
                  label="Crew override reason"
                  placeholder="e.g., Driver absent, replaced by reliever"
                  value={form.values.crewOverrideReason}
                  onChange={(event) =>
                    form.setFieldValue(
                      'crewOverrideReason',
                      event.currentTarget.value
                    )
                  }
                  required
                  {...polished.getFieldProps('crewOverrideReason').handlers}
                  styles={polished.getFieldProps('crewOverrideReason').styles}
                />
                <Select
                  label="Attendance status"
                  placeholder="Select status"
                  data={attendanceOptions}
                  value={form.values.attendanceStatus}
                  onChange={(value) =>
                    form.setFieldValue(
                      'attendanceStatus',
                      value || 'UNCONFIRMED'
                    )
                  }
                  required
                  {...polished.getSelectProps('attendanceStatus').handlers}
                />
              </Group>
            )}
          </Stack>

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
