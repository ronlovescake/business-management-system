'use client';

import React, { useState, useEffect } from 'react';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { DataTable, StatCard, useDataTable } from '../../../../components/ui';
import { GridColumn, Item } from '@glideapps/glide-data-grid';
import {
  Button,
  Group,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Stack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import {
  IconPlus,
  IconCheck,
  IconPackage,
  IconCurrencyDollar,
  IconBox,
  IconScale,
  IconTruck,
  IconAnchor,
  IconClipboardCheck,
  IconBuilding,
  IconHandStop,
  IconCalendar,
} from '@tabler/icons-react';
import { ShipmentData } from '../../../../types';

export default function Shipments() {
  const [shipments, setShipments] = useState<ShipmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [addModalOpened, setAddModalOpened] = useState(false);
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [editingShipment, setEditingShipment] = useState<ShipmentData | null>(
    null
  );

  // Form for adding new shipments
  const addShipmentForm = useForm({
    initialValues: {
      shipmentCode: '',
      cvNumber: '',
      noOfSacks: 0,
      totalCBM: 0,
      weight: 0,
      fee: 0,
      shipmentStatus: '',
      dateCreated: null as Date | null,
      dateDelivered: null as Date | null,
      notes: '',
    },
    validate: {
      shipmentCode: (value) => (!value ? 'Shipment Code is required' : null),
      shipmentStatus: (value) =>
        !value ? 'Shipment Status is required' : null,
      noOfSacks: (value) => {
        if (value === null || value === undefined)
          return 'Number of sacks is required';
        if (value < 0) return 'Number of sacks must be positive';
        return null;
      },
      totalCBM: (value) => {
        if (value === null || value === undefined)
          return 'Total CBM is required';
        if (value < 0) return 'Total CBM must be positive';
        return null;
      },
      weight: (value) => {
        if (value === null || value === undefined) return 'Weight is required';
        if (value < 0) return 'Weight must be positive';
        return null;
      },
      fee: (value) => {
        if (value === null || value === undefined) return 'Fee is required';
        if (value < 0) return 'Fee must be positive';
        return null;
      },
      dateCreated: (value) => (!value ? 'Date Created is required' : null),
    },
  });

  // Form for editing existing shipments
  const editShipmentForm = useForm({
    initialValues: {
      shipmentCode: '',
      cvNumber: '',
      noOfSacks: 0,
      totalCBM: 0,
      weight: 0,
      fee: 0,
      shipmentStatus: '',
      dateCreated: null as Date | null,
      dateDelivered: null as Date | null,
      notes: '',
    },
    validate: {
      shipmentCode: (value) => (!value ? 'Shipment Code is required' : null),
      shipmentStatus: (value) =>
        !value ? 'Shipment Status is required' : null,
      noOfSacks: (value) => {
        if (value === null || value === undefined)
          return 'Number of sacks is required';
        if (value < 0) return 'Number of sacks must be positive';
        return null;
      },
      totalCBM: (value) => {
        if (value === null || value === undefined)
          return 'Total CBM is required';
        if (value < 0) return 'Total CBM must be positive';
        return null;
      },
      weight: (value) => {
        if (value === null || value === undefined) return 'Weight is required';
        if (value < 0) return 'Weight must be positive';
        return null;
      },
      fee: (value) => {
        if (value === null || value === undefined) return 'Fee is required';
        if (value < 0) return 'Fee must be positive';
        return null;
      },
      dateCreated: (value) => (!value ? 'Date Created is required' : null),
    },
  });

  // Define columns for the shipments table with alignment
  const columns: GridColumn[] = [
    { title: 'Shipment Code', width: 200, id: 'shipmentCode' },
    { title: 'CV Number', width: 200, id: 'cvNumber' },
    { title: 'No. Of Sacks', width: 200, id: 'noOfSacks' },
    { title: 'Total CBM', width: 200, id: 'totalCBM' },
    { title: 'Weight', width: 200, id: 'weight' },
    { title: 'Fee', width: 200, id: 'fee' },
    { title: 'Shipment Status', width: 200, id: 'shipmentStatus' },
    { title: 'Date Created', width: 200, id: 'dateCreated' },
    { title: 'Date Delivered', width: 200, id: 'dateDelivered' },
    { title: 'Duration', width: 200, id: 'duration' },
    { title: 'Notes', width: 200, grow: 1, id: 'notes' },
  ];

  // Column alignment configuration
  const columnAlignments: Record<string, 'left' | 'center' | 'right'> = {
    shipmentCode: 'center',
    cvNumber: 'center',
    noOfSacks: 'center',
    totalCBM: 'center',
    weight: 'center',
    fee: 'right',
    shipmentStatus: 'left',
    dateCreated: 'center',
    dateDelivered: 'center',
    duration: 'center',
    notes: 'left',
  };

  // Map column IDs to data keys
  const idToKey: Record<string, keyof ShipmentData> = {
    shipmentCode: 'Shipment Code',
    cvNumber: 'CV Number',
    noOfSacks: 'No. Of Sacks',
    totalCBM: 'Total CBM',
    weight: 'Weight',
    fee: 'Fee',
    shipmentStatus: 'Shipment Status',
    dateCreated: 'Date Created',
    dateDelivered: 'Date Delivered',
    duration: 'Duration',
    notes: 'Notes',
  };

  // Use the data table hook for search functionality
  const { searchQuery, filteredData, handleSearch, getCellContent } =
    useDataTable({
      data: shipments,
      searchFields: ['Shipment Code', 'CV Number', 'Shipment Status', 'Notes'],
    });

  // Load shipments data
  useEffect(() => {
    const loadShipments = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/shipments');

        if (!response.ok) {
          throw new Error('Failed to fetch shipments');
        }

        const data = await response.json();
        setShipments(data);
      } catch (error) {
        console.error('Failed to load shipments:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load shipments data',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };

    loadShipments();
  }, []);

  // Create cell content getter with alignment
  const cellContentGetter = (cell: Item) => {
    const [col] = cell;
    const column = columns[col];
    const alignment = columnAlignments[column.id || ''] || 'left';

    // Get the basic cell content
    const baseCellContent = getCellContent(cell, columns, idToKey);

    // Add alignment to the cell content
    return {
      ...baseCellContent,
      contentAlign: alignment,
    };
  };

  // Calculate statistics dynamically based on filtered data
  const inTransitShipments = filteredData.filter(
    (s) => s['Shipment Status']?.toLowerCase() === 'in transit'
  ).length;
  const deliveredShipments = filteredData.filter(
    (s) => s['Shipment Status']?.toLowerCase() === 'delivered'
  ).length;
  const manilaPortShipments = filteredData.filter(
    (s) => s['Shipment Status']?.toLowerCase() === 'manila port'
  ).length;
  const withPierGatepassShipments = filteredData.filter(
    (s) => s['Shipment Status']?.toLowerCase() === 'with pier gatepass'
  ).length;
  const phWarehouseShipments = filteredData.filter(
    (s) => s['Shipment Status']?.toLowerCase() === 'ph warehouse'
  ).length;
  const forPickupShipments = filteredData.filter(
    (s) => s['Shipment Status']?.toLowerCase() === 'for pickup'
  ).length;

  // Parse fees (remove currency symbol and commas, then convert to number) - dynamic calculation
  const totalFees = filteredData.reduce((sum, s) => {
    const feeString = s['Fee'] || '0';
    const feeNumber =
      parseFloat(feeString.toString().replace(/[₱,]/g, '')) || 0;
    return sum + feeNumber;
  }, 0);

  // Parse sacks (convert to number) - dynamic calculation
  const totalSacks = filteredData.reduce((sum, s) => {
    const sacksNumber = parseFloat(s['No. Of Sacks']?.toString() || '0') || 0;
    return sum + sacksNumber;
  }, 0);

  // Parse total CBM (convert to number) - dynamic calculation
  const totalCBM = filteredData.reduce((sum, s) => {
    const cbmNumber = parseFloat(s['Total CBM']?.toString() || '0') || 0;
    return sum + cbmNumber;
  }, 0);

  // Parse total weight (convert to number) - dynamic calculation
  const totalWeight = filteredData.reduce((sum, s) => {
    const weightNumber = parseFloat(s['Weight']?.toString() || '0') || 0;
    return sum + weightNumber;
  }, 0);

  // Define stats cards
  const statsCards: StatCard[] = [
    {
      title: 'Total Shipments',
      value: filteredData.length.toString(),
      icon: <IconPackage size={18} />,
      color: 'blue',
      backgroundColor: 'var(--mantine-color-blue-6)',
    },
    {
      title: 'Total Fees',
      value: `₱${totalFees.toLocaleString()}`,
      icon: <IconCurrencyDollar size={18} />,
      color: 'purple',
      backgroundColor: '#9775fa',
    },
    {
      title: 'Total Sacks',
      value: totalSacks.toLocaleString(),
      icon: <IconPackage size={18} />,
      color: 'orange',
      backgroundColor: '#fd7e14',
    },
    {
      title: 'Total CBM',
      value: `${totalCBM.toLocaleString()} m³`,
      icon: <IconBox size={18} />,
      color: 'teal',
      backgroundColor: 'var(--mantine-color-teal-6)',
    },
    {
      title: 'Total Weight',
      value: `${totalWeight.toLocaleString()} kg`,
      icon: <IconScale size={18} />,
      color: 'indigo',
      backgroundColor: 'var(--mantine-color-indigo-6)',
    },
    {
      title: 'In Transit',
      value: inTransitShipments,
      icon: <IconTruck size={18} />,
      color: 'yellow',
      backgroundColor: 'var(--mantine-color-yellow-6)',
    },
    {
      title: 'Manila Port',
      value: manilaPortShipments,
      icon: <IconAnchor size={18} />,
      color: 'blue',
      backgroundColor: 'var(--mantine-color-blue-7)',
    },
    {
      title: 'With Pier Gatepass',
      value: withPierGatepassShipments,
      icon: <IconClipboardCheck size={18} />,
      color: 'cyan',
      backgroundColor: 'var(--mantine-color-cyan-6)',
    },
    {
      title: 'PH Warehouse',
      value: phWarehouseShipments,
      icon: <IconBuilding size={18} />,
      color: 'lime',
      backgroundColor: 'var(--mantine-color-lime-6)',
    },
    {
      title: 'For Pickup',
      value: forPickupShipments,
      icon: <IconHandStop size={18} />,
      color: 'red',
      backgroundColor: 'var(--mantine-color-red-6)',
    },
    {
      title: 'Delivered',
      value: deliveredShipments,
      icon: <IconCheck size={18} />,
      color: 'green',
      backgroundColor: 'var(--mantine-color-green-6)',
    },
  ];

  // Handle CSV import
  const handleCSVImport = async (file: File) => {
    try {
      const text = await file.text();
      // Handle both Unix (\n) and Windows (\r\n) line endings
      const lines = text.split(/\r?\n/);

      // Parse CSV properly handling quoted fields
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"') {
            inQuotes = !inQuotes;
            // Don't add the quote character itself
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      // Helper function to calculate duration between dates
      const calculateDurationFromStrings = (
        dateCreatedStr: string,
        dateDeliveredStr: string
      ): string => {
        if (!dateCreatedStr || !dateDeliveredStr) return '';

        try {
          const dateCreated = new Date(dateCreatedStr);
          const dateDelivered = new Date(dateDeliveredStr);

          // Check if dates are valid
          if (isNaN(dateCreated.getTime()) || isNaN(dateDelivered.getTime())) {
            return '';
          }

          const diffTime = Math.abs(
            dateDelivered.getTime() - dateCreated.getTime()
          );
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays.toString();
        } catch (error) {
          return '';
        }
      };

      const headers = parseCSVLine(lines[0]);
      const importedShipments: ShipmentData[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          const values = parseCSVLine(line);
          const shipmentData = { id: Date.now() + i } as Record<
            string,
            string | number
          >;

          headers.forEach((header, index) => {
            if (values[index] !== undefined && values[index] !== '') {
              shipmentData[header] = values[index];
            }
          });

          // Auto-calculate duration if both dates are present
          const dateCreated = shipmentData['Date Created'] as string;
          const dateDelivered = shipmentData['Date Delivered'] as string;

          if (dateCreated && dateDelivered) {
            shipmentData['Duration'] = calculateDurationFromStrings(
              dateCreated,
              dateDelivered
            );
          }

          importedShipments.push(shipmentData as unknown as ShipmentData);
        }
      }

      if (importedShipments.length === 0) {
        notifications.show({
          title: '⚠️ Import Warning',
          message: 'No valid shipment data found in the CSV file',
          color: 'yellow',
          autoClose: 4000,
        });
        return;
      }

      // Save to database via API (bulk import)
      const saveResponse = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importedShipments),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save shipments to database');
      }

      // Reload shipments from database
      const reloadResponse = await fetch('/api/shipments');
      if (reloadResponse.ok) {
        const reloadedShipments = await reloadResponse.json();
        setShipments(reloadedShipments);
      }

      setCsvFile(null);

      notifications.show({
        title: '🎉 Import Successful!',
        message: `Successfully imported ${importedShipments.length} shipment records`,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });
    } catch (error) {
      console.error('Import error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      notifications.show({
        title: '❌ Import Failed',
        message: `Failed to import CSV: ${errorMessage}`,
        color: 'red',
        autoClose: 6000,
      });
    }
  };

  // Handle add new shipment
  const handleAddShipment = () => {
    addShipmentForm.reset();
    setAddModalOpened(true);
  };

  // Handle edit shipment
  const handleEditShipment = (shipment: ShipmentData) => {
    setEditingShipment(shipment);

    // Pre-populate the edit form with existing data
    editShipmentForm.setValues({
      shipmentCode: shipment['Shipment Code'],
      cvNumber: shipment['CV Number'],
      noOfSacks: shipment['No. Of Sacks'],
      totalCBM: shipment['Total CBM'],
      weight: shipment['Weight'],
      fee: shipment['Fee'],
      shipmentStatus: shipment['Shipment Status'],
      dateCreated: shipment['Date Created']
        ? new Date(shipment['Date Created'])
        : null,
      dateDelivered: shipment['Date Delivered']
        ? new Date(shipment['Date Delivered'])
        : null,
      notes: shipment['Notes'],
    });

    setEditModalOpened(true);
  };

  // Handle form submission
  const handleSubmitShipment = async (
    values: typeof addShipmentForm.values
  ) => {
    try {
      // Calculate duration between dates
      const calculateDuration = (
        startDate: Date | null,
        endDate: Date | null
      ): string => {
        if (!startDate || !endDate) return '';
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays.toString();
      };

      // Create new shipment object
      const newShipment: ShipmentData = {
        id: Date.now(), // Temporary ID
        'Shipment Code': values.shipmentCode,
        'CV Number': values.cvNumber,
        'No. Of Sacks': values.noOfSacks,
        'Total CBM': values.totalCBM,
        Weight: values.weight,
        Fee: values.fee,
        'Shipment Status': values.shipmentStatus,
        'Date Created': values.dateCreated
          ? values.dateCreated.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '',
        'Date Delivered': values.dateDelivered
          ? values.dateDelivered.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '',
        Duration: calculateDuration(values.dateCreated, values.dateDelivered),
        Notes: values.notes,
      };

      // Send to API
      const response = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShipment),
      });

      if (!response.ok) {
        throw new Error('Failed to create shipment');
      }

      const createdShipment = await response.json();

      // Add to local state
      const updatedShipments = [...shipments, createdShipment];
      setShipments(updatedShipments);

      notifications.show({
        title: '✅ Success',
        message: 'Shipment added successfully!',
        color: 'green',
      });

      setAddModalOpened(false);
      addShipmentForm.reset();
    } catch (error) {
      console.error('Error adding shipment:', error);
      notifications.show({
        title: '❌ Error',
        message: 'Failed to add shipment. Please try again.',
        color: 'red',
      });
    }
  };

  // Handle edit form submission
  const handleSubmitEditShipment = async (
    values: typeof editShipmentForm.values
  ) => {
    if (!editingShipment) return;

    try {
      // Calculate duration between dates
      const calculateDuration = (
        startDate: Date | null,
        endDate: Date | null
      ): string => {
        if (!startDate || !endDate) return '';
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays.toString();
      };

      // Update shipment object
      const updatedShipment: ShipmentData = {
        ...editingShipment,
        'Shipment Code': values.shipmentCode,
        'CV Number': values.cvNumber,
        'No. Of Sacks': values.noOfSacks,
        'Total CBM': values.totalCBM,
        Weight: values.weight,
        Fee: values.fee,
        'Shipment Status': values.shipmentStatus,
        'Date Created': values.dateCreated
          ? values.dateCreated.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '',
        'Date Delivered': values.dateDelivered
          ? values.dateDelivered.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '',
        Duration: calculateDuration(values.dateCreated, values.dateDelivered),
        Notes: values.notes,
      };

      // Send to API
      const response = await fetch(`/api/shipments/${editingShipment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedShipment),
      });

      if (!response.ok) {
        throw new Error('Failed to update shipment');
      }

      const updatedShipmentFromAPI = await response.json();

      // Update local state
      const updatedShipments = shipments.map((s) =>
        s.id === editingShipment.id ? updatedShipmentFromAPI : s
      );
      setShipments(updatedShipments);

      notifications.show({
        title: '✅ Success',
        message: 'Shipment updated successfully!',
        color: 'green',
      });

      setEditModalOpened(false);
      setEditingShipment(null);
      editShipmentForm.reset();
    } catch (error) {
      console.error('Error updating shipment:', error);
      notifications.show({
        title: '❌ Error',
        message: 'Failed to update shipment. Please try again.',
        color: 'red',
      });
    }
  };

  if (loading) {
    return (
      <PageLayout title="Shipments">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '400px',
          }}
        >
          Loading shipments...
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout fluid withPadding>
      <DataTable
        data={shipments}
        filteredData={filteredData}
        columns={columns}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        searchPlaceholder="Search shipments by code, CV number, status, or notes..."
        getCellContent={cellContentGetter}
        statsCards={statsCards}
        enableCSVImport={true}
        csvFile={csvFile}
        onFileChange={setCsvFile}
        onCSVImport={handleCSVImport}
        footerLeft={`Showing ${filteredData.length} of ${shipments.length} shipments`}
        actionButtons={
          <Group gap="sm">
            <Button
              leftSection={<IconPlus size={16} />}
              color="green"
              onClick={handleAddShipment}
            >
              Add Shipment
            </Button>
          </Group>
        }
        // Enable clicking on shipment codes for edit functionality
        enableClickableCursor={true}
        onCellClick={(cell, shipment) => {
          const [col] = cell;
          // Check if clicked on Shipment Code column (first column, index 0)
          if (col === 0) {
            handleEditShipment(shipment as ShipmentData);
          }
        }}
      />

      {/* Add Shipment Modal */}
      <Modal
        opened={addModalOpened}
        onClose={() => setAddModalOpened(false)}
        title="Add New Shipment"
        size="lg"
        centered
      >
        <form onSubmit={addShipmentForm.onSubmit(handleSubmitShipment)}>
          <Stack gap="md">
            <Group grow>
              <TextInput
                label="Shipment Code"
                placeholder="Enter shipment code"
                required
                {...addShipmentForm.getInputProps('shipmentCode')}
              />
              <TextInput
                label="CV Number"
                placeholder="Enter CV number"
                {...addShipmentForm.getInputProps('cvNumber')}
              />
            </Group>

            <Group grow>
              <NumberInput
                label="No. Of Sacks"
                placeholder="Enter number of sacks"
                min={0}
                required
                {...addShipmentForm.getInputProps('noOfSacks')}
              />
              <NumberInput
                label="Total CBM"
                placeholder="Enter total CBM"
                min={0}
                decimalScale={2}
                required
                {...addShipmentForm.getInputProps('totalCBM')}
              />
            </Group>

            <Group grow>
              <NumberInput
                label="Weight (kg)"
                placeholder="Enter weight"
                min={0}
                decimalScale={2}
                required
                {...addShipmentForm.getInputProps('weight')}
              />
              <NumberInput
                label="Fee (₱)"
                placeholder="Enter fee"
                min={0}
                decimalScale={2}
                required
                {...addShipmentForm.getInputProps('fee')}
              />
            </Group>

            <Select
              label="Shipment Status"
              placeholder="Select status"
              required
              data={[
                'In Transit',
                'Manila Port',
                'With Pier Gatepass',
                'PH Warehouse',
                'For Pickup',
                'Sorting',
                'Delivered',
              ]}
              {...addShipmentForm.getInputProps('shipmentStatus')}
            />

            <Group grow>
              <DateInput
                label="Date Created"
                placeholder="Select date created"
                leftSection={<IconCalendar size={16} />}
                required
                {...addShipmentForm.getInputProps('dateCreated')}
              />
              <DateInput
                label="Date Delivered"
                placeholder="Select date delivered"
                leftSection={<IconCalendar size={16} />}
                {...addShipmentForm.getInputProps('dateDelivered')}
              />
            </Group>

            <Textarea
              label="Notes"
              placeholder="Enter any additional notes..."
              rows={3}
              {...addShipmentForm.getInputProps('notes')}
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="outline"
                onClick={() => setAddModalOpened(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color="green"
                leftSection={<IconPlus size={16} />}
              >
                Add Shipment
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Edit Shipment Modal */}
      <Modal
        opened={editModalOpened}
        onClose={() => {
          setEditModalOpened(false);
          setEditingShipment(null);
        }}
        title="Edit Shipment"
        size="lg"
        centered
      >
        <form onSubmit={editShipmentForm.onSubmit(handleSubmitEditShipment)}>
          <Stack gap="md">
            <Group grow>
              <TextInput
                label="Shipment Code"
                placeholder="Enter shipment code"
                required
                {...editShipmentForm.getInputProps('shipmentCode')}
              />
              <TextInput
                label="CV Number"
                placeholder="Enter CV number"
                {...editShipmentForm.getInputProps('cvNumber')}
              />
            </Group>

            <Group grow>
              <NumberInput
                label="No. Of Sacks"
                placeholder="Enter number of sacks"
                min={0}
                required
                {...editShipmentForm.getInputProps('noOfSacks')}
              />
              <NumberInput
                label="Total CBM"
                placeholder="Enter total CBM"
                min={0}
                decimalScale={2}
                required
                {...editShipmentForm.getInputProps('totalCBM')}
              />
            </Group>

            <Group grow>
              <NumberInput
                label="Weight (kg)"
                placeholder="Enter weight"
                min={0}
                decimalScale={2}
                required
                {...editShipmentForm.getInputProps('weight')}
              />
              <NumberInput
                label="Fee (₱)"
                placeholder="Enter fee"
                min={0}
                decimalScale={2}
                required
                {...editShipmentForm.getInputProps('fee')}
              />
            </Group>

            <Select
              label="Shipment Status"
              placeholder="Select status"
              required
              data={[
                'In Transit',
                'Manila Port',
                'With Pier Gatepass',
                'PH Warehouse',
                'For Pickup',
                'Sorting',
                'Delivered',
              ]}
              {...editShipmentForm.getInputProps('shipmentStatus')}
            />

            <Group grow>
              <DateInput
                label="Date Created"
                placeholder="Select date created"
                leftSection={<IconCalendar size={16} />}
                required
                {...editShipmentForm.getInputProps('dateCreated')}
              />
              <DateInput
                label="Date Delivered"
                placeholder="Select date delivered"
                leftSection={<IconCalendar size={16} />}
                {...editShipmentForm.getInputProps('dateDelivered')}
              />
            </Group>

            <Textarea
              label="Notes"
              placeholder="Enter any additional notes..."
              rows={3}
              {...editShipmentForm.getInputProps('notes')}
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="outline"
                onClick={() => {
                  setEditModalOpened(false);
                  setEditingShipment(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color="blue"
                leftSection={<IconCheck size={16} />}
              >
                Update Shipment
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </PageLayout>
  );
}
