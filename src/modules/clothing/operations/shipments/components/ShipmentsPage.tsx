/**
 * Shipments Module - Main Page Component
 *
 * Orchestrates the complete Shipments interface:
 * - 11-column data grid
 * - 11 statistics cards
 * - Search functionality
 * - Add/Edit modals
 * - CSV import
 * - Double-click edit
 */

'use client';

import { useMemo } from 'react';
import { Group, Button } from '@mantine/core';
import {
  IconPackage,
  IconCurrencyPeso,
  IconBox,
  IconScale,
  IconTruck,
  IconAnchor,
  IconClipboardCheck,
  IconBuilding,
  IconHandStop,
  IconCheck,
  IconPlus,
} from '@tabler/icons-react';
import type { Item } from '@glideapps/glide-data-grid';
import { PageLayout } from '@/components/layout/PageLayout';
import { DataTable, type StatCard } from '@/components/ui';
import { useShipmentsData } from '../hooks/useShipmentsData';
import { useShipmentForm } from '../hooks/useShipmentForm';
import { AddShipmentModal } from './AddShipmentModal';
import { EditShipmentModal } from './EditShipmentModal';
import type { ShipmentData } from '../types/shipment.types';
import {
  GRID_COLUMNS,
  COLUMN_ALIGNMENTS,
  ID_TO_KEY,
} from '../types/shipment.types';

export function ShipmentsPage() {
  // ==========================================================================
  // HOOKS
  // ==========================================================================

  const {
    shipments,
    filteredData,
    loading,
    statistics,
    searchQuery,
    handleSearch,
    getCellContent,
    csvFile,
    setCsvFile,
    handleCSVImport,
    addShipment,
    updateShipment,
  } = useShipmentsData();

  const {
    addModalOpened,
    editModalOpened,
    editingShipment,
    addShipmentForm,
    editShipmentForm,
    handleAddShipment,
    handleCellClick,
    closeAddModal,
    closeEditModal,
  } = useShipmentForm();

  // ==========================================================================
  // STATISTICS CARDS
  // ==========================================================================

  const statsCards: StatCard[] = useMemo(
    () => [
      {
        title: 'Total Shipments',
        value: statistics.totalShipments.toString(),
        icon: <IconPackage size={18} />,
        color: 'blue',
        backgroundColor: 'var(--mantine-color-blue-6)',
      },
      {
        title: 'Total Fees',
        value: `₱${statistics.totalFees.toLocaleString()}`,
        icon: <IconCurrencyPeso size={18} />,
        color: 'purple',
        backgroundColor: '#9775fa',
      },
      {
        title: 'Total Sacks',
        value: statistics.totalSacks.toLocaleString(),
        icon: <IconPackage size={18} />,
        color: 'orange',
        backgroundColor: '#fd7e14',
      },
      {
        title: 'Total CBM',
        value: `${statistics.totalCBM.toLocaleString()} m³`,
        icon: <IconBox size={18} />,
        color: 'teal',
        backgroundColor: 'var(--mantine-color-teal-6)',
      },
      {
        title: 'Total Weight',
        value: `${statistics.totalWeight.toLocaleString()} kg`,
        icon: <IconScale size={18} />,
        color: 'indigo',
        backgroundColor: 'var(--mantine-color-indigo-6)',
      },
      {
        title: 'In Transit',
        value: statistics.inTransitShipments,
        icon: <IconTruck size={18} />,
        color: 'yellow',
        backgroundColor: 'var(--mantine-color-yellow-6)',
      },
      {
        title: 'Manila Port',
        value: statistics.manilaPortShipments,
        icon: <IconAnchor size={18} />,
        color: 'blue',
        backgroundColor: 'var(--mantine-color-blue-7)',
      },
      {
        title: 'With Pier Gatepass',
        value: statistics.withPierGatepassShipments,
        icon: <IconClipboardCheck size={18} />,
        color: 'cyan',
        backgroundColor: 'var(--mantine-color-cyan-6)',
      },
      {
        title: 'PH Warehouse',
        value: statistics.phWarehouseShipments,
        icon: <IconBuilding size={18} />,
        color: 'lime',
        backgroundColor: 'var(--mantine-color-lime-6)',
      },
      {
        title: 'For Pickup',
        value: statistics.forPickupShipments,
        icon: <IconHandStop size={18} />,
        color: 'red',
        backgroundColor: 'var(--mantine-color-red-6)',
      },
      {
        title: 'Delivered',
        value: statistics.deliveredShipments,
        icon: <IconCheck size={18} />,
        color: 'green',
        backgroundColor: 'var(--mantine-color-green-6)',
      },
    ],
    [statistics]
  );

  // ==========================================================================
  // GRID CONFIGURATION
  // ==========================================================================

  const columns = useMemo(
    () =>
      GRID_COLUMNS.map((column) => ({
        ...column,
        id: column.id ?? '',
      })),
    []
  );

  // Create cell content getter with alignment
  const cellContentGetter = (cell: Item) => {
    const [col] = cell;
    const column = columns[col];
    const alignment = COLUMN_ALIGNMENTS[column.id || ''] || 'left';

    // Get the basic cell content
    const baseCellContent = getCellContent(cell, columns, ID_TO_KEY);

    // Add alignment to the cell content
    return {
      ...baseCellContent,
      contentAlign: alignment,
    };
  };

  // ==========================================================================
  // FORM HANDLERS
  // ==========================================================================

  const handleSubmitAdd = async (values: typeof addShipmentForm.values) => {
    await addShipment(values);
  };

  const handleSubmitEdit = async (values: typeof editShipmentForm.values) => {
    if (!editingShipment) {
      return;
    }
    await updateShipment(editingShipment.id, values, editingShipment);
  };

  const handleCSVImportWrapper = async (file: File): Promise<void> => {
    await handleCSVImport(file);
  };

  // ==========================================================================
  // LOADING STATE
  // ==========================================================================

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

  // ==========================================================================
  // RENDER
  // ==========================================================================

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
        onCSVImport={handleCSVImportWrapper}
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
        enableClickableCursor={true}
        onCellClick={(cell, shipment) => {
          handleCellClick(cell, shipment as ShipmentData);
        }}
      />

      {/* Add Shipment Modal */}
      <AddShipmentModal
        opened={addModalOpened}
        onClose={closeAddModal}
        form={addShipmentForm}
        onSubmit={handleSubmitAdd}
      />

      {/* Edit Shipment Modal */}
      <EditShipmentModal
        opened={editModalOpened}
        onClose={closeEditModal}
        form={editShipmentForm}
        onSubmit={handleSubmitEdit}
      />
    </PageLayout>
  );
}
