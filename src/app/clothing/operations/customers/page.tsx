'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { Button, Modal, Stack, Group, TextInput, Select } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUsers, IconBuildingStore, IconPhone, IconPlus, IconUser, IconMail, IconMapPin, IconCheck } from '@tabler/icons-react';

// Import our new DataTable template
import { DataTable, StatCard, useDataTable, GridColumn, Item } from '../../../../components/ui';

interface CustomerData {
  id?: number;
  'Customer Name': string;
  'Company Name': string;
  'Email Address': string;
  'Phone Number': string;
  'Address': string;
  'Customer Type': string;
  'Status': string;
}

export default function Customers() {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [newCustomer, setNewCustomer] = useState({
    customerName: '',
    companyName: '',
    emailAddress: '',
    phoneNumber: '',
    address: '',
    customerType: '',
    status: 'Active',
  });

  // Define columns for the table
  const columns: GridColumn[] = [
    { title: 'Customer Name', width: 200, id: 'customerName', grow: 1 },
    { title: 'Company Name', width: 200, id: 'companyName', grow: 1 },
    { title: 'Email Address', width: 250, id: 'emailAddress' },
    { title: 'Phone Number', width: 150, id: 'phoneNumber' },
    { title: 'Address', width: 300, id: 'address' },
    { title: 'Customer Type', width: 150, id: 'customerType' },
    { title: 'Status', width: 120, id: 'status' },
  ];

  // Map column IDs to data keys
  const idToKey: Record<string, keyof CustomerData> = {
    customerName: 'Customer Name',
    companyName: 'Company Name',
    emailAddress: 'Email Address',
    phoneNumber: 'Phone Number',
    address: 'Address',
    customerType: 'Customer Type',
    status: 'Status',
  };

  // Use the data table hook
  const {
    searchQuery,
    filteredData,
    handleSearch,
    getCellContent,
    stats
  } = useDataTable({
    data: customers,
    searchFields: ['Customer Name', 'Company Name', 'Email Address', 'Phone Number', 'Customer Type', 'Status'],
  });

  // Create cell content getter
  const cellContentGetter = useCallback((cell: Item) => 
    getCellContent(cell, columns, idToKey),
    [getCellContent, columns, idToKey]
  );

  // Load data from API/database on mount
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const response = await fetch('/api/customers');
        if (response.ok) {
          const customersFromDB = await response.json();
          setCustomers(customersFromDB);
        } else {
          // Start with empty array if no data
          setCustomers([]);
        }
      } catch (e) {
        console.error('Failed to load customers', e);
        setCustomers([]);
      }
    };
    loadCustomers();
  }, []);

  // Stats cards with the exact same styling as products page
  const statsCards: StatCard[] = [
    {
      title: 'Total Customers',
      value: stats.total,
      icon: <IconUsers size={18} />,
      color: 'blue',
      backgroundColor: 'var(--mantine-color-blue-6)',
    },
    {
      title: 'Active Customers',
      value: customers.filter(c => c.Status === 'Active').length,
      icon: <IconUser size={18} />,
      color: 'green',
      backgroundColor: 'var(--mantine-color-green-6)',
    },
    {
      title: 'Companies',
      value: new Set(customers.map(c => c['Company Name']).filter(Boolean)).size,
      icon: <IconBuildingStore size={18} />,
      color: 'orange',
      backgroundColor: '#fd7e14',
    },
    {
      title: 'Retail Customers',
      value: customers.filter(c => c['Customer Type'] === 'Retail').length,
      icon: <IconMapPin size={18} />,
      color: 'purple',
      backgroundColor: '#9775fa',
    },
  ];

  // CSV Import handler
  const handleCSVImport = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n');
      
      const importedCustomers: CustomerData[] = [];
      let id = 1;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line === ',,,,,,') continue; // Skip empty lines
        
        const values = line.split(',');
        if (values.length < 7) continue; // Skip incomplete rows
        
        const customerData: CustomerData = {
          id: id++,
          'Customer Name': values[0]?.trim() || '',
          'Company Name': values[1]?.trim() || '',
          'Email Address': values[2]?.trim() || '',
          'Phone Number': values[3]?.trim() || '',
          'Address': values[4]?.trim() || '',
          'Customer Type': values[5]?.trim() || '',
          'Status': values[6]?.trim() || 'Active',
        };

        if (!customerData['Customer Name']) continue; // Skip rows without customer name
        importedCustomers.push(customerData);
      }

      if (importedCustomers.length === 0) {
        notifications.show({
          title: '⚠️ Import Warning',
          message: 'No valid customer data found in the CSV file',
          color: 'yellow',
          autoClose: 4000,
        });
        return;
      }

      // Save to database via API
      const saveResponse = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importedCustomers),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save to database');
      }

      const saveResult = await saveResponse.json();

      // Update local state
      setCustomers(importedCustomers);
      setCsvFile(null);

      notifications.show({
        title: '🎉 Import Successful!',
        message: `Successfully imported ${saveResult.count || importedCustomers.length} customer records`,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });

    } catch (error) {
      console.error('CSV import error:', error);
      throw error; // Let DataTable handle the error notification
    }
  };

  // Add new customer
  const handleAddCustomer = async () => {
    try {
      const customerData: CustomerData = {
        'Customer Name': newCustomer.customerName.trim(),
        'Company Name': newCustomer.companyName.trim(),
        'Email Address': newCustomer.emailAddress.trim(),
        'Phone Number': newCustomer.phoneNumber.trim(),
        'Address': newCustomer.address.trim(),
        'Customer Type': newCustomer.customerType,
        'Status': newCustomer.status,
      };

      // Save to database
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([customerData]),
      });

      if (!response.ok) {
        throw new Error('Failed to save customer');
      }

      // Reload data from database
      const reloadResponse = await fetch('/api/customers');
      if (reloadResponse.ok) {
        const updatedCustomers = await reloadResponse.json();
        setCustomers(updatedCustomers);
      }

      // Reset form and close modal
      setNewCustomer({
        customerName: '',
        companyName: '',
        emailAddress: '',
        phoneNumber: '',
        address: '',
        customerType: '',
        status: 'Active',
      });
      setAddOpen(false);

      notifications.show({
        title: '🎉 Customer Added Successfully!',
        message: `${customerData['Customer Name']} has been added to your customer database`,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });

    } catch (error) {
      console.error('Failed to add customer:', error);
      notifications.show({
        title: '❌ Failed to Add Customer',
        message: 'Could not save the customer to database. Please try again.',
        color: 'red',
        autoClose: 4000,
      });
    }
  };

  return (
    <PageLayout fluid withPadding>
      <DataTable
        data={customers}
        filteredData={filteredData}
        columns={columns}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        searchPlaceholder="Search customers by name, company, email, phone..."
        getCellContent={cellContentGetter}
        statsCards={statsCards}
        enableCSVImport={true}
        csvFile={csvFile}
        onFileChange={setCsvFile}
        onCSVImport={handleCSVImport}
        footerLeft={`Showing ${filteredData.length} of ${customers.length} customers`}
        actionButtons={
          <Button 
            leftSection={<IconPlus size={16} />} 
            color="green"
            size="md"
            radius="md"
            onClick={() => setAddOpen(true)}
          >
            Add Customer
          </Button>
        }
      />

      {/* Add Customer Modal */}
      <Modal 
        opened={addOpen} 
        onClose={() => setAddOpen(false)}
        title="Add New Customer"
        size="lg"
        radius="md"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Customer Name"
            placeholder="Enter customer name"
            withAsterisk
            value={newCustomer.customerName}
            onChange={(e) => setNewCustomer(prev => ({ ...prev, customerName: e.target.value }))}
          />
          
          <TextInput
            label="Company Name"
            placeholder="Enter company name"
            value={newCustomer.companyName}
            onChange={(e) => setNewCustomer(prev => ({ ...prev, companyName: e.target.value }))}
          />
          
          <TextInput
            label="Email Address"
            placeholder="Enter email address"
            type="email"
            value={newCustomer.emailAddress}
            onChange={(e) => setNewCustomer(prev => ({ ...prev, emailAddress: e.target.value }))}
          />
          
          <TextInput
            label="Phone Number"
            placeholder="Enter phone number"
            value={newCustomer.phoneNumber}
            onChange={(e) => setNewCustomer(prev => ({ ...prev, phoneNumber: e.target.value }))}
          />
          
          <TextInput
            label="Address"
            placeholder="Enter address"
            value={newCustomer.address}
            onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
          />
          
          <Select
            label="Customer Type"
            placeholder="Select customer type"
            data={['Retail', 'Wholesale', 'Corporate', 'Individual']}
            value={newCustomer.customerType}
            onChange={(value) => setNewCustomer(prev => ({ ...prev, customerType: value || '' }))}
          />
          
          <Select
            label="Status"
            placeholder="Select status"
            data={['Active', 'Inactive', 'Pending']}
            value={newCustomer.status}
            onChange={(value) => setNewCustomer(prev => ({ ...prev, status: value || 'Active' }))}
          />
          
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddCustomer}
              disabled={!newCustomer.customerName.trim()}
              color="green"
            >
              Add Customer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PageLayout>
  );
}