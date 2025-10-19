-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "employee_id" VARCHAR(50) NOT NULL,
    "employee_name" VARCHAR(255) NOT NULL,
    "date" VARCHAR(50) NOT NULL,
    "shift_type" VARCHAR(50) NOT NULL,
    "start_time" VARCHAR(20) NOT NULL,
    "end_time" VARCHAR(20) NOT NULL,
    "position" VARCHAR(100) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "source" VARCHAR(50) NOT NULL DEFAULT 'manual',
    "template_id" VARCHAR(100),
    "recurrence_id" VARCHAR(100),
    "is_override" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedules_employee_id_idx" ON "schedules"("employee_id");

-- CreateIndex
CREATE INDEX "schedules_date_idx" ON "schedules"("date");

-- CreateIndex
CREATE INDEX "schedules_status_idx" ON "schedules"("status");

-- CreateIndex
CREATE INDEX "schedules_deleted_at_idx" ON "schedules"("deleted_at");
