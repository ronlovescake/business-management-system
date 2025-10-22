/*
  Warnings:

  - You are about to drop the `thirteenth_month_pay_records` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "payrolls" ADD COLUMN     "thirteenthMonth" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "thirteenth_month_pay_records";
