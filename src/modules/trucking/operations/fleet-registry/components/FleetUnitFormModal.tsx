import { useRef } from 'react';
import type { ReactNode } from 'react';
import {
  Stack,
  TextInput,
  Select,
  Textarea,
  NumberInput,
  Divider,
  SimpleGrid,
  Text,
} from '@mantine/core';
import { useForm, type UseFormReturnType } from '@mantine/form';
import { useDidUpdate } from '@mantine/hooks';
import { IconTruckDelivery } from '@tabler/icons-react';
import {
  PolishedFormTemplate,
  usePolishedFormStyles,
} from '@/components/forms/polished';
import type {
  FleetUnitFormValues,
  FleetStatus,
} from '../types/fleetRegistry.types';

interface FleetUnitFormModalProps {
  opened: boolean;
  initialValues: FleetUnitFormValues;
  onClose: () => void;
  onSubmit: (values: FleetUnitFormValues) => Promise<void> | void;
  isSubmitting?: boolean;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
}

const fuelOptions = ['Diesel', 'Gasoline', 'Hybrid', 'Electric'];
const statusOptions: { label: string; value: FleetStatus }[] = [
  { label: 'Active', value: 'active' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Retired', value: 'retired' },
];

export function FleetUnitFormModal({
  opened,
  initialValues,
  onClose,
  onSubmit,
  isSubmitting = false,
  title,
  subtitle,
  icon,
  primaryActionLabel,
  secondaryActionLabel,
}: FleetUnitFormModalProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm<FleetUnitFormValues>({
    initialValues,
    validate: {
      truckId: (value) =>
        value.trim().length === 0 ? 'Vehicle ID is required' : null,
      maker: (value) =>
        value.trim().length === 0 ? 'Maker is required' : null,
      model: (value) =>
        value.trim().length === 0 ? 'Model is required' : null,
      year: (value) => (value.trim().length === 0 ? 'Year is required' : null),
      plateNo: (value) =>
        value.trim().length === 0 ? 'Plate number is required' : null,
      vehicleType: (value) =>
        value.trim().length === 0 ? 'Vehicle type is required' : null,
      fuelType: (value) =>
        value.trim().length === 0 ? 'Fuel type is required' : null,
      ltoRegisterDate: (value) =>
        value.trim().length === 0 ? 'LTO register date is required' : null,
    },
  });

  useDidUpdate(() => {
    if (!opened) {
      return;
    }

    form.setValues(initialValues);
    form.resetDirty(initialValues);
  }, [opened, initialValues]);

  const handleSubmit = form.onSubmit(async (values) => {
    await onSubmit(values);
  });

  const handlePrimaryAction = () => {
    formRef.current?.requestSubmit();
  };

  const modalTitle = title ?? 'Add Fleet Unit';
  const modalSubtitle = subtitle ?? 'Complete the vehicle details below';
  const modalIcon = icon ?? <IconTruckDelivery size={26} color="#65ab58" />;
  const primaryLabel = primaryActionLabel ?? 'Add Unit';
  const secondaryLabel = secondaryActionLabel ?? 'Cancel';

  return (
    <PolishedFormTemplate
      opened={opened}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      icon={modalIcon}
      primaryAction={{
        label: primaryLabel,
        onClick: handlePrimaryAction,
        loading: isSubmitting,
        disabled: isSubmitting,
      }}
      secondaryAction={{
        label: secondaryLabel,
        onClick: onClose,
        disabled: isSubmitting,
      }}
    >
      <form ref={formRef} onSubmit={handleSubmit} noValidate>
        <FleetUnitFormFields form={form} />
        <button type="submit" hidden aria-hidden />
      </form>
    </PolishedFormTemplate>
  );
}

function FleetUnitFormFields({
  form,
}: {
  form: UseFormReturnType<FleetUnitFormValues>;
}) {
  const { getFieldProps, getSelectProps } = usePolishedFormStyles();

  return (
    <Stack gap="lg">
      <Divider
        label={
          <Text size="sm" fw={600}>
            🚚 Basic Information
          </Text>
        }
        labelPosition="left"
      />
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <TextInput
          label="Vehicle ID"
          placeholder="TRK-001"
          required
          {...form.getInputProps('truckId')}
          {...getFieldProps('truckId').handlers}
          styles={getFieldProps('truckId').styles}
        />
        <TextInput
          label="Maker"
          placeholder="Isuzu"
          required
          {...form.getInputProps('maker')}
          {...getFieldProps('maker').handlers}
          styles={getFieldProps('maker').styles}
        />
        <TextInput
          label="Model"
          placeholder="N-Series"
          required
          {...form.getInputProps('model')}
          {...getFieldProps('model').handlers}
          styles={getFieldProps('model').styles}
        />
        <NumberInput
          label="Model Year"
          min={1990}
          max={2100}
          clampBehavior="strict"
          required
          value={form.values.year ? Number(form.values.year) : undefined}
          onChange={(value) =>
            form.setFieldValue('year', value ? String(value) : '')
          }
          error={form.errors.year}
          placeholder="2025"
          {...getFieldProps('year').handlers}
          styles={getFieldProps('year').styles}
        />
        <TextInput
          label="Plate Number"
          placeholder="ABC-1234"
          required
          {...form.getInputProps('plateNo')}
          {...getFieldProps('plateNo').handlers}
          styles={getFieldProps('plateNo').styles}
        />
        <TextInput
          label="Body Number"
          placeholder="B-1001"
          {...form.getInputProps('bodyNo')}
          {...getFieldProps('bodyNo').handlers}
          styles={getFieldProps('bodyNo').styles}
        />
        <TextInput
          label="Chassis Number"
          placeholder="CHS-001-XYZ"
          {...form.getInputProps('chassisNo')}
          {...getFieldProps('chassisNo').handlers}
          styles={getFieldProps('chassisNo').styles}
        />
        <TextInput
          label="Engine Number"
          placeholder="ENG-5678-A"
          {...form.getInputProps('engineNo')}
          {...getFieldProps('engineNo').handlers}
          styles={getFieldProps('engineNo').styles}
        />
        <TextInput
          label="Capacity"
          placeholder="4.5T"
          {...form.getInputProps('capacity')}
          {...getFieldProps('capacity').handlers}
          styles={getFieldProps('capacity').styles}
        />
        <TextInput
          label="Passenger Capacity"
          placeholder="3"
          {...form.getInputProps('passengerCapacity')}
          {...getFieldProps('passengerCapacity').handlers}
          styles={getFieldProps('passengerCapacity').styles}
        />
        <TextInput
          label="Gross Weight"
          placeholder="7500 kg"
          {...form.getInputProps('grossWeight')}
          {...getFieldProps('grossWeight').handlers}
          styles={getFieldProps('grossWeight').styles}
        />
        <TextInput
          label="Net Weight"
          placeholder="4500 kg"
          {...form.getInputProps('netWeight')}
          {...getFieldProps('netWeight').handlers}
          styles={getFieldProps('netWeight').styles}
        />
        <TextInput
          label="Body Type"
          placeholder="Closed Van"
          {...form.getInputProps('bodyType')}
          {...getFieldProps('bodyType').handlers}
          styles={getFieldProps('bodyType').styles}
        />
        <TextInput
          label="Series"
          placeholder="NQR"
          {...form.getInputProps('series')}
          {...getFieldProps('series').handlers}
          styles={getFieldProps('series').styles}
        />
        <TextInput
          label="Classification"
          placeholder="Light Truck"
          {...form.getInputProps('classification')}
          {...getFieldProps('classification').handlers}
          styles={getFieldProps('classification').styles}
        />
        <TextInput
          label="Vehicle Type"
          placeholder="Cargo"
          required
          {...form.getInputProps('vehicleType')}
          {...getFieldProps('vehicleType').handlers}
          styles={getFieldProps('vehicleType').styles}
        />
      </SimpleGrid>

      <Divider
        label={
          <Text size="sm" fw={600}>
            📋 Registration & Status
          </Text>
        }
        labelPosition="left"
      />
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <TextInput
          label="LTO Register Date"
          type="date"
          required
          {...form.getInputProps('ltoRegisterDate')}
          {...getFieldProps('ltoRegisterDate').handlers}
          styles={getFieldProps('ltoRegisterDate').styles}
        />
        <TextInput
          label="OR/CR Info"
          placeholder="OR-2025-0001"
          {...form.getInputProps('orCrInfo')}
          {...getFieldProps('orCrInfo').handlers}
          styles={getFieldProps('orCrInfo').styles}
        />
        <Select
          label="Fuel Type"
          data={fuelOptions}
          placeholder="Select fuel"
          required
          {...form.getInputProps('fuelType')}
          {...getSelectProps('fuelType').handlers}
          styles={getSelectProps('fuelType').styles}
          withCheckIcon={false}
          comboboxProps={{ withinPortal: true, zIndex: 500 }}
        />
        <Select
          label="Status"
          data={statusOptions}
          placeholder="Select status"
          {...form.getInputProps('status')}
          {...getSelectProps('status').handlers}
          styles={getSelectProps('status').styles}
          withCheckIcon={false}
          comboboxProps={{ withinPortal: true, zIndex: 500 }}
        />
        <Select
          label="Ownership"
          data={['Company-owned', 'Leased']}
          placeholder="Select ownership"
          {...form.getInputProps('ownershipType')}
          {...getSelectProps('ownershipType').handlers}
          styles={getSelectProps('ownershipType').styles}
          withCheckIcon={false}
          comboboxProps={{ withinPortal: true, zIndex: 500 }}
        />
        <TextInput
          label="Acquisition Date"
          type="date"
          {...form.getInputProps('acquisitionDate')}
          {...getFieldProps('acquisitionDate').handlers}
          styles={getFieldProps('acquisitionDate').styles}
        />
      </SimpleGrid>

      <Divider
        label={
          <Text size="sm" fw={600}>
            💼 Financial & Compliance
          </Text>
        }
        labelPosition="left"
      />
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <TextInput
          label="Purchase Cost (₱)"
          placeholder="1500000"
          {...form.getInputProps('purchaseCost')}
          {...getFieldProps('purchaseCost').handlers}
          styles={getFieldProps('purchaseCost').styles}
        />
        <TextInput
          label="Insurance Provider"
          placeholder="Allied Insurance"
          {...form.getInputProps('insuranceProvider')}
          {...getFieldProps('insuranceProvider').handlers}
          styles={getFieldProps('insuranceProvider').styles}
        />
        <TextInput
          label="Insurance Expiry"
          type="date"
          {...form.getInputProps('insuranceExpiry')}
          {...getFieldProps('insuranceExpiry').handlers}
          styles={getFieldProps('insuranceExpiry').styles}
        />
      </SimpleGrid>

      <Divider
        label={
          <Text size="sm" fw={600}>
            📍 Assignments & Tracking
          </Text>
        }
        labelPosition="left"
      />
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <TextInput
          label="GPS Tracker ID"
          placeholder="TRK-001-GPS"
          {...form.getInputProps('gpsTrackerId')}
          {...getFieldProps('gpsTrackerId').handlers}
          styles={getFieldProps('gpsTrackerId').styles}
        />
        <TextInput
          label="Depot Location"
          placeholder="Meycauayan Yard"
          {...form.getInputProps('depotLocation')}
          {...getFieldProps('depotLocation').handlers}
          styles={getFieldProps('depotLocation').styles}
        />
        <TextInput
          label="Assigned Driver"
          placeholder="Jonas Velasco"
          {...form.getInputProps('driverAssigned')}
          {...getFieldProps('driverAssigned').handlers}
          styles={getFieldProps('driverAssigned').styles}
        />
      </SimpleGrid>

      <Textarea
        label="Remarks"
        minRows={3}
        placeholder="Special notes, maintenance reminders, or compliance details"
        {...form.getInputProps('remarks')}
        {...getFieldProps('remarks').handlers}
        styles={getFieldProps('remarks').styles}
      />
    </Stack>
  );
}
