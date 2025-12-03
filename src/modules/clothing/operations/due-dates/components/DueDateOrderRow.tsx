import { memo } from 'react';
import { ActionIcon, Badge, Group, Table, Text, Tooltip } from '@mantine/core';
import { IconBrandFacebook, IconMessage } from '@tabler/icons-react';
import { DueDateService } from '../services/DueDateService';
import type { DueDateTransaction } from '../types/dueDate.types';

interface DueDateOrderRowProps {
  order: DueDateTransaction;
  isLastInGroup: boolean;
  isFirstInGroup: boolean;
  customerName: string;
  facebookLink: string;
  rowSpan: number;
}

export const DueDateOrderRow = memo(
  ({
    order,
    isLastInGroup,
    isFirstInGroup,
    customerName,
    facebookLink,
    rowSpan,
  }: DueDateOrderRowProps) => {
    const dueDate = DueDateService.calculateDueDate(order['Invoice Date']);
    const dueInHours = DueDateService.calculateHoursUntilDue(dueDate);

    const cellStyle = {
      textAlign: 'center' as const,
      border: 'none',
      borderBottom: isLastInGroup ? '1px solid #dee2e6' : 'none',
    };

    return (
      <Table.Tr>
        {isFirstInGroup && (
          <Table.Td
            rowSpan={rowSpan}
            style={{
              border: 'none',
              borderBottom: isLastInGroup ? '1px solid #dee2e6' : 'none',
              verticalAlign: 'top',
              paddingTop: '12px',
            }}
          >
            {customerName}
          </Table.Td>
        )}
        <Table.Td style={cellStyle}>
          <Text size="sm" c="#495057">
            {order['Product Code']}
          </Text>
        </Table.Td>
        <Table.Td style={cellStyle}>
          <Text size="sm" c="#495057">
            {(order.Quantity || 0).toLocaleString()}
          </Text>
        </Table.Td>
        <Table.Td style={cellStyle}>
          <Text size="sm" c="#495057">
            {DueDateService.formatCurrency(order['Unit Price'] || 0)}
          </Text>
        </Table.Td>
        <Table.Td style={cellStyle}>
          <Text fw={600} size="sm" c="#495057">
            {DueDateService.formatCurrency(order['Line Total'])}
          </Text>
        </Table.Td>
        <Table.Td style={cellStyle}>
          <Text size="sm" c="#495057">
            {DueDateService.formatDate(order['Invoice Date'])}
          </Text>
        </Table.Td>
        <Table.Td style={cellStyle}>
          <Text size="sm" c="#495057">
            {DueDateService.formatDate(dueDate)}
          </Text>
        </Table.Td>
        <Table.Td style={cellStyle}>
          <Badge
            color={
              dueInHours < 0 ? 'red' : dueInHours <= 168 ? 'orange' : 'green'
            }
            variant="light"
          >
            {dueInHours === 0
              ? 'Due now'
              : `${Math.abs(dueInHours)} ${Math.abs(dueInHours) === 1 ? 'hour' : 'hours'}`}
          </Badge>
        </Table.Td>
        <Table.Td style={cellStyle}>
          <Text size="sm" c="dimmed" lineClamp={1}>
            {order.Notes || '-'}
          </Text>
        </Table.Td>
        {isFirstInGroup && (
          <Table.Td
            rowSpan={rowSpan}
            style={{
              border: 'none',
              borderBottom: isLastInGroup ? '1px solid #dee2e6' : 'none',
              verticalAlign: 'top',
              paddingTop: '8px',
            }}
          >
            <Group gap="xs" wrap="nowrap">
              <Tooltip label="Send Message">
                <ActionIcon
                  variant="light"
                  color="blue"
                  size="sm"
                  aria-label={`Send message to ${customerName}`}
                >
                  <IconMessage size={16} />
                </ActionIcon>
              </Tooltip>
              {facebookLink && (
                <Tooltip label="View Facebook Profile">
                  <ActionIcon
                    component="a"
                    href={facebookLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="light"
                    color="blue"
                    size="sm"
                    aria-label={`View ${customerName}'s Facebook profile`}
                  >
                    <IconBrandFacebook size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Table.Td>
        )}
      </Table.Tr>
    );
  }
);

DueDateOrderRow.displayName = 'DueDateOrderRow';
