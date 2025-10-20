-- CreateTable
CREATE TABLE "employee_automation_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stayInAutoPresenceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "stayInAutoPresenceTime" VARCHAR(5) NOT NULL DEFAULT '02:00',
    "stayInAutoPresenceTimezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Manila',
    "stayInAutoPresenceGraceMinutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "employee_automation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_automation_settings_key_key" ON "employee_automation_settings"("key");
