# Leave Tracker Database Setup Complete ✅

## Summary

Successfully created the `leave_requests` table for the clothing/employees/leave-tracker module.

## Table Structure

### Table Name: `leave_requests`

| Column         | Type         | Constraints                 | Description                 |
| -------------- | ------------ | --------------------------- | --------------------------- |
| `id`           | SERIAL       | PRIMARY KEY                 | Auto-incrementing ID        |
| `createdAt`    | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()     | Record creation timestamp   |
| `updatedAt`    | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()     | Record update timestamp     |
| `employeeId`   | VARCHAR(50)  | NOT NULL                    | Employee identifier         |
| `employeeName` | VARCHAR(255) | NOT NULL                    | Full employee name          |
| `leaveType`    | VARCHAR(50)  | NOT NULL                    | Type of leave request       |
| `startDate`    | VARCHAR(50)  | NOT NULL                    | Leave start date            |
| `endDate`      | VARCHAR(50)  | NOT NULL                    | Leave end date              |
| `numberOfDays` | INTEGER      | NOT NULL                    | Total number of leave days  |
| `reason`       | TEXT         | NOT NULL                    | Reason for leave            |
| `status`       | VARCHAR(20)  | NOT NULL, DEFAULT 'pending' | Request status              |
| `appliedDate`  | VARCHAR(50)  | NOT NULL                    | Date when leave was applied |
| `approvedBy`   | VARCHAR(255) | NULLABLE                    | Name of approver            |
| `notes`        | TEXT         | NULLABLE                    | Additional notes            |

## Indexes Created

For optimal query performance, the following indexes were created:

- `leave_requests_pkey` - Primary key on `id`
- `leave_requests_employeeId_idx` - Index on `employeeId`
- `leave_requests_employeeName_idx` - Index on `employeeName`
- `leave_requests_leaveType_idx` - Index on `leaveType`
- `leave_requests_status_idx` - Index on `status`
- `leave_requests_startDate_idx` - Index on `startDate`
- `leave_requests_appliedDate_idx` - Index on `appliedDate`

## Leave Types Supported

- Sick Leave
- Vacation Leave
- Emergency Leave
- Maternity Leave
- Paternity Leave
- Bereavement Leave
- Other

## Status Values

- `pending` - Default status for new requests
- `approved` - Request has been approved
- `rejected` - Request has been rejected

## Integration

### Prisma Schema

The `LeaveRequest` model has been added to `prisma/schema.prisma`:

```prisma
model LeaveRequest {
  id           Int      @id @default(autoincrement())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  employeeId   String   @db.VarChar(50)
  employeeName String   @db.VarChar(255)

  leaveType    String   @db.VarChar(50)
  startDate    String   @db.VarChar(50)
  endDate      String   @db.VarChar(50)
  numberOfDays Int
  reason       String   @db.Text

  status       String   @db.VarChar(20)
  appliedDate  String   @db.VarChar(50)
  approvedBy   String?  @db.VarChar(255)
  notes        String?  @db.Text

  @@index([employeeId])
  @@index([employeeName])
  @@index([leaveType])
  @@index([status])
  @@index([startDate])
  @@index([appliedDate])
  @@map("leave_requests")
}
```

### TypeScript Types

The TypeScript interfaces are defined in `src/app/clothing/employees/leave-tracker/types.ts`:

```typescript
export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type LeaveType =
  | 'Sick Leave'
  | 'Vacation Leave'
  | 'Emergency Leave'
  | 'Maternity Leave'
  | 'Paternity Leave'
  | 'Bereavement Leave'
  | 'Other';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason: string;
  status: LeaveStatus;
  appliedDate: string;
  approvedBy?: string;
  notes?: string;
}
```

## Next Steps

You're now ready to log employee leave requests! The database table is fully set up and indexed for optimal performance.

To use the table with Prisma:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Create a leave request
await prisma.leaveRequest.create({
  data: {
    employeeId: 'EMP001',
    employeeName: 'John Doe',
    leaveType: 'Sick Leave',
    startDate: '2025-10-20',
    endDate: '2025-10-22',
    numberOfDays: 3,
    reason: 'Medical appointment',
    status: 'pending',
    appliedDate: '2025-10-19',
  },
});

// Query leave requests
const requests = await prisma.leaveRequest.findMany({
  where: { status: 'pending' },
  orderBy: { appliedDate: 'desc' },
});
```

## Database Details

- **Database**: PostgreSQL
- **Connection**: `postgresql://ron:ronpassword@localhost:5432/business_management_db`
- **Schema**: `public`
- **Created**: October 19, 2025
