-- CreateTable
CREATE TABLE "leave_requests" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" VARCHAR(50) NOT NULL,
    "employeeName" VARCHAR(255) NOT NULL,
    "leaveType" VARCHAR(50) NOT NULL,
    "startDate" VARCHAR(50) NOT NULL,
    "endDate" VARCHAR(50) NOT NULL,
    "numberOfDays" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "appliedDate" VARCHAR(50) NOT NULL,
    "approvedBy" VARCHAR(255),
    "notes" TEXT,
    "paymentStatus" VARCHAR(20) NOT NULL DEFAULT 'unpaid',

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "employeeId" VARCHAR(50) NOT NULL,
    "employeeName" VARCHAR(255) NOT NULL,
    "date" VARCHAR(50) NOT NULL,
    "shiftType" VARCHAR(20) NOT NULL,
    "startTime" VARCHAR(10) NOT NULL,
    "endTime" VARCHAR(10) NOT NULL,
    "position" VARCHAR(100) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "templateId" VARCHAR(50),
    "recurrenceId" VARCHAR(50),
    "isOverride" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "employeeId" VARCHAR(50) NOT NULL,
    "employeeName" VARCHAR(255) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "position" VARCHAR(100) NOT NULL,
    "date" VARCHAR(50) NOT NULL,
    "timeIn" VARCHAR(10) NOT NULL,
    "timeOut" VARCHAR(10) NOT NULL,
    "break1Start" VARCHAR(10),
    "break1End" VARCHAR(10),
    "lunchStart" VARCHAR(10),
    "lunchEnd" VARCHAR(10),
    "break2Start" VARCHAR(10),
    "break2End" VARCHAR(10),
    "totalHours" DOUBLE PRECISION NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "details" VARCHAR(500),
    "notes" TEXT,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_requests_employeeId_idx" ON "leave_requests"("employeeId");

-- CreateIndex
CREATE INDEX "leave_requests_employeeName_idx" ON "leave_requests"("employeeName");

-- CreateIndex
CREATE INDEX "leave_requests_leaveType_idx" ON "leave_requests"("leaveType");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- CreateIndex
CREATE INDEX "leave_requests_paymentStatus_idx" ON "leave_requests"("paymentStatus");

-- CreateIndex
CREATE INDEX "leave_requests_startDate_idx" ON "leave_requests"("startDate");

-- CreateIndex
CREATE INDEX "leave_requests_appliedDate_idx" ON "leave_requests"("appliedDate");

-- CreateIndex
CREATE INDEX "schedules_employeeId_idx" ON "schedules"("employeeId");

-- CreateIndex
CREATE INDEX "schedules_employeeName_idx" ON "schedules"("employeeName");

-- CreateIndex
CREATE INDEX "schedules_date_idx" ON "schedules"("date");

-- CreateIndex
CREATE INDEX "schedules_shiftType_idx" ON "schedules"("shiftType");

-- CreateIndex
CREATE INDEX "schedules_status_idx" ON "schedules"("status");

-- CreateIndex
CREATE INDEX "schedules_department_idx" ON "schedules"("department");

-- CreateIndex
CREATE INDEX "schedules_deletedAt_idx" ON "schedules"("deletedAt");

-- CreateIndex
CREATE INDEX "attendance_employeeId_idx" ON "attendance"("employeeId");

-- CreateIndex
CREATE INDEX "attendance_employeeName_idx" ON "attendance"("employeeName");

-- CreateIndex
CREATE INDEX "attendance_date_idx" ON "attendance"("date");

-- CreateIndex
CREATE INDEX "attendance_status_idx" ON "attendance"("status");

-- CreateIndex
CREATE INDEX "attendance_department_idx" ON "attendance"("department");

-- CreateIndex
CREATE INDEX "attendance_deletedAt_idx" ON "attendance"("deletedAt");
