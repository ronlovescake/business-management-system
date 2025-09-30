'use client';

import React, { useState, useEffect } from 'react';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { DataTable, StatCard, useDataTable } from '../../../../components/ui';
import { GridColumn, Item } from '@glideapps/glide-data-grid';
import { Button, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { 
  IconPlus, 
  IconCheck,
  IconPackage,
  IconCurrencyDollar 
} from '@tabler/icons-react';
import { ShipmentData } from '../../../../types';

export default function Shipments() {
  const [shipments, setShipments] = useState<ShipmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Define columns for the shipments table
  const columns: GridColumn[] = [
    { title: 'Shipment Code', width: 150, id: 'shipmentCode' },
    { title: 'CV Number', width: 120, id: 'cvNumber' },
    { title: 'No. Of Sacks', width: 120, id: 'noOfSacks' },
    { title: 'Total CBM', width: 100, id: 'totalCBM' },
    { title: 'Weight', width: 100, id: 'weight' },
    { title: 'Fee', width: 120, id: 'fee' },
    { title: 'Shipment Status', width: 140, id: 'shipmentStatus' },
    { title: 'Date Created', width: 130, id: 'dateCreated' },
    { title: 'Date Delivered', width: 130, id: 'dateDelivered' },
    { title: 'Duration', width: 100, id: 'duration' },
    { title: 'Notes', width: 200, id: 'notes' },
  ];

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
  const {
    searchQuery,
    filteredData,
    handleSearch,
    getCellContent,
    stats
  } = useDataTable({
    data: shipments,
    searchFields: [
      'Shipment Code',
      'CV Number', 
      'Shipment Status',
      'Notes'
    ],
  });

  // Load shipments data
  useEffect(() => {
    const loadShipments = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API call
        // const response = await fetch('/api/shipments');
        // const data = await response.json();
        // setShipments(data);
        
        // For now, start with empty array
        setShipments([]);
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

  // Create cell content getter
  const cellContentGetter = (cell: Item) => 
    getCellContent(cell, columns, idToKey);

  // Calculate statistics
  const pendingShipments = shipments.filter(s => s['Shipment Status']?.toLowerCase() === 'pending').length;
  const inTransitShipments = shipments.filter(s => s['Shipment Status']?.toLowerCase() === 'in transit').length;
  const deliveredShipments = shipments.filter(s => s['Shipment Status']?.toLowerCase() === 'delivered').length;
  const totalFees = shipments.reduce((sum, s) => sum + (s['Fee'] || 0), 0);
  const totalSacks = shipments.reduce((sum, s) => sum + (s['No. Of Sacks'] || 0), 0);

  // Define stats cards
  const statsCards: StatCard[] = [
    {
      title: 'Total Shipments',
      value: stats.total,
      icon: <IconPackage size={18} />,
      color: 'blue',
      backgroundColor: 'var(--mantine-color-blue-6)',
    },
    {
      title: 'Total Sacks',
      value: totalSacks.toLocaleString(),
      icon: <IconPackage size={18} />,
      color: 'orange',
      backgroundColor: '#fd7e14',
    },
    {
      title: 'Delivered',
      value: deliveredShipments,
      icon: <IconCheck size={18} />,
      color: 'green',
      backgroundColor: 'var(--mantine-color-green-6)',
    },
    {
      title: 'Total Fees',
      value: `₱${totalFees.toLocaleString()}`,
      icon: <IconCurrencyDollar size={18} />,
      color: 'purple',
      backgroundColor: '#9775fa',
    },
  ];

  // Handle CSV import
  const handleCSVImport = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      const importedShipments: ShipmentData[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const shipmentData: any = { id: Date.now() + i };
          
          headers.forEach((header, index) => {
            if (values[index] !== undefined) {
              shipmentData[header] = values[index];
            }
          });
          
          importedShipments.push(shipmentData as ShipmentData);
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

      // TODO: Save to database via API
      // const saveResponse = await fetch('/api/shipments', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(importedShipments),
      // });

      // Update local state
      setShipments(importedShipments);
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
      notifications.show({
        title: '❌ Import Failed',
        message: 'Failed to parse CSV file. Please check the file format.',
        color: 'red',
        autoClose: 4000,
      });
    }
  };

  // Handle add new shipment
  const handleAddShipment = () => {
    // TODO: Implement add shipment modal
    notifications.show({
      title: 'Coming Soon',
      message: 'Add new shipment functionality will be implemented soon',
      color: 'blue',
    });
  };

  if (loading) {
    return (
      <PageLayout title="Shipments">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          Loading shipments...
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Shipments" fluid withPadding>
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
        // Enable clicking on shipment codes for future edit functionality
        enableClickableCursor={false}
      />
    </PageLayout>
  );
}
