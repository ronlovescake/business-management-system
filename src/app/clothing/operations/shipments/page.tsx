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
  IconCurrencyDollar,
  IconBox,
  IconScale,
  IconTruck,
  IconAnchor,
  IconClipboardCheck,
  IconBuilding,
  IconHandStop
} from '@tabler/icons-react';
import { ShipmentData } from '../../../../types';

export default function Shipments() {
  const [shipments, setShipments] = useState<ShipmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvFile, setCsvFile] = useState<File | null>(null);

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

  // Create cell content getter with alignment
  const cellContentGetter = (cell: Item) => {
    const [col, row] = cell;
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
  const pendingShipments = filteredData.filter(s => s['Shipment Status']?.toLowerCase() === 'pending').length;
  const inTransitShipments = filteredData.filter(s => s['Shipment Status']?.toLowerCase() === 'in transit').length;
  const deliveredShipments = filteredData.filter(s => s['Shipment Status']?.toLowerCase() === 'delivered').length;
  const manilaPortShipments = filteredData.filter(s => s['Shipment Status']?.toLowerCase() === 'manila port').length;
  const withPierGatepassShipments = filteredData.filter(s => s['Shipment Status']?.toLowerCase() === 'with pier gatepass').length;
  const phWarehouseShipments = filteredData.filter(s => s['Shipment Status']?.toLowerCase() === 'ph warehouse').length;
  const forPickupShipments = filteredData.filter(s => s['Shipment Status']?.toLowerCase() === 'for pickup').length;
  
  // Parse fees (remove currency symbol and commas, then convert to number) - dynamic calculation
  const totalFees = filteredData.reduce((sum, s) => {
    const feeString = s['Fee'] || '0';
    const feeNumber = parseFloat(feeString.toString().replace(/[₱,]/g, '')) || 0;
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
      const lines = text.split('\n');
      
      // Parse CSV properly handling quoted fields
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            inQuotes = !inQuotes;
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
      
      const headers = parseCSVLine(lines[0]);
      const importedShipments: ShipmentData[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          const values = parseCSVLine(line);
          const shipmentData: any = { id: Date.now() + i };
          
          headers.forEach((header, index) => {
            if (values[index] !== undefined && values[index] !== '') {
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
