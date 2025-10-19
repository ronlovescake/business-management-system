SELECT 
  "employeeId",
  "date",
  COUNT(*) as count
FROM "schedules"
WHERE "deletedAt" IS NULL
GROUP BY "employeeId", "date"
HAVING COUNT(*) > 1
LIMIT 10;
