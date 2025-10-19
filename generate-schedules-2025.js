const employees = [
  {
    employeeId: "EMP-0004",
    employeeName: "ARNEL EPHRAIM SUBIA ALIANGAN",
    position: "Warehouse POC",
    department: "Operations",
    hireDate: "2025-01-01"
  },
  {
    employeeId: "EMP-0005",
    employeeName: "RAIN JOEL ORONG SUBIA",
    position: "Warehouse Staff",
    department: "Operations",
    hireDate: "2025-01-01"
  },
  {
    employeeId: "EMP-0006",
    employeeName: "Joan Tapic Lacaulan",
    position: "Warehouse Staff",
    department: "Operations",
    hireDate: "2025-04-08"
  }
];

const schedules = [];

// Generate schedules for each employee
employees.forEach(employee => {
  const startDate = new Date(employee.hireDate);
  const endDate = new Date("2025-12-31");
  
  // Start from hire date
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Monday-Saturday (1-6), skip Sunday (0)
    if (dayOfWeek >= 1 && dayOfWeek <= 6) {
      schedules.push({
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        date: currentDate.toISOString().split('T')[0],
        shiftType: "full-day",
        startTime: "04:00",
        endTime: "17:00",
        position: employee.position,
        department: employee.department,
        status: "scheduled",
        notes: null,
        source: "manual",
        templateId: null,
        recurrenceId: null,
        isOverride: false
      });
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
});

console.log(JSON.stringify(schedules, null, 2));
console.error(`Generated ${schedules.length} schedules for ${employees.length} employees`);
