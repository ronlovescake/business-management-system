import { memo } from 'react';
import { Button, Menu, FileButton } from '@mantine/core';
import {
  IconFileDownload,
  IconFileUpload,
  IconPlus,
} from '@tabler/icons-react';

interface CustomerGridControlsProps {
  onExportCSV: () => void;
  onExportDetailedCSV: () => void;
  onExportAnalysisCSV: () => void;
  onImportCSV: (file: File | null) => void;
  onAddCustomer: () => void;
  file: File | null;
  setFile: (file: File | null) => void;
}

export const CustomerGridControls = memo(function CustomerGridControls({
  onExportCSV,
  onExportDetailedCSV,
  onExportAnalysisCSV,
  onImportCSV,
  onAddCustomer,
  file,
  setFile,
}: CustomerGridControlsProps) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
      <Menu shadow="md" width={350}>
        <Menu.Target>
          <Button
            leftSection={<IconFileDownload size={16} />}
            variant="default"
          >
            Export CSV
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Export Format</Menu.Label>
          <Menu.Item onClick={onExportCSV}>
            <div>
              <div style={{ fontWeight: 500 }}>Standard CSV</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Export customers with basic information
              </div>
            </div>
          </Menu.Item>
          <Menu.Item onClick={onExportDetailedCSV}>
            <div>
              <div style={{ fontWeight: 500 }}>Detailed (numbered columns)</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Include all additional info: Shopee usernames, addresses,
                phones, alternate names, Facebook
              </div>
            </div>
          </Menu.Item>
          <Menu.Item onClick={onExportAnalysisCSV}>
            <div>
              <div style={{ fontWeight: 500 }}>Analysis (duplicate rows)</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Each additional info on separate row - useful for analysis
              </div>
            </div>
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <FileButton onChange={setFile} accept=".csv">
        {(props) => (
          <Button
            {...props}
            leftSection={<IconFileUpload size={16} />}
            variant="default"
          >
            Import CSV
          </Button>
        )}
      </FileButton>

      {file && (
        <Button onClick={() => onImportCSV(file)} color="blue">
          Process {file.name}
        </Button>
      )}

      <Button
        leftSection={<IconPlus size={16} />}
        onClick={onAddCustomer}
        color="blue"
      >
        Add Customer
      </Button>
    </div>
  );
});
