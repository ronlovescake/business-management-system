import { Badge } from '@mantine/core';

/** Returns the Mantine Badge color for a given employment status. */
export function getEmploymentStatusColor(status: string | undefined): string {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'green';
    case 'terminated':
      return 'gray';
    case 'resigned':
      return 'orange';
    default:
      return 'gray';
  }
}

/** Renders an employment status badge, or null if status is unknown/missing. */
export function EmploymentStatusBadge({
  status,
}: {
  status: string | undefined;
}) {
  if (!status || status === 'Unknown') {
    return null;
  }
  return (
    <Badge size="sm" variant="light" color={getEmploymentStatusColor(status)}>
      {status}
    </Badge>
  );
}
