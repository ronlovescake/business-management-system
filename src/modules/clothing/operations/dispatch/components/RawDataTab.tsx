'use client';

import { memo } from 'react';
import { Stack, Text, Group, Badge, Card } from '@mantine/core';
import { StandardTableControls } from '@/components/tables/StandardDataTable';
import { showInfo } from '@/lib/alerts';
import type { RawOrderData } from '../types';

interface RawDataTabProps {
  effectiveRawData: RawOrderData[];
  savedOrders: RawOrderData[] | undefined;
  loadingSavedOrders: boolean;
  fetchError: Error | null;
  _rawDataSearch: string;
  setRawDataSearch: (search: string) => void;
  handleXlsxImport: (file: File | null) => Promise<void>;
  isImportingRawData: boolean;
}

function RawDataTabComponent({
  effectiveRawData,
  savedOrders,
  loadingSavedOrders,
  fetchError,
  _rawDataSearch,
  setRawDataSearch,
  handleXlsxImport,
  isImportingRawData,
}: RawDataTabProps) {
  return (
    <Stack gap="md">
      {/* Table Controls for Raw Data */}
      <StandardTableControls
        searchPlaceholder="Search raw data..."
        onSearch={setRawDataSearch}
        onImport={handleXlsxImport}
        onExport={async () => {
          await showInfo('Would export raw data', 'Export Simulation');
        }}
        onAddNew={async () => {
          await showInfo('Would add new raw data entry', 'Add New Simulation');
        }}
        isImporting={isImportingRawData}
        acceptFileTypes=".xlsx,.xls"
      />

      {effectiveRawData.length > 0 && (
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              {savedOrders && savedOrders.length > 0
                ? `Saved Data from Database (${effectiveRawData.length} rows)`
                : `Imported Data Preview (${effectiveRawData.length} rows - Not saved yet)`}
            </Text>
            {savedOrders && savedOrders.length > 0 && (
              <Badge color="blue" variant="light">
                From Database
              </Badge>
            )}
            {fetchError && (
              <Badge color="red" variant="light">
                Error loading from database
              </Badge>
            )}
          </Group>
          <div
            style={{
              maxHeight: '86vh',
              overflow: 'auto',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              padding: '12px',
            }}
          >
            <pre
              style={{
                fontSize: '12px',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {JSON.stringify(effectiveRawData, null, 2)}
            </pre>
          </div>
        </Stack>
      )}

      {effectiveRawData.length === 0 && (
        <Card withBorder padding="xl">
          <Text ta="center" c="dimmed" size="lg">
            {loadingSavedOrders
              ? 'Loading saved orders from database...'
              : 'No data available. Click Import to upload an XLSX file.'}
          </Text>
        </Card>
      )}
    </Stack>
  );
}

export const RawDataTab = memo(RawDataTabComponent);
RawDataTab.displayName = 'RawDataTab';
