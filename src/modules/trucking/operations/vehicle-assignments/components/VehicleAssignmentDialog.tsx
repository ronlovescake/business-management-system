'use client';

import { useEffect, useMemo } from 'react';
import {
  Autocomplete,
  Divider,
  Grid,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm, type UseFormReturnType } from '@mantine/form';
import {
  PolishedFormTemplate,
  usePolishedFormStyles,
} from '@/components/forms/polished';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';
import { getCurrentDateISO, toDate, toISODate } from '@/utils/date';
import type {
  VehicleAssignmentDraft,
  VehicleAssignmentVehicleOption,
  VehicleAssignmentStatus,
} from '../types/vehicleAssignments.types';

interface VehicleAssignmentDialogProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: VehicleAssignmentDraft) => void;
  drivers: string[];
  helpers: string[];
  vehicles: VehicleAssignmentVehicleOption[];
}

const statusOptions = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const getFutureDateISO = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const createInitialValues = (): VehicleAssignmentDraft => ({
  vehicleId: '',
  plateNo: '',
  driver: '',
  helper: '',
  startDate: getCurrentDateISO(),
  endDate: getFutureDateISO(3),
  status: 'scheduled',
  route: '',
  notes: '',
});

export function VehicleAssignmentDialog({
  opened,
  onClose,
  onSubmit,
  drivers,
  helpers,
  vehicles,
}: VehicleAssignmentDialogProps) {
  const form = useForm<VehicleAssignmentDraft>({
    initialValues: createInitialValues(),
    validate: {
      vehicleId: (value) => (!value?.trim() ? 'Vehicle ID is required' : null),
      plateNo: (value) => (!value?.trim() ? 'Plate number is required' : null),
      driver: (value) => (!value?.trim() ? 'Driver is required' : null),
      helper: (value) => (!value?.trim() ? 'Helper is required' : null),
      startDate: (value) => (!value ? 'Start date is required' : null),
      endDate: (value, values) => {
        if (!value) {
          return 'End date is required';
        }
        if (values.startDate) {
          const start = new Date(values.startDate);
          const end = new Date(value);
          if (end < start) {
            return 'End date cannot be before start date';
          }
        }
        return null;
      },
    },
  });

  const { setValues, setInitialValues } = form;

  useEffect(() => {
    if (!opened) {
      const nextValues = createInitialValues();
      setValues(nextValues);
      setInitialValues(nextValues);
    }
  }, [opened, setInitialValues, setValues]);

  const handleSubmit = (values: VehicleAssignmentDraft) => {
    onSubmit(values);
    const nextValues = createInitialValues();
    form.setValues(nextValues);
    form.setInitialValues(nextValues);
  };

  const driverData = useMemo(
    () => drivers.filter((driver) => Boolean(driver?.trim())),
    [drivers]
  );
  const helperData = useMemo(
    () => helpers.filter((helper) => Boolean(helper?.trim())),
    [helpers]
  );

  return (
    <PolishedFormTemplate
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm" align="center">
          <Stack gap={0}>
            <Text fw={700} fz="lg" c="#101828">
              New Vehicle Assignment
            </Text>
            <Text fz="sm" c="#667085">
              Pair a driver and helper to a vehicle schedule
            </Text>
          </Stack>
        </Group>
      }
      size={900}
      primaryAction={{
        label: 'Save Assignment',
        onClick: form.onSubmit(handleSubmit),
      }}
      secondaryAction={{ label: 'Cancel', onClick: onClose }}
    >
      <VehicleAssignmentFields
        form={form}
        drivers={driverData}
        helpers={helperData}
        rawVehicles={vehicles}
      />
    </PolishedFormTemplate>
  );
}

interface VehicleAssignmentFieldsProps {
  form: UseFormReturnType<VehicleAssignmentDraft>;
  drivers: string[];
  helpers: string[];
  rawVehicles: VehicleAssignmentVehicleOption[];
}

function VehicleAssignmentFields({
  form,
  drivers,
  helpers,
  rawVehicles,
}: VehicleAssignmentFieldsProps) {
  const { getFieldProps, getSelectProps } = usePolishedFormStyles();

  const handleVehicleIdChange = (value: string) => {
    form.setFieldValue('vehicleId', value);
    if (!value) {
      return;
    }

    const match = rawVehicles.find((vehicle) => vehicle.vehicleId === value);
    if (match?.plateNo) {
      form.setFieldValue('plateNo', match.plateNo);
    }
  };

  return (
    <Stack gap="lg">
      <Grid gutter="md">
        <Grid.Col span={12}>
          <Divider
            label={
              <Text size="sm" fw={600}>
                🚚 Vehicle Details
              </Text>
            }
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Autocomplete
            label="Vehicle ID"
            required
            data={rawVehicles.map((vehicle) => vehicle.vehicleId)}
            value={form.values.vehicleId}
            onChange={handleVehicleIdChange}
            {...getFieldProps('vehicleId').handlers}
            styles={getFieldProps('vehicleId').styles}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Autocomplete
            label="Plate Number"
            required
            data={rawVehicles.map((vehicle) => vehicle.plateNo)}
            value={form.values.plateNo}
            onChange={(value) => form.setFieldValue('plateNo', value)}
            {...getFieldProps('plateNo').handlers}
            styles={getFieldProps('plateNo').styles}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Select
            label="Status"
            required
            data={statusOptions}
            value={form.values.status}
            onChange={(value) =>
              form.setFieldValue(
                'status',
                (value as VehicleAssignmentStatus) ?? form.values.status
              )
            }
            comboboxProps={{ withinPortal: true, zIndex: 500 }}
            {...getSelectProps('status').handlers}
            styles={getSelectProps('status').styles}
          />
        </Grid.Col>
      </Grid>

      <Grid gutter="md">
        <Grid.Col span={12}>
          <Divider
            label={
              <Text size="sm" fw={600}>
                👥 Crew
              </Text>
            }
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Autocomplete
            label="Driver"
            placeholder="Enter or pick a driver"
            required
            data={drivers}
            value={form.values.driver}
            onChange={(value) => form.setFieldValue('driver', value)}
            {...getFieldProps('driver').handlers}
            styles={getFieldProps('driver').styles}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Autocomplete
            label="Helper"
            placeholder="Enter or pick a helper"
            required
            data={helpers}
            value={form.values.helper}
            onChange={(value) => form.setFieldValue('helper', value)}
            {...getFieldProps('helper').handlers}
            styles={getFieldProps('helper').styles}
          />
        </Grid.Col>
      </Grid>

      <Grid gutter="md">
        <Grid.Col span={12}>
          <Divider
            label={
              <Text size="sm" fw={600}>
                🗓 Schedule & Notes
              </Text>
            }
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <DateInput
            label="Start Date"
            valueFormat="MMM DD, YYYY"
            value={toDate(form.values.startDate)}
            onChange={(value) =>
              form.setFieldValue(
                'startDate',
                toISODate(value) || form.values.startDate
              )
            }
            {...COMMON_DATE_INPUT_PROPS}
            {...getFieldProps('startDate').handlers}
            styles={getFieldProps('startDate').styles}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <DateInput
            label="End Date"
            valueFormat="MMM DD, YYYY"
            value={toDate(form.values.endDate)}
            onChange={(value) =>
              form.setFieldValue(
                'endDate',
                toISODate(value) || form.values.endDate
              )
            }
            {...COMMON_DATE_INPUT_PROPS}
            {...getFieldProps('endDate').handlers}
            styles={getFieldProps('endDate').styles}
          />
        </Grid.Col>
        <Grid.Col span={12}>
          <TextInput
            label="Route"
            placeholder="e.g., Manila → Baguio"
            value={form.values.route || ''}
            onChange={(event) =>
              form.setFieldValue('route', event.currentTarget.value)
            }
            {...getFieldProps('route').handlers}
            styles={getFieldProps('route').styles}
          />
        </Grid.Col>
        <Grid.Col span={12}>
          <Textarea
            label="Notes"
            minRows={3}
            placeholder="Anything dispatch should know"
            value={form.values.notes || ''}
            onChange={(event) =>
              form.setFieldValue('notes', event.currentTarget.value)
            }
            {...getFieldProps('notes').handlers}
            styles={getFieldProps('notes').styles}
          />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
