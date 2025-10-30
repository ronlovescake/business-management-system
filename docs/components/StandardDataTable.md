# StandardDataTable Component

A reusable table component with consistent styling across all data tables in the application.

## Features

- **Fixed height**: 71vh with scrollable content
- **Gray header background**: #f1f3f5
- **Centered header text**: With consistent padding (16px 12px)
- **Text color**: #495057 for all content
- **Hover effects**: Automatically applied to rows
- **Border styling**: Consistent table borders
- **Empty state**: Built-in empty state handling
- **Summary section**: Optional summary/footer below table

## Standard Styling Constants

All styling is defined in `STANDARD_TABLE_STYLES`:

```typescript
export const STANDARD_TABLE_STYLES = {
  card: {
    height: '71vh', // Fixed table height
    padding: 0, // No padding on card
    overflow: 'hidden' as const,
  },
  box: {
    height: '100%',
    overflowY: 'auto' as const, // Enable vertical scrolling
  },
  header: {
    padding: '16px 12px', // Consistent header padding
    color: '#495057', // Dark gray text
    backgroundColor: '#f1f3f5', // Light gray background
    textAlign: 'center' as const,
  },
  headerBackground: '#f1f3f5',
} as const;
```

## Usage

### Basic Example

```tsx
import {
  StandardDataTable,
  StandardTableContainer,
} from '@/components/tables/StandardDataTable';

export function MyTableComponent() {
  const data = [...]; // Your data array

  return (
    <StandardTableContainer
      summary={
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Showing {data.length} items
          </Text>
        </Group>
      }
    >
      <StandardDataTable
        headers={['Column 1', 'Column 2', 'Column 3', 'Action']}
        emptyState="No data found"
        colSpan={4}
      >
        {data.map((item) => (
          <Table.Tr key={item.id}>
            <Table.Td>{item.field1}</Table.Td>
            <Table.Td>{item.field2}</Table.Td>
            <Table.Td>{item.field3}</Table.Td>
            <Table.Td>
              {/* Action buttons */}
            </Table.Td>
          </Table.Tr>
        ))}
      </StandardDataTable>
    </StandardTableContainer>
  );
}
```

### With Action Buttons

```tsx
<StandardDataTable
  headers={['Name', 'Email', 'Status', 'Action']}
  emptyState="No users found"
  colSpan={4}
>
  {users.map((user) => (
    <Table.Tr key={user.id}>
      <Table.Td>
        <Text size="sm" c="#495057">
          {user.name}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="#495057">
          {user.email}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge color={getStatusColor(user.status)}>{user.status}</Badge>
      </Table.Td>
      <Table.Td>
        <Group gap="xs" justify="center">
          <Tooltip label="Edit">
            <ActionIcon
              color="blue"
              variant="light"
              size="sm"
              onClick={() => handleEdit(user)}
              {...getActionLabel('Edit', 'user', user.name)}
            >
              <IconEdit size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon
              color="red"
              variant="light"
              size="sm"
              onClick={() => handleDelete(user.id)}
              {...getActionLabel('Delete', 'user', user.name)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  ))}
</StandardDataTable>
```

### Custom Height

```tsx
<StandardDataTable
  headers={['Column 1', 'Column 2']}
  height="50vh" // Override default 71vh
  emptyState="No data available"
  colSpan={2}
>
  {/* table rows */}
</StandardDataTable>
```

### Without Summary

```tsx
<StandardDataTable
  headers={['Column 1', 'Column 2']}
  emptyState="No data found"
  colSpan={2}
>
  {/* table rows */}
</StandardDataTable>
```

## Props

### StandardDataTable Props

| Prop         | Type        | Required | Default          | Description                                        |
| ------------ | ----------- | -------- | ---------------- | -------------------------------------------------- |
| `headers`    | `string[]`  | Yes      | -                | Array of column header names                       |
| `children`   | `ReactNode` | Yes      | -                | Table rows (Table.Tr components)                   |
| `height`     | `string`    | No       | `'71vh'`         | Height of the table container                      |
| `emptyState` | `ReactNode` | No       | -                | Content to show when no data (string or component) |
| `colSpan`    | `number`    | No       | `headers.length` | Number of columns for empty state colspan          |

### StandardTableContainer Props

| Prop       | Type        | Required | Default | Description                                 |
| ---------- | ----------- | -------- | ------- | ------------------------------------------- |
| `children` | `ReactNode` | Yes      | -       | The StandardDataTable component             |
| `summary`  | `ReactNode` | No       | -       | Optional summary/footer content below table |

## Best Practices

1. **Always use with StandardTableContainer** for consistent spacing and optional summary
2. **Use getActionLabel** from `@/lib/accessibility` for action buttons
3. **Set colSpan** to match the number of headers for proper empty state display
4. **Use Text component** with `c="#495057"` for consistent text color
5. **Center align** numeric or short text columns with `style={{ textAlign: 'center' }}`
6. **Add Tooltips** to action buttons for better UX

## Migration from Old Tables

Replace this old pattern:

```tsx
<Card withBorder padding={0} style={{ overflow: 'hidden', height: '71vh' }}>
  <Box style={{ height: '100%', overflowY: 'auto' }}>
    <Table highlightOnHover withTableBorder>
      <Table.Thead style={{ backgroundColor: '#f1f3f5' }}>
        {/* headers with inline styles */}
      </Table.Thead>
      <Table.Tbody>{/* rows */}</Table.Tbody>
    </Table>
  </Box>
</Card>
```

With this new pattern:

```tsx
<StandardDataTable
  headers={['Header 1', 'Header 2']}
  emptyState="No data found"
  colSpan={2}
>
  {/* rows */}
</StandardDataTable>
```

## Examples in Codebase

- **Checkout Links**: `src/modules/clothing/operations/checkout-links/components/CheckoutLinksComponent.tsx`
- **Expenses (old pattern)**: `src/app/clothing/employees/expenses/components/ExpenseListTable.tsx`

## Notes

- The component automatically handles empty states
- All styling is centralized in `STANDARD_TABLE_STYLES`
- Table headers are always uppercase by convention
- To modify default styles, update `STANDARD_TABLE_STYLES` constant
