'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { GridCellKind, GridColumn, Item } from '@glideapps/glide-data-grid';
import { Stack, Text, Box, Button, Group, FileInput, Loader, TextInput, Card, SimpleGrid, ThemeIcon, Title, Modal, Select } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUpload, IconSearch, IconUsers, IconFilter, IconBuildingStore, IconPhone, IconPlus, IconUser, IconMail, IconMapPin, IconCheck } from '@tabler/icons-react';

// Import Glide Data Grid CSS
import '@glideapps/glide-data-grid/dist/index.css';

// Custom styles for larger font and center aligned headers
const customGridStyles = `
  .data-grid-container * {
    font-size: 20px !important;
    font-family: Inter, sans-serif !important;
  }
  .data-grid-container canvas {
    font-size: 20px !important;
  }
  .data-grid-container .gdg-cell {
    font-size: 20px !important;
    font-family: Inter, sans-serif !important;
  }
  .data-grid-container .gdg-header {
    font-size: 20px !important;
    font-weight: 600 !important;
    font-family: Inter, sans-serif !important;
    text-align: center !important;
  }
  .data-grid-container .gdg-cell-text {
    font-size: 20px !important;
  }
  .data-grid-container [role="gridcell"] {
    font-size: 20px !important;
  }
  .data-grid-container [role="columnheader"] {
    font-size: 20px !important;
    font-weight: 600 !important;
    text-align: center !important;
    justify-content: center !important;
    display: flex !important;
    align-items: center !important;
  }
  .data-grid-container div {
    font-size: 20px !important;
  }
  .dvn-scroller {
    font-size: 20px !important;
  }
  
  /* Make customer name column look clickable */
  .data-grid-container canvas {
    cursor: default;
  }
  .data-grid-container:hover canvas {
    cursor: pointer;
  }
`;

// Dynamic import to prevent SSR issues
const DataEditor = dynamic(
  () => import('@glideapps/glide-data-grid').then((mod) => mod.DataEditor),
  { 
    ssr: false,
    loading: () => <Loader />
  }
);

interface CustomerData {
  id?: number;
  Date: string;
  'Customer Name': string;
  'Phone Number': string;
  Address: string;
  Facebook: string;
  'Email Address': string;
  'Business Name': string;
  'Tax Number': string;
  'Business Address': string;
  'Business Contact Number': string;
  'Customer Status': string;
}

export default function Customers() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerData[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [gridHeight, setGridHeight] = useState<number>(600);
  const [addOpen, setAddOpen] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    customerName: '',
    phoneNumber: '',
    address: '',
    facebook: '',
    emailAddress: '',
    businessName: '',
    taxNumber: '',
    businessAddress: '',
    businessContactNumber: '',
    customerStatus: '',
  });

  // Keep grid height at ~85vh responsively
  useEffect(() => {
    const updateHeight = () => {
      const h = Math.floor(window.innerHeight * 0.85);
      // Keep a sensible minimum height
      setGridHeight(Math.max(300, h));
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Handle Ctrl+F to focus search input instead of browser find
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+F (or Cmd+F on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault(); // Prevent browser's find dialog
        searchInputRef.current?.focus(); // Focus our search input
        searchInputRef.current?.select(); // Select all text for easy replacement
      }
    };

    // Add event listener to document
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup event listener on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Initial load from DB
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/customers', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load customers');
        const data: CustomerData[] = await res.json();
        setCustomers(data);
        setFilteredCustomers(data);
      } catch (e) {
        console.error('Failed to load customers', e);
      }
    };
    load();
  }, []);

  // Derived stats
  const stats = useMemo(() => {
    const total = customers.length;
    const filtered = filteredCustomers.length;
    const uniqueBusinesses = new Set(
      customers.map((c) => (c['Business Name'] || '').trim()).filter(Boolean)
    ).size;
    const contactable = customers.filter(
      (c) => (c['Email Address'] && c['Email Address'].trim()) || (c['Phone Number'] && c['Phone Number'].trim())
    ).length;
    const contactablePct = total > 0 ? Math.round((contactable / total) * 100) : 0;

    return { total, filtered, uniqueBusinesses, contactable, contactablePct };
  }, [customers, filteredCustomers]);

  // Customer columns optimized for wide layout
  const columns: GridColumn[] = [
    { title: 'Date', width: 160, id: 'date' },
    { title: 'Customer Name', width: 500, id: 'customerName' }, // Increased to 500px for maximum readability
    { title: 'Phone Number', width: 190, id: 'phoneNumber' },
    { title: 'Address', width: 340, id: 'address' },
    { title: 'Facebook', width: 220, id: 'facebook' },
    { title: 'Email Address', width: 260, id: 'emailAddress' },
    { title: 'Business Name', width: 500, id: 'businessName' }, // Increased to 500px for maximum readability
    { title: 'Tax Number', width: 170, id: 'taxNumber' },
    { title: 'Business Address', width: 340, id: 'businessAddress' },
    { title: 'Business Contact Number', width: 260, id: 'businessContactNumber' },
    { title: 'Customer Status', width: 120, id: 'customerStatus', grow: 1 }, // Compact size for status values
  ];

  // Map column ids to CustomerData keys
  const idToKey: Record<string, keyof CustomerData> = useMemo(() => ({
    date: 'Date',
    customerName: 'Customer Name',
    phoneNumber: 'Phone Number',
    address: 'Address',
    facebook: 'Facebook',
    emailAddress: 'Email Address',
    businessName: 'Business Name',
    taxNumber: 'Tax Number',
    businessAddress: 'Business Address',
    businessContactNumber: 'Business Contact Number',
    customerStatus: 'Customer Status',
  }), []);

  // Update a single cell value by filtered row/col
  const updateCellAt = useCallback((nextCustomers: CustomerData[], filteredRow: number, colIndex: number, rawValue: string) => {
    const col = columns[colIndex];
    if (!col) return;
    const key = idToKey[col.id ?? ''];
    if (!key) return;
    const rowObj = filteredCustomers[filteredRow];
    if (!rowObj) return;
    const globalIndex = customers.indexOf(rowObj);
    if (globalIndex === -1) return;
    const newVal = (rawValue ?? '').toString();
    const updated: CustomerData = { ...nextCustomers[globalIndex], [key]: newVal } as CustomerData;
    nextCustomers[globalIndex] = updated;
  }, [customers, filteredCustomers, columns, idToKey]);

  // Handle paste into grid (multi-cell)
  const handlePaste = useCallback((target: Item, values: readonly (readonly string[])[]) => {
    if (!pasteMode) return false;
    const [startCol, startRow] = target;
    let applied = 0;
    let clipped = false;
    const nextCustomers = [...customers];

    const makeEmpty = (): CustomerData => ({
      Date: '',
      'Customer Name': '',
      'Phone Number': '',
      Address: '',
      Facebook: '',
      'Email Address': '',
      'Business Name': '',
      'Tax Number': '',
      'Business Address': '',
      'Business Contact Number': '',
      'Customer Status': '',
    });

    for (let r = 0; r < values.length; r++) {
      const rowIdx = startRow + r;
      const rowData = values[r] ?? [];

      // Determine the global index to write to (existing filtered row or append)
      let globalIndex: number;
      if (rowIdx < filteredCustomers.length) {
        const rowObj = filteredCustomers[rowIdx];
        globalIndex = nextCustomers.indexOf(rowObj);
        if (globalIndex === -1) {
          nextCustomers.push(makeEmpty());
          globalIndex = nextCustomers.length - 1;
        }
      } else {
        nextCustomers.push(makeEmpty());
        globalIndex = nextCustomers.length - 1;
      }

      for (let c = 0; c < rowData.length; c++) {
        const colIdx = startCol + c;
        if (colIdx >= columns.length) { clipped = true; break; }
        const v = (rowData[c] ?? '').toString();
        const col = columns[colIdx];
        const key = col ? idToKey[col.id ?? ''] : undefined;
        if (key) {
          const updated: CustomerData = { ...nextCustomers[globalIndex], [key]: v } as CustomerData;
          nextCustomers[globalIndex] = updated;
          applied++;
        }
      }
    }

    if (applied > 0) {
      // Persist full dataset via bulk sync for simplicity
      (async () => {
        try {
          const res = await fetch('/api/customers', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nextCustomers),
          });
          if (!res.ok) {
            let msg = 'Failed to persist pasted rows';
            try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
            notifications.show({ title: 'Paste saved locally only', message: msg, color: 'yellow' });
          }
        } catch (e) {
          console.error('Failed to persist pasted rows', e);
          notifications.show({ title: 'Paste saved locally only', message: 'Database not reachable', color: 'yellow' });
        }
      })();

      setCustomers(nextCustomers);
      if (!searchQuery.trim()) {
        setFilteredCustomers(nextCustomers);
      } else {
        const q = searchQuery.toLowerCase();
        setFilteredCustomers(nextCustomers.filter((customer) =>
          customer.Date.toLowerCase().includes(q) ||
          customer['Customer Name'].toLowerCase().includes(q) ||
          customer['Phone Number'].toLowerCase().includes(q) ||
          customer.Address.toLowerCase().includes(q) ||
          customer.Facebook.toLowerCase().includes(q) ||
          customer['Email Address'].toLowerCase().includes(q) ||
          customer['Business Name'].toLowerCase().includes(q) ||
          customer['Tax Number'].toLowerCase().includes(q) ||
          customer['Business Address'].toLowerCase().includes(q) ||
          customer['Business Contact Number'].toLowerCase().includes(q) ||
          customer['Customer Status'].toLowerCase().includes(q)
        ));
      }

      notifications.show({
        title: 'Pasted into table',
        message: `Applied ${applied} cell${applied === 1 ? '' : 's'}${clipped ? ' (some data clipped to grid size)' : ''}`,
        color: 'blue',
      });

      return true;
    }
    return false;
  }, [pasteMode, customers, filteredCustomers, columns, searchQuery, idToKey]);

  // CSV import functionality
  const handleImportCSV = async () => {
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('CSV file must have headers and at least one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const parsedData: CustomerData[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        
        if (values.length >= 11) {
          const customer: CustomerData = {
            'Date': values[0] || '',
            'Customer Name': values[1] || '',
            'Phone Number': values[2] || '',
            'Address': values[3] || '',
            'Facebook': values[4] || '',
            'Email Address': values[5] || '',
            'Business Name': values[6] || '',
            'Tax Number': values[7] || '',
            'Business Address': values[8] || '',
            'Business Contact Number': values[9] || '',
            'Customer Status': values[10] || '',
          };
          parsedData.push(customer);
        }
      }
      
      // Persist to DB (replace all)
      try {
        const res = await fetch('/api/customers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsedData),
        });
        if (!res.ok) {
          let msg = 'Failed to persist imported CSV';
          try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
          notifications.show({ title: 'Import saved locally only', message: msg, color: 'yellow' });
        }
      } catch (e) {
        console.error('Failed to persist imported CSV', e);
        notifications.show({ title: 'Import saved locally only', message: 'Database not reachable', color: 'yellow' });
      }

      setCustomers(parsedData);
      setFilteredCustomers(parsedData);
      setFile(null);
      console.log(`Imported ${parsedData.length} customers`);
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Error importing CSV file. Please check the file format.');
    }
  };

  // Search functionality
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    const filtered = customers.filter(customer => {
      const searchTerm = query.toLowerCase();
      return (
        customer.Date.toLowerCase().includes(searchTerm) ||
        customer['Customer Name'].toLowerCase().includes(searchTerm) ||
        customer['Phone Number'].toLowerCase().includes(searchTerm) ||
        customer.Address.toLowerCase().includes(searchTerm) ||
        customer.Facebook.toLowerCase().includes(searchTerm) ||
        customer['Email Address'].toLowerCase().includes(searchTerm) ||
        customer['Business Name'].toLowerCase().includes(searchTerm) ||
        customer['Tax Number'].toLowerCase().includes(searchTerm) ||
        customer['Business Address'].toLowerCase().includes(searchTerm) ||
        customer['Business Contact Number'].toLowerCase().includes(searchTerm) ||
        customer['Customer Status'].toLowerCase().includes(searchTerm)
      );
    });
    
    setFilteredCustomers(filtered);
  };

  // Data rendering
  const getData = useCallback((cell: Item): any => {
    const [col, row] = cell;
    
    if (row >= filteredCustomers.length) {
      return {
        kind: GridCellKind.Text,
        data: '',
        displayData: '',
        allowOverlay: true,
      };
    }

    const customer = filteredCustomers[row];
    const column = columns[col];

    let cellData = '';
    switch (column.id) {
      case 'date': cellData = customer.Date; break;
      case 'customerName': cellData = customer['Customer Name']; break;
      case 'phoneNumber': cellData = customer['Phone Number']; break;
      case 'address': cellData = customer.Address; break;
      case 'facebook': cellData = customer.Facebook; break;
      case 'emailAddress': cellData = customer['Email Address']; break;
      case 'businessName': cellData = customer['Business Name']; break;
      case 'taxNumber': cellData = customer['Tax Number']; break;
      case 'businessAddress': cellData = customer['Business Address']; break;
      case 'businessContactNumber': cellData = customer['Business Contact Number']; break;
      case 'customerStatus': cellData = customer['Customer Status']; break;
      default: cellData = '';
    }

    // Make customer name column appear as a clickable link
    if (column.id === 'customerName' && cellData && customer.id) {
      return {
        kind: GridCellKind.Text,
        data: cellData,
        displayData: cellData,
        allowOverlay: true,
        cursor: 'pointer',
        contentAlign: 'left',
        style: 'link', // This might help indicate it's clickable
      };
    }

    return {
      kind: GridCellKind.Text,
      data: cellData,
      displayData: cellData,
      allowOverlay: true,
    };
  }, [filteredCustomers, columns]);

  const getRowCount = useCallback(() => filteredCustomers.length, [filteredCustomers]);

  // Custom header renderer for center alignment
  const drawHeader = useCallback((args: any) => {
    const { ctx, column, rect, theme } = args;
    
    // Fill header background
    ctx.fillStyle = theme.bgHeader;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    
    // Set text properties
    ctx.fillStyle = theme.textHeader;
    ctx.font = theme.headerFontStyle;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw centered text
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    ctx.fillText(column.title, centerX, centerY);
    
    return true;
  }, []);

  return (
    <PageLayout fluid withPadding>
      <style dangerouslySetInnerHTML={{ __html: customGridStyles }} />
      <Stack gap="md" style={{ width: '100%', maxWidth: 'none', margin: '0 auto' }}>
        {/* Stats cards */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <Card shadow="sm" padding="md" radius="md" style={{ background: 'var(--mantine-color-blue-6)', color: 'white' }}>
            <Group justify="space-between" align="flex-start">
              <div>
                <Text c="white" size="xs" style={{ opacity: 0.85 }}>Total customers</Text>
                <Title order={3} c="white">{stats.total}</Title>
              </div>
              <ThemeIcon variant="white" color="blue" size="lg" radius="md">
                <IconUsers size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card shadow="sm" padding="md" radius="md" style={{ background: 'var(--mantine-color-grape-6)', color: 'white' }}>
            <Group justify="space-between" align="flex-start">
              <div>
                <Text c="white" size="xs" style={{ opacity: 0.85 }}>In current view</Text>
                <Title order={3} c="white">{stats.filtered}</Title>
              </div>
              <ThemeIcon variant="white" color="grape" size="lg" radius="md">
                <IconFilter size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card shadow="sm" padding="md" radius="md" style={{ background: 'var(--mantine-color-teal-6)', color: 'white' }}>
            <Group justify="space-between" align="flex-start">
              <div>
                <Text c="white" size="xs" style={{ opacity: 0.85 }}>Unique businesses</Text>
                <Title order={3} c="white">{stats.uniqueBusinesses}</Title>
              </div>
              <ThemeIcon variant="white" color="teal" size="lg" radius="md">
                <IconBuildingStore size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card shadow="sm" padding="md" radius="md" style={{ background: 'var(--mantine-color-green-6)', color: 'white' }}>
            <Group justify="space-between" align="flex-start">
              <div>
                <Text c="white" size="xs" style={{ opacity: 0.85 }}>Contactable</Text>
                <Title order={3} c="white">{stats.contactable} <Text component="span" size="sm" c="white" style={{ opacity: 0.85 }}>({stats.contactablePct}%)</Text></Title>
              </div>
              <ThemeIcon variant="white" color="green" size="lg" radius="md">
                <IconPhone size={18} />
              </ThemeIcon>
            </Group>
          </Card>
        </SimpleGrid>

        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {customers.length > 0
              ? `${filteredCustomers.length} of ${customers.length} customers${searchQuery ? ' (filtered)' : ''}`
              : 'Customer management system - import CSV file to get started'
            }
          </Text>

          <Group gap="sm">
            <Button
              variant={pasteMode ? 'filled' : 'outline'}
              color={pasteMode ? 'yellow' : 'gray'}
              size="sm"
              onClick={() => setPasteMode((v) => !v)}
            >
              {pasteMode ? 'Disable Paste Mode' : 'Enable Paste Mode'}
            </Button>
            <TextInput
              ref={searchInputRef}
              placeholder="Search customers... (Ctrl+F)"
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(event) => handleSearch(event.currentTarget.value)}
              size="sm"
              disabled={customers.length === 0}
              style={{ minWidth: 260 }}
            />
            <FileInput
              placeholder="Select CSV file"
              accept=".csv"
              value={file}
              onChange={setFile}
              leftSection={<IconUpload size={16} />}
              size="sm"
              style={{ minWidth: 200 }}
            />
            <Button
              onClick={handleImportCSV}
              disabled={!file}
              leftSection={<IconUpload size={16} />}
              size="sm"
            >
              Import CSV
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              size="sm"
              color="blue"
              onClick={() => setAddOpen(true)}
            >
              Add New Customer
            </Button>
          </Group>
        </Group>

        {/* Add New Customer Modal - Enhanced Modern Design */}
        <Modal 
          opened={addOpen} 
          onClose={() => setAddOpen(false)}
          closeOnClickOutside={false}
          closeOnEscape={false}
          withCloseButton={true}
          size="xl"
          radius="lg"
          shadow="xl"
          centered
          padding="xl"
          styles={{
            header: {
              backgroundColor: 'var(--mantine-color-blue-0)',
              borderRadius: '12px 12px 0 0',
              padding: '24px 32px 16px 32px',
              borderBottom: '1px solid var(--mantine-color-gray-2)',
            },
            title: {
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--mantine-color-blue-8)',
            },
            body: {
              padding: '32px',
              backgroundColor: 'var(--mantine-color-gray-0)',
            },
            close: {
              color: 'var(--mantine-color-blue-6)',
              '&:hover': {
                backgroundColor: 'var(--mantine-color-blue-1)',
              },
            },
          }}
          title={
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                <IconPlus size={20} />
              </ThemeIcon>
              <div>
                <Text size="xl" fw={600} c="blue.8">Add New Customer</Text>
                <Text size="sm" c="dimmed">Fill in the customer information below</Text>
              </div>
            </Group>
          }
        >
          <Stack gap="lg">
            {/* Personal Information Section */}
            <div>
              <Group mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="blue">
                  <IconUser size={14} />
                </ThemeIcon>
                <Text size="lg" fw={500} c="blue.7">Personal Information</Text>
              </Group>
              
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput
                  label="Customer Name"
                  placeholder="e.g. Jane Doe"
                  withAsterisk
                  size="md"
                  radius="md"
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-blue-5)' }
                    }
                  }}
                  value={newCustomerForm.customerName}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setNewCustomerForm((p) => {
                      const next = { ...p, customerName: v };
                      const match = customers.find(
                        (c) => c['Customer Name'].trim().toLowerCase() === v.trim().toLowerCase()
                      );
                      if (match) {
                        next.businessName = match['Business Name'] || '';
                        next.taxNumber = match['Tax Number'] || '';
                        next.businessAddress = match['Business Address'] || '';
                        next.businessContactNumber = match['Business Contact Number'] || '';
                      }
                      return next;
                    });
                  }}
                />
                
                <TextInput
                  label="Phone Number"
                  placeholder="e.g. 09171234567"
                  size="md"
                  radius="md"
                  leftSection={<IconPhone size={16} />}
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-blue-5)' }
                    }
                  }}
                  value={newCustomerForm.phoneNumber}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setNewCustomerForm((p) => ({ ...p, phoneNumber: v }));
                  }}
                />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
                <TextInput
                  label="Email Address"
                  placeholder="name@email.com"
                  size="md"
                  radius="md"
                  leftSection={<IconMail size={16} />}
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-blue-5)' }
                    }
                  }}
                  value={newCustomerForm.emailAddress}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setNewCustomerForm((p) => ({ ...p, emailAddress: v }));
                  }}
                />

                <Select
                  label="Customer Status"
                  placeholder="Select status"
                  size="md"
                  radius="md"
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-blue-5)' }
                    }
                  }}
                  data={[
                    { label: '✅ Active', value: 'Active' },
                    { label: '⏸️ Inactive', value: 'Inactive' },
                    { label: '🎯 Prospect', value: 'Prospect' },
                    { label: '⭐ VIP', value: 'VIP' },
                  ]}
                  allowDeselect
                  clearable
                  value={newCustomerForm.customerStatus || null}
                  onChange={(value) => {
                    setNewCustomerForm((p) => ({ ...p, customerStatus: value ?? '' }));
                  }}
                />
              </SimpleGrid>

              <TextInput
                label="Address"
                placeholder="Street, City, Province"
                size="md"
                radius="md"
                mt="md"
                leftSection={<IconMapPin size={16} />}
                styles={{
                  label: { fontWeight: 500, marginBottom: 8 },
                  input: { 
                    borderWidth: 2,
                    '&:focus': { borderColor: 'var(--mantine-color-blue-5)' }
                  }
                }}
                value={newCustomerForm.address}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setNewCustomerForm((p) => ({ ...p, address: v }));
                }}
              />

              <TextInput
                label="Facebook Profile"
                placeholder="https://facebook.com/username"
                size="md"
                radius="md"
                mt="md"
                styles={{
                  label: { fontWeight: 500, marginBottom: 8 },
                  input: { 
                    borderWidth: 2,
                    '&:focus': { borderColor: 'var(--mantine-color-blue-5)' }
                  }
                }}
                value={newCustomerForm.facebook}
                onChange={(e) => {
                  const v = e.currentTarget.value;
                  setNewCustomerForm((p) => ({ ...p, facebook: v }));
                }}
              />
            </div>

            {/* Business Information Section */}
            <div>
              <Group mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="green">
                  <IconBuildingStore size={14} />
                </ThemeIcon>
                <Text size="lg" fw={500} c="green.7">Business Information</Text>
                <Text size="xs" c="dimmed">(Optional - Auto-filled if customer exists)</Text>
              </Group>
              
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput
                  label="Business Name"
                  placeholder="e.g. ABC Company Inc."
                  size="md"
                  radius="md"
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-green-5)' }
                    }
                  }}
                  value={newCustomerForm.businessName}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setNewCustomerForm((p) => ({ ...p, businessName: v }));
                  }}
                />
                
                <TextInput
                  label="Tax Number"
                  placeholder="e.g. 123-456-789"
                  size="md"
                  radius="md"
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-green-5)' }
                    }
                  }}
                  value={newCustomerForm.taxNumber}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setNewCustomerForm((p) => ({ ...p, taxNumber: v }));
                  }}
                />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
                <TextInput
                  label="Business Address"
                  placeholder="Business location"
                  size="md"
                  radius="md"
                  leftSection={<IconMapPin size={16} />}
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-green-5)' }
                    }
                  }}
                  value={newCustomerForm.businessAddress}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setNewCustomerForm((p) => ({ ...p, businessAddress: v }));
                  }}
                />

                <TextInput
                  label="Business Contact Number"
                  placeholder="e.g. 02-123-4567"
                  size="md"
                  radius="md"
                  leftSection={<IconPhone size={16} />}
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { 
                      borderWidth: 2,
                      '&:focus': { borderColor: 'var(--mantine-color-green-5)' }
                    }
                  }}
                  value={newCustomerForm.businessContactNumber}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setNewCustomerForm((p) => ({ ...p, businessContactNumber: v }));
                  }}
                />
              </SimpleGrid>
            </div>

            {/* Action Buttons */}
            <Group justify="flex-end" mt="xl" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
              <Button 
                variant="subtle" 
                size="md"
                radius="md"
                onClick={() => setAddOpen(false)}
                styles={{
                  root: {
                    '&:hover': {
                      backgroundColor: 'var(--mantine-color-gray-1)',
                    }
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                size="md"
                radius="md"
                gradient={{ from: 'blue', to: 'blue.6', deg: 45 }}
                disabled={!newCustomerForm.customerName.trim()}
                leftSection={<IconPlus size={18} />}
                styles={{
                  root: {
                    boxShadow: '0 4px 12px rgba(34, 139, 230, 0.2)',
                    '&:hover': {
                      boxShadow: '0 6px 16px rgba(34, 139, 230, 0.3)',
                      transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.2s ease',
                  }
                }}
                onClick={() => {
                  const savedName = newCustomerForm.customerName.trim();
                  const newCustomer: CustomerData = {
                    Date: new Date().toISOString().slice(0, 10),
                    'Customer Name': savedName,
                    'Phone Number': newCustomerForm.phoneNumber.trim(),
                    Address: newCustomerForm.address.trim(),
                    Facebook: newCustomerForm.facebook.trim(),
                    'Email Address': newCustomerForm.emailAddress.trim(),
                    'Business Name': newCustomerForm.businessName.trim(),
                    'Tax Number': newCustomerForm.taxNumber.trim(),
                    'Business Address': newCustomerForm.businessAddress.trim(),
                    'Business Contact Number': newCustomerForm.businessContactNumber.trim(),
                    'Customer Status': newCustomerForm.customerStatus.trim(),
                  };

                  const nextCustomers = [newCustomer, ...customers];

                  // Persist single add
                  (async () => {
                    try {
                      const res = await fetch('/api/customers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newCustomer),
                      });
                      if (!res.ok) {
                        let msg = 'Failed to persist new customer';
                        try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
                        notifications.show({ title: 'Saved locally only', message: msg, color: 'yellow' });
                      }
                    } catch (e) {
                      console.error('Failed to persist new customer', e);
                      notifications.show({ title: 'Saved locally only', message: 'Database not reachable', color: 'yellow' });
                    }
                  })();

                  setCustomers(nextCustomers);

                  if (!searchQuery.trim()) {
                    setFilteredCustomers(nextCustomers);
                  } else {
                    const q = searchQuery.toLowerCase();
                    const filtered = nextCustomers.filter((customer) =>
                      customer.Date.toLowerCase().includes(q) ||
                      customer['Customer Name'].toLowerCase().includes(q) ||
                      customer['Phone Number'].toLowerCase().includes(q) ||
                      customer.Address.toLowerCase().includes(q) ||
                      customer.Facebook.toLowerCase().includes(q) ||
                      customer['Email Address'].toLowerCase().includes(q) ||
                      customer['Business Name'].toLowerCase().includes(q) ||
                      customer['Tax Number'].toLowerCase().includes(q) ||
                      customer['Business Address'].toLowerCase().includes(q) ||
                      customer['Business Contact Number'].toLowerCase().includes(q) ||
                      customer['Customer Status'].toLowerCase().includes(q)
                    );
                    setFilteredCustomers(filtered);
                  }

                  // Reset and close
                  setNewCustomerForm({
                    customerName: '',
                    phoneNumber: '',
                    address: '',
                    facebook: '',
                    emailAddress: '',
                    businessName: '',
                    taxNumber: '',
                    businessAddress: '',
                    businessContactNumber: '',
                    customerStatus: '',
                  });
                  setAddOpen(false);

                  // Success toast
                  notifications.show({
                    title: '🎉 Customer Added Successfully!',
                    message: `${savedName} has been added to your customer database`,
                    color: 'green',
                    icon: <IconCheck size={18} />,
                    autoClose: 4000,
                  });
                }}
              >
                Add Customer
              </Button>
            </Group>
          </Stack>
        </Modal>


        <Card withBorder shadow="sm" radius="md" padding={0} style={{
          height: gridHeight,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          position: 'relative',
          background: '#fff',
          fontSize: '18px'
        }} className="data-grid-container">
          <DataEditor
            getCellContent={getData}
            columns={columns}
            rows={getRowCount()}
            height={gridHeight}
            width={"100%"}
            overscrollX={0}
            smoothScrollX={true}
            smoothScrollY={true}
            rowHeight={70}
            headerHeight={80}
            rowMarkers="number"
            onPaste={pasteMode ? handlePaste : undefined}
            isDraggable={false}
            onCellClicked={(cell, event) => {
              const [col, row] = cell;
              const column = columns[col];
              
              // Only handle clicks on the customer name column
              if (column?.id === 'customerName' && row < filteredCustomers.length) {
                const customer = filteredCustomers[row];
                if (customer?.id) {
                  router.push(`/clothing/operations/customers/${customer.id}`);
                }
              }
            }}
            experimental={{
              scrollbarWidthOverride: 16,
            }}
            drawHeader={drawHeader}
            theme={{
              // Updated font sizes for better readability
              accentColor: '#228be6',
              accentLight: 'rgba(34, 139, 230, 0.1)',
              textDark: '#212529',
              textMedium: '#495057',
              textLight: '#868e96',
              textBubble: '#ffffff',
              bgIconHeader: '#f8f9fa',
              fgIconHeader: '#495057',
              textHeader: '#343a40',
              textHeaderSelected: '#228be6',
              bgCell: '#ffffff',
              bgCellMedium: '#ffffff',
              bgHeader: '#f8f9fa',
              bgHeaderHasFocus: '#e9ecef',
              bgHeaderHovered: '#e9ecef',
              bgBubble: '#228be6',
              bgBubbleSelected: '#1c7ed6',
              bgSearchResult: '#fff3cd',
              borderColor: 'rgba(206, 212, 218, 0.5)',
              drilldownBorder: 'rgba(34, 139, 230, 0.4)',
              linkColor: '#228be6',
              headerFontStyle: 'bold 17px Inter',
              baseFontStyle: '17px Inter',
              editorFontSize: '20',
              fontFamily: 'Inter',
              cellHorizontalPadding: 12,
              cellVerticalPadding: 8,
            }}
            getCellsForSelection={true}
          />
        </Card>
      </Stack>
    </PageLayout>
  );
}
