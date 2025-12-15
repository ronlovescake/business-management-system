import {
  Group,
  NumberInput,
  Select,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import {
  IconCalendar,
  IconTruck,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';
import { PolishedFormTemplate } from '@/components/forms/polished/PolishedFormTemplate';
import type { NewTripPayload } from '../hooks/useTripsDashboard';

interface LogTripModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (payload: NewTripPayload) => void;
  drivers: string[];
  trucks: string[];
}

interface LogTripFormValues {
  date: Date | null;
  truckId: string;
  driver: string;
  helper: string;
  grossRevenue: number;
  fuelCost: number;
  maintenance: number;
  tollFees: number;
  miscExpenses: number;
  remarks: string;
}

const DEFAULT_FORM: LogTripFormValues = {
  date: new Date(),
  truckId: '',
  driver: '',
  helper: '',
  grossRevenue: 0,
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
  trucks,
}: LogTripModalProps) {
  const form = useForm<LogTripFormValues>({
    initialValues: DEFAULT_FORM,
    validate: {
      date: (value) => (value ? null : 'Date is required'),
      truckId: (value) => (value ? null : 'Select a vehicle'),
      driver: (value) => (value ? null : 'Select a driver'),
      grossRevenue: (value) => (value >= 0 ? null : 'Cannot be negative'),
      fuelCost: (value) => (value >= 0 ? null : 'Cannot be negative'),
      maintenance: (value) => (value >= 0 ? null : 'Cannot be negative'),
      tollFees: (value) => (value >= 0 ? null : 'Cannot be negative'),
      miscExpenses: (value) => (value >= 0 ? null : 'Cannot be negative'),
    },
  });

  const values = form.values;
  const totalExpenses =
    values.fuelCost +
    values.maintenance +
    values.tollFees +
    values.miscExpenses;

  const handleSubmit = (payload: LogTripFormValues) => {
    onSubmit({
      date: toDateString(payload.date),
      truckId: payload.truckId,
      driver: payload.driver,
      helper: payload.helper,
      grossRevenue: payload.grossRevenue,
      fuelCost: payload.fuelCost,
      maintenance: payload.maintenance,
      tollFees: payload.tollFees,
      miscExpenses: payload.miscExpenses,
      remarks: payload.remarks,
    });
    form.reset();
  };

  return (
    <PolishedFormTemplate
      opened={opened}
      onClose={onClose}
      title="Log a trip"
      subtitle="Capture revenue and expenses for a completed run"
      description="Use this form to log trip earnings and costs. Fields support quick keyboard navigation."
      primaryAction={{
        label: 'Save trip',
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
      <Stack gap="md">
        <Group grow gap="md" align="flex-start">
          <DateInput
            label="Trip date"
            value={form.values.date}
            onChange={(value) => form.setFieldValue('date', value)}
            leftSection={<IconCalendar size={16} />}
            required
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
          />
          <TextInput
            label="Helper"
            placeholder="Helper name"
            leftSection={<IconUsers size={16} />}
            value={form.values.helper}
            onChange={(event) =>
              form.setFieldValue('helper', event.currentTarget.value)
            }
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
          />
          <NumberInput
            label="Total expenses"
            prefix="₱ "
            thousandSeparator=","
            value={totalExpenses}
            readOnly
            hideControls
          />
        </Group>

        <Textarea
          label="Remarks"
          placeholder="Route details, client, cargo, or notes"
          minRows={3}
          value={form.values.remarks}
          onChange={(event) =>
            form.setFieldValue('remarks', event.currentTarget.value)
          }
        />
      </Stack>
    </PolishedFormTemplate>
  );
}
