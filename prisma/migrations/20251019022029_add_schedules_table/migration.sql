/*
  Warnings:

  - You are about to drop the column `created_at` on the `schedules` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `schedules` table. All the data in the column will be lost.
  - You are about to drop the column `employee_id` on the `schedules` table. All the data in the column will be lost.
  - You are about to drop the column `employee_name` on the `schedules` table. All the data in the column will be lost.
  - You are about to drop the column `end_time` on the `schedules` table. All the data in the column will be lost.
  - You are about to drop the column `is_override` on the `schedules` table. All the data in the column will be lost.
  - You are about to drop the column `recurrence_id` on the `schedules` table. All the data in the column will be lost.
  - You are about to drop the column `shift_type` on the `schedules` table. All the data in the column will be lost.
  - You are about to drop the column `start_time` on the `schedules` table. All the data in the column will be lost.
  - You are about to drop the column `template_id` on the `schedules` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `schedules` table. All the data in the column will be lost.
  - You are about to alter the column `source` on the `schedules` table. The data in that column could be lost. The data in that column will be cast from `VarChar(50)` to `VarChar(20)`.
  - Added the required column `employeeId` to the `schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `employeeName` to the `schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endTime` to the `schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shiftType` to the `schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `schedules` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `schedules` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "schedules_deleted_at_idx";

-- DropIndex
DROP INDEX "schedules_employee_id_idx";

-- AlterTable
ALTER TABLE "schedules" DROP COLUMN "created_at",
DROP COLUMN "deleted_at",
DROP COLUMN "employee_id",
DROP COLUMN "employee_name",
DROP COLUMN "end_time",
DROP COLUMN "is_override",
DROP COLUMN "recurrence_id",
DROP COLUMN "shift_type",
DROP COLUMN "start_time",
DROP COLUMN "template_id",
DROP COLUMN "updated_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "employeeId" VARCHAR(50) NOT NULL,
ADD COLUMN     "employeeName" VARCHAR(255) NOT NULL,
ADD COLUMN     "endTime" VARCHAR(10) NOT NULL,
ADD COLUMN     "isOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurrenceId" VARCHAR(50),
ADD COLUMN     "shiftType" VARCHAR(20) NOT NULL,
ADD COLUMN     "startTime" VARCHAR(10) NOT NULL,
ADD COLUMN     "templateId" VARCHAR(50),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "source" SET DATA TYPE VARCHAR(20);

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

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "leave_requests_startDate_idx" ON "leave_requests"("startDate");

-- CreateIndex
CREATE INDEX "leave_requests_appliedDate_idx" ON "leave_requests"("appliedDate");

-- CreateIndex
CREATE INDEX "schedules_employeeId_idx" ON "schedules"("employeeId");

-- CreateIndex
CREATE INDEX "schedules_employeeName_idx" ON "schedules"("employeeName");

-- CreateIndex
CREATE INDEX "schedules_shiftType_idx" ON "schedules"("shiftType");

-- CreateIndex
CREATE INDEX "schedules_department_idx" ON "schedules"("department");

-- CreateIndex
CREATE INDEX "schedules_deletedAt_idx" ON "schedules"("deletedAt");
