/**
 * Page Templates - Reusable UI Components
 *
 * This module provides consistent, reusable UI components for creating
 * pages with identical look and feel across the application.
 *
 * @example Creating a new page
 * ```tsx
 * import { StatsCardGroup, PageControls, DataTable } from '@/components/shared/PageTemplates';
 *
 * export default function MyPage() {
 *   return (
 *     <PageLayout fluid withPadding>
 *       <Stack gap="lg">
 *         <StatsCardGroup stats={stats} />
 *         <PageControls
 *           title="My Records"
 *           searchQuery={search}
 *           onSearchChange={setSearch}
 *           onAdd={handleAdd}
 *         />
 *         <DataTable
 *           data={items}
 *           columns={columns}
 *           actions={actions}
 *         />
 *       </Stack>
 *     </PageLayout>
 *   );
 * }
 * ```
 */

export { StatsCardGroup } from './StatsCardGroup';
export type { StatCard } from './StatsCardGroup';

export { PageControls } from './PageControls';
export type { TabConfig, FilterConfig } from './PageControls';

export { DataTable } from './DataTable';
export type { TableColumn, TableAction } from './DataTable';
