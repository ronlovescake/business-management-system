import { memo, type RefObject } from 'react';
import { Card } from '@mantine/core';
import { HotTable } from '@handsontable/react';
import type { HotTableClass } from '@handsontable/react';
import type { CellChange, ChangeSource } from 'handsontable/common';
import type Handsontable from 'handsontable';
type ColumnSettings = Handsontable.ColumnSettings;
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-horizon.min.css';
import type { ShippingFeeData } from '../hooks/useShippingFeeCalculator';

registerAllModules();

interface ShippingCostBreakdownProps {
  data: ShippingFeeData[];
  columns: ColumnSettings[];
  gridHeight: number;
  hotTableRef: RefObject<HotTableClass>;
  onAfterChange: (changes: CellChange[] | null, source: ChangeSource) => void;
}

export const ShippingCostBreakdown = memo(
  ({
    data,
    columns,
    gridHeight,
    hotTableRef,
    onAfterChange,
  }: ShippingCostBreakdownProps) => (
    <Card
      withBorder
      shadow="sm"
      radius="md"
      padding={0}
      style={{
        height: gridHeight,
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        background: '#fff',
      }}
    >
      <HotTable
        ref={hotTableRef}
        data={data}
        columns={columns}
        colHeaders
        rowHeaders
        width="100%"
        height={gridHeight}
        licenseKey="non-commercial-and-evaluation"
        stretchH="all"
        contextMenu
        manualColumnResize
        manualRowResize
        filters
        dropdownMenu
        minSpareRows={1}
        afterChange={onAfterChange}
        className="ht-theme-horizon htCenter htMiddle"
      />
    </Card>
  )
);

ShippingCostBreakdown.displayName = 'ShippingCostBreakdown';
