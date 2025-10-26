// Re-export commonly used Mantine components
export {
  Button,
  Container,
  Text,
  Title,
  Stack,
  Group,
  Card,
  Paper,
  Divider,
  Space,
  Box,
  Flex,
} from '@mantine/core';

// Custom components
export { DataGrid } from './DataGrid';

// Export the main DataTable component and related interfaces
export { DataTable, type StatCard, type DataTableProps } from './DataTable';

// Export the hook for easier data management
export { useDataTable, type UseDataTableProps } from '../../hooks/useDataTable';

// Error display components
export {
  ErrorDisplay,
  CompactErrorDisplay,
  InlineErrorDisplay,
  type ErrorDisplayProps,
} from './ErrorDisplay';

// Skeleton components
export {
  TableSkeleton,
  CompactTableSkeleton,
  LargeTableSkeleton,
  type TableSkeletonProps,
} from './TableSkeleton';

export {
  FormSkeleton,
  CompactFormSkeleton,
  InlineFormSkeleton,
  type FormSkeletonProps,
  type FormFieldConfig,
  type FormFieldType,
} from './FormSkeleton';

export {
  CardSkeleton,
  CompactCardSkeleton,
  StatCardSkeleton,
  type CardSkeletonProps,
} from './CardSkeleton';

export {
  ListSkeleton,
  CompactListSkeleton,
  InlineListSkeleton,
  type ListSkeletonProps,
} from './ListSkeleton';

export {
  ChartSkeleton,
  CompactChartSkeleton,
  type ChartSkeletonProps,
  type ChartType,
} from './ChartSkeleton';

// Re-export commonly used types from glide-data-grid
export type { GridColumn, Item } from '@glideapps/glide-data-grid';
