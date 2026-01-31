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

import { useMemo, useState } from 'react';
import { Button, Tabs, FileButton } from '@mantine/core';
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
  IconUpload,
} from '@tabler/icons-react';
import type { Item } from '@glideapps/glide-data-grid';
import { PageLayout } from '@/components/layout/PageLayout';
import { DataTable, StatsCardGrid, type StatCard } from '@/components/ui';
import { useShipmentsData } from '../hooks/useShipmentsData';
import { useShipmentForm } from '../hooks/useShipmentForm';
import { AddShipmentModal } from './AddShipmentModal';
import { EditShipmentModal } from './EditShipmentModal';
import { TransitBuildModal } from './TransitBuildModal';
import { TransitReclassModal } from './TransitReclassModal';
import { ShipmentsDashboard } from './ShipmentsDashboard';
import { PickupForm } from './PickupForm';
import { LogisticsCostsTab } from './LogisticsCostsTab';
import type { ShipmentData } from '../types/shipment.types';
import {
  GRID_COLUMNS,
  COLUMN_ALIGNMENTS,
  ID_TO_KEY,
} from '../types/shipment.types';
import { operationsActionButtonStyles } from '../../common/buttonStyles';

interface ShipmentsPageProps {
  apiBasePath?: string;
}

export function ShipmentsPage({ apiBasePath }: ShipmentsPageProps) {
  // ==========================================================================
  // STATE
  // ==========================================================================

  const [activeTab, setActiveTab] = useState<string>('shipments');
  const [transitBuildOpened, setTransitBuildOpened] = useState<boolean>(false);
  const [transitBuildShipment, setTransitBuildShipment] =
    useState<ShipmentData | null>(null);

  const [transitReclassOpened, setTransitReclassOpened] =
    useState<boolean>(false);
  const [transitReclassShipment, setTransitReclassShipment] =
    useState<ShipmentData | null>(null);

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
    createTransitBuildEntry,
    createTransitReclassEntries,
  } = useShipmentsData({ apiBasePath });

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
        value: statistics.totalShipments,
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
        value: statistics.totalSacks,
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

  const handleCSVImportWrapper = async (file?: File | null): Promise<void> => {
    if (!file) {
      return;
    }

    await handleCSVImport(file);
  };

  const handleOpenTransitBuild = () => {
    if (!editingShipment) {
      return;
    }

    setTransitBuildShipment(editingShipment);
    setTransitBuildOpened(true);
    closeEditModal();
  };

  const handleSubmitTransitBuild = async (input: {
    postingDate: Date;
    paidAccount: 'Cash' | 'E-Wallet';
    paidAmount: number;
    supplierEstimate: number;
    forwarderEstimate: number;
    courierEstimate: number;
    notes?: string;
  }): Promise<boolean> => {
    if (!transitBuildShipment) {
      return false;
    }

    return await createTransitBuildEntry(transitBuildShipment.id, input);
  };

  const handleOpenTransitReclass = () => {
    if (!editingShipment) {
      return;
    }

    const status = (editingShipment['Shipment Status'] ?? '').toString().trim();
    if (status.toLowerCase() !== 'delivered') {
      return;
    }

    setTransitReclassShipment(editingShipment);
    setTransitReclassOpened(true);
    closeEditModal();
  };

  const handleSubmitTransitReclass = async (input: {
    postingDate: Date;
    selectedIdempotencyKeys: string[];
    notes?: string;
  }): Promise<boolean> => {
    if (!transitReclassShipment) {
      return false;
    }

    return await createTransitReclassEntries(transitReclassShipment.id, input);
  };

  const transitBuildDisabledReason = useMemo(() => {
    if (!editingShipment) {
      return 'No shipment selected.';
    }

    const shipmentCode = (editingShipment['Shipment Code'] ?? '').toString();
    if (!shipmentCode.trim()) {
      return 'Add a Shipment Code before creating a transit build-up entry.';
    }

    const linkedProductCount = Number(editingShipment.linkedProductCount ?? 0);
    if (Number.isFinite(linkedProductCount) && linkedProductCount <= 0) {
      return 'Link at least one Product to this Shipment Code on the Products page first.';
    }

    return undefined;
  }, [editingShipment]);

  const transitReclassDisabledReason = useMemo(() => {
    if (!editingShipment) {
      return 'No shipment selected.';
    }

    const status = (editingShipment['Shipment Status'] ?? '').toString().trim();
    if (status.toLowerCase() !== 'delivered') {
      return 'Shipment must be Delivered before reclassing.';
    }

    const shipmentCode = (editingShipment['Shipment Code'] ?? '').toString();
    if (!shipmentCode.trim()) {
      return 'Add a Shipment Code before reclassing.';
    }

    const linkedProductCount = Number(editingShipment.linkedProductCount ?? 0);
    if (Number.isFinite(linkedProductCount) && linkedProductCount <= 0) {
      return 'Link at least one Product to this Shipment Code on the Products page first.';
    }

    return undefined;
  }, [editingShipment]);

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
      {/* Statistics Cards */}
      {statsCards && statsCards.length > 0 && (
        <StatsCardGrid
          cards={statsCards}
          variant="vibrant"
          minCardWidth={220}
          spacing="md"
        />
      )}

      {/* Navigation Tabs */}
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value || 'shipments')}
      >
        <Tabs.List>
          <Tabs.Tab value="shipments">Shipments</Tabs.Tab>
          <Tabs.Tab value="dashboard">Shipments Dashboard</Tabs.Tab>
          <Tabs.Tab value="pickup">Pickup Form</Tabs.Tab>
          <Tabs.Tab value="logistics">Logistics Costs</Tabs.Tab>
        </Tabs.List>

        {/* Shipments Tab */}
        <Tabs.Panel value="shipments" pt="md">
          <DataTable
            data={shipments}
            filteredData={filteredData}
            columns={columns}
            searchQuery={searchQuery}
            onSearch={handleSearch}
            searchPlaceholder="Search shipments by code, CV number, status, or notes..."
            getCellContent={cellContentGetter}
            enableCSVImport={false}
            footerLeft={`Showing ${filteredData.length} of ${shipments.length} shipments`}
            actionButtons={
              <>
                <FileButton
                  accept=".csv"
                  onChange={(uploadedFile) => setCsvFile(uploadedFile)}
                >
                  {(fileButtonProps) => (
                    <Button
                      {...fileButtonProps}
                      leftSection={<IconUpload size={16} />}
                      size="sm"
                      radius="sm"
                      styles={operationsActionButtonStyles}
                    >
                      {csvFile ? 'Change CSV File' : 'Select CSV File'}
                    </Button>
                  )}
                </FileButton>
                <Button
                  onClick={() => {
                    void handleCSVImportWrapper(csvFile);
                  }}
                  disabled={!csvFile}
                  leftSection={<IconUpload size={16} />}
                  size="sm"
                  radius="sm"
                  styles={operationsActionButtonStyles}
                >
                  Import CSV
                </Button>
                <Button
                  leftSection={<IconPlus size={16} />}
                  color="green"
                  size="sm"
                  radius="sm"
                  onClick={handleAddShipment}
                >
                  Add Shipment
                </Button>
              </>
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
            onOpenTransitBuild={handleOpenTransitBuild}
            transitBuildDisabled={Boolean(transitBuildDisabledReason)}
            transitBuildDisabledReason={transitBuildDisabledReason}
            onOpenTransitReclass={handleOpenTransitReclass}
            transitReclassDisabled={Boolean(transitReclassDisabledReason)}
            transitReclassDisabledReason={transitReclassDisabledReason}
          />

          <TransitBuildModal
            opened={transitBuildOpened}
            onClose={() => {
              setTransitBuildOpened(false);
              setTransitBuildShipment(null);
            }}
            shipment={transitBuildShipment}
            onSubmit={handleSubmitTransitBuild}
          />

          <TransitReclassModal
            opened={transitReclassOpened}
            onClose={() => {
              setTransitReclassOpened(false);
              setTransitReclassShipment(null);
            }}
            shipment={transitReclassShipment}
            apiBasePath={apiBasePath}
            onSubmit={handleSubmitTransitReclass}
          />
        </Tabs.Panel>

        {/* Shipments Dashboard Tab */}
        <Tabs.Panel value="dashboard" pt="md">
          <ShipmentsDashboard shipments={shipments} />
        </Tabs.Panel>

        {/* Pickup Form Tab */}
        <Tabs.Panel value="pickup" pt="md">
          <PickupForm shipments={shipments} />
        </Tabs.Panel>

        {/* Logistics Costs Tab */}
        <Tabs.Panel value="logistics" pt="md">
          <LogisticsCostsTab shipments={shipments} apiBasePath={apiBasePath} />
        </Tabs.Panel>
      </Tabs>
    </PageLayout>
  );
}
