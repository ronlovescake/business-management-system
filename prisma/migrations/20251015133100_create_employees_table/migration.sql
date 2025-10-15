-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "employeeId" VARCHAR(50) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "middleName" VARCHAR(100),
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "contact" VARCHAR(50) NOT NULL,
    "address" TEXT,
    "emergencyContactPerson" VARCHAR(255),
    "emergencyContactNumber" VARCHAR(50),
    "emergencyContact" VARCHAR(50),
    "department" VARCHAR(100) NOT NULL,
    "position" VARCHAR(100) NOT NULL,
    "jobTitle" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "employmentStatus" VARCHAR(50),
    "employeeType" VARCHAR(50),
    "office" VARCHAR(255),
    "hiringSource" VARCHAR(100),
    "hireDate" VARCHAR(50) NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL,
    "currentSalary" DOUBLE PRECISION,
    "allowance" DOUBLE PRECISION,
    "paymentSchedule" VARCHAR(50),
    "bankAccount" VARCHAR(255),
    "gcashAccount" VARCHAR(50),
    "sssNumber" VARCHAR(50),
    "philHealthNumber" VARCHAR(50),
    "hdmfNumber" VARCHAR(50),
    "tinNumber" VARCHAR(50),
    "gender" VARCHAR(20),
    "dateOfBirth" VARCHAR(50),
    "maritalStatus" VARCHAR(20),
    "numberOfKids" INTEGER,
    "education" VARCHAR(255),
    "drivingLicense" VARCHAR(100),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeId_key" ON "employees"("employeeId");

-- CreateIndex
CREATE INDEX "employees_employeeId_idx" ON "employees"("employeeId");

-- CreateIndex
CREATE INDEX "employees_department_idx" ON "employees"("department");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE INDEX "employees_firstName_lastName_idx" ON "employees"("firstName", "lastName");

-- CreateIndex
CREATE INDEX "employees_deletedAt_idx" ON "employees"("deletedAt");
