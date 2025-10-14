'use client';

import { useCallback } from 'react';
import { GridCellKind } from '@glideapps/glide-data-grid';
import type { GridCell, GridColumn, Item } from '@glideapps/glide-data-grid';
import { Box } from '@mantine/core';
import { GridView } from '../grid';

interface DataGridProps {
  height?: number;
}

export function DataGrid({ height = 400 }: DataGridProps) {
  // Empty columns - will be populated when real data is added
  const columns: GridColumn[] = [
    {
      title: 'ID',
      width: 80,
      id: 'id',
    },
    {
      title: 'Name',
      width: 200,
      id: 'name',
    },
    {
      title: 'Status',
      width: 120,
      id: 'status',
    },
    {
      title: 'Date Created',
      width: 150,
      id: 'created',
    },
  ];

  // Empty data - following the no mock data principle
  const getData = useCallback((cell: Item): GridCell => {
    void cell;

    // Return empty cells - real data will be populated later
    return {
      kind: GridCellKind.Text,
      data: '',
      displayData: '',
      allowOverlay: true,
    };
  }, []);

  const getRowCount = useCallback(() => {
    // Return 0 rows - real row count will be determined by actual data
    return 0;
  }, []);

  return (
    <Box>
      <GridView
        getCellContent={getData}
        columns={columns}
        rows={getRowCount()}
        height={height}
        smoothScrollX={true}
        smoothScrollY={true}
        rowHeight={36}
        headerHeight={36}
        theme={{
          accentColor: '#228be6',
          accentLight: 'rgba(34, 139, 230, 0.1)',
          textDark: '#212529',
          textMedium: '#495057',
          textLight: '#868e96',
          textBubble: '#ffffff',
          bgIconHeader: '#f8f9fa',
          fgIconHeader: '#495057',
          textHeader: '#212529',
          textHeaderSelected: '#228be6',
          bgCell: '#ffffff',
          bgCellMedium: '#f8f9fa',
          bgHeader: '#f8f9fa',
          bgHeaderHasFocus: '#e9ecef',
          bgHeaderHovered: '#e9ecef',
          bgBubble: '#228be6',
          bgBubbleSelected: '#1c7ed6',
          bgSearchResult: '#fff3cd',
          borderColor: 'rgba(206, 212, 218, 0.5)',
          drilldownBorder: 'rgba(34, 139, 230, 0.4)',
          linkColor: '#228be6',
          headerFontStyle: '600 14px Inter, sans-serif',
          baseFontStyle: '400 14px Inter, sans-serif',
          fontFamily: 'Inter, sans-serif',
        }}
      />
    </Box>
  );
}

export default DataGrid;
